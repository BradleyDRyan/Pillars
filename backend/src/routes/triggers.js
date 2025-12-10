const express = require('express');
const router = express.Router();
const { logger } = require('../config/firebase');
const { Trigger, Agent } = require('../models');

/**
 * GET /api/triggers
 * List all triggers (enriched with agent data)
 */
router.get('/', async (req, res) => {
  try {
    const triggers = await Trigger.findAll();

    // Enrich with agent data
    const agentIds = [...new Set(triggers.map(t => t.agentId).filter(Boolean))];
    const agents = await Agent.findByIds(agentIds);
    const agentMap = new Map(agents.map(a => [a.id, a]));

    const enrichedTriggers = triggers.map(trigger => ({
      ...trigger.toJSON(),
      agent: agentMap.get(trigger.agentId)?.toJSON() || null
    }));

    logger.info({ count: triggers.length }, '[triggers] Loaded triggers');
    res.json({ triggers: enrichedTriggers });
  } catch (error) {
    logger.error({ err: error }, '[triggers] Failed to load triggers');
    res.status(500).json({ error: 'Failed to load triggers' });
  }
});

/**
 * POST /api/triggers
 * Create a new trigger for an agent
 * Body: { agentId, schedule, enabled (optional) }
 */
router.post('/', async (req, res) => {
  try {
    const { agentId, schedule, enabled } = req.body;

    if (!agentId || !schedule) {
      return res.status(400).json({ error: 'agentId and schedule are required' });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const trigger = await Trigger.create({
      agentId,
      type: 'time_based',
      schedule: schedule.trim(),
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      metadata: {
        createdBy: 'api'
      }
    });

    logger.info({ triggerId: trigger.id, agentId }, '[triggers] Trigger created');
    res.status(201).json({ trigger: trigger.toJSON() });
  } catch (error) {
    logger.error({ err: error }, '[triggers] Failed to create trigger');
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

/**
 * GET /api/triggers/:id
 * Get trigger details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const trigger = await Trigger.findById(id);

    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    // Enrich with agent data
    let agent = null;
    if (trigger.agentId) {
      agent = await Agent.findById(trigger.agentId);
    }

    res.json({
      trigger: trigger.toJSON(),
      agent: agent ? agent.toJSON() : null
    });
  } catch (error) {
    logger.error({ err: error }, '[triggers] Failed to load trigger');
    res.status(500).json({ error: 'Failed to load trigger' });
  }
});

/**
 * PUT /api/triggers/:id
 * Update trigger schedule or enabled status
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule, enabled } = req.body;

    const existingTrigger = await Trigger.findById(id);
    if (!existingTrigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    const updates = {};
    if (schedule !== undefined) updates.schedule = schedule.trim();
    if (enabled !== undefined) updates.enabled = Boolean(enabled);

    const updatedTrigger = await Trigger.update(id, updates);

    logger.info({ triggerId: id, updates }, '[triggers] Updated trigger');
    res.json({ trigger: updatedTrigger.toJSON() });
  } catch (error) {
    logger.error({ err: error }, '[triggers] Failed to update trigger');
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

/**
 * DELETE /api/triggers/:id
 * Delete a trigger
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await Trigger.collection().doc(id).delete();

    logger.info({ triggerId: id }, '[triggers] Deleted trigger');
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, '[triggers] Failed to delete trigger');
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

module.exports = router;


