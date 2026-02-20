const express = require('express');
const router = express.Router();

const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { Pillar, Principle, Insight } = require('../models');

router.use(flexibleAuth);

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const CANONICAL_SECTION_IDS = Object.freeze(['morning', 'afternoon', 'evening']);
const DISABLED_DEFAULT_NATIVE_TYPE_SET = new Set(['sleep', 'feeling', 'workout', 'reflection']);

const VALID_INCLUDE = new Set(['todos', 'habits', 'pillars', 'principles', 'insights']);
const DEFAULT_INCLUDE = ['todos', 'habits', 'pillars', 'principles'];
const VALID_TODO_STATUS = new Set(['active', 'completed', 'all']);
const VALID_TODO_ARCHIVE_VISIBILITY = new Set(['exclude', 'include', 'only']);

const RESOLVE_TRUTHY = new Set(['true', '1', 'yes', 'on', 'blockinheritance']);
const RESOLVE_FALSY = new Set(['false', '0', 'no', 'off']);

const BUILTIN_BLOCK_TYPES = Object.freeze([
  { id: 'sleep', name: 'Sleep', icon: 'moon.zzz.fill', subtitleTemplate: '{score}% - {durationHours}h' },
  { id: 'feeling', name: 'Mood', icon: 'heart.fill', subtitleTemplate: 'Energy {energy} - Mood {mood}' },
  { id: 'workout', name: 'Workout', icon: 'figure.run', subtitleTemplate: '{type} - {duration}' },
  { id: 'reflection', name: 'Reflection', icon: 'sparkles', subtitleTemplate: '{freeText}' },
  { id: 'habits', name: 'Habit', icon: 'checkmark.circle', subtitleTemplate: '{status}' },
  { id: 'todo', name: 'To-Do', icon: 'checklist', subtitleTemplate: '{status}' }
]);

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function parseDateUtc(dateStr) {
  if (!isValidDateString(dateStr)) {
    return null;
  }

  const [year, month, day] = dateStr.split('-').map(value => Number(value));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.toISOString().slice(0, 10) !== dateStr) {
    return null;
  }

  return date;
}

function formatDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(date, delta) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function buildDateListInclusive(fromDate, toDate) {
  const values = [];
  let cursor = parseDateUtc(fromDate);
  const end = parseDateUtc(toDate);

  while (cursor && end && cursor <= end) {
    values.push(formatDateUtc(cursor));
    cursor = addDaysUtc(cursor, 1);
  }

  return values;
}

function parseCsvTokenSet(
  rawValue,
  {
    allowed,
    label,
    defaultValue = [],
    remap = null,
    allowUnknown = false
  }
) {
  if (rawValue === undefined || rawValue === null) {
    return { value: [...defaultValue] };
  }

  const raw = Array.isArray(rawValue)
    ? rawValue.join(',')
    : String(rawValue);

  if (!raw.trim()) {
    return { value: [] };
  }

  const seen = new Set();
  const values = [];
  const tokens = raw
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (!allowed.has(normalized)) {
      if (allowUnknown) {
        continue;
      }
      return { error: `Unknown ${label} value: ${token}` };
    }

    const finalValue = remap ? remap(normalized) : normalized;
    if (!seen.has(finalValue)) {
      seen.add(finalValue);
      values.push(finalValue);
    }
  }

  return { value: values };
}

function parseResolveValues(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return { value: [] };
  }

  const raw = Array.isArray(rawValue)
    ? rawValue.join(',')
    : String(rawValue);

  if (!raw.trim()) {
    return { value: [] };
  }

  let includeBlockInheritance = false;
  const tokens = raw
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (RESOLVE_TRUTHY.has(token)) {
      includeBlockInheritance = true;
      continue;
    }

    if (RESOLVE_FALSY.has(token)) {
      continue;
    }

    // Ignore unknown resolve tokens for lenient parsing.
  }

  return { value: includeBlockInheritance ? ['blockInheritance'] : [] };
}

function parseTodoStatus(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: 'active' };
  }

  if (typeof rawValue !== 'string') {
    return { error: 'todoStatus must be active, completed, or all' };
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!VALID_TODO_STATUS.has(normalized)) {
    return { error: 'todoStatus must be active, completed, or all' };
  }

  return { value: normalized };
}

