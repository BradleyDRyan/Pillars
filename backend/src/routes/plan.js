const crypto = require('crypto');
const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { listBlockTypesForUser, nowTs } = require('../services/blockTypes');
const { validateDataAgainstSchema } = require('../utils/blockInstanceValidation');
const { createValidationError, isPlainObject } = require('../utils/blockTypeValidation');

const router = express.Router();
router.use(flexibleAuth);

const CANONICAL_SECTIONS = Object.freeze(['morning', 'afternoon', 'evening']);
const SECTION_RANK = Object.freeze({
  morning: 0,
  afternoon: 1,
  evening: 2
});
const BLOCK_SOURCE_SET = new Set(['template', 'user', 'clawdbot', 'auto-sync']);
const PLAN_MODE_SET = new Set(['replace', 'append', 'merge']);
const TODO_STATUS_SET = new Set(['active', 'completed']);
const TODO_BLOCK_TYPE_SET = new Set(['todo']);
const HABIT_BLOCK_TYPE_SET = new Set(['habits']);
const DISABLED_DEFAULT_NATIVE_TYPE_SET = new Set(['sleep', 'feeling', 'workout', 'reflection']);
const TODO_MUTABLE_FIELDS = new Set([
  'id',
  'clientId',
  'content',
  'description',
  'dueDate',
  'sectionId',
  'priority',
  'parentId',
  'status',
  'order',
  'labels',
  'pillarId'
]);
const DAY_NATIVE_MUTABLE_FIELDS = new Set([
  'typeId',
  'sectionId',
  'order',
  'isExpanded',
  'title',
  'subtitle',
  'icon',
  'pillarId',
  'source',
  'data'
]);
const TODO_PROJECTION_MUTABLE_FIELDS = new Set([
  'typeId',
  'sectionId',
  'order',
  'todoRef'
]);

