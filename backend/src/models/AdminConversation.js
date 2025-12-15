/**
 * AdminConversation - Represents a conversation in the admin chat interface
 * 
 * Stores metadata about the conversation. Messages are stored separately
 * in the adminMessages collection.
 */

const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class AdminConversation {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || 'New Conversation';
    this.messageCount = data.messageCount || 0;
    this.lastMessageAt = data.lastMessageAt || null;
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
  }

  static collection() {
    return firestore.collection('adminConversations');
  }

  /**
   * Find all conversations, ordered by most recent
   */
  static async findAll(limit = 50) {
    const snapshot = await this.collection()
      .orderBy('lastMessageAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => new AdminConversation({ id: doc.id, ...doc.data() }));
  }

  /**
   * Find a conversation by ID
   */
  static async findById(id) {
    if (!id) return null;
    
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) return null;
    
    return new AdminConversation({ id: doc.id, ...doc.data() });
  }

  /**
   * Create a new conversation
   */
  static async create(data = {}) {
    const docRef = this.collection().doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const conversation = new AdminConversation({
      ...data,
      id: docRef.id,
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now
    });
    
    await docRef.set({
      title: conversation.title,
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now
    });
    
    return conversation;
  }

  /**
   * Update the conversation
   */
  async update(updates) {
    if (!this.id) throw new Error('Cannot update conversation without ID');
    
    const updateData = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await AdminConversation.collection().doc(this.id).update(updateData);
    Object.assign(this, updates);
    return this;
  }

  /**
   * Increment message count and update lastMessageAt
   */
  async incrementMessageCount() {
    if (!this.id) throw new Error('Cannot update conversation without ID');
    
    await AdminConversation.collection().doc(this.id).update({
      messageCount: admin.firestore.FieldValue.increment(1),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    this.messageCount++;
    return this;
  }

  /**
   * Delete the conversation and all its messages
   */
  async delete() {
    if (!this.id) throw new Error('Cannot delete conversation without ID');
    
    // Delete all messages in this conversation
    const messagesSnapshot = await firestore.collection('adminMessages')
      .where('conversationId', '==', this.id)
      .get();
    
    const batch = firestore.batch();
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(AdminConversation.collection().doc(this.id));
    
    await batch.commit();
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = AdminConversation;



