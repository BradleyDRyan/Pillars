const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveValidatedPillarId } = require('../utils/pillarValidation');
const { resolveEventSource, writeUserEventSafe } = require('../services/events');

const router = express.Router();
router.use(flexibleAuth);

const VALID_SECTIONS = new Set(['morning', 'afternoon', 'evening']);
const VALID_WEEKDAYS = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
const VALID_TARGET_TYPES = new Set(['binary', 'count', 'duration']);
const VALID_HABIT_STATUS = new Set(['active', 'inactive', 'all']);
const VALID_HABIT_LOG_STATUS = new Set(['completed', 'skipped', 'pending']);
const VALID_ARCHIVE_VISIBILITY = new Set(['exclude', 'include', 'only']);
const HABIT_BOUNTY_MIN_POINTS = 1;
const HABIT_BOUNTY_MAX_ALLOCATION_POINTS = 100;
const HABIT_BOUNTY_MAX_SINGLE_POINTS = 100;
const HABIT_BOUNTY_MAX_ALLOCATIONS = 3;
const HABIT_BOUNTY_TOTAL_MAX = 150;

function nowTs() {
  return Date.now() / 1000;
}

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isHabitArchived(habit) {
  return habit?.archivedAt !== null && habit?.archivedAt !== undefined;
}

function habitMatchesArchiveVisibility(habit, archiveVisibility) {
  if (archiveVisibility === 'only') {
    return isHabitArchived(habit);
  }
  if (archiveVisibility === 'exclude') {
    return !isHabitArchived(habit);
  }
  return true;
}

function dateToWeekday(dateStr) {
  const [year, month, day] = dateStr.split('-').map(value => Number(value));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][utcDate.getUTCDay()];
}

function normalizeString(raw, maxLength = 255) {
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

function normalizeHabitGroupName(rawName) {
  return normalizeString(rawName, 80);
}

function normalizeDaysOfWeek(rawDays) {
  if (rawDays === undefined || rawDays === null) {
    return { value: [] };
  }
  if (!Array.isArray(rawDays)) {
    return { error: 'schedule.daysOfWeek must be an array of weekdays' };
  }

  const normalized = [];
  for (const rawDay of rawDays) {
    const day = typeof rawDay === 'string' ? rawDay.trim().toLowerCase() : '';
    if (!VALID_WEEKDAYS.has(day)) {
      return { error: 'schedule.daysOfWeek accepts: sunday..saturday' };
    }
    if (!normalized.includes(day)) {
      normalized.push(day);
    }
  }

  return { value: normalized };
}

function normalizeSchedule(rawSchedule, partial) {
  if (rawSchedule === undefined) {
    return partial ? { value: undefined } : { value: { type: 'daily', daysOfWeek: [] } };
  }
  if (!rawSchedule || typeof rawSchedule !== 'object') {
    return { error: 'schedule must be an object' };
  }

  const scheduleType = typeof rawSchedule.type === 'string'
    ? rawSchedule.type.trim().toLowerCase()
    : 'daily';

  if (scheduleType !== 'daily' && scheduleType !== 'weekly') {
    return { error: 'schedule.type must be daily or weekly' };
  }

  const daysResult = normalizeDaysOfWeek(rawSchedule.daysOfWeek);
  if (daysResult.error) {
    return { error: daysResult.error };
  }

  if (scheduleType === 'weekly' && daysResult.value.length === 0) {
    return { error: 'weekly schedules require at least one day in schedule.daysOfWeek' };
  }

  return {
    value: {
      type: scheduleType,
      daysOfWeek: scheduleType === 'weekly' ? daysResult.value : []
    }
  };
}

function normalizeTarget(rawTarget, partial) {
  if (rawTarget === undefined) {
    return partial ? { value: undefined } : { value: { type: 'binary', value: 1, unit: null } };
  }
  if (!rawTarget || typeof rawTarget !== 'object') {
    return { error: 'target must be an object' };
  }

  const type = typeof rawTarget.type === 'string'
    ? rawTarget.type.trim().toLowerCase()
    : 'binary';
  if (!VALID_TARGET_TYPES.has(type)) {
    return { error: 'target.type must be binary, count, or duration' };
  }

  const rawValue = rawTarget.value === undefined ? 1 : Number(rawTarget.value);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return { error: 'target.value must be a positive number' };
  }

  const unit = rawTarget.unit === null || rawTarget.unit === undefined
    ? null
    : normalizeString(rawTarget.unit, 40);

  return {
    value: {
      type,
      value: rawValue,
      unit
    }
  };
}

function normalizeBountyReason(rawReason) {
  if (rawReason === null) {
    return { value: null };
  }
  if (rawReason === undefined) {
    return { value: undefined };
  }
  if (typeof rawReason !== 'string') {
    return { error: 'bountyReason must be a string or null' };
  }
  const trimmed = rawReason.trim();
  if (!trimmed) {
    return { value: null };
  }
  if (trimmed.length > 500) {
    return { error: 'bountyReason must be 500 characters or fewer' };
  }
  return { value: trimmed };
}

