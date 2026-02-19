const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/days/today — get today's Day; 404 if none
router.get('/today', async (req, res) => {
  try {
    const userId = req.user.uid;
    // Today in UTC-offset — we store dates as "YYYY-MM-DD" from client
    // Query for any day matching today's date for this user
    const snapshot = await db.collection('days')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'No day found for today' });
    }

    // Find by date string (sent as query param from client)
    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({ error: 'Missing date query parameter' });
    }

    const doc = snapshot.docs.find(d => d.data().date === dateStr);
    if (!doc) {
      return res.status(404).json({ error: 'No day found for today' });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('[days] GET /today error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/days — create a Day
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id, date, templateId, sections } = req.body;

    if (!id || !date || !sections) {
      return res.status(400).json({ error: 'Missing required fields: id, date, sections' });
    }

    const now = new Date();
    const dayData = {
      id,
      userId,
      date,
      templateId: templateId || null,
      sections,
      createdAt: now.getTime() / 1000,
      updatedAt: now.getTime() / 1000
    };

    await db.collection('days').doc(id).set(dayData);
    res.status(201).json(dayData);
  } catch (error) {
    console.error('[days] POST / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/days/:id — full document replace + set updatedAt
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const dayRef = db.collection('days').doc(req.params.id);
    const existing = await dayRef.get();

    if (!existing.exists) {
      return res.status(404).json({ error: 'Day not found' });
    }
    if (existing.data().userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const updated = {
      ...req.body,
      userId,
      id: req.params.id,
      updatedAt: now.getTime() / 1000
    };

    await dayRef.set(updated);
    res.json(updated);
  } catch (error) {
    console.error('[days] PUT /:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
