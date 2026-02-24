const express = require('express');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { db } = require('../config/firebase');
const { listBlockTypesForUser } = require('../services/blockTypes');
const { VALID_EVENT_TYPES } = require('../services/events');
const { Pillar } = require('../models');
const { listPillarTemplates, buildTemplateLibraryPayload } = require('../services/pillarTemplates');
const { getPillarVisuals } = require('../services/pillarVisuals');
const {
  MAX_USER_CONTEXT_FACTS,
  MAX_USER_CONTEXT_FACT_LENGTH
} = require('../utils/userFactsMarkdown');

const router = express.Router();
router.use(flexibleAuth);

const SECTION_ENUM = Object.freeze(['morning', 'afternoon', 'evening']);
const BLOCK_SOURCE_ENUM = Object.freeze(['template', 'user', 'clawdbot', 'auto-sync']);
const DAY_BATCH_MODE_ENUM = Object.freeze(['replace', 'append', 'merge']);
const TODO_STATUS_ENUM = Object.freeze(['active', 'completed']);
const HABIT_STATUS_ENUM = Object.freeze(['active', 'inactive']);
const ACTION_STATUS_ENUM = Object.freeze(['pending', 'completed', 'skipped', 'canceled']);
const ARCHIVE_VISIBILITY_ENUM = Object.freeze(['exclude', 'include', 'only']);
const WEEKDAY_ENUM = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
const HABIT_TARGET_TYPE_ENUM = Object.freeze(['binary', 'count', 'duration']);
const POINT_EVENT_SOURCE_ENUM = Object.freeze(['user', 'clawdbot', 'system']);
const POINT_EVENT_REF_TYPE_ENUM = Object.freeze(['todo', 'habit', 'block', 'action', 'freeform']);
const PLAN_ENDPOINT = '/api/plan/by-date/:date';
const LEGACY_DAY_BATCH_SUNSET = '2026-03-31';

async function getPillarIconValues() {
  const visuals = await getPillarVisuals();
  if (Array.isArray(visuals?.icons) && visuals.icons.length > 0) {
    return visuals.icons
      .filter(icon => icon?.isActive !== false && typeof icon.id === 'string' && icon.id.trim())
      .map(icon => icon.id.trim());
  }
  if (Array.isArray(Pillar?.VALID_ICON_VALUES) && Pillar.VALID_ICON_VALUES.length > 0) {
    return [...Pillar.VALID_ICON_VALUES];
  }
  return [];
}

async function buildPillarIconSchema() {
  const iconValues = await getPillarIconValues();

  return {
    endpoint: '/api/schemas/pillar-icons',
    description: 'Canonical pillar icon values accepted by the pillars API.',
    values: iconValues
  };
}

async function buildPillarIconListResponse() {
  const values = await getPillarIconValues();
  return {
    values,
    count: values.length,
    endpoint: '/api/schemas/pillar-icons'
  };
}

function buildRubricItemSchema() {
  return {
    type: 'object',
    required: ['id', 'activityType', 'tier', 'label', 'points', 'createdAt', 'updatedAt'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      activityType: { type: 'string', minLength: 1, maxLength: 120 },
      tier: { type: 'string', minLength: 1, maxLength: 80 },
      label: { type: 'string', minLength: 1, maxLength: 180 },
      points: { type: 'integer', min: 1, max: 100 },
      examples: { type: 'string', maxLength: 280, nullable: true },
      createdAt: { type: 'integer' },
      updatedAt: { type: 'integer' }
    }
  };
}

