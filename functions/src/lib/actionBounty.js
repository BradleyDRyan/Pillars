const ACTION_POINT_EVENT_PREFIX = 'pe_action_';
const ACTION_STATUS_COMPLETED = 'completed';
const ACTION_BOUNTY_MIN_POINTS = 1;
const ACTION_BOUNTY_MAX_POINTS = 100;
const ACTION_BOUNTY_MAX_ALLOCATIONS = 3;
const ACTION_BOUNTY_TOTAL_MAX = 150;
const ACTION_REASON_MAX_LENGTH = 300;

function nowTs() {
  return Date.now() / 1000;
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function todayDateUtc() {
  return new Date().toISOString().slice(0, 10);
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

function pickRelevantActionFields(action) {
  if (!action || typeof action !== 'object') {
    return null;
  }

  const bounties = Array.isArray(action.bounties)
    ? action.bounties.map(item => ({
      pillarId: normalizeString(item?.pillarId),
      rubricItemId: normalizeString(item?.rubricItemId),
      points: asIntegerOrNull(item?.points)
    }))
    : [];

  return {
    userId: normalizeString(action.userId),
    status: normalizeStatus(action.status),
    targetDate: normalizeString(action.targetDate),
    title: normalizeString(action.title),
    bounties
  };
}

function didRelevantActionFieldsChange(before, after) {
  if (!before && !after) {
    return false;
  }
  if (!before || !after) {
    return true;
  }
  return JSON.stringify(pickRelevantActionFields(before)) !== JSON.stringify(pickRelevantActionFields(after));
}

function normalizeReason(action) {
  const fromTitle = normalizeString(action?.title);
  const reason = fromTitle || 'Action completed';
  return reason.length > ACTION_REASON_MAX_LENGTH
    ? reason.slice(0, ACTION_REASON_MAX_LENGTH)
    : reason;
}

function normalizeAllocationInput(action) {
  if (!Array.isArray(action?.bounties)) {
    return { allocations: null };
  }

  if (action.bounties.length < 1) {
    return { allocations: null };
  }

  const allocations = [];
  const dedup = new Set();
  let totalPoints = 0;

  for (const bounty of action.bounties.slice(0, ACTION_BOUNTY_MAX_ALLOCATIONS)) {
    const pillarId = normalizeString(bounty?.pillarId);
    const points = asIntegerOrNull(bounty?.points);

    if (!pillarId || !points) {
      return { error: 'invalid action bounty allocation' };
    }

    if (points < ACTION_BOUNTY_MIN_POINTS || points > ACTION_BOUNTY_MAX_POINTS) {
      return { error: `bounty points must be between ${ACTION_BOUNTY_MIN_POINTS} and ${ACTION_BOUNTY_MAX_POINTS}` };
    }

    if (dedup.has(pillarId)) {
      return { error: 'bounties must use unique pillarId values' };
    }

    dedup.add(pillarId);
    totalPoints += points;
    if (totalPoints > ACTION_BOUNTY_TOTAL_MAX) {
      return { error: `bounty total points cannot exceed ${ACTION_BOUNTY_TOTAL_MAX}` };
    }

    allocations.push({ pillarId, points });
  }

  return {
    allocations,
    pillarIds: [...dedup],
    totalPoints
  };
}

function resolvePayout(action) {
  const input = normalizeAllocationInput(action);
  if (input.error) {
    return { allocations: null, diagnostic: input.error };
  }
  if (!input.allocations) {
    return { allocations: null, diagnostic: null };
  }

  return {
    allocations: input.allocations,
    pillarIds: input.pillarIds,
    totalPoints: input.totalPoints,
    reason: normalizeReason(action),
    date: isValidDateString(action?.targetDate) ? action.targetDate : todayDateUtc()
  };
}

function buildActionPointEventId(actionId) {
  return `${ACTION_POINT_EVENT_PREFIX}${actionId}`;
}

function eventShapeForCompare({ actionId, userId, payout, source }) {
  return {
    userId,
    date: payout.date,
    reason: payout.reason,
    source,
    ref: { type: 'action', id: actionId },
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

async function upsertActionPointEvent({
  db,
  actionId,
  userId,
  payout,
  source = 'system',
  now = nowTs(),
  logger = console
}) {
  const pointEventId = buildActionPointEventId(actionId);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? existingDoc.data() || {} : null;

  if (existing && normalizeString(existing.userId) && normalizeString(existing.userId) !== userId) {
    logger.warn('[action-bounty-trigger] skipped pointEvent upsert due to user mismatch', {
      actionId,
      pointEventId,
      expectedUserId: userId,
      existingUserId: existing.userId
    });
    return { changed: false };
  }

  const expected = eventShapeForCompare({ actionId, userId, payout, source });
  if (existing && eventMatchesShape(existing, expected)) {
    return { changed: false };
  }

  const payload = {
    id: pointEventId,
    userId,
    date: payout.date,
    reason: payout.reason,
    source,
    ref: { type: 'action', id: actionId },
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

async function voidActionPointEvent({
  db,
  actionId,
  userId,
  now = nowTs(),
  logger = console
}) {
  const pointEventId = buildActionPointEventId(actionId);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const doc = await ref.get();

  if (!doc.exists) {
    return { changed: false };
  }

  const data = doc.data() || {};
  if (normalizeString(data.userId) !== userId) {
    logger.warn('[action-bounty-trigger] skipped pointEvent void due to user mismatch', {
      actionId,
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

async function reconcileActionWrite({
  db,
  actionId,
  before,
  after,
  logger = console,
  nowSeconds = nowTs,
  source = 'system'
}) {
  if (!actionId) {
    return { action: 'noop', reason: 'missing-action-id', pointEventId: null };
  }

  const pointEventId = buildActionPointEventId(actionId);

  logger.info('[action-bounty-trigger] reconcile start', {
    actionId,
    pointEventId,
    beforeExists: Boolean(before),
    afterExists: Boolean(after),
    before: pickRelevantActionFields(before),
    after: pickRelevantActionFields(after)
  });

  if (!after) {
    const deletedUserId = normalizeString(before?.userId);
    if (!deletedUserId) {
      return { action: 'noop', reason: 'deleted-missing-user', pointEventId };
    }

    const voidResult = await voidActionPointEvent({
      db,
      actionId,
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

  if (!didRelevantActionFieldsChange(before, after)) {
    return { action: 'noop', reason: 'no-relevant-change', pointEventId };
  }

  const userId = normalizeString(after.userId);
  if (!userId) {
    return { action: 'noop', reason: 'missing-user-id', pointEventId };
  }

  const now = nowSeconds();
  const isCompleted = normalizeStatus(after.status) === ACTION_STATUS_COMPLETED;

  if (!isCompleted) {
    const voidResult = await voidActionPointEvent({ db, actionId, userId, now, logger });
    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: 'not-completed',
      pointEventId
    };
  }

  const payout = resolvePayout(after);
  if (!payout.allocations) {
    const voidResult = await voidActionPointEvent({ db, actionId, userId, now, logger });
    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: payout.diagnostic || 'no-bounty',
      pointEventId
    };
  }

  const upsertResult = await upsertActionPointEvent({
    db,
    actionId,
    userId,
    payout,
    source,
    now,
    logger
  });

  return {
    action: upsertResult.changed ? 'paid' : 'noop',
    reason: 'completed-with-bounty',
    pointEventId
  };
}

module.exports = {
  buildActionPointEventId,
  didRelevantActionFieldsChange,
  resolvePayout,
  reconcileActionWrite,
  upsertActionPointEvent,
  voidActionPointEvent
};
