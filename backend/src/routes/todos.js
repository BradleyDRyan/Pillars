const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveValidatedPillarId } = require('../utils/pillarValidation');
const { resolveEventSource, writeUserEventSafe } = require('../services/events');

const router = express.Router();
router.use(flexibleAuth);

const VALID_SECTIONS = new Set(['morning', 'afternoon', 'evening']);
const VALID_STATUS = new Set(['active', 'completed']);
const VALID_ARCHIVE_VISIBILITY = new Set(['exclude', 'include', 'only']);
const MAX_CONTENT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2000;
const TODO_BOUNTY_MAX_ALLOCATIONS = 3;
const TODO_BOUNTY_MIN_POINTS = 1;
const TODO_BOUNTY_MAX_POINTS = 100;
const TODO_BOUNTY_TOTAL_MAX = 150;

function nowTs() {
  return Date.now() / 1000;
}

async function normalizeBountyForTodoCreate({ userId, body, defaultPillarId }) {
  if (!body) {
    return { allocations: null };
  }

  if (Array.isArray(body.bountyAllocations)) {
    if (body.bountyAllocations.length < 1) {
      return { error: 'bountyAllocations must include at least one entry' };
    }
    if (body.bountyAllocations.length > TODO_BOUNTY_MAX_ALLOCATIONS) {
      return { error: `bountyAllocations must include at most ${TODO_BOUNTY_MAX_ALLOCATIONS} entries` };
    }

    const dedup = new Set();
    let total = 0;
    const normalized = [];
    for (const allocation of body.bountyAllocations) {
      if (!allocation || typeof allocation !== 'object') {
        return { error: 'each bounty allocation must be an object' };
      }
      const rawPillarId = typeof allocation.pillarId === 'string' ? allocation.pillarId.trim() : '';
      if (!rawPillarId) {
        return { error: 'bounty allocation pillarId is required' };
      }
      const points = Number(allocation.points);
      if (!Number.isInteger(points) || points < TODO_BOUNTY_MIN_POINTS || points > TODO_BOUNTY_MAX_POINTS) {
        return { error: `bounty allocation points must be an integer between ${TODO_BOUNTY_MIN_POINTS} and ${TODO_BOUNTY_MAX_POINTS}` };
      }
      const pillarId = await resolveValidatedPillarId({ db, userId, pillarId: rawPillarId });
      if (dedup.has(pillarId)) {
        return { error: 'bountyAllocations must use unique pillarId values' };
      }
      dedup.add(pillarId);
      total += points;
      if (total > TODO_BOUNTY_TOTAL_MAX) {
        return { error: `bounty total points cannot exceed ${TODO_BOUNTY_TOTAL_MAX}` };
      }
      normalized.push({ pillarId, points });
    }
    return { allocations: normalized, pillarIds: [...dedup], totalPoints: total };
  }

  const bountyPoints = Number(body.bountyPoints);
  if (Number.isInteger(bountyPoints)) {
    if (bountyPoints < TODO_BOUNTY_MIN_POINTS || bountyPoints > TODO_BOUNTY_MAX_POINTS) {
      return { error: `bountyPoints must be between ${TODO_BOUNTY_MIN_POINTS} and ${TODO_BOUNTY_MAX_POINTS}` };
    }
    const pillarId = defaultPillarId;
    if (!pillarId) {
      return { error: 'pillarId is required to set bountyPoints' };
    }
    return {
      allocations: [{ pillarId, points: bountyPoints }],
      pillarIds: [pillarId],
      totalPoints: bountyPoints
    };
  }

  return { allocations: null };
}

async function normalizeBountyForTodoUpdate({ userId, body, defaultPillarId }) {
  if (!body) {
    return { allocations: null, provided: false, pillarIds: null, totalPoints: null };
  }

  if (hasOwn(body, 'bountyAllocations')) {
    if (body.bountyAllocations === null) {
      return { allocations: [], pillarIds: [], totalPoints: 0, provided: true, clear: true };
    }
    const result = await normalizeBountyForTodoCreate({
      userId,
      body: { bountyAllocations: body.bountyAllocations },
      defaultPillarId
    });
    return { ...result, provided: true };
  }

  if (hasOwn(body, 'bountyPoints')) {
    if (body.bountyPoints === null) {
      return { allocations: [], pillarIds: [], totalPoints: 0, provided: true, clear: true };
    }
    const result = await normalizeBountyForTodoCreate({
      userId,
      body: { bountyPoints: body.bountyPoints },
      defaultPillarId
    });
    return { ...result, provided: true };
  }

  return { allocations: null, provided: false, pillarIds: null, totalPoints: null };
}

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
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