function isTodoArchived(todo) {
  return todo?.archivedAt !== null && todo?.archivedAt !== undefined;
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

function parseTodoArchiveVisibility(rawValue, rawIncludeArchived) {
  if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
    if (typeof rawValue !== 'string') {
      return { error: 'todoArchived must be exclude, include, or only' };
    }

    const normalized = rawValue.trim().toLowerCase();
    if (!VALID_TODO_ARCHIVE_VISIBILITY.has(normalized)) {
      return { error: 'todoArchived must be exclude, include, or only' };
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

function parseDateWindow(query) {
  const hasFromDate = Object.prototype.hasOwnProperty.call(query, 'fromDate');
  const hasToDate = Object.prototype.hasOwnProperty.call(query, 'toDate');

  if (hasFromDate || hasToDate) {
    if (!hasFromDate || !hasToDate) {
      return { error: 'fromDate and toDate are both required when using an explicit range' };
    }

    const fromDate = typeof query.fromDate === 'string' ? query.fromDate.trim() : '';
    const toDate = typeof query.toDate === 'string' ? query.toDate.trim() : '';

    if (!isValidDateString(fromDate) || !parseDateUtc(fromDate)) {
      return { error: 'fromDate must use YYYY-MM-DD format' };
    }

    if (!isValidDateString(toDate) || !parseDateUtc(toDate)) {
      return { error: 'toDate must use YYYY-MM-DD format' };
    }

    if (fromDate > toDate) {
      return { error: 'fromDate must be less than or equal to toDate' };
    }

    const dateList = buildDateListInclusive(fromDate, toDate);
    if (dateList.length > MAX_DAYS) {
      return { error: `Date range cannot exceed ${MAX_DAYS} days` };
    }

    return {
      value: {
        fromDate,
        toDate,
        daysRequested: dateList.length,
        dateList
      }
    };
  }

  let daysRequested = DEFAULT_DAYS;
  if (query.days !== undefined) {
    const parsed = Number(query.days);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) {
      return { error: `days must be an integer between 1 and ${MAX_DAYS}` };
    }

    daysRequested = parsed;
  }

  const toDate = formatDateUtc(new Date());
  const fromDate = formatDateUtc(addDaysUtc(parseDateUtc(toDate), -(daysRequested - 1)));
  const dateList = buildDateListInclusive(fromDate, toDate);

  return {
    value: {
      fromDate,
      toDate,
      daysRequested,
      dateList
    }
  };
}

function sortByOrderThenCreatedAt(a, b) {
  const aOrder = Number.isFinite(a?.order) ? a.order : 0;
  const bOrder = Number.isFinite(b?.order) ? b.order : 0;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  const aCreated = typeof a?.createdAt === 'number' ? a.createdAt : 0;
  const bCreated = typeof b?.createdAt === 'number' ? b.createdAt : 0;
  if (aCreated !== bCreated) {
    return aCreated - bCreated;
  }

  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

function isDisabledDefaultNativeType(typeId) {
  if (typeof typeId !== 'string') {
    return false;
  }
  return DISABLED_DEFAULT_NATIVE_TYPE_SET.has(typeId.trim().toLowerCase());
}

function normalizeBlock(rawBlock, docId) {
  if (!rawBlock || typeof rawBlock !== 'object') {
    return null;
  }
  if (isDisabledDefaultNativeType(rawBlock.typeId)) {
    return null;
  }

  return {
    id: docId,
    ...rawBlock
  };
}

function flattenDayBlocks(sections) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.flatMap(section => {
    const sectionId = section?.id;
    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    return blocks.map(block => ({
      ...block,
      sectionId
    }));
  });
}

function buildDayPayloadFromBlocks({ userId, date, blocks }) {
  const sections = CANONICAL_SECTION_IDS.map(sectionId => ({
    id: sectionId,
    blocks: []
  }));
  const sectionMap = new Map(sections.map(section => [section.id, section]));

  blocks
    .filter(block => typeof block?.sectionId === 'string' && sectionMap.has(block.sectionId))
    .sort((a, b) => {
      const sectionDiff = CANONICAL_SECTION_IDS.indexOf(a.sectionId) - CANONICAL_SECTION_IDS.indexOf(b.sectionId);
      if (sectionDiff !== 0) {
        return sectionDiff;
      }
      return sortByOrderThenCreatedAt(a, b);
    })
    .forEach(block => {
      sectionMap.get(block.sectionId).blocks.push(block);
    });

  sections.forEach(section => {
    section.blocks = section.blocks.sort(sortByOrderThenCreatedAt);
  });

  const createdAtCandidates = blocks
    .map(block => (typeof block.createdAt === 'number' ? block.createdAt : null))
    .filter(value => value !== null);
  const updatedAtCandidates = blocks
    .map(block => (typeof block.updatedAt === 'number' ? block.updatedAt : null))
    .filter(value => value !== null);

  return {
    id: `day_${userId}_${date}`,
    userId,
    date,
    sections,
    blocks: flattenDayBlocks(sections),
    createdAt: createdAtCandidates.length > 0 ? Math.min(...createdAtCandidates) : null,
    updatedAt: updatedAtCandidates.length > 0 ? Math.max(...updatedAtCandidates) : null
  };
}

function normalizeTimestampToSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime() / 1000;
  }

  if (value && typeof value.toDate === 'function') {
    try {
      return value.toDate().getTime() / 1000;
    } catch (_) {
      return null;
    }
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed / 1000;
    }
  }

  return null;
}

