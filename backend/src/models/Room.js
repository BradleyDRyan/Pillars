/**
 * Room - A coordination space where you and agents collaborate
 * 
 * Rooms are like Slack channels - agents can be members of multiple rooms,
 * and they autonomously decide whether to respond based on mentions and
 * their own speakMode settings.
 * 
 * Stored as: rooms/{roomId}
 * Messages stored as: rooms/{roomId}/messages/{messageId}
 */

const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class Room {
  constructor(data = {}) {
    this.id = data.id || null;
    
    // Room owner (the human editor-in-chief)
    this.ownerId = data.ownerId || null;
    
    // Room metadata
    this.name = data.name || 'New Room';
    this.description = data.description || '';
    
    // Agent membership (array of agentIds)
    // These agents can see and respond to messages in this room
    this.memberAgentIds = data.memberAgentIds || [];
    
    // Room status: 'active', 'archived'
    this.status = data.status || 'active';
    
    // Last activity for sorting
    this.lastMessageAt = data.lastMessageAt || null;
    this.lastMessagePreview = data.lastMessagePreview || null;
    
    // Stats
    this.messageCount = data.messageCount || 0;
    
    // Timestamps
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
    
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('rooms');
  }

  /**
   * Create a new room
   */
  static async create(data) {
    if (!data.ownerId) {
      throw new Error('ownerId is required to create a room');
    }

    const room = new Room(data);
    const docRef = await this.collection().add({
      ownerId: room.ownerId,
      name: room.name,
      description: room.description,
      memberAgentIds: room.memberAgentIds,
      status: room.status,
      lastMessageAt: room.lastMessageAt,
      lastMessagePreview: room.lastMessagePreview,
      messageCount: room.messageCount,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      metadata: room.metadata
    });

    room.id = docRef.id;
    return room;
  }

  /**
   * Find a room by ID
   */
  static async findById(roomId) {
    if (!roomId) return null;

    const doc = await this.collection().doc(roomId).get();
    if (!doc.exists) return null;

    return new Room({ id: doc.id, ...doc.data() });
  }

  /**
   * Find all rooms for an owner
   */
  static async findByOwnerId(ownerId, includeArchived = false) {
    // Simple query without composite index requirement
    const snapshot = await this.collection()
      .where('ownerId', '==', ownerId)
      .get();

    let rooms = snapshot.docs.map(doc => new Room({ id: doc.id, ...doc.data() }));

    // Filter by status in memory
    if (!includeArchived) {
      rooms = rooms.filter(r => r.status === 'active');
    }

    // Sort by updatedAt in memory
    rooms.sort((a, b) => {
      const aTime = a.updatedAt?.toDate?.() || new Date(a.updatedAt || 0);
      const bTime = b.updatedAt?.toDate?.() || new Date(b.updatedAt || 0);
      return bTime - aTime;
    });

    return rooms;
  }

  /**
   * Find all rooms an agent is a member of
   */
  static async findByAgentMembership(agentId) {
    const snapshot = await this.collection()
      .where('memberAgentIds', 'array-contains', agentId)
      .where('status', '==', 'active')
      .orderBy('updatedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => new Room({ id: doc.id, ...doc.data() }));
  }

  /**
   * Add an agent to this room
   */
  async addAgent(agentId) {
    if (!this.memberAgentIds.includes(agentId)) {
      this.memberAgentIds.push(agentId);
      await this.save();
    }
    return this;
  }

  /**
   * Remove an agent from this room
   */
  async removeAgent(agentId) {
    this.memberAgentIds = this.memberAgentIds.filter(id => id !== agentId);
    await this.save();
    return this;
  }

  /**
   * Check if an agent is a member
   */
  hasAgent(agentId) {
    return this.memberAgentIds.includes(agentId);
  }

  /**
   * Update last message info
   */
  async updateLastMessage(content, timestamp = null) {
    this.lastMessageAt = timestamp || admin.firestore.Timestamp.now();
    this.lastMessagePreview = content.substring(0, 100);
    this.messageCount += 1;
    await this.save();
    return this;
  }

  /**
   * Save updates
   */
  async save() {
    this.updatedAt = admin.firestore.Timestamp.now();

    if (this.id) {
      await Room.collection().doc(this.id).update({
        name: this.name,
        description: this.description,
        memberAgentIds: this.memberAgentIds,
        status: this.status,
        lastMessageAt: this.lastMessageAt,
        lastMessagePreview: this.lastMessagePreview,
        messageCount: this.messageCount,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Room.create(this);
      this.id = created.id;
    }

    return this;
  }

  /**
   * Archive the room
   */
  async archive() {
    this.status = 'archived';
    return this.save();
  }

  /**
   * Unarchive the room
   */
  async unarchive() {
    this.status = 'active';
    return this.save();
  }

  /**
   * Delete the room
   */
  async delete() {
    if (this.id) {
      // Note: In production, you'd also want to delete all messages
      // or use a Cloud Function to cascade delete
      await Room.collection().doc(this.id).delete();
    }
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      description: this.description,
      memberAgentIds: this.memberAgentIds,
      status: this.status,
      lastMessageAt: this.lastMessageAt?.toDate ? this.lastMessageAt.toDate().toISOString() :
                     this.lastMessageAt?.toISOString ? this.lastMessageAt.toISOString() :
                     this.lastMessageAt,
      lastMessagePreview: this.lastMessagePreview,
      messageCount: this.messageCount,
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

module.exports = Room;

