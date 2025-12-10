const { firestore, admin } = require('../config/firebase');

class CollectionEntrySuggestion {
  constructor(data = {}) {
    this.id = data.id || null;
    this.collectionEntryId = data.collectionEntryId || null;
    this.entryId = data.entryId || null;
    this.collectionId = data.collectionId || null;
    this.userId = data.userId || null;
    this.type = data.type || null;
    this.status = data.status || 'pending';
    this.payload = data.payload || null;
    this.error = data.error || null;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static collection() {
    return firestore.collection('collection_entry_suggestions');
  }

  static async create(data) {
    const suggestion = new CollectionEntrySuggestion(data);
    const docRef = await this.collection().add({
      collectionEntryId: suggestion.collectionEntryId,
      entryId: suggestion.entryId,
      collectionId: suggestion.collectionId,
      userId: suggestion.userId,
      type: suggestion.type,
      status: suggestion.status,
      payload: suggestion.payload,
      error: suggestion.error,
      metadata: suggestion.metadata,
      createdAt: admin.firestore.Timestamp.fromDate(suggestion.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(suggestion.updatedAt)
    });

    suggestion.id = docRef.id;
    return suggestion;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data();
    return new CollectionEntrySuggestion({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date()
    });
  }

  async update(fields = {}) {
    if (!this.id) {
      throw new Error('Cannot update CollectionEntrySuggestion without ID');
    }

    const updates = { ...fields, updatedAt: admin.firestore.Timestamp.fromDate(new Date()) };
    await CollectionEntrySuggestion.collection().doc(this.id).update(updates);

    Object.assign(this, fields, { updatedAt: new Date() });
    return this;
  }
}

module.exports = CollectionEntrySuggestion;
