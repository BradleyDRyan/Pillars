const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class Message {
  constructor(data = {}) {
    this.id = data.id || null;
    this.conversationId = data.conversationId || null;
    this.userId = data.userId || null;
    this.sender = data.sender || null; // agentId or userId - identifies who sent the message
    this.content = data.content || '';
    this.type = data.type || 'text';
    this.role = data.role || 'user'; // 'user', 'assistant', 'system', etc.
    this.photoId = data.photoId || null; // Reference to Photo object
    this.attachments = data.attachments || []; // Array of attachment URLs
    // Block-based content (new)
    this.blocks = data.blocks || null; // Array of blocks for structured content
    this.toolCalls = data.toolCalls || null; // Array of tool calls used in this message
    // Use Firebase Timestamps consistently
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.editedAt = data.editedAt || null;
    this.metadata = data.metadata || {};
  }

  static collection(conversationId) {
    // Messages are now a subcollection of conversations
    if (!conversationId) {
      throw new Error('conversationId is required to access messages collection');
    }
    return firestore.collection('conversations').doc(conversationId).collection('messages');
  }

  static async create(data) {
    if (!data.conversationId) {
      throw new Error('conversationId is required to create a message');
    }
    
    // Require either sender or userId (for backward compatibility)
    if (!data.sender && !data.userId) {
      throw new Error('Either sender or userId is required to create a message');
    }
    
    const message = new Message(data);
    const docRef = await this.collection(message.conversationId).add({
      conversationId: message.conversationId,  // Add this field!
      userId: message.userId || null,
      sender: message.sender || message.userId || null, // Use sender if provided, fallback to userId
      content: message.content,
      type: message.type,
      role: message.role,
      photoId: message.photoId,
      attachments: message.attachments,
      blocks: message.blocks || null, // Store blocks array
      toolCalls: message.toolCalls || null, // Store tool calls array
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      metadata: message.metadata
    });
    message.id = docRef.id;
    
    // Update the document with its ID
    await docRef.update({ id: docRef.id });
    
    return message;
  }

  static async findById(conversationId, messageId) {
    if (!conversationId || !messageId) {
      throw new Error('Both conversationId and messageId are required');
    }
    
    const doc = await this.collection(conversationId).doc(messageId).get();
    if (!doc.exists) {
      return null;
    }
    return new Message({ id: doc.id, conversationId, ...doc.data() });
  }

  static async findByConversationId(conversationId, limit = 50) {
    if (!conversationId) {
      throw new Error('conversationId is required');
    }
    
    try {
      const snapshot = await this.collection(conversationId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => new Message({ 
        id: doc.id, 
        conversationId,
        ...doc.data() 
      })).reverse();
    } catch (error) {
      // If orderBy fails (e.g., missing index), try without orderBy
      if (error.code === 9 || error.message?.includes('index')) {
        const snapshot = await this.collection(conversationId)
          .limit(limit)
          .get();
        
        const messages = snapshot.docs.map(doc => new Message({ 
          id: doc.id, 
          conversationId,
          ...doc.data() 
        }));
        
        // Sort in memory
        return messages.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                       a.createdAt?.getTime ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                       b.createdAt?.getTime ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });
      }
      throw error;
    }
  }

  async save() {
    if (!this.conversationId) {
      throw new Error('conversationId is required to save a message');
    }
    
    if (this.id) {
      this.editedAt = admin.firestore.Timestamp.now();
      await Message.collection(this.conversationId).doc(this.id).update({
        content: this.content,
        role: this.role,
        sender: this.sender || this.userId || null,
        photoId: this.photoId,
        attachments: this.attachments,
        blocks: this.blocks || null,
        toolCalls: this.toolCalls || null,
        editedAt: this.editedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Message.create(this);
      this.id = created.id;
    }
    return this;
  }

  async delete() {
    if (!this.conversationId || !this.id) {
      throw new Error('Both conversationId and id are required to delete a message');
    }
    await Message.collection(this.conversationId).doc(this.id).delete();
  }

  // Convert Firestore Timestamps to ISO8601 strings for JSON serialization
  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      userId: this.userId,
      sender: this.sender || this.userId || null,
      content: this.content,
      type: this.type,
      role: this.role,
      photoId: this.photoId,
      attachments: this.attachments,
      blocks: this.blocks || null,
      toolCalls: this.toolCalls || null,
      // Convert Firestore Timestamps to ISO8601 strings
      createdAt: this.createdAt?.toDate ? this.createdAt.toDate().toISOString() : 
                 this.createdAt?.toISOString ? this.createdAt.toISOString() : 
                 this.createdAt,
      editedAt: this.editedAt?.toDate ? this.editedAt.toDate().toISOString() : 
                this.editedAt?.toISOString ? this.editedAt.toISOString() : 
                this.editedAt,
      metadata: this.metadata
    };
  }
}

module.exports = Message;