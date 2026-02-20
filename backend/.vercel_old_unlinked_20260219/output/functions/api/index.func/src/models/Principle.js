const { firestore } = require('../config/firebase');

/**
 * Principle — Guiding beliefs that define how the user wants to operate within a Pillar
 * 
 * Examples:
 * - "I prioritize deep work over shallow tasks"
 * - "I don't check email before 10am"
 * - "I invest in relationships that energize me"
 */
class Principle {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    /** @type {string|null} Optional - principle can exist without a pillar */
    this.pillarId = data.pillarId || null;
    this.title = data.title || '';
    this.description = data.description || '';
    /** @type {boolean} Whether this principle is actively being followed */
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    /** @type {number} Priority/importance (1-5, higher = more important) */
    this.priority = data.priority || 3;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('principles');
  }

  static async create(data) {
    const principle = new Principle(data);
    const docRef = await this.collection().add({
      userId: principle.userId,
      pillarId: principle.pillarId,
      title: principle.title,
      description: principle.description,
      isActive: principle.isActive,
      priority: principle.priority,
      tags: principle.tags,
      createdAt: principle.createdAt,
      updatedAt: principle.updatedAt,
      metadata: principle.metadata
    });
    principle.id = docRef.id;
    return principle;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Principle({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, filters = {}) {
    let query = this.collection().where('userId', '==', userId);
    
    if (filters.pillarId) {
      query = query.where('pillarId', '==', filters.pillarId);
    }
    
    if (filters.isActive !== undefined) {
      query = query.where('isActive', '==', filters.isActive);
    }
    
    const snapshot = await query.orderBy('priority', 'desc').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => new Principle({ id: doc.id, ...doc.data() }));
  }

  static async findByPillarId(pillarId) {
    const snapshot = await this.collection()
      .where('pillarId', '==', pillarId)
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Principle({ id: doc.id, ...doc.data() }));
  }

  static async findUnassigned(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('pillarId', '==', null)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Principle({ id: doc.id, ...doc.data() }));
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await Principle.collection().doc(this.id).update({
        pillarId: this.pillarId,
        title: this.title,
        description: this.description,
        isActive: this.isActive,
        priority: this.priority,
        tags: this.tags,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Principle.create(this);
      this.id = created.id;
    }
    return this;
  }

  async assignToPillar(pillarId) {
    this.pillarId = pillarId;
    return this.save();
  }

  async unassignFromPillar() {
    this.pillarId = null;
    return this.save();
  }

  async delete() {
    if (this.id) {
      await Principle.collection().doc(this.id).delete();
    }
  }
}

module.exports = Principle;