async function buildPillarSchema() {
  const rubricItemSchema = buildRubricItemSchema();
  const templates = await listPillarTemplates({ includeInactive: true });
  const visuals = await getPillarVisuals();
  const {
    pillarTypes,
    defaultRubricTemplates,
    templateLibrary
  } = buildTemplateLibraryPayload(templates);

  return {
    endpoint: '/api/pillars',
    pillarTypes: {
      values: [...pillarTypes],
      default: 'custom'
    },
    rubricItem: rubricItemSchema,
    defaultRubricTemplates,
    templateLibraryEndpoint: '/api/pillar-templates',
    templateLibrary,
    visualsEndpoint: '/api/schemas/pillar-visuals',
    visualsAdminEndpoint: '/api/pillar-visuals',
    visuals: {
      colors: visuals.colors,
      icons: visuals.icons
    },
    rubricRead: {
      endpoint: '/api/pillars/:id/rubric',
      response: {
        type: 'object',
        required: ['pillarId', 'rubricItems'],
        additionalProperties: false,
        properties: {
          pillarId: { type: 'string' },
          rubricItems: {
            type: 'array',
            items: rubricItemSchema
          }
        }
      }
    },
    rubricCreate: {
      endpoint: '/api/pillars/:id/rubric',
      type: 'object',
      required: ['activityType', 'tier', 'points'],
      additionalProperties: false,
      properties: {
        activityType: { type: 'string', minLength: 1, maxLength: 120 },
        tier: { type: 'string', minLength: 1, maxLength: 80 },
        label: { type: 'string', maxLength: 180, nullable: true },
        points: { type: 'integer', min: 1, max: 100 },
        examples: { type: 'string', maxLength: 280, nullable: true }
      }
    },
    rubricUpdate: {
      endpoint: '/api/pillars/:id/rubric/:rubricItemId',
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        activityType: { type: 'string', minLength: 1, maxLength: 120 },
        tier: { type: 'string', minLength: 1, maxLength: 80 },
        label: { type: 'string', maxLength: 180, nullable: true },
        points: { type: 'integer', min: 1, max: 100 },
        examples: { type: 'string', maxLength: 280, nullable: true }
      }
    },
    notes: [
      'Rubric defaults are backend-driven and can be updated server-side.',
      'New pillars receive rubric snapshots from active DB templates when rubricItems is omitted.',
      'When rubricItems is omitted, pillarType is required (except custom, which starts empty).',
      'Pillar colors are token-driven. Store colorToken only; clients render token values locally.',
      'Admin icon/color catalog CRUD is available at /api/pillar-visuals (writes require admin claim or internal service secret).',
      'Template CRUD is available at /api/pillar-templates (writes require admin claim or internal service secret).',
      'Pillars accept optional contextMarkdown to provide classifier guidance for that pillar.',
      'Actions and action templates may reference a rubric item by id via bounty rubricItemId.'
    ]
  };
}