function normalizeString(raw, maxLength) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function isTodoArchived(todo) {
  return todo?.archivedAt !== null && todo?.archivedAt !== undefined;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function hasTodoDueDate(todo) {
  return typeof todo?.dueDate === 'string' && todo.dueDate.trim() !== '';
}

function todoMatchesArchiveVisibility(todo, archiveVisibility) {
  if (archiveVisibility === 'only') {
    return isTodoArchived(todo);
  }
  if (archiveVisibility === 'exclude') {
    return !isTodoArchived(todo);
  }
  return true;
}

function normalizeLabels(rawLabels) {
  if (rawLabels === undefined) {
    return { value: undefined };
  }
  if (!Array.isArray(rawLabels)) {
    return { error: 'labels must be an array of strings' };
  }

  const deduped = [];
  for (const item of rawLabels) {
    if (typeof item !== 'string') {
      return { error: 'labels must be an array of strings' };
    }
    const label = item.trim();
    if (!label) {
      continue;
    }
    if (!deduped.includes(label)) {
      deduped.push(label);
    }
  }

  return { value: deduped };
}

function normalizeSubtaskTitles(rawSubtasks) {
  if (rawSubtasks === undefined) {
    return { value: [] };
  }
  if (!Array.isArray(rawSubtasks)) {
    return { error: 'subtasks must be an array of strings' };
  }

  const titles = rawSubtasks
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 25);

  return { value: titles };
}

function normalizeTodoSchedule(rawSchedule) {
  if (rawSchedule === undefined) {
    return { value: undefined };
  }

  if (!rawSchedule || typeof rawSchedule !== 'object' || Array.isArray(rawSchedule)) {
    return { error: 'schedule must be an object' };
  }

  const normalized = {};
  let hasField = false;

  if (Object.prototype.hasOwnProperty.call(rawSchedule, 'date')) {
    hasField = true;
    if (rawSchedule.date === null || rawSchedule.date === '') {
      normalized.dueDate = null;
    } else if (!isValidDateString(rawSchedule.date)) {
      return { error: 'schedule.date must use YYYY-MM-DD format' };
    } else {
      normalized.dueDate = rawSchedule.date;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawSchedule, 'sectionId')) {
    hasField = true;
    if (rawSchedule.sectionId === null || rawSchedule.sectionId === '') {
      // Null/empty means "leave section as-is/default"
    } else if (!VALID_SECTIONS.has(rawSchedule.sectionId)) {
      return { error: 'schedule.sectionId must be morning, afternoon, or evening' };
    } else {
      normalized.sectionId = rawSchedule.sectionId;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawSchedule, 'order')) {
    hasField = true;
    if (rawSchedule.order === null || rawSchedule.order === '') {
      // Null/empty means "leave order as-is/default"
    } else {
      const parsedOrder = Number(rawSchedule.order);
      if (!Number.isFinite(parsedOrder)) {
        return { error: 'schedule.order must be a number or null' };
      }
      normalized.order = Math.trunc(parsedOrder);
    }
  }

  if (!hasField) {
    return { error: 'schedule must include at least one of: date, sectionId, order' };
  }

  return { value: normalized };
}

