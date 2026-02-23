const { firestore } = require('../config/firebase');
const { normalizeRubricItems } = require('../utils/rubrics');

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

class PillarTemplate {
  constructor(data = {}) {
    const normalizedRubricItems = normalizeRubricItems(data.rubricItems, {
      fallbackItems: []
    });

    this.id = data.id || data.pillarType || null;
    this.pillarType = data.pillarType || this.id || null;
    this.name = data.name || '';
    this.description = data.description ?? null;
    this.icon = data.icon ?? null;
    this.colorToken = data.colorToken ?? null;
    this.order = Number.isInteger(data.order) ? data.order : 0;
    this.isActive = data.isActive !== false;
    this.rubricItems = normalizedRubricItems.error ? [] : normalizedRubricItems.value;
    this.createdAt = Number.isInteger(data.createdAt) ? data.createdAt : nowSeconds();
    this.updatedAt = Number.isInteger(data.updatedAt) ? data.updatedAt : this.createdAt;
    this.updatedBy = data.updatedBy ?? null;
  }

  static collection() {
    return firestore.collection('pillarTemplates');
  }

  static async findByType(pillarType) {
    const doc = await this.collection().doc(pillarType).get();
    if (!doc.exists) {
      return null;
    }
    return new PillarTemplate({
      id: doc.id,
      ...doc.data()
    });
  }

  static async listAll() {
    const snapshot = await this.collection().get();
    return snapshot.docs.map(doc => new PillarTemplate({
      id: doc.id,
      ...doc.data()
    }));
  }

  async save() {
    this.updatedAt = nowSeconds();
    if (!Number.isInteger(this.createdAt)) {
      this.createdAt = this.updatedAt;
    }

    if (!this.pillarType) {
      throw new Error('pillarType is required');
    }

    await PillarTemplate.collection()
      .doc(this.pillarType)
      .set({
        pillarType: this.pillarType,
        name: this.name,
        description: this.description,
        icon: this.icon,
        colorToken: this.colorToken,
        order: this.order,
        isActive: this.isActive,
        rubricItems: this.rubricItems,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        updatedBy: this.updatedBy
      });

    this.id = this.pillarType;
    return this;
  }

  toJSON() {
    return {
      id: this.pillarType,
      pillarType: this.pillarType,
      name: this.name,
      description: this.description,
      icon: this.icon,
      colorToken: this.colorToken,
      order: this.order,
      isActive: this.isActive,
      rubricItems: this.rubricItems,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    };
  }
}

module.exports = PillarTemplate;
