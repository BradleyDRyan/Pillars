const PillarTemplate = require('../models/PillarTemplate');
const { normalizeRubricItems, normalizeRubricItemCreate, normalizeRubricItemUpdate, findRubricItemById } = require('../utils/rubrics');
const { normalizeColorToken } = require('./pillarVisuals');

const TEMPLATE_TYPE_REGEX = /^[a-z][a-z0-9_]{1,39}$/;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function createTemplateError(message, status = 400, code = 'invalid_template') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeTemplateType(rawValue, options = {}) {
  const required = options.required !== false;

  if (rawValue === null || rawValue === undefined) {
    if (required) {
      return { error: 'pillarType is required' };
    }
    return { value: null };
  }

  if (typeof rawValue !== 'string') {
    return { error: 'pillarType must be a string' };
  }

  const canonical = rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!canonical) {
    if (required) {
      return { error: 'pillarType is required' };
    }
    return { value: null };
  }

  if (!TEMPLATE_TYPE_REGEX.test(canonical)) {
    return { error: 'pillarType must match ^[a-z][a-z0-9_]{1,39}$' };
  }

  return { value: canonical };
}

function normalizeOptionalString(rawValue, { field, maxLength = 160 } = {}) {
  if (rawValue === undefined) {
    return { value: undefined };
  }
  if (rawValue === null) {
    return { value: null };
  }
  if (typeof rawValue !== 'string') {
    return { error: `${field} must be a string` };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: null };
  }
  if (trimmed.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer` };
  }
  return { value: trimmed };
}

function normalizeRequiredString(rawValue, { field, maxLength = 160 } = {}) {
  if (typeof rawValue !== 'string') {
    return { error: `${field} is required` };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { error: `${field} is required` };
  }
  if (trimmed.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer` };
  }
  return { value: trimmed };
}

function normalizeTemplateOrder(rawValue, { required = false } = {}) {
  if (rawValue === undefined) {
    if (required) {
      return { value: 0 };
    }
    return { value: undefined };
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
    return { error: 'order must be an integer between 0 and 10000' };
  }
  return { value: parsed };
}

function normalizeTemplateIsActive(rawValue, { required = false } = {}) {
  if (rawValue === undefined) {
    return { value: required ? true : undefined };
  }
  if (typeof rawValue !== 'boolean') {
    return { error: 'isActive must be a boolean' };
  }
  return { value: rawValue };
}

function normalizeTemplateColorToken(rawValue, { required = false } = {}) {
  if (rawValue === undefined) {
    return { value: required ? null : undefined };
  }
  if (rawValue === null) {
    return { value: null };
  }
  if (typeof rawValue !== 'string') {
    return { error: 'colorToken must be a string' };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: null };
  }
  const normalized = normalizeColorToken(trimmed);
  if (!normalized) {
    return { error: 'colorToken must be a valid token id' };
  }
  return { value: normalized };
}

function cloneRubricItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(item => ({
    ...item
  }));
}

function templateSort(left, right) {
  const leftOrder = Number.isInteger(left?.order) ? left.order : 0;
  const rightOrder = Number.isInteger(right?.order) ? right.order : 0;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  const leftName = typeof left?.name === 'string' ? left.name : '';
  const rightName = typeof right?.name === 'string' ? right.name : '';
  return leftName.localeCompare(rightName);
}

function ensureTemplateEditable(pillarType) {
  if (pillarType === 'custom') {
    throw createTemplateError('custom is reserved and cannot be stored as a template', 400, 'reserved_template_type');
  }
}

async function listPillarTemplates({ includeInactive = false } = {}) {
  const templates = await PillarTemplate.listAll();
  return templates
    .filter(template => includeInactive || template.isActive)
    .sort(templateSort);
}

async function getPillarTemplateByType(pillarType, { includeInactive = true } = {}) {
  const normalizedType = normalizeTemplateType(pillarType, { required: true });
  if (normalizedType.error) {
    throw createTemplateError(normalizedType.error);
  }

  const template = await PillarTemplate.findByType(normalizedType.value);
  if (!template) {
    return null;
  }

  if (!includeInactive && !template.isActive) {
    return null;
  }

  return template;
}

