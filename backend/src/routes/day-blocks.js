const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveValidatedPillarId, createInvalidPillarIdError } = require('../utils/pillarValidation');
const {
  normalizeCreatePayload,
  normalizePatchPayload,
  deepMergeData,
  validateDataAgainstSchema
} = require('../utils/blockInstanceValidation');
const {
  createValidationError,
  isPlainObject
} = require('../utils/blockTypeValidation');
const {
  listBlockTypesForUser,
  getBlockTypeById,
  nowTs
} = require('../services/blockTypes');
const { resolveBlockPayloads } = require('../services/blockResolver');

const router = express.Router({ mergeParams: true });
router.use(flexibleAuth);

const SECTION_RANK = Object.freeze({
  morning: 0,
  afternoon: 1,
  evening: 2
});
const MULTI_INSTANCE_TYPE_SET = new Set(['todo', 'habits']);
const LEGACY_PROJECTED_TYPE_SET = new Set(['todo', 'todos', 'habits', 'morninghabits']);
const DISABLED_DEFAULT_NATIVE_TYPE_SET = new Set(['sleep', 'feeling', 'workout', 'reflection']);

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

  console.error('[day-blocks] route error:', error);
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

function parseResolveQuery(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeSectionFilter(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createValidationError('sectionId must be a string');
  }

  const sectionId = value.trim().toLowerCase();
  if (!SECTION_RANK.hasOwnProperty(sectionId)) {
    throw createValidationError('sectionId must be morning, afternoon, or evening');
  }

  return sectionId;
}

function normalizeTypeFilter(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw createValidationError('typeId must be a non-empty string');
  }

  return value.trim();
}

function normalizeTypeIdForByType(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createValidationError('typeId must be a non-empty string');
  }

  return value.trim();
}

function normalizeStoredTypeId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return value.trim();
}

function parseProjectedBlockRef(blockId) {
  if (typeof blockId !== 'string') {
    return null;
  }

  if (blockId.startsWith('proj_todo_')) {
    return {
      kind: 'todo',
      primitiveId: blockId.slice('proj_todo_'.length)
    };
  }

  if (blockId.startsWith('proj_habit_')) {
    return {
      kind: 'habit',
      primitiveId: blockId.slice('proj_habit_'.length)
    };
  }

  return null;
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

function isTodoArchived(todo) {
  return todo?.archivedAt !== null && todo?.archivedAt !== undefined;
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

function weekdayFromDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(value => Number(value));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][utcDate.getUTCDay()];
}

function habitAppliesToDate(habit, dateStr) {
  if (habit?.isActive === false) {
    return false;
  }

  const schedule = habit?.schedule || { type: 'daily', daysOfWeek: [] };
  if (schedule.type === 'daily') {
    return true;
  }

  if (schedule.type === 'weekly') {
    const weekday = weekdayFromDate(dateStr);
    return Array.isArray(schedule.daysOfWeek)
      ? schedule.daysOfWeek.includes(weekday)
      : false;
  }

  return false;
}

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

async function listStoredDayBlocks({ userId, date }) {
  const snapshot = await db.collection('dayBlocks')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .get();

  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      isProjected: false
    }))
    .filter(block => !isLegacyProjectedType(block.typeId) && !isDisabledDefaultNativeType(block.typeId));
}

async function listTodosForDate({ userId, date }) {
  try {
    const snapshot = await db.collection('todos')
      .where('userId', '==', userId)
      .where('dueDate', '==', date)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(todo => !isTodoArchived(todo));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await db.collection('todos')
      .where('userId', '==', userId)
      .get();

    return fallback.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(todo => todo.dueDate === date && !isTodoArchived(todo))
      .sort((a, b) => {
        const createdA = typeof a.createdAt === 'number' ? a.createdAt : 0;
        const createdB = typeof b.createdAt === 'number' ? b.createdAt : 0;
        return createdA - createdB;
      });
  }
}

