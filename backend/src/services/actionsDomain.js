const { resolveValidatedPillarId } = require('../utils/pillarValidation');
const { resolveRubricSelection } = require('../utils/rubrics');
const { classifyAcrossPillarsMulti } = require('./classification');

const VALID_ACTION_STATUS = new Set(['pending', 'completed', 'skipped', 'canceled']);
const VALID_SECTION_IDS = new Set(['morning', 'afternoon', 'evening']);
const VALID_CADENCE_TYPES = new Set(['daily', 'weekdays', 'weekly']);
const VALID_WEEKDAYS = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);

const ACTION_TITLE_MAX_LENGTH = 500;
const ACTION_NOTES_MAX_LENGTH = 2000;
const ACTION_TEMPLATE_TITLE_MAX_LENGTH = 500;
const ACTION_TEMPLATE_NOTES_MAX_LENGTH = 2000;

const BOUNTY_MIN_POINTS = 1;
const BOUNTY_MAX_POINTS = 100;
const BOUNTY_MAX_ALLOCATIONS = 3;
const BOUNTY_TOTAL_MAX = 150;

const ACTION_POINT_EVENT_PREFIX = 'pe_action_';
const ACTION_EVENT_REASON_MAX_LENGTH = 300;

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function todayDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeOptionalString(raw, maxLength) {
  if (raw === undefined || raw === null) {
    return null;
  }
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

function normalizeRequiredString(raw, { fieldName, maxLength }) {
  if (typeof raw !== 'string') {
    return { error: `${fieldName} is required` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: `${fieldName} is required` };
  }
  if (trimmed.length > maxLength) {
    return { value: trimmed.slice(0, maxLength) };
  }
  return { value: trimmed };
}

function normalizeStatus(raw, defaultStatus = 'pending') {
  if (raw === undefined || raw === null || raw === '') {
    return defaultStatus;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (!VALID_ACTION_STATUS.has(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeSection(raw, defaultSection = 'afternoon') {
  if (raw === undefined || raw === null || raw === '') {
    return defaultSection;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (!VALID_SECTION_IDS.has(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeOrder(raw, defaultOrder = 0) {
  if (raw === undefined || raw === null || raw === '') {
    return defaultOrder;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

function normalizeActionSource(rawSource, authSource, fallback = 'user') {
  if (typeof rawSource === 'string' && rawSource.trim()) {
    return rawSource.trim().toLowerCase();
  }

  if (authSource === 'service' || authSource === 'internal-service') {
    return 'system';
  }
  if (authSource === 'api-key') {
    return 'api';
  }

  return fallback;
}

function normalizeCadence(rawCadence, { fieldName = 'cadence', partial = false } = {}) {
  if (rawCadence === undefined) {
    if (partial) {
      return { provided: false };
    }
    return { error: `${fieldName} is required` };
  }

  if (rawCadence === null) {
    return { error: `${fieldName} cannot be null` };
  }

  let type = null;
  let daysOfWeek = [];

  if (typeof rawCadence === 'string') {
    type = rawCadence.trim().toLowerCase();
  } else if (rawCadence && typeof rawCadence === 'object' && !Array.isArray(rawCadence)) {
    type = typeof rawCadence.type === 'string'
      ? rawCadence.type.trim().toLowerCase()
      : (typeof rawCadence.kind === 'string' ? rawCadence.kind.trim().toLowerCase() : null);

    if (Array.isArray(rawCadence.daysOfWeek)) {
      const dedup = new Set();
      for (const rawDay of rawCadence.daysOfWeek) {
        const normalized = typeof rawDay === 'string' ? rawDay.trim().toLowerCase() : '';
        if (!VALID_WEEKDAYS.has(normalized)) {
          return { error: `${fieldName}.daysOfWeek accepts sunday..saturday` };
        }
        if (!dedup.has(normalized)) {
          dedup.add(normalized);
          daysOfWeek.push(normalized);
        }
      }
    }
  } else {
    return { error: `${fieldName} must be a string or object` };
  }

  if (!type || !VALID_CADENCE_TYPES.has(type)) {
    return { error: `${fieldName}.type must be daily, weekdays, or weekly` };
  }

  if (type === 'weekly' && daysOfWeek.length < 1) {
    return { error: `${fieldName}.daysOfWeek requires at least one day for weekly cadence` };
  }

  if (type === 'weekdays') {
    daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }

  return {
    provided: true,
    value: {
      type,
      daysOfWeek: type === 'weekly' || type === 'weekdays' ? daysOfWeek : []
    }
  };
}

function dateToWeekday(dateStr) {
  const [year, month, day] = dateStr.split('-').map(value => Number(value));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][utcDate.getUTCDay()];
}

function cadenceAppliesToDate(cadence, dateStr) {
  if (!cadence || typeof cadence !== 'object') {
    return false;
  }
  if (!isValidDateString(dateStr)) {
    return false;
  }

  const type = typeof cadence.type === 'string' ? cadence.type.trim().toLowerCase() : '';
  if (type === 'daily') {
    return true;
  }

  const weekday = dateToWeekday(dateStr);

  if (type === 'weekdays') {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(weekday);
  }

  if (type === 'weekly') {
    const configured = Array.isArray(cadence.daysOfWeek)
      ? cadence.daysOfWeek
        .map(day => (typeof day === 'string' ? day.trim().toLowerCase() : ''))
        .filter(day => VALID_WEEKDAYS.has(day))
      : [];
    return configured.includes(weekday);
  }

  return false;
}

function deterministicActionIdFromTemplate(templateId, dateStr) {
  const safeTemplateId = String(templateId || 'template').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDate = String(dateStr || '').replace(/[^0-9]/g, '');
  return `act_tpl_${safeTemplateId}_${safeDate}`;
}

function normalizeRubricItemId(rawRubricItemId) {
  if (rawRubricItemId === undefined || rawRubricItemId === null || rawRubricItemId === '') {
    return null;
  }
  if (typeof rawRubricItemId !== 'string') {
    return null;
  }
  const trimmed = rawRubricItemId.trim();
  return trimmed || null;
}

async function normalizeBounties({
  db,
  userId,
  rawBounties,
  fieldName = 'bounties',
  allowEmpty = false
}) {
  if (!Array.isArray(rawBounties)) {
    return { error: `${fieldName} must be an array` };
  }

  if (rawBounties.length < 1) {
    if (allowEmpty) {
      return { value: [], totalPoints: 0, pillarIds: [] };
    }
    return { error: `${fieldName} must include at least one entry` };
  }

  if (rawBounties.length > BOUNTY_MAX_ALLOCATIONS) {
    return { error: `${fieldName} must include at most ${BOUNTY_MAX_ALLOCATIONS} entries` };
  }

  const normalized = [];
  const pillarIds = [];
  const dedup = new Set();
  let totalPoints = 0;

  for (const rawBounty of rawBounties) {
    if (!rawBounty || typeof rawBounty !== 'object' || Array.isArray(rawBounty)) {
      return { error: `each ${fieldName} entry must be an object` };
    }

    const rawPillarId = typeof rawBounty.pillarId === 'string' ? rawBounty.pillarId.trim() : '';
    if (!rawPillarId) {
      return { error: `${fieldName}[].pillarId is required` };
    }

    const points = Number(rawBounty.points);
    if (!Number.isInteger(points) || points < BOUNTY_MIN_POINTS || points > BOUNTY_MAX_POINTS) {
      return { error: `${fieldName}[].points must be an integer between ${BOUNTY_MIN_POINTS} and ${BOUNTY_MAX_POINTS}` };
    }

    let pillarId;
    try {
      pillarId = await resolveValidatedPillarId({ db, userId, pillarId: rawPillarId });
    } catch (error) {
      return { error: error.message || 'Invalid pillarId' };
    }

    const rubricItemId = normalizeRubricItemId(rawBounty.rubricItemId);
    if (rubricItemId) {
      try {
        const selection = await resolveRubricSelection({
          db,
          userId,
          pillarId,
          rubricItemId
        });
        if (selection.pillarId !== pillarId) {
          return { error: `Invalid rubricItemId for pillar ${pillarId}` };
        }
      } catch (error) {
        return { error: error.message || 'Invalid rubricItemId' };
      }
    }

    const dedupKey = `${pillarId}::${rubricItemId || 'none'}`;
    if (dedup.has(dedupKey)) {
      return { error: `${fieldName} must use unique pillarId/rubricItemId pairs` };
    }
    dedup.add(dedupKey);

    totalPoints += points;
    if (totalPoints > BOUNTY_TOTAL_MAX) {
      return { error: `${fieldName} total points cannot exceed ${BOUNTY_TOTAL_MAX}` };
    }

    if (!pillarIds.includes(pillarId)) {
      pillarIds.push(pillarId);
    }

    normalized.push({
      pillarId,
      rubricItemId,
      points
    });
  }

  return {
    value: normalized,
    totalPoints,
    pillarIds
  };
}

function buildClassificationText({ title, notes }) {
  return [title, notes]
    .filter(part => typeof part === 'string' && part.trim())
    .map(part => part.trim())
    .join('\n')
    .trim();
}

function classificationCandidatesToBounties(candidates) {
  if (!Array.isArray(candidates)) {
    return { bounties: [], trimmed: [] };
  }

  const bounties = [];
  const trimmed = [];
  const dedup = new Set();
  const usedPillars = new Set();
  let totalPoints = 0;

  for (const candidate of candidates) {
    const pillarId = typeof candidate?.pillarId === 'string' ? candidate.pillarId.trim() : '';
    const rubricItemId = typeof candidate?.rubricItem?.id === 'string' ? candidate.rubricItem.id.trim() : '';
    const points = Number(candidate?.rubricItem?.points);

    if (!pillarId || !rubricItemId || !Number.isInteger(points)) {
      continue;
    }
    if (points < BOUNTY_MIN_POINTS || points > BOUNTY_MAX_POINTS) {
      continue;
    }

    const key = `${pillarId}::${rubricItemId}`;
    if (dedup.has(key)) {
      continue;
    }

    if (usedPillars.has(pillarId)) {
      trimmed.push({ pillarId, rubricItemId, points });
      continue;
    }

    if (bounties.length >= BOUNTY_MAX_ALLOCATIONS || totalPoints + points > BOUNTY_TOTAL_MAX) {
      trimmed.push({ pillarId, rubricItemId, points });
      continue;
    }

    dedup.add(key);
    usedPillars.add(pillarId);
    totalPoints += points;
    bounties.push({ pillarId, rubricItemId, points });
  }

  return { bounties, trimmed };
}

async function classifyBountiesFromText({ db, userId, title, notes }) {
  const text = buildClassificationText({ title, notes });
  if (!text) {
    const error = new Error('title or notes is required for auto-classification');
    error.status = 400;
    throw error;
  }

  const classified = await classifyAcrossPillarsMulti({
    db,
    userId,
    text,
    maxMatches: BOUNTY_MAX_ALLOCATIONS
  });

  const classificationMatches = Array.isArray(classified?.matches)
    ? classified.matches
    : (Array.isArray(classified?.candidates) ? classified.candidates : []);

  const { bounties, trimmed } = classificationCandidatesToBounties(classificationMatches);
  if (!bounties.length) {
    const error = new Error('Unable to classify activity into valid bounty allocations');
    error.status = 409;
    throw error;
  }

  return {
    bounties,
    summary: {
      matchedPillarIds: bounties.map(item => item.pillarId),
      trimmedPillarIds: trimmed.map(item => item.pillarId),
      method: classified?.method || null,
      fallbackUsed: Boolean(classified?.fallbackUsed),
      modelUsed: classified?.modelUsed || null,
      modelRationale: classified?.modelRationale || null,
      modelSystemPrompt: classified?.modelSystemPrompt || null,
      modelUserPrompt: classified?.modelUserPrompt || null,
      modelResponseRaw: classified?.modelResponseRaw || null
    }
  };
}

function buildActionPointEventId(actionId) {
  return `${ACTION_POINT_EVENT_PREFIX}${actionId}`;
}

function toPointEventAllocations(action) {
  if (!Array.isArray(action?.bounties)) {
    return [];
  }

  return action.bounties
    .map(item => {
      const pillarId = typeof item?.pillarId === 'string' ? item.pillarId.trim() : '';
      const points = Number(item?.points);
      if (!pillarId || !Number.isInteger(points) || points < BOUNTY_MIN_POINTS || points > BOUNTY_MAX_POINTS) {
        return null;
      }
      return { pillarId, points };
    })
    .filter(Boolean)
    .slice(0, BOUNTY_MAX_ALLOCATIONS);
}

function normalizePointEventSource(raw) {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (normalized === 'user' || normalized === 'clawdbot' || normalized === 'system') {
    return normalized;
  }
  return 'system';
}

function normalizeActionReason(action) {
  const title = typeof action?.title === 'string' ? action.title.trim() : '';
  const fallback = title || 'Action completed';
  if (fallback.length <= ACTION_EVENT_REASON_MAX_LENGTH) {
    return fallback;
  }
  return fallback.slice(0, ACTION_EVENT_REASON_MAX_LENGTH);
}

function eventShapeForCompare({ actionId, userId, action, source }) {
  const allocations = toPointEventAllocations(action);
  const pillarIds = [...new Set(allocations.map(item => item.pillarId))];
  const totalPoints = allocations.reduce((sum, item) => sum + item.points, 0);

  return {
    userId,
    date: isValidDateString(action?.targetDate) ? action.targetDate : todayDateUtc(),
    reason: normalizeActionReason(action),
    source: normalizePointEventSource(source),
    ref: { type: 'action', id: actionId },
    allocations,
    pillarIds,
    totalPoints,
    voidedAt: null
  };
}

function eventMatchesShape(existing, expected) {
  if (!existing || typeof existing !== 'object') {
    return false;
  }

  return JSON.stringify({
    userId: typeof existing.userId === 'string' ? existing.userId.trim() : null,
    date: typeof existing.date === 'string' ? existing.date.trim() : null,
    reason: typeof existing.reason === 'string' ? existing.reason.trim() : null,
    source: typeof existing.source === 'string' ? existing.source.trim() : null,
    ref: existing.ref || null,
    allocations: existing.allocations || null,
    pillarIds: existing.pillarIds || null,
    totalPoints: Number.isInteger(existing.totalPoints) ? existing.totalPoints : null,
    voidedAt: existing.voidedAt === null ? null : existing.voidedAt
  }) === JSON.stringify(expected);
}

async function upsertActionPointEvent({
  db,
  actionId,
  userId,
  action,
  source = 'system',
  now = nowTs(),
  logger = console
}) {
  const pointEventId = buildActionPointEventId(actionId);
  const ref = db.collection('pointEvents').doc(pointEventId);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? existingDoc.data() || {} : null;

  if (existing && typeof existing.userId === 'string' && existing.userId.trim() !== userId) {
    logger.warn('[action-bounty] skipped point event upsert due to user mismatch', {
      actionId,
      pointEventId,
      expectedUserId: userId,
      existingUserId: existing.userId
    });
    return { changed: false };
  }

  const expected = eventShapeForCompare({ actionId, userId, action, source });
  if (!Array.isArray(expected.allocations) || expected.allocations.length < 1) {
    return { changed: false, skipped: 'no-valid-bounties' };
  }

  if (existing && eventMatchesShape(existing, expected)) {
    return { changed: false };
  }

  const payload = {
    id: pointEventId,
    userId,
    date: expected.date,
    reason: expected.reason,
    source: expected.source,
    ref: expected.ref,
    allocations: expected.allocations,
    pillarIds: expected.pillarIds,
    totalPoints: expected.totalPoints,
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
  if (typeof data.userId === 'string' && data.userId.trim() !== userId) {
    logger.warn('[action-bounty] skipped point event void due to user mismatch', {
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

  await ref.update({
    voidedAt: now,
    updatedAt: now
  });

  return { changed: true };
}

function pickRelevantActionFields(action) {
  if (!action || typeof action !== 'object') {
    return null;
  }
  return {
    userId: typeof action.userId === 'string' ? action.userId.trim() : null,
    status: typeof action.status === 'string' ? action.status.trim().toLowerCase() : null,
    targetDate: typeof action.targetDate === 'string' ? action.targetDate.trim() : null,
    title: typeof action.title === 'string' ? action.title.trim() : null,
    bounties: Array.isArray(action.bounties)
      ? action.bounties.map(item => ({
        pillarId: typeof item?.pillarId === 'string' ? item.pillarId.trim() : null,
        rubricItemId: typeof item?.rubricItemId === 'string' ? item.rubricItemId.trim() : null,
        points: Number.isInteger(item?.points) ? item.points : null
      }))
      : []
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

async function reconcileActionPointEventWrite({
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

  if (!after) {
    const deletedUserId = typeof before?.userId === 'string' ? before.userId.trim() : null;
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

  const userId = typeof after.userId === 'string' ? after.userId.trim() : null;
  if (!userId) {
    return { action: 'noop', reason: 'missing-user-id', pointEventId };
  }

  const now = nowSeconds();
  const afterStatus = normalizeStatus(after.status, 'pending');
  const isCompleted = afterStatus === 'completed';

  if (!isCompleted) {
    const voidResult = await voidActionPointEvent({ db, actionId, userId, now, logger });
    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: 'not-completed',
      pointEventId
    };
  }

  const upsertResult = await upsertActionPointEvent({
    db,
    actionId,
    userId,
    action: after,
    source,
    now,
    logger
  });

  if (upsertResult.skipped === 'no-valid-bounties') {
    const voidResult = await voidActionPointEvent({ db, actionId, userId, now, logger });
    return {
      action: voidResult.changed ? 'voided' : 'noop',
      reason: 'completed-no-bounties',
      pointEventId
    };
  }

  return {
    action: upsertResult.changed ? 'paid' : 'noop',
    reason: 'completed',
    pointEventId
  };
}

module.exports = {
  VALID_ACTION_STATUS,
  VALID_SECTION_IDS,
  VALID_CADENCE_TYPES,
  VALID_WEEKDAYS,
  BOUNTY_MIN_POINTS,
  BOUNTY_MAX_POINTS,
  BOUNTY_MAX_ALLOCATIONS,
  BOUNTY_TOTAL_MAX,
  ACTION_TITLE_MAX_LENGTH,
  ACTION_NOTES_MAX_LENGTH,
  ACTION_TEMPLATE_TITLE_MAX_LENGTH,
  ACTION_TEMPLATE_NOTES_MAX_LENGTH,
  nowTs,
  isValidDateString,
  todayDateUtc,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeStatus,
  normalizeSection,
  normalizeOrder,
  normalizeActionSource,
  normalizeCadence,
  cadenceAppliesToDate,
  deterministicActionIdFromTemplate,
  normalizeBounties,
  classifyBountiesFromText,
  buildActionPointEventId,
  upsertActionPointEvent,
  voidActionPointEvent,
  pickRelevantActionFields,
  didRelevantActionFieldsChange,
  reconcileActionPointEventWrite,
  normalizePointEventSource
};
