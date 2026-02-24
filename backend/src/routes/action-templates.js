const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveEventSource, writeUserEventSafe } = require('../services/events');
const {
  ACTION_TEMPLATE_TITLE_MAX_LENGTH,
  ACTION_TEMPLATE_NOTES_MAX_LENGTH,
  nowTs,
  isValidDateString,
  todayDateUtc,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeSection,
  normalizeOrder,
  normalizeCadence,
  normalizeBounties,
  classifyBountiesFromText
} = require('../services/actionsDomain');

const router = express.Router();
router.use(flexibleAuth);

const VALID_ARCHIVE_VISIBILITY = new Set(['exclude', 'include', 'only']);

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function parseArchiveVisibility(rawArchived) {
  if (rawArchived === undefined || rawArchived === null || rawArchived === '') {
    return 'exclude';
  }
  if (typeof rawArchived !== 'string') {
    return null;
  }
  const normalized = rawArchived.trim().toLowerCase();
  if (!VALID_ARCHIVE_VISIBILITY.has(normalized)) {
    return null;
  }
  return normalized;
}

function templateMatchesArchiveVisibility(template, archiveVisibility) {
  const archived = template.archivedAt !== null && template.archivedAt !== undefined;
  if (archiveVisibility === 'only') {
    return archived;
  }
  if (archiveVisibility === 'exclude') {
    return !archived;
  }
  return true;
}

function toBoolean(rawValue, defaultValue = false) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return defaultValue;
}

function normalizeDateOrNull(rawValue, fieldName) {
  if (rawValue === undefined) {
    return { provided: false, value: undefined };
  }
  if (rawValue === null || rawValue === '') {
    return { provided: true, value: null };
  }
  if (typeof rawValue !== 'string') {
    return { error: `${fieldName} must be a string in YYYY-MM-DD format or null` };
  }
  const trimmed = rawValue.trim();
  if (!isValidDateString(trimmed)) {
    return { error: `${fieldName} must use YYYY-MM-DD format` };
  }
  return { provided: true, value: trimmed };
}

async function listTemplatesByUser(userId) {
  try {
    const snapshot = await db.collection('actionTemplates')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await db.collection('actionTemplates')
      .where('userId', '==', userId)
      .get();

    return fallback.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aCreated = Number.isFinite(a.createdAt) ? a.createdAt : 0;
        const bCreated = Number.isFinite(b.createdAt) ? b.createdAt : 0;
        return aCreated - bCreated;
      });
  }
}

