const express = require('express');
const { db } = require('../config/firebase');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { VALID_EVENT_TYPES } = require('../services/events');

const router = express.Router();
router.use(flexibleAuth);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_SCAN_PAGE_SIZE = 50;
const SCAN_MULTIPLIER = 3;

function isMissingIndexError(error) {
  const message = `${error?.details || ''} ${error?.message || ''}`.toLowerCase();
  return error?.code === 9 && message.includes('index');
}

function parseSince(rawSince) {
  if (rawSince === undefined) {
    return { value: null };
  }

  const parsed = Number(rawSince);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: 'since must be a non-negative unix timestamp' };
  }

  return { value: Math.trunc(parsed) };
}

function parseLimit(rawLimit) {
  if (rawLimit === undefined) {
    return { value: DEFAULT_LIMIT };
  }

  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
  }

  return { value: parsed };
}

function parseTypes(rawTypes) {
  if (rawTypes === undefined) {
    return { value: null };
  }

  const tokens = Array.isArray(rawTypes)
    ? rawTypes.flatMap(token => String(token).split(','))
    : String(rawTypes).split(',');

  const normalized = tokens
    .map(token => token.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return { value: null };
  }

  const deduped = [...new Set(normalized)];
  const invalid = deduped.filter(type => !VALID_EVENT_TYPES.has(type));
  if (invalid.length > 0) {
    return {
      error: `Unsupported event type(s): ${invalid.join(', ')}`
    };
  }

  return { value: deduped };
}

function parseCursor(rawCursor) {
  if (rawCursor === undefined || rawCursor === null) {
    return { value: null };
  }

  if (typeof rawCursor !== 'string') {
    return { error: 'cursor must be a string' };
  }

  const normalized = rawCursor.trim();
  if (!normalized) {
    return { value: null };
  }

  return { value: normalized };
}

function sortEventsByTimestampAndId(a, b) {
  const aTs = Number.isFinite(a.timestamp) ? a.timestamp : 0;
  const bTs = Number.isFinite(b.timestamp) ? b.timestamp : 0;
  if (aTs !== bTs) {
    return aTs - bTs;
  }
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function toClientEvent(event) {
  const { userId, ...rest } = event;
  return rest;
}

async function resolveCursorDoc({ userId, cursor }) {
  if (!cursor) {
    return null;
  }

  const cursorDoc = await db.collection('events').doc(cursor).get();
  if (!cursorDoc.exists) {
    return { error: 'cursor not found' };
  }

  const cursorData = cursorDoc.data();
  if (cursorData.userId !== userId) {
    return { error: 'cursor not found' };
  }

  return { doc: cursorDoc };
}

async function listEventsIndexed({ userId, since, cursorDoc, typeSet, limit }) {
  let baseQuery = db.collection('events')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'asc');

  if (since !== null) {
    baseQuery = baseQuery.where('timestamp', '>', since);
  }

  if (cursorDoc) {
    baseQuery = baseQuery.startAfter(cursorDoc);
  }

  const scanLimit = Math.max(MIN_SCAN_PAGE_SIZE, Math.min(MAX_LIMIT, limit * SCAN_MULTIPLIER));
  const events = [];
  let nextQuery = baseQuery;

  while (events.length < limit) {
    const snapshot = await nextQuery.limit(scanLimit).get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      const event = { id: doc.id, ...doc.data() };
      if (typeSet && !typeSet.has(event.type)) {
        continue;
      }

      events.push(toClientEvent(event));
      if (events.length >= limit) {
        break;
      }
    }

    if (snapshot.size < scanLimit) {
      break;
    }

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    nextQuery = baseQuery.startAfter(lastDoc);
  }

  return events;
}

async function listEventsFallback({ userId, since, cursor, typeSet, limit }) {
  const snapshot = await db.collection('events')
    .where('userId', '==', userId)
    .get();

  const allEvents = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort(sortEventsByTimestampAndId);

  let startIndex = 0;
  if (since !== null) {
    while (
      startIndex < allEvents.length &&
      (Number.isFinite(allEvents[startIndex].timestamp) ? allEvents[startIndex].timestamp : 0) <= since
    ) {
      startIndex += 1;
    }
  }

  if (cursor) {
    const cursorIndex = allEvents.findIndex(event => event.id === cursor);
    if (cursorIndex >= 0) {
      startIndex = Math.max(startIndex, cursorIndex + 1);
    }
  }

  const events = [];
  for (let index = startIndex; index < allEvents.length; index += 1) {
    const event = allEvents[index];
    if (typeSet && !typeSet.has(event.type)) {
      continue;
    }

    events.push(toClientEvent(event));
    if (events.length >= limit) {
      break;
    }
  }

  return events;
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;

    const sinceResult = parseSince(req.query.since);
    if (sinceResult.error) {
      return res.status(400).json({ error: sinceResult.error });
    }

    const limitResult = parseLimit(req.query.limit);
    if (limitResult.error) {
      return res.status(400).json({ error: limitResult.error });
    }

    const typesResult = parseTypes(req.query.types);
    if (typesResult.error) {
      return res.status(400).json({ error: typesResult.error });
    }

    const cursorResult = parseCursor(req.query.cursor);
    if (cursorResult.error) {
      return res.status(400).json({ error: cursorResult.error });
    }

    const since = sinceResult.value;
    const limit = limitResult.value;
    const cursor = cursorResult.value;
    const typeSet = typesResult.value ? new Set(typesResult.value) : null;

    const cursorDocResult = await resolveCursorDoc({ userId, cursor });
    if (cursorDocResult?.error) {
      return res.status(400).json({ error: cursorDocResult.error });
    }

    let events;
    try {
      events = await listEventsIndexed({
        userId,
        since,
        cursorDoc: cursorDocResult?.doc || null,
        typeSet,
        limit
      });
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      events = await listEventsFallback({
        userId,
        since,
        cursor,
        typeSet,
        limit
      });
    }

    const responseCursor = events.length > 0
      ? events[events.length - 1].id
      : cursor;

    return res.json({
      events,
      cursor: responseCursor || null
    });
  } catch (error) {
    console.error('[events] GET / error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
