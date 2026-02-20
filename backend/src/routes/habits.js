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

  return { data: payload };
}

function normalizeLogPayload(body) {
  const hasCompleted = Object.prototype.hasOwnProperty.call(body || {}, 'completed');
  const hasValue = Object.prototype.hasOwnProperty.call(body || {}, 'value');
  const hasNotes = Object.prototype.hasOwnProperty.call(body || {}, 'notes');

  if (!hasCompleted && !hasValue && !hasNotes) {
    return { error: 'At least one of completed, value, or notes is required' };
  }

  const payload = {};

  if (hasCompleted) {
    payload.completed = Boolean(body.completed);
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

  return { data: payload };
}

function habitAppliesToDate(habit, dateStr) {
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

function isInvalidPillarIdError(error) {
  return error?.status === 400 && error?.message === 'Invalid pillarId';
}

function toResponseHabit(habit) {
  return {
    ...habit,
    pillarId: typeof habit?.pillarId === 'string' ? habit.pillarId : null
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
    const active = typeof req.query.active === 'string' ? req.query.active.trim().toLowerCase() : 'true';

    if (req.query.sectionId && !VALID_SECTIONS.has(req.query.sectionId)) {
      return res.status(400).json({ error: 'sectionId must be morning, afternoon, or evening' });
    }

    let dayOfWeek = null;
    if (typeof req.query.dayOfWeek === 'string' && req.query.dayOfWeek.trim()) {
      dayOfWeek = req.query.dayOfWeek.trim().toLowerCase();
      if (!VALID_WEEKDAYS.has(dayOfWeek)) {
        return res.status(400).json({ error: 'dayOfWeek must be sunday..saturday' });
      }
    }

    const pillarFilter = parsePillarFilter(req.query.pillarId);
    if (pillarFilter.error) {
      return res.status(400).json({ error: pillarFilter.error });
    }

    const { habits, queryMode } = await listHabitsByUser(userId);

    const filtered = habits.filter(habit => {
      if (active === 'true' && !habit.isActive) {
        return false;
      }
      if (active === 'false' && habit.isActive) {
        return false;
      }
      if (req.query.sectionId && habit.sectionId !== req.query.sectionId) {
        return false;
      }
      if (pillarFilter.pillarFilter === 'none' && habit.pillarId) {
        return false;
      }
      if (pillarFilter.pillarFilter === 'exact' && habit.pillarId !== pillarFilter.pillarValue) {
        return false;
      }
      if (dayOfWeek) {
        const schedule = habit.schedule || { type: 'daily', daysOfWeek: [] };
        if (schedule.type === 'weekly') {
          return Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.includes(dayOfWeek);
        }
        return schedule.type === 'daily';
      }
      return true;
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
    return res.status(201).json(toResponseHabit(payload));
  } catch (error) {
    console.error('[habits] POST / error:', error);
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

    const payload = {
      id: habitLogId(req.params.id, dateStr),
      userId,
      habitId: req.params.id,
      date: dateStr,
      completed: existingLog?.completed || false,
      value: existingLog?.value ?? null,
      notes: existingLog?.notes || '',
      createdAt: existingLog?.createdAt || now,
      updatedAt: now,
      ...normalized.data
    };

    await db.collection('habitLogs').doc(payload.id).set(payload);
    await writeUserEventSafe({
      userId,
      type: 'habit.logged',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
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

    const payload = {
      id: habitLogId(req.params.id, dateStr),
      userId,
      habitId: req.params.id,
      date: dateStr,
      completed: nextCompleted,
      value: existingLog?.value ?? null,
      notes: existingLog?.notes || '',
      createdAt: existingLog?.createdAt || now,
      updatedAt: now
    };

    await db.collection('habitLogs').doc(payload.id).set(payload);
    await writeUserEventSafe({
      userId,
      type: 'habit.logged',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
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

router.put('/:id', async (req, res) => {
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

    await db.collection('habits').doc(req.params.id).set(payload, { merge: true });
    const updated = await getHabitById(req.params.id);
    return res.json(toResponseHabit(updated));
  } catch (error) {
    console.error('[habits] PUT /:id error:', error);
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
      return res.status(204).send();
    }

    const now = nowTs();
    await db.collection('habits').doc(req.params.id).set({
      isActive: false,
      archivedAt: now,
      updatedAt: now
    }, { merge: true });

    return res.status(204).send();
  } catch (error) {
    console.error('[habits] DELETE /:id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
