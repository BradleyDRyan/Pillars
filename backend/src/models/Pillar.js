const { firestore } = require('../config/firebase');

/**
 * Pillar — A major domain of life (e.g., Work, Relationship, Health)
 * 
 * Valid icon values (enum-based, translates to platform-specific assets):
 * - folder (default)
 * - health
 * - money
 * - work
 * - relationship
 * - growth
 */
class Pillar {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.color = data.color || '#000000';
    /** @type {string|null} Icon identifier (see valid values above) */
    this.icon = data.icon || null;
    this.isDefault = data.isDefault || false;
    this.isArchived = data.isArchived || false;
    this.settings = data.settings || {};
    this.stats = data.stats || {
      conversationCount: 0,
      messageCount: 0,
      taskCount: 0,
      principleCount: 0,
      wisdomCount: 0,
      resourceCount: 0
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('pillars');
  }

  static async create(data) {
    const pillar = new Pillar(data);
    const docRef = await this.collection().add({
      userId: pillar.userId,
      name: pillar.name,
      description: pillar.description,
      color: pillar.color,
      icon: pillar.icon,
      isDefault: pillar.isDefault,
      isArchived: pillar.isArchived,
      settings: pillar.settings,
      stats: pillar.stats,
      createdAt: pillar.createdAt,
      updatedAt: pillar.updatedAt,
      metadata: pillar.metadata
    });
    pillar.id = docRef.id;
    return pillar;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Pillar({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, includeArchived = false) {
    let query = this.collection().where('userId', '==', userId);
    
    if (!includeArchived) {
      query = query.where('isArchived', '==', false);
    }
    
    const snapshot = await query.orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(doc => new Pillar({ id: doc.id, ...doc.data() }));
  }

  static async findDefaultPillar(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('isDefault', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return new Pillar({ id: doc.id, ...doc.data() });
  }

  static async createDefaultPillar(userId) {
    const existingDefault = await this.findDefaultPillar(userId);
    if (existingDefault) {
      return existingDefault;
    }
    
    return this.create({
      userId,
      name: 'Personal',
      description: 'Your personal pillar',
      color: '#6366f1',
      isDefault: true
    });
  }

  async updateStats() {
    const conversations = await firestore.collection('conversations')
      .where('pillarIds', 'array-contains', this.id)
      .get();
    
    const messages = await firestore.collection('messages')
      .where('pillarIds', 'array-contains', this.id)
      .get();
    
    const tasks = await firestore.collection('tasks')
      .where('pillarIds', 'array-contains', this.id)
      .get();

    const principles = await firestore.collection('principles')
      .where('pillarId', '==', this.id)
      .get();

    const wisdoms = await firestore.collection('wisdoms')
      .where('pillarId', '==', this.id)
      .get();

    const resources = await firestore.collection('resources')
      .where('pillarId', '==', this.id)
      .get();
    
    this.stats = {
      conversationCount: conversations.size,
      messageCount: messages.size,
      taskCount: tasks.size,
      principleCount: principles.size,
      wisdomCount: wisdoms.size,
      resourceCount: resources.size
    };
    
    await this.save();
    return this.stats;
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await Pillar.collection().doc(this.id).update({
        name: this.name,
        description: this.description,
        color: this.color,
        icon: this.icon,
        isDefault: this.isDefault,
        isArchived: this.isArchived,
        settings: this.settings,
        stats: this.stats,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Pillar.create(this);
      this.id = created.id;
    }
    return this;
  }

  async archive() {
    this.isArchived = true;
    return this.save();
  }

  async unarchive() {
    this.isArchived = false;
    return this.save();
  }

  async delete() {
    if (this.id) {
      const hasContent = Object.values(this.stats).some(count => count > 0);
      if (hasContent) {
        throw new Error('Cannot delete pillar with existing content. Archive it instead.');
      }
      
      await Pillar.collection().doc(this.id).delete();
    }
  }
}

module.exports = Pillar;