async function createPillarTemplate(payload, actor = null) {
  const allowedFields = new Set([
    'pillarType',
    'name',
    'description',
    'icon',
    'colorToken',
    'order',
    'isActive',
    'rubricItems'
  ]);
  const payloadKeys = Object.keys(payload || {});
  for (const key of payloadKeys) {
    if (!allowedFields.has(key)) {
      throw createTemplateError(`Unsupported field: ${key}`);
    }
  }

  const normalizedType = normalizeTemplateType(payload?.pillarType, { required: true });
  if (normalizedType.error) {
    throw createTemplateError(normalizedType.error);
  }
  ensureTemplateEditable(normalizedType.value);

  const existing = await PillarTemplate.findByType(normalizedType.value);
  if (existing) {
    throw createTemplateError('Template already exists', 409, 'template_exists');
  }

  const nameResult = normalizeRequiredString(payload?.name, {
    field: 'name',
    maxLength: 100
  });
  if (nameResult.error) {
    throw createTemplateError(nameResult.error);
  }

  const descriptionResult = normalizeOptionalString(payload?.description, {
    field: 'description',
    maxLength: 500
  });
  if (descriptionResult.error) {
    throw createTemplateError(descriptionResult.error);
  }

  const iconResult = normalizeOptionalString(payload?.icon, {
    field: 'icon',
    maxLength: 60
  });
  if (iconResult.error) {
    throw createTemplateError(iconResult.error);
  }

  const colorTokenResult = normalizeTemplateColorToken(payload?.colorToken, { required: true });
  if (colorTokenResult.error) {
    throw createTemplateError(colorTokenResult.error);
  }

  const orderResult = normalizeTemplateOrder(payload?.order, { required: true });
  if (orderResult.error) {
    throw createTemplateError(orderResult.error);
  }

  const activeResult = normalizeTemplateIsActive(payload?.isActive, { required: true });
  if (activeResult.error) {
    throw createTemplateError(activeResult.error);
  }

  const rubricItemsResult = normalizeRubricItems(payload?.rubricItems, {
    fallbackItems: []
  });
  if (rubricItemsResult.error) {
    throw createTemplateError(rubricItemsResult.error);
  }

  const now = nowSeconds();
  const template = new PillarTemplate({
    pillarType: normalizedType.value,
    name: nameResult.value,
    description: descriptionResult.value,
    icon: iconResult.value,
    colorToken: colorTokenResult.value,
    order: orderResult.value,
    isActive: activeResult.value,
    rubricItems: rubricItemsResult.value,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor
  });

  await template.save();
  return template;
}

