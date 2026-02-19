const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/day-templates — list user's templates
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('dayTemplates')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();

    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(templates);
  } catch (error) {
    console.error('[day-templates] GET / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/day-templates/default — get user's default template; 404 if none
router.get('/default', async (req, res) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('dayTemplates')
      .where('userId', '==', userId)
      .where('isDefault', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'No default template found' });
    }

    const doc = snapshot.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('[day-templates] GET /default error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/day-templates — create template
router.post('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id, name, isDefault, sections } = req.body;

    if (!id || !name || !sections) {
      return res.status(400).json({ error: 'Missing required fields: id, name, sections' });
    }

    // If setting as default, clear other defaults
    if (isDefault) {
      const existingDefaults = await db.collection('dayTemplates')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .get();
      const batch = db.batch();
      existingDefaults.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    const now = new Date();
    const templateData = {
      id,
      userId,
      name,
      isDefault: isDefault || false,
      sections,
      createdAt: now.getTime() / 1000,
      updatedAt: now.getTime() / 1000
    };

    await db.collection('dayTemplates').doc(id).set(templateData);
    res.status(201).json(templateData);
  } catch (error) {
    console.error('[day-templates] POST / error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/day-templates/:id — update template
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.uid;
    const templateRef = db.collection('dayTemplates').doc(req.params.id);
    const existing = await templateRef.get();

    if (!existing.exists) {
      return res.status(404).json({ error: 'Template not found' });
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

    await templateRef.set(updated);
    res.json(updated);
  } catch (error) {
    console.error('[day-templates] PUT /:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