function buildUserSchema() {
  return {
    endpoint: '/api/users/profile',
    contextField: 'contextMarkdown',
    contextFormat: 'markdown',
    contextConstraints: {
      maxFacts: MAX_USER_CONTEXT_FACTS,
      maxFactLength: MAX_USER_CONTEXT_FACT_LENGTH
    },
    // Legacy aliases retained while schema consumers migrate.
    factsField: 'contextMarkdown',
    factsFormat: 'markdown',
    factsConstraints: {
      maxFacts: MAX_USER_CONTEXT_FACTS,
      maxFactLength: MAX_USER_CONTEXT_FACT_LENGTH
    },
    profileUpdate: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        displayName: { type: 'string', nullable: true },
        photoURL: { type: 'string', nullable: true },
        phoneNumber: { type: 'string', nullable: true },
        contextMarkdown: {
          type: 'string',
          nullable: true,
          description: 'Canonical user context store. Accepts plain text or markdown; null clears context.'
        },
        additionalData: {
          type: 'object',
          nullable: true,
          additionalProperties: true,
          description: 'Optional profile fields merged into the user profile document.'
        }
      }
    },
    notes: [
      'contextMarkdown is the canonical user context field.',
      '/api/users/profile accepts Firebase tokens and user-scoped API keys.',
      'Legacy facts input may still be accepted on /api/users/profile for compatibility but should not be used.',
      'Context is stored as provided (trimmed). Bullet prefixes are optional.'
    ]
  };
}

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
      },
      classificationSummary: {
        type: 'object',
        nullable: true,
        additionalProperties: false,
        properties: {
          matchedPillarIds: { type: 'array', items: { type: 'string' } },
          trimmedPillarIds: { type: 'array', items: { type: 'string' } },
          method: { type: 'string' },
          fallbackUsed: { type: 'boolean' },
          modelUsed: { type: 'string', nullable: true },
          modelRationale: { type: 'string', nullable: true },
          modelSystemPrompt: { type: 'string', nullable: true },
          modelUserPrompt: { type: 'string', nullable: true },
          modelResponseRaw: { type: 'string', nullable: true }
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
        description: 'Use "none" to filter todos with no bounty allocations. Otherwise matches todos where any allocation pillarId equals the value.'
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
        assignment: {
          type: 'object',
          additionalProperties: false,
          properties: {
            mode: { type: 'string', enum: ['auto', 'manual'] },
            pillarIds: { type: 'array', items: { type: 'string' } }
          }
        },
        labels: { type: 'array', items: { type: 'string' } },
        pillarId: { type: 'string', nullable: true },
        bountyPoints: { type: 'integer', min: 1, max: 150, nullable: true },
        bountyPillarId: { type: 'string', nullable: true },
        rubricItemId: {
          type: 'string',
          nullable: true,
          description: 'When provided, bounty points are derived from this pillar rubric item.'
        },
        autoClassify: {
          type: 'boolean',
          description: 'Deprecated for todo assignment. Use assignment.mode=auto|manual.'
        },
        bountyAllocations: {
          type: 'array',
          nullable: true,
          minItems: 1,
          items: {
            type: 'object',
            required: ['pillarId', 'points'],
            additionalProperties: false,
            properties: {
              pillarId: { type: 'string' },
              points: { type: 'integer', min: 1, max: 100 }
            }
          },
          description: 'Optional bounty split; total points must be <=150'
        }
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
        assignment: {
          type: 'object',
          additionalProperties: false,
          properties: {
            mode: { type: 'string', enum: ['auto', 'manual'] },
            pillarIds: { type: 'array', items: { type: 'string' } }
          }
        },
        labels: { type: 'array', items: { type: 'string' } },
        pillarId: { type: 'string', nullable: true },
        bountyPoints: { type: 'integer', min: 1, max: 150, nullable: true },
        bountyPillarId: { type: 'string', nullable: true },
        rubricItemId: {
          type: 'string',
          nullable: true,
          description: 'When provided, bounty points are derived from this pillar rubric item.'
        },
        bountyAllocations: {
          type: 'array',
          nullable: true,
          minItems: 1,
          items: {
            type: 'object',
            required: ['pillarId', 'points'],
            additionalProperties: false,
            properties: {
              pillarId: { type: 'string' },
              points: { type: 'integer', min: 1, max: 100 }
            }
          },
          description: 'Optional bounty split; total points must be <=150'
        }
      }
    },
    createResponse: todoMutationResponse,
    updateResponse: todoMutationResponse
  };
}

