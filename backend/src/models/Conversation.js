const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

/**
 * Conversation — An ongoing dialogue between the user and the system
 * 
 * Used to ask for advice, reflect, and interact with Pillars.
 * There is at least one "primary" Conversation (the Home View chat),
 * but the data model supports multiple conversations.
 */
class Conversation {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.agentId = data.agentId || null;
    // Support both pillarIds (new) and projectIds (legacy)
    this.pillarIds = data.pillarIds || data.projectIds || [];
    this.title = data.title || 'New Conversation';
    this.titleGenerated = data.titleGenerated || false;
    /** @type {boolean} Primary conversation appears on Home View */
    this.isPrimary = data.isPrimary || false;
    /** @type {'active'|'archived'} */
    this.status = data.status || 'active';
    this.lastMessage = data.lastMessage || null;
    // Use Firebase Timestamps consistently
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('conversations');
  }

  static async create(data) {
    const conversation = new Conversation(data);
    const docRef = await this.collection().add({
      userId: conversation.userId,
      agentId: conversation.agentId || null,
      pillarIds: conversation.pillarIds,
      title: conversation.title,
      titleGenerated: false,
      isPrimary: conversation.isPrimary,
      status: conversation.status,
      lastMessage: conversation.lastMessage,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      metadata: conversation.metadata
    });
    conversation.id = docRef.id;
    return conversation;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Conversation({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, pillarId = null, includeArchived = false) {
    let query = this.collection().where('userId', '==', userId);
    
    if (pillarId) {
      query = query.where('pillarIds', 'array-contains', pillarId);
    }
    
    if (!includeArchived) {
      query = query.where('status', '==', 'active');
    }
    
    const snapshot = await query.orderBy('updatedAt', 'desc').get();
    return snapshot.docs.map(doc => new Conversation({ id: doc.id, ...doc.data() }));
  }

  static async findPrimary(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('isPrimary', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return new Conversation({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  }

  static async findOrCreatePrimary(userId) {
    let primary = await this.findPrimary(userId);
    
    if (!primary) {
      primary = await this.create({
        userId,
        title: 'Home',
        isPrimary: true,
        metadata: { type: 'primary' }
      });
    }
    
    return primary;
  }

  static async findByAgentId(agentId) {
    if (!agentId) {
      return null;
    }
    const snapshot = await this.collection()
      .where('agentId', '==', agentId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return new Conversation({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  }

  async save() {
    this.updatedAt = admin.firestore.Timestamp.now();
    if (this.id) {
      await Conversation.collection().doc(this.id).update({
        title: this.title,
        agentId: this.agentId || null,
        pillarIds: this.pillarIds,
        isPrimary: this.isPrimary,
        status: this.status,
        lastMessage: this.lastMessage,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Conversation.create(this);
      this.id = created.id;
    }
    return this;
  }

  async archive() {
    this.status = 'archived';
    return this.save();
  }

  async unarchive() {
    this.status = 'active';
    return this.save();
  }

  async delete() {
    if (this.id) {
      await Conversation.collection().doc(this.id).delete();
    }
  }

  // Convert Firestore Timestamps to ISO8601 strings for JSON serialization
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      agentId: this.agentId || null,
      pillarIds: this.pillarIds,
      title: this.title,
      isPrimary: this.isPrimary,
      status: this.status,
      lastMessage: this.lastMessage,
      // Convert Firestore Timestamps to ISO8601 strings
      createdAt: this.createdAt?.toDate ? this.createdAt.toDate().toISOString() : 
                 this.createdAt?.toISOString ? this.createdAt.toISOString() : 
                 this.createdAt,
      updatedAt: this.updatedAt?.toDate ? this.updatedAt.toDate().toISOString() : 
                 this.updatedAt?.toISOString ? this.updatedAt.toISOString() : 
                 this.updatedAt,
      metadata: this.metadata
    };
  }
}

module.exports = Conversation;