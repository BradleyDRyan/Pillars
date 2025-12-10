const { firestore } = require('../config/firebase');

/**
 * Resource — External ideas/frameworks (books, podcasts, theories) the user saves
 * 
 * Types:
 * - book: A book
 * - article: An article or blog post
 * - podcast: A podcast or podcast episode
 * - video: A video or documentary
 * - course: An online course or workshop
 * - framework: A mental model or framework
 * - person: A mentor, author, or thought leader to follow
 * - other: Anything else
 * 
 * Status:
 * - saved: Just saved, not started
 * - in_progress: Currently consuming/studying
 * - completed: Finished consuming
 * - revisiting: Going through again
 * - archived: No longer relevant
 */
class Resource {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    /** @type {string|null} Optional - resource can exist without a pillar */
    this.pillarId = data.pillarId || null;
    this.title = data.title || '';
    this.description = data.description || '';
    /** @type {'book'|'article'|'podcast'|'video'|'course'|'framework'|'person'|'other'} */
    this.type = data.type || 'other';
    /** @type {string|null} Author, creator, or source */
    this.author = data.author || null;
    /** @type {string|null} URL to the resource */
    this.url = data.url || null;
    /** @type {string|null} Cover image URL */
    this.imageUrl = data.imageUrl || null;
    /** @type {'saved'|'in_progress'|'completed'|'revisiting'|'archived'} */
    this.status = data.status || 'saved';
    /** @type {number} Rating (1-5, 0 = not rated) */
    this.rating = data.rating || 0;
    /** @type {string|null} Personal notes about the resource */
    this.notes = data.notes || null;
    /** @type {Array<string>} Key takeaways from the resource */
    this.takeaways = data.takeaways || [];
    this.tags = data.tags || [];
    /** @type {Date|null} When the user started consuming this */
    this.startedAt = data.startedAt || null;
    /** @type {Date|null} When the user finished consuming this */
    this.completedAt = data.completedAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('resources');
  }

  static async create(data) {
    const resource = new Resource(data);
    const docRef = await this.collection().add({
      userId: resource.userId,
      pillarId: resource.pillarId,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      author: resource.author,
      url: resource.url,
      imageUrl: resource.imageUrl,
      status: resource.status,
      rating: resource.rating,
      notes: resource.notes,
      takeaways: resource.takeaways,
      tags: resource.tags,
      startedAt: resource.startedAt,
      completedAt: resource.completedAt,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      metadata: resource.metadata
    });
    resource.id = docRef.id;
    return resource;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Resource({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, filters = {}) {
    let query = this.collection().where('userId', '==', userId);
    
    if (filters.pillarId) {
      query = query.where('pillarId', '==', filters.pillarId);
    }
    
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => new Resource({ id: doc.id, ...doc.data() }));
  }

  static async findByPillarId(pillarId) {
    const snapshot = await this.collection()
      .where('pillarId', '==', pillarId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Resource({ id: doc.id, ...doc.data() }));
  }

  static async findUnassigned(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('pillarId', '==', null)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Resource({ id: doc.id, ...doc.data() }));
  }

  static async findByStatus(userId, status) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Resource({ id: doc.id, ...doc.data() }));
  }

  static async findByType(userId, type) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('type', '==', type)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => new Resource({ id: doc.id, ...doc.data() }));
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await Resource.collection().doc(this.id).update({
        pillarId: this.pillarId,
        title: this.title,
        description: this.description,
        type: this.type,
        author: this.author,
        url: this.url,
        imageUrl: this.imageUrl,
        status: this.status,
        rating: this.rating,
        notes: this.notes,
        takeaways: this.takeaways,
        tags: this.tags,
        startedAt: this.startedAt,
        completedAt: this.completedAt,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Resource.create(this);
      this.id = created.id;
    }
    return this;
  }

  async assignToPillar(pillarId) {
    this.pillarId = pillarId;
    return this.save();
  }

  async unassignFromPillar() {
    this.pillarId = null;
    return this.save();
  }

  async updateStatus(status) {
    this.status = status;
    if (status === 'in_progress' && !this.startedAt) {
      this.startedAt = new Date();
    }
    if (status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
    return this.save();
  }

  async addTakeaway(takeaway) {
    this.takeaways.push(takeaway);
    return this.save();
  }

  async rate(rating) {
    this.rating = Math.min(5, Math.max(0, rating));
    return this.save();
  }

  async delete() {
    if (this.id) {
      await Resource.collection().doc(this.id).delete();
    }
  }
}

module.exports = Resource;