function buildHabitSchema() {
  const habitScheduleSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['daily', 'weekly'] },
      daysOfWeek: {
        type: 'array',
        items: { type: 'string', enum: WEEKDAY_ENUM }
      }
    }
  };

  const habitTargetSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: HABIT_TARGET_TYPE_ENUM },
      value: { type: 'number', min: 0 },
      unit: { type: 'string', nullable: true }
    }
  };

  const habitMutationResponse = {
    type: 'object',
    required: ['habit'],
    additionalProperties: true,
    properties: {
      habit: {
        type: 'object',
        additionalProperties: true
      }
    }
  };

  const habitListQuery = {
    type: 'object',
    required: [],
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: [...HABIT_STATUS_ENUM, 'all'],
        default: 'active',
        description: 'Habit status filter. Defaults to active.'
      },
      active: {
        type: 'boolean',
        description: 'Legacy alias for status (true => active, false => inactive).'
      },
      archived: {
        type: 'string',
        enum: ARCHIVE_VISIBILITY_ENUM,
        default: 'exclude',
        description: 'Archived visibility filter.'
      },
      includeArchived: {
        type: 'boolean',
        description: 'Legacy alias for archived (true => include, false => exclude).'
      },
      sectionId: {
        type: 'string',
        enum: SECTION_ENUM
      },
      dayOfWeek: {
        type: 'string',
        enum: WEEKDAY_ENUM,
        description: 'Filter scheduled habits for a specific weekday.'
      },
      pillarId: {
        type: 'string',
        description: 'Use "none" to filter habits with no pillar assignment.'
      },
      groupId: {
        type: 'string',
        description: 'Use "none" to filter habits with no group assignment.'
      },
      q: {
        type: 'string',
        description: 'Case-insensitive search across habit name, description, and target unit.'
      },
      search: {
        type: 'string',
        description: 'Legacy alias for q.'
      }
    }
  };

  const habitReadQuery = {
    type: 'object',
    required: [],
    additionalProperties: false,
    properties: {}
  };

  return {
    listQuery: habitListQuery,
    readQuery: habitReadQuery,
    create: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', maxLength: 2000, nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM },
        schedule: habitScheduleSchema,
        target: habitTargetSchema,
        isActive: { type: 'boolean' },
        pillarId: { type: 'string', nullable: true },
        groupId: { type: 'string', nullable: true },
        bountyPoints: { type: 'integer', min: 1, max: 100, nullable: true },
        bountyPillarId: { type: 'string', nullable: true },
        bountyReason: { type: 'string', maxLength: 500, nullable: true },
        rubricItemId: {
          type: 'string',
          nullable: true,
          description: 'When provided, bounty points are derived from this pillar rubric item.'
        },
        autoClassify: {
          type: 'boolean',
          description: 'When true, backend classifies the habit text against the selected pillar rubric when rubricItemId is not provided.'
        },
        bountyAllocations: {
          type: 'array',
          nullable: true,
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            required: ['pillarId', 'points'],
            additionalProperties: false,
            properties: {
              pillarId: { type: 'string' },
              points: { type: 'integer', min: 1, max: 100 }
            }
          },
          description: 'Optional bounty split; total points must be <=150'
        }
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
        schedule: habitScheduleSchema,
        target: habitTargetSchema,
        isActive: { type: 'boolean' },
        pillarId: { type: 'string', nullable: true },
        groupId: { type: 'string', nullable: true },
        bountyPoints: { type: 'integer', min: 1, max: 100, nullable: true },
        bountyPillarId: { type: 'string', nullable: true },
        bountyReason: { type: 'string', maxLength: 500, nullable: true },
        rubricItemId: {
          type: 'string',
          nullable: true,
          description: 'When provided, bounty points are derived from this pillar rubric item.'
        },
        bountyAllocations: {
          type: 'array',
          nullable: true,
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            required: ['pillarId', 'points'],
            additionalProperties: false,
            properties: {
              pillarId: { type: 'string' },
              points: { type: 'integer', min: 1, max: 100 }
            }
          },
          description: 'Optional bounty split; total points must be <=150'
        }
      }
    },
    log: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        completed: { type: 'boolean' },
        status: {
          type: 'string',
          enum: ['completed', 'skipped', 'pending']
        },
        value: { type: 'number', min: 0, nullable: true },
        notes: { type: 'string', maxLength: 2000, nullable: true }
      }
    },
    createResponse: habitMutationResponse,
    updateResponse: habitMutationResponse
  };
}

function buildBountySchema() {
  return {
    type: 'object',
    required: ['pillarId', 'points'],
    additionalProperties: false,
    properties: {
      pillarId: { type: 'string' },
      rubricItemId: { type: 'string', nullable: true },
      points: { type: 'integer', min: 1, max: 100 }
    }
  };
}

function buildCadenceSchema() {
  return {
    type: 'object',
    required: ['type'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['daily', 'weekdays', 'weekly'] },
      daysOfWeek: {
        type: 'array',
        items: { type: 'string', enum: WEEKDAY_ENUM }
      }
    }
  };
}

