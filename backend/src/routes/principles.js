const express = require('express');
const router = express.Router();
const { Principle, Pillar } = require('../models');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Get all principles for user
router.get('/', async (req, res) => {
  try {
    const filters = {
      pillarId: req.query.pillarId,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
    };
    const principles = await Principle.findByUserId(req.user.uid, filters);
    res.json(principles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned principles (not linked to any pillar)
router.get('/unassigned', async (req, res) => {
  try {
    const principles = await Principle.findUnassigned(req.user.uid);
    res.json(principles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single principle
router.get('/:id', async (req, res) => {
  try {
    const principle = await Principle.findById(req.params.id);
    if (!principle || principle.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    res.json(principle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create principle
router.post('/', async (req, res) => {
  try {
    // Validate pillar ownership if pillarId provided
    if (req.body.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    const principle = await Principle.create({
      ...req.body,
      userId: req.user.uid
    });
    res.status(201).json(principle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update principle
router.put('/:id', async (req, res) => {
  try {
    const principle = await Principle.findById(req.params.id);
    if (!principle || principle.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    // Validate new pillar ownership if changing pillarId
    if (req.body.pillarId && req.body.pillarId !== principle.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    Object.assign(principle, req.body);
    await principle.save();
    res.json(principle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign principle to pillar
router.post('/:id/assign/:pillarId', async (req, res) => {
  try {
    const principle = await Principle.findById(req.params.id);
    if (!principle || principle.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    const pillar = await Pillar.findById(req.params.pillarId);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(400).json({ error: 'Invalid pillar' });
    }
    
    await principle.assignToPillar(req.params.pillarId);
    res.json(principle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unassign principle from pillar
router.post('/:id/unassign', async (req, res) => {
  try {
    const principle = await Principle.findById(req.params.id);
    if (!principle || principle.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    await principle.unassignFromPillar();
    res.json(principle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete principle
router.delete('/:id', async (req, res) => {
  try {
    const principle = await Principle.findById(req.params.id);
    if (!principle || principle.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    await principle.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

