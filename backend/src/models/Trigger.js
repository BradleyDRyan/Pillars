const { firestore } = require('../config/firebase');

/**
 * Trigger — Defines when and how an Agent should run
 */
class Trigger {
  constructor(data = {}) {
    this.id = data.id || null;
    this.agentId = data.agentId || null;
    this.type = data.type || 'time_based';
    this.schedule = data.schedule || null;
    this.enabled = data.enabled !== undefined ? data.enabled : true;
    this.lastRunAt = data.lastRunAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('triggers');
  }

  static async create(data) {
    const trigger = new Trigger(data);
    const docRef = await this.collection().add({
      agentId: trigger.agentId,
      type: trigger.type,
      schedule: trigger.schedule,
      enabled: trigger.enabled,
      lastRunAt: trigger.lastRunAt,
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
      metadata: trigger.metadata
    });
    trigger.id = docRef.id;
    return trigger;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Trigger({ id: doc.id, ...doc.data() });
  }

  static async findByAgentId(agentId) {
    const snapshot = await this.collection()
      .where('agentId', '==', agentId)
      .get();
    return snapshot.docs.map(doc => new Trigger({ id: doc.id, ...doc.data() }));
  }

  static async findAll() {
    const snapshot = await this.collection().get();
    return snapshot.docs.map(doc => new Trigger({ id: doc.id, ...doc.data() }));
  }

  static async update(id, data) {
    const updateData = {
      ...data,
      updatedAt: new Date()
    };
    await this.collection().doc(id).update(updateData);
    return this.findById(id);
  }

  static async delete(id) {
    await this.collection().doc(id).delete();
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      type: this.type,
      schedule: this.schedule,
      enabled: this.enabled,
      lastRunAt: this.lastRunAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }
}

module.exports = Trigger;
