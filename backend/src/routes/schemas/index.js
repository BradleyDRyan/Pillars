const express = require('express');

const {
  buildSchemasResponse,
  buildActionSchema,
  buildActionTemplateSchema,
  buildPlanSchema,
  buildPointEventSchema,
  buildUserSchema,
  buildPillarSchema,
  buildPillarIconListResponse,
  toCanonicalBlockType,
  router: contractRouter
} = require('../schemasContract');

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
  return res.status(410).json({ error: 'Todo schema removed. Use /api/schemas/actions.' });
});

schemasRouter.get('/todo', async (req, res) => {
  return res.status(410).json({ error: 'Todo schema removed. Use /api/schemas/actions.' });
});

schemasRouter.get('/habits', async (req, res) => {
  return res.status(410).json({ error: 'Habit schema removed. Use /api/schemas/action-templates.' });
});

schemasRouter.get('/habit', async (req, res) => {
  return res.status(410).json({ error: 'Habit schema removed. Use /api/schemas/action-templates.' });
});

schemasRouter.get('/day', async (req, res) => {
  return res.status(410).json({ error: 'Day block schema removed. Use /api/schemas/actions.' });
});

schemasRouter.get('/actions', async (req, res) => {
  return res.json({ actionSchema: buildActionSchema() });
});

schemasRouter.get('/action', async (req, res) => {
  return res.json({ actionSchema: buildActionSchema() });
});

schemasRouter.get('/action-templates', async (req, res) => {
  return res.json({ actionTemplateSchema: buildActionTemplateSchema() });
});

schemasRouter.get('/action-template', async (req, res) => {
  return res.json({ actionTemplateSchema: buildActionTemplateSchema() });
});

schemasRouter.get('/plan', async (req, res) => {
  return res.json({ planSchema: buildPlanSchema() });
});

schemasRouter.get('/point-events', async (req, res) => {
  return res.json({ pointEventSchema: buildPointEventSchema() });
});

schemasRouter.get('/users', async (req, res) => {
  return res.json({ userSchema: buildUserSchema() });
});

schemasRouter.get('/user', async (req, res) => {
  return res.json({ userSchema: buildUserSchema() });
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
    const pillarIcons = await buildPillarIconListResponse();
    const pillarSchema = await buildPillarSchema();
    return res.json({
      ...pillarIcons,
      pillarIcons,
      pillarVisuals: pillarSchema.visuals || null,
      pillarSchema,
      endpoint: '/api/schemas/pillars'
    });
  } catch (error) {
    console.error('[schemas] GET /pillars error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

schemasRouter.get('/pillar-icons', async (req, res) => {
  try {
    const pillarIcons = await buildPillarIconListResponse();
    return res.json(pillarIcons);
  } catch (error) {
    console.error('[schemas] GET /pillar-icons error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

schemasRouter.use('/', contractRouter);

module.exports = schemasRouter;
