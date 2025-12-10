const express = require('express');
const router = express.Router();
const { Resource, Pillar } = require('../models');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

const VALID_TYPES = ['book', 'article', 'podcast', 'video', 'course', 'framework', 'person', 'other'];
const VALID_STATUSES = ['saved', 'in_progress', 'completed', 'revisiting', 'archived'];

// Get all resources for user
router.get('/', async (req, res) => {
  try {
    const filters = {
      pillarId: req.query.pillarId,
      type: req.query.type,
      status: req.query.status
    };
    const resources = await Resource.findByUserId(req.user.uid, filters);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned resources (not linked to any pillar)
router.get('/unassigned', async (req, res) => {
  try {
    const resources = await Resource.findUnassigned(req.user.uid);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get resources by type
router.get('/type/:type', async (req, res) => {
  try {
    if (!VALID_TYPES.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid resource type', validTypes: VALID_TYPES });
    }
    
    const resources = await Resource.findByType(req.user.uid, req.params.type);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get resources by status
router.get('/status/:status', async (req, res) => {
  try {
    if (!VALID_STATUSES.includes(req.params.status)) {
      return res.status(400).json({ error: 'Invalid resource status', validStatuses: VALID_STATUSES });
    }
    
    const resources = await Resource.findByStatus(req.user.uid, req.params.status);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single resource
router.get('/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create resource
router.post('/', async (req, res) => {
  try {
    // Validate pillar ownership if pillarId provided
    if (req.body.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    // Validate type
    if (req.body.type && !VALID_TYPES.includes(req.body.type)) {
      return res.status(400).json({ error: 'Invalid resource type', validTypes: VALID_TYPES });
    }
    
    // Validate status
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid resource status', validStatuses: VALID_STATUSES });
    }
    
    const resource = await Resource.create({
      ...req.body,
      userId: req.user.uid
    });
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update resource
router.put('/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Validate new pillar ownership if changing pillarId
    if (req.body.pillarId && req.body.pillarId !== resource.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    // Validate type if changing
    if (req.body.type && !VALID_TYPES.includes(req.body.type)) {
      return res.status(400).json({ error: 'Invalid resource type', validTypes: VALID_TYPES });
    }
    
    // Validate status if changing
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid resource status', validStatuses: VALID_STATUSES });
    }
    
    Object.assign(resource, req.body);
    await resource.save();
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign resource to pillar
router.post('/:id/assign/:pillarId', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    const pillar = await Pillar.findById(req.params.pillarId);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(400).json({ error: 'Invalid pillar' });
    }
    
    await resource.assignToPillar(req.params.pillarId);
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unassign resource from pillar
router.post('/:id/unassign', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    await resource.unassignFromPillar();
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update resource status
router.post('/:id/status/:status', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    if (!VALID_STATUSES.includes(req.params.status)) {
      return res.status(400).json({ error: 'Invalid resource status', validStatuses: VALID_STATUSES });
    }
    
    await resource.updateStatus(req.params.status);
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rate resource
router.post('/:id/rate', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    const rating = parseInt(req.body.rating, 10);
    if (isNaN(rating) || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5' });
    }
    
    await resource.rate(rating);
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add takeaway to resource
router.post('/:id/takeaways', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    if (!req.body.takeaway || typeof req.body.takeaway !== 'string') {
      return res.status(400).json({ error: 'Takeaway text is required' });
    }
    
    await resource.addTakeaway(req.body.takeaway);
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete resource
router.delete('/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    await resource.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

