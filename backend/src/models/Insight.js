const { firestore } = require('../config/firebase');

/**
 * Insight — User-captured experiences, lessons, and reflections within a Pillar
 * 
 * Examples:
 * - "I realized I work best in 90-minute blocks"
 * - "Taking walks helps me think through problems"
 * - "Emme feels most loved when I'm fully present"
 */
class Insight {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.pillarId = data.pillarId || null;
    this.content = data.content || '';
    this.source = data.source || null; // 'conversation', 'manual', 'reflection'
    this.conversationId = data.conversationId || null;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('insights');
  }

  static async create(data) {
    const insight = new Insight(data);
    const docRef = await this.collection().add({
      userId: insight.userId,
      pillarId: insight.pillarId,
      content: insight.content,
      source: insight.source,
      conversationId: insight.conversationId,
      tags: insight.tags,
      createdAt: insight.createdAt,
      updatedAt: insight.updatedAt,
      metadata: insight.metadata
    });
    insight.id = docRef.id;
    return insight;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Insight({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, filters = {}) {
    let query = this.collection().where('userId', '==', userId);
    
    if (filters.pillarId) {
      query = query.where('pillarId', '==', filters.pillarId);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => new Insight({ id: doc.id, ...doc.data() }));
  }

  static async findByPillarId(pillarId) {
    const snapshot = await this.collection()
      .where('pillarId', '==', pillarId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Insight({ id: doc.id, ...doc.data() }));
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await Insight.collection().doc(this.id).update({
        pillarId: this.pillarId,
        content: this.content,
        source: this.source,
        conversationId: this.conversationId,
        tags: this.tags,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Insight.create(this);
      this.id = created.id;
    }
    return this;
  }

  async delete() {
    if (this.id) {
      await Insight.collection().doc(this.id).delete();
    }
  }
}

module.exports = Insight;