function buildActionSchema() {
  const bountySchema = buildBountySchema();

  return {
    listByDate: {
      endpoint: '/api/actions/by-date/:date',
      query: {
        type: 'object',
        required: [],
        additionalProperties: false,
        properties: {
          ensure: { type: 'boolean', default: false },
          status: { type: 'string', enum: [...ACTION_STATUS_ENUM, 'all'], default: 'all' },
          sectionId: { type: 'string', enum: SECTION_ENUM, nullable: true }
        }
      }
    },
    read: {
      endpoint: '/api/actions/:id'
    },
    createEndpoint: '/api/actions',
    create: {
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500 },
        notes: { type: 'string', maxLength: 2000, nullable: true },
        status: { type: 'string', enum: ACTION_STATUS_ENUM, default: 'pending' },
        targetDate: { type: 'string', format: 'date', nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM, nullable: true },
        order: { type: 'integer', nullable: true },
        templateId: { type: 'string', nullable: true },
        source: { type: 'string', nullable: true },
        bounties: {
          type: 'array',
          nullable: true,
          minItems: 1,
          maxItems: 3,
          items: bountySchema
        }
      }
    },
    updateEndpoint: '/api/actions/:id',
    update: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500 },
        notes: { type: 'string', maxLength: 2000, nullable: true },
        status: { type: 'string', enum: ACTION_STATUS_ENUM },
        targetDate: { type: 'string', format: 'date', nullable: true },
        sectionId: { type: 'string', enum: SECTION_ENUM },
        order: { type: 'integer' },
        templateId: { type: 'string', nullable: true },
        source: { type: 'string', nullable: true },
        bounties: {
          type: 'array',
          nullable: true,
          minItems: 1,
          maxItems: 3,
          items: bountySchema
        }
      }
    },
    archive: {
      endpoint: '/api/actions/:id',
      method: 'DELETE'
    },
    notes: [
      'If bounties is omitted on create, backend classifier resolves rubric-aware bounties from title+notes.',
      'Entering completed awards points; leaving completed voids the action point event.'
    ]
  };
}

function buildActionTemplateSchema() {
  const bountySchema = buildBountySchema();
  const cadenceSchema = buildCadenceSchema();

  return {
    list: {
      endpoint: '/api/action-templates',
      query: {
        type: 'object',
        required: [],
        additionalProperties: false,
        properties: {
          archived: { type: 'string', enum: ARCHIVE_VISIBILITY_ENUM, default: 'exclude' },
          includeInactive: { type: 'boolean', default: true }
        }
      }
    },
    createEndpoint: '/api/action-templates',
    create: {
      type: 'object',
      required: ['title', 'cadence'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500 },
        notes: { type: 'string', maxLength: 2000, nullable: true },
        cadence: cadenceSchema,
        defaultSectionId: { type: 'string', enum: SECTION_ENUM, nullable: true },
        defaultOrder: { type: 'integer', nullable: true },
        defaultBounties: {
          type: 'array',
          nullable: true,
          minItems: 1,
          maxItems: 3,
          items: bountySchema
        },
        isActive: { type: 'boolean', default: true },
        startDate: { type: 'string', format: 'date', nullable: true },
        endDate: { type: 'string', format: 'date', nullable: true }
      }
    },
    updateEndpoint: '/api/action-templates/:id',
    update: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 500 },
        notes: { type: 'string', maxLength: 2000, nullable: true },
        cadence: cadenceSchema,
        defaultSectionId: { type: 'string', enum: SECTION_ENUM },
        defaultOrder: { type: 'integer' },
        defaultBounties: {
          type: 'array',
          nullable: true,
          minItems: 1,
          maxItems: 3,
          items: bountySchema
        },
        isActive: { type: 'boolean' },
        startDate: { type: 'string', format: 'date', nullable: true },
        endDate: { type: 'string', format: 'date', nullable: true }
      }
    },
    archive: {
      endpoint: '/api/action-templates/:id',
      method: 'DELETE'
    },
    notes: [
      'If defaultBounties is omitted on create/update, backend classifies title+notes once and persists defaults.',
      'Spawned actions inherit template bounties without per-spawn classifier calls.'
    ]
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