function normalizeDaySectionsFromDayDoc(rawSections) {
  const sourceSections = Array.isArray(rawSections) ? rawSections : [];
  const sectionMap = new Map();

  sourceSections.forEach(section => {
    const sectionId = typeof section?.id === 'string'
      ? section.id.trim().toLowerCase()
      : null;

    if (!sectionId || !CANONICAL_SECTION_IDS.includes(sectionId) || sectionMap.has(sectionId)) {
      return;
    }

    const blocks = Array.isArray(section?.blocks)
      ? section.blocks
        .filter(block => block && typeof block === 'object')
        .filter(block => !isDisabledDefaultNativeType(block.typeId))
        .map(block => ({ ...block }))
        .sort(sortByOrderThenCreatedAt)
      : [];

    sectionMap.set(sectionId, {
      id: sectionId,
      blocks
    });
  });

  return CANONICAL_SECTION_IDS.map(sectionId => (
    sectionMap.get(sectionId) || { id: sectionId, blocks: [] }
  ));
}

function dayRecencyValue(day) {
  const updated = normalizeTimestampToSeconds(day.updatedAt);
  if (updated !== null) {
    return updated;
  }

  const created = normalizeTimestampToSeconds(day.createdAt);
  if (created !== null) {
    return created;
  }

  return 0;
}

async function listDayDocumentsByRange(userId, fromDate, toDate) {
  let snapshot;
  let queryMode = 'indexed-days-user-date-range';

  try {
    snapshot = await db.collection('days')
      .where('userId', '==', userId)
      .where('date', '>=', fromDate)
      .where('date', '<=', toDate)
      .orderBy('date', 'asc')
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    queryMode = 'fallback-days-no-range-index';
    snapshot = await db.collection('days')
      .where('userId', '==', userId)
      .get();
  }

  const daysByDate = new Map();

  snapshot.docs.forEach(doc => {
    const data = doc.data() || {};
    const date = data.date;

    if (!isValidDateString(date)) {
      return;
    }
    if (date < fromDate || date > toDate) {
      return;
    }

    const sections = normalizeDaySectionsFromDayDoc(data.sections);
    const day = {
      id: doc.id,
      ...data,
      date,
      sections,
      blocks: flattenDayBlocks(sections),
      createdAt: normalizeTimestampToSeconds(data.createdAt),
      updatedAt: normalizeTimestampToSeconds(data.updatedAt)
    };

    const existing = daysByDate.get(date);
    if (!existing || dayRecencyValue(day) >= dayRecencyValue(existing)) {
      daysByDate.set(date, day);
    }
  });

  const days = Array.from(daysByDate.values())
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  return {
    items: days,
    queryMode
  };
}

async function listDayBlocksByRange(userId, fromDate, toDate) {
  let snapshot;
  let queryMode = 'indexed-dayBlocks-user-date-range';

  try {
    snapshot = await db.collection('dayBlocks')
      .where('userId', '==', userId)
      .where('date', '>=', fromDate)
      .where('date', '<=', toDate)
      .orderBy('date', 'asc')
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    queryMode = 'fallback-dayBlocks-no-range-index';
    snapshot = await db.collection('dayBlocks')
      .where('userId', '==', userId)
      .get();
  }

  const blocksByDate = new Map();

  snapshot.docs.forEach(doc => {
    const data = doc.data() || {};
    const date = data.date;

    if (!isValidDateString(date)) {
      return;
    }
    if (date < fromDate || date > toDate) {
      return;
    }

    const block = normalizeBlock(data, doc.id);
    if (!block) {
      return;
    }

    if (!blocksByDate.has(date)) {
      blocksByDate.set(date, []);
    }

    blocksByDate.get(date).push(block);
  });

  const days = Array.from(blocksByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, blocks]) => buildDayPayloadFromBlocks({
      userId,
      date,
      blocks
    }));

  return {
    items: days,
    queryMode
  };
}