async function listScheduledHabitsForDate({ userId, date }) {
  let habits;
  try {
    const snapshot = await db.collection('habits')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();
    habits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await db.collection('habits')
      .where('userId', '==', userId)
      .get();
    habits = fallback.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  const scheduled = habits.filter(habit => habitAppliesToDate(habit, date));

  let logs;
  try {
    const snapshot = await db.collection('habitLogs')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .get();
    logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await db.collection('habitLogs')
      .where('userId', '==', userId)
      .get();
    logs = fallback.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(log => log.date === date);
  }

  const logsByHabitId = new Map(logs.map(log => [log.habitId, log]));

  return scheduled.map(habit => ({
    habit,
    log: logsByHabitId.get(habit.id) || null
  }));
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

function buildHabitProjectionBlock({ userId, date, habit, log }) {
  const completed = Boolean(log?.completed);

  return {
    id: `proj_habit_${habit.id}`,
    userId,
    date,
    typeId: 'habits',
    sectionId: typeof habit.sectionId === 'string' ? habit.sectionId : 'morning',
    order: Number.isFinite(habit.order) ? habit.order : 0,
    isExpanded: false,
    title: null,
    subtitle: null,
    icon: null,
    pillarId: typeof habit.pillarId === 'string' ? habit.pillarId : null,
    source: 'auto-sync',
    data: {
      habitId: habit.id,
      name: habit.name || '',
      completed,
      value: typeof log?.value === 'number' ? log.value : null,
      notes: typeof log?.notes === 'string' ? log.notes : '',
      status: completed ? 'completed' : 'pending'
    },
    createdAt: typeof habit.createdAt === 'number' ? habit.createdAt : 0,
    updatedAt: typeof habit.updatedAt === 'number' ? habit.updatedAt : 0,
    isProjected: true
  };
}

async function listProjectedBlocksForDate({ userId, date }) {
  const [todos, scheduledHabits] = await Promise.all([
    listTodosForDate({ userId, date }),
    listScheduledHabitsForDate({ userId, date })
  ]);

  const todoBlocks = todos.map(todo => buildTodoProjectionBlock({ userId, date, todo }));
  const habitBlocks = scheduledHabits.map(({ habit, log }) => buildHabitProjectionBlock({ userId, date, habit, log }));

  return [...todoBlocks, ...habitBlocks];
}

async function listDayBlocksWithProjection({ userId, date }) {
  const [stored, projected] = await Promise.all([
    listStoredDayBlocks({ userId, date }),
    listProjectedBlocksForDate({ userId, date })
  ]);

  return sortBlocks([...stored, ...projected]);
}

async function buildTypeMapForUser(userId) {
  const types = await listBlockTypesForUser({ db, userId, ensureBuiltins: true });
  return new Map(types.map(type => [type.id, type]));
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

async function getStoredDayBlockById({ userId, date, blockId }) {
  const doc = await db.collection('dayBlocks').doc(blockId).get();
  if (!doc.exists) {
    return null;
  }

  const data = doc.data() || {};
  if (data.userId !== userId || data.date !== date) {
    return null;
  }
  if (isLegacyProjectedType(data.typeId) || isDisabledDefaultNativeType(data.typeId)) {
    return null;
  }

  return { id: doc.id, ...data, isProjected: false };
}

async function getTodoById(todoId) {
  const doc = await db.collection('todos').doc(todoId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

async function getHabitById(habitId) {
  const doc = await db.collection('habits').doc(habitId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

async function getHabitLog({ habitId, date }) {
  const doc = await db.collection('habitLogs').doc(`${habitId}_${date}`).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

async function fetchBlockByIdWithProjection({ userId, date, blockId }) {
  const projectedRef = parseProjectedBlockRef(blockId);
  if (!projectedRef) {
    return getStoredDayBlockById({ userId, date, blockId });
  }

  if (projectedRef.kind === 'todo') {
    const todo = await getTodoById(projectedRef.primitiveId);
    if (!todo || todo.userId !== userId || todo.dueDate !== date || isTodoArchived(todo)) {
      return null;
    }
    return buildTodoProjectionBlock({ userId, date, todo });
  }

  if (projectedRef.kind === 'habit') {
    const habit = await getHabitById(projectedRef.primitiveId);
    if (!habit || habit.userId !== userId || !habitAppliesToDate(habit, date)) {
      return null;
    }

    const log = await getHabitLog({ habitId: habit.id, date });
    return buildHabitProjectionBlock({ userId, date, habit, log });
  }

  return null;
}

function ensureProjectedPatchKeys(body, allowedKeys) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be an object');
  }

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw createValidationError(`Unsupported projected block field: ${key}`);
    }
  }
}

function normalizeProjectedText(value, field) {
  if (typeof value !== 'string') {
    throw createValidationError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw createValidationError(`${field} cannot be empty`);
  }
  return trimmed;
}

function normalizeProjectedStatus(value) {
  if (typeof value !== 'string') {
    throw createValidationError('status must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized !== 'active' && normalized !== 'completed') {
    throw createValidationError('status must be active or completed');
  }

  return normalized;
}

function normalizeProjectedCompleted(value) {
  if (typeof value !== 'boolean') {
    throw createValidationError('completed must be a boolean');
  }
  return value;
}

function normalizeProjectedNumberOrNull(value, field) {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw createValidationError(`${field} must be a non-negative number or null`);
  }
  return value;
}

async function applyProjectedTodoPatch({ userId, date, primitiveId, body }) {
  const allowedKeys = new Set(['sectionId', 'order', 'pillarId', 'title', 'data']);
  ensureProjectedPatchKeys(body, allowedKeys);

  const existing = await getTodoById(primitiveId);
  if (!existing || existing.userId !== userId || existing.dueDate !== date || isTodoArchived(existing)) {
    throw createValidationError('Projected todo block not found');
  }

  const update = {
    updatedAt: nowTs()
  };

  if (Object.prototype.hasOwnProperty.call(body, 'sectionId')) {
    if (typeof body.sectionId !== 'string' || !SECTION_RANK.hasOwnProperty(body.sectionId)) {
      throw createValidationError('sectionId must be morning, afternoon, or evening');
    }
    update.sectionId = body.sectionId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'order')) {
    const parsed = Number(body.order);
    if (!Number.isFinite(parsed)) {
      throw createValidationError('order must be a number');
    }
    update.order = Math.trunc(parsed);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'pillarId')) {
    update.pillarId = await resolvePillarIdOrThrow({ userId, pillarId: body.pillarId });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    update.content = normalizeProjectedText(body.title, 'title');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'data')) {
    if (!isPlainObject(body.data)) {
      throw createValidationError('data must be an object');
    }

    for (const key of Object.keys(body.data)) {
      if (!['title', 'status', 'description'].includes(key)) {
        throw createValidationError(`Unsupported todo data field: ${key}`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body.data, 'title')) {
      update.content = normalizeProjectedText(body.data.title, 'data.title');
    }

    if (Object.prototype.hasOwnProperty.call(body.data, 'description')) {
      if (body.data.description === null) {
        update.description = '';
      } else {
        update.description = normalizeProjectedText(body.data.description, 'data.description');
      }
    }

    if (Object.prototype.hasOwnProperty.call(body.data, 'status')) {
      update.status = normalizeProjectedStatus(body.data.status);
      update.completedAt = update.status === 'completed'
        ? (typeof existing.completedAt === 'number' ? existing.completedAt : nowTs())
        : null;
    }
  }

  await db.collection('todos').doc(primitiveId).set(update, { merge: true });
}

async function applyProjectedHabitPatch({ userId, date, primitiveId, body }) {
  const allowedKeys = new Set(['sectionId', 'order', 'pillarId', 'title', 'data']);
  ensureProjectedPatchKeys(body, allowedKeys);

  const habit = await getHabitById(primitiveId);
  if (!habit || habit.userId !== userId) {
    throw createValidationError('Projected habit block not found');
  }
  if (!habitAppliesToDate(habit, date)) {
    throw createValidationError('Projected habit block not found');
  }

  const update = {
    updatedAt: nowTs()
  };

  if (Object.prototype.hasOwnProperty.call(body, 'sectionId')) {
    if (typeof body.sectionId !== 'string' || !SECTION_RANK.hasOwnProperty(body.sectionId)) {
      throw createValidationError('sectionId must be morning, afternoon, or evening');
    }
    update.sectionId = body.sectionId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'order')) {
    const parsed = Number(body.order);
    if (!Number.isFinite(parsed)) {
      throw createValidationError('order must be a number');
    }
    update.order = Math.trunc(parsed);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'pillarId')) {
    update.pillarId = await resolvePillarIdOrThrow({ userId, pillarId: body.pillarId });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    update.name = normalizeProjectedText(body.title, 'title');
  }

  let logPatch = null;

  if (Object.prototype.hasOwnProperty.call(body, 'data')) {
    if (!isPlainObject(body.data)) {
      throw createValidationError('data must be an object');
    }

    for (const key of Object.keys(body.data)) {
      if (!['name', 'completed', 'value', 'notes'].includes(key)) {
        throw createValidationError(`Unsupported habit data field: ${key}`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body.data, 'name')) {
      update.name = normalizeProjectedText(body.data.name, 'data.name');
    }

    if (Object.prototype.hasOwnProperty.call(body.data, 'completed')
      || Object.prototype.hasOwnProperty.call(body.data, 'value')
      || Object.prototype.hasOwnProperty.call(body.data, 'notes')) {
      const currentLog = await getHabitLog({ habitId: primitiveId, date });
      const timestamp = nowTs();
      logPatch = {
        id: `${primitiveId}_${date}`,
        userId,
        habitId: primitiveId,
        date,
        completed: currentLog?.completed || false,
        value: currentLog?.value ?? null,
        notes: currentLog?.notes || '',
        createdAt: currentLog?.createdAt || timestamp,
        updatedAt: timestamp
      };

      if (Object.prototype.hasOwnProperty.call(body.data, 'completed')) {
        logPatch.completed = normalizeProjectedCompleted(body.data.completed);
      }
      if (Object.prototype.hasOwnProperty.call(body.data, 'value')) {
        logPatch.value = normalizeProjectedNumberOrNull(body.data.value, 'data.value');
      }
      if (Object.prototype.hasOwnProperty.call(body.data, 'notes')) {
        if (body.data.notes === null) {
          logPatch.notes = '';
        } else {
          logPatch.notes = normalizeProjectedText(body.data.notes, 'data.notes');
        }
      }
    }
  }

  await db.collection('habits').doc(primitiveId).set(update, { merge: true });
  if (logPatch) {
    await db.collection('habitLogs').doc(logPatch.id).set(logPatch);
  }
}

async function applyProjectedMove({ userId, date, projectedRef, sectionId, order }) {
  if (!SECTION_RANK.hasOwnProperty(sectionId)) {
    throw createValidationError('sectionId must be morning, afternoon, or evening');
  }

  if (!Number.isFinite(order)) {
    throw createValidationError('order must be a number');
  }

  const payload = {
    sectionId,
    order: Math.trunc(order),
    updatedAt: nowTs()
  };

  if (projectedRef.kind === 'todo') {
    const todo = await getTodoById(projectedRef.primitiveId);
    if (!todo || todo.userId !== userId || todo.dueDate !== date || isTodoArchived(todo)) {
      throw createValidationError('Projected todo block not found');
    }

    await db.collection('todos').doc(projectedRef.primitiveId).set(payload, { merge: true });
    return;
  }

  if (projectedRef.kind === 'habit') {
    const habit = await getHabitById(projectedRef.primitiveId);
    if (!habit || habit.userId !== userId) {
      throw createValidationError('Projected habit block not found');
    }

    await db.collection('habits').doc(projectedRef.primitiveId).set(payload, { merge: true });
    return;
  }

  throw createValidationError('Unsupported projected block');
}

async function deleteProjectedBlock({ userId, date, projectedRef }) {
  if (projectedRef.kind === 'todo') {
    const todo = await getTodoById(projectedRef.primitiveId);
    if (!todo || todo.userId !== userId || todo.dueDate !== date || isTodoArchived(todo)) {
      throw createValidationError('Projected todo block not found');
    }

    const subtasks = await db.collection('todos')
      .where('userId', '==', userId)
      .where('parentId', '==', projectedRef.primitiveId)
      .get();

    const batch = db.batch();
    batch.delete(db.collection('todos').doc(projectedRef.primitiveId));
    subtasks.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return;
  }

  if (projectedRef.kind === 'habit') {
    const habit = await getHabitById(projectedRef.primitiveId);
    if (!habit || habit.userId !== userId) {
      throw createValidationError('Projected habit block not found');
    }

    await db.collection('habits').doc(projectedRef.primitiveId).set({
      isActive: false,
      archivedAt: nowTs(),
      updatedAt: nowTs()
    }, { merge: true });
    return;
  }

  throw createValidationError('Unsupported projected block');
}

async function resolveBlocksMaybe({ userId, blocks, resolve }) {
  if (!resolve) {
    return blocks;
  }

  const typeMap = await buildTypeMapForUser(userId);
  return resolveBlockPayloads({
    db,
    userId,
    blocks,
    blockTypesById: typeMap,
    includePillar: true
  });
}

function blockHasAnyData(items) {
  return Array.isArray(items) && items.length > 0;
}

// POST /api/days/:date/blocks
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;
    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const payload = normalizeCreatePayload(req.body || {});
    if (isLegacyProjectedType(payload.typeId)) {
      throw createValidationError('todo and habits blocks are projected. Create primitives via /api/todos or /api/habits.');
    }
    if (isDisabledDefaultNativeType(payload.typeId)) {
      throw createValidationError('Default day-native block types (sleep/feeling/workout/reflection) are disabled.');
    }

    const blockType = await getBlockTypeById({ db, userId, typeId: payload.typeId, ensureBuiltins: true });
    if (!blockType) {
      return res.status(404).json({ error: 'Block type not found' });
    }

    payload.data = validateDataAgainstSchema(payload.data, blockType);

    const validatedPillarId = await resolvePillarIdOrThrow({
      userId,
      pillarId: payload.pillarId
    });

    const docRef = payload.id
      ? db.collection('dayBlocks').doc(payload.id)
      : db.collection('dayBlocks').doc();

    if (payload.id) {
      const existing = await docRef.get();
      if (existing.exists) {
        return res.status(409).json({ error: 'Block with this id already exists' });
      }
    }

    const timestamp = nowTs();
    const block = {
      id: docRef.id,
      userId,
      date,
      typeId: payload.typeId,
      sectionId: payload.sectionId,
      order: payload.order,
      isExpanded: payload.isExpanded,
      title: payload.title,
      subtitle: payload.subtitle,
      icon: payload.icon,
      pillarId: validatedPillarId ?? null,
      source: payload.source,
      data: payload.data,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await docRef.set(block);

    const resolved = await resolveBlocksMaybe({ userId, blocks: [
      { ...block, isProjected: false }
    ], resolve: parseResolveQuery(req.query.resolve) });

    return res.status(201).json(resolved[0]);
  } catch (error) {
    return respondError(res, error);
  }
});

