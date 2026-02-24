const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveEventSource, writeUserEventSafe } = require('../services/events');
const {
  ACTION_TITLE_MAX_LENGTH,
  ACTION_NOTES_MAX_LENGTH,
  VALID_ACTION_STATUS,
  VALID_SECTION_IDS,
  nowTs,
  isValidDateString,
  todayDateUtc,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeStatus,
  normalizeSection,
  normalizeOrder,
  normalizeActionSource,
  cadenceAppliesToDate,
  deterministicActionIdFromTemplate,
  normalizeBounties,
  classifyBountiesFromText,
  reconcileActionPointEventWrite,
  normalizePointEventSource,
  voidActionPointEvent
} = require('../services/actionsDomain');

const router = express.Router();
router.use(flexibleAuth);

const VALID_STATUS_FILTER = new Set([...VALID_ACTION_STATUS, 'all']);

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return defaultValue;
}

function normalizeTemplateId(rawTemplateId) {
  if (rawTemplateId === undefined || rawTemplateId === null || rawTemplateId === '') {
    return null;
  }
  if (typeof rawTemplateId !== 'string') {
    return null;
  }
  const trimmed = rawTemplateId.trim();
  return trimmed || null;
}

function sortActions(actions) {
  return [...actions].sort((a, b) => {
    const sectionA = typeof a.sectionId === 'string' ? a.sectionId : 'afternoon';
    const sectionB = typeof b.sectionId === 'string' ? b.sectionId : 'afternoon';
    if (sectionA !== sectionB) {
      const sectionOrder = { morning: 0, afternoon: 1, evening: 2 };
      return (sectionOrder[sectionA] || 99) - (sectionOrder[sectionB] || 99);
    }

    const orderA = Number.isFinite(a.order) ? a.order : 0;
    const orderB = Number.isFinite(b.order) ? b.order : 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const createdA = Number.isFinite(a.createdAt) ? a.createdAt : 0;
    const createdB = Number.isFinite(b.createdAt) ? b.createdAt : 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function getTemplateOwnedByUser({ userId, templateId }) {
  const templateDoc = await db.collection('actionTemplates').doc(templateId).get();
  if (!templateDoc.exists) {
    return null;
  }

  const template = templateDoc.data() || {};
  if (template.userId !== userId) {
    return null;
  }

  return {
    id: templateDoc.id,
    ...template
  };
}

function templateActiveForDate(template, dateStr) {
  if (!template || typeof template !== 'object') {
    return false;
  }

  if (template.archivedAt !== null && template.archivedAt !== undefined) {
    return false;
  }

  if (template.isActive === false) {
    return false;
  }

  if (typeof template.startDate === 'string' && template.startDate && dateStr < template.startDate) {
    return false;
  }

  if (typeof template.endDate === 'string' && template.endDate && dateStr > template.endDate) {
    return false;
  }

  return cadenceAppliesToDate(template.cadence, dateStr);
}

function buildSpawnedActionPayload({ template, userId, dateStr, now }) {
  return {
    id: deterministicActionIdFromTemplate(template.id, dateStr),
    userId,
    title: typeof template.title === 'string' ? template.title : 'Action',
    notes: typeof template.notes === 'string' ? template.notes : null,
    status: 'pending',
    targetDate: dateStr,
    sectionId: VALID_SECTION_IDS.has(template.defaultSectionId) ? template.defaultSectionId : 'afternoon',
    order: Number.isFinite(template.defaultOrder) ? Math.trunc(template.defaultOrder) : 0,
    templateId: template.id,
    bounties: Array.isArray(template.defaultBounties) ? template.defaultBounties : [],
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    source: 'template'
  };
}

async function ensureActionsForDate({ userId, dateStr }) {
  let templates = [];
  try {
    const snapshot = await db.collection('actionTemplates')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .where('archivedAt', '==', null)
      .get();

    templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await db.collection('actionTemplates')
      .where('userId', '==', userId)
      .get();

    templates = fallback.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(template => template.isActive !== false)
      .filter(template => template.archivedAt === null || template.archivedAt === undefined);
  }

  let created = 0;
  const now = nowTs();

  for (const template of templates) {
    if (!templateActiveForDate(template, dateStr)) {
      continue;
    }

    const actionId = deterministicActionIdFromTemplate(template.id, dateStr);
    const payload = buildSpawnedActionPayload({ template, userId, dateStr, now });

    try {
      await db.collection('actions').doc(actionId).create(payload);
      created += 1;
    } catch (error) {
      const alreadyExists = error?.code === 6 || `${error?.message || ''}`.toLowerCase().includes('already exists');
      if (!alreadyExists) {
        throw error;
      }
    }
  }

  return created;
}

async function listActionsForDate({ userId, dateStr, statusFilter, sectionIdFilter }) {
  let query = db.collection('actions')
    .where('userId', '==', userId)
    .where('targetDate', '==', dateStr)
    .where('archivedAt', '==', null);

  if (statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }

  if (sectionIdFilter) {
    query = query.where('sectionId', '==', sectionIdFilter);
  }

  try {
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallbackSnapshot = await db.collection('actions')
      .where('userId', '==', userId)
      .get();

    return fallbackSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(action => action.archivedAt === null || action.archivedAt === undefined)
      .filter(action => action.targetDate === dateStr)
      .filter(action => (statusFilter === 'all' ? true : action.status === statusFilter))
      .filter(action => (sectionIdFilter ? action.sectionId === sectionIdFilter : true));
  }
}

router.get('/by-date/:date', async (req, res) => {
  try {
    const userId = req.user.uid;
    const dateStr = typeof req.params.date === 'string' ? req.params.date.trim() : '';
    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
    }

    const ensure = toBoolean(req.query.ensure, false);

    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
    if (!VALID_STATUS_FILTER.has(rawStatus)) {
      return res.status(400).json({ error: 'status must be pending, completed, skipped, canceled, or all' });
    }

    const rawSection = req.query.sectionId;
    const sectionId = rawSection === undefined
      ? null
      : normalizeSection(rawSection, null);

    if (rawSection !== undefined && !sectionId) {
      return res.status(400).json({ error: 'sectionId must be morning, afternoon, or evening' });
    }

    const ensuredCreatedCount = ensure
      ? await ensureActionsForDate({ userId, dateStr })
      : 0;

    const actions = await listActionsForDate({
      userId,
      dateStr,
      statusFilter: rawStatus,
      sectionIdFilter: sectionId
    });

    return res.json({
      date: dateStr,
      ensure,
      ensuredCreatedCount,
      items: sortActions(actions),
      count: actions.length
    });
  } catch (error) {
    console.error('[actions] GET /by-date/:date error:', error);
    return res.status(error?.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { body } = req;

    const titleResult = normalizeRequiredString(body?.title, {
      fieldName: 'title',
      maxLength: ACTION_TITLE_MAX_LENGTH
    });
    if (titleResult.error) {
      return res.status(400).json({ error: titleResult.error });
    }

    const notes = normalizeOptionalString(body?.notes, ACTION_NOTES_MAX_LENGTH);

    const status = normalizeStatus(body?.status, 'pending');
    if (!status) {
      return res.status(400).json({ error: 'status must be pending, completed, skipped, or canceled' });
    }

    const targetDate = body?.targetDate === undefined || body?.targetDate === null || body?.targetDate === ''
      ? todayDateUtc()
      : (typeof body.targetDate === 'string' ? body.targetDate.trim() : null);
    if (!targetDate || !isValidDateString(targetDate)) {
      return res.status(400).json({ error: 'targetDate must use YYYY-MM-DD format' });
    }

    const sectionId = normalizeSection(body?.sectionId, 'afternoon');
    if (!sectionId) {
      return res.status(400).json({ error: 'sectionId must be morning, afternoon, or evening' });
    }

    const order = normalizeOrder(body?.order, 0);
    if (order === null) {
      return res.status(400).json({ error: 'order must be a number' });
    }

    const templateId = normalizeTemplateId(body?.templateId);
    if (body?.templateId !== undefined && !templateId) {
      return res.status(400).json({ error: 'templateId must be a non-empty string or null' });
    }

    if (templateId) {
      const template = await getTemplateOwnedByUser({ userId, templateId });
      if (!template) {
        return res.status(404).json({ error: 'ActionTemplate not found' });
      }
    }

    let bounties = null;
    let classificationSummary = null;

    if (Array.isArray(body?.bounties)) {
      const bountyResult = await normalizeBounties({
        db,
        userId,
        rawBounties: body.bounties,
        fieldName: 'bounties'
      });
      if (bountyResult.error) {
        return res.status(400).json({ error: bountyResult.error });
      }
      bounties = bountyResult.value;
    } else if (body?.bounties === null || body?.bounties === undefined) {
      const classified = await classifyBountiesFromText({
        db,
        userId,
        title: titleResult.value,
        notes
      });
      bounties = classified.bounties;
      classificationSummary = classified.summary;
    } else {
      return res.status(400).json({ error: 'bounties must be an array when provided' });
    }

    const now = nowTs();
    const source = normalizeActionSource(body?.source, req.user?.source);

    const docRef = db.collection('actions').doc();
    const payload = {
      id: docRef.id,
      userId,
      title: titleResult.value,
      notes,
      status,
      targetDate,
      sectionId,
      order,
      templateId,
      bounties,
      completedAt: status === 'completed' ? now : null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      source
    };

    await docRef.set(payload);

    await reconcileActionPointEventWrite({
      db,
      actionId: docRef.id,
      before: null,
      after: payload,
      source: normalizePointEventSource(source)
    });

    const eventSource = resolveEventSource({
      explicitSource: body?.eventSource,
      authSource: req.user?.source
    });

    const eventType = status === 'completed' ? 'action.completed' : 'action.created';
    await writeUserEventSafe({
      userId,
      type: eventType,
      source: eventSource,
      refId: payload.id,
      refType: 'action',
      timestamp: now,
      metadata: {
        status: payload.status,
        targetDate: payload.targetDate,
        sectionId: payload.sectionId,
        templateId: payload.templateId
      }
    });

    return res.status(201).json({
      action: payload,
      classificationSummary
    });
  } catch (error) {
    console.error('[actions] POST / error:', error);
    return res.status(error?.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('actions').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const action = doc.data() || {};
    if (action.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Action not found' });
    }

    return res.json({ action: { id: doc.id, ...action } });
  } catch (error) {
    console.error('[actions] GET /:id error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const actionRef = db.collection('actions').doc(req.params.id);
    const actionDoc = await actionRef.get();

    if (!actionDoc.exists) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const existing = { id: actionDoc.id, ...(actionDoc.data() || {}) };
    if (existing.userId !== userId) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const patch = {};

    if (hasOwn(req.body, 'title')) {
      const titleResult = normalizeRequiredString(req.body.title, {
        fieldName: 'title',
        maxLength: ACTION_TITLE_MAX_LENGTH
      });
      if (titleResult.error) {
        return res.status(400).json({ error: titleResult.error });
      }
      patch.title = titleResult.value;
    }

    if (hasOwn(req.body, 'notes')) {
      if (req.body.notes === null || req.body.notes === undefined) {
        patch.notes = null;
      } else if (typeof req.body.notes !== 'string') {
        return res.status(400).json({ error: 'notes must be a string or null' });
      } else {
        patch.notes = normalizeOptionalString(req.body.notes, ACTION_NOTES_MAX_LENGTH);
      }
    }

    if (hasOwn(req.body, 'status')) {
      const status = normalizeStatus(req.body.status, null);
      if (!status) {
        return res.status(400).json({ error: 'status must be pending, completed, skipped, or canceled' });
      }
      patch.status = status;
    }

    if (hasOwn(req.body, 'targetDate')) {
      if (req.body.targetDate === null || req.body.targetDate === undefined || req.body.targetDate === '') {
        patch.targetDate = todayDateUtc();
      } else if (typeof req.body.targetDate !== 'string' || !isValidDateString(req.body.targetDate.trim())) {
        return res.status(400).json({ error: 'targetDate must use YYYY-MM-DD format' });
      } else {
        patch.targetDate = req.body.targetDate.trim();
      }
    }

    if (hasOwn(req.body, 'sectionId')) {
      const sectionId = normalizeSection(req.body.sectionId, null);
      if (!sectionId) {
        return res.status(400).json({ error: 'sectionId must be morning, afternoon, or evening' });
      }
      patch.sectionId = sectionId;
    }

    if (hasOwn(req.body, 'order')) {
      const order = normalizeOrder(req.body.order, null);
      if (order === null) {
        return res.status(400).json({ error: 'order must be a number' });
      }
      patch.order = order;
    }

    if (hasOwn(req.body, 'templateId')) {
      const templateId = normalizeTemplateId(req.body.templateId);
      if (req.body.templateId !== null && !templateId) {
        return res.status(400).json({ error: 'templateId must be a non-empty string or null' });
      }
      if (templateId) {
        const template = await getTemplateOwnedByUser({ userId, templateId });
        if (!template) {
          return res.status(404).json({ error: 'ActionTemplate not found' });
        }
      }
      patch.templateId = templateId;
    }

    if (hasOwn(req.body, 'source')) {
      patch.source = normalizeActionSource(req.body.source, req.user?.source, existing.source || 'user');
    }

    let classificationSummary = null;
    if (hasOwn(req.body, 'bounties')) {
      if (Array.isArray(req.body.bounties)) {
        const bountyResult = await normalizeBounties({
          db,
          userId,
          rawBounties: req.body.bounties,
          fieldName: 'bounties'
        });
        if (bountyResult.error) {
          return res.status(400).json({ error: bountyResult.error });
        }
        patch.bounties = bountyResult.value;
      } else if (req.body.bounties === null) {
        const titleForClassification = hasOwn(patch, 'title') ? patch.title : existing.title;
        const notesForClassification = hasOwn(patch, 'notes') ? patch.notes : existing.notes;
        const classified = await classifyBountiesFromText({
          db,
          userId,
          title: titleForClassification,
          notes: notesForClassification
        });
        patch.bounties = classified.bounties;
        classificationSummary = classified.summary;
      } else {
        return res.status(400).json({ error: 'bounties must be an array or null' });
      }
    }

    const beforeStatus = normalizeStatus(existing.status, 'pending');
    const nextStatus = hasOwn(patch, 'status') ? patch.status : beforeStatus;
    const now = nowTs();

    if (beforeStatus !== 'completed' && nextStatus === 'completed') {
      patch.completedAt = now;
    } else if (beforeStatus === 'completed' && nextStatus !== 'completed') {
      patch.completedAt = null;
    }

    if (Object.keys(patch).length === 0) {
      return res.json({ action: existing, classificationSummary });
    }

    patch.updatedAt = now;

    const merged = {
      ...existing,
      ...patch
    };

    await actionRef.set(patch, { merge: true });

    await reconcileActionPointEventWrite({
      db,
      actionId: existing.id,
      before: existing,
      after: merged,
      source: normalizePointEventSource(merged.source || existing.source || 'system')
    });

    const eventSource = resolveEventSource({
      explicitSource: req.body?.eventSource,
      authSource: req.user?.source
    });

    let eventType = 'action.updated';
    if (beforeStatus !== 'completed' && nextStatus === 'completed') {
      eventType = 'action.completed';
    } else if (beforeStatus === 'completed' && nextStatus !== 'completed') {
      eventType = 'action.reopened';
    }

    await writeUserEventSafe({
      userId,
      type: eventType,
      source: eventSource,
      refId: merged.id,
      refType: 'action',
      timestamp: now,
      metadata: {
        status: merged.status,
        targetDate: merged.targetDate,
        sectionId: merged.sectionId,
        templateId: merged.templateId
      }
    });

    return res.json({
      action: merged,
      classificationSummary
    });
  } catch (error) {
    console.error('[actions] PATCH /:id error:', error);
    return res.status(error?.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const actionRef = db.collection('actions').doc(req.params.id);
    const actionDoc = await actionRef.get();

    if (!actionDoc.exists) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const existing = { id: actionDoc.id, ...(actionDoc.data() || {}) };
    if (existing.userId !== userId) {
      return res.status(404).json({ error: 'Action not found' });
    }

    if (existing.archivedAt !== null && existing.archivedAt !== undefined) {
      return res.json({ action: existing });
    }

    const now = nowTs();
    const patch = {
      archivedAt: now,
      updatedAt: now
    };

    const merged = {
      ...existing,
      ...patch
    };

    await actionRef.set(patch, { merge: true });

    await voidActionPointEvent({
      db,
      actionId: existing.id,
      userId,
      now
    });

    const eventSource = resolveEventSource({
      explicitSource: req.body?.eventSource,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: 'action.archived',
      source: eventSource,
      refId: merged.id,
      refType: 'action',
      timestamp: now,
      metadata: {
        status: merged.status,
        targetDate: merged.targetDate,
        sectionId: merged.sectionId,
        templateId: merged.templateId
      }
    });

    return res.json({ action: merged });
  } catch (error) {
    console.error('[actions] DELETE /:id error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