async function normalizeBountyForHabitCreate({ userId, body, defaultPillarId }) {
  if (!body) {
    return { allocations: null };
  }

  if (Array.isArray(body.bountyAllocations)) {
    if (body.bountyAllocations.length < 1) {
      return { error: 'bountyAllocations must include at least one entry' };
    }
    if (body.bountyAllocations.length > HABIT_BOUNTY_MAX_ALLOCATIONS) {
      return {
        error: `bountyAllocations must include at most ${HABIT_BOUNTY_MAX_ALLOCATIONS} entries`
      };
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
      if (!Number.isInteger(points)
        || points < HABIT_BOUNTY_MIN_POINTS
        || points > HABIT_BOUNTY_MAX_ALLOCATION_POINTS) {
        return {
          error: `bounty allocation points must be an integer between ${HABIT_BOUNTY_MIN_POINTS} and ${HABIT_BOUNTY_MAX_ALLOCATION_POINTS}`
        };
      }

      const pillarId = await resolveValidatedPillarId({ db, userId, pillarId: rawPillarId });
      if (dedup.has(pillarId)) {
        return { error: 'bountyAllocations must use unique pillarId values' };
      }

      dedup.add(pillarId);
      total += points;
      if (total > HABIT_BOUNTY_TOTAL_MAX) {
        return { error: `bounty total points cannot exceed ${HABIT_BOUNTY_TOTAL_MAX}` };
      }

      normalized.push({ pillarId, points });
    }

    return { allocations: normalized, totalPoints: total };
  }

  if (body.bountyPoints === null || body.bountyPoints === undefined || body.bountyPoints === '') {
    return { allocations: null };
  }

  const bountyPoints = Number(body.bountyPoints);
  if (Number.isInteger(bountyPoints)) {
    if (bountyPoints < HABIT_BOUNTY_MIN_POINTS || bountyPoints > HABIT_BOUNTY_MAX_SINGLE_POINTS) {
      return {
        error: `bountyPoints must be between ${HABIT_BOUNTY_MIN_POINTS} and ${HABIT_BOUNTY_MAX_SINGLE_POINTS}`
      };
    }

    const resolvedPillarId = typeof body.bountyPillarId === 'string' && body.bountyPillarId.trim()
      ? body.bountyPillarId.trim()
      : defaultPillarId;

    if (!resolvedPillarId) {
      return { error: 'pillarId is required to set bountyPoints' };
    }

    const pillarId = await resolveValidatedPillarId({ db, userId, pillarId: resolvedPillarId });
    return {
      allocations: [{ pillarId, points: bountyPoints }],
      totalPoints: bountyPoints
    };
  }

  return { error: `bountyPoints must be between ${HABIT_BOUNTY_MIN_POINTS} and ${HABIT_BOUNTY_MAX_SINGLE_POINTS}` };
}

async function normalizeBountyForHabitUpdate({ userId, body, defaultPillarId }) {
  if (!body) {
    return { allocations: null, provided: false, totalPoints: null };
  }

  if (Object.prototype.hasOwnProperty.call(body, 'bountyAllocations')) {
    if (body.bountyAllocations === null) {
      return { allocations: [], provided: true, clear: true, totalPoints: 0 };
    }
    const result = await normalizeBountyForHabitCreate({
      userId,
      body: { bountyAllocations: body.bountyAllocations },
      defaultPillarId
    });
    return { ...result, provided: true };
  }

  if (Object.prototype.hasOwnProperty.call(body, 'bountyPoints')) {
    if (body.bountyPoints === null) {
      return { allocations: [], provided: true, clear: true, totalPoints: 0 };
    }
    const payload = {
      bountyPoints: body.bountyPoints,
      bountyPillarId: body.bountyPillarId
    };
    const result = await normalizeBountyForHabitCreate({
      userId,
      body: payload,
      defaultPillarId
    });
    return { ...result, provided: true };
  }

  return { allocations: null, provided: false, totalPoints: null };
}