function buildPointEventSchema() {
  const allocation = {
    type: 'object',
    required: ['pillarId', 'points'],
    additionalProperties: false,
    properties: {
      pillarId: { type: 'string' },
      points: { type: 'integer', min: 1, max: 100 }
    }
  };

  const ref = {
    type: 'object',
    nullable: true,
    required: ['type', 'id'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: POINT_EVENT_REF_TYPE_ENUM },
      id: { type: 'string', minLength: 1 }
    }
  };

  return {
    endpoint: '/api/point-events',
    allocation,
    create: {
      type: 'object',
      required: ['date', 'reason'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1 },
        date: { type: 'string', format: 'date' },
        reason: {
          type: 'string',
          minLength: 1,
          maxLength: 300,
          description: 'Required activity text. Used for auto-classification when allocations and rubricItemId are omitted.'
        },
        source: { type: 'string', enum: POINT_EVENT_SOURCE_ENUM, default: 'user' },
        ref,
        pillarId: {
          type: 'string',
          nullable: true,
          description: 'Optional pillar scope for rubricItemId resolution.'
        },
        rubricItemId: {
          type: 'string',
          nullable: true,
          description: 'Alternative to allocations. When set, backend derives pillar + points from rubric.'
        },
        allocations: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: allocation,
          description: 'Optional explicit allocations. If omitted with no rubricItemId, backend classifies reason text and derives a single allocation.'
        }
      }
    },
    listQuery: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        fromDate: { type: 'string', format: 'date', nullable: true },
        toDate: { type: 'string', format: 'date', nullable: true },
        pillarId: { type: 'string', nullable: true },
        refType: { type: 'string', enum: POINT_EVENT_REF_TYPE_ENUM, nullable: true },
        refId: { type: 'string', nullable: true },
        source: { type: 'string', enum: POINT_EVENT_SOURCE_ENUM, nullable: true }
      }
    },
    rollupQuery: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        fromDate: { type: 'string', format: 'date', nullable: true },
        toDate: { type: 'string', format: 'date', nullable: true }
      }
    }
  };
}

router.get('/', async (req, res) => {
  try {
    const response = await buildSchemasResponse(req.user.uid);
    return res.json(response);
  } catch (error) {
    console.error('[schemas] GET / error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

async function buildSchemasResponse(userId) {
  const blockTypes = await listBlockTypesForUser({
    db,
    userId,
    ensureBuiltins: true
  });
  const pillarIcons = await buildPillarIconSchema();
  const pillarSchema = await buildPillarSchema();
  const pillarVisuals = await getPillarVisuals();

  return {
    blockTypes: blockTypes.map(toCanonicalBlockType),
    actionSchema: buildActionSchema(),
    actionTemplateSchema: buildActionTemplateSchema(),
    planSchema: buildPlanSchema(),
    userSchema: buildUserSchema(),
    pillarSchema,
    pillarIcons,
    pillarVisuals,
    pointEventSchema: buildPointEventSchema(),
    eventTypes: [...VALID_EVENT_TYPES].sort()
  };
}

router.get('/pillar-icons', async (req, res) => {
  try {
    const pillarIcons = await buildPillarIconListResponse();
    return res.json(pillarIcons);
  } catch (error) {
    console.error('[schemas] GET /pillar-icons error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/pillar-visuals', async (req, res) => {
  try {
    const visuals = await getPillarVisuals();
    return res.json(visuals);
  } catch (error) {
    console.error('[schemas] GET /pillar-visuals error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = {
  router,
  buildSchemasResponse,
  buildActionSchema,
  buildActionTemplateSchema,
  buildTodoSchema,
  buildHabitSchema,
  buildDaySchema,
  buildPlanSchema,
  buildPointEventSchema,
  buildUserSchema,
  buildPillarSchema,
  buildRubricItemSchema,
  buildPillarIconSchema,
  buildPillarIconListResponse,
  toCanonicalBlockType,
  getPillarIconValues,
  buildJsonLikeDataSchema
};
