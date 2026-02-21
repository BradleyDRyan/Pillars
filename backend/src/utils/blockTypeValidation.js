const {
  CANONICAL_SECTION_SET,
  DATA_FIELD_TYPE_SET
} = require('../config/builtinBlockTypes');

function createValidationError(message, details = null) {
  const error = new Error(message);
  error.status = 400;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = details;
  }
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, { field, maxLength = 200, allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    throw createValidationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) {
    throw createValidationError(`${field} is required`);
  }

  if (trimmed.length > maxLength) {
    throw createValidationError(`${field} is too long (max ${maxLength})`);
  }

  return trimmed;
}

function normalizeColor(value) {
  const color = normalizeString(value, { field: 'color', maxLength: 7 });
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw createValidationError('color must be a hex value like #22c55e');
  }
  return color.toLowerCase();
}

function normalizeDefaultSection(value) {
  const section = normalizeString(value, { field: 'defaultSection', maxLength: 20 }).toLowerCase();
  if (!CANONICAL_SECTION_SET.has(section)) {
    throw createValidationError('defaultSection must be morning, afternoon, or evening');
  }
  return section;
}

function normalizeFieldSchema(rawField, index) {
  if (!isPlainObject(rawField)) {
    throw createValidationError(`dataSchema.fields[${index}] must be an object`);
  }

  const id = normalizeString(rawField.id, {
    field: `dataSchema.fields[${index}].id`,
    maxLength: 120
  });
  const label = normalizeString(rawField.label, {
    field: `dataSchema.fields[${index}].label`,
    maxLength: 200
  });
  const type = normalizeString(rawField.type, {
    field: `dataSchema.fields[${index}].type`,
    maxLength: 40
  }).toLowerCase();

  if (!DATA_FIELD_TYPE_SET.has(type)) {
    throw createValidationError(`dataSchema.fields[${index}].type is invalid`);
  }

  const normalized = { id, label, type };

  if (Object.prototype.hasOwnProperty.call(rawField, 'min')) {
    if (typeof rawField.min !== 'number' || !Number.isFinite(rawField.min)) {
      throw createValidationError(`dataSchema.fields[${index}].min must be a number`);
    }
    normalized.min = rawField.min;
  }

  if (Object.prototype.hasOwnProperty.call(rawField, 'max')) {
    if (typeof rawField.max !== 'number' || !Number.isFinite(rawField.max)) {
      throw createValidationError(`dataSchema.fields[${index}].max must be a number`);
    }
    normalized.max = rawField.max;
  }

  if (Object.prototype.hasOwnProperty.call(rawField, 'min')
    && Object.prototype.hasOwnProperty.call(rawField, 'max')
    && rawField.min > rawField.max) {
    throw createValidationError(`dataSchema.fields[${index}] has min > max`);
  }

  if (type === 'enum') {
    if (!Array.isArray(rawField.options) || rawField.options.length === 0) {
      throw createValidationError(`dataSchema.fields[${index}].options must be a non-empty array for enum fields`);
    }

    const options = rawField.options.map((option, optionIndex) => {
      if (typeof option !== 'string') {
        throw createValidationError(`dataSchema.fields[${index}].options[${optionIndex}] must be a string`);
      }

      const trimmed = option.trim();
      if (!trimmed) {
        throw createValidationError(`dataSchema.fields[${index}].options[${optionIndex}] cannot be empty`);
      }

      return trimmed;
    });

    normalized.options = Array.from(new Set(options));
  }

  if (Object.prototype.hasOwnProperty.call(rawField, 'required')) {
    if (typeof rawField.required !== 'boolean') {
      throw createValidationError(`dataSchema.fields[${index}].required must be a boolean`);
    }
    normalized.required = rawField.required;
  }

  return normalized;
}

function normalizeDataSchema(value, { required } = { required: false }) {
  if (value === undefined) {
    if (required) {
      return { fields: [] };
    }
    return undefined;
  }

  if (!isPlainObject(value)) {
    throw createValidationError('dataSchema must be an object');
  }

  if (!Array.isArray(value.fields)) {
    throw createValidationError('dataSchema.fields must be an array');
  }

  const fields = value.fields.map((field, index) => normalizeFieldSchema(field, index));

  const seenIds = new Set();
  for (const field of fields) {
    if (seenIds.has(field.id)) {
      throw createValidationError(`Duplicate dataSchema field id: ${field.id}`);
    }
    seenIds.add(field.id);
  }

  return { fields };
}

const MUTABLE_BLOCK_TYPE_FIELDS = new Set([
  'name',
  'icon',
  'color',
  'defaultSection',
  'subtitleTemplate',
  'dataSchema'
]);

function normalizeBlockTypePayload(body, options = {}) {
  const partial = options.partial === true;

  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be an object');
  }

  const normalized = {};
  for (const key of Object.keys(body)) {
    if (!MUTABLE_BLOCK_TYPE_FIELDS.has(key)) {
      throw createValidationError(`Unsupported field: ${key}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    normalized.name = normalizeString(body.name, { field: 'name', maxLength: 200 });
  } else if (!partial) {
    throw createValidationError('name is required');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'icon')) {
    normalized.icon = normalizeString(body.icon, { field: 'icon', maxLength: 40 });
  } else if (!partial) {
    normalized.icon = '.document';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'color')) {
    normalized.color = normalizeColor(body.color);
  } else if (!partial) {
    normalized.color = '#64748b';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'defaultSection')) {
    normalized.defaultSection = normalizeDefaultSection(body.defaultSection);
  } else if (!partial) {
    normalized.defaultSection = 'afternoon';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'subtitleTemplate')) {
    normalized.subtitleTemplate = normalizeString(body.subtitleTemplate, {
      field: 'subtitleTemplate',
      maxLength: 500,
      allowEmpty: true
    });
  } else if (!partial) {
    normalized.subtitleTemplate = '';
  }

  const dataSchema = normalizeDataSchema(body.dataSchema, { required: !partial });
  if (dataSchema !== undefined) {
    normalized.dataSchema = dataSchema;
  }

  if (partial && Object.keys(normalized).length === 0) {
    throw createValidationError('No mutable fields provided');
  }

  return normalized;
}

function normalizeTypeId(value) {
  return normalizeString(value, { field: 'id', maxLength: 120 });
}

module.exports = {
  createValidationError,
  normalizeBlockTypePayload,
  normalizeTypeId,
  isPlainObject
};