function normalizeHabitPayload(body, options = {}) {
  const partial = options.partial === true;
  const payload = {};

  const hasName = Object.prototype.hasOwnProperty.call(body || {}, 'name');
  if (hasName) {
    const name = normalizeString(body.name, 200);
    if (!name) {
      return { error: 'name is required' };
    }
    payload.name = name;
  } else if (!partial) {
    return { error: 'name is required' };
  }

  const hasDescription = Object.prototype.hasOwnProperty.call(body || {}, 'description');
  if (hasDescription) {
    payload.description = body.description === null
      ? ''
      : (normalizeString(body.description, 2000) || '');
  } else if (!partial) {
    payload.description = '';
  }

  const hasSectionId = Object.prototype.hasOwnProperty.call(body || {}, 'sectionId');
  if (hasSectionId) {
    if (!VALID_SECTIONS.has(body.sectionId)) {
      return { error: 'sectionId must be morning, afternoon, or evening' };
    }
    payload.sectionId = body.sectionId;
  } else if (!partial) {
    payload.sectionId = 'morning';
  }

  const scheduleResult = normalizeSchedule(body?.schedule, partial);
  if (scheduleResult.error) {
    return { error: scheduleResult.error };
  }
  if (scheduleResult.value !== undefined) {
    payload.schedule = scheduleResult.value;
  }

  const targetResult = normalizeTarget(body?.target, partial);
  if (targetResult.error) {
    return { error: targetResult.error };
  }
  if (targetResult.value !== undefined) {
    payload.target = targetResult.value;
  }

  const hasIsActive = Object.prototype.hasOwnProperty.call(body || {}, 'isActive');
  if (hasIsActive) {
    payload.isActive = Boolean(body.isActive);
  } else if (!partial) {
    payload.isActive = true;
  }

  const hasPillarId = Object.prototype.hasOwnProperty.call(body || {}, 'pillarId');
  if (hasPillarId) {
    payload.pillarId = body.pillarId;
  } else if (!partial) {
    payload.pillarId = null;
  }

  const hasGroupId = Object.prototype.hasOwnProperty.call(body || {}, 'groupId');
  if (hasGroupId) {
    payload.groupId = body.groupId;
  } else if (!partial) {
    payload.groupId = null;
  }

  const hasBountyPillarId = Object.prototype.hasOwnProperty.call(body || {}, 'bountyPillarId');
  if (hasBountyPillarId) {
    payload.bountyPillarId = body.bountyPillarId;
  } else if (!partial) {
    payload.bountyPillarId = null;
  }

  const bountyReasonResult = normalizeBountyReason(body?.bountyReason);
  if (bountyReasonResult.error) {
    return { error: bountyReasonResult.error };
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'bountyReason')) {
    payload.bountyReason = bountyReasonResult.value;
  } else if (!partial) {
    payload.bountyReason = null;
  }

  const hasBountyPoints = Object.prototype.hasOwnProperty.call(body || {}, 'bountyPoints');
  if (hasBountyPoints) {
    payload.bountyPoints = body.bountyPoints;
  } else if (!partial) {
    payload.bountyPoints = null;
  }

  const hasBountyAllocations = Object.prototype.hasOwnProperty.call(body || {}, 'bountyAllocations');
  if (hasBountyAllocations) {
    payload.bountyAllocations = body.bountyAllocations;
  } else if (!partial) {
    payload.bountyAllocations = null;
  }

  return { data: payload };
}

function normalizeHabitGroupPayload(body, options = {}) {
  const partial = options.partial === true;
  const payload = {};

  const hasName = Object.prototype.hasOwnProperty.call(body || {}, 'name');
  if (hasName) {
    const name = normalizeHabitGroupName(body.name);
    if (!name) {
      return { error: 'name is required' };
    }
    payload.name = name;
  } else if (!partial) {
    return { error: 'name is required' };
  }

  return { data: payload };
}

function normalizeLogPayload(body) {
  const hasCompleted = Object.prototype.hasOwnProperty.call(body || {}, 'completed');
  const hasValue = Object.prototype.hasOwnProperty.call(body || {}, 'value');
  const hasNotes = Object.prototype.hasOwnProperty.call(body || {}, 'notes');
  const hasStatus = Object.prototype.hasOwnProperty.call(body || {}, 'status');

  if (!hasCompleted && !hasValue && !hasNotes && !hasStatus) {
    return { error: 'At least one of completed, status, value, or notes is required' };
  }

  const payload = {};

  if (hasCompleted) {
    payload.completed = Boolean(body.completed);
  }

  if (hasStatus) {
    if (typeof body.status !== 'string') {
      return { error: 'status must be completed, skipped, or pending' };
    }
    const normalized = body.status.trim().toLowerCase();
    if (!normalized) {
      return { error: 'status must be completed, skipped, or pending' };
    }
    if (!VALID_HABIT_LOG_STATUS.has(normalized)) {
      return { error: 'status must be completed, skipped, or pending' };
    }
    payload.status = normalized;
  }

  if (hasValue) {
    if (body.value === null || body.value === undefined || body.value === '') {
      payload.value = null;
    } else {
      const parsed = Number(body.value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { error: 'value must be a non-negative number' };
      }
      payload.value = parsed;
    }
  }

  if (hasNotes) {
    if (body.notes === null) {
      payload.notes = '';
    } else {
      payload.notes = normalizeString(body.notes, 2000) || '';
    }
  }

  return {
    data: payload,
    hasCompleted,
    hasStatus,
    hasValue,
    hasNotes
  };
}

