const {
  CANONICAL_SECTION_SET,
  BLOCK_SOURCE_SET
} = require('../config/builtinBlockTypes');
const { createValidationError, isPlainObject } = require('./blockTypeValidation');

const CREATE_MUTABLE_FIELDS = new Set([
  'id',
  'typeId',
  'sectionId',
  'order',
  'isExpanded',
  'title',
  'subtitle',
  'icon',
  'pillarId',
  'source',
  'data'
]);

const PATCH_MUTABLE_FIELDS = new Set([
  'sectionId',
  'order',
  'isExpanded',
  'title',
  'subtitle',
  'icon',
  'pillarId',
  'source',
  'data'
]);

function normalizeNullableString(value, { field, maxLength = 500, allowNull = true } = {}) {
  if (value === null && allowNull) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${field} must be a string${allowNull ? ' or null' : ''}`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return allowNull ? null : '';
  }

  if (trimmed.length > maxLength) {
    throw createValidationError(`${field} is too long (max ${maxLength})`);
  }

  return trimmed;
}

function normalizeSectionId(value) {
  if (typeof value !== 'string') {
    throw createValidationError('sectionId must be a string');
  }

  const sectionId = value.trim().toLowerCase();
  if (!CANONICAL_SECTION_SET.has(sectionId)) {
    throw createValidationError('sectionId must be morning, afternoon, or evening');
  }

  return sectionId;
}

function normalizeOrder(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createValidationError('order must be a number');
  }
  return Math.trunc(parsed);
}

function normalizeBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw createValidationError(`${field} must be a boolean`);
  }
  return value;
}

function normalizeSource(value) {
  if (typeof value !== 'string') {
    throw createValidationError('source must be a string');
  }

  const normalized = value.trim();
  if (!BLOCK_SOURCE_SET.has(normalized)) {
    throw createValidationError('source must be template, user, clawdbot, or auto-sync');
  }

  return normalized;
}

function normalizeCreatePayload(body) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be an object');
  }

  for (const key of Object.keys(body)) {
    if (!CREATE_MUTABLE_FIELDS.has(key)) {
      throw createValidationError(`Unsupported field: ${key}`);
    }
  }

  if (typeof body.typeId !== 'string' || !body.typeId.trim()) {
    throw createValidationError('typeId is required');
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'data') || !isPlainObject(body.data)) {
    throw createValidationError('data is required and must be an object');
  }

  const payload = {
    typeId: body.typeId.trim(),
    sectionId: normalizeSectionId(body.sectionId || ''),
    order: normalizeOrder(body.order ?? 0),
    isExpanded: Object.prototype.hasOwnProperty.call(body, 'isExpanded')
      ? normalizeBoolean(body.isExpanded, 'isExpanded')
      : false,
    title: Object.prototype.hasOwnProperty.call(body, 'title')
      ? normalizeNullableString(body.title, { field: 'title', maxLength: 200, allowNull: true })
      : null,
    subtitle: Object.prototype.hasOwnProperty.call(body, 'subtitle')
      ? normalizeNullableString(body.subtitle, { field: 'subtitle', maxLength: 500, allowNull: true })
      : null,
    icon: Object.prototype.hasOwnProperty.call(body, 'icon')
      ? normalizeNullableString(body.icon, { field: 'icon', maxLength: 40, allowNull: true })
      : null,
    pillarId: Object.prototype.hasOwnProperty.call(body, 'pillarId')
      ? body.pillarId
      : null,
    source: Object.prototype.hasOwnProperty.call(body, 'source')
      ? normalizeSource(body.source)
      : 'user',
    data: cloneJson(body.data)
  };

  if (Object.prototype.hasOwnProperty.call(body, 'id')) {
    if (typeof body.id !== 'string' || !body.id.trim()) {
      throw createValidationError('id must be a non-empty string');
    }
    payload.id = body.id.trim();
  }

  return payload;
}

function normalizePatchPayload(body) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be an object');
  }

  for (const key of Object.keys(body)) {
    if (!PATCH_MUTABLE_FIELDS.has(key)) {
      throw createValidationError(`Unsupported field: ${key}`);
    }
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, 'sectionId')) {
    payload.sectionId = normalizeSectionId(body.sectionId);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'order')) {
    payload.order = normalizeOrder(body.order);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isExpanded')) {
    payload.isExpanded = normalizeBoolean(body.isExpanded, 'isExpanded');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    payload.title = normalizeNullableString(body.title, {
      field: 'title',
      maxLength: 200,
      allowNull: true
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'subtitle')) {
    payload.subtitle = normalizeNullableString(body.subtitle, {
      field: 'subtitle',
      maxLength: 500,
      allowNull: true
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'icon')) {
    payload.icon = normalizeNullableString(body.icon, {
      field: 'icon',
      maxLength: 40,
      allowNull: true
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'pillarId')) {
    payload.pillarId = body.pillarId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'source')) {
    payload.source = normalizeSource(body.source);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'data')) {
    if (!isPlainObject(body.data)) {
      throw createValidationError('data must be an object');
    }
    payload.data = cloneJson(body.data);
  }

  if (Object.keys(payload).length === 0) {
    throw createValidationError('No mutable fields provided');
  }

  return payload;
}

function deepMergeData(target, patch) {
  if (!isPlainObject(patch)) {
    return cloneJson(patch);
  }

  const output = isPlainObject(target) ? cloneJson(target) : {};

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMergeData(output[key], value);
      continue;
    }

    output[key] = cloneJson(value);
  }

  return output;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function summarizeSchemaFields(fields) {
  return fields.map(field => ({
    id: field.id,
    type: field.type,
    required: Boolean(field.required),
    options: Array.isArray(field.options) ? [...field.options] : undefined,
    min: typeof field.min === 'number' ? field.min : undefined,
    max: typeof field.max === 'number' ? field.max : undefined
  }));
}

function validateFieldValue(field, value, fieldName) {
  if (value === null || value === undefined) {
    return;
  }

  if (field.type === 'string') {
    if (typeof value !== 'string') {
      throw createValidationError(`${fieldName} must be a string`);
    }
    return;
  }

  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw createValidationError(`${fieldName} must be a number`);
    }

    if (typeof field.min === 'number' && value < field.min) {
      throw createValidationError(`${fieldName} must be >= ${field.min}`);
    }

    if (typeof field.max === 'number' && value > field.max) {
      throw createValidationError(`${fieldName} must be <= ${field.max}`);
    }
    return;
  }

  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw createValidationError(`${fieldName} must be a boolean`);
    }
    return;
  }

  if (field.type === 'enum') {
    if (typeof value !== 'string') {
      throw createValidationError(`${fieldName} must be a string`);
    }

    if (!Array.isArray(field.options) || !field.options.includes(value)) {
      throw createValidationError(`${fieldName} must be one of: ${(field.options || []).join(', ')}`);
    }
    return;
  }

  if (field.type === 'object') {
    if (!isPlainObject(value)) {
      throw createValidationError(`${fieldName} must be an object`);
    }
    return;
  }

  if (field.type === 'array') {
    if (!Array.isArray(value)) {
      throw createValidationError(`${fieldName} must be an array`);
    }
  }
}

function validateDataAgainstSchema(data, blockType) {
  if (!isPlainObject(data)) {
    throw createValidationError('data must be an object');
  }

  const fields = Array.isArray(blockType?.dataSchema?.fields)
    ? blockType.dataSchema.fields
    : [];

  const fieldsById = new Map(fields.map(field => [field.id, field]));
  const typeId = blockType?.id || 'unknown';
  const allowedKeys = fields.map(field => field.id);
  const requiredKeys = fields.filter(field => field.required).map(field => field.id);
  const schema = summarizeSchemaFields(fields);

  for (const key of Object.keys(data)) {
    if (!fieldsById.has(key)) {
      throw createValidationError(`data.${key} is not allowed for type ${typeId}`, {
        code: 'invalid_data_key',
        typeId,
        invalidKey: key,
        allowedKeys,
        requiredKeys,
        schema
      });
    }

    const field = fieldsById.get(key);
    try {
      validateFieldValue(field, data[key], `data.${key}`);
    } catch (error) {
      if (error?.status === 400) {
        throw createValidationError(error.message, {
          code: 'invalid_data_field_value',
          typeId,
          fieldId: field.id,
          expected: summarizeSchemaFields([field])[0],
          providedValue: data[key],
          allowedKeys,
          requiredKeys
        });
      }
      throw error;
    }
  }

  for (const field of fields) {
    if (field.required && !Object.prototype.hasOwnProperty.call(data, field.id)) {
      throw createValidationError(`data.${field.id} is required`, {
        code: 'missing_required_data_field',
        typeId,
        missingField: field.id,
        allowedKeys,
        requiredKeys,
        schema
      });
    }

    if (Object.prototype.hasOwnProperty.call(data, field.id)) {
      try {
        validateFieldValue(field, data[field.id], `data.${field.id}`);
      } catch (error) {
        if (error?.status === 400) {
          throw createValidationError(error.message, {
            code: 'invalid_data_field_value',
            typeId,
            fieldId: field.id,
            expected: summarizeSchemaFields([field])[0],
            providedValue: data[field.id],
            allowedKeys,
            requiredKeys
          });
        }
        throw error;
      }
    }
  }

  return cloneJson(data);
}

module.exports = {
  normalizeCreatePayload,
  normalizePatchPayload,
  deepMergeData,
  validateDataAgainstSchema
};
