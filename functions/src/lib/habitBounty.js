const HABIT_POINT_EVENT_PREFIX = 'pe_habit_';
const HABIT_BOUNTY_MIN_POINTS = 1;
const HABIT_BOUNTY_MAX_ALLOCATION_POINTS = 100;
const HABIT_BOUNTY_MAX_SINGLE_POINTS = 100;
const HABIT_BOUNTY_TOTAL_MAX = 150;
const HABIT_BOUNTY_MAX_ALLOCATIONS = 3;
const HABIT_REASON_MAX_LENGTH = 300;

function nowTs() {
  return Date.now() / 1000;
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function todayDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function buildHabitPointEventId(habitId, dateStr) {
  return `${HABIT_POINT_EVENT_PREFIX}${habitId}_${dateStr}`;
}

function normalizeString(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

function normalizeStatus(raw) {
  const normalized = normalizeString(raw);
  return normalized ? normalized.toLowerCase() : null;
}

function asIntegerOrNull(raw) {
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

function toBooleanOrNull(raw) {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'number') {
    return raw !== 0;
  }
  return null;
}

function pickRelevantHabitLogFields(log) {
  if (!log || typeof log !== 'object') {
    return null;
  }

  return {
    userId: normalizeString(log.userId),
    habitId: normalizeString(log.habitId),
    date: normalizeString(log.date),
    status: normalizeStatus(log.status),
    completed: toBooleanOrNull(log.completed)
  };
}

function didRelevantHabitLogFieldsChange(before, after) {
  if (!before && !after) {
    return false;
  }
  if (!before || !after) {
    return true;
  }

  return JSON.stringify(pickRelevantHabitLogFields(before)) !== JSON.stringify(pickRelevantHabitLogFields(after));
}

function isCompletedHabitLog(log) {
  const status = normalizeStatus(log?.status);
  if (status === 'completed') {
    return true;
  }
  if (status === 'pending' || status === 'skipped') {
    return false;
  }
  return toBooleanOrNull(log?.completed) === true;
}

function normalizeReason(habit) {
  const fromBounty = normalizeString(habit?.bountyReason);
  const fromName = normalizeString(habit?.name);
  const reason = fromBounty || fromName || 'Habit completed';
  return reason.length > HABIT_REASON_MAX_LENGTH
    ? reason.slice(0, HABIT_REASON_MAX_LENGTH)
    : reason;
}

function normalizeAllocationInputFromHabit(habit) {
  if (Array.isArray(habit?.bountyAllocations)) {
    const raw = habit.bountyAllocations;

    if (raw.length < 1) {
      return { error: 'bountyAllocations must include at least one entry' };
    }
    if (raw.length > HABIT_BOUNTY_MAX_ALLOCATIONS) {
      return { error: `bountyAllocations must include at most ${HABIT_BOUNTY_MAX_ALLOCATIONS} entries` };
    }

    const dedup = new Set();
    const allocations = [];
    let totalPoints = 0;

    for (const allocation of raw) {
      if (!allocation || typeof allocation !== 'object') {
        return { error: 'each bounty allocation must be an object' };
      }

      const pillarId = normalizeString(allocation.pillarId);
      if (!pillarId) {
        return { error: 'bounty allocation pillarId is required' };
      }

      const points = asIntegerOrNull(allocation.points);
      if (!points || points < HABIT_BOUNTY_MIN_POINTS || points > HABIT_BOUNTY_MAX_ALLOCATION_POINTS) {
        return {
          error: `bounty allocation points must be an integer between ${HABIT_BOUNTY_MIN_POINTS} and ${HABIT_BOUNTY_MAX_ALLOCATION_POINTS}`
        };
      }

      if (dedup.has(pillarId)) {
        return { error: 'bountyAllocations must use unique pillarId values' };
      }

      dedup.add(pillarId);
      totalPoints += points;
      if (totalPoints > HABIT_BOUNTY_TOTAL_MAX) {
        return { error: `bounty total points cannot exceed ${HABIT_BOUNTY_TOTAL_MAX}` };
      }

      allocations.push({ pillarId, points });
    }

    return { allocations, totalPoints };
  }

  const bountyPoints = asIntegerOrNull(habit?.bountyPoints);
  if (!bountyPoints) {
    return { allocations: null };
  }

  if (bountyPoints < HABIT_BOUNTY_MIN_POINTS || bountyPoints > HABIT_BOUNTY_MAX_SINGLE_POINTS) {
    return {
      error: `bountyPoints must be an integer between ${HABIT_BOUNTY_MIN_POINTS} and ${HABIT_BOUNTY_MAX_SINGLE_POINTS}`
    };
  }

  const pillarId = normalizeString(habit?.bountyPillarId) || normalizeString(habit?.pillarId);
  if (!pillarId) {
    return { error: 'pillarId is required to set bountyPoints' };
  }

  return {
    allocations: [{ pillarId, points: bountyPoints }],
    totalPoints: bountyPoints
  };
}

async function pillarBelongsToUser({ db, userId, pillarId, cache }) {
  if (!pillarId) {
    return false;
  }

  if (cache.has(pillarId)) {
    return cache.get(pillarId);
  }

  const doc = await db.collection('pillars').doc(pillarId).get();
  const valid = doc.exists && doc.data()?.userId === userId;
  cache.set(pillarId, valid);
  return valid;
}

async function resolveHabitPayout({ db, habit, userId, date, logger = console }) {
  const input = normalizeAllocationInputFromHabit(habit);
  if (input.error) {
    return { allocations: null, diagnostic: input.error };
  }
  if (!input.allocations) {
    return { allocations: null, diagnostic: null };
  }

  const cache = new Map();
  const pillarIds = [];

  for (const allocation of input.allocations) {
    const validPillar = await pillarBelongsToUser({
      db,
      userId,
      pillarId: allocation.pillarId,
      cache
    });

    if (!validPillar) {
      return {
        allocations: null,
        diagnostic: `invalid bounty pillar: ${allocation.pillarId}`
      };
    }

    pillarIds.push(allocation.pillarId);
  }

  const totalPoints = input.totalPoints || input.allocations.reduce((sum, item) => sum + item.points, 0);
  if (totalPoints < HABIT_BOUNTY_MIN_POINTS || totalPoints > HABIT_BOUNTY_TOTAL_MAX) {
    return {
      allocations: null,
      diagnostic: `bounty total points cannot exceed ${HABIT_BOUNTY_TOTAL_MAX}`
    };
  }

  return {
    allocations: input.allocations,
    pillarIds,
    totalPoints,
    reason: normalizeReason(habit),
    date: isValidDateString(date) ? date : todayDateUtc()
  };
}

function eventShapeForCompare({ habitId, userId, payout, source }) {
  return {
    userId,
    date: payout.date,
    reason: payout.reason,
    source,
    ref: { type: 'habit', id: habitId },
    allocations: payout.allocations,
    pillarIds: payout.pillarIds,
    totalPoints: payout.totalPoints,
    voidedAt: null
  };
}

function eventMatchesShape(existing, expected) {
  if (!existing || typeof existing !== 'object') {
    return false;
  }

  return JSON.stringify({
    userId: normalizeString(existing.userId),
    date: normalizeString(existing.date),
    reason: normalizeString(existing.reason),
    source: normalizeString(existing.source),
    ref: existing.ref || null,
    allocations: existing.allocations || null,
    pillarIds: existing.pillarIds || null,
    totalPoints: asIntegerOrNull(existing.totalPoints),
    voidedAt: existing.voidedAt === null ? null : existing.voidedAt
  }) === JSON.stringify(expected);
}

async function upsertHabitPointEvent({
  db,
  habitId,
  date,
  userId,
  payout,
  source = 'system',
  now = nowTs(),
  logger = console
}) {
  const pointEventId = buildHabitPointEventId(habitId, payout.date || date);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? existingDoc.data() || {} : null;

  if (existing && normalizeString(existing.userId) && normalizeString(existing.userId) !== userId) {
    logger.warn('[habit-bounty-trigger] skipped pointEvent update due to user mismatch', {
      habitId,
      pointEventId,
      expectedUserId: userId,
      existingUserId: existing.userId
    });
    return { changed: false };
  }

  const expected = eventShapeForCompare({ habitId, userId, payout, source });
  if (existing && eventMatchesShape(existing, expected)) {
    return { changed: false };
  }

  const payload = {
    id: pointEventId,
    userId,
    date: payout.date,
    reason: payout.reason,
    source,
    ref: { type: 'habit', id: habitId },
    allocations: payout.allocations,
    pillarIds: payout.pillarIds,
    totalPoints: payout.totalPoints,
    updatedAt: now,
    voidedAt: null,
    createdAt: existing?.createdAt || now
  };

  await ref.set(payload, { merge: true });
  return { changed: true };
}

async function voidHabitPointEvent({
  db,
  habitId,
  date,
  userId,
  now = nowTs(),
  logger = console
}) {
  if (!habitId || !isValidDateString(date)) {
    return { changed: false };
  }

  const pointEventId = buildHabitPointEventId(habitId, date);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const doc = await ref.get();

  if (!doc.exists) {
    return { changed: false };
  }

  const data = doc.data() || {};
  if (normalizeString(data.userId) !== userId) {
    logger.warn('[habit-bounty-trigger] skipped pointEvent void due to user mismatch', {
      habitId,
      pointEventId,
      expectedUserId: userId,
      existingUserId: data.userId
    });
    return { changed: false };
  }

  if (data.voidedAt) {
    return { changed: false };
  }

  await ref.update({ voidedAt: now, updatedAt: now });
  return { changed: true };
}

async function reconcileHabitLogWrite({
  db,
  habitLogId,
  before,
  after,
  logger = console,
  nowSeconds = nowTs,
  source = 'system'
}) {
  const resolvedHabitLogId = normalizeString(habitLogId) || normalizeString(after?.id) || normalizeString(before?.id);
  if (!resolvedHabitLogId) {
    return { action: 'noop', reason: 'missing-log-id', pointEventId: null };
  }

  const resolvedHabitId = normalizeString(after?.habitId) || normalizeString(before?.habitId);
  const resolvedDate = normalizeString(after?.date) || normalizeString(before?.date);
  const pointEventId = (resolvedHabitId && isValidDateString(resolvedDate))
    ? buildHabitPointEventId(resolvedHabitId, resolvedDate)
    : null;

  logger.info('[habit-bounty-trigger] reconcile start', {
    habitLogId: resolvedHabitLogId,
    pointEventId,
    beforeExists: Boolean(before),
    afterExists: Boolean(after),
    before: pickRelevantHabitLogFields(before),
    after: pickRelevantHabitLogFields(after)
  });

  if (!after) {
    const deletedUserId = normalizeString(before?.userId);
    const deletedHabitId = normalizeString(before?.habitId);
    const deletedDate = normalizeString(before?.date);

    if (!deletedUserId || !deletedHabitId || !isValidDateString(deletedDate)) {
      return { action: 'noop', reason: 'deleted-missing-fields', pointEventId };
    }

    const voidResult = await voidHabitPointEvent({
      db,
      habitId: deletedHabitId,
      date: deletedDate,
      userId: deletedUserId,
      now: nowSeconds(),
      logger
    });

    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: 'deleted',
      pointEventId
    };
  }

  if (!didRelevantHabitLogFieldsChange(before, after)) {
    return { action: 'noop', reason: 'no-relevant-change', pointEventId };
  }

  const userId = normalizeString(after.userId);
  const habitId = normalizeString(after.habitId);
  const date = normalizeString(after.date);
  if (!userId || !habitId || !isValidDateString(date)) {
    logger.warn('[habit-bounty-trigger] skipping log with missing required fields', {
      habitLogId: resolvedHabitLogId,
      pointEventId,
      userId,
      habitId,
      date
    });
    return { action: 'noop', reason: 'missing-required-fields', pointEventId };
  }

  const now = nowSeconds();
  const isCompleted = isCompletedHabitLog(after);
  logger.info('[habit-bounty-trigger] completion state evaluated', {
    habitLogId: resolvedHabitLogId,
    pointEventId,
    habitId,
    userId,
    date,
    beforeStatus: normalizeStatus(before?.status),
    afterStatus: normalizeStatus(after?.status),
    beforeCompleted: toBooleanOrNull(before?.completed),
    afterCompleted: toBooleanOrNull(after?.completed),
    isCompleted
  });

  if (!isCompleted) {
    const voidResult = await voidHabitPointEvent({
      db,
      habitId,
      date,
      userId,
      now,
      logger
    });

    logger.info('[habit-bounty-trigger] reconciled non-completed habit log', {
      habitLogId: resolvedHabitLogId,
      pointEventId,
      habitId,
      userId,
      date,
      voidedPointEvent: voidResult.changed
    });

    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: 'not-completed',
      pointEventId
    };
  }

  const habitDoc = await db.collection('habits').doc(habitId).get();
  if (!habitDoc.exists) {
    logger.warn('[habit-bounty-trigger] completed log has no habit', {
      habitLogId: resolvedHabitLogId,
      pointEventId,
      habitId,
      userId,
      date
    });

    const voidResult = await voidHabitPointEvent({
      db,
      habitId,
      date,
      userId,
      now,
      logger
    });

    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: 'habit-missing',
      pointEventId
    };
  }

  const habit = habitDoc.data() || {};
  if (normalizeString(habit.userId) !== userId) {
    logger.warn('[habit-bounty-trigger] completed log habit user mismatch', {
      habitLogId: resolvedHabitLogId,
      pointEventId,
      habitId,
      userId,
      habitUserId: habit.userId
    });
    return { action: 'noop', reason: 'habit-user-mismatch', pointEventId };
  }

  const payout = await resolveHabitPayout({
    db,
    habit,
    userId,
    date,
    logger
  });

  if (!payout.allocations) {
    if (payout.diagnostic) {
      logger.warn('[habit-bounty-trigger] invalid bounty on completed habit log', {
        habitLogId: resolvedHabitLogId,
        pointEventId,
        habitId,
        userId,
        diagnostic: payout.diagnostic,
        habitBountyPoints: habit?.bountyPoints ?? null,
        habitBountyPillarId: habit?.bountyPillarId ?? null,
        habitPillarId: habit?.pillarId ?? null
      });
    }

    const voidResult = await voidHabitPointEvent({
      db,
      habitId,
      date,
      userId,
      now,
      logger
    });

    logger.info('[habit-bounty-trigger] reconciled completed habit log without valid bounty', {
      habitLogId: resolvedHabitLogId,
      pointEventId,
      habitId,
      userId,
      date,
      reason: payout.diagnostic || 'no-bounty',
      voidedPointEvent: voidResult.changed
    });

    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: payout.diagnostic || 'no-bounty',
      pointEventId
    };
  }

  logger.info('[habit-bounty-trigger] payout resolved for completed habit log', {
    habitLogId: resolvedHabitLogId,
    pointEventId,
    habitId,
    userId,
    date,
    totalPoints: payout.totalPoints,
    pillarIds: payout.pillarIds,
    allocations: payout.allocations,
    reason: payout.reason
  });

  const upsertResult = await upsertHabitPointEvent({
    db,
    habitId,
    date,
    userId,
    payout,
    source,
    now,
    logger
  });

  logger.info('[habit-bounty-trigger] reconciled completed habit log with bounty', {
    habitLogId: resolvedHabitLogId,
    pointEventId,
    habitId,
    userId,
    date,
    upsertedPointEvent: upsertResult.changed
  });

  return {
    action: upsertResult.changed ? 'paid' : 'noop',
    reason: 'completed-with-bounty',
    pointEventId
  };
}

module.exports = {
  buildHabitPointEventId,
  didRelevantHabitLogFieldsChange,
  isCompletedHabitLog,
  normalizeAllocationInputFromHabit,
  resolveHabitPayout,
  reconcileHabitLogWrite,
  upsertHabitPointEvent,
  voidHabitPointEvent
};
