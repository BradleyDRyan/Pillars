const { v4: uuidv4 } = require('uuid');
const {
  BUILTIN_BLOCK_TYPES,
  BUILTIN_BLOCK_TYPE_IDS,
  createBuiltinBlockTypeDoc
} = require('../config/builtinBlockTypes');

function nowTs() {
  return Date.now() / 1000;
}

function sortBlockTypes(items) {
  return [...items].sort((a, b) => {
    const aCategoryRank = a.category === 'built-in' ? 0 : 1;
    const bCategoryRank = b.category === 'built-in' ? 0 : 1;
    if (aCategoryRank !== bCategoryRank) {
      return aCategoryRank - bCategoryRank;
    }

    const aUpdated = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
    const bUpdated = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
    if (aUpdated !== bUpdated) {
      return bUpdated - aUpdated;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

async function listBlockTypeDocsByUser(db, userId) {
  const snapshot = await db.collection('blockTypes')
    .where('userId', '==', userId)
    .get();

  return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
}

async function ensureBuiltinBlockTypesForUser({ db, userId }) {
  const existing = await listBlockTypeDocsByUser(db, userId);
  const existingByTypeId = new Map(existing.map(item => [item.id, item]));

  const batch = db.batch();
  const timestamp = nowTs();
  let created = 0;

  for (const builtin of BUILTIN_BLOCK_TYPES) {
    if (existingByTypeId.has(builtin.id)) {
      continue;
    }

    const docRef = db.collection('blockTypes').doc(`${userId}__builtin__${builtin.id}`);
    batch.set(docRef, createBuiltinBlockTypeDoc({ userId, type: builtin, nowTs: timestamp }));
    created += 1;
  }

  if (created > 0) {
    await batch.commit();
  }

  return created;
}

async function listBlockTypesForUser({ db, userId, ensureBuiltins = true }) {
  if (ensureBuiltins) {
    await ensureBuiltinBlockTypesForUser({ db, userId });
  }

  const items = await listBlockTypeDocsByUser(db, userId);
  return sortBlockTypes(items.map(item => ({ ...item, isDeletable: item.category === 'built-in' ? false : item.isDeletable !== false })));
}

async function getBlockTypeById({ db, userId, typeId, ensureBuiltins = true }) {
  if (ensureBuiltins) {
    await ensureBuiltinBlockTypesForUser({ db, userId });
  }

  const snapshot = await db.collection('blockTypes')
    .where('userId', '==', userId)
    .where('id', '==', typeId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    docId: doc.id,
    ...doc.data()
  };
}

function createCustomTypeId() {
  return `custom_${uuidv4()}`;
}

function isBuiltinTypeId(typeId) {
  return BUILTIN_BLOCK_TYPE_IDS.has(typeId);
}

module.exports = {
  nowTs,
  sortBlockTypes,
  ensureBuiltinBlockTypesForUser,
  listBlockTypesForUser,
  getBlockTypeById,
  createCustomTypeId,
  isBuiltinTypeId
};
