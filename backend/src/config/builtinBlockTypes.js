const CANONICAL_SECTION_IDS = Object.freeze(['morning', 'afternoon', 'evening']);
const CANONICAL_SECTION_SET = new Set(CANONICAL_SECTION_IDS);

const BLOCK_TYPE_CATEGORIES = Object.freeze(['built-in', 'custom']);
const BLOCK_TYPE_CATEGORY_SET = new Set(BLOCK_TYPE_CATEGORIES);

const BLOCK_SOURCE_VALUES = Object.freeze(['template', 'user', 'clawdbot', 'auto-sync']);
const BLOCK_SOURCE_SET = new Set(BLOCK_SOURCE_VALUES);

const DATA_FIELD_TYPES = Object.freeze(['string', 'number', 'boolean', 'enum', 'object', 'array']);
const DATA_FIELD_TYPE_SET = new Set(DATA_FIELD_TYPES);

const BUILTIN_BLOCK_TYPES = Object.freeze([
  {
    id: 'sleep',
    name: 'Sleep',
    icon: '.sleep',
    color: '#6366f1',
    category: 'built-in',
    defaultSection: 'morning',
    subtitleTemplate: '{score}% · {durationHours}h',
    dataSchema: {
      fields: [
        { id: 'score', label: 'Sleep Score', type: 'number', min: 0, max: 100 },
        { id: 'quality', label: 'Quality', type: 'number', min: 1, max: 5 },
        { id: 'durationHours', label: 'Duration', type: 'number', min: 0 },
        { id: 'source', label: 'Source', type: 'enum', options: ['manual', 'whoop', 'apple_health'] }
      ]
    },
    isDeletable: false
  },
  {
    id: 'feeling',
    name: 'Feeling',
    icon: '.feeling',
    color: '#0ea5e9',
    category: 'built-in',
    defaultSection: 'morning',
    subtitleTemplate: 'Energy {energy} · Mood {mood}',
    dataSchema: {
      fields: [
        { id: 'energy', label: 'Energy', type: 'number', min: 0, max: 10 },
        { id: 'mood', label: 'Mood', type: 'number', min: 0, max: 10 },
        { id: 'stress', label: 'Stress', type: 'number', min: 0, max: 10 }
      ]
    },
    isDeletable: false
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: '.workout',
    color: '#f97316',
    category: 'built-in',
    defaultSection: 'afternoon',
    subtitleTemplate: '{type} · {duration}',
    dataSchema: {
      fields: [
        { id: 'type', label: 'Type', type: 'string' },
        { id: 'duration', label: 'Duration', type: 'string' },
        { id: 'notes', label: 'Notes', type: 'string' },
        { id: 'source', label: 'Source', type: 'enum', options: ['manual', 'whoop', 'apple_health'] }
      ]
    },
    isDeletable: false
  },
  {
    id: 'reflection',
    name: 'Reflection',
    icon: '.reflection',
    color: '#334155',
    category: 'built-in',
    defaultSection: 'evening',
    subtitleTemplate: '{freeText:truncate50}',
    dataSchema: {
      fields: [
        { id: 'freeText', label: 'Reflection', type: 'string' },
        { id: 'promptedBy', label: 'Prompted By', type: 'string' },
        { id: 'promptText', label: 'Prompt Text', type: 'string' }
      ]
    },
    isDeletable: false
  },
  {
    id: 'habits',
    name: 'Habit',
    icon: '.habits',
    color: '#22c55e',
    category: 'built-in',
    defaultSection: 'morning',
    subtitleTemplate: '{status}',
    dataSchema: {
      fields: [
        { id: 'habitId', label: 'Habit ID', type: 'string' },
        { id: 'name', label: 'Name', type: 'string' },
        { id: 'completed', label: 'Completed', type: 'boolean' },
        { id: 'value', label: 'Value', type: 'number', min: 0 },
        { id: 'notes', label: 'Notes', type: 'string' },
        { id: 'status', label: 'Status', type: 'enum', options: ['pending', 'completed'] }
      ]
    },
    isDeletable: false
  },
  {
    id: 'todo',
    name: 'Todo',
    icon: '.todo',
    color: '#0f766e',
    category: 'built-in',
    defaultSection: 'afternoon',
    subtitleTemplate: '{status}',
    dataSchema: {
      fields: [
        { id: 'todoId', label: 'Todo ID', type: 'string' },
        { id: 'title', label: 'Title', type: 'string' },
        { id: 'description', label: 'Description', type: 'string' },
        { id: 'status', label: 'Status', type: 'enum', options: ['active', 'completed'] },
        { id: 'completedAt', label: 'Completed At', type: 'number', min: 0 },
        { id: 'parentId', label: 'Parent ID', type: 'string' }
      ]
    },
    isDeletable: false
  }
]);

const BUILTIN_BLOCK_TYPE_IDS = new Set(BUILTIN_BLOCK_TYPES.map(type => type.id));

function getBuiltinBlockType(typeId) {
  return BUILTIN_BLOCK_TYPES.find(type => type.id === typeId) || null;
}

function createBuiltinBlockTypeDoc({ userId, type, nowTs }) {
  return {
    id: type.id,
    userId,
    name: type.name,
    icon: type.icon,
    color: type.color,
    category: 'built-in',
    defaultSection: type.defaultSection,
    subtitleTemplate: type.subtitleTemplate,
    dataSchema: type.dataSchema,
    isDeletable: false,
    createdAt: nowTs,
    updatedAt: nowTs
  };
}

module.exports = {
  CANONICAL_SECTION_IDS,
  CANONICAL_SECTION_SET,
  BLOCK_TYPE_CATEGORIES,
  BLOCK_TYPE_CATEGORY_SET,
  BLOCK_SOURCE_VALUES,
  BLOCK_SOURCE_SET,
  DATA_FIELD_TYPES,
  DATA_FIELD_TYPE_SET,
  BUILTIN_BLOCK_TYPES,
  BUILTIN_BLOCK_TYPE_IDS,
  getBuiltinBlockType,
  createBuiltinBlockTypeDoc
};