async function listDaysByRange(userId, fromDate, toDate) {
  const daysResult = await listDayDocumentsByRange(userId, fromDate, toDate);
  if (daysResult.items.length > 0) {
    return daysResult;
  }

  const dayBlocksResult = await listDayBlocksByRange(userId, fromDate, toDate);
  return {
    items: dayBlocksResult.items,
    queryMode: `${daysResult.queryMode}->${dayBlocksResult.queryMode}`
  };
}

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    const aOrder = Number.isFinite(a?.order) ? a.order : 0;
    const bOrder = Number.isFinite(b?.order) ? b.order : 0;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aCreated = typeof a?.createdAt === 'number' ? a.createdAt : 0;
    const bCreated = typeof b?.createdAt === 'number' ? b.createdAt : 0;
    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

function toResponseTodo(todo) {
  return {
    ...todo,
    pillarId: typeof todo?.pillarId === 'string' ? todo.pillarId : null,
    archivedAt: typeof todo?.archivedAt === 'number' ? todo.archivedAt : null
  };
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

function decorateTodo(todo, subtasks) {
  return {
    ...toResponseTodo(todo),
    subtasks: subtasks.map(toResponseTodo)
  };
}

async function fetchTodosForContext(userId, todoStatus, todoArchiveVisibility) {
  const { todos, queryMode } = await listTodosByUser(userId);
  const filtered = todos.filter(todo => {
    if (!todoMatchesArchiveVisibility(todo, todoArchiveVisibility)) {
      return false;
    }

    if (todoStatus === 'all') {
      return true;
    }

    return todo.status === todoStatus;
  });

  const sorted = sortTodos(filtered).map(toResponseTodo);
  const rootTodos = sorted.filter(todo => !todo.parentId);

  const childrenByParent = new Map();
  sorted.forEach(todo => {
    if (!todo.parentId) {
      return;
    }

    if (!childrenByParent.has(todo.parentId)) {
      childrenByParent.set(todo.parentId, []);
    }

    childrenByParent.get(todo.parentId).push(todo);
  });

  const items = rootTodos.map(todo => decorateTodo(todo, sortTodos(childrenByParent.get(todo.id) || [])));

  return {
    items,
    queryMode
  };
}

function toResponseHabit(habit) {
  return {
    ...habit,
    pillarId: typeof habit?.pillarId === 'string' ? habit.pillarId : null
  };
}

async function listHabitsByUser(userId) {
  let snapshot;
  let queryMode = 'indexed-user-createdAt';

  try {
    snapshot = await db.collection('habits')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    queryMode = 'fallback-no-index';
    snapshot = await db.collection('habits')
      .where('userId', '==', userId)
      .get();
  }

  const habits = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
      return aCreated - bCreated;
    });

  return { habits, queryMode };
}

async function fetchHabitsForContext(userId) {
  const { habits, queryMode } = await listHabitsByUser(userId);
  const items = habits
    .filter(habit => habit.isActive)
    .map(toResponseHabit);

  return {
    items,
    queryMode
  };
}

async function fetchPillarsForContext(userId) {
  const pillars = await Pillar.findByUserId(userId, false);
  return pillars.map(pillar => ({ ...pillar }));
}

async function fetchPrinciplesForContext(userId) {
  const principles = await Principle.findByUserId(userId, {});
  return principles.map(principle => ({ ...principle }));
}

async function fetchInsightsForContext(userId) {
  const insights = await Insight.findByUserId(userId, {});
  return insights.map(insight => ({ ...insight }));
}

function toNonEmptyString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formatSubtitleTokenValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (_) {
    return '';
  }
}

function renderSubtitleTemplate(template, data) {
  if (typeof template !== 'string' || !template.trim()) {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const collapsedTemplate = template.replace(/\s+/g, ' ').trim();
    return collapsedTemplate || null;
  }

  const rendered = template.replace(/\{([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_]+)?\}/g, (_, key) => {
    return formatSubtitleTokenValue(data[key]);
  });
  const collapsed = rendered.replace(/\s+/g, ' ').trim();
  return collapsed || null;
}

