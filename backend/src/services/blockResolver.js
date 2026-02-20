const { isPlainObject } = require('../utils/blockTypeValidation');

function truncateText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

function formatTemplateValue(rawValue, formatter) {
  if (formatter === 'truncate50') {
    return truncateText(rawValue, 50);
  }

  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return String(rawValue);
  }

  if (typeof rawValue === 'string') {
    return rawValue;
  }

  return JSON.stringify(rawValue);
}

function renderSubtitleTemplate(template, data) {
  if (typeof template !== 'string' || !template.trim()) {
    return null;
  }

  if (!isPlainObject(data)) {
    return template;
  }

  const rendered = template.replace(/\{([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_]+))?\}/g, (_, key, formatter) => {
    return formatTemplateValue(data[key], formatter);
  });

  const collapsed = rendered.replace(/\s+/g, ' ').trim();
  return collapsed || null;
}

function resolveBlockDisplay({ block, blockType }) {
  const resolvedTitle = block.title ?? blockType?.name ?? null;
  const resolvedIcon = block.icon ?? blockType?.icon ?? null;
  const templateSubtitle = renderSubtitleTemplate(blockType?.subtitleTemplate, block.data);
  const resolvedSubtitle = block.subtitle ?? templateSubtitle ?? null;

  return {
    resolvedTitle,
    resolvedIcon,
    resolvedSubtitle
  };
}

async function fetchPillarMap({ db, userId, pillarIds }) {
  const ids = Array.from(new Set((pillarIds || []).filter(id => typeof id === 'string' && id.trim())));
  if (ids.length === 0) {
    return new Map();
  }

  const pairs = await Promise.all(ids.map(async id => {
    const doc = await db.collection('pillars').doc(id).get();
    if (!doc.exists) {
      return [id, null];
    }

    const data = doc.data() || {};
    if (data.userId !== userId) {
      return [id, null];
    }

    return [id, {
      id: doc.id,
      name: data.name || null,
      icon: data.icon || null,
      color: data.color || null
    }];
  }));

  return new Map(pairs.filter(([, pillar]) => pillar));
}

async function resolveBlockPayloads({ db, userId, blocks, blockTypesById, includePillar = false }) {
  const pillarMap = includePillar
    ? await fetchPillarMap({
      db,
      userId,
      pillarIds: blocks.map(block => block.pillarId)
    })
    : new Map();

  return blocks.map(block => {
    const blockType = blockTypesById.get(block.typeId) || null;
    const display = resolveBlockDisplay({ block, blockType });

    return {
      ...block,
      ...display,
      pillar: includePillar && block.pillarId
        ? (pillarMap.get(block.pillarId) || null)
        : undefined
    };
  });
}

module.exports = {
  renderSubtitleTemplate,
  resolveBlockDisplay,
  resolveBlockPayloads
};
