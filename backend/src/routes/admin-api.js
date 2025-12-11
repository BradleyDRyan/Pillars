/**
 * Admin API Routes
 * 
 * Provides read-only access to users, conversations, and messages for admin dashboard
 */

const express = require('express');
const router = express.Router();
const { db, logger } = require('../config/firebase');
const { 
  getUserTriggers, 
  createUserTrigger, 
  updateUserTrigger, 
  deleteUserTrigger,
  getTriggerTemplates 
} = require('../services/triggers');
const { FieldValue } = require('../config/firebase');

// Simple admin auth check - in production, use proper admin authentication
const checkAdmin = async (req, res, next) => {
  // For now, allow all requests - add proper auth later
  // TODO: Implement admin authentication
  next();
};

router.use(checkAdmin);

/**
 * GET /api/admin/stats
 * Dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get counts by fetching documents (less efficient but more compatible)
    const [usersSnap, conversationsSnap] = await Promise.all([
      db.collection('users').limit(1000).get(),
      db.collection('conversations').limit(1000).get(),
    ]);

    res.json({
      totalUsers: usersSnap.size,
      totalConversations: conversationsSnap.size,
      totalMessages: 0, // Skip for now - too expensive
      activeToday: 0, // Skip for now
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get admin stats');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const snapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      lastActive: doc.data().lastActive?.toDate?.() || doc.data().lastActive,
    }));

    res.json(users);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get users');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Get single user
 */
router.get('/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      lastActive: doc.data().lastActive?.toDate?.() || doc.data().lastActive,
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get user');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:id/conversations
 * Get conversations for a user
 */
router.get('/users/:id/conversations', async (req, res) => {
  try {
    const snapshot = await db.collection('conversations')
      .where('userId', '==', req.params.id)
      .orderBy('updatedAt', 'desc')
      .get();

    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
    }));

    res.json(conversations);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get user conversations');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/conversations
 * List all conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const snapshot = await db.collection('conversations')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();

    const conversations = await Promise.all(snapshot.docs.map(async doc => {
      // Get message count
      const messagesSnap = await db.collection('messages')
        .where('conversationId', '==', doc.id)
        .count()
        .get();

      return {
        id: doc.id,
        ...doc.data(),
        messageCount: messagesSnap.data().count,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      };
    }));

    res.json(conversations);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get conversations');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/conversations/:id
 * Get single conversation with messages
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const [convoDoc, messagesSnap] = await Promise.all([
      db.collection('conversations').doc(req.params.id).get(),
      db.collection('messages')
        .where('conversationId', '==', req.params.id)
        .orderBy('createdAt', 'asc')
        .get(),
    ]);

    if (!convoDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = messagesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    res.json({
      id: convoDoc.id,
      ...convoDoc.data(),
      messages,
      createdAt: convoDoc.data().createdAt?.toDate?.() || convoDoc.data().createdAt,
      updatedAt: convoDoc.data().updatedAt?.toDate?.() || convoDoc.data().updatedAt,
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get conversation');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const snapshot = await db.collection('messages')
      .where('conversationId', '==', req.params.id)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    res.json(messages);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get messages');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRIGGER ENDPOINTS
// ============================================

/**
 * GET /api/admin/trigger-templates
 * List all available trigger templates
 */
router.get('/trigger-templates', async (req, res) => {
  try {
    const templates = await getTriggerTemplates();
    res.json(templates);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get trigger templates');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:id/triggers
 * Get all triggers for a user
 */
router.get('/users/:id/triggers', async (req, res) => {
  try {
    const triggers = await getUserTriggers(req.params.id);
    res.json(triggers);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get user triggers');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:id/triggers
 * Create a trigger for a user
 */
router.post('/users/:id/triggers', async (req, res) => {
  try {
    const trigger = await createUserTrigger(req.params.id, req.body);
    res.status(201).json(trigger);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create trigger');
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:id/triggers/:triggerId
 * Update a user's trigger
 */
router.put('/users/:id/triggers/:triggerId', async (req, res) => {
  try {
    const trigger = await updateUserTrigger(req.params.id, req.params.triggerId, req.body);
    res.json(trigger);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update trigger');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id/triggers/:triggerId
 * Delete a user's trigger
 */
router.delete('/users/:id/triggers/:triggerId', async (req, res) => {
  try {
    await deleteUserTrigger(req.params.id, req.params.triggerId);
    res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete trigger');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:id/nudge-history
 * Get nudge history for a user
 */
router.get('/users/:id/nudge-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const snapshot = await db.collection('nudgeHistory')
      .where('userId', '==', req.params.id)
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();

    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sentAt: doc.data().sentAt?.toDate?.() || doc.data().sentAt,
    }));

    res.json(history);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get nudge history');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/seed-trigger-templates
 * Seed the default trigger templates
 */
router.post('/seed-trigger-templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'morning-checkin',
        name: 'Morning Check-in',
        description: 'Daily morning motivation and planning prompt',
        type: 'schedule',
        defaultCron: '0 9 * * *',
        defaultTimezone: 'user',
        messageTemplate: null,
        enabled: true
      },
      {
        id: 'evening-reflection',
        name: 'Evening Reflection',
        description: 'End of day reflection and gratitude prompt',
        type: 'schedule',
        defaultCron: '0 20 * * *',
        defaultTimezone: 'user',
        messageTemplate: null,
        enabled: true
      },
      {
        id: 'weekly-review',
        name: 'Weekly Review',
        description: 'Sunday weekly review and planning',
        type: 'schedule',
        defaultCron: '0 10 * * 0',
        defaultTimezone: 'user',
        messageTemplate: null,
        enabled: true
      },
      {
        id: 'midday-momentum',
        name: 'Midday Momentum',
        description: 'Quick midday check-in to maintain focus',
        type: 'schedule',
        defaultCron: '0 13 * * 1-5',
        defaultTimezone: 'user',
        messageTemplate: null,
        enabled: true
      }
    ];

    const batch = db.batch();
    
    for (const template of templates) {
      const { id, ...data } = template;
      const ref = db.collection('triggerTemplates').doc(id);
      batch.set(ref, {
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    await batch.commit();
    
    logger.info({ count: templates.length }, 'Seeded trigger templates');
    res.json({ success: true, count: templates.length });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to seed trigger templates');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
