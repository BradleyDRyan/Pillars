const { createHash } = require('crypto');

const RUBRIC_MIN_POINTS = 1;
const RUBRIC_MAX_POINTS = 100;
const RUBRIC_MAX_ITEMS = 100;

const DEFAULT_RUBRIC_TEMPLATES = Object.freeze({
  marriage: Object.freeze([
    { activityType: 'Quality Time', tier: 'Light', points: 10, examples: 'Morning coffee together' },
    { activityType: 'Quality Time', tier: 'Significant', points: 50, examples: 'Date night' },
    { activityType: 'Acts of Service', tier: 'Small', points: 15, examples: 'Handled an errand' },
    { activityType: 'Acts of Service', tier: 'Major', points: 45, examples: 'Big project or gesture' },
    { activityType: 'Gifts', tier: 'Small', points: 30, examples: 'Flowers or favorite snack' },
    { activityType: 'Gifts', tier: 'Significant', points: 50, examples: 'Planned surprise' },
    { activityType: 'Words of Affirmation', tier: 'Meaningful', points: 20, examples: 'Handwritten note or meaningful text' }
  ]),
  physical: Object.freeze([
    { activityType: 'Cardio', tier: 'Light', points: 20, examples: 'Walk or easy bike ride' },
    { activityType: 'Cardio', tier: 'Moderate', points: 40, examples: 'Jog or swim' },
    { activityType: 'Cardio', tier: 'Intense', points: 60, examples: 'HIIT or race training' },
    { activityType: 'Strength', tier: 'Light', points: 25, examples: 'Quick bodyweight session' },
    { activityType: 'Strength', tier: 'Heavy', points: 50, examples: 'Full gym session' },
    { activityType: 'Active Recovery', tier: 'Standard', points: 15, examples: 'Stretching or yoga' }
  ]),
  career: Object.freeze([
    { activityType: 'Deep Work', tier: 'Focused Session', points: 30 },
    { activityType: 'Leverage', tier: 'High-Impact Deliverable', points: 50 },
    { activityType: 'Growth', tier: 'Skill Development', points: 25 }
  ]),
  finances: Object.freeze([
    { activityType: 'Planning', tier: 'Budget Review', points: 20 },
    { activityType: 'Execution', tier: 'Debt / Savings Action', points: 35 },
    { activityType: 'Optimization', tier: 'Major Financial Decision', points: 50 }
  ]),
  house: Object.freeze([
    { activityType: 'Maintenance', tier: 'Routine', points: 15 },
    { activityType: 'Organization', tier: 'Reset', points: 25 },
    { activityType: 'Project', tier: 'Major Improvement', points: 45 }
  ]),
  mentalhealth: Object.freeze([
    { activityType: 'Recovery', tier: 'Quick Reset', points: 15 },
    { activityType: 'Care', tier: 'Intentional Practice', points: 30 },
    { activityType: 'Support', tier: 'Therapy / Coaching', points: 45 }
  ]),
  spiritual: Object.freeze([
    { activityType: 'Connection', tier: 'Daily Practice', points: 20 },
    { activityType: 'Study', tier: 'Focused Reflection', points: 30 },
    { activityType: 'Service', tier: 'Meaningful Contribution', points: 45 }
  ]),
  fallback: Object.freeze([
    { activityType: 'Investment', tier: 'Light', points: 15 },
    { activityType: 'Investment', tier: 'Moderate', points: 30 },
    { activityType: 'Investment', tier: 'Significant', points: 45 }
  ])
});

const DEFAULT_TEMPLATE_SYNONYMS = Object.freeze({
  relationship: 'marriage',
  spouse: 'marriage',
  partner: 'marriage',
  fitness: 'physical',
  health: 'physical',
  mind: 'mentalhealth',
  mental: 'mentalhealth',
  spirit: 'spiritual',
  faith: 'spiritual',
  home: 'house',
  family: 'house',
  money: 'finances',
  finance: 'finances',
  work: 'career',
  business: 'career',
  personal: 'fallback'
});

const PILLAR_TYPE_TO_TEMPLATE_KEY = Object.freeze({
  marriage: 'marriage',
  physical: 'physical',
  career: 'career',
  finances: 'finances',
  house: 'house',
  mental_health: 'mentalhealth',
  spiritual: 'spiritual',
  custom: 'fallback'
});

