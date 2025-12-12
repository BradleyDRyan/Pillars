/**
 * Tool Registry - Central registry of tools that can be assigned to agents
 * 
 * Modeled after imagine repo architecture.
 * Each tool has:
 * - name: unique identifier
 * - description: what the tool does (for LLM)
 * - input_schema: JSON schema for inputs
 * - handler: async function that executes the tool
 */

const { OnboardingPillar, OnboardingTheme, OnboardingPrinciple } = require('../models');

/**
 * Tool definitions with handlers
 */
const TOOLS = {
  list_pillars: {
    name: 'list_pillars',
    description: 'List all existing pillars with their themes. Use this to see what content already exists.',
    input_schema: {
      type: 'object',
      properties: {
        includeInactive: {
          type: 'boolean',
          description: 'Whether to include inactive pillars'
        }
      },
      required: []
    },
    handler: async (input) => {
      const pillars = await OnboardingPillar.findAll(input.includeInactive || false);
      const result = [];
      for (const pillar of pillars) {
        const themes = await OnboardingTheme.findByPillarId(pillar.id, true);
        result.push({
          id: pillar.id,
          title: pillar.title,
          description: pillar.description,
          isActive: pillar.isActive,
          themes: themes.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description
          }))
        });
      }
      return { pillars: result };
    }
  },

  create_pillar: {
    name: 'create_pillar',
    description: 'Create a new pillar (top-level category). Only create if it doesn\'t already exist.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The pillar title (e.g., "Relationships", "Career")' },
        description: { type: 'string', description: 'A brief description of this pillar' },
        icon: { type: 'string', description: 'SF Symbol name for the icon' },
        color: { type: 'string', description: 'Hex color code (e.g., "#6366f1")' }
      },
      required: ['title']
    },
    handler: async (input) => {
      // Check if pillar with similar title exists
      const existing = await OnboardingPillar.findAll(true);
      const existingPillar = existing.find(p => 
        p.title.toLowerCase() === input.title.toLowerCase()
      );
      
      if (existingPillar) {
        return { 
          alreadyExists: true, 
          pillar: { id: existingPillar.id, title: existingPillar.title }
        };
      }

      const pillar = await OnboardingPillar.create({
        title: input.title,
        description: input.description || '',
        icon: input.icon || null,
        color: input.color || '#6366f1',
        order: existing.length,
        isActive: true
      });
      
      return { created: true, pillar: { id: pillar.id, title: pillar.title } };
    }
  },

  create_theme: {
    name: 'create_theme',
    description: 'Create a new theme (sub-category) under a pillar. Themes group related principles.',
    input_schema: {
      type: 'object',
      properties: {
        pillarId: { type: 'string', description: 'The ID of the parent pillar' },
        title: { type: 'string', description: 'The theme title (e.g., "Marriage", "Communication")' },
        description: { type: 'string', description: 'A brief description of this theme' },
        icon: { type: 'string', description: 'SF Symbol name for the icon' }
      },
      required: ['pillarId', 'title']
    },
    handler: async (input) => {
      // Check if theme exists under this pillar
      const existingThemes = await OnboardingTheme.findByPillarId(input.pillarId, true);
      const existingTheme = existingThemes.find(t => 
        t.title.toLowerCase() === input.title.toLowerCase()
      );
      
      if (existingTheme) {
        return { 
          alreadyExists: true, 
          theme: { id: existingTheme.id, title: existingTheme.title }
        };
      }

      const theme = await OnboardingTheme.create({
        pillarId: input.pillarId,
        title: input.title,
        description: input.description || '',
        icon: input.icon || null,
        order: existingThemes.length,
        isActive: true
      });
      
      return { created: true, theme: { id: theme.id, title: theme.title } };
    }
  },

  create_principle: {
    name: 'create_principle',
    description: 'Create a new principle (life lesson/wisdom). Principles are created as drafts and need approval.',
    input_schema: {
      type: 'object',
      properties: {
        themeId: { type: 'string', description: 'The ID of the parent theme' },
        title: { type: 'string', description: 'Short title for the principle' },
        description: { type: 'string', description: 'The full principle text/wisdom' },
        source: { type: 'string', description: 'Attribution or source of this principle' },
        sourceUrl: { type: 'string', description: 'URL to the source if available' }
      },
      required: ['themeId', 'title', 'description']
    },
    handler: async (input) => {
      const principle = await OnboardingPrinciple.create({
        themeId: input.themeId,
        title: input.title,
        description: input.description,
        source: input.source || null,
        sourceUrl: input.sourceUrl || null,
        order: 0,
        isActive: true,
        isDraft: true // Always create as draft
      });
      
      return { 
        created: true, 
        isDraft: true,
        principle: { id: principle.id, title: principle.title }
      };
    }
  },

  approve_principles: {
    name: 'approve_principles',
    description: 'Approve draft principles to make them visible to users.',
    input_schema: {
      type: 'object',
      properties: {
        principleIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of principle IDs to approve'
        }
      },
      required: ['principleIds']
    },
    handler: async (input) => {
      const approved = [];
      for (const id of input.principleIds) {
        const principle = await OnboardingPrinciple.findById(id);
        if (principle) {
          await principle.update({ isDraft: false });
          approved.push({ id, title: principle.title });
        }
      }
      return { approved };
    }
  },

  list_draft_principles: {
    name: 'list_draft_principles',
    description: 'List all principles that are still in draft status and need approval.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: async () => {
      const allPillars = await OnboardingPillar.findAll(true);
      const drafts = [];
      
      for (const pillar of allPillars) {
        const themes = await OnboardingTheme.findByPillarId(pillar.id, true);
        for (const theme of themes) {
          const principles = await OnboardingPrinciple.findByThemeId(theme.id, true, true);
          const draftPrinciples = principles.filter(p => p.isDraft);
          for (const p of draftPrinciples) {
            drafts.push({
              id: p.id,
              title: p.title,
              description: p.description,
              pillar: pillar.title,
              theme: theme.title
            });
          }
        }
      }
      
      return { drafts, count: drafts.length };
    }
  }
};

/**
 * Get all available tool names
 */
function getAvailableToolNames() {
  return Object.keys(TOOLS);
}

/**
 * Get tool definitions (for LLM) - optionally filtered to specific tools
 */
function getToolDefinitions(toolNames = null) {
  const names = toolNames || Object.keys(TOOLS);
  return names
    .filter(name => TOOLS[name])
    .map(name => ({
      name: TOOLS[name].name,
      description: TOOLS[name].description,
      input_schema: TOOLS[name].input_schema
    }));
}

/**
 * Get a single tool by name
 */
function getTool(name) {
  return TOOLS[name] || null;
}

/**
 * Execute a tool by name
 */
async function executeTool(name, input) {
  const tool = TOOLS[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return await tool.handler(input);
}

/**
 * Get tool metadata for admin UI
 */
function getToolsForAdmin() {
  return Object.entries(TOOLS).map(([key, tool]) => ({
    id: key,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema
  }));
}

module.exports = {
  TOOLS,
  getAvailableToolNames,
  getToolDefinitions,
  getTool,
  executeTool,
  getToolsForAdmin
};

