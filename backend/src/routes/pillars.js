const express = require('express');
const router = express.Router();
const { Pillar, Conversation, Principle } = require('../models');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveEventSource, writeUserEventSafe } = require('../services/events');
const { normalizeTemplateType, getPillarTemplateByType } = require('../services/pillarTemplates');
const { normalizeColorToken } = require('../services/pillarVisuals');
const {
  getRubricItems,
  findRubricItemById,
  normalizeRubricItems,
  normalizeRubricItemCreate,
  normalizeRubricItemUpdate
} = require('../utils/rubrics');
const { normalizeContextMarkdownPayload } = require('../utils/userFactsMarkdown');

router.use(flexibleAuth);

function buildPillarChangePaths(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return Object.keys(payload)
    .filter(key => key !== 'source')
    .map(key => `pillar.${key}`);
}

async function loadUserPillar(pillarId, userId) {
  const pillar = await Pillar.findById(pillarId);
  if (!pillar || pillar.userId !== userId) {
    return null;
  }
  return pillar;
}

async function ensurePillarRubricItems(pillar) {
  return getRubricItems(pillar);
}

function normalizeRubricItemId(rawRubricItemId) {
  if (typeof rawRubricItemId !== 'string') {
    return null;
  }
  const trimmed = rawRubricItemId.trim();
  return trimmed || null;
}

function normalizeColorTokenPayload(payload) {
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'color')
    || Object.prototype.hasOwnProperty.call(payload || {}, 'customColorHex')) {
    return {
      error: 'Only colorToken is supported. color and customColorHex are not supported.'
    };
  }

  if (!Object.prototype.hasOwnProperty.call(payload || {}, 'colorToken')) {
    return { value: undefined };
  }

  const rawValue = payload?.colorToken;
  if (rawValue === null) {
    return { value: null };
  }
  if (typeof rawValue !== 'string') {
    return { error: 'colorToken must be a string' };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: null };
  }

  const normalized = normalizeColorToken(trimmed);
  if (!normalized) {
    return { error: 'colorToken must be a valid token id' };
  }

  return { value: normalized };
}

function normalizePillarContextPayload(payload) {
  const normalized = normalizeContextMarkdownPayload({
    contextMarkdown: payload?.contextMarkdown,
    context: payload?.context,
    factsMarkdown: payload?.factsMarkdown,
    facts: payload?.facts
  });

  if (normalized.error) {
    return { error: normalized.error };
  }

  if (!normalized.provided) {
    return { value: undefined };
  }

  return { value: normalized.markdown ?? null };
}

