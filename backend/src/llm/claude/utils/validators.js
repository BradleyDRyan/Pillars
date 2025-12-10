const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function validateToolBlock(block = {}) {
  const errors = [];

  if (!isNonEmptyString(block?.id)) {
    errors.push('tool block must include an "id"');
  }

  if (!isNonEmptyString(block?.name)) {
    errors.push('tool block must include a "name"');
  }

  if (block.input && typeof block.input !== 'object') {
    errors.push('tool block "input" must be an object when provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateToolDefinition(definition = {}) {
  const errors = [];

  if (!isNonEmptyString(definition?.name)) {
    errors.push('tool definition requires a name');
  }

  if (!isNonEmptyString(definition?.description)) {
    errors.push('tool definition requires a description');
  }

  if (!definition?.input_schema || typeof definition.input_schema !== 'object') {
    errors.push('tool definition requires an input_schema');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateToolBlock,
  validateToolDefinition
};


