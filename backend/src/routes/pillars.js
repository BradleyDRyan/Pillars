const express = require('express');
const router = express.Router();
const { Pillar, Conversation, Principle } = require('../models');
const { flexibleAuth } = require('../middleware/serviceAuth');
const { resolveEventSource, writeUserEventSafe } = require('../services/events');

router.use(flexibleAuth);

function buildPillarChangePaths(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return Object.keys(payload)
    .filter(key => key !== 'source')
    .map(key => `pillar.${key}`);
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
    if (req.body.isDefault) {
      const existingDefault = await Pillar.findDefaultPillar(req.user.uid);
      if (existingDefault) {
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
    }
    
    const pillar = await Pillar.create({
      ...req.body,
      userId: req.user.uid
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
    const pillar = await Pillar.findById(req.params.id);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Pillar not found' });
    }
    
    if (req.body.isDefault && !pillar.isDefault) {
      const existingDefault = await Pillar.findDefaultPillar(req.user.uid);
      if (existingDefault && existingDefault.id !== pillar.id) {
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
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