// GET /api/days/:date/blocks
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const sectionFilter = normalizeSectionFilter(req.query.sectionId);
    const typeFilter = normalizeTypeFilter(req.query.typeId);
    const resolve = parseResolveQuery(req.query.resolve);

    let blocks = await listDayBlocksWithProjection({ userId, date });

    if (sectionFilter) {
      blocks = blocks.filter(block => block.sectionId === sectionFilter);
    }

    if (typeFilter) {
      blocks = blocks.filter(block => block.typeId === typeFilter);
    }

    blocks = sortBlocks(blocks);
    const items = await resolveBlocksMaybe({ userId, blocks, resolve });

    return res.json({
      date,
      count: items.length,
      items
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// PATCH /api/days/:date/blocks/by-type/:typeId
router.patch('/by-type/:typeId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;
    const typeId = normalizeTypeIdForByType(req.params.typeId);

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    if (MULTI_INSTANCE_TYPE_SET.has(typeId) || isLegacyProjectedType(typeId)) {
      return res.status(409).json({
        error: 'Type is multi-instance for this date. Use PATCH /api/days/:date/blocks/:blockId.'
      });
    }
    if (isDisabledDefaultNativeType(typeId)) {
      return res.status(410).json({
        error: 'Default day-native block types (sleep/feeling/workout/reflection) are disabled.'
      });
    }

    const patch = normalizePatchPayload(req.body || {});
    const blockType = await getBlockTypeById({ db, userId, typeId, ensureBuiltins: true });
    if (!blockType) {
      return res.status(404).json({ error: 'Block type not found' });
    }

    const storedBlocks = await listStoredDayBlocks({ userId, date });
    const matches = storedBlocks.filter(block => normalizeStoredTypeId(block.typeId) === typeId);

    if (matches.length > 1) {
      return res.status(409).json({
        error: 'Multiple blocks of this type exist for this date. Use PATCH /api/days/:date/blocks/:blockId.'
      });
    }

    const timestamp = nowTs();
    let responseBlock;
    let statusCode = 200;

    if (matches.length === 1) {
      const existing = matches[0];
      const next = {
        ...existing,
        ...patch,
        typeId,
        updatedAt: timestamp
      };

      if (Object.prototype.hasOwnProperty.call(patch, 'data')) {
        next.data = deepMergeData(existing.data || {}, patch.data || {});
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'pillarId')) {
        next.pillarId = await resolvePillarIdOrThrow({ userId, pillarId: patch.pillarId });
      }

      next.data = validateDataAgainstSchema(next.data || {}, blockType);

      await db.collection('dayBlocks').doc(existing.id).set({
        sectionId: next.sectionId,
        order: next.order,
        isExpanded: next.isExpanded,
        title: next.title,
        subtitle: next.subtitle,
        icon: next.icon,
        pillarId: next.pillarId,
        source: next.source,
        data: next.data,
        updatedAt: next.updatedAt
      }, { merge: true });

      responseBlock = {
        ...next,
        isProjected: false
      };
    } else {
      const targetSectionId = Object.prototype.hasOwnProperty.call(patch, 'sectionId')
        ? patch.sectionId
        : (typeof blockType.defaultSection === 'string' ? blockType.defaultSection : 'afternoon');

      const maxOrderInSection = storedBlocks
        .filter(block => block.sectionId === targetSectionId)
        .reduce((maxOrder, block) => {
          const order = Number.isFinite(block.order) ? block.order : -1;
          return Math.max(maxOrder, order);
        }, -1);

      const mergedData = Object.prototype.hasOwnProperty.call(patch, 'data')
        ? deepMergeData(defaultDataForType(typeId), patch.data || {})
        : defaultDataForType(typeId);
      const validatedData = validateDataAgainstSchema(mergedData, blockType);

      const pillarId = Object.prototype.hasOwnProperty.call(patch, 'pillarId')
        ? await resolvePillarIdOrThrow({ userId, pillarId: patch.pillarId })
        : null;

      const docRef = db.collection('dayBlocks').doc();
      responseBlock = {
        id: docRef.id,
        userId,
        date,
        typeId,
        sectionId: targetSectionId,
        order: Object.prototype.hasOwnProperty.call(patch, 'order')
          ? patch.order
          : maxOrderInSection + 1,
        isExpanded: Object.prototype.hasOwnProperty.call(patch, 'isExpanded')
          ? patch.isExpanded
          : false,
        title: Object.prototype.hasOwnProperty.call(patch, 'title')
          ? patch.title
          : null,
        subtitle: Object.prototype.hasOwnProperty.call(patch, 'subtitle')
          ? patch.subtitle
          : null,
        icon: Object.prototype.hasOwnProperty.call(patch, 'icon')
          ? patch.icon
          : null,
        pillarId: pillarId ?? null,
        source: Object.prototype.hasOwnProperty.call(patch, 'source')
          ? patch.source
          : 'clawdbot',
        data: validatedData,
        createdAt: timestamp,
        updatedAt: timestamp,
        isProjected: false
      };

      await docRef.set({
        id: responseBlock.id,
        userId: responseBlock.userId,
        date: responseBlock.date,
        typeId: responseBlock.typeId,
        sectionId: responseBlock.sectionId,
        order: responseBlock.order,
        isExpanded: responseBlock.isExpanded,
        title: responseBlock.title,
        subtitle: responseBlock.subtitle,
        icon: responseBlock.icon,
        pillarId: responseBlock.pillarId,
        source: responseBlock.source,
        data: responseBlock.data,
        createdAt: responseBlock.createdAt,
        updatedAt: responseBlock.updatedAt
      });

      statusCode = 201;
    }

    const resolve = parseResolveQuery(req.query.resolve);
    const items = await resolveBlocksMaybe({ userId, blocks: [responseBlock], resolve });
    return res.status(statusCode).json(items[0]);
  } catch (error) {
    return respondError(res, error);
  }
});

