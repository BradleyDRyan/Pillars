const { firestore } = require('../config/firebase');

const toDate = value => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value);
};

const cleanData = data =>
  Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

class Agent {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.instructions = data.instructions || '';
    this.model = data.model || null;
    this.enableWebSearch = Boolean(data.enableWebSearch);
    this.allowedTools = Array.isArray(data.allowedTools)
      ? data.allowedTools.filter((tool) => typeof tool === 'string' && tool.trim().length > 0)
      : [];
    if (this.enableWebSearch && !this.allowedTools.includes('web_search')) {
      this.allowedTools.push('web_search');
    }
    this.conversationId = data.conversationId || null;
    this.createdAt = toDate(data.createdAt) || new Date();
    this.updatedAt = toDate(data.updatedAt) || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('agents');
  }

  static fromDoc(doc) {
    if (!doc.exists) {
      return null;
    }

    return new Agent({
      id: doc.id,
      ...doc.data()
    });
  }

  static async findAll(userId = null) {
    let query = this.collection();
    
    if (userId) {
      query = query.where('userId', '==', userId);
      // Note: When using where + orderBy, Firestore requires a composite index
      // For now, we'll fetch all and sort in memory to avoid index requirement
      const snapshot = await query.get();
      const agents = snapshot.docs.map(doc => this.fromDoc(doc)).filter(Boolean);
      // Sort by createdAt descending
      return agents.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => this.fromDoc(doc)).filter(Boolean);
  }

  static async findById(id) {
    if (!id) {
      return null;
    }
    const doc = await this.collection().doc(id).get();
    return this.fromDoc(doc);
  }

  static async findByIds(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const batches = await Promise.all(
      uniqueIds.map(async id => {
        const doc = await this.collection().doc(id).get();
        return this.fromDoc(doc);
      })
    );

    return batches.filter(Boolean);
  }

  static async findByConversationId(conversationId) {
    if (!conversationId) {
      return null;
    }
    const snapshot = await this.collection()
      .where('conversationId', '==', conversationId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return this.fromDoc(snapshot.docs[0]);
  }

  static async create(data) {
    const now = new Date();
    const payload = cleanData({
      userId: data.userId,
      name: data.name || '',
      description: data.description || '',
      instructions: data.instructions || '',
      model: data.model || null,
      enableWebSearch: Boolean(data.enableWebSearch),
      allowedTools: Array.isArray(data.allowedTools) ? data.allowedTools : [],
      conversationId: data.conversationId || null,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now
    });

    const docRef = await this.collection().add(payload);
    return new Agent({
      id: docRef.id,
      ...payload
    });
  }

  static async update(id, data) {
    if (!id) {
      throw new Error('Agent ID is required');
    }

    const payload = cleanData({
      ...data,
      enableWebSearch: data.enableWebSearch !== undefined ? Boolean(data.enableWebSearch) : undefined,
      allowedTools: Array.isArray(data.allowedTools) ? data.allowedTools : undefined,
      updatedAt: new Date()
    });

    const docRef = this.collection().doc(id);
    await docRef.set(payload, { merge: true });
    const updatedDoc = await docRef.get();
    return this.fromDoc(updatedDoc);
  }

  static async delete(id) {
    if (!id) {
      throw new Error('Agent ID is required');
    }
    await this.collection().doc(id).delete();
  }

  toJSON() {
    // Safely convert dates to ISO strings, handling invalid dates
    const safeDateToString = (date) => {
      if (!date) return null;
      try {
        if (typeof date.toISOString === 'function') {
          return date.toISOString();
        }
        // If it's not a Date object, try to convert it
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          return null; // Invalid date
        }
        return dateObj.toISOString();
      } catch (err) {
        return null;
      }
    };

    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      instructions: this.instructions,
      model: this.model,
      enableWebSearch: this.enableWebSearch,
      allowedTools: this.allowedTools,
      conversationId: this.conversationId,
      metadata: this.metadata,
      createdAt: safeDateToString(this.createdAt),
      updatedAt: safeDateToString(this.updatedAt)
    };
  }
}

module.exports = Agent;

