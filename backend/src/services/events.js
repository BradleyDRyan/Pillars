const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const VALID_EVENT_TYPES = new Set([
  'block.created',
  'block.updated',
  'block.deleted',
  'todo.created',
  'todo.updated',
  'todo.closed',
  'todo.reopened',
  'todo.archived',
  'todo.unarchived',
  'todo.deleted',
  'habit.logged',
  'habit.created',
  'habit.updated',
  'habit.archived',
  'habit.unarchived',
  'habit.deleted',
  'pillar.created',
  'pillar.updated'
]);

const AUTH_SOURCE_TO_EVENT_SOURCE = Object.freeze({
  firebase: 'user',
  'api-key': 'api',
  service: 'service',
  'internal-service': 'service'
});

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sanitizeSource(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 40);
}

function resolveEventSource({ explicitSource, authSource }) {
  const direct = sanitizeSource(explicitSource);
  if (direct) {
    return direct;
  }

  const mapped = AUTH_SOURCE_TO_EVENT_SOURCE[authSource];
  if (mapped) {
    return mapped;
  }

  return sanitizeSource(authSource) || 'unknown';
}

function createEventId() {
  return `evt_${uuidv4().replace(/-/g, '')}`;
}

function buildEventPayload({ userId, type, source, timestamp, ...rest }) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('userId is required');
  }

  if (typeof type !== 'string' || !VALID_EVENT_TYPES.has(type)) {
    throw new Error(`Unsupported event type: ${type}`);
  }

  const payload = {
    id: createEventId(),
    userId: userId.trim(),
    type,
    timestamp: Number.isFinite(timestamp) ? Math.trunc(timestamp) : nowUnixSeconds()
  };

  const normalizedSource = sanitizeSource(source);
  if (normalizedSource) {
    payload.source = normalizedSource;
  }

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) {
      continue;
    }
    payload[key] = value;
  }

  return payload;
}

async function writeUserEvent(input) {
  const payload = buildEventPayload(input);
  await db.collection('events').doc(payload.id).set(payload);
  return payload;
}

async function writeUserEventSafe(input) {
  try {
    return await writeUserEvent(input);
  } catch (error) {
    console.error('[events] Failed to write event', {
      userId: input?.userId,
      type: input?.type,
      message: error.message
    });
    return null;
  }
}

module.exports = {
  VALID_EVENT_TYPES,
  resolveEventSource,
  writeUserEvent,
  writeUserEventSafe
};
