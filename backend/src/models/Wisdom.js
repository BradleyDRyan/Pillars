const { firestore } = require('../config/firebase');

/**
 * Wisdom — User-captured experiences, lessons, reflections, quotes
 * 
 * Types:
 * - lesson: Something learned from experience
 * - reflection: Personal insight or realization
 * - quote: A meaningful quote (from self or others)
 * - experience: A specific experience that shaped understanding
 * - insight: A sudden understanding or realization
 */
class Wisdom {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    /** @type {string|null} Optional - wisdom can exist without a pillar */
    this.pillarId = data.pillarId || null;
    this.title = data.title || '';
    this.content = data.content || '';
    /** @type {'lesson'|'reflection'|'quote'|'experience'|'insight'} */
    this.type = data.type || 'insight';
    /** @type {string|null} Source of the wisdom (person, book, situation) */
    this.source = data.source || null;
    /** @type {string|null} Date when this wisdom was gained (if different from createdAt) */
    this.wisdomDate = data.wisdomDate || null;
    /** @type {boolean} Whether this wisdom has been internalized/applied */
    this.isInternalized = data.isInternalized || false;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('wisdoms');
  }

  static async create(data) {
    const wisdom = new Wisdom(data);
    const docRef = await this.collection().add({
      userId: wisdom.userId,
      pillarId: wisdom.pillarId,
      title: wisdom.title,
      content: wisdom.content,
      type: wisdom.type,
      source: wisdom.source,
      wisdomDate: wisdom.wisdomDate,
      isInternalized: wisdom.isInternalized,
      tags: wisdom.tags,
      createdAt: wisdom.createdAt,
      updatedAt: wisdom.updatedAt,
      metadata: wisdom.metadata
    });
    wisdom.id = docRef.id;
    return wisdom;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Wisdom({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, filters = {}) {
    let query = this.collection().where('userId', '==', userId);
    
    if (filters.pillarId) {
      query = query.where('pillarId', '==', filters.pillarId);
    }
    
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    
    if (filters.isInternalized !== undefined) {
      query = query.where('isInternalized', '==', filters.isInternalized);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => new Wisdom({ id: doc.id, ...doc.data() }));
  }

  static async findByPillarId(pillarId) {
    const snapshot = await this.collection()
      .where('pillarId', '==', pillarId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Wisdom({ id: doc.id, ...doc.data() }));
  }

  static async findUnassigned(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('pillarId', '==', null)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Wisdom({ id: doc.id, ...doc.data() }));
  }

  static async findByType(userId, type) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('type', '==', type)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Wisdom({ id: doc.id, ...doc.data() }));
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await Wisdom.collection().doc(this.id).update({
        pillarId: this.pillarId,
        title: this.title,
        content: this.content,
        type: this.type,
        source: this.source,
        wisdomDate: this.wisdomDate,
        isInternalized: this.isInternalized,
        tags: this.tags,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Wisdom.create(this);
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

  async markAsInternalized() {
    this.isInternalized = true;
    return this.save();
  }

  async delete() {
    if (this.id) {
      await Wisdom.collection().doc(this.id).delete();
    }
  }
}

module.exports = Wisdom;