async function fetchBlockTypeMapForResolution(userId) {
  const snapshot = await db.collection('blockTypes')
    .where('userId', '==', userId)
    .get();

  const map = new Map();
  snapshot.docs.forEach(doc => {
    const data = doc.data() || {};
    const typeId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : doc.id;
    map.set(typeId, {
      id: typeId,
      name: toNonEmptyString(data.name),
      icon: toNonEmptyString(data.icon),
      subtitleTemplate: toNonEmptyString(data.subtitleTemplate),
      category: toNonEmptyString(data.category)
    });
  });

  BUILTIN_BLOCK_TYPES.forEach(type => {
    if (map.has(type.id)) {
      return;
    }

    map.set(type.id, {
      id: type.id,
      name: toNonEmptyString(type.name),
      icon: toNonEmptyString(type.icon),
      subtitleTemplate: toNonEmptyString(type.subtitleTemplate),
      category: 'built-in'
    });
  });

  return map;
}

async function buildPillarMapForResolution(userId) {
  const snapshot = await db.collection('pillars')
    .where('userId', '==', userId)
    .get();

  const map = new Map();
  snapshot.docs.forEach(doc => {
    const pillar = doc.data() || {};
    map.set(doc.id, {
      id: doc.id,
      name: pillar.name || null,
      color: pillar.color || null,
      icon: pillar.icon || null,
      isArchived: Boolean(pillar.isArchived)
    });
  });

  return map;
}

function buildResolvedBlock({ block, blockTypeMap, pillarMap }) {
  const typeId = typeof block?.typeId === 'string' ? block.typeId : '';
  const blockType = typeId ? blockTypeMap.get(typeId) || null : null;

  const inheritedTitle = toNonEmptyString(blockType?.name);
  const inheritedIcon = toNonEmptyString(blockType?.icon);
  const inheritedSubtitle = renderSubtitleTemplate(blockType?.subtitleTemplate, block?.data) || null;

  const resolvedTitle = toNonEmptyString(block?.title) || inheritedTitle || typeId || 'Unknown block';
  const resolvedSubtitle = toNonEmptyString(block?.subtitle) || inheritedSubtitle || null;
  const resolvedIcon = toNonEmptyString(block?.icon) || inheritedIcon || 'questionmark.square.dashed';

  const category = toNonEmptyString(blockType?.category);
  const source = category === 'built-in' || category === 'custom' ? category : 'unknown';

  const pillarId = typeof block?.pillarId === 'string' ? block.pillarId : null;
  const pillar = pillarId ? (pillarMap.get(pillarId) || null) : null;

  return {
    title: resolvedTitle,
    subtitle: resolvedSubtitle,
    icon: resolvedIcon,
    pillar,
    source
  };
}

async function applyBlockInheritanceResolution(days, userId) {
  const [blockTypeMap, pillarMap] = await Promise.all([
    fetchBlockTypeMapForResolution(userId),
    buildPillarMapForResolution(userId)
  ]);

  return days.map(day => {
    const sections = Array.isArray(day.sections) ? day.sections : [];
    const resolvedSections = sections.map(section => {
      const blocks = Array.isArray(section.blocks) ? section.blocks : [];
      const resolvedBlocks = blocks.map(block => ({
        ...block,
        resolved: buildResolvedBlock({
          block,
          blockTypeMap,
          pillarMap
        })
      }));

      return {
        ...section,
        blocks: resolvedBlocks
      };
    });

    return {
      ...day,
      sections: resolvedSections,
      blocks: flattenDayBlocks(resolvedSections)
    };
  });
}

