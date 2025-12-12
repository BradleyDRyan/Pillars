/**
 * Agent - Represents an AI agent that can be invoked via @ mentions
 * 
 * Agents have:
 * - A unique handle for @ mentions (e.g., @content)
 * - Assigned tools from the tool registry
 * - A custom system prompt defining personality
 */

const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class Agent {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.handle = data.handle || ''; // Used as @handle
    this.description = data.description || '';
    this.systemPrompt = data.systemPrompt || '';
    this.tools = data.tools || []; // Array of tool names from registry
    this.model = data.model || 'claude-sonnet-4-20250514';
    // 'when_mentioned' = only speaks when @mentioned
    // 'proactive' = can speak whenever appropriate
    this.speakMode = data.speakMode || 'when_mentioned';
    this.isActive = data.isActive !== false;
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
  }

  static collection() {
    return firestore.collection('agents');
  }

  /**
   * Find all agents
   */
  static async findAll(includeInactive = false) {
    let query = this.collection();
    
    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }
    
    const snapshot = await query.orderBy('name').get();
    return snapshot.docs.map(doc => new Agent({ id: doc.id, ...doc.data() }));
  }

  /**
   * Find an agent by ID
   */
  static async findById(id) {
    if (!id) return null;
    
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) return null;
    
    return new Agent({ id: doc.id, ...doc.data() });
  }

  /**
   * Find an agent by handle (case-insensitive)
   */
  static async findByHandle(handle) {
    if (!handle) return null;
    
    const normalizedHandle = handle.toLowerCase().replace(/^@/, '');
    
    const snapshot = await this.collection()
      .where('handle', '==', normalizedHandle)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return new Agent({ id: doc.id, ...doc.data() });
  }

  /**
   * Create a new agent
   */
  static async create(data) {
    // Normalize handle
    const normalizedHandle = (data.handle || '').toLowerCase().replace(/^@/, '');
    
    // Check if handle already exists
    const existing = await this.findByHandle(normalizedHandle);
    if (existing) {
      throw new Error(`Agent with handle @${normalizedHandle} already exists`);
    }
    
    const docRef = this.collection().doc();
    const agent = new Agent({
      ...data,
      id: docRef.id,
      handle: normalizedHandle,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await docRef.set({
      name: agent.name,
      handle: agent.handle,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      model: agent.model,
      speakMode: agent.speakMode,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    });
    
    return agent;
  }

  /**
   * Update the agent
   */
  async update(updates) {
    if (!this.id) throw new Error('Cannot update agent without ID');
    
    // Normalize handle if being updated
    if (updates.handle) {
      updates.handle = updates.handle.toLowerCase().replace(/^@/, '');
      
      // Check if new handle conflicts
      const existing = await Agent.findByHandle(updates.handle);
      if (existing && existing.id !== this.id) {
        throw new Error(`Agent with handle @${updates.handle} already exists`);
      }
    }
    
    const updateData = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await Agent.collection().doc(this.id).update(updateData);
    
    // Update local instance
    Object.assign(this, updates);
    return this;
  }

  /**
   * Delete the agent
   */
  async delete() {
    if (!this.id) throw new Error('Cannot delete agent without ID');
    await Agent.collection().doc(this.id).delete();
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      handle: this.handle,
      description: this.description,
      systemPrompt: this.systemPrompt,
      tools: this.tools,
      model: this.model,
      speakMode: this.speakMode,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Agent;