const PILLAR_TYPE_VALUES = Object.freeze(Object.keys(PILLAR_TYPE_TO_TEMPLATE_KEY));

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeNameKey(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function slugify(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function buildRubricLabel(activityType, tier) {
  const activity = typeof activityType === 'string' ? activityType.trim() : '';
  const intensity = typeof tier === 'string' ? tier.trim() : '';
  if (!activity && !intensity) {
    return '';
  }
  if (!activity) {
    return intensity;
  }
  if (!intensity) {
    return activity;
  }
  return `${activity} - ${intensity}`;
}

function createRubricError(message, status = 400, code = 'invalid_rubric') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function createRubricItemId(activityType, tier) {
  const activitySlug = slugify(activityType) || 'activity';
  const tierSlug = slugify(tier) || 'tier';
  const hash = createHash('sha1')
    .update(`${activitySlug}|${tierSlug}`)
    .digest('hex')
    .slice(0, 8);
  return `ri_${activitySlug}_${tierSlug}_${hash}`;
}

function normalizeTrimmedString(rawValue, { field, maxLength = 120, required = true }) {
  if (rawValue === null || rawValue === undefined) {
    if (required) {
      return { error: `${field} is required` };
    }
    return { value: null };
  }

  if (typeof rawValue !== 'string') {
    return { error: `${field} must be a string` };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    if (required) {
      return { error: `${field} is required` };
    }
    return { value: null };
  }

  if (trimmed.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer` };
  }

  return { value: trimmed };
}

function normalizePoints(rawPoints) {
  const points = Number(rawPoints);
  if (!Number.isInteger(points) || points < RUBRIC_MIN_POINTS || points > RUBRIC_MAX_POINTS) {
    return {
      error: `points must be an integer between ${RUBRIC_MIN_POINTS} and ${RUBRIC_MAX_POINTS}`
    };
  }
  return { value: points };
}

function normalizeRubricItemCreate(rawItem, options = {}) {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return { error: 'rubric item must be an object' };
  }

  const activityTypeResult = normalizeTrimmedString(rawItem.activityType, {
    field: 'activityType',
    maxLength: 120,
    required: true
  });
  if (activityTypeResult.error) {
    return { error: activityTypeResult.error };
  }

  const tierResult = normalizeTrimmedString(rawItem.tier, {
    field: 'tier',
    maxLength: 80,
    required: true
  });
  if (tierResult.error) {
    return { error: tierResult.error };
  }

  const pointsResult = normalizePoints(rawItem.points);
  if (pointsResult.error) {
    return { error: pointsResult.error };
  }

  const examplesResult = normalizeTrimmedString(rawItem.examples, {
    field: 'examples',
    maxLength: 280,
    required: false
  });
  if (examplesResult.error) {
    return { error: examplesResult.error };
  }

  const labelResult = normalizeTrimmedString(rawItem.label, {
    field: 'label',
    maxLength: 180,
    required: false
  });
  if (labelResult.error) {
    return { error: labelResult.error };
  }

  const createdAt = Number.isInteger(options.createdAt) ? options.createdAt : nowSeconds();
  const updatedAt = Number.isInteger(options.updatedAt) ? options.updatedAt : createdAt;
  const id = typeof rawItem.id === 'string' && rawItem.id.trim()
    ? rawItem.id.trim()
    : createRubricItemId(activityTypeResult.value, tierResult.value);

  return {
    value: {
      id,
      activityType: activityTypeResult.value,
      tier: tierResult.value,
      label: labelResult.value || buildRubricLabel(activityTypeResult.value, tierResult.value),
      points: pointsResult.value,
      examples: examplesResult.value || null,
      createdAt,
      updatedAt
    }
  };
}

function normalizeRubricItemUpdate(rawItem, existingItem) {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return { error: 'rubric item update must be an object' };
  }
  if (!existingItem || typeof existingItem !== 'object') {
    return { error: 'existing rubric item is required' };
  }

  const next = {
    ...existingItem
  };

  if (Object.prototype.hasOwnProperty.call(rawItem, 'activityType')) {
    const result = normalizeTrimmedString(rawItem.activityType, {
      field: 'activityType',
      maxLength: 120,
      required: true
    });
    if (result.error) {
      return { error: result.error };
    }
    next.activityType = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(rawItem, 'tier')) {
    const result = normalizeTrimmedString(rawItem.tier, {
      field: 'tier',
      maxLength: 80,
      required: true
    });
    if (result.error) {
      return { error: result.error };
    }
    next.tier = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(rawItem, 'points')) {
    const result = normalizePoints(rawItem.points);
    if (result.error) {
      return { error: result.error };
    }
    next.points = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(rawItem, 'examples')) {
    const result = normalizeTrimmedString(rawItem.examples, {
      field: 'examples',
      maxLength: 280,
      required: false
    });
    if (result.error) {
      return { error: result.error };
    }
    next.examples = result.value || null;
  }

  if (Object.prototype.hasOwnProperty.call(rawItem, 'label')) {
    const result = normalizeTrimmedString(rawItem.label, {
      field: 'label',
      maxLength: 180,
      required: false
    });
    if (result.error) {
      return { error: result.error };
    }
    next.label = result.value || buildRubricLabel(next.activityType, next.tier);
  } else if (
    Object.prototype.hasOwnProperty.call(rawItem, 'activityType')
    || Object.prototype.hasOwnProperty.call(rawItem, 'tier')
  ) {
    next.label = buildRubricLabel(next.activityType, next.tier);
  }

  next.updatedAt = nowSeconds();
  if (!Number.isInteger(next.createdAt)) {
    next.createdAt = next.updatedAt;
  }

  return { value: next };
}

function getDefaultRubricTemplateKeyForPillarName(pillarName) {
  const normalized = normalizeNameKey(pillarName);
  if (!normalized) {
    return 'fallback';
  }

  if (Object.prototype.hasOwnProperty.call(DEFAULT_RUBRIC_TEMPLATES, normalized)) {
    return normalized;
  }

  if (Object.prototype.hasOwnProperty.call(DEFAULT_TEMPLATE_SYNONYMS, normalized)) {
    return DEFAULT_TEMPLATE_SYNONYMS[normalized];
  }

  if (normalized.includes('marriage') || normalized.includes('relationship')) {
    return 'marriage';
  }
  if (normalized.includes('physical') || normalized.includes('fitness') || normalized.includes('health')) {
    return 'physical';
  }
  if (normalized.includes('career') || normalized.includes('work') || normalized.includes('business')) {
    return 'career';
  }
  if (normalized.includes('finance') || normalized.includes('money')) {
    return 'finances';
  }
  if (normalized.includes('house') || normalized.includes('home')) {
    return 'house';
  }
  if (normalized.includes('mental') || normalized.includes('mind')) {
    return 'mentalhealth';
  }
  if (normalized.includes('spirit') || normalized.includes('faith')) {
    return 'spiritual';
  }

  return 'fallback';
}

function buildDefaultRubricItemsForPillarName(pillarName) {
  const key = getDefaultRubricTemplateKeyForPillarName(pillarName);
  return buildDefaultRubricItemsForTemplateKey(key);
}

function buildDefaultRubricItemsForTemplateKey(templateKey) {
  const normalizedKey = normalizeNameKey(templateKey);
  const key = Object.prototype.hasOwnProperty.call(DEFAULT_RUBRIC_TEMPLATES, normalizedKey)
    ? normalizedKey
    : 'fallback';
  const template = DEFAULT_RUBRIC_TEMPLATES[key] || DEFAULT_RUBRIC_TEMPLATES.fallback;
  const createdAt = nowSeconds();

  return template.map(raw => {
    const normalized = normalizeRubricItemCreate(raw, {
      createdAt,
      updatedAt: createdAt
    });
    if (normalized.error) {
      throw createRubricError(normalized.error);
    }
    return normalized.value;
  });
}

function buildDefaultRubricTemplatesByPillarType() {
  const templates = {};
  for (const [pillarType, templateKey] of Object.entries(PILLAR_TYPE_TO_TEMPLATE_KEY)) {
    templates[pillarType] = buildDefaultRubricItemsForTemplateKey(templateKey);
  }
  return templates;
}

function normalizeRubricItems(rawItems, options = {}) {
  if (rawItems === undefined) {
    if (options.useDefaultWhenMissing) {
      return { value: buildDefaultRubricItemsForPillarName(options.pillarName || '') };
    }
    return { value: Array.isArray(options.fallbackItems) ? options.fallbackItems : [] };
  }

  if (rawItems === null) {
    return { value: [] };
  }

  if (!Array.isArray(rawItems)) {
    return { error: 'rubricItems must be an array' };
  }

  if (rawItems.length > RUBRIC_MAX_ITEMS) {
    return { error: `rubricItems must include at most ${RUBRIC_MAX_ITEMS} items` };
  }

  const now = nowSeconds();
  const dedup = new Set();
  const normalizedItems = [];

  for (const rawItem of rawItems) {
    const normalized = normalizeRubricItemCreate(rawItem, {
      createdAt: Number.isInteger(rawItem?.createdAt) ? rawItem.createdAt : now,
      updatedAt: now
    });
    if (normalized.error) {
      return { error: normalized.error };
    }

    if (dedup.has(normalized.value.id)) {
      return { error: 'rubricItems must use unique id values' };
    }
    dedup.add(normalized.value.id);
    normalizedItems.push(normalized.value);
  }

  return { value: normalizedItems };
}

function getRubricItems(pillarData) {
  if (!pillarData || typeof pillarData !== 'object') {
    return [];
  }

  return Array.isArray(pillarData.rubricItems)
    ? pillarData.rubricItems
    : [];
}

function findRubricItemById(rubricItems, rubricItemId) {
  if (!Array.isArray(rubricItems)) {
    return null;
  }
  const normalizedId = typeof rubricItemId === 'string' ? rubricItemId.trim() : '';
  if (!normalizedId) {
    return null;
  }
  return rubricItems.find(item => item && item.id === normalizedId) || null;
}

async function resolveRubricSelection({ db, userId, pillarId, rubricItemId }) {
  const normalizedRubricItemId = typeof rubricItemId === 'string' ? rubricItemId.trim() : '';
  if (!normalizedRubricItemId) {
    throw createRubricError('rubricItemId is required');
  }

  const normalizedPillarId = typeof pillarId === 'string' ? pillarId.trim() : '';
  if (normalizedPillarId) {
    const pillarDoc = await db.collection('pillars').doc(normalizedPillarId).get();
    if (!pillarDoc.exists) {
      throw createRubricError('Invalid pillarId', 400, 'invalid_pillar');
    }
    const pillarData = pillarDoc.data() || {};
    if (pillarData.userId !== userId) {
      throw createRubricError('Invalid pillarId', 400, 'invalid_pillar');
    }

    const rubricItem = findRubricItemById(getRubricItems(pillarData), normalizedRubricItemId);
    if (!rubricItem) {
      throw createRubricError('Invalid rubricItemId for this pillar');
    }
    return {
      pillarId: normalizedPillarId,
      pillar: { id: normalizedPillarId, ...pillarData },
      rubricItem
    };
  }

  const pillarsSnapshot = await db.collection('pillars')
    .where('userId', '==', userId)
    .get();

  let matched = null;
  for (const doc of pillarsSnapshot.docs) {
    const pillarData = doc.data() || {};
    const rubricItem = findRubricItemById(getRubricItems(pillarData), normalizedRubricItemId);
    if (!rubricItem) {
      continue;
    }

    if (matched) {
      throw createRubricError('rubricItemId is ambiguous across pillars. Provide pillarId.');
    }

    matched = {
      pillarId: doc.id,
      pillar: { id: doc.id, ...pillarData },
      rubricItem
    };
  }

  if (!matched) {
    throw createRubricError('Invalid rubricItemId');
  }

  return matched;
}

module.exports = {
  RUBRIC_MIN_POINTS,
  RUBRIC_MAX_POINTS,
  RUBRIC_MAX_ITEMS,
  PILLAR_TYPE_VALUES,
  buildRubricLabel,
  createRubricError,
  normalizeRubricItemCreate,
  normalizeRubricItemUpdate,
  normalizeRubricItems,
  buildDefaultRubricItemsForPillarName,
  buildDefaultRubricItemsForTemplateKey,
  buildDefaultRubricTemplatesByPillarType,
  getDefaultRubricTemplateKeyForPillarName,
  getRubricItems,
  findRubricItemById,
  resolveRubricSelection
};