router.get('/', async (req, res) => {
  const startedAt = Date.now();

  try {
    const userId = req.user.uid;

    const windowResult = parseDateWindow(req.query);
    if (windowResult.error) {
      return res.status(400).json({ error: windowResult.error });
    }

    const includeResult = parseCsvTokenSet(req.query.include, {
      allowed: VALID_INCLUDE,
      label: 'include',
      defaultValue: DEFAULT_INCLUDE,
      allowUnknown: true
    });
    if (includeResult.error) {
      return res.status(400).json({ error: includeResult.error });
    }

    const resolveResult = parseResolveValues(req.query.resolve);

    const todoStatusResult = parseTodoStatus(req.query.todoStatus);
    if (todoStatusResult.error) {
      return res.status(400).json({ error: todoStatusResult.error });
    }
    const todoArchiveResult = parseTodoArchiveVisibility(req.query.todoArchived, req.query.includeArchived);
    if (todoArchiveResult.error) {
      return res.status(400).json({ error: todoArchiveResult.error });
    }

    const include = includeResult.value;
    const resolve = resolveResult.value;
    const todoStatus = todoStatusResult.value;
    const todoArchiveVisibility = todoArchiveResult.value;
    const window = windowResult.value;

    console.info('[context] GET / start', {
      userId,
      fromDate: window.fromDate,
      toDate: window.toDate,
      daysRequested: window.daysRequested,
      include,
      resolve,
      todoStatus,
      todoArchiveVisibility
    });

    const includeSet = new Set(include);
    const resolveSet = new Set(resolve);

    const includeTasks = [];

    if (includeSet.has('todos')) {
      includeTasks.push({
        key: 'todos',
        promise: fetchTodosForContext(userId, todoStatus, todoArchiveVisibility)
      });
    }
    if (includeSet.has('habits')) {
      includeTasks.push({ key: 'habits', promise: fetchHabitsForContext(userId) });
    }
    if (includeSet.has('pillars')) {
      includeTasks.push({ key: 'pillars', promise: fetchPillarsForContext(userId) });
    }
    if (includeSet.has('principles')) {
      includeTasks.push({ key: 'principles', promise: fetchPrinciplesForContext(userId) });
    }
    if (includeSet.has('insights')) {
      includeTasks.push({ key: 'insights', promise: fetchInsightsForContext(userId) });
    }

    const [dayResult, includeResults] = await Promise.all([
      listDaysByRange(userId, window.fromDate, window.toDate),
      Promise.allSettled(includeTasks.map(task => task.promise))
    ]);

    const payload = {
      days: dayResult.items,
      todos: [],
      habits: [],
      pillars: [],
      principles: [],
      insights: []
    };

    const queryModes = {
      days: dayResult.queryMode
    };

    const errors = {};
    let partial = false;

    includeResults.forEach((result, index) => {
      const task = includeTasks[index];
      if (!task) {
        return;
      }

      if (result.status === 'fulfilled') {
        const value = result.value;

        if (task.key === 'todos') {
          payload.todos = value.items;
          queryModes.todos = value.queryMode;
          return;
        }

        if (task.key === 'habits') {
          payload.habits = value.items;
          queryModes.habits = value.queryMode;
          return;
        }

        payload[task.key] = value;
        return;
      }

      partial = true;
      const reason = result.reason;
      const message = reason && reason.message ? reason.message : 'Unknown error';
      errors[task.key] = message;
      payload[task.key] = [];

      console.error('[context] include fetch failed', {
        userId,
        includeKey: task.key,
        message
      });
    });

    if (resolveSet.has('blockInheritance')) {
      try {
        payload.days = await applyBlockInheritanceResolution(payload.days, userId);
      } catch (error) {
        partial = true;
        errors.resolve = error.message || 'Failed to resolve block inheritance';

        console.error('[context] resolve blockInheritance failed', {
          userId,
          message: error.message
        });
      }
    }

    const returnedDayDates = new Set(
      payload.days
        .map(day => (typeof day?.date === 'string' ? day.date : null))
        .filter(Boolean)
    );
    const missingDates = window.dateList.filter(date => !returnedDayDates.has(date));

    const response = {
      meta: {
        fromDate: window.fromDate,
        toDate: window.toDate,
        daysRequested: window.daysRequested,
        daysReturned: payload.days.length,
        missingDates,
        include,
        resolve,
        todoStatus,
        todoArchiveVisibility,
        partial,
        errors,
        generatedAt: new Date().toISOString(),
        queryModes
      },
      days: payload.days,
      todos: payload.todos,
      habits: payload.habits,
      pillars: payload.pillars,
      principles: payload.principles,
      insights: payload.insights
    };

    const durationMs = Date.now() - startedAt;
    console.info('[context] GET / success', {
      userId,
      durationMs,
      partial,
      include,
      resolve,
      daysReturned: payload.days.length,
      missingDates: missingDates.length,
      queryModes,
      errorKeys: Object.keys(errors)
    });

    return res.json(response);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error('[context] GET / error:', {
      userId: req.user?.uid,
      message: error.message,
      durationMs
    });

    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
