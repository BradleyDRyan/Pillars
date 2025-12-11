const { firestore } = require('../config/firebase');

/**
 * OnboardingPillar — Top-level categories for onboarding (e.g., Finances, Family)
 * These are global content templates, not user-specific pillars.
 */
class OnboardingPillar {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.description = data.description || '';
    this.icon = data.icon || null;
    this.color = data.color || '#6366f1';
    this.order = data.order || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static collection() {
    return firestore.collection('onboardingPillars');
  }

  static async create(data) {
    const pillar = new OnboardingPillar(data);
    const docRef = await this.collection().add({
      title: pillar.title,
      description: pillar.description,
      icon: pillar.icon,
      color: pillar.color,
      order: pillar.order,
      isActive: pillar.isActive,
      createdAt: pillar.createdAt,
      updatedAt: pillar.updatedAt
    });
    pillar.id = docRef.id;
    return pillar;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new OnboardingPillar({ id: doc.id, ...doc.data() });
  }

  static async findAll(includeInactive = false) {
    let query = this.collection();
    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }
    const snapshot = await query.get();
    const pillars = snapshot.docs.map(doc => new OnboardingPillar({ id: doc.id, ...doc.data() }));
    return pillars.sort((a, b) => a.order - b.order);
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await OnboardingPillar.collection().doc(this.id).update({
        title: this.title,
        description: this.description,
        icon: this.icon,
        color: this.color,
        order: this.order,
        isActive: this.isActive,
        updatedAt: this.updatedAt
      });
    } else {
      const created = await OnboardingPillar.create(this);
      this.id = created.id;
    }
    return this;
  }

  async delete() {
    if (this.id) {
      // Also delete all themes and principles under this pillar
      const themes = await OnboardingTheme.findByPillarId(this.id);
      for (const theme of themes) {
        await theme.delete();
      }
      await OnboardingPillar.collection().doc(this.id).delete();
    }
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      icon: this.icon,
      color: this.color,
      order: this.order,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * OnboardingTheme — The "one thing" within a pillar (e.g., Awareness, Debt Freedom)
 */
class OnboardingTheme {
  constructor(data = {}) {
    this.id = data.id || null;
    this.pillarId = data.pillarId || null;
    this.title = data.title || '';
    this.description = data.description || '';
    this.order = data.order || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static collection() {
    return firestore.collection('onboardingThemes');
  }

  static async create(data) {
    const theme = new OnboardingTheme(data);
    const docRef = await this.collection().add({
      pillarId: theme.pillarId,
      title: theme.title,
      description: theme.description,
      order: theme.order,
      isActive: theme.isActive,
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt
    });
    theme.id = docRef.id;
    return theme;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new OnboardingTheme({ id: doc.id, ...doc.data() });
  }

  static async findByPillarId(pillarId, includeInactive = false) {
    let query = this.collection().where('pillarId', '==', pillarId);
    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }
    const snapshot = await query.get();
    const themes = snapshot.docs.map(doc => new OnboardingTheme({ id: doc.id, ...doc.data() }));
    return themes.sort((a, b) => a.order - b.order);
  }

  static async findAll(includeInactive = false) {
    let query = this.collection();
    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }
    const snapshot = await query.get();
    const themes = snapshot.docs.map(doc => new OnboardingTheme({ id: doc.id, ...doc.data() }));
    return themes.sort((a, b) => a.order - b.order);
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await OnboardingTheme.collection().doc(this.id).update({
        pillarId: this.pillarId,
        title: this.title,
        description: this.description,
        order: this.order,
        isActive: this.isActive,
        updatedAt: this.updatedAt
      });
    } else {
      const created = await OnboardingTheme.create(this);
      this.id = created.id;
    }
    return this;
  }

  async delete() {
    if (this.id) {
      // Also delete all principles under this theme
      const principles = await OnboardingPrinciple.findByThemeId(this.id);
      for (const principle of principles) {
        await principle.delete();
      }
      await OnboardingTheme.collection().doc(this.id).delete();
    }
  }

  toJSON() {
    return {
      id: this.id,
      pillarId: this.pillarId,
      title: this.title,
      description: this.description,
      order: this.order,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * OnboardingPrinciple — The specific principle statements users can select
 */
class OnboardingPrinciple {
  constructor(data = {}) {
    this.id = data.id || null;
    this.themeId = data.themeId || null;
    this.text = data.text || '';
    this.order = data.order || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isDraft = data.isDraft !== undefined ? data.isDraft : false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static collection() {
    return firestore.collection('onboardingPrinciples');
  }

  static async create(data) {
    const principle = new OnboardingPrinciple(data);
    const docRef = await this.collection().add({
      themeId: principle.themeId,
      text: principle.text,
      order: principle.order,
      isActive: principle.isActive,
      isDraft: principle.isDraft,
      createdAt: principle.createdAt,
      updatedAt: principle.updatedAt
    });
    principle.id = docRef.id;
    return principle;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new OnboardingPrinciple({ id: doc.id, ...doc.data() });
  }

  static async findByThemeId(themeId, includeInactive = false, includeDrafts = false) {
    // Fetch all for this theme then filter in JS to avoid composite index requirements
    const snapshot = await this.collection().where('themeId', '==', themeId).get();
    let principles = snapshot.docs.map(doc => new OnboardingPrinciple({ id: doc.id, ...doc.data() }));
    if (!includeInactive) {
      principles = principles.filter(p => p.isActive);
    }
    if (!includeDrafts) {
      principles = principles.filter(p => !p.isDraft);
    }
    return principles.sort((a, b) => a.order - b.order);
  }

  static async findAll(includeInactive = false, includeDrafts = false) {
    // Fetch all then filter in JS to avoid composite index requirements
    const snapshot = await this.collection().get();
    let principles = snapshot.docs.map(doc => new OnboardingPrinciple({ id: doc.id, ...doc.data() }));
    if (!includeInactive) {
      principles = principles.filter(p => p.isActive);
    }
    if (!includeDrafts) {
      principles = principles.filter(p => !p.isDraft);
    }
    return principles.sort((a, b) => a.order - b.order);
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await OnboardingPrinciple.collection().doc(this.id).update({
        themeId: this.themeId,
        text: this.text,
        order: this.order,
        isActive: this.isActive,
        isDraft: this.isDraft,
        updatedAt: this.updatedAt
      });
    } else {
      const created = await OnboardingPrinciple.create(this);
      this.id = created.id;
    }
    return this;
  }

  async approve() {
    this.isDraft = false;
    return this.save();
  }

  async delete() {
    if (this.id) {
      await OnboardingPrinciple.collection().doc(this.id).delete();
    }
  }

  toJSON() {
    return {
      id: this.id,
      themeId: this.themeId,
      text: this.text,
      order: this.order,
      isActive: this.isActive,
      isDraft: this.isDraft,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  OnboardingPillar,
  OnboardingTheme,
  OnboardingPrinciple
};
