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

class Trigger {
  constructor(data = {}) {
    this.id = data.id || null;
    this.agentId = data.agentId || data.monitorId || ''; // Support both for migration
    this.type = data.type || 'time_based'; // For now, only time_based
    this.schedule = data.schedule || ''; // e.g., "daily:09:00" or cron expression
    this.enabled = data.enabled !== undefined ? Boolean(data.enabled) : true;
    this.lastRunAt = toDate(data.lastRunAt);
    this.nextRunAt = toDate(data.nextRunAt);
    this.metadata = data.metadata || {};
    this.createdAt = toDate(data.createdAt) || new Date();
    this.updatedAt = toDate(data.updatedAt) || new Date();
  }

  static collection() {
    return firestore.collection('triggers');
  }

  static fromDoc(doc) {
    if (!doc.exists) {
      return null;
    }

    return new Trigger({
      id: doc.id,
      ...doc.data()
    });
  }

  static async findAll() {
    const snapshot = await this.collection().orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => this.fromDoc(doc)).filter(Boolean);
  }

  static async findById(id) {
    if (!id) {
      return null;
    }
    const doc = await this.collection().doc(id).get();
    return this.fromDoc(doc);
  }

  static async findByAgentId(agentId) {
    if (!agentId) {
      return [];
    }
    const snapshot = await this.collection()
      .where('agentId', '==', agentId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => this.fromDoc(doc)).filter(Boolean);
  }

  // Legacy method for backward compatibility
  static async findByMonitorId(monitorId) {
    return this.findByAgentId(monitorId);
  }

  static async create(data) {
    const now = new Date();
    const payload = cleanData({
      agentId: data.agentId || data.monitorId, // Support both for migration
      type: data.type || 'time_based',
      schedule: data.schedule,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      lastRunAt: data.lastRunAt || null,
      nextRunAt: data.nextRunAt || null,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now
    });

    const docRef = await this.collection().add(payload);
    return new Trigger({
      id: docRef.id,
      ...payload
    });
  }

  static async update(id, data) {
    if (!id) {
      throw new Error('Trigger ID is required');
    }

    const payload = cleanData({
      ...data,
      updatedAt: data.updatedAt || new Date()
    });

    const docRef = this.collection().doc(id);
    await docRef.set(payload, { merge: true });
    const updatedDoc = await docRef.get();
    return this.fromDoc(updatedDoc);
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      type: this.type,
      schedule: this.schedule,
      enabled: this.enabled,
      lastRunAt: this.lastRunAt ? this.lastRunAt.toISOString() : null,
      nextRunAt: this.nextRunAt ? this.nextRunAt.toISOString() : null,
      metadata: this.metadata,
      createdAt: this.createdAt ? this.createdAt.toISOString() : null,
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : null
    };
  }
}

module.exports = Trigger;
