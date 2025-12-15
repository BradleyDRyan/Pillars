const express = require('express');
const router = express.Router();
const { Insight, Pillar } = require('../models');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Get all insights for user
router.get('/', async (req, res) => {
  try {
    const filters = {
      pillarId: req.query.pillarId
    };
    const insights = await Insight.findByUserId(req.user.uid, filters);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned insights (not linked to any pillar)
router.get('/unassigned', async (req, res) => {
  try {
    const insights = await Insight.findUnassigned(req.user.uid);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single insight
router.get('/:id', async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight || insight.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    res.json(insight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create insight
router.post('/', async (req, res) => {
  try {
    // Validate pillar ownership if pillarId provided
    if (req.body.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    const insight = await Insight.create({
      ...req.body,
      userId: req.user.uid
    });
    res.status(201).json(insight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update insight
router.put('/:id', async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight || insight.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    // Validate new pillar ownership if changing pillarId
    if (req.body.pillarId && req.body.pillarId !== insight.pillarId) {
      const pillar = await Pillar.findById(req.body.pillarId);
      if (!pillar || pillar.userId !== req.user.uid) {
        return res.status(400).json({ error: 'Invalid pillar' });
      }
    }
    
    Object.assign(insight, req.body);
    await insight.save();
    res.json(insight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign insight to pillar
router.post('/:id/assign/:pillarId', async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight || insight.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    const pillar = await Pillar.findById(req.params.pillarId);
    if (!pillar || pillar.userId !== req.user.uid) {
      return res.status(400).json({ error: 'Invalid pillar' });
    }
    
    insight.pillarId = req.params.pillarId;
    await insight.save();
    res.json(insight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unassign insight from pillar
router.post('/:id/unassign', async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight || insight.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    insight.pillarId = null;
    await insight.save();
    res.json(insight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete insight
router.delete('/:id', async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight || insight.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    await insight.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;