async function propagateTemplateChangesToActions({
  userId,
  templateId,
  updatedTemplate,
  changedFields,
  now
}) {
  if (!changedFields.length) {
    return 0;
  }

  const today = todayDateUtc();
  let actions = [];

  try {
    const snapshot = await db.collection('actions')
      .where('userId', '==', userId)
      .where('templateId', '==', templateId)
      .where('status', '==', 'pending')
      .where('archivedAt', '==', null)
      .get();

    actions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await db.collection('actions')
      .where('userId', '==', userId)
      .where('templateId', '==', templateId)
      .get();

    actions = fallback.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(action => action.status === 'pending')
      .filter(action => action.archivedAt === null || action.archivedAt === undefined);
  }

  const eligible = actions.filter(action => {
    if (!isValidDateString(action.targetDate)) {
      return false;
    }
    return action.targetDate >= today;
  });

  if (!eligible.length) {
    return 0;
  }

  const patchTemplate = {};
  if (changedFields.includes('title')) {
    patchTemplate.title = updatedTemplate.title;
  }
  if (changedFields.includes('notes')) {
    patchTemplate.notes = updatedTemplate.notes;
  }
  if (changedFields.includes('defaultSectionId')) {
    patchTemplate.sectionId = updatedTemplate.defaultSectionId;
  }
  if (changedFields.includes('defaultOrder')) {
    patchTemplate.order = updatedTemplate.defaultOrder;
  }
  if (changedFields.includes('defaultBounties')) {
    patchTemplate.bounties = updatedTemplate.defaultBounties;
  }

  if (!Object.keys(patchTemplate).length) {
    return 0;
  }

  let updatedCount = 0;
  let batch = db.batch();
  let operations = 0;

  for (const action of eligible) {
    const patch = {
      ...patchTemplate,
      updatedAt: now
    };

    batch.set(db.collection('actions').doc(action.id), patch, { merge: true });
    operations += 1;
    updatedCount += 1;

    if (operations >= 400) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }

  return updatedCount;
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const archiveVisibility = parseArchiveVisibility(req.query.archived);
    if (!archiveVisibility) {
      return res.status(400).json({ error: 'archived must be exclude, include, or only' });
    }

    const includeInactive = toBoolean(req.query.includeInactive, true);

    const templates = await listTemplatesByUser(userId);
    const filtered = templates
      .filter(template => templateMatchesArchiveVisibility(template, archiveVisibility))
      .filter(template => (includeInactive ? true : template.isActive !== false));

    return res.json({
      items: filtered,
      count: filtered.length
    });
  } catch (error) {
    console.error('[action-templates] GET / error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { body } = req;

    const titleResult = normalizeRequiredString(body?.title, {
      fieldName: 'title',
      maxLength: ACTION_TEMPLATE_TITLE_MAX_LENGTH
    });
    if (titleResult.error) {
      return res.status(400).json({ error: titleResult.error });
    }

    const notes = normalizeOptionalString(body?.notes, ACTION_TEMPLATE_NOTES_MAX_LENGTH);

    const cadenceResult = normalizeCadence(body?.cadence);
    if (cadenceResult.error) {
      return res.status(400).json({ error: cadenceResult.error });
    }

    const defaultSectionId = normalizeSection(body?.defaultSectionId, 'afternoon');
    if (!defaultSectionId) {
      return res.status(400).json({ error: 'defaultSectionId must be morning, afternoon, or evening' });
    }

    const defaultOrder = normalizeOrder(body?.defaultOrder, 0);
    if (defaultOrder === null) {
      return res.status(400).json({ error: 'defaultOrder must be a number' });
    }

    const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

    const startDateResult = normalizeDateOrNull(body?.startDate, 'startDate');
    if (startDateResult.error) {
      return res.status(400).json({ error: startDateResult.error });
    }

    const endDateResult = normalizeDateOrNull(body?.endDate, 'endDate');
    if (endDateResult.error) {
      return res.status(400).json({ error: endDateResult.error });
    }

    const startDate = startDateResult.provided ? startDateResult.value : null;
    const endDate = endDateResult.provided ? endDateResult.value : null;
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be less than or equal to endDate' });
    }

    let defaultBounties;
    let classificationSummary = null;

    if (Array.isArray(body?.defaultBounties)) {
      const bountyResult = await normalizeBounties({
        db,
        userId,
        rawBounties: body.defaultBounties,
        fieldName: 'defaultBounties'
      });
      if (bountyResult.error) {
        return res.status(400).json({ error: bountyResult.error });
      }
      defaultBounties = bountyResult.value;
    } else if (body?.defaultBounties === null || body?.defaultBounties === undefined) {
      const classified = await classifyBountiesFromText({
        db,
        userId,
        title: titleResult.value,
        notes
      });
      defaultBounties = classified.bounties;
      classificationSummary = classified.summary;
    } else {
      return res.status(400).json({ error: 'defaultBounties must be an array when provided' });
    }

    const now = nowTs();
    const templateRef = db.collection('actionTemplates').doc();

    const payload = {
      id: templateRef.id,
      userId,
      title: titleResult.value,
      notes,
      cadence: cadenceResult.value,
      defaultSectionId,
      defaultOrder,
      defaultBounties,
      isActive,
      startDate,
      endDate,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };

    await templateRef.set(payload);

    const eventSource = resolveEventSource({
      explicitSource: body?.eventSource,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: 'action-template.created',
      source: eventSource,
      refId: payload.id,
      refType: 'action-template',
      timestamp: now,
      metadata: {
        isActive: payload.isActive,
        cadence: payload.cadence,
        defaultSectionId: payload.defaultSectionId
      }
    });

    return res.status(201).json({
      actionTemplate: payload,
      classificationSummary
    });
  } catch (error) {
    console.error('[action-templates] POST / error:', error);
    return res.status(error?.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const templateRef = db.collection('actionTemplates').doc(req.params.id);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      return res.status(404).json({ error: 'ActionTemplate not found' });
    }

    const existing = { id: templateDoc.id, ...(templateDoc.data() || {}) };
    if (existing.userId !== userId) {
      return res.status(404).json({ error: 'ActionTemplate not found' });
    }

    const patch = {};
    const changedFields = [];

    if (hasOwn(req.body, 'title')) {
      const titleResult = normalizeRequiredString(req.body.title, {
        fieldName: 'title',
        maxLength: ACTION_TEMPLATE_TITLE_MAX_LENGTH
      });
      if (titleResult.error) {
        return res.status(400).json({ error: titleResult.error });
      }
      patch.title = titleResult.value;
      if (patch.title !== existing.title) {
        changedFields.push('title');
      }
    }

    if (hasOwn(req.body, 'notes')) {
      if (req.body.notes === null || req.body.notes === undefined) {
        patch.notes = null;
      } else if (typeof req.body.notes !== 'string') {
        return res.status(400).json({ error: 'notes must be a string or null' });
      } else {
        patch.notes = normalizeOptionalString(req.body.notes, ACTION_TEMPLATE_NOTES_MAX_LENGTH);
      }
      if (patch.notes !== existing.notes) {
        changedFields.push('notes');
      }
    }

    if (hasOwn(req.body, 'cadence')) {
      const cadenceResult = normalizeCadence(req.body.cadence, { partial: false });
      if (cadenceResult.error) {
        return res.status(400).json({ error: cadenceResult.error });
      }
      patch.cadence = cadenceResult.value;
    }

    if (hasOwn(req.body, 'defaultSectionId')) {
      const defaultSectionId = normalizeSection(req.body.defaultSectionId, null);
      if (!defaultSectionId) {
        return res.status(400).json({ error: 'defaultSectionId must be morning, afternoon, or evening' });
      }
      patch.defaultSectionId = defaultSectionId;
      if (patch.defaultSectionId !== existing.defaultSectionId) {
        changedFields.push('defaultSectionId');
      }
    }

    if (hasOwn(req.body, 'defaultOrder')) {
      const defaultOrder = normalizeOrder(req.body.defaultOrder, null);
      if (defaultOrder === null) {
        return res.status(400).json({ error: 'defaultOrder must be a number' });
      }
      patch.defaultOrder = defaultOrder;
      if (patch.defaultOrder !== existing.defaultOrder) {
        changedFields.push('defaultOrder');
      }
    }

    if (hasOwn(req.body, 'isActive')) {
      patch.isActive = Boolean(req.body.isActive);
    }

    if (hasOwn(req.body, 'startDate')) {
      const startDateResult = normalizeDateOrNull(req.body.startDate, 'startDate');
      if (startDateResult.error) {
        return res.status(400).json({ error: startDateResult.error });
      }
      patch.startDate = startDateResult.value;
    }

    if (hasOwn(req.body, 'endDate')) {
      const endDateResult = normalizeDateOrNull(req.body.endDate, 'endDate');
      if (endDateResult.error) {
        return res.status(400).json({ error: endDateResult.error });
      }
      patch.endDate = endDateResult.value;
    }

    const effectiveStartDate = hasOwn(patch, 'startDate') ? patch.startDate : existing.startDate;
    const effectiveEndDate = hasOwn(patch, 'endDate') ? patch.endDate : existing.endDate;
    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
      return res.status(400).json({ error: 'startDate must be less than or equal to endDate' });
    }

    let classificationSummary = null;
    if (hasOwn(req.body, 'defaultBounties')) {
      if (Array.isArray(req.body.defaultBounties)) {
        const bountyResult = await normalizeBounties({
          db,
          userId,
          rawBounties: req.body.defaultBounties,
          fieldName: 'defaultBounties'
        });
        if (bountyResult.error) {
          return res.status(400).json({ error: bountyResult.error });
        }
        patch.defaultBounties = bountyResult.value;
      } else if (req.body.defaultBounties === null) {
        const titleForClassification = hasOwn(patch, 'title') ? patch.title : existing.title;
        const notesForClassification = hasOwn(patch, 'notes') ? patch.notes : existing.notes;
        const classified = await classifyBountiesFromText({
          db,
          userId,
          title: titleForClassification,
          notes: notesForClassification
        });
        patch.defaultBounties = classified.bounties;
        classificationSummary = classified.summary;
      } else {
        return res.status(400).json({ error: 'defaultBounties must be an array or null' });
      }

      const bountiesBefore = JSON.stringify(existing.defaultBounties || []);
      const bountiesAfter = JSON.stringify(patch.defaultBounties || []);
      if (bountiesBefore !== bountiesAfter) {
        changedFields.push('defaultBounties');
      }
    } else {
      const titleForClassification = hasOwn(patch, 'title') ? patch.title : existing.title;
      const notesForClassification = hasOwn(patch, 'notes') ? patch.notes : existing.notes;
      const classified = await classifyBountiesFromText({
        db,
        userId,
        title: titleForClassification,
        notes: notesForClassification
      });
      patch.defaultBounties = classified.bounties;
      classificationSummary = classified.summary;

      const bountiesBefore = JSON.stringify(existing.defaultBounties || []);
      const bountiesAfter = JSON.stringify(patch.defaultBounties || []);
      if (bountiesBefore !== bountiesAfter) {
        changedFields.push('defaultBounties');
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.json({
        actionTemplate: existing,
        propagatedActionsCount: 0,
        classificationSummary
      });
    }

    const now = nowTs();
    patch.updatedAt = now;

    const merged = {
      ...existing,
      ...patch
    };

    await templateRef.set(patch, { merge: true });

    const propagatedActionsCount = await propagateTemplateChangesToActions({
      userId,
      templateId: existing.id,
      updatedTemplate: merged,
      changedFields,
      now
    });

    const eventSource = resolveEventSource({
      explicitSource: req.body?.eventSource,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: 'action-template.updated',
      source: eventSource,
      refId: merged.id,
      refType: 'action-template',
      timestamp: now,
      metadata: {
        isActive: merged.isActive,
        cadence: merged.cadence,
        defaultSectionId: merged.defaultSectionId,
        propagatedActionsCount
      }
    });

    return res.json({
      actionTemplate: merged,
      propagatedActionsCount,
      classificationSummary
    });
  } catch (error) {
    console.error('[action-templates] PATCH /:id error:', error);
    return res.status(error?.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const templateRef = db.collection('actionTemplates').doc(req.params.id);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      return res.status(404).json({ error: 'ActionTemplate not found' });
    }

    const existing = { id: templateDoc.id, ...(templateDoc.data() || {}) };
    if (existing.userId !== userId) {
      return res.status(404).json({ error: 'ActionTemplate not found' });
    }

    if (existing.archivedAt !== null && existing.archivedAt !== undefined) {
      return res.json({ actionTemplate: existing });
    }

    const now = nowTs();
    const patch = {
      archivedAt: now,
      updatedAt: now,
      isActive: false
    };

    const merged = {
      ...existing,
      ...patch
    };

    await templateRef.set(patch, { merge: true });

    const eventSource = resolveEventSource({
      explicitSource: req.body?.eventSource,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: 'action-template.deleted',
      source: eventSource,
      refId: merged.id,
      refType: 'action-template',
      timestamp: now,
      metadata: {
        isActive: merged.isActive
      }
    });

    return res.json({ actionTemplate: merged });
  } catch (error) {
    console.error('[action-templates] DELETE /:id error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
