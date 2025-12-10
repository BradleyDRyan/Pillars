const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { logger } = require('../config/firebase');
const { Agent, Conversation, Message, Trigger } = require('../models');
const { generateInstructions } = require('../services/instructionGenerator');
const { runAgent, runAgentStream } = require('../services/agentRunner');
const { setSSEHeaders, emitEndOfStream } = require('../services/sseManager');
const { definitions: toolDefinitions } = require('../llm/tools');

const TOOL_CATALOG = toolDefinitions.map((tool) => ({
  name: tool.name,
  label: tool.name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()),
  description: tool.description || ''
}));
const TOOL_NAME_SET = new Set(TOOL_CATALOG.map((tool) => tool.name));

const normalizeAllowedTools = (rawTools, fallbackWebSearch = false) => {
  const result = Array.isArray(rawTools)
    ? rawTools
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter((name) => name && TOOL_NAME_SET.has(name))
    : [];

  if (fallbackWebSearch) {
    if (!result.includes('web_search')) {
      result.push('web_search');
    }
  }

  return Array.from(new Set(result));
};

const mergeWebSearchToggle = (tools = [], enableWebSearch) => {
  const set = new Set(tools.filter((name) => TOOL_NAME_SET.has(name)));
  if (enableWebSearch) {
    set.add('web_search');
  } else {
    set.delete('web_search');
  }
  return Array.from(set);
};

// Middleware to get userId from request (assuming it's set by auth middleware)
const getUserId = (req) => {
  return req.user?.uid || req.body?.userId || 'admin-user'; // Fallback for admin
};

/**
 * GET /api/agents
 * List all agents for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const agents = await Agent.findAll(userId);
    
    logger.info({ userId, count: agents.length }, '[agents] Loaded agents');
    
    // Safely convert agents to JSON, catching any serialization errors
    const agentsJson = agents.map(agent => {
      try {
        return agent.toJSON();
      } catch (err) {
        logger.error({ err, agentId: agent.id }, '[agents] Failed to serialize agent');
        // Return a safe fallback
        return {
          id: agent.id,
          name: agent.name || 'Unknown',
          description: agent.description || '',
          instructions: agent.instructions || '',
          conversationId: agent.conversationId || null,
          enableWebSearch: agent.enableWebSearch || false,
          allowedTools: agent.allowedTools || [],
          createdAt: null,
          updatedAt: null
        };
      }
    });
    
    res.json({
      agents: agentsJson
    });
  } catch (error) {
    logger.error({ err: error }, '[agents] Failed to load agents');
    // Ensure we always send valid JSON, even on error
    res.status(500).json({ 
      error: 'Failed to load agents',
      message: error.message || 'Unknown error'
    });
  }
});

router.get('/tools', (req, res) => {
  res.json({
    tools: TOOL_CATALOG
  });
});

/**
 * POST /api/agents
 * Create a new agent with auto-generated instructions
 * Body: { name, description, schedule (optional), model (optional), enableWebSearch (optional) }
 */
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, description, schedule, model, enableWebSearch, allowedTools: rawAllowedTools } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    logger.info({ userId, name, descriptionLength: description.length }, '[agents] Creating agent');

    // Generate instructions from description
    let instructions;
    try {
      instructions = await generateInstructions(description);
    } catch (error) {
      logger.error({ err: error }, '[agents] Failed to generate instructions, using fallback');
      instructions = `Your task is to: ${description.trim()}\n\nSearch for relevant information, analyze findings, and report back with clear, actionable results.`;
    }

    // Create conversation for the agent
    const conversation = await Conversation.create({
      userId,
      agentId: null, // Will be set after agent creation
      title: name.trim(),
      lastMessage: null
    });

    const allowedTools = normalizeAllowedTools(rawAllowedTools, Boolean(enableWebSearch));
    const enableWebSearchFlag = allowedTools.includes('web_search');

    // Create agent
    const agent = await Agent.create({
      userId,
      name: name.trim(),
      description: description.trim(),
      instructions,
      model: model || null,
      enableWebSearch: enableWebSearchFlag,
      allowedTools,
      conversationId: conversation.id,
      metadata: {
        createdBy: 'api'
      }
    });

    // Update conversation with agentId
    conversation.agentId = agent.id;
    await conversation.save();

    // Create initial message from user (the description)
    await Message.create({
      conversationId: conversation.id,
      userId,
      sender: userId, // User sent this message
      content: description.trim(),
      type: 'text',
      role: 'user',
      metadata: {
        isInitialMessage: true
      }
    });

    // Create default trigger if schedule is provided, otherwise create default daily trigger
    const triggerSchedule = schedule || 'daily:10:00';
    const trigger = await Trigger.create({
      agentId: agent.id,
      type: 'time_based',
      schedule: triggerSchedule,
      enabled: true,
      metadata: {
        createdBy: 'api',
        isDefault: !schedule
      }
    });

    logger.info(
      { agentId: agent.id, conversationId: conversation.id, triggerId: trigger.id },
      '[agents] Agent created successfully'
    );

    res.status(201).json({
      agent: agent.toJSON(),
      conversation: conversation.toJSON(),
      trigger: trigger.toJSON()
    });
  } catch (error) {
    logger.error({ err: error }, '[agents] Failed to create agent');
    res.status(500).json({ error: error.message || 'Failed to create agent' });
  }
});

