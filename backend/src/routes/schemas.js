const express = require('express');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { db } = require('../config/firebase');
const { listBlockTypesForUser } = require('../services/blockTypes');
const { VALID_EVENT_TYPES } = require('../services/events');

const router = express.Router();
router.use(flexibleAuth);

const SECTION_ENUM = Object.freeze(['morning', 'afternoon', 'evening']);
const BLOCK_SOURCE_ENUM = Object.freeze(['template', 'user', 'clawdbot', 'auto-sync']);
const DAY_BATCH_MODE_ENUM = Object.freeze(['replace', 'append', 'merge']);
const TODO_STATUS_ENUM = Object.freeze(['active', 'completed']);
const HABIT_TARGET_TYPE_ENUM = Object.freeze(['binary', 'count', 'duration']);
const PLAN_ENDPOINT = '/api/plan/by-date/:date';
const LEGACY_DAY_BATCH_SUNSET = '2026-03-31';

function buildJsonLikeDataSchema(rawDataSchema) {
  const fields = Array.isArray(rawDataSchema?.fields) ? rawDataSchema.fields : [];
  const properties = {};
  const required = [];

  fields.forEach(field => {
    if (!field || typeof field !== 'object' || typeof field.id !== 'string' || !field.id.trim()) {
      return;
    }

    const key = field.id.trim();
    const type = typeof field.type === 'string' ? field.type.trim().toLowerCase() : 'string';
    const schema = {};

    if (type === 'enum') {
      schema.type = 'string';
      if (Array.isArray(field.options)) {
        schema.enum = field.options.filter(option => typeof option === 'string');
      }
    } else if (type === 'number' || type === 'string' || type === 'boolean' || type === 'object' || type === 'array') {
      schema.type = type;
    } else {
      schema.type = 'string';
    }

    if (typeof field.min === 'number') {
      schema.min = field.min;
    }
    if (typeof field.max === 'number') {
      schema.max = field.max;
    }
    if (typeof field.label === 'string' && field.label.trim()) {
      schema.label = field.label.trim();
    }

    properties[key] = schema;
    if (field.required === true) {
      required.push(key);
    }
  });

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}

function toCanonicalBlockType(type) {
  return {
    id: type.id,
    name: type.name || null,
    defaultSection: type.defaultSection || 'afternoon',
    subtitleTemplate: type.subtitleTemplate || '',
    dataSchema: buildJsonLikeDataSchema(type.dataSchema),
    category: type.category || 'custom',
    icon: type.icon || null,
    color: type.color || null
  };
}

function buildTodoSchema() {
  const todoScheduleSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      date: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Set YYYY-MM-DD to schedule onto that day. Set null to unschedule.'
      },
      sectionId: { type: 'string', enum: SECTION_ENUM, nullable: true },
      order: { type: 'integer', nullable: true }
    }
  };

  const todoMutationResponse = {
    type: 'object',
    required: ['todo'],
    additionalProperties: true,
    properties: {
      todo: {
        type: 'object',
        additionalProperties: true
      },
      scheduled: {
        type: 'object',
        nullable: true,
        additionalProperties: false,
        properties: {
          date: { type: 'string', format: 'date' },
          blockId: { type: 'string' }
        }
      }
    }
  };

  const todoListQuery = {
    type: 'object',
    required: [],
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: [...TODO_STATUS_ENUM, 'all'],
        default: 'active',
        description: 'Todo state filter. Defaults to active.'
      },
      dueDate: {
        type: 'string',
        description: 'Use YYYY-MM-DD for exact day, "none" for unscheduled, or omit for any due date. Legacy aliases "all" and "any" are accepted.'
      },
      sectionId: {
        type: 'string',
        enum: SECTION_ENUM,
        description: 'Filter to a day section.'
      },
      parentId: {
        type: 'string',
        default: 'none',
        description: 'Use "none" (default) for root todos, "any" for subtasks only, "all" for both root and subtasks, or a specific parent todo id.'
      },
      pillarId: {
        type: 'string',
        description: 'Use "none" to filter todos with no pillar assignment. Omit for all pillars.'
      },
      archived: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        default: 'exclude',
        description: 'Archived visibility filter.'
      },
      includeArchived: {
        type: 'boolean',
        description: 'Legacy alias for archived (true => include, false => exclude).'
      },
      includeSubtasks: {
        type: 'boolean',
        default: false,
        description: 'When true, return nested subtasks under each root todo.'
      },
      flat: {
        type: 'boolean',
        default: false,
        description: 'When true, return a flat list (no nested subtasks). Combine with parentId=all to include both root todos and subtasks.'
      },
      q: {
        type: 'string',
        description: 'Case-insensitive search across content, description, and labels.'
      },
      search: {
        type: 'string',
        description: 'Legacy alias for q.'
      }
    }
  };

  const todoReadQuery = {
    type: 'object',
    required: [],
    additionalProperties: false,
    properties: {
      includeSubtasks: { type: 'boolean', default: true },
      archived: { type: 'string', enum: ['exclude', 'include', 'only'], default: 'exclude' },
      includeArchived: {
        type: 'boolean',
        description: 'Legacy alias for archived (true => include, false => exclude).'
      }
    }
  };

  return {
    listQuery: todoListQuery,
    readQuery: todoReadQuery,
    create: {
      type: 'object',
      required: ['content'],
      additionalProperties: false,
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', maxLength: 2000, nullable: true },
        dueDate: { type: 'string', format: 'date', nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM },
        priority: { type: 'integer', min: 1, max: 4 },
        parentId: { type: 'string', nullable: true },
        status: { type: 'string', enum: TODO_STATUS_ENUM },
        order: { type: 'integer' },
        schedule: todoScheduleSchema,
        labels: { type: 'array', items: { type: 'string' } },
        pillarId: { type: 'string', nullable: true }
      }
    },
    update: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', maxLength: 2000, nullable: true },
        dueDate: { type: 'string', format: 'date', nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM },
        priority: { type: 'integer', min: 1, max: 4 },
        parentId: { type: 'string', nullable: true },
        status: { type: 'string', enum: TODO_STATUS_ENUM },
        order: { type: 'integer' },
        schedule: todoScheduleSchema,
        labels: { type: 'array', items: { type: 'string' } },
        pillarId: { type: 'string', nullable: true }
      }
    },
    createResponse: todoMutationResponse,
    updateResponse: todoMutationResponse
  };
}

