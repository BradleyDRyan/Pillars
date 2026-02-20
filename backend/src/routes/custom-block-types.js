const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');

router.use(flexibleAuth);

const VALID_SECTIONS = new Set(['morning', 'afternoon', 'evening']);
const VALID_FIELD_TYPES = new Set(['text', 'multiline', 'number', 'slider', 'toggle', 'rating']);

function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeField(rawField, index) {
  const id = typeof rawField?.id === 'string' && rawField.id.trim()
    ? rawField.id.trim()
    : `field_${index + 1}`;
  const label = typeof rawField?.label === 'string' && rawField.label.trim()
    ? rawField.label.trim()
    : id;
  const type = typeof rawField?.type === 'string' ? rawField.type.trim() : '';

  if (!VALID_FIELD_TYPES.has(type)) {
    return null;
  }

  return {
    id,
    label,
    type,
    placeholder: typeof rawField?.placeholder === 'string' ? rawField.placeholder : null,
    min: parseNumber(rawField?.min),
    max: parseNumber(rawField?.max),
    step: parseNumber(rawField?.step),
    isRequired: Boolean(rawField?.isRequired)
  };
}

function normalizePayload(body, userId) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return { error: 'Missing required field: name' };
  }

  const defaultSection = typeof body?.defaultSection === 'string' ? body.defaultSection.trim() : '';
  if (!VALID_SECTIONS.has(defaultSection)) {
    return { error: 'Invalid defaultSection. Must be morning, afternoon, or evening.' };
  }

  const rawFields = Array.isArray(body?.fields) ? body.fields : [];
  const fields = rawFields.map((field, index) => normalizeField(field, index));
  if (fields.some(field => field === null)) {
    return { error: 'One or more fields have an invalid type.' };
  }

  return {
    data: {
      userId,
      name,
      icon: typeof body?.icon === 'string' && body.icon.trim() ? body.icon.trim() : 'square.grid.2x2',
      description: typeof body?.description === 'string' ? body.description : '',
      defaultSection,
      fields
    }
  };
}

// GET /api/custom-block-types — list user's custom block types
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('customBlockTypes')
      .where('userId', '==', userId)
      .get();

    const types = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    res.json(types);
  } catch (error) {
    console.error('[custom-block-types] GET / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/custom-block-types — create custom block type
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { data, error } = normalizePayload(req.body, userId);
    if (error) {
      return res.status(400).json({ error });
    }

    const collection = db.collection('customBlockTypes');
    const requestedId = typeof req.body?.id === 'string' && req.body.id.trim()
      ? req.body.id.trim()
      : null;
    const id = requestedId || collection.doc().id;

    if (requestedId) {
      const existing = await collection.doc(id).get();
      if (existing.exists) {
        if (existing.data().userId !== userId) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        return res.status(409).json({ error: 'Custom block type with this id already exists' });
      }
    }

    const now = Date.now() / 1000;

    const payload = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now
    };

    await collection.doc(id).set(payload);
    res.status(201).json(payload);
  } catch (error) {
    console.error('[custom-block-types] POST / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/custom-block-types/:id — update custom block type
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const ref = db.collection('customBlockTypes').doc(req.params.id);
    const existing = await ref.get();

    if (!existing.exists) {
      return res.status(404).json({ error: 'Custom block type not found' });
    }
    if (existing.data().userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = normalizePayload(req.body, userId);
    if (error) {
      return res.status(400).json({ error });
    }

    const now = Date.now() / 1000;
    const payload = {
      ...existing.data(),
      ...data,
      id: req.params.id,
      userId,
      createdAt: existing.data().createdAt ?? now,
      updatedAt: now
    };

    await ref.set(payload);
    res.json(payload);
  } catch (error) {
    console.error('[custom-block-types] PUT /:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/custom-block-types/:id — delete custom block type
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const ref = db.collection('customBlockTypes').doc(req.params.id);
    const existing = await ref.get();

    if (!existing.exists) {
      return res.status(404).json({ error: 'Custom block type not found' });
    }
    if (existing.data().userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await ref.delete();
    res.status(204).send();
  } catch (error) {
    console.error('[custom-block-types] DELETE /:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