function createConflictError(message, details = null) {
  const error = new Error(message);
  error.status = 409;
  if (details && typeof details === 'object') {
    error.details = details;
  }
  return error;
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function respondError(res, error) {
  if (error?.status) {
    const payload = { error: error.message };
    if (error.details && typeof error.details === 'object') {
      payload.details = error.details;
    }
    return res.status(error.status).json(payload);
  }

  console.error('[plan] route error:', error);
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

function normalizeSection(sectionId, fieldPath) {
  if (typeof sectionId !== 'string') {
    throw createValidationError(`${fieldPath} must be a string`);
  }

  const normalized = sectionId.trim().toLowerCase();
  if (!CANONICAL_SECTIONS.includes(normalized)) {
    throw createValidationError(`${fieldPath} must be morning, afternoon, or evening`);
  }

  return normalized;
}

function normalizeMode(mode) {
  if (mode === undefined || mode === null || mode === '') {
    return 'replace';
  }

  if (typeof mode !== 'string') {
    throw createValidationError('mode must be replace, append, or merge');
  }

  const normalized = mode.trim().toLowerCase();
  if (!PLAN_MODE_SET.has(normalized)) {
    throw createValidationError('mode must be replace, append, or merge');
  }

  return normalized;
}

function normalizeOptionalString(value, fieldPath, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${fieldPath} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw createValidationError(`${fieldPath} is too long (max ${maxLength})`);
  }

  return trimmed;
}

function normalizeRequiredString(value, fieldPath, maxLength) {
  if (typeof value !== 'string') {
    throw createValidationError(`${fieldPath} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createValidationError(`${fieldPath} is required`);
  }

  if (trimmed.length > maxLength) {
    throw createValidationError(`${fieldPath} is too long (max ${maxLength})`);
  }

  return trimmed;
}

function normalizeTypeId(typeId, fieldPath) {
  return normalizeRequiredString(typeId, fieldPath, 120);
}

function normalizeSource(source, fieldPath) {
  if (source === undefined || source === null) {
    return 'clawdbot';
  }

  if (typeof source !== 'string') {
    throw createValidationError(`${fieldPath} must be a string`);
  }

  const normalized = source.trim();
  if (!BLOCK_SOURCE_SET.has(normalized)) {
    throw createValidationError(`${fieldPath} must be template, user, clawdbot, or auto-sync`);
  }

  return normalized;
}

function normalizeOrder(order, fieldPath) {
  const parsed = Number(order);
  if (!Number.isFinite(parsed)) {
    throw createValidationError(`${fieldPath} must be a number`);
  }
  return Math.trunc(parsed);
}

function normalizeObjectData(value, fieldPath) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw createValidationError(`${fieldPath} must be an object when provided`);
  }

  return value;
}

function normalizeTodoLabels(rawLabels, fieldPath) {
  if (!Array.isArray(rawLabels)) {
    throw createValidationError(`${fieldPath} must be an array of strings`);
  }

  const deduped = [];
  rawLabels.forEach((item, index) => {
    if (typeof item !== 'string') {
      throw createValidationError(`${fieldPath}[${index}] must be a string`);
    }
    const normalized = item.trim();
    if (!normalized) {
      return;
    }
    if (!deduped.includes(normalized)) {
      deduped.push(normalized);
    }
  });

  return deduped;
}

function normalizeTodoUpsert(rawEntry, index) {
  if (!isPlainObject(rawEntry)) {
    throw createValidationError(`primitives.todos.upsert[${index}] must be an object`);
  }

  for (const key of Object.keys(rawEntry)) {
    if (!TODO_MUTABLE_FIELDS.has(key)) {
      throw createValidationError(`Unsupported primitives.todos.upsert[${index}] field: ${key}`);
    }
  }

  const provided = {};
  const normalized = {
    id: null,
    clientId: null,
    inputIndex: index,
    provided
  };

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'id')) {
    normalized.id = normalizeRequiredString(rawEntry.id, `primitives.todos.upsert[${index}].id`, 160);
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'clientId')) {
    normalized.clientId = normalizeRequiredString(rawEntry.clientId, `primitives.todos.upsert[${index}].clientId`, 160);
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'content')) {
    provided.content = true;
    normalized.content = normalizeRequiredString(rawEntry.content, `primitives.todos.upsert[${index}].content`, 500);
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'description')) {
    provided.description = true;
    if (rawEntry.description === null) {
      normalized.description = '';
    } else {
      normalized.description = normalizeOptionalString(
        rawEntry.description,
        `primitives.todos.upsert[${index}].description`,
        2000
      ) || '';
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'dueDate')) {
    provided.dueDate = true;
    if (rawEntry.dueDate === null || rawEntry.dueDate === '') {
      normalized.dueDate = null;
    } else if (!isValidDateString(rawEntry.dueDate)) {
      throw createValidationError(`primitives.todos.upsert[${index}].dueDate must use YYYY-MM-DD format`);
    } else {
      normalized.dueDate = rawEntry.dueDate;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'sectionId')) {
    provided.sectionId = true;
    normalized.sectionId = normalizeSection(rawEntry.sectionId, `primitives.todos.upsert[${index}].sectionId`);
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'priority')) {
    provided.priority = true;
    const parsedPriority = Number(rawEntry.priority);
    if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 4) {
      throw createValidationError(`primitives.todos.upsert[${index}].priority must be an integer between 1 and 4`);
    }
    normalized.priority = parsedPriority;
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'parentId')) {
    provided.parentId = true;
    if (rawEntry.parentId === null || rawEntry.parentId === '') {
      normalized.parentId = null;
    } else if (typeof rawEntry.parentId !== 'string') {
      throw createValidationError(`primitives.todos.upsert[${index}].parentId must be a string or null`);
    } else {
      normalized.parentId = rawEntry.parentId.trim() || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'status')) {
    provided.status = true;
    if (typeof rawEntry.status !== 'string') {
      throw createValidationError(`primitives.todos.upsert[${index}].status must be a string`);
    }
    const normalizedStatus = rawEntry.status.trim().toLowerCase();
    if (!TODO_STATUS_SET.has(normalizedStatus)) {
      throw createValidationError(`primitives.todos.upsert[${index}].status must be active or completed`);
    }
    normalized.status = normalizedStatus;
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'order')) {
    provided.order = true;
    normalized.order = normalizeOrder(rawEntry.order, `primitives.todos.upsert[${index}].order`);
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'labels')) {
    provided.labels = true;
    normalized.labels = normalizeTodoLabels(rawEntry.labels, `primitives.todos.upsert[${index}].labels`);
  }

  if (Object.prototype.hasOwnProperty.call(rawEntry, 'pillarId')) {
    provided.pillarId = true;
    normalized.pillarId = rawEntry.pillarId;
  }

  if (!normalized.id && !normalized.clientId) {
    throw createValidationError(`primitives.todos.upsert[${index}] must include id or clientId`);
  }

  return normalized;
}

function normalizeTodoRef(rawRef, index) {
  if (!isPlainObject(rawRef)) {
    throw createValidationError(`day.blocks[${index}].todoRef must be an object`);
  }

  for (const key of Object.keys(rawRef)) {
    if (key !== 'id' && key !== 'clientId') {
      throw createValidationError(`Unsupported day.blocks[${index}].todoRef field: ${key}`);
    }
  }

  const id = Object.prototype.hasOwnProperty.call(rawRef, 'id')
    ? normalizeRequiredString(rawRef.id, `day.blocks[${index}].todoRef.id`, 160)
    : null;
  const clientId = Object.prototype.hasOwnProperty.call(rawRef, 'clientId')
    ? normalizeRequiredString(rawRef.clientId, `day.blocks[${index}].todoRef.clientId`, 160)
    : null;

  if (!id && !clientId) {
    throw createValidationError(`day.blocks[${index}].todoRef must include id or clientId`);
  }

  return { id, clientId };
}

function normalizeDayBlock(rawBlock, index) {
  if (!isPlainObject(rawBlock)) {
    throw createValidationError(`day.blocks[${index}] must be an object`);
  }

  const typeId = normalizeTypeId(rawBlock.typeId, `day.blocks[${index}].typeId`);
  const normalizedType = typeId.toLowerCase();
  const sectionId = normalizeSection(rawBlock.sectionId, `day.blocks[${index}].sectionId`);
  const order = normalizeOrder(rawBlock.order, `day.blocks[${index}].order`);

  if (normalizedType === 'todos' || normalizedType === 'morninghabits') {
    throw createValidationError(
      `day.blocks[${index}].typeId legacy aliases are not supported. Use "todo" projection type and primitives.`
    );
  }

  if (HABIT_BLOCK_TYPE_SET.has(normalizedType)) {
    throw createValidationError('Habit projection blocks are not supported in /api/plan yet');
  }

  if (TODO_BLOCK_TYPE_SET.has(normalizedType)) {
    for (const key of Object.keys(rawBlock)) {
      if (!TODO_PROJECTION_MUTABLE_FIELDS.has(key)) {
        throw createValidationError(`Unsupported day.blocks[${index}] field for todo projection: ${key}`);
      }
    }

    return {
      kind: 'todo-projection',
      inputIndex: index,
      typeId: 'todo',
      sectionId,
      order,
      todoRef: normalizeTodoRef(rawBlock.todoRef, index)
    };
  }

  if (DISABLED_DEFAULT_NATIVE_TYPE_SET.has(normalizedType)) {
    throw createValidationError(
      `day.blocks[${index}].typeId ${normalizedType} is disabled. Default day-native blocks must be explicitly reintroduced via a dedicated endpoint.`
    );
  }

  for (const key of Object.keys(rawBlock)) {
    if (!DAY_NATIVE_MUTABLE_FIELDS.has(key)) {
      throw createValidationError(`Unsupported day.blocks[${index}] field: ${key}`);
    }
  }

  return {
    kind: 'day-native',
    inputIndex: index,
    typeId,
    sectionId,
    order,
    isExpanded: Object.prototype.hasOwnProperty.call(rawBlock, 'isExpanded')
      ? (() => {
        if (typeof rawBlock.isExpanded !== 'boolean') {
          throw createValidationError(`day.blocks[${index}].isExpanded must be a boolean`);
        }
        return rawBlock.isExpanded;
      })()
      : false,
    title: normalizeOptionalString(rawBlock.title, `day.blocks[${index}].title`, 200),
    subtitle: normalizeOptionalString(rawBlock.subtitle, `day.blocks[${index}].subtitle`, 500),
    icon: normalizeOptionalString(rawBlock.icon, `day.blocks[${index}].icon`, 40),
    pillarId: Object.prototype.hasOwnProperty.call(rawBlock, 'pillarId')
      ? rawBlock.pillarId
      : null,
    source: normalizeSource(rawBlock.source, `day.blocks[${index}].source`),
    data: normalizeObjectData(rawBlock.data, `day.blocks[${index}].data`)
  };
}

function normalizePlanPayload(body) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be an object');
  }

  for (const key of Object.keys(body)) {
    if (key !== 'mode' && key !== 'primitives' && key !== 'day') {
      throw createValidationError(`Unsupported request field: ${key}`);
    }
  }

  const mode = normalizeMode(body.mode);

  let todoUpsert = [];
  if (Object.prototype.hasOwnProperty.call(body, 'primitives')) {
    if (!isPlainObject(body.primitives)) {
      throw createValidationError('primitives must be an object');
    }

    for (const key of Object.keys(body.primitives)) {
      if (key !== 'todos') {
        throw createValidationError(`Unsupported primitives field: ${key}`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body.primitives, 'todos')) {
      if (!isPlainObject(body.primitives.todos)) {
        throw createValidationError('primitives.todos must be an object');
      }

      for (const key of Object.keys(body.primitives.todos)) {
        if (key !== 'upsert') {
          throw createValidationError(`Unsupported primitives.todos field: ${key}`);
        }
      }

      if (!Array.isArray(body.primitives.todos.upsert)) {
        throw createValidationError('primitives.todos.upsert must be an array');
      }

      const usedClientIds = new Set();
      todoUpsert = body.primitives.todos.upsert.map((item, index) => {
        const normalized = normalizeTodoUpsert(item, index);
        if (normalized.clientId) {
          if (usedClientIds.has(normalized.clientId)) {
            throw createValidationError(`Duplicate primitives.todos.upsert clientId: ${normalized.clientId}`);
          }
          usedClientIds.add(normalized.clientId);
        }
        return normalized;
      });
    }
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'day')) {
    throw createValidationError('day is required');
  }

  if (!isPlainObject(body.day)) {
    throw createValidationError('day must be an object');
  }

  for (const key of Object.keys(body.day)) {
    if (key !== 'blocks') {
      throw createValidationError(`Unsupported day field: ${key}`);
    }
  }

  if (!Array.isArray(body.day.blocks)) {
    throw createValidationError('day.blocks must be an array');
  }

  const blocks = body.day.blocks.map((block, index) => normalizeDayBlock(block, index));
  if (blocks.length === 0 && todoUpsert.length === 0) {
    throw createValidationError('At least one todo upsert or day block is required');
  }

  return {
    mode,
    primitives: {
      todos: {
        upsert: todoUpsert
      }
    },
    day: {
      blocks
    }
  };
}

function sortBlocks(items) {
  return [...items].sort((a, b) => {
    const sectionDiff = (SECTION_RANK[a.sectionId] ?? 99) - (SECTION_RANK[b.sectionId] ?? 99);
    if (sectionDiff !== 0) {
      return sectionDiff;
    }

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

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeIdempotencyKey(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  if (typeof rawValue !== 'string') {
    throw createValidationError('Idempotency-Key header must be a string');
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    throw createValidationError('Idempotency-Key header cannot be empty');
  }

  if (normalized.length > 200) {
    throw createValidationError('Idempotency-Key header is too long (max 200)');
  }

  return normalized;
}

function normalizePillarReference(rawValue, fieldPath) {
  if (rawValue === undefined) {
    return undefined;
  }
  if (rawValue === null) {
    return null;
  }
  if (typeof rawValue !== 'string') {
    throw createValidationError(`${fieldPath} must be a string or null`);
  }

  const normalized = rawValue.trim();
  return normalized || null;
}

function isLegacyProjectedType(typeId) {
  const normalized = typeof typeId === 'string' ? typeId.trim().toLowerCase() : '';
  return normalized === 'todo' || normalized === 'todos' || normalized === 'habits' || normalized === 'morninghabits';
}

function isDisabledDefaultNativeBlock(block) {
  if (!block || typeof block !== 'object') {
    return false;
  }

  const normalizedType = typeof block.typeId === 'string' ? block.typeId.trim().toLowerCase() : '';
  return DISABLED_DEFAULT_NATIVE_TYPE_SET.has(normalizedType);
}

function isTodoArchived(todo) {
  return todo?.archivedAt !== null && todo?.archivedAt !== undefined;
}

function buildTodoProjectionBlock({ userId, date, todo }) {
  return {
    id: `proj_todo_${todo.id}`,
    userId,
    date,
    typeId: 'todo',
    sectionId: typeof todo.sectionId === 'string' ? todo.sectionId : 'afternoon',
    order: Number.isFinite(todo.order) ? todo.order : 0,
    isExpanded: false,
    title: null,
    subtitle: null,
    icon: null,
    pillarId: typeof todo.pillarId === 'string' ? todo.pillarId : null,
    source: 'auto-sync',
    data: {
      todoId: todo.id,
      title: todo.content || '',
      description: todo.description || '',
      status: typeof todo.status === 'string' ? todo.status : 'active',
      completedAt: typeof todo.completedAt === 'number' ? todo.completedAt : null,
      parentId: typeof todo.parentId === 'string' ? todo.parentId : null
    },
    createdAt: typeof todo.createdAt === 'number' ? todo.createdAt : 0,
    updatedAt: typeof todo.updatedAt === 'number' ? todo.updatedAt : 0,
    isProjected: true
  };
}

function buildDaySections({ blocks }) {
  const sections = CANONICAL_SECTIONS.map(sectionId => ({
    id: sectionId,
    blocks: []
  }));
  const sectionById = new Map(sections.map(section => [section.id, section]));

  sortBlocks(blocks).forEach(block => {
    const section = sectionById.get(block.sectionId);
    if (!section) {
      return;
    }
    section.blocks.push(block);
  });

  return sections;
}

function getRequestPathForHash(req) {
  if (typeof req.baseUrl === 'string' && typeof req.path === 'string') {
    return `${req.baseUrl}${req.path}`;
  }
  return req.originalUrl || '/api/plan/by-date/:date';
}

// POST /api/plan/by-date/:date
router.post('/by-date/:date', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const normalizedPlan = normalizePlanPayload(req.body || {});
    const idempotencyKey = normalizeIdempotencyKey(req.get('Idempotency-Key'));

    const blockTypes = await listBlockTypesForUser({ db, userId, ensureBuiltins: true });
    const blockTypeMap = new Map(blockTypes.map(type => [type.id, type]));

    const dayNativeEntries = normalizedPlan.day.blocks
      .filter(entry => entry.kind === 'day-native')
      .map(entry => {
        const blockType = blockTypeMap.get(entry.typeId);
        if (!blockType) {
          throw createValidationError(`Unknown block type: ${entry.typeId}`);
        }

        return {
          ...entry,
          data: validateDataAgainstSchema(
            entry.data || defaultDataForType(entry.typeId),
            blockType
          )
        };
      });

    const upsertPlans = normalizedPlan.primitives.todos.upsert.map(entry => ({
      entry,
      todoId: entry.id || db.collection('todos').doc().id,
      normalizedPillarId: entry.provided.pillarId
        ? normalizePillarReference(entry.pillarId, `primitives.todos.upsert[${entry.inputIndex}].pillarId`)
      : undefined,
      isGeneratedId: !entry.id
    }));

    const seenUpsertTodoIds = new Set();
    upsertPlans.forEach(plan => {
      if (seenUpsertTodoIds.has(plan.todoId)) {
        throw createValidationError(`Duplicate primitives.todos.upsert target id: ${plan.todoId}`);
      }
      seenUpsertTodoIds.add(plan.todoId);
    });

    const todoIdByClientId = new Map();
    upsertPlans.forEach(plan => {
      if (plan.entry.clientId) {
        todoIdByClientId.set(plan.entry.clientId, plan.todoId);
      }
    });

    const todoProjectionEntries = normalizedPlan.day.blocks
      .filter(entry => entry.kind === 'todo-projection')
      .map(entry => {
        let resolvedTodoId = entry.todoRef.id;
        if (entry.todoRef.clientId) {
          const mappedTodoId = todoIdByClientId.get(entry.todoRef.clientId);
          if (!mappedTodoId) {
            throw createValidationError(
              `day.blocks[${entry.inputIndex}].todoRef.clientId does not match any primitives.todos.upsert clientId`
            );
          }
          if (resolvedTodoId && resolvedTodoId !== mappedTodoId) {
            throw createValidationError(
              `day.blocks[${entry.inputIndex}].todoRef.id does not match todoRef.clientId mapping`
            );
          }
          resolvedTodoId = mappedTodoId;
        }

        if (!resolvedTodoId) {
          throw createValidationError(`day.blocks[${entry.inputIndex}].todoRef could not be resolved`);
        }

        return {
          ...entry,
          todoId: resolvedTodoId
        };
      });

    const duplicateProjectionIds = new Set();
    for (const projection of todoProjectionEntries) {
      if (duplicateProjectionIds.has(projection.todoId)) {
        throw createValidationError(`Duplicate todo projection for todoId ${projection.todoId}`);
      }
      duplicateProjectionIds.add(projection.todoId);
    }

    const dayNativeEntriesWithPillar = dayNativeEntries.map(entry => ({
      ...entry,
      normalizedPillarId: normalizePillarReference(entry.pillarId, `day.blocks[${entry.inputIndex}].pillarId`)
    }));

    const requiredPillarIds = new Set();
    upsertPlans.forEach(plan => {
      if (typeof plan.normalizedPillarId === 'string') {
        requiredPillarIds.add(plan.normalizedPillarId);
      }
    });
    dayNativeEntriesWithPillar.forEach(entry => {
      if (typeof entry.normalizedPillarId === 'string') {
        requiredPillarIds.add(entry.normalizedPillarId);
      }
    });

    const newTodoIdSet = new Set(
      upsertPlans
        .filter(plan => plan.isGeneratedId)
        .map(plan => plan.todoId)
    );
    const todoIdsToRead = new Set();
    upsertPlans.forEach(plan => {
      if (!plan.isGeneratedId) {
        todoIdsToRead.add(plan.todoId);
      }
    });
    todoProjectionEntries.forEach(entry => {
      if (!newTodoIdSet.has(entry.todoId)) {
        todoIdsToRead.add(entry.todoId);
      }
    });

    const requestHash = hashValue(stableStringify({
      userId,
      path: getRequestPathForHash(req),
      body: normalizedPlan
    }));

    const idempotencyRef = idempotencyKey
      ? db.collection('idempotency').doc(hashValue(`${userId}::plan::${date}::${idempotencyKey}`))
      : null;

    const result = await db.runTransaction(async transaction => {
      const timestamp = nowTs();

      if (idempotencyRef) {
        const existingIdempotency = await transaction.get(idempotencyRef);
        if (existingIdempotency.exists) {
          const idempotencyData = existingIdempotency.data() || {};
          if (idempotencyData.requestHash !== requestHash) {
            throw createConflictError(
              'Idempotency-Key has already been used with a different payload for this date'
            );
          }

          if (idempotencyData.response && typeof idempotencyData.statusCode === 'number') {
            return {
              replayed: true,
              statusCode: idempotencyData.statusCode,
              body: idempotencyData.response
            };
          }

          throw createConflictError('Idempotency-Key request is already in progress');
        }
      }

      const dayBlocksQuery = db.collection('dayBlocks')
        .where('userId', '==', userId)
        .where('date', '==', date);
      const dayBlocksSnapshot = await transaction.get(dayBlocksQuery);
      const existingDayBlocks = dayBlocksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const todosForDateQuery = db.collection('todos')
        .where('userId', '==', userId)
        .where('dueDate', '==', date);
      const todosForDateSnapshot = await transaction.get(todosForDateQuery);
      const todosForDate = new Map(
        todosForDateSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(todo => !isTodoArchived(todo))
          .map(todo => [todo.id, todo])
      );

      const existingTodosById = new Map();
      for (const todoId of todoIdsToRead) {
        const todoDoc = await transaction.get(db.collection('todos').doc(todoId));
        if (!todoDoc.exists) {
          continue;
        }
        existingTodosById.set(todoId, { id: todoDoc.id, ...todoDoc.data() });
      }

      const validPillarIds = new Set();
      for (const pillarId of requiredPillarIds) {
        const pillarDoc = await transaction.get(db.collection('pillars').doc(pillarId));
        if (!pillarDoc.exists || pillarDoc.data()?.userId !== userId) {
          throw createValidationError('Invalid pillarId');
        }
        validPillarIds.add(pillarId);
      }

      const resolvePillarId = (normalizedPillarId) => {
        if (normalizedPillarId === undefined) {
          return undefined;
        }
        if (normalizedPillarId === null) {
          return null;
        }
        if (!validPillarIds.has(normalizedPillarId)) {
          throw createValidationError('Invalid pillarId');
        }
        return normalizedPillarId;
      };

      const todoStateById = new Map(todosForDate);
      for (const [todoId, todo] of existingTodosById.entries()) {
        if (todo.userId !== userId) {
          throw createValidationError(`Todo not found: ${todoId}`);
        }
        todoStateById.set(todoId, todo);
      }

      let createdTodoCount = 0;
      let updatedTodoCount = 0;
      let projectedTodoWriteCount = 0;
      const createdTodoRefs = [];

      for (const plan of upsertPlans) {
        const { entry, todoId } = plan;
        const todoRef = db.collection('todos').doc(todoId);
        const existing = todoStateById.get(todoId) || null;

        let finalTodo;
        if (existing) {
          const patch = {};

          if (entry.provided.content) {
            patch.content = entry.content;
          }
          if (entry.provided.description) {
            patch.description = entry.description;
          }
          if (entry.provided.dueDate) {
            patch.dueDate = entry.dueDate;
          }
          if (entry.provided.sectionId) {
            patch.sectionId = entry.sectionId;
          }
          if (entry.provided.priority) {
            patch.priority = entry.priority;
          }
          if (entry.provided.parentId) {
            patch.parentId = entry.parentId;
          }
          if (entry.provided.order) {
            patch.order = entry.order;
          }
          if (entry.provided.labels) {
            patch.labels = entry.labels;
          }
          if (entry.provided.pillarId) {
            patch.pillarId = resolvePillarId(plan.normalizedPillarId);
          }

          if (entry.provided.status) {
            patch.status = entry.status;
            if (entry.status === 'completed') {
              patch.completedAt = typeof existing.completedAt === 'number'
                ? existing.completedAt
                : timestamp;
            } else {
              patch.completedAt = null;
            }
          }

          if (Object.keys(patch).length > 0) {
            patch.updatedAt = timestamp;
            transaction.set(todoRef, patch, { merge: true });
            updatedTodoCount += 1;
          }

          finalTodo = {
            ...existing,
            ...patch,
            id: todoId
          };
        } else {
          if (!entry.provided.content) {
            throw createValidationError(
              `primitives.todos.upsert[${entry.inputIndex}].content is required when creating a new todo`
            );
          }

          const status = entry.provided.status ? entry.status : 'active';
          const pillarId = entry.provided.pillarId
            ? resolvePillarId(plan.normalizedPillarId)
            : null;

          finalTodo = {
            id: todoId,
            userId,
            content: entry.content,
            description: entry.provided.description ? entry.description : '',
            dueDate: entry.provided.dueDate ? entry.dueDate : date,
            sectionId: entry.provided.sectionId ? entry.sectionId : 'afternoon',
            priority: entry.provided.priority ? entry.priority : 1,
            parentId: entry.provided.parentId ? entry.parentId : null,
            status,
            labels: entry.provided.labels ? entry.labels : [],
            order: entry.provided.order ? entry.order : 0,
            pillarId,
            createdAt: timestamp,
            updatedAt: timestamp,
            completedAt: status === 'completed' ? timestamp : null,
            archivedAt: null
          };

          transaction.set(todoRef, finalTodo);
          createdTodoCount += 1;
          if (entry.clientId) {
            createdTodoRefs.push({ clientId: entry.clientId, id: todoId });
          }
        }

        todoStateById.set(todoId, finalTodo);
        if (finalTodo.dueDate === date && !isTodoArchived(finalTodo)) {
          todosForDate.set(todoId, finalTodo);
        } else {
          todosForDate.delete(todoId);
        }
      }

      for (const projection of todoProjectionEntries) {
        const todo = todoStateById.get(projection.todoId);
        if (!todo) {
          throw createValidationError(`Todo not found for day.blocks[${projection.inputIndex}]`);
        }
        if (isTodoArchived(todo)) {
          throw createValidationError(`Archived todo cannot be projected: ${projection.todoId}`);
        }

        const patch = {
          dueDate: date,
          sectionId: projection.sectionId,
          order: projection.order,
          updatedAt: timestamp
        };

        transaction.set(db.collection('todos').doc(projection.todoId), patch, { merge: true });
        projectedTodoWriteCount += 1;

        const updatedTodo = {
          ...todo,
          ...patch
        };
        todoStateById.set(projection.todoId, updatedTodo);
        if (updatedTodo.dueDate === date && !isTodoArchived(updatedTodo)) {
          todosForDate.set(projection.todoId, updatedTodo);
        } else {
          todosForDate.delete(projection.todoId);
        }
      }

      const existingNativeBlocks = [];
      let deletedDayBlockCount = 0;
      existingDayBlocks.forEach(block => {
        if (isLegacyProjectedType(block.typeId) || isDisabledDefaultNativeBlock(block)) {
          transaction.delete(db.collection('dayBlocks').doc(block.id));
          deletedDayBlockCount += 1;
          return;
        }
        existingNativeBlocks.push(block);
      });

      let createdDayBlockCount = 0;
      let updatedDayBlockCount = 0;
      const finalNativeById = new Map(existingNativeBlocks.map(block => [block.id, block]));

      const buildNativePayload = (entry) => ({
        userId,
        date,
        typeId: entry.typeId,
        sectionId: entry.sectionId,
        order: entry.order,
        isExpanded: entry.isExpanded,
        title: entry.title,
        subtitle: entry.subtitle,
        icon: entry.icon,
        pillarId: resolvePillarId(entry.normalizedPillarId) ?? null,
        source: entry.source,
        data: entry.data
      });

      if (normalizedPlan.mode === 'replace') {
        for (const block of existingNativeBlocks) {
          transaction.delete(db.collection('dayBlocks').doc(block.id));
          finalNativeById.delete(block.id);
          deletedDayBlockCount += 1;
        }

        for (const entry of dayNativeEntriesWithPillar) {
          const ref = db.collection('dayBlocks').doc();
          const payload = buildNativePayload(entry);
          const next = {
            id: ref.id,
            ...payload,
            createdAt: timestamp,
            updatedAt: timestamp,
            isProjected: false
          };
          transaction.set(ref, {
            id: next.id,
            userId: next.userId,
            date: next.date,
            typeId: next.typeId,
            sectionId: next.sectionId,
            order: next.order,
            isExpanded: next.isExpanded,
            title: next.title,
            subtitle: next.subtitle,
            icon: next.icon,
            pillarId: next.pillarId,
            source: next.source,
            data: next.data,
            createdAt: next.createdAt,
            updatedAt: next.updatedAt
          });
          finalNativeById.set(ref.id, next);
          createdDayBlockCount += 1;
        }
      } else if (normalizedPlan.mode === 'append') {
        for (const entry of dayNativeEntriesWithPillar) {
          const ref = db.collection('dayBlocks').doc();
          const payload = buildNativePayload(entry);
          const next = {
            id: ref.id,
            ...payload,
            createdAt: timestamp,
            updatedAt: timestamp,
            isProjected: false
          };
          transaction.set(ref, {
            id: next.id,
            userId: next.userId,
            date: next.date,
            typeId: next.typeId,
            sectionId: next.sectionId,
            order: next.order,
            isExpanded: next.isExpanded,
            title: next.title,
            subtitle: next.subtitle,
            icon: next.icon,
            pillarId: next.pillarId,
            source: next.source,
            data: next.data,
            createdAt: next.createdAt,
            updatedAt: next.updatedAt
          });
          finalNativeById.set(ref.id, next);
          createdDayBlockCount += 1;
        }
      } else {
        const existingByMergeKey = new Map();
        sortBlocks(existingNativeBlocks).forEach(block => {
          const key = mergeMatchKey(block.sectionId, block.typeId);
          if (!existingByMergeKey.has(key)) {
            existingByMergeKey.set(key, []);
          }
          existingByMergeKey.get(key).push(block);
        });

        for (const entry of dayNativeEntriesWithPillar) {
          const payload = buildNativePayload(entry);
          const mergeKey = mergeMatchKey(entry.sectionId, entry.typeId);
          const matches = existingByMergeKey.get(mergeKey) || [];

          if (matches.length === 0) {
            const ref = db.collection('dayBlocks').doc();
            const next = {
              id: ref.id,
              ...payload,
              createdAt: timestamp,
              updatedAt: timestamp,
              isProjected: false
            };
            transaction.set(ref, {
              id: next.id,
              userId: next.userId,
              date: next.date,
              typeId: next.typeId,
              sectionId: next.sectionId,
              order: next.order,
              isExpanded: next.isExpanded,
              title: next.title,
              subtitle: next.subtitle,
              icon: next.icon,
              pillarId: next.pillarId,
              source: next.source,
              data: next.data,
              createdAt: next.createdAt,
              updatedAt: next.updatedAt
            });
            finalNativeById.set(ref.id, next);
            createdDayBlockCount += 1;
            continue;
          }

          const matched = matches.shift();
          const next = {
            id: matched.id,
            ...payload,
            createdAt: matched.createdAt ?? timestamp,
            updatedAt: timestamp,
            isProjected: false
          };

          transaction.set(db.collection('dayBlocks').doc(matched.id), {
            id: next.id,
            userId: next.userId,
            date: next.date,
            typeId: next.typeId,
            sectionId: next.sectionId,
            order: next.order,
            isExpanded: next.isExpanded,
            title: next.title,
            subtitle: next.subtitle,
            icon: next.icon,
            pillarId: next.pillarId,
            source: next.source,
            data: next.data,
            createdAt: next.createdAt,
            updatedAt: next.updatedAt
          }, { merge: true });

          finalNativeById.set(matched.id, next);
          updatedDayBlockCount += 1;
        }
      }

      const projectedTodoBlocks = [...todosForDate.values()]
        .filter(todo => !isTodoArchived(todo))
        .map(todo => buildTodoProjectionBlock({ userId, date, todo }));
      const daySections = buildDaySections({
        blocks: [...finalNativeById.values(), ...projectedTodoBlocks]
      });

      const responseBody = {
        date,
        mode: normalizedPlan.mode,
        created: {
          todos: createdTodoRefs,
          dayBlocks: createdDayBlockCount
        },
        updated: {
          todos: updatedTodoCount + projectedTodoWriteCount,
          dayBlocks: updatedDayBlockCount
        },
        deleted: {
          dayBlocks: deletedDayBlockCount
        },
        day: {
          sections: daySections
        }
      };

      const statusCode = createdTodoCount > 0 || createdDayBlockCount > 0 || deletedDayBlockCount > 0
        ? 201
        : 200;

      if (idempotencyRef) {
        transaction.set(idempotencyRef, {
          id: idempotencyRef.id,
          userId,
          endpoint: '/api/plan/by-date/:date',
          date,
          key: idempotencyKey,
          requestHash,
          statusCode,
          response: responseBody,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      return {
        replayed: false,
        statusCode,
        body: responseBody
      };
    });

    if (idempotencyKey) {
      res.set('Idempotency-Key', idempotencyKey);
    }
    if (result.replayed) {
      res.set('Idempotency-Replayed', 'true');
    }

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return respondError(res, error);
  }
});

module.exports = router;
