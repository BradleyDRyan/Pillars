const { firestore } = require('../config/firebase');
const { Pillar } = require('../models');

const COLLECTION = 'appConfig';
const DOC_ID = 'pillarVisuals';

const DEFAULT_COLORS = Object.freeze([
  { id: 'coral', label: 'Coral', order: 10, isActive: true },
  { id: 'rose', label: 'Rose', order: 20, isActive: true },
  { id: 'violet', label: 'Violet', order: 30, isActive: true },
  { id: 'indigo', label: 'Indigo', order: 40, isActive: true },
  { id: 'blue', label: 'Blue', order: 50, isActive: true },
  { id: 'sky', label: 'Sky', order: 60, isActive: true },
  { id: 'mint', label: 'Mint', order: 70, isActive: true },
  { id: 'green', label: 'Green', order: 80, isActive: true },
  { id: 'lime', label: 'Lime', order: 90, isActive: true },
  { id: 'amber', label: 'Amber', order: 100, isActive: true },
  { id: 'orange', label: 'Orange', order: 110, isActive: true },
  { id: 'slate', label: 'Slate', order: 120, isActive: true }
]);

function normalizeId(rawValue) {
  if (typeof rawValue !== 'string') {
    return null;
  }
  const normalized = rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

function normalizeLabel(rawValue, fallback) {
  if (typeof rawValue !== 'string') {
    return fallback;
  }
  const trimmed = rawValue.trim();
  return trimmed || fallback;
}

function normalizeOrder(rawValue, fallback) {
  if (!Number.isFinite(rawValue)) {
    return fallback;
  }
  const rounded = Math.round(rawValue);
  if (rounded < 0) {
    return 0;
  }
  return rounded;
}

function sanitizeColors(rawColors, fallbackColors) {
  const source = Array.isArray(rawColors) ? rawColors : fallbackColors;
  const normalized = [];
  const seen = new Set();

  source.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const id = normalizeId(entry.id);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push({
      id,
      label: normalizeLabel(entry.label, id),
      order: normalizeOrder(entry.order, index * 10),
      isActive: entry.isActive !== false
    });
  });

  if (normalized.length === 0) {
    return sanitizeColors(fallbackColors, fallbackColors);
  }

  return normalized.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });
}

function sanitizeIcons(rawIcons) {
  const fallbackIconIds = Array.isArray(Pillar.VALID_ICON_VALUES)
    ? Pillar.VALID_ICON_VALUES
    : [];

  const source = Array.isArray(rawIcons)
    ? rawIcons
    : fallbackIconIds.map((id, index) => ({
      id,
      label: id,
      order: index
    }));

  const normalized = [];
  const seen = new Set();

  source.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const id = normalizeId(entry.id);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push({
      id,
      label: normalizeLabel(entry.label, id),
      defaultColorToken: normalizeId(entry.defaultColorToken),
      order: normalizeOrder(entry.order, index * 10),
      isActive: entry.isActive !== false
    });
  });

  return normalized.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });
}

function applyIconColorConstraints(icons, colors) {
  const colorIds = new Set(
    (Array.isArray(colors) ? colors : [])
      .map(color => color?.id)
      .filter(id => typeof id === 'string' && id.trim())
  );

  return (Array.isArray(icons) ? icons : []).map(icon => {
    const normalizedDefaultColorToken = normalizeId(icon?.defaultColorToken);
    return {
      ...icon,
      defaultColorToken: normalizedDefaultColorToken && colorIds.has(normalizedDefaultColorToken)
        ? normalizedDefaultColorToken
        : null
    };
  });
}

function buildVisualsResponse({ source, updatedAt, colors, icons }) {
  return {
    endpoint: '/api/schemas/pillar-visuals',
    source,
    updatedAt,
    colors,
    icons
  };
}

async function getPillarVisuals() {
  try {
    const snapshot = await firestore.collection(COLLECTION).doc(DOC_ID).get();
    const data = snapshot.exists ? (snapshot.data() || {}) : {};

    const colors = sanitizeColors(data.colors, DEFAULT_COLORS);
    const icons = applyIconColorConstraints(sanitizeIcons(data.icons), colors);
    const updatedAt = Number.isInteger(data.updatedAt)
      ? data.updatedAt
      : Math.floor(Date.now() / 1000);

    return buildVisualsResponse({
      source: snapshot.exists ? 'db' : 'default',
      updatedAt,
      colors,
      icons
    });
  } catch (error) {
    const colors = sanitizeColors(DEFAULT_COLORS, DEFAULT_COLORS);
    const icons = applyIconColorConstraints(sanitizeIcons(null), colors);
    return buildVisualsResponse({
      source: 'default',
      updatedAt: Math.floor(Date.now() / 1000),
      colors,
      icons
    });
  }
}

async function savePillarVisuals({
  colors,
  icons,
  updatedBy
}) {
  const normalizedColors = sanitizeColors(colors, DEFAULT_COLORS);
  const normalizedIcons = applyIconColorConstraints(sanitizeIcons(icons), normalizedColors);
  const updatedAt = Math.floor(Date.now() / 1000);

  await firestore.collection(COLLECTION).doc(DOC_ID).set({
    colors: normalizedColors,
    icons: normalizedIcons,
    updatedAt,
    updatedBy: typeof updatedBy === 'string' && updatedBy.trim()
      ? updatedBy.trim()
      : null
  }, { merge: false });

  return buildVisualsResponse({
    source: 'db',
    updatedAt,
    colors: normalizedColors,
    icons: normalizedIcons
  });
}

function normalizeColorToken(rawValue) {
  return normalizeId(rawValue);
}

module.exports = {
  getPillarVisuals,
  savePillarVisuals,
  normalizeColorToken
};