async function patchPillarTemplate(pillarType, payload, actor = null) {
  const normalizedType = normalizeTemplateType(pillarType, { required: true });
  if (normalizedType.error) {
    throw createTemplateError(normalizedType.error);
  }
  ensureTemplateEditable(normalizedType.value);

  const template = await PillarTemplate.findByType(normalizedType.value);
  if (!template) {
    throw createTemplateError('Template not found', 404, 'template_not_found');
  }

  const allowedFields = new Set([
    'name',
    'description',
    'icon',
    'colorToken',
    'order',
    'isActive'
  ]);
  const payloadKeys = Object.keys(payload || {});
  for (const key of payloadKeys) {
    if (!allowedFields.has(key)) {
      throw createTemplateError(`Unsupported field: ${key}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'name')) {
    const result = normalizeRequiredString(payload.name, {
      field: 'name',
      maxLength: 100
    });
    if (result.error) {
      throw createTemplateError(result.error);
    }
    template.name = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'description')) {
    const result = normalizeOptionalString(payload.description, {
      field: 'description',
      maxLength: 500
    });
    if (result.error) {
      throw createTemplateError(result.error);
    }
    template.description = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'icon')) {
    const result = normalizeOptionalString(payload.icon, {
      field: 'icon',
      maxLength: 60
    });
    if (result.error) {
      throw createTemplateError(result.error);
    }
    template.icon = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'colorToken')) {
    const result = normalizeTemplateColorToken(payload.colorToken);
    if (result.error) {
      throw createTemplateError(result.error);
    }
    template.colorToken = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'order')) {
    const result = normalizeTemplateOrder(payload.order);
    if (result.error) {
      throw createTemplateError(result.error);
    }
    template.order = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'isActive')) {
    const result = normalizeTemplateIsActive(payload.isActive);
    if (result.error) {
      throw createTemplateError(result.error);
    }
    template.isActive = result.value;
  }

  template.updatedBy = actor;
  await template.save();
  return template;
}

async function deactivatePillarTemplate(pillarType, actor = null) {
  return patchPillarTemplate(pillarType, { isActive: false }, actor);
}

async function restorePillarTemplate(pillarType, actor = null) {
  return patchPillarTemplate(pillarType, { isActive: true }, actor);
}

async function addTemplateRubricItem(pillarType, payload, actor = null) {
  const template = await getPillarTemplateByType(pillarType, { includeInactive: true });
  if (!template) {
    throw createTemplateError('Template not found', 404, 'template_not_found');
  }

  const normalizedItem = normalizeRubricItemCreate(payload || {});
  if (normalizedItem.error) {
    throw createTemplateError(normalizedItem.error);
  }

  const items = cloneRubricItems(template.rubricItems);
  if (items.some(item => item && item.id === normalizedItem.value.id)) {
    throw createTemplateError('rubric item id already exists for this template');
  }

  items.push(normalizedItem.value);
  const normalizedItems = normalizeRubricItems(items, {
    fallbackItems: []
  });
  if (normalizedItems.error) {
    throw createTemplateError(normalizedItems.error);
  }

  template.rubricItems = normalizedItems.value;
  template.updatedBy = actor;
  await template.save();
  return template;
}

async function patchTemplateRubricItem(pillarType, rubricItemId, payload, actor = null) {
  const template = await getPillarTemplateByType(pillarType, { includeInactive: true });
  if (!template) {
    throw createTemplateError('Template not found', 404, 'template_not_found');
  }

  const normalizedRubricItemId = typeof rubricItemId === 'string' ? rubricItemId.trim() : '';
  if (!normalizedRubricItemId) {
    throw createTemplateError('rubricItemId is required');
  }

  const allowedFields = new Set(['label', 'points']);
  const payloadKeys = Object.keys(payload || {});
  for (const key of payloadKeys) {
    if (!allowedFields.has(key)) {
      throw createTemplateError(`Unsupported rubric item field: ${key}`);
    }
  }

  const existing = findRubricItemById(template.rubricItems, normalizedRubricItemId);
  if (!existing) {
    throw createTemplateError('Rubric item not found', 404, 'rubric_item_not_found');
  }

  const updated = normalizeRubricItemUpdate(payload || {}, existing);
  if (updated.error) {
    throw createTemplateError(updated.error);
  }

  template.rubricItems = template.rubricItems.map(item => {
    if (!item || item.id !== normalizedRubricItemId) {
      return item;
    }
    return updated.value;
  });
  template.updatedBy = actor;
  await template.save();
  return template;
}

async function removeTemplateRubricItem(pillarType, rubricItemId, actor = null) {
  const template = await getPillarTemplateByType(pillarType, { includeInactive: true });
  if (!template) {
    throw createTemplateError('Template not found', 404, 'template_not_found');
  }

  const normalizedRubricItemId = typeof rubricItemId === 'string' ? rubricItemId.trim() : '';
  if (!normalizedRubricItemId) {
    throw createTemplateError('rubricItemId is required');
  }

  const next = template.rubricItems.filter(item => item && item.id !== normalizedRubricItemId);
  if (next.length === template.rubricItems.length) {
    throw createTemplateError('Rubric item not found', 404, 'rubric_item_not_found');
  }

  template.rubricItems = next;
  template.updatedBy = actor;
  await template.save();
  return template;
}

function buildTemplateLibraryPayload(templates) {
  const activeTemplates = (Array.isArray(templates) ? templates : [])
    .filter(template => template?.isActive !== false)
    .sort(templateSort);

  const defaultRubricTemplates = {};
  const pillarTypes = [];
  const templateLibrary = [];

  for (const template of activeTemplates) {
    if (!template || typeof template.pillarType !== 'string') {
      continue;
    }
    defaultRubricTemplates[template.pillarType] = cloneRubricItems(template.rubricItems);
    pillarTypes.push(template.pillarType);
    templateLibrary.push({
      pillarType: template.pillarType,
      name: template.name,
      description: template.description || null,
      icon: template.icon || null,
      colorToken: template.colorToken || null,
      order: Number.isInteger(template.order) ? template.order : 0,
      rubricItemCount: Array.isArray(template.rubricItems) ? template.rubricItems.length : 0
    });
  }

  if (!pillarTypes.includes('custom')) {
    pillarTypes.push('custom');
  }

  return {
    pillarTypes,
    defaultRubricTemplates,
    templateLibrary
  };
}

module.exports = {
  createTemplateError,
  normalizeTemplateType,
  listPillarTemplates,
  getPillarTemplateByType,
  createPillarTemplate,
  patchPillarTemplate,
  deactivatePillarTemplate,
  restorePillarTemplate,
  addTemplateRubricItem,
  patchTemplateRubricItem,
  removeTemplateRubricItem,
  buildTemplateLibraryPayload
};