/**
 * GET /api/agents/:id
 * Get agent details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findById(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent: agent.toJSON() });
  } catch (error) {
    logger.error({ err: error }, '[agents] Failed to load agent');
    res.status(500).json({ error: 'Failed to load agent' });
  }
});

/**
 * PUT /api/agents/:id
 * Update agent (name, instructions, model, enableWebSearch)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, instructions, model, enableWebSearch, allowedTools: rawAllowedTools } = req.body;

    const existingAgent = await Agent.findById(id);
    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (instructions !== undefined) updates.instructions = instructions.trim();
    if (model !== undefined) updates.model = model ? String(model).trim() : null;
    if (rawAllowedTools !== undefined) {
      const normalizedTools = normalizeAllowedTools(rawAllowedTools, Boolean(enableWebSearch));
      updates.allowedTools = normalizedTools;
      updates.enableWebSearch = normalizedTools.includes('web_search');
    } else if (enableWebSearch !== undefined) {
      updates.enableWebSearch = Boolean(enableWebSearch);
      updates.allowedTools = mergeWebSearchToggle(existingAgent.allowedTools || [], updates.enableWebSearch);
    }

    const updatedAgent = await Agent.update(id, updates);

    // Update conversation title if name changed
    if (name && existingAgent.conversationId) {
      const conversation = await Conversation.findById(existingAgent.conversationId);
      if (conversation) {
        conversation.title = name.trim();
        await conversation.save();
      }
    }

    logger.info({ agentId: id, updates }, '[agents] Updated agent');
    res.json({ agent: updatedAgent.toJSON() });
  } catch (error) {
    logger.error({ err: error }, '[agents] Failed to update agent');
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/agents/:id
 * Delete agent and related data (conversation, messages, triggers)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Delete all triggers for this agent
    const triggers = await Trigger.findByAgentId(id);
    const deleteTriggerPromises = triggers.map(trigger =>
      Trigger.collection().doc(trigger.id).delete()
    );
    await Promise.all(deleteTriggerPromises);

    // Delete conversation and messages if exists
    if (agent.conversationId) {
      const conversation = await Conversation.findById(agent.conversationId);
      if (conversation) {
        // Delete all messages in the conversation
        const messages = await Message.findByConversationId(agent.conversationId, 1000);
        const deleteMessagePromises = messages.map(message =>
          Message.collection(agent.conversationId).doc(message.id).delete()
        );
        await Promise.all(deleteMessagePromises);

        // Delete conversation
        await conversation.delete();
      }
    }

    // Delete agent
    await Agent.delete(id);

    logger.info(
      {
        agentId: id,
        triggersDeleted: triggers.length,
        messagesDeleted: agent.conversationId ? 'all' : 0
      },
      '[agents] Deleted agent and related data'
    );

    res.json({
      success: true,
      deletedTriggers: triggers.length
    });
  } catch (error) {
    logger.error({ err: error }, '[agents] Failed to delete agent');
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

/**
 * POST /api/agents/:id/run
 * Manually run an agent (with optional streaming)
 */
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const { model, temperature, maxTokens, stream } = req.body || {};

    // If streaming is requested, use SSE
    if (stream) {
      // Set up Server-Sent Events headers
      setSSEHeaders(res);

      try {
        const result = await runAgentStream(id, {
          res, // Pass res to stream coordinator for SSE events
          model,
          temperature,
          maxTokens,
          onStart: ({ messageId, agent, conversation }) => {
            // Send initial message info (stream coordinator will handle tool events)
            res.write(`data: ${JSON.stringify({ 
              type: 'start', 
              messageId: messageId,
              agent: agent.toJSON(),
              conversation: conversation.toJSON()
            })}\n\n`);
          },
          onChunk: (chunk) => {
            // Text chunks are handled by stream coordinator via SSE
            // This is kept for backward compatibility
          },
          onComplete: async (fullContent) => {
            // Update trigger lastRunAt if trigger exists
            const triggers = await Trigger.findByAgentId(id);
            if (triggers.length > 0) {
              const now = new Date();
              await Trigger.update(triggers[0].id, { lastRunAt: now });
            }

            // Stream coordinator already sent 'complete' event, just end the stream
            emitEndOfStream(res);
          }
        });

      } catch (error) {
        logger.error({ err: error, agentId: id }, '[agents] Streaming agent run failed');
        const { emitError } = require('../services/sseManager');
        emitError(res, error, { agentId: id });
        emitEndOfStream(res);
      }
    } else {
      // Non-streaming mode (backward compatibility)
      const result = await runAgent(id, { model, temperature, maxTokens });

      // Update trigger lastRunAt if trigger exists
      const triggers = await Trigger.findByAgentId(id);
      if (triggers.length > 0) {
        const now = new Date();
        await Trigger.update(triggers[0].id, { lastRunAt: now });
      }

      res.json({
        success: true,
        agent: result.agent.toJSON(),
        conversation: result.conversation.toJSON(),
        message: result.message.toJSON()
      });
    }
  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, '[agents] Agent run failed');
    res.status(500).json({
      error: error.message || 'Failed to run agent'
    });
  }
});

