const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');

router.use(flexibleAuth);

const VALID_DAYS_OF_WEEK = new Set([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]);

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function normalizeDaysOfWeek(rawDays) {
  if (rawDays === null || rawDays === undefined) {
    return { value: [] };
  }

  if (!Array.isArray(rawDays)) {
    return { error: 'Invalid daysOfWeek. Must be an array of weekday names.' };
  }

  const normalized = [];
  for (const value of rawDays) {
    const weekday = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!VALID_DAYS_OF_WEEK.has(weekday)) {
      return { error: 'Invalid daysOfWeek value. Use: sunday..saturday' };
    }
    if (!normalized.includes(weekday)) {
      normalized.push(weekday);
    }
  }

  return { value: normalized };
}

// GET /api/day-templates — list user's templates
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    let snapshot;
    let queryMode = 'indexed';
    try {
      snapshot = await db.collection('dayTemplates')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'asc')
        .get();
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      queryMode = 'fallback-no-index';
      console.warn('[day-templates] GET / missing index, using fallback query', { userId });
      snapshot = await db.collection('dayTemplates')
        .where('userId', '==', userId)
        .get();
    }

    const templates = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
        const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
        return aCreated - bCreated;
      });

    if (queryMode !== 'indexed') {
      console.info('[day-templates] GET / served via fallback-no-index', { userId, count: templates.length });
    }
    res.json(templates);
  } catch (error) {
    console.error('[day-templates] GET / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/day-templates/default — get user's default template; 404 if none
router.get('/default', async (req, res) => {
  try {
    const userId = req.user.uid;
    console.info('[day-templates] GET /default start', { userId });

    let snapshot;
    let queryMode = 'indexed';
    try {
      snapshot = await db.collection('dayTemplates')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .limit(1)
        .get();
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      queryMode = 'fallback-no-index';
      console.warn('[day-templates] GET /default missing index, using fallback query', { userId });
      snapshot = await db.collection('dayTemplates')
        .where('userId', '==', userId)
        .get();
    }

    if (snapshot.empty) {
      console.info('[day-templates] GET /default not found', { userId });
      return res.status(404).json({ error: 'No default template found' });
    }

    const doc = queryMode === 'indexed'
      ? snapshot.docs[0]
      : snapshot.docs.find(candidate => Boolean(candidate.data().isDefault));

    if (!doc) {
      console.info('[day-templates] GET /default not found after fallback filter', { userId });
      return res.status(404).json({ error: 'No default template found' });
    }

    console.info('[day-templates] GET /default success', { userId, templateId: doc.id, queryMode });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('[day-templates] GET /default error:', {
      userId: req.user?.uid,
      message: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/day-templates — create template
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id, name, isDefault, sections } = req.body;
    const { value: daysOfWeek, error: daysOfWeekError } = normalizeDaysOfWeek(req.body?.daysOfWeek);

    if (!id || !name || !sections) {
      return res.status(400).json({ error: 'Missing required fields: id, name, sections' });
    }
    if (daysOfWeekError) {
      return res.status(400).json({ error: daysOfWeekError });
    }

    // If setting as default, clear other defaults
    if (isDefault) {
      const existingDefaults = await db.collection('dayTemplates')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .get();
      const batch = db.batch();
      existingDefaults.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    const now = new Date();
    const templateData = {
      id,
      userId,
      name,
      isDefault: isDefault || false,
      daysOfWeek,
      sections,
      createdAt: now.getTime() / 1000,
      updatedAt: now.getTime() / 1000
    };

    await db.collection('dayTemplates').doc(id).set(templateData);
    res.status(201).json(templateData);
  } catch (error) {
    console.error('[day-templates] POST / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/day-templates/:id — update template
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const templateRef = db.collection('dayTemplates').doc(req.params.id);
    const existing = await templateRef.get();

    if (!existing.exists) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (existing.data().userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existingDays = existing.data().daysOfWeek;
    const requestedDays = Object.prototype.hasOwnProperty.call(req.body || {}, 'daysOfWeek')
      ? req.body.daysOfWeek
      : existingDays;
    const { value: daysOfWeek, error: daysOfWeekError } = normalizeDaysOfWeek(requestedDays);
    if (daysOfWeekError) {
      return res.status(400).json({ error: daysOfWeekError });
    }

    const now = new Date();
    const updated = {
      ...req.body,
      userId,
      id: req.params.id,
      daysOfWeek,
      updatedAt: now.getTime() / 1000
    };

    await templateRef.set(updated);
    res.json(updated);
  } catch (error) {
    console.error('[day-templates] PUT /:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