function normalizeTodoPayload(body, options = {}) {
  const partial = options.partial === true;
  const normalized = {};

  const hasContent = Object.prototype.hasOwnProperty.call(body || {}, 'content');
  if (hasContent) {
    const content = normalizeString(body.content, MAX_CONTENT_LENGTH);
    if (!content) {
      return { error: 'content is required' };
    }
    normalized.content = content;
  } else if (!partial) {
    return { error: 'content is required' };
  }

  const hasDescription = Object.prototype.hasOwnProperty.call(body || {}, 'description');
  if (hasDescription) {
    if (body.description === null) {
      normalized.description = '';
    } else {
      normalized.description = normalizeString(body.description, MAX_DESCRIPTION_LENGTH) || '';
    }
  } else if (!partial) {
    normalized.description = '';
  }

  if (hasOwn(body, 'bountyReason')) {
    if (body.bountyReason === null) {
      normalized.bountyReason = null;
    } else if (typeof body.bountyReason !== 'string') {
      return { error: 'bountyReason must be a string or null' };
    } else {
      const trimmed = body.bountyReason.trim();
      normalized.bountyReason = trimmed || null;
    }
  } else if (!partial) {
    normalized.bountyReason = null;
  }

  if (hasOwn(body, 'bountyPoints')) {
    if (body.bountyPoints === null) {
      normalized.bountyPoints = null;
    } else {
      const points = Number(body.bountyPoints);
      if (!Number.isInteger(points) || points < TODO_BOUNTY_MIN_POINTS || points > TODO_BOUNTY_MAX_POINTS) {
        return { error: `bountyPoints must be an integer between ${TODO_BOUNTY_MIN_POINTS} and ${TODO_BOUNTY_MAX_POINTS}` };
      }
      normalized.bountyPoints = points;
    }
  } else if (!partial) {
    normalized.bountyPoints = null;
  }

  if (hasOwn(body, 'bountyPillarId')) {
    if (body.bountyPillarId === null) {
      normalized.bountyPillarId = null;
    } else if (typeof body.bountyPillarId !== 'string') {
      return { error: 'bountyPillarId must be a string or null' };
    } else {
      const trimmed = body.bountyPillarId.trim();
      normalized.bountyPillarId = trimmed || null;
    }
  } else if (!partial) {
    normalized.bountyPillarId = null;
  }

  const hasDueDate = Object.prototype.hasOwnProperty.call(body || {}, 'dueDate');
  if (hasDueDate) {
    if (body.dueDate === null || body.dueDate === '') {
      normalized.dueDate = null;
    } else if (!isValidDateString(body.dueDate)) {
      return { error: 'dueDate must use YYYY-MM-DD format' };
    } else {
      normalized.dueDate = body.dueDate;
    }
  } else if (!partial) {
    normalized.dueDate = null;
  }

  const hasSectionId = Object.prototype.hasOwnProperty.call(body || {}, 'sectionId');
  if (hasSectionId) {
    if (!VALID_SECTIONS.has(body.sectionId)) {
      return { error: 'sectionId must be morning, afternoon, or evening' };
    }
    normalized.sectionId = body.sectionId;
  } else if (!partial) {
    normalized.sectionId = 'afternoon';
  }

  const hasPriority = Object.prototype.hasOwnProperty.call(body || {}, 'priority');
  if (hasPriority) {
    const parsedPriority = Number(body.priority);
    if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 4) {
      return { error: 'priority must be an integer between 1 and 4' };
    }
    normalized.priority = parsedPriority;
  } else if (!partial) {
    normalized.priority = 1;
  }

  const hasParentId = Object.prototype.hasOwnProperty.call(body || {}, 'parentId');
  if (hasParentId) {
    if (body.parentId === null || body.parentId === '') {
      normalized.parentId = null;
    } else if (typeof body.parentId !== 'string') {
      return { error: 'parentId must be a string or null' };
    } else {
      normalized.parentId = body.parentId.trim() || null;
    }
  } else if (!partial) {
    normalized.parentId = null;
  }

  const hasStatus = Object.prototype.hasOwnProperty.call(body || {}, 'status');
  if (hasStatus) {
    if (!VALID_STATUS.has(body.status)) {
      return { error: 'status must be active or completed' };
    }
    normalized.status = body.status;
  } else if (!partial) {
    normalized.status = 'active';
  }

  const hasOrder = Object.prototype.hasOwnProperty.call(body || {}, 'order');
  if (hasOrder) {
    const parsedOrder = Number(body.order);
    if (!Number.isFinite(parsedOrder)) {
      return { error: 'order must be a number' };
    }
    normalized.order = Math.trunc(parsedOrder);
  } else if (!partial) {
    normalized.order = 0;
  }

  const labelsResult = normalizeLabels(body?.labels);
  if (labelsResult.error) {
    return { error: labelsResult.error };
  }
  if (labelsResult.value !== undefined) {
    normalized.labels = labelsResult.value;
  } else if (!partial) {
    normalized.labels = [];
  }

  const hasPillarId = Object.prototype.hasOwnProperty.call(body || {}, 'pillarId');
  if (hasPillarId) {
    normalized.pillarId = body.pillarId;
  } else if (!partial) {
    normalized.pillarId = null;
  }

  const scheduleResult = normalizeTodoSchedule(body?.schedule);
  if (scheduleResult.error) {
    return { error: scheduleResult.error };
  }
  if (scheduleResult.value !== undefined) {
    Object.assign(normalized, scheduleResult.value);
  }

  return { data: normalized };
}

function applyTodoFilters(todos, filters) {
  return todos.filter(todo => {
    if (!todoMatchesArchiveVisibility(todo, filters.archiveVisibility || 'exclude')) {
      return false;
    }
    if (filters.status !== 'all' && todo.status !== filters.status) {
      return false;
    }
    if (filters.dueDateFilter === 'none' && hasTodoDueDate(todo)) {
      return false;
    }
    if (filters.dueDateFilter === 'exact' && todo.dueDate !== filters.dueDateValue) {
      return false;
    }
    if (filters.sectionId && todo.sectionId !== filters.sectionId) {
      return false;
    }
    if (filters.parentIdFilter === 'none' && todo.parentId) {
      return false;
    }
    if (filters.parentIdFilter === 'has-parent' && !todo.parentId) {
      return false;
    }
    if (typeof filters.parentIdValue === 'string' && todo.parentId !== filters.parentIdValue) {
      return false;
    }
    if (filters.pillarFilter === 'none' && todo.pillarId) {
      return false;
    }
    if (typeof filters.pillarValue === 'string' && todo.pillarId !== filters.pillarValue) {
      return false;
    }
    if (filters.search) {
      const labels = Array.isArray(todo.labels) ? todo.labels.join(' ') : '';
      const haystack = `${todo.content || ''} ${todo.description || ''} ${labels}`.toLowerCase();
      if (!haystack.includes(filters.search)) {
        return false;
      }
    }
    return true;
  });
}

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    const aOrder = Number.isFinite(a.order) ? a.order : 0;
    const bOrder = Number.isFinite(b.order) ? b.order : 0;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

function toResponseTodo(todo) {
  return {
    ...todo,
    pillarId: typeof todo?.pillarId === 'string' ? todo.pillarId : null,
    archivedAt: typeof todo?.archivedAt === 'number' ? todo.archivedAt : null
  };
}

function buildTodoScheduledProjection(todo) {
  if (!todo || typeof todo.id !== 'string') {
    return null;
  }
  if (!isValidDateString(todo.dueDate)) {
    return null;
  }

  return {
    date: todo.dueDate,
    blockId: `proj_todo_${todo.id}`
  };
}

function buildTodoChangePaths(partialPayload) {
  if (!partialPayload || typeof partialPayload !== 'object') {
    return [];
  }

  return Object.keys(partialPayload)
    .filter(key => key !== 'source')
    .map(key => `todo.${key}`);
}