/**
 * POST /api/agents/:id/messages
 * Create a user message in the agent's conversation without requiring auth (admin fallback)
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', role = 'user', attachments = [], metadata = {} } = req.body || {};

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!agent.conversationId) {
      return res.status(400).json({ error: 'Agent conversation not initialized' });
    }

    const conversation = await Conversation.findById(agent.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const userId = getUserId(req);
    const trimmedContent = content.trim();

    const message = await Message.create({
      conversationId: conversation.id,
      userId,
      sender: userId,
      content: trimmedContent,
      type,
      role,
      attachments,
      metadata
    });

    conversation.lastMessage = trimmedContent;
    conversation.updatedAt = admin.firestore.Timestamp.now();
    await conversation.save();

    res.status(201).json(message.toJSON());
  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, '[agents] Failed to create message');
    res.status(500).json({ error: error.message || 'Failed to create message' });
  }
});

/**
 * GET /api/agents/:id/conversation
 * Get agent's conversation and messages
 */
router.get('/:id/conversation', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findById(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!agent.conversationId) {
      return res.json({
        conversation: null,
        messages: []
      });
    }

    const conversation = await Conversation.findById(agent.conversationId);
    if (!conversation) {
      return res.json({
        conversation: null,
        messages: []
      });
    }

    let messages;
    try {
      messages = await Message.findByConversationId(agent.conversationId, 100);
    } catch (err) {
      logger.error({ err, conversationId: agent.conversationId }, '[agents] Failed to fetch messages');
      // Return empty messages array if fetch fails
      messages = [];
    }

    // Safely convert conversation to JSON
    let conversationJson;
    try {
      conversationJson = conversation.toJSON();
    } catch (err) {
      logger.error({ err, conversationId: conversation.id }, '[agents] Failed to serialize conversation');
      conversationJson = {
        id: conversation.id,
        userId: conversation.userId,
        agentId: conversation.agentId || null,
        title: conversation.title || 'Untitled',
        lastMessage: null,
        createdAt: null,
        updatedAt: null
      };
    }

    // Safely convert messages to JSON, catching any serialization errors
    const messagesJson = messages.map(msg => {
      try {
        return msg.toJSON();
      } catch (err) {
        logger.error({ err, messageId: msg.id }, '[agents] Failed to serialize message');
        // Return a safe fallback
        return {
          id: msg.id,
          conversationId: msg.conversationId,
          userId: msg.userId,
          sender: msg.sender || msg.userId || null,
          content: msg.content || '',
          type: msg.type || 'text',
          role: msg.role || 'user',
          createdAt: null,
          editedAt: null
        };
      }
    });

    res.json({
      conversation: conversationJson,
      messages: messagesJson
    });
  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, '[agents] Failed to load conversation');
    // Ensure we always send valid JSON, even on error
    res.status(500).json({ 
      error: 'Failed to load conversation',
      message: error.message || 'Unknown error'
    });
  }
});

module.exports = router;

