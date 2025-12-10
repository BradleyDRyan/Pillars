const express = require('express');
const router = express.Router();
const { Wisdom, Pillar } = require('../models');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Get all wisdoms for user
router.get('/', async (req, res) => {
  try {
    const filters = {
      pillarId: req.query.pillarId,
      type: req.query.type,
      isInternalized: req.query.isInternalized === 'true' ? true : req.query.isInternalized === 'false' ? false : undefined
    };
    const wisdoms = await Wisdom.findByUserId(req.user.uid, filters);
    res.json(wisdoms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned wisdoms (not linked to any pillar)
router.get('/unassigned', async (req, res) => {
  try {
    const wisdoms = await Wisdom.findUnassigned(req.user.uid);
    res.json(wisdoms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get wisdoms by type
router.get('/type/:type', async (req, res) => {
  try {
    const validTypes = ['lesson', 'reflection', 'quote', 'experience', 'insight'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid wisdom type' });
    }
    
    const wisdoms = await Wisdom.findByType(req.user.uid, req.params.type);
    res.json(wisdoms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single wisdom
router.get('/:id', async (req, res) => {
  try {
    const wisdom = await Wisdom.findById(req.params.id);
    if (!wisdom || wisdom.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Wisdom not found' });
    }
    res.json(wisdom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create wisdom
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
    const validTypes = ['lesson', 'reflection', 'quote', 'experience', 'insight'];
    if (req.body.type && !validTypes.includes(req.body.type)) {
      return res.status(400).json({ error: 'Invalid wisdom type' });
    }
    
    const wisdom = await Wisdom.create({
      ...req.body,
      userId: req.user.uid
    });
    res.status(201).json(wisdom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update wisdom
router.put('/:id', async (req, res) => {
  try {
    const wisdom = await Wisdom.findById(req.params.id);
    if (!wisdom || wisdom.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Wisdom not found' });
    }
    
    // Validate new pillar ownership if changing pillarId
    if (req.body.pillarId && req.body.pillarId !== wisdom.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    // Validate type if changing
    const validTypes = ['lesson', 'reflection', 'quote', 'experience', 'insight'];
    if (req.body.type && !validTypes.includes(req.body.type)) {
      return res.status(400).json({ error: 'Invalid wisdom type' });
    }
    
    Object.assign(wisdom, req.body);
    await wisdom.save();
    res.json(wisdom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign wisdom to pillar
router.post('/:id/assign/:pillarId', async (req, res) => {
  try {
    const wisdom = await Wisdom.findById(req.params.id);
    if (!wisdom || wisdom.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Wisdom not found' });
    }
    
    const pillar = await Pillar.findById(req.params.pillarId);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(400).json({ error: 'Invalid pillar' });
    }
    
    await wisdom.assignToPillar(req.params.pillarId);
    res.json(wisdom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unassign wisdom from pillar
router.post('/:id/unassign', async (req, res) => {
  try {
    const wisdom = await Wisdom.findById(req.params.id);
    if (!wisdom || wisdom.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Wisdom not found' });
    }
    
    await wisdom.unassignFromPillar();
    res.json(wisdom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark wisdom as internalized
router.post('/:id/internalize', async (req, res) => {
  try {
    const wisdom = await Wisdom.findById(req.params.id);
    if (!wisdom || wisdom.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Wisdom not found' });
    }
    
    await wisdom.markAsInternalized();
    res.json(wisdom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete wisdom
router.delete('/:id', async (req, res) => {
  try {
    const wisdom = await Wisdom.findById(req.params.id);
    if (!wisdom || wisdom.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Wisdom not found' });
    }
    
    await wisdom.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

