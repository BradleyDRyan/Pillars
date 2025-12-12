/**
 * Agent Routes - CRUD API for managing agents
 * 
 * Agents can be created/configured via admin UI and invoked via @ mentions.
 */

const express = require('express');
const router = express.Router();
const { Agent } = require('../models');
const { getToolsForAdmin, getAvailableToolNames } = require('../services/toolRegistry');
const { logger } = require('../config/firebase');

/**
 * GET /api/agents
 * List all agents
 */
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const agents = await Agent.findAll(includeInactive);
    res.json({ agents: agents.map(a => a.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error listing agents');
    res.status(500).json({ 
      error: 'Failed to list agents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/agents/tools/available
 * List available tools that can be assigned to agents
 */
router.get('/tools/available', async (req, res) => {
  try {
    const tools = getToolsForAdmin();
    res.json({ tools });
  } catch (error) {
    logger.error({ error: error.message }, 'Error listing available tools');
    res.status(500).json({ error: 'Failed to list available tools' });
  }
});

/**
 * GET /api/agents/:id
 * Get a single agent by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent: agent.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting agent');
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * POST /api/agents
 * Create a new agent
 */
router.post('/', async (req, res) => {
  try {
    const { name, handle, description, systemPrompt, tools, model, speakMode, isActive } = req.body;
    
    if (!name || !handle) {
      return res.status(400).json({ error: 'Name and handle are required' });
    }
    
    // Validate tools exist
    const availableTools = getAvailableToolNames();
    const invalidTools = (tools || []).filter(t => !availableTools.includes(t));
    if (invalidTools.length > 0) {
      return res.status(400).json({ 
        error: `Invalid tools: ${invalidTools.join(', ')}`,
        availableTools 
      });
    }
    
    // Validate speakMode
    const validSpeakModes = ['when_mentioned', 'proactive'];
    if (speakMode && !validSpeakModes.includes(speakMode)) {
      return res.status(400).json({ 
        error: `Invalid speakMode. Must be one of: ${validSpeakModes.join(', ')}`
      });
    }
    
    const agent = await Agent.create({
      name,
      handle,
      description: description || '',
      systemPrompt: systemPrompt || '',
      tools: tools || [],
      model: model || 'claude-sonnet-4-20250514',
      speakMode: speakMode || 'when_mentioned',
      isActive: isActive !== false
    });
    
    res.status(201).json({ agent: agent.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Error creating agent');
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * PUT /api/agents/:id
 * Update an existing agent
 */
router.put('/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const { name, handle, description, systemPrompt, tools, model, speakMode, isActive } = req.body;
    
    // Validate tools exist if provided
    if (tools) {
      const availableTools = getAvailableToolNames();
      const invalidTools = tools.filter(t => !availableTools.includes(t));
      if (invalidTools.length > 0) {
        return res.status(400).json({ 
          error: `Invalid tools: ${invalidTools.join(', ')}`,
          availableTools 
        });
      }
    }
    
    // Validate speakMode if provided
    if (speakMode) {
      const validSpeakModes = ['when_mentioned', 'proactive'];
      if (!validSpeakModes.includes(speakMode)) {
        return res.status(400).json({ 
          error: `Invalid speakMode. Must be one of: ${validSpeakModes.join(', ')}`
        });
      }
    }
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (handle !== undefined) updates.handle = handle;
    if (description !== undefined) updates.description = description;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (tools !== undefined) updates.tools = tools;
    if (model !== undefined) updates.model = model;
    if (speakMode !== undefined) updates.speakMode = speakMode;
    if (isActive !== undefined) updates.isActive = isActive;
    
    await agent.update(updates);
    
    res.json({ agent: agent.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Error updating agent');
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
router.delete('/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    await agent.delete();
    res.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error deleting agent');
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

module.exports = router;

