/**
 * Admin Chat Routes - Streaming LLM interface for content management
 * 
 * Provides SSE streaming chat with tool calling for creating/managing
 * pillars, themes, and principles.
 */

const express = require('express');
const router = express.Router();
const { OnboardingPillar, OnboardingTheme, OnboardingPrinciple } = require('../models');
const { logger } = require('../config/firebase');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

// Tool definitions for the LLM
const tools = [
  {
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
    }
  },
  {
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
    }
  },
  {
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
    }
  },
  {
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
    }
  },
  {
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
    }
  },
  {
    name: 'list_draft_principles',
    description: 'List all principles that are still in draft status and need approval.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Tool execution functions
async function executeTool(toolName, toolInput) {
  switch (toolName) {
    case 'list_pillars': {
      const pillars = await OnboardingPillar.findAll(toolInput.includeInactive || false);
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

    case 'create_pillar': {
      // Check if pillar with similar title exists
      const existing = await OnboardingPillar.findAll(true);
      const existingPillar = existing.find(p => 
        p.title.toLowerCase() === toolInput.title.toLowerCase()
      );
      
      if (existingPillar) {
        return { 
          alreadyExists: true, 
          pillar: { id: existingPillar.id, title: existingPillar.title }
        };
      }

      const pillar = await OnboardingPillar.create({
        title: toolInput.title,
        description: toolInput.description || '',
        icon: toolInput.icon || null,
        color: toolInput.color || '#6366f1',
        order: existing.length,
        isActive: true
      });
      
      return { created: true, pillar: { id: pillar.id, title: pillar.title } };
    }

    case 'create_theme': {
      // Check if theme exists under this pillar
      const existingThemes = await OnboardingTheme.findByPillarId(toolInput.pillarId, true);
      const existingTheme = existingThemes.find(t => 
        t.title.toLowerCase() === toolInput.title.toLowerCase()
      );
      
      if (existingTheme) {
        return { 
          alreadyExists: true, 
          theme: { id: existingTheme.id, title: existingTheme.title }
        };
      }

      const theme = await OnboardingTheme.create({
        pillarId: toolInput.pillarId,
        title: toolInput.title,
        description: toolInput.description || '',
        icon: toolInput.icon || null,
        order: existingThemes.length,
        isActive: true
      });
      
      return { created: true, theme: { id: theme.id, title: theme.title } };
    }

    case 'create_principle': {
      const principle = await OnboardingPrinciple.create({
        themeId: toolInput.themeId,
        title: toolInput.title,
        description: toolInput.description,
        source: toolInput.source || null,
        sourceUrl: toolInput.sourceUrl || null,
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

    case 'approve_principles': {
      const approved = [];
      for (const id of toolInput.principleIds) {
        const principle = await OnboardingPrinciple.findById(id);
        if (principle) {
          await principle.update({ isDraft: false });
          approved.push({ id, title: principle.title });
        }
      }
      return { approved };
    }

    case 'list_draft_principles': {
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

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// System prompt for the assistant
const SYSTEM_PROMPT = `You are an AI assistant helping manage content for a life coaching app called Pillars. 
The app helps users develop good habits based on principles of wisdom.

The content hierarchy is:
1. Pillars - Top-level categories (e.g., "Relationships", "Career", "Health")
2. Themes - Sub-categories within pillars (e.g., "Marriage" under "Relationships")
3. Principles - Individual pieces of wisdom/life lessons within themes

When users give you text to extract wisdom from:
1. First use list_pillars to see what already exists
2. Create new pillars/themes only if needed
3. Extract principles as actionable, concise wisdom
4. All new principles are created as drafts for review

Be conversational and helpful. After creating content, summarize what was created.
Format your responses with markdown for readability.`;

/**
 * POST /api/admin-chat/stream
 * Stream a chat response with tool calling
 */
router.post('/stream', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Helper to send SSE events
  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    let conversationMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 15;

    while (continueLoop && iterations < maxIterations) {
      iterations++;

      // Create streaming response
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages: conversationMessages
      });

      let currentToolUse = null;
      let accumulatedText = '';
      let toolInputJson = '';

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            // Text block starting
          } else if (event.content_block.type === 'tool_use') {
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            };
            toolInputJson = '';
            // Emit tool call start
            sendEvent('tool_start', {
              id: currentToolUse.id,
              name: currentToolUse.name
            });
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            accumulatedText += event.delta.text;
            sendEvent('text', event.delta.text);
          } else if (event.delta.type === 'input_json_delta') {
            toolInputJson += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try {
              currentToolUse.input = JSON.parse(toolInputJson);
            } catch (e) {
              currentToolUse.input = {};
            }
          }
        } else if (event.type === 'message_stop') {
          // Message complete
        }
      }

      // Get the final message
      const finalMessage = await stream.finalMessage();

      // Check if we need to handle tool calls
      if (finalMessage.stop_reason === 'tool_use') {
        // Build assistant message with all content
        conversationMessages.push({
          role: 'assistant',
          content: finalMessage.content
        });

        // Execute tools and collect results
        const toolResults = [];
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            sendEvent('tool_executing', { id: block.id, name: block.name, input: block.input });
            
            try {
              const result = await executeTool(block.name, block.input);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
              sendEvent('tool_result', { id: block.id, name: block.name, result });
            } catch (error) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
              sendEvent('tool_error', { id: block.id, name: block.name, error: error.message });
            }
          }
        }

        // Add tool results to conversation
        conversationMessages.push({
          role: 'user',
          content: toolResults
        });
      } else {
        // No more tool calls, we're done
        continueLoop = false;
      }
    }

    sendEvent('done', {});
    res.end();

  } catch (error) {
    logger.error({ error: error.message }, 'Admin chat stream error');
    sendEvent('error', { message: error.message });
    res.end();
  }
});

module.exports = router;
