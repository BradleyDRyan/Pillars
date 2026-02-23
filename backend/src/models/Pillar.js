const { firestore } = require('../config/firebase');
const { normalizeRubricItems } = require('../utils/rubrics');

const VALID_PILLAR_ICONS = [
  'heart',
  'house',
  'briefcase',
  'figure2',
  'dollarsign',
  'brain',
  'figure',
  'book',
  'sparkles',
  'leaf',
  'star',
  'globe',
  'airplane',
  'car',
  'bus',
  'bicycle',
  'train',
  'camera',
  'photo',
  'paintbrush',
  'musicnote',
  'headphones',
  'microphone',
  'speaker',
  'tv',
  'gamecontroller',
  'bookopen',
  'newspaper',
  'pencil',
  'ruler',
  'wrench',
  'hammer',
  'key',
  'creditcard',
  'cart',
  'bag',
  'gift',
  'trophy',
  'target',
  'flame',
  'drop',
  'umbrella',
  'cloud',
  'sun',
  'moon',
  'bell',
  'clock',
  'calendar',
  'chart',
  'shield',
  'flag',
  'mountain'
];

const VALID_PILLAR_ICON_VALUES = Object.freeze([...VALID_PILLAR_ICONS]);
const ICON_TOKEN_REGEX = /^[a-z][a-z0-9_.-]{1,63}$/;

function normalizePillarIcon(icon) {
  if (typeof icon !== 'string') {
    return null;
  }

  const trimmed = icon.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (ICON_TOKEN_REGEX.test(normalized)) {
    return normalized;
  }
  return null;
}

/**
 * Pillar — A major domain of life (e.g., Work, Relationship, Health)
 * 
 * Valid icon values (enum-backed):
 * - heart, house, briefcase, figure2, dollarsign, brain, figure, book, sparkles, leaf, star, globe, and 40 more
 */
class Pillar {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.name = data.name || '';
    this.pillarType = typeof data.pillarType === 'string' ? data.pillarType : null;
    this.description = data.description || '';
    this.color = data.color || '#000000';
    this.colorToken = typeof data.colorToken === 'string' ? data.colorToken : null;
    this.customColorHex = typeof data.customColorHex === 'string' ? data.customColorHex : null;
    /** @type {string|null} Icon identifier (enum-backed, e.g., heart, house, ... ) */
    this.icon = normalizePillarIcon(data.icon);
    this.isDefault = data.isDefault || false;
    this.isArchived = data.isArchived || false;
    this.rubricItems = Array.isArray(data.rubricItems)
      ? normalizeRubricItems(data.rubricItems, { fallbackItems: [] }).value || []
      : [];
    this.settings = data.settings || {};
    this.stats = data.stats || {
      conversationCount: 0,
      messageCount: 0,
      taskCount: 0,
      principleCount: 0,
      wisdomCount: 0,
      resourceCount: 0,
      pointEventCount: 0,
      pointTotal: 0
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('pillars');
  }

  static async create(data) {
    const pillar = new Pillar(data);
    const docRef = await this.collection().add({
      userId: pillar.userId,
      name: pillar.name,
      pillarType: pillar.pillarType,
      description: pillar.description,
      color: pillar.color,
      colorToken: pillar.colorToken,
      customColorHex: pillar.customColorHex,
      icon: pillar.icon,
      isDefault: pillar.isDefault,
      isArchived: pillar.isArchived,
      rubricItems: pillar.rubricItems,
      settings: pillar.settings,
      stats: pillar.stats,
      createdAt: pillar.createdAt,
      updatedAt: pillar.updatedAt,
      metadata: pillar.metadata
    });
    pillar.id = docRef.id;
    return pillar;
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Pillar({ id: doc.id, ...doc.data() });
  }

  static async findByUserId(userId, includeArchived = false) {
    let query = this.collection().where('userId', '==', userId);
    
    if (!includeArchived) {
      query = query.where('isArchived', '==', false);
    }
    
    const snapshot = await query.orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(doc => new Pillar({ id: doc.id, ...doc.data() }));
  }

  static async findDefaultPillar(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .where('isDefault', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return new Pillar({ id: doc.id, ...doc.data() });
  }

  static async createDefaultPillar(userId) {
    const existingDefault = await this.findDefaultPillar(userId);
    if (existingDefault) {
      return existingDefault;
    }
    
    return this.create({
      userId,
      name: 'Personal',
      description: 'Your personal pillar',
      color: '#6366f1',
      colorToken: 'indigo',
      pillarType: 'custom',
      rubricItems: [],
      isDefault: true
    });
  }

  async updateStats() {
    const conversations = await firestore.collection('conversations')
      .where('pillarIds', 'array-contains', this.id)
      .get();
    
    const messages = await firestore.collection('messages')
      .where('pillarIds', 'array-contains', this.id)
      .get();
    
    const tasks = await firestore.collection('tasks')
      .where('pillarIds', 'array-contains', this.id)
      .get();

    const principles = await firestore.collection('principles')
      .where('pillarId', '==', this.id)
      .get();

    const wisdoms = await firestore.collection('wisdoms')
      .where('pillarId', '==', this.id)
      .get();

    const resources = await firestore.collection('resources')
      .where('pillarId', '==', this.id)
      .get();

    const pointEventsSnapshot = await firestore.collection('pointEvents')
      .where('userId', '==', this.userId)
      .where('voidedAt', '==', null)
      .where('pillarIds', 'array-contains', this.id)
      .get();

    let pointTotal = 0;
    for (const doc of pointEventsSnapshot.docs) {
      const data = doc.data() || {};
      if (!Array.isArray(data.allocations)) {
        continue;
      }
      for (const allocation of data.allocations) {
        if (allocation && allocation.pillarId === this.id && Number.isFinite(allocation.points)) {
          pointTotal += allocation.points;
        }
      }
    }
    
    this.stats = {
      conversationCount: conversations.size,
      messageCount: messages.size,
      taskCount: tasks.size,
      principleCount: principles.size,
      wisdomCount: wisdoms.size,
      resourceCount: resources.size,
      pointEventCount: pointEventsSnapshot.size,
      pointTotal
    };
    
    await this.save();
    return this.stats;
  }

  async save() {
    this.updatedAt = new Date();
    this.icon = normalizePillarIcon(this.icon);
    if (this.id) {
      await Pillar.collection().doc(this.id).update({
        name: this.name,
        pillarType: this.pillarType,
        description: this.description,
        color: this.color,
        colorToken: this.colorToken,
        customColorHex: this.customColorHex,
        icon: this.icon,
        isDefault: this.isDefault,
        isArchived: this.isArchived,
        rubricItems: this.rubricItems,
        settings: this.settings,
        stats: this.stats,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      });
    } else {
      const created = await Pillar.create(this);
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
        throw new Error('Cannot delete pillar with existing content. Archive it instead.');
      }
      
      await Pillar.collection().doc(this.id).delete();
    }
  }
}

Pillar.VALID_ICON_VALUES = VALID_PILLAR_ICON_VALUES;
Pillar.validIconValues = VALID_PILLAR_ICON_VALUES;

module.exports = Pillar;
