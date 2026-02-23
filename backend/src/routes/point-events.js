const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveValidatedPillarId, createInvalidPillarIdError } = require('../utils/pillarValidation');
const { resolveRubricSelection } = require('../utils/rubrics');
const {
  classifyAgainstRubric,
  classifyAcrossPillars
} = require('../services/classification');

const router = express.Router();
router.use(flexibleAuth);

const VALID_SOURCES = new Set(['user', 'clawdbot', 'system']);
const VALID_REF_TYPES = new Set(['todo', 'habit', 'block', 'freeform']);
const MIN_POINTS = 1;
const MAX_POINTS = 100;
const MAX_ALLOCATIONS = 3;
const MAX_TOTAL_POINTS = 150;
const MAX_REASON_LENGTH = 300;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function normalizeReason(rawReason) {
  if (typeof rawReason !== 'string') {
    return { error: 'reason is required' };
  }
  const trimmed = rawReason.trim();
  if (!trimmed) {
    return { error: 'reason is required' };
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { value: trimmed.slice(0, MAX_REASON_LENGTH) };
  }
  return { value: trimmed };
}

function normalizeSource(rawSource, authSource) {
  if (rawSource === undefined || rawSource === null) {
    if (authSource === 'service' || authSource === 'internal-service') {
      return { value: 'system' };
    }
    return { value: 'user' };
  }

  if (typeof rawSource !== 'string') {
    return { error: 'source must be user, clawdbot, or system' };
  }

  const normalized = rawSource.trim().toLowerCase();
  if (!VALID_SOURCES.has(normalized)) {
    return { error: 'source must be user, clawdbot, or system' };
  }

  return { value: normalized };
}

function normalizeRef(rawRef) {
  if (rawRef === undefined || rawRef === null) {
    return { value: null };
  }

  if (typeof rawRef !== 'object' || Array.isArray(rawRef)) {
    return { error: 'ref must be an object with type and id' };
  }

  const type = typeof rawRef.type === 'string' ? rawRef.type.trim().toLowerCase() : '';
  const id = typeof rawRef.id === 'string' ? rawRef.id.trim() : '';

  if (!type && !id) {
    return { value: null };
  }

  if (!VALID_REF_TYPES.has(type)) {
    return { error: 'ref.type must be todo, habit, block, or freeform' };
  }

  if (!id) {
    return { error: 'ref.id is required when ref.type is provided' };
  }

  return { value: { type, id } };
}

async function normalizeAllocations(rawAllocations, { userId }) {
  if (!Array.isArray(rawAllocations)) {
    return { error: 'allocations must be an array' };
  }

  if (rawAllocations.length < 1) {
    return { error: 'allocations must include at least one entry' };
  }
  if (rawAllocations.length > MAX_ALLOCATIONS) {
    return { error: `allocations must include at most ${MAX_ALLOCATIONS} entries` };
  }

  const normalized = [];
  const pillarIds = [];
  let totalPoints = 0;

  for (const allocation of rawAllocations) {
    if (!allocation || typeof allocation !== 'object') {
      return { error: 'each allocation must be an object' };
    }

    const rawPillarId = typeof allocation.pillarId === 'string' ? allocation.pillarId.trim() : '';
    if (!rawPillarId) {
      return { error: 'allocation.pillarId is required' };
    }

    const points = Number(allocation.points);
    if (!Number.isInteger(points) || points < MIN_POINTS || points > MAX_POINTS) {
      return { error: `allocation.points must be an integer between ${MIN_POINTS} and ${MAX_POINTS}` };
    }

    let validatedPillarId;
    try {
      validatedPillarId = await resolveValidatedPillarId({
        db,
        userId,
        pillarId: rawPillarId
      });
    } catch (error) {
      if (error && error.message === createInvalidPillarIdError().message) {
        return { error: 'Invalid pillarId' };
      }
      throw error;
    }

    if (pillarIds.includes(validatedPillarId)) {
      return { error: 'allocations must use unique pillarId values' };
    }

    totalPoints += points;
    if (totalPoints > MAX_TOTAL_POINTS) {
      return { error: `total points per event cannot exceed ${MAX_TOTAL_POINTS}` };
    }

    pillarIds.push(validatedPillarId);
    normalized.push({
      pillarId: validatedPillarId,
      points
    });
  }

  return { value: normalized, pillarIds, totalPoints };
}

function toResponseEvent(data) {
  if (!data) {
    return null;
  }
  const { pillarIds, ...rest } = data;
  return rest;
}

