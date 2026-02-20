const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const {
  createValidationError,
  normalizeBlockTypePayload,
  normalizeTypeId
} = require('../utils/blockTypeValidation');
const {
  ensureBuiltinBlockTypesForUser,
  listBlockTypesForUser,
  getBlockTypeById,
  createCustomTypeId,
  isBuiltinTypeId,
  nowTs
} = require('../services/blockTypes');

const router = express.Router();
router.use(flexibleAuth);

function respondError(res, error) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error('[block-types] route error:', error);
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

// GET /api/block-types
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    await ensureBuiltinBlockTypesForUser({ db, userId });
    const items = await listBlockTypesForUser({ db, userId, ensureBuiltins: false });
    return res.json({
      count: items.length,
      items
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// GET /api/block-types/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const typeId = normalizeTypeId(req.params.id);

    const type = await getBlockTypeById({
      db,
      userId,
      typeId,
      ensureBuiltins: true
    });

    if (!type) {
      return res.status(404).json({ error: 'Block type not found' });
    }

    return res.json(type);
  } catch (error) {
    return respondError(res, error);
  }
});

// POST /api/block-types
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    await ensureBuiltinBlockTypesForUser({ db, userId });

    const normalized = normalizeBlockTypePayload(req.body || {}, { partial: false });

    const providedId = Object.prototype.hasOwnProperty.call(req.body || {}, 'id')
      ? normalizeTypeId(req.body.id)
      : null;

    const id = providedId || createCustomTypeId();
    if (isBuiltinTypeId(id)) {
      throw createValidationError('Custom block types cannot use built-in ids');
    }

    const existing = await getBlockTypeById({
      db,
      userId,
      typeId: id,
      ensureBuiltins: false
    });

    if (existing) {
      return res.status(409).json({ error: 'Block type with this id already exists' });
    }

    const timestamp = nowTs();
    const payload = {
      id,
      userId,
      name: normalized.name,
      icon: normalized.icon,
      color: normalized.color,
      category: 'custom',
      defaultSection: normalized.defaultSection,
      subtitleTemplate: normalized.subtitleTemplate,
      dataSchema: normalized.dataSchema,
      isDeletable: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await db.collection('blockTypes').doc(`${userId}__custom__${id}`).set(payload);
    return res.status(201).json(payload);
  } catch (error) {
    return respondError(res, error);
  }
});

// PUT /api/block-types/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const typeId = normalizeTypeId(req.params.id);
    const existing = await getBlockTypeById({ db, userId, typeId, ensureBuiltins: true });

    if (!existing) {
      return res.status(404).json({ error: 'Block type not found' });
    }

    const updates = normalizeBlockTypePayload(req.body || {}, { partial: true });
    const payload = {
      ...updates,
      updatedAt: nowTs()
    };

    await db.collection('blockTypes').doc(existing.docId).set(payload, { merge: true });

    return res.json({
      ...existing,
      ...payload,
      id: existing.id,
      userId: existing.userId,
      category: existing.category,
      isDeletable: existing.category === 'built-in' ? false : existing.isDeletable !== false,
      createdAt: existing.createdAt
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// DELETE /api/block-types/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const typeId = normalizeTypeId(req.params.id);
    const existing = await getBlockTypeById({ db, userId, typeId, ensureBuiltins: true });

    if (!existing) {
      return res.status(404).json({ error: 'Block type not found' });
    }

    if (existing.category === 'built-in' || existing.isDeletable === false) {
      return res.status(400).json({ error: 'Built-in block types cannot be deleted' });
    }

    const usageSnapshot = await db.collection('dayBlocks')
      .where('userId', '==', userId)
      .where('typeId', '==', typeId)
      .limit(1)
      .get();

    if (!usageSnapshot.empty) {
      return res.status(409).json({ error: 'Cannot delete block type with existing instances' });
    }

    await db.collection('blockTypes').doc(existing.docId).delete();
    return res.status(204).send();
  } catch (error) {
    return respondError(res, error);
  }
});

module.exports = router;
