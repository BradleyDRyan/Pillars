const DEFAULT_CLASSIFIER_BASE_URL = 'https://pillars-phi.vercel.app';

function normalizeString(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

function normalizeBaseUrl(rawBaseUrl) {
  const normalized = normalizeString(rawBaseUrl);
  if (!normalized) {
    return DEFAULT_CLASSIFIER_BASE_URL;
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function hasMeaningfulBounties(rawBounties) {
  if (!Array.isArray(rawBounties) || rawBounties.length < 1) {
    return false;
  }

  return rawBounties.some(item => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const pillarId = normalizeString(item.pillarId);
    const points = Number(item.points);
    return Boolean(pillarId) && Number.isInteger(points) && points > 0;
  });
}

function isArchived(action) {
  if (!action || typeof action !== 'object') {
    return false;
  }
  return action.archivedAt !== null && action.archivedAt !== undefined;
}

function shouldClassifyAction({ before, after, actionId }) {
  if (!normalizeString(actionId)) {
    return { allowed: false, reason: 'missing-action-id' };
  }

  if (!after || typeof after !== 'object') {
    return { allowed: false, reason: 'missing-after' };
  }

  if (before && typeof before === 'object') {
    return { allowed: false, reason: 'not-create' };
  }

  if (isArchived(after)) {
    return { allowed: false, reason: 'archived' };
  }

  const userId = normalizeString(after.userId);
  if (!userId) {
    return { allowed: false, reason: 'missing-user-id' };
  }

  const title = normalizeString(after.title);
  const notes = normalizeString(after.notes);
  if (!title && !notes) {
    return { allowed: false, reason: 'missing-title-notes' };
  }

  if (normalizeString(after.templateId)) {
    return { allowed: false, reason: 'template-action' };
  }

  if (hasMeaningfulBounties(after.bounties)) {
    return { allowed: false, reason: 'already-has-bounties' };
  }

  return {
    allowed: true,
    actionId,
    userId
  };
}

function safeJsonParse(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    return null;
  }
}

function shorten(value, maxLength = 320) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}...`;
}

async function requestActionClassification({
  actionId,
  userId,
  internalServiceSecret,
  baseUrl,
  fetchImpl
}) {
  const token = normalizeString(internalServiceSecret);
  if (!token) {
    return {
      attempted: false,
      success: false,
      reason: 'missing-internal-service-secret'
    };
  }

  const resolvedBaseUrl = normalizeBaseUrl(baseUrl || process.env.ACTION_CLASSIFIER_BASE_URL || process.env.APP_URL);
  const url = `${resolvedBaseUrl}/api/actions/${encodeURIComponent(actionId)}`;

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-user-id': userId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bounties: null,
        eventSource: 'system'
      })
    });
  } catch (error) {
    return {
      attempted: true,
      success: false,
      reason: 'request-failed',
      message: error?.message || String(error)
    };
  }

  const rawBody = await response.text();
  const parsedBody = safeJsonParse(rawBody);

  if (!response.ok) {
    return {
      attempted: true,
      success: false,
      reason: `http-${response.status}`,
      status: response.status,
      error: parsedBody?.error || shorten(rawBody)
    };
  }

  return {
    attempted: true,
    success: true,
    reason: 'classified',
    status: response.status,
    classificationSummary: parsedBody?.classificationSummary || null,
    action: parsedBody?.action || null
  };
}

async function maybeClassifyActionWrite({
  actionId,
  before,
  after,
  internalServiceSecret,
  baseUrl,
  fetchImpl = globalThis.fetch,
  logger = console
}) {
  const decision = shouldClassifyAction({ before, after, actionId });
  if (!decision.allowed) {
    return {
      attempted: false,
      success: false,
      reason: decision.reason
    };
  }

  if (typeof fetchImpl !== 'function') {
    logger.warn('[action-classifier-trigger] fetch implementation missing');
    return {
      attempted: false,
      success: false,
      reason: 'missing-fetch'
    };
  }

  const result = await requestActionClassification({
    actionId: decision.actionId,
    userId: decision.userId,
    internalServiceSecret,
    baseUrl,
    fetchImpl
  });

  if (result.attempted && !result.success) {
    logger.warn('[action-classifier-trigger] classification call failed', {
      actionId,
      reason: result.reason,
      status: result.status || null,
      error: result.error || result.message || null
    });
  }

  return result;
}

module.exports = {
  hasMeaningfulBounties,
  normalizeBaseUrl,
  requestActionClassification,
  shouldClassifyAction,
  maybeClassifyActionWrite
};
