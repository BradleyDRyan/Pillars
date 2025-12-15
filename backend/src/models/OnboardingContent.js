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
      // Delete all principles directly under this pillar
      const principles = await OnboardingPrinciple.findByPillarId(this.id, true, true);
      for (const principle of principles) {
        await principle.delete();
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
 * OnboardingPrinciple — The specific principle statements users can select
 * Now linked directly to pillars (simplified from pillar -> theme -> principle)
 */
class OnboardingPrinciple {
  constructor(data = {}) {
    this.id = data.id || null;
    this.pillarId = data.pillarId || null;
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
      pillarId: principle.pillarId,
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

  static async findByPillarId(pillarId, includeInactive = false, includeDrafts = false) {
    const snapshot = await this.collection().where('pillarId', '==', pillarId).get();
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
        pillarId: this.pillarId,
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
      pillarId: this.pillarId,
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
  OnboardingPrinciple
};