// Get all pillars for user
router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const pillars = await Pillar.findByUserId(req.user.uid, includeArchived);
    res.json(pillars);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get default pillar (or create if doesn't exist)
router.get('/default', async (req, res) => {
  try {
    let defaultPillar = await Pillar.findDefaultPillar(req.user.uid);
    if (!defaultPillar) {
      defaultPillar = await Pillar.createDefaultPillar(req.user.uid);
    }
    res.json(defaultPillar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single pillar
router.get('/:id', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    res.json(pillar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pillar stats
router.get('/:id/stats', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const stats = await pillar.updateStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversations for pillar
router.get('/:id/conversations', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const conversations = await Conversation.findByUserId(req.user.uid, req.params.id);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tasks for pillar
router.get('/:id/tasks', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const filters = {
      pillarId: req.params.id,
      status: req.query.status,
      priority: req.query.priority
    };
    
    const tasks = await UserTask.findByUserId(req.user.uid, filters);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get principles for pillar
router.get('/:id/principles', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const principles = await Principle.findByPillarId(req.params.id);
    res.json(principles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get wisdoms for pillar
router.get('/:id/wisdoms', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const wisdoms = await Wisdom.findByPillarId(req.params.id);
    res.json(wisdoms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get resources for pillar
router.get('/:id/resources', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    const resources = await Resource.findByPillarId(req.params.id);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create pillar
router.post('/', async (req, res) => {
  try {
    req.body = req.body && typeof req.body === 'object' ? req.body : {};
    const contextPayloadResult = normalizePillarContextPayload(req.body || {});
    if (contextPayloadResult.error) {
      return res.status(400).json({ error: contextPayloadResult.error });
    }
    if (contextPayloadResult.value !== undefined) {
      req.body.contextMarkdown = contextPayloadResult.value;
    }
    delete req.body.context;
    delete req.body.facts;
    delete req.body.factsMarkdown;

    if (req.body.isDefault) {
      const existingDefault = await Pillar.findDefaultPillar(req.user.uid);
      if (existingDefault) {
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
    }

    const hasRubricItems = Object.prototype.hasOwnProperty.call(req.body || {}, 'rubricItems');
    const normalizedPillarTypeResult = normalizeTemplateType(req.body?.pillarType, { required: false });
    if (normalizedPillarTypeResult.error) {
      return res.status(400).json({ error: normalizedPillarTypeResult.error });
    }
    const normalizedPillarType = normalizedPillarTypeResult.value;

    let resolvedRubricItems;
    let resolvedMetadata = req.body?.metadata && typeof req.body.metadata === 'object'
      ? { ...req.body.metadata }
      : {};

    if (hasRubricItems) {
      const rubricItemsResult = normalizeRubricItems(req.body?.rubricItems, {
        fallbackItems: []
      });
      if (rubricItemsResult.error) {
        return res.status(400).json({ error: rubricItemsResult.error });
      }
      resolvedRubricItems = rubricItemsResult.value;
    } else {
      if (!normalizedPillarType) {
        return res.status(400).json({
          error: 'pillarType is required when rubricItems is omitted'
        });
      }

      if (normalizedPillarType === 'custom') {
        resolvedRubricItems = [];
      } else {
        const template = await getPillarTemplateByType(normalizedPillarType, {
          includeInactive: true
        });
        if (!template || !template.isActive) {
          return res.status(409).json({
            error: 'Pillar template not found or inactive. Activate it before creating pillars from this type.'
          });
        }

        resolvedRubricItems = (template.rubricItems || []).map(item => ({ ...item }));
        resolvedMetadata = {
          ...resolvedMetadata,
          templateSource: {
            pillarType: template.pillarType,
            templateUpdatedAt: template.updatedAt
          }
        };
      }
    }

    const rubricItemsResult = normalizeRubricItems(resolvedRubricItems, {
      fallbackItems: []
    });
    if (rubricItemsResult.error) {
      return res.status(400).json({ error: rubricItemsResult.error });
    }

    const colorPayloadResult = normalizeColorTokenPayload(req.body || {});
    if (colorPayloadResult.error) {
      return res.status(400).json({ error: colorPayloadResult.error });
    }

    const pillar = await Pillar.create({
      ...req.body,
      userId: req.user.uid,
      pillarType: normalizedPillarType || null,
      colorToken: colorPayloadResult.value === undefined ? null : colorPayloadResult.value,
      customColorHex: null,
      metadata: resolvedMetadata,
      rubricItems: rubricItemsResult.value
    });
    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.created',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000)
    });
    res.status(201).json(pillar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update pillar
router.put('/:id', async (req, res) => {
  try {
    const pillar = await loadUserPillar(req.params.id, req.user.uid);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }

    req.body = req.body && typeof req.body === 'object' ? req.body : {};
    const contextPayloadResult = normalizePillarContextPayload(req.body || {});
    if (contextPayloadResult.error) {
      return res.status(400).json({ error: contextPayloadResult.error });
    }
    if (contextPayloadResult.value !== undefined) {
      req.body.contextMarkdown = contextPayloadResult.value;
    }
    delete req.body.context;
    delete req.body.facts;
    delete req.body.factsMarkdown;
    
    if (req.body.isDefault && !pillar.isDefault) {
      const existingDefault = await Pillar.findDefaultPillar(req.user.uid);
      if (existingDefault && existingDefault.id !== pillar.id) {
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
    }
    
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'rubricItems')) {
      const rubricItemsResult = normalizeRubricItems(req.body?.rubricItems, {
        fallbackItems: getRubricItems(pillar)
      });
      if (rubricItemsResult.error) {
        return res.status(400).json({ error: rubricItemsResult.error });
      }
      req.body.rubricItems = rubricItemsResult.value;
    }

    const colorPayloadResult = normalizeColorTokenPayload(req.body || {});
    if (colorPayloadResult.error) {
      return res.status(400).json({ error: colorPayloadResult.error });
    }
    if (colorPayloadResult.value !== undefined) {
      req.body.colorToken = colorPayloadResult.value;
      req.body.customColorHex = null;
    }

    Object.assign(pillar, req.body);
    await pillar.save();
    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000),
      changes: buildPillarChangePaths(req.body)
    });
    res.json(pillar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get rubric for a pillar
router.get('/:id/rubric', async (req, res) => {
  try {
    const pillar = await loadUserPillar(req.params.id, req.user.uid);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }

    return res.json({
      pillarId: pillar.id,
      rubricItems: await ensurePillarRubricItems(pillar)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Add rubric item
router.post('/:id/rubric', async (req, res) => {
  try {
    const pillar = await loadUserPillar(req.params.id, req.user.uid);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }

    const itemResult = normalizeRubricItemCreate(req.body || {});
    if (itemResult.error) {
      return res.status(400).json({ error: itemResult.error });
    }

    const nextItems = [...await ensurePillarRubricItems(pillar)];
    if (nextItems.some(item => item && item.id === itemResult.value.id)) {
      return res.status(400).json({ error: 'rubric item id already exists for this pillar' });
    }

    nextItems.push(itemResult.value);
    pillar.rubricItems = nextItems;
    await pillar.save();

    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000),
      changes: ['pillar.rubricItems']
    });

    return res.status(201).json(itemResult.value);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Update rubric item
router.put('/:id/rubric/:rubricItemId', async (req, res) => {
  try {
    const pillar = await loadUserPillar(req.params.id, req.user.uid);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }

    const rubricItemId = normalizeRubricItemId(req.params.rubricItemId);
    if (!rubricItemId) {
      return res.status(400).json({ error: 'rubricItemId is required' });
    }

    const currentItems = await ensurePillarRubricItems(pillar);
    const existingItem = findRubricItemById(currentItems, rubricItemId);
    if (!existingItem) {
      return res.status(404).json({ error: 'Rubric item not found' });
    }

    const updatedItemResult = normalizeRubricItemUpdate(req.body || {}, existingItem);
    if (updatedItemResult.error) {
      return res.status(400).json({ error: updatedItemResult.error });
    }

    pillar.rubricItems = currentItems.map(item => {
      if (!item || item.id !== rubricItemId) {
        return item;
      }
      return updatedItemResult.value;
    });
    await pillar.save();

    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000),
      changes: ['pillar.rubricItems']
    });

    return res.json(updatedItemResult.value);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Remove rubric item
router.delete('/:id/rubric/:rubricItemId', async (req, res) => {
  try {
    const pillar = await loadUserPillar(req.params.id, req.user.uid);
    if (!pillar) {
      return res.status(404).json({ error: 'Pillar not found' });
    }

    const rubricItemId = normalizeRubricItemId(req.params.rubricItemId);
    if (!rubricItemId) {
      return res.status(400).json({ error: 'rubricItemId is required' });
    }

    const currentItems = await ensurePillarRubricItems(pillar);
    const nextItems = currentItems.filter(item => item && item.id !== rubricItemId);
    if (nextItems.length === currentItems.length) {
      return res.status(404).json({ error: 'Rubric item not found' });
    }

    pillar.rubricItems = nextItems;
    await pillar.save();

    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000),
      changes: ['pillar.rubricItems']
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Archive pillar
router.post('/:id/archive', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    if (pillar.isDefault) {
      return res.status(400).json({ error: 'Cannot archive default pillar' });
    }
    
    await pillar.archive();
    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000),
      changes: ['pillar.isArchived']
    });
    res.json(pillar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unarchive pillar
router.post('/:id/unarchive', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    await pillar.unarchive();
    await writeUserEventSafe({
      userId: req.user.uid,
      type: 'pillar.updated',
      source: resolveEventSource({
        explicitSource: req.body?.source,
        authSource: req.user?.source
      }),
      pillarId: pillar.id,
      name: pillar.name,
      timestamp: Math.floor(Date.now() / 1000),
      changes: ['pillar.isArchived']
    });
    res.json(pillar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete pillar
router.delete('/:id', async (req, res) => {
  try {
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    if (pillar.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default pillar' });
    }
    
    await pillar.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
