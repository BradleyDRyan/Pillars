const TODO_POINT_EVENT_PREFIX = 'pe_todo_';
const TODO_BOUNTY_MIN_POINTS = 1;
const TODO_BOUNTY_MAX_ALLOCATION_POINTS = 100;
const TODO_BOUNTY_MAX_SINGLE_POINTS = 150;
const TODO_BOUNTY_TOTAL_MAX = 150;
const TODO_BOUNTY_MAX_ALLOCATIONS = 3;
const TODO_EVENT_LABEL_MAX_LENGTH = 300;

function nowTs() {
  return Date.now() / 1000;
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function todayDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function buildTodoPointEventId(todoId) {
  return `${TODO_POINT_EVENT_PREFIX}${todoId}`;
}

function normalizeString(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

function normalizeStatus(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized || null;
}

function asIntegerOrNull(raw) {
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

function asNumberOrNull(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return null;
}

function pickRelevantTodoFields(todo) {
  if (!todo || typeof todo !== 'object') {
    return null;
  }

  const bountyAllocations = Array.isArray(todo.bountyAllocations)
    ? todo.bountyAllocations.map(allocation => ({
      pillarId: normalizeString(allocation?.pillarId),
      points: asIntegerOrNull(allocation?.points)
    }))
    : null;

  return {
    userId: normalizeString(todo.userId),
    status: normalizeStatus(todo.status),
    dueDate: normalizeString(todo.dueDate),
    content: normalizeString(todo.content),
    bountyPoints: asIntegerOrNull(todo.bountyPoints),
    bountyPillarId: normalizeString(todo.bountyPillarId),
    pillarId: normalizeString(todo.pillarId),
    bountyAllocations
  };
}

function didRelevantTodoFieldsChange(before, after) {
  if (!before && !after) {
    return false;
  }
  if (!before || !after) {
    return true;
  }
  return JSON.stringify(pickRelevantTodoFields(before)) !== JSON.stringify(pickRelevantTodoFields(after));
}

function normalizeReason(todo) {
  const todoTitle = normalizeString(todo?.content) || 'Todo';
  return todoTitle.length > TODO_EVENT_LABEL_MAX_LENGTH
    ? todoTitle.slice(0, TODO_EVENT_LABEL_MAX_LENGTH)
    : todoTitle;
}

function normalizeAllocationInput(todo) {
  if (Array.isArray(todo?.bountyAllocations)) {
    const raw = todo.bountyAllocations;

    if (raw.length < 1) {
      return { error: 'bountyAllocations must include at least one entry' };
    }
    if (raw.length > TODO_BOUNTY_MAX_ALLOCATIONS) {
      return { error: `bountyAllocations must include at most ${TODO_BOUNTY_MAX_ALLOCATIONS} entries` };
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
      if (!points || points < TODO_BOUNTY_MIN_POINTS || points > TODO_BOUNTY_MAX_ALLOCATION_POINTS) {
        return {
          error: `bounty allocation points must be an integer between ${TODO_BOUNTY_MIN_POINTS} and ${TODO_BOUNTY_MAX_ALLOCATION_POINTS}`
        };
      }

      if (dedup.has(pillarId)) {
        return { error: 'bountyAllocations must use unique pillarId values' };
      }

      dedup.add(pillarId);
      totalPoints += points;
      if (totalPoints > TODO_BOUNTY_TOTAL_MAX) {
        return { error: `bounty total points cannot exceed ${TODO_BOUNTY_TOTAL_MAX}` };
      }

      allocations.push({ pillarId, points });
    }

    return { allocations, totalPoints };
  }

  const bountyPoints = asIntegerOrNull(todo?.bountyPoints);
  if (!bountyPoints) {
    return { allocations: null };
  }

  if (bountyPoints < TODO_BOUNTY_MIN_POINTS || bountyPoints > TODO_BOUNTY_MAX_SINGLE_POINTS) {
    return {
      error: `bountyPoints must be an integer between ${TODO_BOUNTY_MIN_POINTS} and ${TODO_BOUNTY_MAX_SINGLE_POINTS}`
    };
  }

  const pillarId = normalizeString(todo?.bountyPillarId) || normalizeString(todo?.pillarId);
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

async function resolveTodoPayout({ db, todo, userId, logger = console }) {
  const input = normalizeAllocationInput(todo);
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
  if (totalPoints < TODO_BOUNTY_MIN_POINTS || totalPoints > TODO_BOUNTY_TOTAL_MAX) {
    return {
      allocations: null,
      diagnostic: `bounty total points cannot exceed ${TODO_BOUNTY_TOTAL_MAX}`
    };
  }

  return {
    allocations: input.allocations,
    pillarIds,
    totalPoints,
    reason: normalizeReason(todo),
    date: isValidDateString(todo?.dueDate) ? todo.dueDate : todayDateUtc()
  };
}

function eventShapeForCompare({ todoId, userId, payout, source }) {
  return {
    userId,
    date: payout.date,
    reason: payout.reason,
    source,
    ref: { type: 'todo', id: todoId },
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

async function upsertTodoPointEvent({ db, todoId, userId, payout, source = 'system', now = nowTs(), logger = console }) {
  const pointEventId = buildTodoPointEventId(todoId);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? existingDoc.data() || {} : null;

  if (existing && normalizeString(existing.userId) && normalizeString(existing.userId) !== userId) {
    logger.warn('[todo-bounty-trigger] skipped pointEvent update due to user mismatch', {
      todoId,
      pointEventId,
      expectedUserId: userId,
      existingUserId: existing.userId
    });
    return { changed: false };
  }

  const expected = eventShapeForCompare({ todoId, userId, payout, source });
  if (existing && eventMatchesShape(existing, expected)) {
    return { changed: false };
  }

  const payload = {
    id: pointEventId,
    userId,
    date: payout.date,
    reason: payout.reason,
    source,
    ref: { type: 'todo', id: todoId },
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

async function voidTodoPointEvent({ db, todoId, userId, now = nowTs(), logger = console }) {
  const pointEventId = buildTodoPointEventId(todoId);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const doc = await ref.get();

  if (!doc.exists) {
    return { changed: false };
  }

  const data = doc.data() || {};
  if (normalizeString(data.userId) !== userId) {
    logger.warn('[todo-bounty-trigger] skipped pointEvent void due to user mismatch', {
      todoId,
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

async function setBountyPaidAtIfNeeded({ db, todoId, after, now = nowTs() }) {
  if (asNumberOrNull(after?.bountyPaidAt) !== null) {
    return false;
  }

  await db.collection('todos').doc(todoId).set({ bountyPaidAt: now }, { merge: true });
  return true;
}

async function clearBountyPaidAtIfNeeded({ db, todoId, after }) {
  if (after?.bountyPaidAt === null || after?.bountyPaidAt === undefined) {
    return false;
  }

  await db.collection('todos').doc(todoId).set({ bountyPaidAt: null }, { merge: true });
  return true;
}

async function reconcileTodoBountyWrite({
  db,
  todoId,
  before,
  after,
  logger = console,
  nowSeconds = nowTs,
  source = 'system'
}) {
  if (!todoId) {
    return { action: 'noop', reason: 'missing-todo-id', pointEventId: null };
  }
  const pointEventId = buildTodoPointEventId(todoId);

  logger.info('[todo-bounty-trigger] reconcile start', {
    todoId,
    pointEventId,
    beforeExists: Boolean(before),
    afterExists: Boolean(after),
    before: pickRelevantTodoFields(before),
    after: pickRelevantTodoFields(after),
    beforeBountyPaidAt: before?.bountyPaidAt ?? null,
    afterBountyPaidAt: after?.bountyPaidAt ?? null
  });

  if (!after) {
    const deletedUserId = normalizeString(before?.userId);
    if (!deletedUserId) {
      return { action: 'noop', reason: 'deleted-missing-user', pointEventId };
    }

    const voidResult = await voidTodoPointEvent({
      db,
      todoId,
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

  if (!didRelevantTodoFieldsChange(before, after)) {
    return { action: 'noop', reason: 'no-relevant-change', pointEventId };
  }

  const userId = normalizeString(after.userId);
  if (!userId) {
    logger.warn('[todo-bounty-trigger] skipping todo with missing userId', {
      todoId,
      pointEventId,
      after: pickRelevantTodoFields(after)
    });
    return { action: 'noop', reason: 'missing-user-id', pointEventId };
  }

  const now = nowSeconds();
  const isCompleted = normalizeStatus(after.status) === 'completed';
  logger.info('[todo-bounty-trigger] completion state evaluated', {
    todoId,
    pointEventId,
    userId,
    beforeStatus: normalizeStatus(before?.status),
    afterStatus: normalizeStatus(after?.status),
    isCompleted
  });

  if (!isCompleted) {
    const [voidResult, bountyResult] = await Promise.all([
      voidTodoPointEvent({ db, todoId, userId, now, logger }),
      clearBountyPaidAtIfNeeded({ db, todoId, after })
    ]);

    logger.info('[todo-bounty-trigger] reconciled non-completed todo', {
      todoId,
      pointEventId,
      userId,
      voidedPointEvent: voidResult.changed,
      clearedBountyPaidAt: bountyResult
    });

    return {
      action: voidResult.changed || bountyResult ? 'voided' : 'noop',
      reason: 'not-completed',
      pointEventId
    };
  }

  const payout = await resolveTodoPayout({ db, todo: after, userId, logger });
  if (!payout.allocations) {
    if (payout.diagnostic) {
      logger.warn('[todo-bounty-trigger] invalid bounty on completed todo', {
        todoId,
        pointEventId,
        userId,
        diagnostic: payout.diagnostic,
        after: pickRelevantTodoFields(after)
      });
    }

    const [voidResult, bountyResult] = await Promise.all([
      voidTodoPointEvent({ db, todoId, userId, now, logger }),
      clearBountyPaidAtIfNeeded({ db, todoId, after })
    ]);

    logger.info('[todo-bounty-trigger] reconciled completed todo without valid bounty', {
      todoId,
      pointEventId,
      userId,
      reason: payout.diagnostic || 'no-bounty',
      voidedPointEvent: voidResult.changed,
      clearedBountyPaidAt: bountyResult
    });

    return {
      action: voidResult.changed || bountyResult ? 'voided' : 'noop',
      reason: payout.diagnostic || 'no-bounty',
      pointEventId
    };
  }

  logger.info('[todo-bounty-trigger] payout resolved for completed todo', {
    todoId,
    pointEventId,
    userId,
    totalPoints: payout.totalPoints,
    pillarIds: payout.pillarIds,
    allocations: payout.allocations,
    reason: payout.reason,
    date: payout.date
  });

  const [upsertResult, bountyResult] = await Promise.all([
    upsertTodoPointEvent({
      db,
      todoId,
      userId,
      payout,
      source,
      now,
      logger
    }),
    setBountyPaidAtIfNeeded({ db, todoId, after, now })
  ]);

  logger.info('[todo-bounty-trigger] reconciled completed todo with bounty', {
    todoId,
    pointEventId,
    userId,
    upsertedPointEvent: upsertResult.changed,
    setBountyPaidAt: bountyResult
  });

  return {
    action: upsertResult.changed || bountyResult ? 'paid' : 'noop',
    reason: 'completed-with-bounty',
    pointEventId
  };
}

module.exports = {
  buildTodoPointEventId,
  didRelevantTodoFieldsChange,
  normalizeAllocationInput,
  resolveTodoPayout,
  reconcileTodoBountyWrite,
  upsertTodoPointEvent,
  voidTodoPointEvent
};
