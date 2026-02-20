const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { getBlockTypeById, listBlockTypesForUser, nowTs } = require('../services/blockTypes');
const { validateDataAgainstSchema } = require('../utils/blockInstanceValidation');
const { createValidationError, isPlainObject } = require('../utils/blockTypeValidation');
const { resolveValidatedPillarId, createInvalidPillarIdError } = require('../utils/pillarValidation');

const router = express.Router();
router.use(flexibleAuth);

const CANONICAL_SECTIONS = Object.freeze(['morning', 'afternoon', 'evening']);
const DAY_TEMPLATE_SKIP_TYPE_IDS = new Set(['todo', 'todos', 'habits', 'morninghabits']);
const LEGACY_PROJECTED_TYPE_SET = new Set(['todo', 'todos', 'habits', 'morninghabits']);
const DISABLED_DEFAULT_NATIVE_TYPE_SET = new Set(['sleep', 'feeling', 'workout', 'reflection']);
const BATCH_MODE_SET = new Set(['replace', 'append', 'merge']);
const BLOCK_SOURCE_SET = new Set(['template', 'user', 'clawdbot', 'auto-sync']);
const LEGACY_BATCH_SUCCESSOR_ENDPOINT = '/api/plan/by-date/:date';
const LEGACY_BATCH_SUNSET_HTTP_DATE = 'Tue, 31 Mar 2026 00:00:00 GMT';
const LEGACY_BATCH_DEPRECATION = Object.freeze({
  deprecated: true,
  replacement: LEGACY_BATCH_SUCCESSOR_ENDPOINT,
  sunsetAt: '2026-03-31'
});

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateStringToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function respondError(res, error) {
  if (error?.status) {
    const payload = { error: error.message };
    if (error.details && typeof error.details === 'object') {
      payload.details = error.details;
    }
    return res.status(error.status).json(payload);
  }

  console.error('[days] route error:', error);
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

function defaultDataForType(typeId) {
  switch (typeId) {
    case 'sleep':
      return { score: 0, quality: 3, durationHours: 8, source: 'manual' };
    case 'feeling':
      return { energy: 5, mood: 5, stress: 5 };
    case 'workout':
      return { type: '', duration: '', notes: '', source: 'manual' };
    case 'reflection':
      return { freeText: '' };
    default:
      return {};
  }
}

function normalizeSection(sectionId) {
  if (typeof sectionId !== 'string') {
    return null;
  }

  const normalized = sectionId.trim().toLowerCase();
  if (!CANONICAL_SECTIONS.includes(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeBatchMode(mode) {
  if (mode === undefined || mode === null || mode === '') {
    return 'replace';
  }

  if (typeof mode !== 'string') {
    throw createValidationError('mode must be replace, append, or merge');
  }

  const normalized = mode.trim().toLowerCase();
  if (!BATCH_MODE_SET.has(normalized)) {
    throw createValidationError('mode must be replace, append, or merge');
  }

  return normalized;
}

function normalizeOptionalString(value, field, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw createValidationError(`${field} is too long (max ${maxLength})`);
  }

  return trimmed;
}

function normalizeBatchTypeId(typeId) {
  if (typeof typeId !== 'string' || !typeId.trim()) {
    throw createValidationError('blocks[].typeId is required');
  }

  return typeId.trim();
}

function isLegacyProjectedType(typeId) {
  if (typeof typeId !== 'string') {
    return false;
  }
  return LEGACY_PROJECTED_TYPE_SET.has(typeId.trim().toLowerCase());
}

function isDisabledDefaultNativeType(typeId) {
  if (typeof typeId !== 'string') {
    return false;
  }
  return DISABLED_DEFAULT_NATIVE_TYPE_SET.has(typeId.trim().toLowerCase());
}

function normalizeBatchSource(source) {
  if (source === undefined || source === null) {
    return 'clawdbot';
  }

  if (typeof source !== 'string') {
    throw createValidationError('blocks[].source must be a string');
  }

  const normalized = source.trim();
  if (!BLOCK_SOURCE_SET.has(normalized)) {
    throw createValidationError('blocks[].source must be template, user, clawdbot, or auto-sync');
  }

  return normalized;
}

function normalizeBatchOrder(order) {
  const parsed = Number(order);
  if (!Number.isFinite(parsed)) {
    throw createValidationError('blocks[].order must be a number');
  }
  return Math.trunc(parsed);
}

function normalizeBatchData(data) {
  if (data === undefined || data === null) {
    return null;
  }

  if (!isPlainObject(data)) {
    throw createValidationError('blocks[].data must be an object when provided');
  }

  return data;
}

function sortBlocksForMerge(items) {
  return [...items].sort((a, b) => {
    const orderA = Number.isFinite(a.order) ? a.order : 0;
    const orderB = Number.isFinite(b.order) ? b.order : 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const createdA = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const createdB = typeof b.createdAt === 'number' ? b.createdAt : 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

function mergeMatchKey(sectionId, typeId) {
  return `${sectionId}::${typeId}`;
}

async function resolvePillarIdOrThrow({ userId, pillarId }) {
  try {
    return await resolveValidatedPillarId({ db, userId, pillarId });
  } catch (error) {
    if (error?.message === createInvalidPillarIdError().message) {
      throw createValidationError('Invalid pillarId');
    }
    throw error;
  }
}

async function listStoredDayBlocks({ userId, date }) {
  const snapshot = await db.collection('dayBlocks')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .get();

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(block => !isLegacyProjectedType(block.typeId) && !isDisabledDefaultNativeType(block.typeId));
}

function blocksToDayShape({ userId, date, blocks }) {
  const sections = CANONICAL_SECTIONS.map(sectionId => ({ id: sectionId, blocks: [] }));
  const sectionMap = new Map(sections.map(section => [section.id, section]));

  const sorted = [...blocks].sort((a, b) => {
    const sectionA = CANONICAL_SECTIONS.indexOf(a.sectionId);
    const sectionB = CANONICAL_SECTIONS.indexOf(b.sectionId);
    if (sectionA !== sectionB) {
      return sectionA - sectionB;
    }

    const orderA = Number.isFinite(a.order) ? a.order : 0;
    const orderB = Number.isFinite(b.order) ? b.order : 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return String(a.id).localeCompare(String(b.id));
  });

  sorted.forEach(block => {
    const section = sectionMap.get(block.sectionId);
    if (section) {
      section.blocks.push(block);
    }
  });

  const createdAtValues = blocks.map(block => (typeof block.createdAt === 'number' ? block.createdAt : null)).filter(v => v !== null);
  const updatedAtValues = blocks.map(block => (typeof block.updatedAt === 'number' ? block.updatedAt : null)).filter(v => v !== null);

  return {
    id: `day_${userId}_${date}`,
    userId,
    date,
    sections,
    createdAt: createdAtValues.length ? Math.min(...createdAtValues) : null,
    updatedAt: updatedAtValues.length ? Math.max(...updatedAtValues) : null
  };
}

async function resolveTemplate({ userId, templateId }) {
  if (!templateId) {
    throw createValidationError('templateId is required. Default template generation has been disabled.');
  }

  const templateDoc = await db.collection('dayTemplates').doc(templateId).get();
  if (!templateDoc.exists) {
    throw createValidationError('Template not found');
  }

  const template = templateDoc.data() || {};
  if (template.userId !== userId) {
    throw createValidationError('Template not found');
  }

  return {
    source: 'requested-template',
    template: {
      id: templateDoc.id,
      ...template
    }
  };
}

function normalizeTemplateEntries(template) {
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  const entries = [];

  sections.forEach(section => {
    const sectionId = normalizeSection(section?.id);
    if (!sectionId) {
      return;
    }

    const sectionEntries = Array.isArray(section.entries) ? section.entries : [];
    sectionEntries.forEach((entry, index) => {
      const typeIdRaw = typeof entry?.blockTypeId === 'string'
        ? entry.blockTypeId
        : (typeof entry?.typeId === 'string' ? entry.typeId : null);

      if (!typeIdRaw) {
        return;
      }

      const typeId = typeIdRaw.trim();
      if (!typeId) {
        return;
      }

      const order = Number.isFinite(entry?.order)
        ? Math.trunc(entry.order)
        : index;

      entries.push({
        sectionId,
        typeId,
        order,
        data: isPlainObject(entry?.data) ? entry.data : null,
        title: typeof entry?.title === 'string' ? entry.title.trim() || null : null,
        subtitle: typeof entry?.subtitle === 'string' ? entry.subtitle.trim() || null : null,
        icon: typeof entry?.icon === 'string' ? entry.icon.trim() || null : null,
        pillarId: entry?.pillarId
      });
    });
  });

  return entries;
}

function normalizeBatchBlocks(rawBlocks, options = {}) {
  const required = options.required !== false;
  if (rawBlocks === undefined) {
    if (required) {
      throw createValidationError('blocks is required and must be an array');
    }
    return [];
  }

  if (!Array.isArray(rawBlocks)) {
    throw createValidationError('blocks is required and must be an array');
  }

  return rawBlocks.map((block, index) => {
    if (!isPlainObject(block)) {
      throw createValidationError(`blocks[${index}] must be an object`);
    }

    const typeId = normalizeBatchTypeId(block.typeId);
    if (isLegacyProjectedType(typeId)) {
      throw createValidationError(
        `blocks[${index}].typeId cannot be todo/habits. Create primitives via /api/todos or /api/habits.`
      );
    }
    if (isDisabledDefaultNativeType(typeId)) {
      throw createValidationError(
        `blocks[${index}].typeId ${typeId} is disabled. Default day-native block types are removed.`
      );
    }

    const sectionId = normalizeSection(block.sectionId);
    if (!sectionId) {
      throw createValidationError(`blocks[${index}].sectionId must be morning, afternoon, or evening`);
    }

    return {
      typeId,
      sectionId,
      order: normalizeBatchOrder(block.order),
      isExpanded: Object.prototype.hasOwnProperty.call(block, 'isExpanded')
        ? Boolean(block.isExpanded)
        : false,
      title: normalizeOptionalString(block.title, `blocks[${index}].title`, 200),
      subtitle: normalizeOptionalString(block.subtitle, `blocks[${index}].subtitle`, 500),
      icon: normalizeOptionalString(block.icon, `blocks[${index}].icon`, 40),
      pillarId: Object.prototype.hasOwnProperty.call(block, 'pillarId')
        ? block.pillarId
        : null,
      source: normalizeBatchSource(block.source),
      data: normalizeBatchData(block.data)
    };
  });
}

function normalizeBatchDeleteBlockId(value, fieldPath) {
  if (typeof value !== 'string') {
    throw createValidationError(`${fieldPath} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createValidationError(`${fieldPath} is required`);
  }

  if (trimmed.startsWith('proj_todo_') || trimmed.startsWith('proj_habit_')) {
    throw createValidationError(
      `${fieldPath} cannot reference projected blocks. Use DELETE /api/days/:date/blocks/:blockId.`
    );
  }

  return trimmed;
}

function normalizeBatchDeletes(rawDeletes) {
  if (rawDeletes === undefined) {
    return [];
  }

  if (!Array.isArray(rawDeletes)) {
    throw createValidationError('deletes must be an array when provided');
  }

  const normalized = rawDeletes.map((entry, index) => {
    if (typeof entry === 'string') {
      return normalizeBatchDeleteBlockId(entry, `deletes[${index}]`);
    }

    if (!isPlainObject(entry)) {
      throw createValidationError(`deletes[${index}] must be a string or an object`);
    }

    if (!Object.prototype.hasOwnProperty.call(entry, 'blockId')) {
      throw createValidationError(`deletes[${index}].blockId is required`);
    }

    return normalizeBatchDeleteBlockId(entry.blockId, `deletes[${index}].blockId`);
  });

  return Array.from(new Set(normalized));
}

// GET /api/days/today
router.get('/today', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = typeof req.query.date === 'string' ? req.query.date : dateStringToday();

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const blocks = await listStoredDayBlocks({ userId, date });
    const day = blocksToDayShape({ userId, date, blocks });

    return res.json({
      ...day,
      exists: blocks.length > 0
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// GET /api/days/by-date/:date
router.get('/by-date/:date', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const blocks = await listStoredDayBlocks({ userId, date });
    const day = blocksToDayShape({ userId, date, blocks });

    return res.json({
      ...day,
      exists: blocks.length > 0
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// POST /api/days/:date/blocks/batch
router.post('/:date/blocks/batch', async (req, res) => {
  try {
    res.set('Deprecation', 'true');
    res.set('Sunset', LEGACY_BATCH_SUNSET_HTTP_DATE);
    res.set('Link', `<${LEGACY_BATCH_SUCCESSOR_ENDPOINT}>; rel="successor-version"`);
    res.set('Warning', '299 - "Deprecated endpoint. Use POST /api/plan/by-date/:date"');

    const userId = req.user.uid;
    const date = req.params.date;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    if (!isPlainObject(req.body)) {
      throw createValidationError('Request body must be an object');
    }

    const hasBlocksField = Object.prototype.hasOwnProperty.call(req.body, 'blocks');
    let mode = normalizeBatchMode(req.body.mode);
    const incomingBlocks = normalizeBatchBlocks(req.body.blocks, { required: false });
    const incomingDeletes = normalizeBatchDeletes(req.body.deletes);

    if (!hasBlocksField && incomingDeletes.length > 0 && req.body.mode === undefined) {
      mode = 'merge';
    }

    if (mode === 'replace' && !hasBlocksField) {
      throw createValidationError('blocks is required when mode is replace');
    }

    if (!hasBlocksField && incomingDeletes.length === 0) {
      throw createValidationError('At least one of blocks or deletes must be provided');
    }

    const existing = await listStoredDayBlocks({ userId, date });
    const existingById = new Map(existing.map(block => [block.id, block]));
    const deleteTargetIds = incomingDeletes.filter(blockId => existingById.has(blockId));
    const deleteTargetIdSet = new Set(deleteTargetIds);
    const missingDeleteIds = incomingDeletes.filter(blockId => !existingById.has(blockId));
    const typeMap = new Map(
      (await listBlockTypesForUser({ db, userId, ensureBuiltins: true }))
        .map(type => [type.id, type])
    );

    const batch = db.batch();
    const timestamp = nowTs();
    let created = 0;
    let updated = 0;
    let deleted = 0;

    const buildValidatedBlockPayload = async (entry) => {
      const blockType = typeMap.get(entry.typeId)
        || await getBlockTypeById({ db, userId, typeId: entry.typeId, ensureBuiltins: false });
      if (!blockType) {
        throw createValidationError(`Unknown block type: ${entry.typeId}`);
      }

      const data = validateDataAgainstSchema(
        entry.data || defaultDataForType(entry.typeId),
        blockType
      );

      const pillarId = await resolvePillarIdOrThrow({ userId, pillarId: entry.pillarId });

      return {
        userId,
        date,
        typeId: entry.typeId,
        sectionId: entry.sectionId,
        order: entry.order,
        isExpanded: entry.isExpanded,
        title: entry.title,
        subtitle: entry.subtitle,
        icon: entry.icon,
        pillarId: pillarId ?? null,
        source: entry.source,
        data
      };
    };

    if (mode === 'replace') {
      existing.forEach(block => {
        batch.delete(db.collection('dayBlocks').doc(block.id));
      });
      deleted = existing.length;

      for (const entry of incomingBlocks) {
        const payload = await buildValidatedBlockPayload(entry);
        const ref = db.collection('dayBlocks').doc();
        batch.set(ref, {
          id: ref.id,
          ...payload,
          createdAt: timestamp,
          updatedAt: timestamp
        });
        created += 1;
      }
    } else if (mode === 'append') {
      for (const blockId of deleteTargetIds) {
        batch.delete(db.collection('dayBlocks').doc(blockId));
        deleted += 1;
      }

      for (const entry of incomingBlocks) {
        const payload = await buildValidatedBlockPayload(entry);
        const ref = db.collection('dayBlocks').doc();
        batch.set(ref, {
          id: ref.id,
          ...payload,
          createdAt: timestamp,
          updatedAt: timestamp
        });
        created += 1;
      }
    } else {
      for (const blockId of deleteTargetIds) {
        batch.delete(db.collection('dayBlocks').doc(blockId));
        deleted += 1;
      }

      const existingByMergeKey = new Map();
      sortBlocksForMerge(existing.filter(block => !deleteTargetIdSet.has(block.id))).forEach(block => {
        const key = mergeMatchKey(block.sectionId, block.typeId);
        if (!existingByMergeKey.has(key)) {
          existingByMergeKey.set(key, []);
        }
        existingByMergeKey.get(key).push(block);
      });

      for (const entry of incomingBlocks) {
        const payload = await buildValidatedBlockPayload(entry);
        const key = mergeMatchKey(entry.sectionId, entry.typeId);
        const matches = existingByMergeKey.get(key) || [];

        if (matches.length === 0) {
          const ref = db.collection('dayBlocks').doc();
          batch.set(ref, {
            id: ref.id,
            ...payload,
            createdAt: timestamp,
            updatedAt: timestamp
          });
          created += 1;
          continue;
        }

        const matched = matches.shift();
        batch.set(db.collection('dayBlocks').doc(matched.id), {
          id: matched.id,
          ...payload,
          createdAt: matched.createdAt ?? timestamp,
          updatedAt: timestamp
        }, { merge: true });
        updated += 1;
      }
    }

    await batch.commit();

    const finalBlocks = await listStoredDayBlocks({ userId, date });
    const day = blocksToDayShape({ userId, date, blocks: finalBlocks });
    const statusCode = created > 0 || deleted > 0 ? 201 : 200;

    return res.status(statusCode).json({
      date: day.date,
      sections: day.sections,
      created,
      updated,
      deleted,
      requestedDeletes: incomingDeletes.length,
      missingDeleteIds,
      deprecation: LEGACY_BATCH_DEPRECATION
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// POST /api/days/by-date/:date/generate
router.post('/by-date/:date/generate', async (req, res) => {
  try {
    const date = req.params.date;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    return res.status(410).json({
      error: 'Day generation endpoint has been disabled. Defaults are no longer auto-generated.',
      replacement: '/api/plan/by-date/:date'
    });
  } catch (error) {
    return respondError(res, error);
  }
});

module.exports = router;
