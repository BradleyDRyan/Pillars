/**
 * RoomMessage - A message in a Room (group chat)
 * 
 * Messages are posted by you (the owner) or by agents.
 * Agent messages can reference drafts in their workspace.
 * 
 * Stored as: rooms/{roomId}/messages/{messageId}
 */

const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class RoomMessage {
  constructor(data = {}) {
    this.id = data.id || null;
    this.roomId = data.roomId || null;
    
    // Who sent this message?
    // 'user' = the human owner, 'agent' = an AI agent
    this.senderType = data.senderType || 'user';
    
    // If senderType is 'user', this is the userId
    // If senderType is 'agent', this is the agentId
    this.senderId = data.senderId || null;
    
    // For agent messages, store handle for easy display
    this.senderHandle = data.senderHandle || null;
    this.senderName = data.senderName || null;
    
    // The message content
    this.content = data.content || '';
    
    // Which agents were mentioned in this message (for triggering responses)
    this.mentions = data.mentions || [];
    
    // References to agent drafts (if this message discusses work products)
    // Array of { agentId, draftId }
    this.draftRefs = data.draftRefs || [];
    
    // For tracking agent runs that produced this message
    this.runId = data.runId || null;
    this.triggerMessageId = data.triggerMessageId || null;
    
    // Block-based content for tool results, structured data, etc.
    this.blocks = data.blocks || null;
    
    // Timestamps
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.editedAt = data.editedAt || null;
    
    this.metadata = data.metadata || {};
  }

  /**
   * Get the messages subcollection for a room
   */
  static collection(roomId) {
    if (!roomId) {
      throw new Error('roomId is required to access messages collection');
    }
    return firestore.collection('rooms').doc(roomId).collection('messages');
  }

  /**
   * Create a new message
   */
  static async create(data) {
    if (!data.roomId) {
      throw new Error('roomId is required to create a message');
    }
    if (!data.senderId) {
      throw new Error('senderId is required to create a message');
    }

    const message = new RoomMessage(data);
    const docRef = await this.collection(data.roomId).add({
      roomId: message.roomId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderHandle: message.senderHandle,
      senderName: message.senderName,
      content: message.content,
      mentions: message.mentions,
      draftRefs: message.draftRefs,
      runId: message.runId,
      triggerMessageId: message.triggerMessageId,
      blocks: message.blocks,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      metadata: message.metadata
    });

    message.id = docRef.id;
    return message;
  }

  /**
   * Create a user message (convenience method)
   */
  static async createUserMessage(roomId, userId, content, mentions = []) {
    return this.create({
      roomId,
      senderType: 'user',
      senderId: userId,
      content,
      mentions
    });
  }

  /**
   * Create an agent message (convenience method)
   */
  static async createAgentMessage(roomId, agent, content, options = {}) {
    return this.create({
      roomId,
      senderType: 'agent',
      senderId: agent.id,
      senderHandle: agent.handle,
      senderName: agent.name,
      content,
      draftRefs: options.draftRefs || [],
      runId: options.runId || null,
      triggerMessageId: options.triggerMessageId || null,
      blocks: options.blocks || null,
      metadata: options.metadata || {}
    });
  }

  /**
   * Find a message by ID
   */
  static async findById(roomId, messageId) {
    if (!roomId || !messageId) {
      throw new Error('Both roomId and messageId are required');
    }

    const doc = await this.collection(roomId).doc(messageId).get();
    if (!doc.exists) return null;

    return new RoomMessage({ id: doc.id, roomId, ...doc.data() });
  }

  /**
   * Find messages in a room
   */
  static async findByRoomId(roomId, options = {}) {
    if (!roomId) {
      throw new Error('roomId is required');
    }

    let query = this.collection(roomId);

    // Order by creation time
    const order = options.order || 'asc'; // Default: oldest first
    query = query.orderBy('createdAt', order);

    // Limit
    const limit = options.limit || 100;
    query = query.limit(limit);

    const snapshot = await query.get();
    const messages = snapshot.docs.map(doc => new RoomMessage({
      id: doc.id,
      roomId,
      ...doc.data()
    }));

    // If we asked for newest first (desc), reverse to get chronological
    if (order === 'desc') {
      messages.reverse();
    }

    return messages;
  }

  /**
   * Find recent messages (for context)
   */
  static async findRecent(roomId, limit = 20) {
    return this.findByRoomId(roomId, { limit, order: 'desc' });
  }

  /**
   * Save updates
   */
  async save() {
    if (!this.roomId) {
      throw new Error('roomId is required to save a message');
    }

    if (this.id) {
      this.editedAt = admin.firestore.Timestamp.now();
      await RoomMessage.collection(this.roomId).doc(this.id).update({
        content: this.content,
        mentions: this.mentions,
        draftRefs: this.draftRefs,
        blocks: this.blocks,
        editedAt: this.editedAt,
        metadata: this.metadata
      });
    } else {
      const created = await RoomMessage.create(this);
      this.id = created.id;
    }

    return this;
  }

  /**
   * Delete the message
   */
  async delete() {
    if (!this.roomId || !this.id) {
      throw new Error('Both roomId and id are required to delete a message');
    }
    await RoomMessage.collection(this.roomId).doc(this.id).delete();
  }

  /**
   * Get plain text content (for context building)
   */
  getTextContent() {
    if (this.content) return this.content;
    
    // Extract text from blocks if no content
    if (this.blocks) {
      return this.blocks
        .filter(b => b.type === 'text')
        .map(b => b.data?.text || '')
        .join('\n');
    }

    return '';
  }

  /**
   * Convert to Anthropic message format
   */
  toAnthropicFormat() {
    const role = this.senderType === 'user' ? 'user' : 'assistant';
    return {
      role,
      content: this.getTextContent()
    };
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      roomId: this.roomId,
      senderType: this.senderType,
      senderId: this.senderId,
      senderHandle: this.senderHandle,
      senderName: this.senderName,
      content: this.content,
      mentions: this.mentions,
      draftRefs: this.draftRefs,
      runId: this.runId,
      triggerMessageId: this.triggerMessageId,
      blocks: this.blocks,
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

module.exports = RoomMessage;

