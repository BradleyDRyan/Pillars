const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class Conversation {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.agentId = data.agentId || null;
    this.projectIds = data.projectIds || [];
    this.title = data.title || 'New Conversation';
    this.titleGenerated = data.titleGenerated || false;
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
      projectIds: conversation.projectIds,
      title: conversation.title,
      titleGenerated: false,
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

  static async findByUserId(userId, projectId = null) {
    let query = this.collection().where('userId', '==', userId);
    
    if (projectId) {
      query = query.where('projectIds', 'array-contains', projectId);
    }
    
    const snapshot = await query.orderBy('updatedAt', 'desc').get();
    return snapshot.docs.map(doc => new Conversation({ id: doc.id, ...doc.data() }));
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
        projectIds: this.projectIds,
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
      projectIds: this.projectIds,
      title: this.title,
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