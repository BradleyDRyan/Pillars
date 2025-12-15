/**
 * AdminMessage - Represents a message in an admin conversation
 * 
 * Messages use a `contents` array for rich content blocks with sequencing.
 * This enables inline rendering of tool calls in the correct order.
 */

const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class AdminMessage {
  constructor(data = {}) {
    this.id = data.id || null;
    this.conversationId = data.conversationId || null;
    this.role = data.role || 'user'; // 'user' | 'assistant'
    this.agentId = data.agentId || null; // Which agent responded (null for user)
    this.agentHandle = data.agentHandle || null;
    this.agentName = data.agentName || null;
    
    // Rich content blocks with sequence numbers
    // Each block: { type, data, metadata: { sequence, status, groupId, timestamp } }
    this.contents = data.contents || [];
    
    // Agent handles mentioned in this message
    this.mentions = data.mentions || [];
    
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
  }

  static collection() {
    return firestore.collection('adminMessages');
  }

  /**
   * Find messages for a conversation
   */
  static async findByConversationId(conversationId, limit = 100) {
    if (!conversationId) return [];
    
    // Use the composite index for efficient querying
    const snapshot = await this.collection()
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();
    
    const messages = snapshot.docs.map(doc => new AdminMessage({ id: doc.id, ...doc.data() }));
    
    // Messages are already sorted by Firestore, but ensure proper ordering
    // Convert Firestore timestamps to comparable values
    messages.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 
                   a.createdAt?._seconds * 1000 || 
                   (a.createdAt?.seconds || 0) * 1000 ||
                   (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0) ||
                   0;
      const bTime = b.createdAt?.toMillis?.() || 
                   b.createdAt?._seconds * 1000 || 
                   (b.createdAt?.seconds || 0) * 1000 ||
                   (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0) ||
                   0;
      return aTime - bTime;
    });
    
    return messages;
  }

  /**
   * Find a message by ID
   */
  static async findById(id) {
    if (!id) return null;
    
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) return null;
    
    return new AdminMessage({ id: doc.id, ...doc.data() });
  }

  /**
   * Create a new message
   */
  static async create(data) {
    if (!data.conversationId) {
      throw new Error('conversationId is required');
    }
    
    const docRef = this.collection().doc();
    const message = new AdminMessage({
      ...data,
      id: docRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await docRef.set({
      conversationId: message.conversationId,
      role: message.role,
      agentId: message.agentId,
      agentHandle: message.agentHandle,
      agentName: message.agentName,
      contents: message.contents,
      mentions: message.mentions,
      createdAt: message.createdAt
    });
    
    return message;
  }

  /**
   * Create a user message with simple text content
   */
  static async createUserMessage(conversationId, text, mentions = []) {
    return this.create({
      conversationId,
      role: 'user',
      contents: [{
        type: 'text',
        data: { text },
        metadata: {
          sequence: 0,
          status: 'complete',
          timestamp: new Date().toISOString()
        }
      }],
      mentions
    });
  }

  /**
   * Create an assistant message with content blocks
   */
  static async createAssistantMessage(conversationId, contents, agentData = {}) {
    return this.create({
      conversationId,
      role: 'assistant',
      agentId: agentData.id || null,
      agentHandle: agentData.handle || null,
      agentName: agentData.name || null,
      contents
    });
  }

  /**
   * Update the message
   */
  async update(updates) {
    if (!this.id) throw new Error('Cannot update message without ID');
    
    await AdminMessage.collection().doc(this.id).update(updates);
    Object.assign(this, updates);
    return this;
  }

  /**
   * Delete the message
   */
  async delete() {
    if (!this.id) throw new Error('Cannot delete message without ID');
    await AdminMessage.collection().doc(this.id).delete();
  }

  /**
   * Get plain text content from message (for display/search)
   */
  getTextContent() {
    return this.contents
      .filter(block => block.type === 'text')
      .map(block => block.data?.text || '')
      .join('');
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    // Convert Firestore timestamp to ISO string for JSON serialization
    let createdAtValue = this.createdAt;
    if (this.createdAt && typeof this.createdAt.toDate === 'function') {
      // Firestore Timestamp
      createdAtValue = this.createdAt.toDate().toISOString();
    } else if (this.createdAt && typeof this.createdAt === 'object' && 'seconds' in this.createdAt) {
      // Already serialized timestamp object
      createdAtValue = new Date(this.createdAt.seconds * 1000).toISOString();
    }
    
    return {
      id: this.id,
      conversationId: this.conversationId,
      role: this.role,
      agentId: this.agentId,
      agentHandle: this.agentHandle,
      agentName: this.agentName,
      contents: this.contents,
      mentions: this.mentions,
      createdAt: createdAtValue
    };
  }

  /**
   * Convert to format suitable for Anthropic API messages
   */
  toAnthropicFormat() {
    if (this.role === 'user') {
      // User messages: extract text content
      const textContent = this.getTextContent();
      return {
        role: 'user',
        content: textContent
      };
    } else {
      // Assistant messages: need to reconstruct content array
      const content = [];
      
      for (const block of this.contents) {
        if (block.type === 'text' && block.data?.text) {
          content.push({
            type: 'text',
            text: block.data.text
          });
        } else if (block.type === 'tool_use') {
          content.push({
            type: 'tool_use',
            id: block.data?.id,
            name: block.data?.name,
            input: block.data?.input || {}
          });
        }
      }
      
      return {
        role: 'assistant',
        content: content.length > 0 ? content : [{ type: 'text', text: '' }]
      };
    }
  }
}

module.exports = AdminMessage;



