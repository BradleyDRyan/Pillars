const express = require('express');

const {
  buildSchemasResponse,
  buildTodoSchema,
  buildHabitSchema,
  buildDaySchema,
  buildPlanSchema,
  buildPointEventSchema,
  buildPillarIconListResponse,
  toCanonicalBlockType,
  buildPillarIconSchema,
  router: legacyRouter
} = require('../schemasLegacy');

const { db } = require('../../config/firebase');
const { listBlockTypesForUser } = require('../../services/blockTypes');
const { VALID_EVENT_TYPES } = require('../../services/events');
const { flexibleAuth } = require('../../middleware/serviceAuth');

const schemasRouter = express.Router();
schemasRouter.use(flexibleAuth);

async function buildBlockTypes(userId) {
  const blockTypes = await listBlockTypesForUser({
    db,
    userId,
    ensureBuiltins: true
  });
  return blockTypes.map(toCanonicalBlockType);
}

schemasRouter.get('/', async (req, res) => {
  try {
    const payload = await buildSchemasResponse(req.user.uid);
    return res.json(payload);
  } catch (error) {
    console.error('[schemas] GET / error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

schemasRouter.get('/todos', async (req, res) => {
  return res.json({ todoSchema: buildTodoSchema() });
});

schemasRouter.get('/todo', async (req, res) => {
  return res.json({ todoSchema: buildTodoSchema() });
});

schemasRouter.get('/habits', async (req, res) => {
  return res.json({ habitSchema: buildHabitSchema() });
});

schemasRouter.get('/habit', async (req, res) => {
  return res.json({ habitSchema: buildHabitSchema() });
});

schemasRouter.get('/day', async (req, res) => {
  return res.json({ daySchema: buildDaySchema() });
});

schemasRouter.get('/plan', async (req, res) => {
  return res.json({ planSchema: buildPlanSchema() });
});

schemasRouter.get('/point-events', async (req, res) => {
  return res.json({ pointEventSchema: buildPointEventSchema() });
});

schemasRouter.get('/block-types', async (req, res) => {
  try {
    const blockTypes = await buildBlockTypes(req.user.uid);
    return res.json({
      blockTypes,
      endpoint: '/api/schemas/block-types'
    });
  } catch (error) {
    console.error('[schemas] GET /block-types error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

schemasRouter.get('/event-types', async (req, res) => {
  return res.json({
    values: [...VALID_EVENT_TYPES].sort(),
    endpoint: '/api/schemas/event-types'
  });
});

schemasRouter.get('/pillars', async (req, res) => {
  try {
    const pillarIcons = buildPillarIconListResponse();
    return res.json({
      ...pillarIcons,
      endpoint: '/api/schemas/pillars'
    });
  } catch (error) {
    console.error('[schemas] GET /pillars error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

schemasRouter.get('/pillar-icons', async (req, res) => {
  try {
    const pillarIcons = buildPillarIconListResponse();
    return res.json(pillarIcons);
  } catch (error) {
    console.error('[schemas] GET /pillar-icons error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

schemasRouter.use('/', legacyRouter);

module.exports = schemasRouter;