function buildHabitSchema() {
  return {
    create: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', maxLength: 2000, nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM },
        schedule: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['daily', 'weekly'] },
            daysOfWeek: { type: 'array', items: { type: 'string', enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] } }
          }
        },
        target: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: HABIT_TARGET_TYPE_ENUM },
            value: { type: 'number', min: 0 },
            unit: { type: 'string', nullable: true }
          }
        },
        isActive: { type: 'boolean' },
        pillarId: { type: 'string', nullable: true }
      }
    },
    update: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', maxLength: 2000, nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM },
        schedule: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['daily', 'weekly'] },
            daysOfWeek: { type: 'array', items: { type: 'string', enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] } }
          }
        },
        target: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: HABIT_TARGET_TYPE_ENUM },
            value: { type: 'number', min: 0 },
            unit: { type: 'string', nullable: true }
          }
        },
        isActive: { type: 'boolean' },
        pillarId: { type: 'string', nullable: true }
      }
    },
    log: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        completed: { type: 'boolean' },
        value: { type: 'number', min: 0, nullable: true },
        notes: { type: 'string', maxLength: 2000, nullable: true }
      }
    }
  };
}

function buildDaySchema() {
  const dayReadResponse = {
    type: 'object',
    required: ['id', 'userId', 'date', 'sections', 'exists'],
    additionalProperties: true,
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      date: { type: 'string', format: 'date' },
      exists: { type: 'boolean' },
      createdAt: { type: 'number', nullable: true },
      updatedAt: { type: 'number', nullable: true },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'blocks'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', enum: SECTION_ENUM },
            blocks: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    }
  };

  return {
    readToday: {
      endpoint: '/api/days/today?date=YYYY-MM-DD',
      response: dayReadResponse
    },
    readByDate: {
      endpoint: '/api/days/by-date/:date',
      response: dayReadResponse
    },
    batchPush: {
      endpoint: '/api/days/:date/blocks/batch',
      deprecated: true,
      replacementEndpoint: PLAN_ENDPOINT,
      sunsetAt: LEGACY_DAY_BATCH_SUNSET,
      type: 'object',
      required: [],
      atLeastOneOf: ['blocks', 'deletes'],
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: DAY_BATCH_MODE_ENUM, default: 'replace' },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['typeId', 'sectionId', 'order'],
            additionalProperties: false,
            properties: {
              typeId: {
                type: 'string',
                minLength: 1,
                not: { enum: ['todo', 'todos', 'habits', 'morninghabits', 'sleep', 'feeling', 'workout', 'reflection'] }
              },
              sectionId: { type: 'string', enum: SECTION_ENUM },
              order: { type: 'integer' },
              title: { type: 'string', maxLength: 200, nullable: true },
              subtitle: { type: 'string', maxLength: 500, nullable: true },
              icon: { type: 'string', maxLength: 40, nullable: true },
              source: { type: 'string', enum: BLOCK_SOURCE_ENUM, default: 'clawdbot' },
              pillarId: { type: 'string', nullable: true },
              isExpanded: { type: 'boolean', default: false },
              data: {
                type: 'object',
                nullable: true,
                description: 'Must match the selected block type dataSchema.'
              }
            }
          }
        },
        deletes: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string', minLength: 1 },
              {
                type: 'object',
                required: ['blockId'],
                additionalProperties: false,
                properties: {
                  blockId: { type: 'string', minLength: 1 }
                }
              }
            ]
          },
          description: 'Delete day-native blocks by id. Projected ids are not supported in this field.'
        }
      }
    }
  };
}