// GET /api/days/:date/blocks/:blockId
router.get('/:blockId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;
    const blockId = req.params.blockId;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    if (typeof blockId !== 'string' || !blockId.trim()) {
      throw createValidationError('blockId is required');
    }

    const block = await fetchBlockByIdWithProjection({ userId, date, blockId: blockId.trim() });
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    const resolve = parseResolveQuery(req.query.resolve);
    const items = await resolveBlocksMaybe({ userId, blocks: [block], resolve });
    return res.json(items[0]);
  } catch (error) {
    return respondError(res, error);
  }
});

// PATCH /api/days/:date/blocks/:blockId
router.patch('/:blockId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;
    const blockId = req.params.blockId;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const projectedRef = parseProjectedBlockRef(blockId);
    if (projectedRef) {
      if (projectedRef.kind === 'todo') {
        await applyProjectedTodoPatch({ userId, date, primitiveId: projectedRef.primitiveId, body: req.body || {} });
      } else {
        await applyProjectedHabitPatch({ userId, date, primitiveId: projectedRef.primitiveId, body: req.body || {} });
      }

      const updated = await fetchBlockByIdWithProjection({ userId, date, blockId });
      const resolve = parseResolveQuery(req.query.resolve);
      const items = await resolveBlocksMaybe({ userId, blocks: [updated], resolve });
      return res.json(items[0]);
    }

    const existing = await getStoredDayBlockById({ userId, date, blockId });
    if (!existing) {
      return res.status(404).json({ error: 'Block not found' });
    }

    const patch = normalizePatchPayload(req.body || {});
    const blockType = await getBlockTypeById({ db, userId, typeId: existing.typeId, ensureBuiltins: true });
    if (!blockType) {
      return res.status(404).json({ error: 'Block type not found' });
    }

    const next = {
      ...existing,
      ...patch,
      updatedAt: nowTs()
    };

    if (Object.prototype.hasOwnProperty.call(patch, 'data')) {
      next.data = deepMergeData(existing.data || {}, patch.data || {});
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'pillarId')) {
      next.pillarId = await resolvePillarIdOrThrow({ userId, pillarId: patch.pillarId });
    }

    next.data = validateDataAgainstSchema(next.data || {}, blockType);

    await db.collection('dayBlocks').doc(blockId).set({
      sectionId: next.sectionId,
      order: next.order,
      isExpanded: next.isExpanded,
      title: next.title,
      subtitle: next.subtitle,
      icon: next.icon,
      pillarId: next.pillarId,
      source: next.source,
      data: next.data,
      updatedAt: next.updatedAt
    }, { merge: true });

    const resolve = parseResolveQuery(req.query.resolve);
    const items = await resolveBlocksMaybe({ userId, blocks: [
      { ...next, isProjected: false }
    ], resolve });

    return res.json(items[0]);
  } catch (error) {
    return respondError(res, error);
  }
});

