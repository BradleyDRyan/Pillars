const express = require('express');
const router = express.Router();
const { logger } = require('../config/firebase');
const { Trigger } = require('../models');

// DEPRECATED: This admin route file is deprecated in favor of the new agent system.
// Old routes for Person, Monitor, MonitorAssignment, and Signal have been removed.
// Use /api/agents and /api/triggers instead.

// Keep trigger routes for backward compatibility, but they now use agentId
router.get('/triggers', async (req, res) => {
  try {
    const triggers = await Trigger.findAll();
    
    // Note: Enrichment with agent data should be done via /api/triggers instead
    logger.info({ count: triggers.length }, '[admin] Loaded triggers (deprecated route)');
    res.json({ 
      triggers: triggers.map(t => t.toJSON()),
      deprecated: true,
      message: 'This route is deprecated. Use /api/triggers instead.'
    });
  } catch (error) {
    logger.error({ err: error }, '[admin] Failed to load triggers');
    res.status(500).json({ error: 'Failed to load triggers' });
  }
});

router.post('/triggers', async (req, res) => {
  res.status(410).json({ 
    error: 'This route is deprecated. Use POST /api/triggers instead.',
    deprecated: true
  });
});

router.put('/triggers/:id', async (req, res) => {
  res.status(410).json({ 
    error: 'This route is deprecated. Use PUT /api/triggers/:id instead.',
    deprecated: true
  });
});

router.delete('/triggers/:id', async (req, res) => {
  res.status(410).json({ 
    error: 'This route is deprecated. Use DELETE /api/triggers/:id instead.',
    deprecated: true
  });
});

// All other routes return 410 Gone
router.use('*', (req, res) => {
  res.status(410).json({
    error: 'This route has been deprecated and removed.',
    message: 'The admin routes for Person, Monitor, MonitorAssignment, and Signal have been removed.',
    newRoutes: {
      agents: '/api/agents',
      triggers: '/api/triggers'
    },
    deprecated: true
  });
});

module.exports = router;