function buildPlanSchema() {
  return {
    endpoint: PLAN_ENDPOINT,
    idempotency: {
      header: 'Idempotency-Key',
      replayHeader: 'Idempotency-Replayed',
      required: false
    },
    type: 'object',
    required: ['day'],
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: DAY_BATCH_MODE_ENUM, default: 'replace' },
      primitives: {
        type: 'object',
        additionalProperties: false,
        properties: {
          todos: {
            type: 'object',
            additionalProperties: false,
            properties: {
              upsert: {
                type: 'array',
                items: {
                  type: 'object',
                  required: [],
                  oneOf: [
                    { required: ['id'] },
                    { required: ['clientId'] }
                  ],
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string', minLength: 1 },
                    clientId: { type: 'string', minLength: 1 },
                    content: { type: 'string', minLength: 1, maxLength: 500 },
                    description: { type: 'string', maxLength: 2000, nullable: true },
                    dueDate: { type: 'string', format: 'date', nullable: true },
                    sectionId: { type: 'string', enum: SECTION_ENUM },
                    priority: { type: 'integer', min: 1, max: 4 },
                    parentId: { type: 'string', nullable: true },
                    status: { type: 'string', enum: TODO_STATUS_ENUM },
                    order: { type: 'integer' },
                    labels: { type: 'array', items: { type: 'string' } },
                    pillarId: { type: 'string', nullable: true }
                  }
                }
              }
            }
          }
        }
      },
      day: {
        type: 'object',
        required: ['blocks'],
        additionalProperties: false,
        properties: {
          blocks: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'object',
                  required: ['typeId', 'sectionId', 'order', 'todoRef'],
                  additionalProperties: false,
                  properties: {
                    typeId: { type: 'string', enum: ['todo'] },
                    sectionId: { type: 'string', enum: SECTION_ENUM },
                    order: { type: 'integer' },
                    todoRef: {
                      type: 'object',
                      required: [],
                      oneOf: [
                        { required: ['id'] },
                        { required: ['clientId'] }
                      ],
                      additionalProperties: false,
                      properties: {
                        id: { type: 'string', minLength: 1 },
                        clientId: { type: 'string', minLength: 1 }
                      }
                    }
                  }
                },
                {
                  type: 'object',
                  required: ['typeId', 'sectionId', 'order'],
                  additionalProperties: false,
                  properties: {
                    typeId: {
                      type: 'string',
                      minLength: 1,
                      not: { enum: ['todo', 'todos', 'habits', 'morninghabits', 'sleep', 'feeling', 'workout', 'reflection'] }
                    },
                    sectionId: { type: 'string', enum: SECTION_ENUM },
                    order: { type: 'integer' },
                    title: { type: 'string', maxLength: 200, nullable: true },
                    subtitle: { type: 'string', maxLength: 500, nullable: true },
                    icon: { type: 'string', maxLength: 40, nullable: true },
                    source: { type: 'string', enum: BLOCK_SOURCE_ENUM, default: 'clawdbot' },
                    pillarId: { type: 'string', nullable: true },
                    isExpanded: { type: 'boolean', default: false },
                    data: {
                      type: 'object',
                      nullable: true,
                      description: 'Must match the selected block type dataSchema.'
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    notes: [
      'Todo and habit blocks are projections. Use primitives as source of truth.',
      'Habit projections are not supported in /api/plan yet.',
      'Default day-native blocks (sleep/feeling/workout/reflection) are disabled.'
    ]
  };
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const blockTypes = await listBlockTypesForUser({
      db,
      userId,
      ensureBuiltins: true
    });

    const response = {
      blockTypes: blockTypes.map(toCanonicalBlockType),
      todoSchema: buildTodoSchema(),
      habitSchema: buildHabitSchema(),
      daySchema: buildDaySchema(),
      planSchema: buildPlanSchema(),
      eventTypes: [...VALID_EVENT_TYPES].sort()
    };

    return res.json(response);
  } catch (error) {
    console.error('[schemas] GET / error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