async function fetchPointEvents({ userId, fromDate, toDate, pillarId }) {
  let query = db.collection('pointEvents')
    .where('userId', '==', userId)
    .where('voidedAt', '==', null);

  if (fromDate) {
    query = query.where('date', '>=', fromDate);
  }
  if (toDate) {
    query = query.where('date', '<=', toDate);
  }
  if (pillarId) {
    query = query.where('pillarIds', 'array-contains', pillarId);
  }

  query = query.orderBy('date', 'desc');

  try {
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }
  }

  const fallbackSnapshot = await db.collection('pointEvents')
    .where('userId', '==', userId)
    .get();

  return fallbackSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => !item.voidedAt)
    .filter(item => !fromDate || item.date >= fromDate)
    .filter(item => !toDate || item.date <= toDate)
    .filter(item => !pillarId || (Array.isArray(item.pillarIds) && item.pillarIds.includes(pillarId)));
}

router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { body } = req;

    if (!isValidDateString(body?.date)) {
      return res.status(400).json({ error: 'date is required in YYYY-MM-DD format' });
    }

    const reasonResult = normalizeReason(body?.reason);
    if (reasonResult.error) {
      return res.status(400).json({ error: reasonResult.error });
    }

    const sourceResult = normalizeSource(body?.source, req.user?.source);
    if (sourceResult.error) {
      return res.status(400).json({ error: sourceResult.error });
    }

    const refResult = normalizeRef(body?.ref);
    if (refResult.error) {
      return res.status(400).json({ error: refResult.error });
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'pillarId')
      && body.pillarId !== null
      && body.pillarId !== undefined
      && (typeof body.pillarId !== 'string' || !body.pillarId.trim())) {
      return res.status(400).json({ error: 'pillarId must be a non-empty string or null' });
    }

    let allocationsInput = body?.allocations;
    let resolvedRubricItemId = null;
    if (Object.prototype.hasOwnProperty.call(body || {}, 'rubricItemId') && body.rubricItemId !== null) {
      if (typeof body.rubricItemId !== 'string' || !body.rubricItemId.trim()) {
        return res.status(400).json({ error: 'rubricItemId must be a non-empty string or null' });
      }

      const rubricPillarId = typeof body?.pillarId === 'string' && body.pillarId.trim()
        ? body.pillarId.trim()
        : null;

      let rubricSelection;
      try {
        rubricSelection = await resolveRubricSelection({
          db,
          userId,
          pillarId: rubricPillarId,
          rubricItemId: body.rubricItemId.trim()
        });
      } catch (error) {
        return res.status(error?.status || 400).json({ error: error.message });
      }

      resolvedRubricItemId = rubricSelection.rubricItem.id;
      allocationsInput = [{
        pillarId: rubricSelection.pillarId,
        points: rubricSelection.rubricItem.points
      }];
    } else if (allocationsInput === undefined || allocationsInput === null) {
      const classificationPillarId = typeof body?.pillarId === 'string' && body.pillarId.trim()
        ? body.pillarId.trim()
        : null;

      let classified;
      try {
        classified = classificationPillarId
          ? await classifyAgainstRubric({
            db,
            userId,
            text: reasonResult.value,
            pillarId: classificationPillarId
          })
          : await classifyAcrossPillars({
            db,
            userId,
            text: reasonResult.value
          });
      } catch (error) {
        return res.status(error?.status || 500).json({ error: error.message });
      }

      resolvedRubricItemId = classified.rubricItem.id;
      allocationsInput = [{
        pillarId: classified.pillarId,
        points: classified.rubricItem.points
      }];
    }

    const allocationResult = await normalizeAllocations(allocationsInput, { userId });
    if (allocationResult.error) {
      return res.status(400).json({ error: allocationResult.error });
    }

    const requestedId = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const collection = db.collection('pointEvents');
    const docRef = requestedId ? collection.doc(requestedId) : collection.doc();

    if (requestedId) {
      const existing = await docRef.get();
      if (existing.exists) {
        return res.status(409).json({ error: 'PointEvent with this id already exists' });
      }
    }

    const now = nowSeconds();
    const payload = {
      id: docRef.id,
      userId,
      date: body.date.trim(),
      reason: reasonResult.value,
      source: sourceResult.value,
      ref: refResult.value,
      allocations: allocationResult.value,
      pillarIds: allocationResult.pillarIds,
      totalPoints: allocationResult.totalPoints,
      rubricItemId: resolvedRubricItemId,
      createdAt: now,
      updatedAt: now,
      voidedAt: null
    };

    await docRef.set(payload);

    return res.status(201).json(toResponseEvent(payload));
  } catch (error) {
    console.error('[point-events] POST / error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;

    const fromDate = req.query.fromDate ? req.query.fromDate.trim() : null;
    const toDate = req.query.toDate ? req.query.toDate.trim() : null;
    const pillarId = req.query.pillarId ? req.query.pillarId.trim() : null;
    const refType = req.query.refType ? req.query.refType.trim().toLowerCase() : null;
    const refId = req.query.refId ? req.query.refId.trim() : null;
    const source = req.query.source ? req.query.source.trim().toLowerCase() : null;

    if (fromDate && !isValidDateString(fromDate)) {
      return res.status(400).json({ error: 'fromDate must use YYYY-MM-DD format' });
    }
    if (toDate && !isValidDateString(toDate)) {
      return res.status(400).json({ error: 'toDate must use YYYY-MM-DD format' });
    }
    if (refType && !VALID_REF_TYPES.has(refType)) {
      return res.status(400).json({ error: 'refType must be todo, habit, block, or freeform' });
    }
    if (refId && !refType) {
      return res.status(400).json({ error: 'refType is required when refId is provided' });
    }
    if (source && !VALID_SOURCES.has(source)) {
      return res.status(400).json({ error: 'source must be user, clawdbot, or system' });
    }

    const events = await fetchPointEvents({ userId, fromDate, toDate, pillarId });

    const filtered = events
      .filter(event => (source ? event.source === source : true))
      .filter(event => (refType ? event?.ref?.type === refType : true))
      .filter(event => (refId ? event?.ref?.id === refId : true))
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date < b.date ? 1 : -1;
        }
        const aCreated = Number.isFinite(a.createdAt) ? a.createdAt : 0;
        const bCreated = Number.isFinite(b.createdAt) ? b.createdAt : 0;
        return bCreated - aCreated;
      })
      .map(toResponseEvent);

    return res.json({
      items: filtered,
      count: filtered.length
    });
  } catch (error) {
    console.error('[point-events] GET / error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/rollup', async (req, res) => {
  try {
    const userId = req.user.uid;

    const fromDate = req.query.fromDate ? req.query.fromDate.trim() : null;
    const toDate = req.query.toDate ? req.query.toDate.trim() : null;

    if (fromDate && !isValidDateString(fromDate)) {
      return res.status(400).json({ error: 'fromDate must use YYYY-MM-DD format' });
    }
    if (toDate && !isValidDateString(toDate)) {
      return res.status(400).json({ error: 'toDate must use YYYY-MM-DD format' });
    }

    const events = await fetchPointEvents({ userId, fromDate, toDate, pillarId: null });
    const totalsByPillar = new Map();

    for (const event of events) {
      if (!Array.isArray(event.allocations)) {
        continue;
      }
      for (const allocation of event.allocations) {
        if (!allocation || typeof allocation !== 'object') {
          continue;
        }
        const pillarId = typeof allocation.pillarId === 'string' ? allocation.pillarId : null;
        const points = Number.isFinite(allocation.points) ? allocation.points : 0;
        if (!pillarId || points <= 0) {
          continue;
        }

        const current = totalsByPillar.get(pillarId) || 0;
        totalsByPillar.set(pillarId, current + points);
      }
    }

    const totals = [...totalsByPillar.entries()].map(([pillarId, points]) => ({
      pillarId,
      points
    }));

    return res.json({ totals });
  } catch (error) {
    console.error('[point-events] GET /rollup error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('pointEvents').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'PointEvent not found' });
    }

    const data = doc.data();
    if (data.userId !== req.user.uid) {
      return res.status(404).json({ error: 'PointEvent not found' });
    }

    return res.json(toResponseEvent({ id: doc.id, ...data }));
  } catch (error) {
    console.error('[point-events] GET /:id error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/:id/void', async (req, res) => {
  try {
    const docRef = db.collection('pointEvents').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'PointEvent not found' });
    }

    const data = doc.data();
    if (data.userId !== req.user.uid) {
      return res.status(404).json({ error: 'PointEvent not found' });
    }

    if (data.voidedAt) {
      return res.json(toResponseEvent({ id: doc.id, ...data }));
    }

    const now = nowSeconds();
    await docRef.update({
      voidedAt: now,
      updatedAt: now
    });

    return res.json(toResponseEvent({
      id: doc.id,
      ...data,
      voidedAt: now,
      updatedAt: now
    }));
  } catch (error) {
    console.error('[point-events] POST /:id/void error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