async function listTodosByUser(userId) {
  let snapshot;
  let queryMode = 'indexed-user-createdAt';

  try {
    snapshot = await db.collection('todos')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    queryMode = 'fallback-no-index';
    snapshot = await db.collection('todos')
      .where('userId', '==', userId)
      .get();
  }

  const todos = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
      return aCreated - bCreated;
    });

  return { todos, queryMode };
}

async function getTodoById(todoId) {
  const todoDoc = await db.collection('todos').doc(todoId).get();
  if (!todoDoc.exists) {
    return null;
  }
  return toResponseTodo({ id: todoDoc.id, ...todoDoc.data() });
}

function ensureTodoOwner(todo, userId) {
  return Boolean(todo && todo.userId === userId);
}

async function listSubtasks(userId, parentId, options = {}) {
  const archiveVisibility = options.archiveVisibility || 'exclude';

  try {
    const snapshot = await db.collection('todos')
      .where('userId', '==', userId)
      .where('parentId', '==', parentId)
      .get();

    return sortTodos(
      snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(todo => todoMatchesArchiveVisibility(todo, archiveVisibility))
    );
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallback = await listTodosByUser(userId);
    return sortTodos(
      fallback.todos.filter(todo => todo.parentId === parentId && todoMatchesArchiveVisibility(todo, archiveVisibility))
    );
  }
}

function decorateTodo(todo, subtasks) {
  if (!subtasks) {
    return toResponseTodo(todo);
  }
  return {
    ...toResponseTodo(todo),
    subtasks: subtasks.map(toResponseTodo)
  };
}

function parseStatusQuery(value) {
  if (value === undefined || value === null) {
    return { value: 'active' };
  }
  if (typeof value !== 'string') {
    return { error: 'status must be active, completed, or all' };
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return { value: 'active' };
  }
  if (normalized !== 'active' && normalized !== 'completed' && normalized !== 'all') {
    return { error: 'status must be active, completed, or all' };
  }
  return { value: normalized };
}

function parseDueDateQuery(value) {
  if (value === undefined || value === null) {
    return { dueDateFilter: 'all', dueDateValue: null };
  }

  if (typeof value !== 'string') {
    return { error: 'dueDate must use YYYY-MM-DD format or "none"' };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { dueDateFilter: 'all', dueDateValue: null };
  }

  const lower = normalized.toLowerCase();
  if (lower === 'all' || lower === 'any') {
    return { dueDateFilter: 'all', dueDateValue: null };
  }
  if (lower === 'none' || lower === 'null') {
    return { dueDateFilter: 'none', dueDateValue: null };
  }

  if (!isValidDateString(normalized)) {
    return { error: 'dueDate must use YYYY-MM-DD format or "none"' };
  }

  return { dueDateFilter: 'exact', dueDateValue: normalized };
}

function parseSectionIdQuery(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }
  if (typeof value !== 'string') {
    return { error: 'sectionId must be morning, afternoon, or evening' };
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return { value: null };
  }
  if (!VALID_SECTIONS.has(normalized)) {
    return { error: 'sectionId must be morning, afternoon, or evening' };
  }

  return { value: normalized };
}

function parseSearchQuery(rawQ, rawSearch) {
  if (rawQ !== undefined && rawQ !== null && typeof rawQ !== 'string') {
    return { error: 'q must be a string' };
  }
  if (rawSearch !== undefined && rawSearch !== null && typeof rawSearch !== 'string') {
    return { error: 'search must be a string' };
  }

  const normalizedQ = typeof rawQ === 'string' ? rawQ.trim().toLowerCase() : '';
  if (normalizedQ) {
    return { value: normalizedQ };
  }

  const normalizedSearch = typeof rawSearch === 'string' ? rawSearch.trim().toLowerCase() : '';
  return { value: normalizedSearch };
}

function parseParentFilter(parentId) {
  if (parentId === undefined || parentId === null) {
    return { parentIdFilter: 'none', parentIdValue: null };
  }
  if (typeof parentId !== 'string') {
    return { error: 'parentId must be "none", "any", "all", or a specific todo id' };
  }

  const normalized = parentId.trim();
  if (!normalized || normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'null') {
    return { parentIdFilter: 'none', parentIdValue: null };
  }
  if (normalized.toLowerCase() === 'any') {
    return { parentIdFilter: 'has-parent', parentIdValue: null };
  }
  if (normalized.toLowerCase() === 'all') {
    return { parentIdFilter: 'all', parentIdValue: null };
  }

  return { parentIdFilter: 'exact', parentIdValue: normalized };
}

function parsePillarFilter(pillarId) {
  if (pillarId === undefined || pillarId === null) {
    return { pillarFilter: 'all', pillarValue: null };
  }

  if (typeof pillarId !== 'string') {
    return { error: 'pillarId must be a string or "none"' };
  }

  const normalized = pillarId.trim();
  if (!normalized) {
    return { error: 'pillarId must be a string or "none"' };
  }

  const lower = normalized.toLowerCase();
  if (lower === 'none' || lower === 'null') {
    return { pillarFilter: 'none', pillarValue: null };
  }

  return { pillarFilter: 'exact', pillarValue: normalized };
}

