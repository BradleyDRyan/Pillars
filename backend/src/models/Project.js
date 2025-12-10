const { firestore } = require('../config/firebase');

/**
 * Valid icon values (enum-based, translates to platform-specific assets):
 * - folder (default)
 * - health
 * - money
 */
class Project {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.color = data.color || '#000000';
    /** @type {string|null} Icon identifier (see valid values above) */
    this.icon = data.icon || null;
    this.isDefault = data.isDefault || false;
    this.isArchived = data.isArchived || false;
    this.settings = data.settings || {};
    this.stats = data.stats || {
      conversationCount: 0,
      taskCount: 0,
      entryCount: 0,
      thoughtCount: 0
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('projects');
  }

  static async create(data) {
    const project = new Project(data);
    const docRef = await this.collection().add({
      userId: project.userId,
      name: project.name,
      description: project.description,
      color: project.color,
      icon: project.icon,
      isDefault: project.isDefault,
      isArchived: project.isArchived,
      settings: project.settings,
      stats: project.stats,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      metadata: project.metadata
    });
    project.id = docRef.id;
    return project;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Project({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, includeArchived = false) {
    let query = this.collection().where('userId', '==', userId);
    
    if (!includeArchived) {
      query = query.where('isArchived', '==', false);
    }
    
    const snapshot = await query.orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(doc => new Project({ id: doc.id, ...doc.data() }));
  }

  static async findDefaultProject(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('isDefault', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return new Project({ id: doc.id, ...doc.data() });
  }

  static async createDefaultProject(userId) {
    const existingDefault = await this.findDefaultProject(userId);
    if (existingDefault) {
      return existingDefault;
    }
    
    return this.create({
      userId,
      name: 'Personal',
      description: 'Your personal project',
      color: '#6366f1',
      isDefault: true
    });
  }

  async updateStats() {
    const conversations = await firestore.collection('conversations')
      .where('projectIds', 'array-contains', this.id)
      .get();
    
    const tasks = await firestore.collection('tasks')
      .where('projectIds', 'array-contains', this.id)
      .get();
    
    const entries = await firestore.collection('entries')
      .where('projectIds', 'array-contains', this.id)
      .get();
    
    const thoughts = await firestore.collection('thoughts')
      .where('projectIds', 'array-contains', this.id)
      .get();
    
    this.stats = {
      conversationCount: conversations.size,
      taskCount: tasks.size,
      entryCount: entries.size,
      thoughtCount: thoughts.size
    };
    
    await this.save();
    return this.stats;
  }

  async save() {
    this.updatedAt = new Date();
    if (this.id) {
      await Project.collection().doc(this.id).update({
        name: this.name,
        description: this.description,
        color: this.color,
        icon: this.icon,
        isDefault: this.isDefault,
        isArchived: this.isArchived,
        settings: this.settings,
        stats: this.stats,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Project.create(this);
      this.id = created.id;
    }
    return this;
  }

  async archive() {
    this.isArchived = true;
    return this.save();
  }

  async unarchive() {
    this.isArchived = false;
    return this.save();
  }

  async delete() {
    if (this.id) {
      const hasContent = Object.values(this.stats).some(count => count > 0);
      if (hasContent) {
        throw new Error('Cannot delete project with existing content. Archive it instead.');
      }
      
      await Project.collection().doc(this.id).delete();
    }
  }
}

module.exports = Project;