function habitAppliesToDate(habit, dateStr) {
  if (isHabitArchived(habit)) {
    return false;
  }
  if (!habit?.isActive) {
    return false;
  }

  const schedule = habit.schedule || { type: 'daily', daysOfWeek: [] };
  if (schedule.type === 'daily') {
    return true;
  }

  if (schedule.type === 'weekly') {
    const weekday = dateToWeekday(dateStr);
    return Array.isArray(schedule.daysOfWeek)
      ? schedule.daysOfWeek.includes(weekday)
      : false;
  }

  return false;
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

async function getHabitById(habitId) {
  const doc = await db.collection('habits').doc(habitId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

function ensureHabitOwner(habit, userId) {
  return Boolean(habit && habit.userId === userId);
}

async function listHabitGroupsByUser(userId) {
  let snapshot;
  let queryMode = 'indexed-user-createdAt';

  try {
    snapshot = await db.collection('habitGroups')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    queryMode = 'fallback-no-index';
    snapshot = await db.collection('habitGroups')
      .where('userId', '==', userId)
      .get();
  }

  const groups = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
      return aCreated - bCreated;
    });

  return { groups, queryMode };
}

async function getHabitGroupById(groupId) {
  const doc = await db.collection('habitGroups').doc(groupId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

function ensureHabitGroupOwner(group, userId) {
  return Boolean(group && group.userId === userId);
}

function isHabitGroupArchived(group) {
  return group?.archivedAt !== null && group?.archivedAt !== undefined;
}

async function resolveHabitGroupAssignment({ userId, rawGroupId }) {
  if (rawGroupId === undefined) {
    return { provided: false };
  }

  if (rawGroupId === null) {
    return {
      provided: true,
      groupId: null,
      groupName: null
    };
  }

  if (typeof rawGroupId !== 'string') {
    return { error: 'groupId must be a string or null' };
  }

  const normalizedGroupId = rawGroupId.trim();
  if (!normalizedGroupId) {
    return { error: 'groupId must be a string or null' };
  }

  const group = await getHabitGroupById(normalizedGroupId);
  if (!ensureHabitGroupOwner(group, userId)) {
    return { error: 'Habit group not found' };
  }
  if (isHabitGroupArchived(group)) {
    return { error: 'Habit group is archived' };
  }

  return {
    provided: true,
    groupId: group.id,
    groupName: group.name || null
  };
}

function parseStatusQuery(rawStatus, rawActive) {
  if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
    if (typeof rawStatus !== 'string') {
      return { error: 'status must be active, inactive, or all' };
    }

    const normalized = rawStatus.trim().toLowerCase();
    if (!normalized) {
      return { value: 'active' };
    }
    if (!VALID_HABIT_STATUS.has(normalized)) {
      return { error: 'status must be active, inactive, or all' };
    }

    return { value: normalized };
  }

  if (rawActive !== undefined) {
    const normalizedActive = String(rawActive).trim().toLowerCase();
    if (!normalizedActive) {
      return { value: 'active' };
    }
    if (normalizedActive === 'true') {
      return { value: 'active' };
    }
    if (normalizedActive === 'false') {
      return { value: 'inactive' };
    }
    if (normalizedActive === 'all' || normalizedActive === 'any') {
      return { value: 'all' };
    }
    return { error: 'active must be true or false' };
  }

  return { value: 'active' };
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

function parseDayOfWeekQuery(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }
  if (typeof value !== 'string') {
    return { error: 'dayOfWeek must be sunday..saturday' };
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all' || normalized === 'any') {
    return { value: null };
  }
  if (!VALID_WEEKDAYS.has(normalized)) {
    return { error: 'dayOfWeek must be sunday..saturday' };
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

function parseGroupFilter(groupId) {
  if (groupId === undefined || groupId === null) {
    return { groupFilter: 'all', groupValue: null };
  }

  if (typeof groupId !== 'string') {
    return { error: 'groupId must be a string or "none"' };
  }

  const normalized = groupId.trim();
  if (!normalized) {
    return { error: 'groupId must be a string or "none"' };
  }

  const lower = normalized.toLowerCase();
  if (lower === 'none' || lower === 'null') {
    return { groupFilter: 'none', groupValue: null };
  }

  return { groupFilter: 'exact', groupValue: normalized };
}

function applyHabitFilters(habits, filters) {
  return habits.filter(habit => {
    if (!habitMatchesArchiveVisibility(habit, filters.archiveVisibility || 'exclude')) {
      return false;
    }
    if (filters.status === 'active' && !habit.isActive) {
      return false;
    }
    if (filters.status === 'inactive' && habit.isActive) {
      return false;
    }
    if (filters.sectionId && habit.sectionId !== filters.sectionId) {
      return false;
    }
    if (filters.pillarFilter === 'none' && habit.pillarId) {
      return false;
    }
    if (filters.pillarFilter === 'exact' && habit.pillarId !== filters.pillarValue) {
      return false;
    }
    if (filters.groupFilter === 'none' && habit.groupId) {
      return false;
    }
    if (filters.groupFilter === 'exact' && habit.groupId !== filters.groupValue) {
      return false;
    }
    if (filters.dayOfWeek) {
      const schedule = habit.schedule || { type: 'daily', daysOfWeek: [] };
      if (schedule.type === 'weekly') {
        if (!Array.isArray(schedule.daysOfWeek) || !schedule.daysOfWeek.includes(filters.dayOfWeek)) {
          return false;
        }
      } else if (schedule.type !== 'daily') {
        return false;
      }
    }
    if (filters.search) {
      const targetUnit = typeof habit?.target?.unit === 'string' ? habit.target.unit : '';
      const haystack = `${habit.name || ''} ${habit.description || ''} ${targetUnit}`.toLowerCase();
      if (!haystack.includes(filters.search)) {
        return false;
      }
    }
    return true;
  });
}

function isInvalidPillarIdError(error) {
  return error?.status === 400 && error?.message === 'Invalid pillarId';
}

function toResponseHabit(habit) {
  return {
    ...habit,
    pillarId: typeof habit?.pillarId === 'string' ? habit.pillarId : null,
    bountyPillarId: typeof habit?.bountyPillarId === 'string' ? habit.bountyPillarId : null,
    bountyReason: typeof habit?.bountyReason === 'string' ? habit.bountyReason : null,
    bountyPoints: typeof habit?.bountyPoints === 'number' ? Math.trunc(habit.bountyPoints) : null,
    bountyAllocations: Array.isArray(habit?.bountyAllocations) ? habit.bountyAllocations : null,
    groupId: typeof habit?.groupId === 'string' ? habit.groupId : null,
    groupName: typeof habit?.groupName === 'string' ? habit.groupName : null,
    archivedAt: typeof habit?.archivedAt === 'number' ? habit.archivedAt : null
  };
}

function toResponseHabitGroup(group) {
  return {
    ...group,
    archivedAt: typeof group?.archivedAt === 'number' ? group.archivedAt : null
  };
}

function habitLogId(habitId, dateStr) {
  return `${habitId}_${dateStr}`;
}

async function getHabitLog(userId, habitId, dateStr) {
  const logDoc = await db.collection('habitLogs').doc(habitLogId(habitId, dateStr)).get();
  if (!logDoc.exists) {
    return null;
  }

  const payload = { id: logDoc.id, ...logDoc.data() };
  if (payload.userId !== userId) {
    return null;
  }

  return payload;
}

async function listHabitLogsForDate(userId, dateStr) {
  try {
    const snapshot = await db.collection('habitLogs')
      .where('userId', '==', userId)
      .where('date', '==', dateStr)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallbackSnapshot = await db.collection('habitLogs')
      .where('userId', '==', userId)
      .get();

    return fallbackSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(log => log.date === dateStr);
  }
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const statusResult = parseStatusQuery(req.query.status, req.query.active);
    if (statusResult.error) {
      return res.status(400).json({ error: statusResult.error });
    }
    const sectionIdResult = parseSectionIdQuery(req.query.sectionId);
    if (sectionIdResult.error) {
      return res.status(400).json({ error: sectionIdResult.error });
    }
    const dayOfWeekResult = parseDayOfWeekQuery(req.query.dayOfWeek);
    if (dayOfWeekResult.error) {
      return res.status(400).json({ error: dayOfWeekResult.error });
    }
    const searchResult = parseSearchQuery(req.query.q, req.query.search);
    if (searchResult.error) {
      return res.status(400).json({ error: searchResult.error });
    }

    const pillarFilter = parsePillarFilter(req.query.pillarId);
    if (pillarFilter.error) {
      return res.status(400).json({ error: pillarFilter.error });
    }
    const groupFilter = parseGroupFilter(req.query.groupId);
    if (groupFilter.error) {
      return res.status(400).json({ error: groupFilter.error });
    }
    const archiveVisibilityResult = parseArchiveVisibility(req.query.archived, req.query.includeArchived);
    if (archiveVisibilityResult.error) {
      return res.status(400).json({ error: archiveVisibilityResult.error });
    }

    const { habits, queryMode } = await listHabitsByUser(userId);
    const filtered = applyHabitFilters(habits, {
      status: statusResult.value,
      sectionId: sectionIdResult.value,
      dayOfWeek: dayOfWeekResult.value,
      pillarFilter: pillarFilter.pillarFilter,
      pillarValue: pillarFilter.pillarValue,
      groupFilter: groupFilter.groupFilter,
      groupValue: groupFilter.groupValue,
      archiveVisibility: archiveVisibilityResult.value,
      search: searchResult.value
    });

    return res.json({
      queryMode,
      count: filtered.length,
      items: filtered.map(toResponseHabit)
    });
  } catch (error) {
    console.error('[habits] GET / error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const normalized = normalizeHabitPayload(req.body || {}, { partial: false });
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

    let validatedBountyPillarId = null;
    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyPillarId')) {
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

    const bountyCreate = await normalizeBountyForHabitCreate({
      userId,
      body: {
        bountyPoints: normalized.data.bountyPoints,
        bountyAllocations: normalized.data.bountyAllocations,
        bountyPillarId: validatedBountyPillarId ?? normalized.data.bountyPillarId
      },
      defaultPillarId: validatedPillarId ?? null
    });
    if (bountyCreate.error) {
      return res.status(400).json({ error: bountyCreate.error });
    }

    const groupResolution = await resolveHabitGroupAssignment({
      userId,
      rawGroupId: normalized.data.groupId
    });
    if (groupResolution.error) {
      return res.status(400).json({ error: groupResolution.error });
    }

    const requestedId = typeof req.body?.id === 'string' && req.body.id.trim()
      ? req.body.id.trim()
      : null;

    const habitsCollection = db.collection('habits');
    const habitRef = requestedId ? habitsCollection.doc(requestedId) : habitsCollection.doc();

    if (requestedId) {
      const existing = await habitRef.get();
      if (existing.exists) {
        return res.status(409).json({ error: 'Habit with this id already exists' });
      }
    }

    const now = nowTs();
    const payload = {
      id: habitRef.id,
      userId,
      ...normalized.data,
      pillarId: validatedPillarId ?? null,
      bountyPillarId: validatedBountyPillarId ?? null,
      bountyAllocations: bountyCreate.allocations || null,
      bountyPoints: bountyCreate.allocations
        ? (bountyCreate.allocations.length === 1 ? bountyCreate.allocations[0].points : null)
        : null,
      groupId: groupResolution.provided ? (groupResolution.groupId ?? null) : null,
      groupName: groupResolution.provided ? (groupResolution.groupName ?? null) : null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };

    await habitRef.set(payload);
    await writeUserEventSafe({
      userId,
      type: 'habit.created',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      habitId: payload.id,
      name: payload.name,
      sectionId: payload.sectionId,
      date: null
    });
    const habitResponse = toResponseHabit(payload);
    return res.status(201).json({
      ...habitResponse,
      habit: habitResponse
    });
  } catch (error) {
    console.error('[habits] POST / error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const userId = req.user.uid;
    const archiveVisibilityResult = parseArchiveVisibility(req.query.archived, req.query.includeArchived);
    if (archiveVisibilityResult.error) {
      return res.status(400).json({ error: archiveVisibilityResult.error });
    }

    const { groups, queryMode } = await listHabitGroupsByUser(userId);
    const filtered = groups.filter(group => habitMatchesArchiveVisibility(group, archiveVisibilityResult.value));

    return res.json({
      queryMode,
      count: filtered.length,
      items: filtered.map(toResponseHabitGroup)
    });
  } catch (error) {
    console.error('[habits] GET /groups error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const userId = req.user.uid;
    const normalized = normalizeHabitGroupPayload(req.body || {}, { partial: false });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const now = nowTs();
    const groupRef = db.collection('habitGroups').doc();
    const payload = {
      id: groupRef.id,
      userId,
      name: normalized.data.name,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };

    await groupRef.set(payload);
    return res.status(201).json(toResponseHabitGroup(payload));
  } catch (error) {
    console.error('[habits] POST /groups error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const existing = await getHabitGroupById(req.params.id);
    if (!ensureHabitGroupOwner(existing, userId)) {
      return res.status(404).json({ error: 'Habit group not found' });
    }

    const normalized = normalizeHabitGroupPayload(req.body || {}, { partial: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    if (!Object.keys(normalized.data).length) {
      return res.status(400).json({ error: 'At least one update field is required' });
    }

    const payload = {
      ...normalized.data,
      updatedAt: nowTs()
    };

    await db.collection('habitGroups').doc(req.params.id).set(payload, { merge: true });
    const updated = await getHabitGroupById(req.params.id);
    return res.json(toResponseHabitGroup(updated || existing));
  } catch (error) {
    console.error('[habits] PUT /groups/:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const hardDelete = String(req.query.hard || '').toLowerCase() === 'true';

    const existing = await getHabitGroupById(req.params.id);
    if (!ensureHabitGroupOwner(existing, userId)) {
      return res.status(404).json({ error: 'Habit group not found' });
    }

    if (hardDelete) {
      await db.collection('habitGroups').doc(req.params.id).delete();
      return res.status(204).send();
    }

    await db.collection('habitGroups').doc(req.params.id).set({
      archivedAt: nowTs(),
      updatedAt: nowTs()
    }, { merge: true });

    return res.status(204).send();
  } catch (error) {
    console.error('[habits] DELETE /groups/:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/scheduled/:date', async (req, res) => {
  try {
    const userId = req.user.uid;
    const dateStr = req.params.date;
    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const habitsResult = await listHabitsByUser(userId);
    const scheduled = habitsResult.habits.filter(habit => habitAppliesToDate(habit, dateStr));

    const logs = await listHabitLogsForDate(userId, dateStr);
    const logsByHabitId = new Map(logs.map(log => [log.habitId, log]));

    const items = scheduled.map(habit => ({
      ...toResponseHabit(habit),
      log: logsByHabitId.get(habit.id) || {
        habitId: habit.id,
        date: dateStr,
        completed: false,
        status: 'pending',
        value: null,
        notes: ''
      }
    }));

    return res.json({
      date: dateStr,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('[habits] GET /scheduled/:date error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/logs/:date', async (req, res) => {
  try {
    const userId = req.user.uid;
    const dateStr = req.params.date;

    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const existingLog = await getHabitLog(userId, req.params.id, dateStr);
    if (!existingLog) {
      return res.json({
        id: habitLogId(req.params.id, dateStr),
        userId,
        habitId: req.params.id,
        date: dateStr,
        completed: false,
        status: 'pending',
        value: null,
        notes: '',
        createdAt: null,
        updatedAt: null
      });
    }

    return res.json(existingLog);
  } catch (error) {
    console.error('[habits] GET /:id/logs/:date error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id/logs/:date', async (req, res) => {
  try {
    const userId = req.user.uid;
    const dateStr = req.params.date;

    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const normalized = normalizeLogPayload(req.body || {});
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const existingLog = await getHabitLog(userId, req.params.id, dateStr);
    const now = nowTs();

    let nextStatus = typeof existingLog?.status === 'string'
      ? existingLog.status
      : ((existingLog?.completed || false) ? 'completed' : 'pending');
    let nextCompleted = typeof existingLog?.completed === 'boolean'
      ? existingLog.completed
      : false;

    if (normalized.hasStatus) {
      nextStatus = normalized.data.status;
      nextCompleted = nextStatus === 'completed';
    } else if (normalized.hasCompleted) {
      nextCompleted = normalized.data.completed;
      nextStatus = nextCompleted ? 'completed' : 'pending';
    } else if (normalized.hasValue) {
      if (nextCompleted) {
        nextStatus = 'completed';
      }
    } else if (normalized.hasNotes) {
      if (nextCompleted) {
        nextStatus = 'completed';
      }
    }
    if (nextStatus === 'completed') {
      nextCompleted = true;
    } else if (nextStatus === 'skipped' || nextStatus === 'pending') {
      nextCompleted = false;
    }

    const payload = {
      id: habitLogId(req.params.id, dateStr),
      userId,
      habitId: req.params.id,
      date: dateStr,
      completed: nextCompleted,
      status: nextStatus,
      value: normalized.hasValue ? normalized.data.value : (existingLog?.value ?? null),
      notes: normalized.hasNotes ? normalized.data.notes : (existingLog?.notes || ''),
      createdAt: existingLog?.createdAt || now,
      updatedAt: now
    };

    await db.collection('habitLogs').doc(payload.id).set(payload);
    const source = resolveEventSource({
      explicitSource: req.body?.source,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: 'habit.logged',
      source,
      timestamp: now,
      habitId: payload.habitId,
      name: habit.name || null,
      date: payload.date,
      completed: payload.completed,
      value: payload.value
    });
    return res.json(payload);
  } catch (error) {
    console.error('[habits] PUT /:id/logs/:date error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/logs/:date/toggle', async (req, res) => {
  try {
    const userId = req.user.uid;
    const dateStr = req.params.date;

    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const now = nowTs();
    const existingLog = await getHabitLog(userId, req.params.id, dateStr);
    const nextCompleted = !(existingLog?.completed || false);
    const nextStatus = nextCompleted ? 'completed' : 'pending';

    const payload = {
      id: habitLogId(req.params.id, dateStr),
      userId,
      habitId: req.params.id,
      date: dateStr,
      completed: nextCompleted,
      status: nextStatus,
      value: existingLog?.value ?? null,
      notes: existingLog?.notes || '',
      createdAt: existingLog?.createdAt || now,
      updatedAt: now
    };

    await db.collection('habitLogs').doc(payload.id).set(payload);
    const source = resolveEventSource({
      explicitSource: req.body?.source,
      authSource: req.user?.source
    });

    await writeUserEventSafe({
      userId,
      type: 'habit.logged',
      source,
      timestamp: now,
      habitId: payload.habitId,
      name: habit.name || null,
      date: payload.date,
      completed: payload.completed,
      value: payload.value
    });
    return res.json(payload);
  } catch (error) {
    console.error('[habits] POST /:id/logs/:date/toggle error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, req.user.uid)) {
      return res.status(404).json({ error: 'Habit not found' });
    }
    return res.json(toResponseHabit(habit));
  } catch (error) {
    console.error('[habits] GET /:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

const updateHabitHandler = async (req, res) => {
  try {
    const userId = req.user.uid;
    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const normalized = normalizeHabitPayload(req.body || {}, { partial: true });
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const payload = {
      ...normalized.data,
      updatedAt: nowTs()
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

    if (Object.prototype.hasOwnProperty.call(normalized.data, 'groupId')) {
      const groupResolution = await resolveHabitGroupAssignment({
        userId,
        rawGroupId: normalized.data.groupId
      });
      if (groupResolution.error) {
        return res.status(400).json({ error: groupResolution.error });
      }

      payload.groupId = groupResolution.groupId ?? null;
      payload.groupName = groupResolution.groupName ?? null;
    }

    let validatedBountyPillarId;
    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyPillarId')) {
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

      payload.bountyPillarId = validatedBountyPillarId ?? null;
    }

    const bountyUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyPoints')) {
      bountyUpdateInput.bountyPoints = normalized.data.bountyPoints;
    }
    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyAllocations')) {
      bountyUpdateInput.bountyAllocations = normalized.data.bountyAllocations;
    }
    if (Object.prototype.hasOwnProperty.call(normalized.data, 'bountyPillarId')) {
      bountyUpdateInput.bountyPillarId = validatedBountyPillarId ?? null;
    }

    const bountyUpdate = await normalizeBountyForHabitUpdate({
      userId,
      body: bountyUpdateInput,
      defaultPillarId: Object.prototype.hasOwnProperty.call(payload, 'bountyPillarId')
        ? (payload.bountyPillarId ?? null)
        : (typeof habit.bountyPillarId === 'string' ? habit.bountyPillarId : (
          Object.prototype.hasOwnProperty.call(payload, 'pillarId')
            ? (payload.pillarId ?? null)
            : (typeof habit.pillarId === 'string' ? habit.pillarId : null)
        ))
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
        payload.bountyPoints = bountyUpdate.allocations.length === 1
          ? bountyUpdate.allocations[0].points
          : null;
      }
    }

    await db.collection('habits').doc(req.params.id).set(payload, { merge: true });
    const updated = await getHabitById(req.params.id);
    const habitResponse = toResponseHabit(updated || habit);
    await writeUserEventSafe({
      userId,
      type: 'habit.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: payload.updatedAt,
      habitId: habitResponse.id || req.params.id,
      name: habitResponse.name || null,
      sectionId: habitResponse.sectionId || null,
      date: null
    });
    return res.json({
      ...habitResponse,
      habit: habitResponse
    });
  } catch (error) {
    console.error(`[habits] ${req.method} /:id error:`, error);
    return res.status(500).json({ error: error.message });
  }
};

router.put('/:id', updateHabitHandler);
router.patch('/:id', updateHabitHandler);

router.post('/:id/archive', async (req, res) => {
  try {
    const userId = req.user.uid;
    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const now = nowTs();
    await db.collection('habits').doc(req.params.id).set({
      isActive: false,
      archivedAt: now,
      updatedAt: now
    }, { merge: true });

    const updated = await getHabitById(req.params.id);
    await writeUserEventSafe({
      userId,
      type: 'habit.archived',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      habitId: updated?.id || req.params.id,
      name: updated?.name || null,
      sectionId: updated?.sectionId || null,
      date: null
    });
    return res.json(toResponseHabit(updated));
  } catch (error) {
    console.error('[habits] POST /:id/archive error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/unarchive', async (req, res) => {
  try {
    const userId = req.user.uid;
    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const now = nowTs();
    await db.collection('habits').doc(req.params.id).set({
      isActive: true,
      archivedAt: null,
      updatedAt: now
    }, { merge: true });

    const updated = await getHabitById(req.params.id);
    await writeUserEventSafe({
      userId,
      type: 'habit.unarchived',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      habitId: updated?.id || req.params.id,
      name: updated?.name || null,
      sectionId: updated?.sectionId || null,
      date: null
    });
    return res.json(toResponseHabit(updated));
  } catch (error) {
    console.error('[habits] POST /:id/unarchive error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const hardDelete = String(req.query.hard || '').toLowerCase() === 'true';

    const habit = await getHabitById(req.params.id);
    if (!ensureHabitOwner(habit, userId)) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    if (hardDelete) {
      await db.collection('habits').doc(req.params.id).delete();
      await writeUserEventSafe({
        userId,
        type: 'habit.deleted',
        source: resolveEventSource({
          explicitSource: req.body?.source,
          authSource: req.user?.source
        }),
        timestamp: nowTs(),
        habitId: habit.id || req.params.id,
        name: habit.name || null,
        sectionId: habit.sectionId || null,
        date: null
      });
      return res.status(204).send();
    }

    const now = nowTs();
    await db.collection('habits').doc(req.params.id).set({
      isActive: false,
      archivedAt: now,
      updatedAt: now
    }, { merge: true });
    await writeUserEventSafe({
      userId,
      type: 'habit.archived',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      timestamp: now,
      habitId: habit.id || req.params.id,
      name: habit.name || null,
      sectionId: habit.sectionId || null,
      date: null
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[habits] DELETE /:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