function parseArchiveVisibility(rawArchived, rawIncludeArchived) {
  if (rawArchived !== undefined && rawArchived !== null && rawArchived !== '') {
    if (typeof rawArchived !== 'string') {
      return { error: 'archived must be exclude, include, or only' };
    }

    const normalized = rawArchived.trim().toLowerCase();
    if (!VALID_ARCHIVE_VISIBILITY.has(normalized)) {
      return { error: 'archived must be exclude, include, or only' };
    }

    return { value: normalized };
  }

  if (rawIncludeArchived !== undefined) {
    const normalized = String(rawIncludeArchived).trim().toLowerCase();
    if (normalized === 'true') {
      return { value: 'include' };
    }
    if (normalized === 'false') {
      return { value: 'exclude' };
    }
    return { error: 'includeArchived must be true or false' };
  }

  return { value: 'exclude' };
}

function isInvalidPillarIdError(error) {
  return error?.status === 400 && error?.message === 'Invalid pillarId';
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const statusResult = parseStatusQuery(req.query.status);
    if (statusResult.error) {
      return res.status(400).json({ error: statusResult.error });
    }

    const includeSubtasks = toBoolean(req.query.includeSubtasks, false);
    const flat = toBoolean(req.query.flat, false);
    const searchResult = parseSearchQuery(req.query.q, req.query.search);
    if (searchResult.error) {
      return res.status(400).json({ error: searchResult.error });
    }
    const search = searchResult.value;
    const dueDateResult = parseDueDateQuery(req.query.dueDate);
    if (dueDateResult.error) {
      return res.status(400).json({ error: dueDateResult.error });
    }
    const sectionIdResult = parseSectionIdQuery(req.query.sectionId);
    if (sectionIdResult.error) {
      return res.status(400).json({ error: sectionIdResult.error });
    }

    const parentFilter = parseParentFilter(req.query.parentId);
    if (parentFilter.error) {
      return res.status(400).json({ error: parentFilter.error });
    }
    const pillarFilter = parsePillarFilter(req.query.pillarId);
    if (pillarFilter.error) {
      return res.status(400).json({ error: pillarFilter.error });
    }
    const archiveVisibilityResult = parseArchiveVisibility(req.query.archived, req.query.includeArchived);
    if (archiveVisibilityResult.error) {
      return res.status(400).json({ error: archiveVisibilityResult.error });
    }
    const { todos, queryMode } = await listTodosByUser(userId);
    const filtered = applyTodoFilters(todos, {
      status: statusResult.value,
      dueDateFilter: dueDateResult.dueDateFilter,
      dueDateValue: dueDateResult.dueDateValue,
      sectionId: sectionIdResult.value,
      parentIdFilter: parentFilter.parentIdFilter,
      parentIdValue: parentFilter.parentIdValue,
      pillarFilter: pillarFilter.pillarFilter,
      pillarValue: pillarFilter.pillarValue,
      archiveVisibility: archiveVisibilityResult.value,
      search
    });

    const sorted = sortTodos(filtered).map(toResponseTodo);

    const parentFilterTargetsChildren =
      parentFilter.parentIdFilter === 'exact' || parentFilter.parentIdFilter === 'has-parent';
    if (parentFilterTargetsChildren) {
      return res.json({
        queryMode,
        count: sorted.length,
        items: sorted
      });
    }

    if (flat) {
      return res.json({
        queryMode,
        count: sorted.length,
        items: sorted
      });
    }

    const rootTodos = sorted.filter(todo => !todo.parentId);
    if (!includeSubtasks) {
      return res.json({
        queryMode,
        count: rootTodos.length,
        items: rootTodos
      });
    }

    const childFiltered = applyTodoFilters(todos, {
      status: statusResult.value,
      dueDateFilter: dueDateResult.dueDateFilter,
      dueDateValue: dueDateResult.dueDateValue,
      sectionId: sectionIdResult.value,
      parentIdFilter: 'has-parent',
      parentIdValue: null,
      pillarFilter: pillarFilter.pillarFilter,
      pillarValue: pillarFilter.pillarValue,
      archiveVisibility: archiveVisibilityResult.value,
      search
    });

    const childrenByParent = new Map();
    childFiltered.forEach(todo => {
      if (!todo.parentId) {
        return;
      }
      if (!childrenByParent.has(todo.parentId)) {
        childrenByParent.set(todo.parentId, []);
      }
      childrenByParent.get(todo.parentId).push(toResponseTodo(todo));
    });

    const items = rootTodos.map(todo => decorateTodo(todo, sortTodos(childrenByParent.get(todo.id) || [])));

    return res.json({
      queryMode,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('[todos] GET / error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const normalized = normalizeTodoPayload(req.body || {}, { partial: false });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const subtasksResult = normalizeSubtaskTitles(req.body?.subtasks);
    if (subtasksResult.error) {
      return res.status(400).json({ error: subtasksResult.error });
    }

    const requestedId = typeof req.body?.id === 'string' && req.body.id.trim()
      ? req.body.id.trim()
      : null;

    const todosCollection = db.collection('todos');
    const todoRef = requestedId ? todosCollection.doc(requestedId) : todosCollection.doc();

    if (requestedId) {
      const existing = await todoRef.get();
      if (existing.exists) {
        return res.status(409).json({ error: 'Todo with this id already exists' });
      }
    }

    let validatedPillarId;
    try {
      validatedPillarId = await resolveValidatedPillarId({
        db,
        userId,
        pillarId: normalized.data.pillarId
      });
    } catch (error) {
      if (isInvalidPillarIdError(error)) {
        return res.status(400).json({ error: 'Invalid pillarId' });
      }
      throw error;
    }

    let validatedBountyPillarId = null;
    if (normalized.data.bountyPillarId) {
      try {
        validatedBountyPillarId = await resolveValidatedPillarId({
          db,
          userId,
          pillarId: normalized.data.bountyPillarId
        });
      } catch (error) {
        if (isInvalidPillarIdError(error)) {
          return res.status(400).json({ error: 'Invalid bountyPillarId' });
        }
        throw error;
      }
    }

    const bountyResult = await normalizeBountyForTodoCreate({
      userId,
      body: req.body || {},
      defaultPillarId: validatedBountyPillarId ?? validatedPillarId ?? null
    });
    if (bountyResult.error) {
      return res.status(400).json({ error: bountyResult.error });
    }

    const now = nowTs();
    const payload = {
      id: todoRef.id,
      userId,
      content: normalized.data.content,
      description: normalized.data.description,
      dueDate: normalized.data.dueDate,
      sectionId: normalized.data.sectionId,
      priority: normalized.data.priority,
      pillarId: validatedPillarId ?? null,
      parentId: normalized.data.parentId,
      status: normalized.data.status,
      labels: normalized.data.labels,
      order: normalized.data.order,
      createdAt: now,
      updatedAt: now,
      completedAt: normalized.data.status === 'completed' ? now : null,
      archivedAt: null,
      bountyPoints: bountyResult.allocations && bountyResult.allocations.length === 1 ? bountyResult.allocations[0].points : (normalized.data.bountyPoints ?? null),
      bountyAllocations: bountyResult.allocations || null,
      bountyPillarId: validatedBountyPillarId,
      bountyReason: normalized.data.bountyReason ?? null,
      bountyPaidAt: null
    };

    const batch = db.batch();
    batch.set(todoRef, payload);

    const createdSubtasks = [];
    for (const [index, title] of subtasksResult.value.entries()) {
      const subtaskRef = todosCollection.doc();
      const subtaskPayload = {
        id: subtaskRef.id,
        userId,
        content: title,
        description: '',
        dueDate: payload.dueDate,
        sectionId: payload.sectionId,
        priority: payload.priority,
        pillarId: payload.pillarId,
        parentId: todoRef.id,
        status: 'active',
        labels: [],
        order: index,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        archivedAt: null
      };
      createdSubtasks.push(subtaskPayload);
      batch.set(subtaskRef, subtaskPayload);
    }

    await batch.commit();

    await writeUserEventSafe({
      userId,
      type: 'todo.created',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      todoId: payload.id,
      title: payload.content,
      parentId: payload.parentId || null,
      date: payload.dueDate || null
    });

    const todoResponse = {
      ...toResponseTodo(payload),
      subtasks: createdSubtasks.map(toResponseTodo)
    };
    const scheduled = buildTodoScheduledProjection(todoResponse);

    // Return ergonomic response while keeping legacy top-level todo fields.
    return res.status(201).json({
      ...todoResponse,
      todo: todoResponse,
      scheduled
    });
  } catch (error) {
    console.error('[todos] POST / error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/subtasks', async (req, res) => {
  try {
    const userId = req.user.uid;
    const archiveVisibilityResult = parseArchiveVisibility(req.query.archived, req.query.includeArchived);
    if (archiveVisibilityResult.error) {
      return res.status(400).json({ error: archiveVisibilityResult.error });
    }
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const subtasks = await listSubtasks(userId, req.params.id, {
      archiveVisibility: archiveVisibilityResult.value
    });
    return res.json(subtasks.map(toResponseTodo));
  } catch (error) {
    console.error('[todos] GET /:id/subtasks error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/subtasks', async (req, res) => {
  try {
    const userId = req.user.uid;
    const parentTodo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(parentTodo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const normalized = normalizeTodoPayload(
      {
        ...req.body,
        parentId: req.params.id,
        dueDate: req.body?.dueDate === undefined ? parentTodo.dueDate : req.body?.dueDate,
        sectionId: req.body?.sectionId === undefined ? parentTodo.sectionId : req.body?.sectionId,
        priority: req.body?.priority === undefined ? parentTodo.priority : req.body?.priority,
        pillarId: req.body?.pillarId === undefined ? parentTodo.pillarId ?? null : req.body?.pillarId
      },
      { partial: false }
    );
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    let validatedPillarId;
    try {
      validatedPillarId = await resolveValidatedPillarId({
        db,
        userId,
        pillarId: normalized.data.pillarId
      });
    } catch (error) {
      if (isInvalidPillarIdError(error)) {
        return res.status(400).json({ error: 'Invalid pillarId' });
      }
      throw error;
    }

    const ref = db.collection('todos').doc();
    const now = nowTs();
    const payload = {
      id: ref.id,
      userId,
      content: normalized.data.content,
      description: normalized.data.description,
      dueDate: normalized.data.dueDate,
      sectionId: normalized.data.sectionId,
      priority: normalized.data.priority,
      pillarId: validatedPillarId ?? null,
      parentId: req.params.id,
      status: normalized.data.status,
      labels: normalized.data.labels,
      order: normalized.data.order,
      createdAt: now,
      updatedAt: now,
      completedAt: normalized.data.status === 'completed' ? now : null,
      archivedAt: null
    };

    await ref.set(payload);
    await writeUserEventSafe({
      userId,
      type: 'todo.created',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      todoId: payload.id,
      title: payload.content,
      parentId: payload.parentId || null,
      date: payload.dueDate || null
    });
    return res.status(201).json(toResponseTodo(payload));
  } catch (error) {
    console.error('[todos] POST /:id/subtasks error:', error);
    return res.status(500).json({ error: error.message });
  }
});

async function closeTodoHandler(req, res) {
  try {
    const userId = req.user.uid;
    const cascade = toBoolean(req.query.cascade, true);
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const now = nowTs();
    const batch = db.batch();
    const todoRef = db.collection('todos').doc(req.params.id);
    batch.set(todoRef, {
      status: 'completed',
      completedAt: now,
      updatedAt: now
    }, { merge: true });

    if (cascade) {
      const subtasks = await listSubtasks(userId, req.params.id);
      subtasks.forEach(subtask => {
        batch.set(db.collection('todos').doc(subtask.id), {
          status: 'completed',
          completedAt: now,
          updatedAt: now
        }, { merge: true });
      });
    }

    await batch.commit();
    const updated = await getTodoById(req.params.id);
    const source = resolveEventSource({
      explicitSource: req.body?.source,
      authSource: req.user?.source
    });
    await writeUserEventSafe({
      userId,
      type: 'todo.closed',
      source,
      timestamp: now,
      todoId: updated?.id || req.params.id,
      title: updated?.content || null,
      date: updated?.dueDate || null
    });
    return res.json(toResponseTodo(updated));
  } catch (error) {
    console.error('[todos] POST /:id/close error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function reopenTodoHandler(req, res) {
  try {
    const userId = req.user.uid;
    const cascade = toBoolean(req.query.cascade, true);
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const now = nowTs();
    const batch = db.batch();
    const todoRef = db.collection('todos').doc(req.params.id);
    batch.set(todoRef, {
      status: 'active',
      completedAt: null,
      updatedAt: now
    }, { merge: true });

    if (cascade) {
      const subtasks = await listSubtasks(userId, req.params.id);
      subtasks.forEach(subtask => {
        batch.set(db.collection('todos').doc(subtask.id), {
          status: 'active',
          completedAt: null,
          updatedAt: now
        }, { merge: true });
      });
    }

    await batch.commit();
    const updated = await getTodoById(req.params.id);
    await writeUserEventSafe({
      userId,
      type: 'todo.reopened',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      todoId: updated?.id || req.params.id,
      title: updated?.content || null,
      date: updated?.dueDate || null
    });
    return res.json(toResponseTodo(updated));
  } catch (error) {
    console.error('[todos] POST /:id/reopen error:', error);
    return res.status(500).json({ error: error.message });
  }
}

router.post('/:id/close', closeTodoHandler);
router.post('/:id/complete', closeTodoHandler);
router.post('/:id/reopen', reopenTodoHandler);
router.post('/:id/incomplete', reopenTodoHandler);

router.post('/:id/archive', async (req, res) => {
  try {
    const userId = req.user.uid;
    const cascade = toBoolean(req.query.cascade, true);
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const now = nowTs();
    const batch = db.batch();
    const todoRef = db.collection('todos').doc(req.params.id);
    batch.set(todoRef, {
      archivedAt: now,
      updatedAt: now
    }, { merge: true });

    if (cascade) {
      const subtasks = await listSubtasks(userId, req.params.id, { archiveVisibility: 'include' });
      subtasks.forEach(subtask => {
        batch.set(db.collection('todos').doc(subtask.id), {
          archivedAt: now,
          updatedAt: now
        }, { merge: true });
      });
    }

    await batch.commit();
    const updated = await getTodoById(req.params.id);
    await writeUserEventSafe({
      userId,
      type: 'todo.archived',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      todoId: updated?.id || req.params.id,
      title: updated?.content || null,
      date: updated?.dueDate || null
    });
    return res.json(toResponseTodo(updated));
  } catch (error) {
    console.error('[todos] POST /:id/archive error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/unarchive', async (req, res) => {
  try {
    const userId = req.user.uid;
    const cascade = toBoolean(req.query.cascade, true);
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const now = nowTs();
    const batch = db.batch();
    const todoRef = db.collection('todos').doc(req.params.id);
    batch.set(todoRef, {
      archivedAt: null,
      updatedAt: now
    }, { merge: true });

    if (cascade) {
      const subtasks = await listSubtasks(userId, req.params.id, { archiveVisibility: 'include' });
      subtasks.forEach(subtask => {
        batch.set(db.collection('todos').doc(subtask.id), {
          archivedAt: null,
          updatedAt: now
        }, { merge: true });
      });
    }

    await batch.commit();
    const updated = await getTodoById(req.params.id);
    await writeUserEventSafe({
      userId,
      type: 'todo.unarchived',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      todoId: updated?.id || req.params.id,
      title: updated?.content || null,
      date: updated?.dueDate || null
    });
    return res.json(toResponseTodo(updated));
  } catch (error) {
    console.error('[todos] POST /:id/unarchive error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const includeSubtasks = toBoolean(req.query.includeSubtasks, true);
    const archiveVisibilityResult = parseArchiveVisibility(req.query.archived, req.query.includeArchived);
    if (archiveVisibilityResult.error) {
      return res.status(400).json({ error: archiveVisibilityResult.error });
    }
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (!includeSubtasks) {
      return res.json(toResponseTodo(todo));
    }

    const subtasks = await listSubtasks(userId, req.params.id, {
      archiveVisibility: archiveVisibilityResult.value
    });
    return res.json(decorateTodo(todo, subtasks));
  } catch (error) {
    console.error('[todos] GET /:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

const updateTodoHandler = async (req, res) => {
  try {
    const userId = req.user.uid;
    const existing = await getTodoById(req.params.id);
    if (!ensureTodoOwner(existing, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const normalized = normalizeTodoPayload(req.body || {}, { partial: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    if (normalized.data.parentId && normalized.data.parentId === req.params.id) {
      return res.status(400).json({ error: 'A todo cannot be its own parent' });
    }

    const mergedStatus = normalized.data.status || existing.status || 'active';
    const now = nowTs();

    const payload = {
      ...normalized.data,
      updatedAt: now
    };

    if (Object.prototype.hasOwnProperty.call(normalized.data, 'pillarId')) {
      try {
        payload.pillarId = await resolveValidatedPillarId({
          db,
          userId,
          pillarId: normalized.data.pillarId
        });
      } catch (error) {
        if (isInvalidPillarIdError(error)) {
          return res.status(400).json({ error: 'Invalid pillarId' });
        }
        throw error;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyPillarId')) {
      if (normalized.data.bountyPillarId === null) {
        payload.bountyPillarId = null;
      } else {
        try {
          payload.bountyPillarId = await resolveValidatedPillarId({
            db,
            userId,
            pillarId: normalized.data.bountyPillarId
          });
        } catch (error) {
          if (isInvalidPillarIdError(error)) {
            return res.status(400).json({ error: 'Invalid bountyPillarId' });
          }
          throw error;
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyReason')) {
      payload.bountyReason = normalized.data.bountyReason;
    }

    const bountyUpdate = await normalizeBountyForTodoUpdate({
      userId,
      body: req.body || {},
      defaultPillarId: payload.pillarId ?? existing.pillarId ?? null
    });
    if (bountyUpdate.error) {
      return res.status(400).json({ error: bountyUpdate.error });
    }
    if (bountyUpdate.provided) {
      if (bountyUpdate.clear) {
        payload.bountyAllocations = null;
        payload.bountyPoints = null;
      } else if (bountyUpdate.allocations) {
        payload.bountyAllocations = bountyUpdate.allocations;
        payload.bountyPoints = bountyUpdate.allocations.length === 1 ? bountyUpdate.allocations[0].points : null;
      }
      payload.bountyPaidAt = null;
    }

    if (Object.prototype.hasOwnProperty.call(normalized.data, 'status')) {
      payload.completedAt = mergedStatus === 'completed' ? (existing.completedAt || now) : null;
    }

    await db.collection('todos').doc(req.params.id).set(payload, { merge: true });

    const updated = await getTodoById(req.params.id);
    const statusChanged = Object.prototype.hasOwnProperty.call(normalized.data, 'status')
      && normalized.data.status !== existing.status;
    if (statusChanged) {
      return res.status(400).json({ error: 'Use POST /api/todos/:id/close or /reopen to change status.' });
    }

    let eventType = 'todo.updated';

    const source = resolveEventSource({
      explicitSource: req.body?.source,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: eventType,
      source,
      timestamp: now,
      todoId: updated?.id || req.params.id,
      title: updated?.content || existing.content || null,
      date: updated?.dueDate || existing.dueDate || null,
      changes: buildTodoChangePaths(normalized.data)
    });
    const todoResponse = toResponseTodo(updated || existing);
    const scheduled = buildTodoScheduledProjection(todoResponse);
    return res.json({
      ...todoResponse,
      todo: todoResponse,
      scheduled
    });
  } catch (error) {
    console.error(`[todos] ${req.method} /:id error:`, error);
    return res.status(500).json({ error: error.message });
  }
};

router.put('/:id', updateTodoHandler);
router.patch('/:id', updateTodoHandler);

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const cascade = toBoolean(req.query.cascade, true);
    const todo = await getTodoById(req.params.id);
    if (!ensureTodoOwner(todo, userId)) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const batch = db.batch();
    batch.delete(db.collection('todos').doc(req.params.id));

    if (cascade) {
      const subtasks = await listSubtasks(userId, req.params.id, { archiveVisibility: 'include' });
      subtasks.forEach(subtask => {
        batch.delete(db.collection('todos').doc(subtask.id));
      });
    }

    await batch.commit();
    await writeUserEventSafe({
      userId,
      type: 'todo.deleted',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: nowTs(),
      todoId: todo.id || req.params.id,
      title: todo.content || null,
      date: todo.dueDate || null
    });
    return res.status(204).send();
  } catch (error) {
    console.error('[todos] DELETE /:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