// DELETE /api/days/:date/blocks/:blockId
router.delete('/:blockId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;
    const blockId = req.params.blockId;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    const projectedRef = parseProjectedBlockRef(blockId);
    if (projectedRef) {
      await deleteProjectedBlock({ userId, date, projectedRef });
      return res.status(204).send();
    }

    const existing = await getStoredDayBlockById({ userId, date, blockId });
    if (!existing) {
      return res.status(404).json({ error: 'Block not found' });
    }

    await db.collection('dayBlocks').doc(blockId).delete();
    return res.status(204).send();
  } catch (error) {
    return respondError(res, error);
  }
});

// PATCH /api/days/:date/blocks/:blockId/move
router.patch('/:blockId/move', async (req, res) => {
  try {
    const userId = req.user.uid;
    const date = req.params.date;
    const blockId = req.params.blockId;

    if (!isValidDateString(date)) {
      throw createValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    if (!isPlainObject(req.body)) {
      throw createValidationError('Request body must be an object');
    }

    const sectionId = normalizeSectionFilter(req.body.sectionId);
    if (!sectionId) {
      throw createValidationError('sectionId is required');
    }

    const order = Number(req.body.order);
    if (!Number.isFinite(order)) {
      throw createValidationError('order must be a number');
    }

    const projectedRef = parseProjectedBlockRef(blockId);
    if (projectedRef) {
      await applyProjectedMove({ userId, date, projectedRef, sectionId, order });
      const updated = await fetchBlockByIdWithProjection({ userId, date, blockId });
      const resolve = parseResolveQuery(req.query.resolve);
      const items = await resolveBlocksMaybe({ userId, blocks: [updated], resolve });
      return res.json(items[0]);
    }

    const existing = await getStoredDayBlockById({ userId, date, blockId });
    if (!existing) {
      return res.status(404).json({ error: 'Block not found' });
    }

    const updated = {
      sectionId,
      order: Math.trunc(order),
      updatedAt: nowTs()
    };

    await db.collection('dayBlocks').doc(blockId).set(updated, { merge: true });

    const responseBlock = {
      ...existing,
      ...updated,
      isProjected: false
    };

    const resolve = parseResolveQuery(req.query.resolve);
    const items = await resolveBlocksMaybe({ userId, blocks: [responseBlock], resolve });
    return res.json(items[0]);
  } catch (error) {
    return respondError(res, error);
  }
});

module.exports = router;
