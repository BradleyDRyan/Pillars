const express = require('express');
const router = express.Router();
const { Conversation, Message } = require('../models');
const { verifyToken } = require('../middleware/auth');
const admin = require('firebase-admin');
const backgroundTasks = require('../services/backgroundTasks');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const pillarId = req.query.pillarId || null;
    const includeArchived = req.query.includeArchived === 'true';
    const conversations = await Conversation.findByUserId(req.user.uid, pillarId, includeArchived);
    res.json(conversations.map(c => c.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get or create primary conversation (Home View)
router.get('/primary', async (req, res) => {
  try {
    const conversation = await Conversation.findOrCreatePrimary(req.user.uid);
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  console.log('📨 [CONVERSATIONS] POST /conversations - Creating new conversation');
  console.log('📨 [CONVERSATIONS] User:', req.user?.uid);
  console.log('📨 [CONVERSATIONS] Body:', req.body);
  
  try {
    // Support both pillarIds (new) and projectIds (legacy)
    let pillarIds = req.body.pillarIds || req.body.projectIds || [];
    
    const conversation = await Conversation.create({
      ...req.body,
      pillarIds,
      userId: req.user.uid
    });
    
    console.log('✅ [CONVERSATIONS] Created conversation:', conversation.id);
    const jsonResponse = conversation.toJSON();
    console.log('📤 [CONVERSATIONS] Sending JSON response:', JSON.stringify(jsonResponse));
    
    res.status(201).json(jsonResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    Object.assign(conversation, req.body);
    await conversation.save();
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Archive conversation
router.post('/:id/archive', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    if (conversation.isPrimary) {
      return res.status(400).json({ error: 'Cannot archive primary conversation' });
    }
    
    await conversation.archive();
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unarchive conversation
router.post('/:id/unarchive', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    await conversation.unarchive();
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    if (conversation.isPrimary) {
      return res.status(400).json({ error: 'Cannot delete primary conversation' });
    }
    
    await conversation.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const messages = await Message.findByConversationId(req.params.id, limit);
    res.json(messages.map(m => m.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/messages', async (req, res) => {
  console.log(`📨 [MESSAGES] POST /conversations/${req.params.id}/messages`);
  console.log(`📨 [MESSAGES] User: ${req.user?.uid}`);
  console.log(`📨 [MESSAGES] Body:`, JSON.stringify(req.body).substring(0, 200));
  
  try {
    const conversation = await Conversation.findById(req.params.id);
    console.log(`📨 [MESSAGES] Conversation found: ${!!conversation}`);
    
    if (!conversation || conversation.userId !== req.user.uid) {
      console.log(`❌ [MESSAGES] Auth failed - conv userId: ${conversation?.userId}, req userId: ${req.user.uid}`);
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const {
      content,
      type = 'text',
      attachments = [],
      role = 'user',
      toolCalls = null,
      metadata = {}
    } = req.body;
    
    if (!content) {
      console.log(`❌ [MESSAGES] No content provided`);
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    console.log(`📨 [MESSAGES] Creating message with:
      - conversationId: ${req.params.id}
      - userId: ${req.user.uid}
      - type: ${type}
      - role: ${role}
      - content length: ${content.length}
      - metadata:`, req.body.metadata);
    
    // Create message in subcollection
    const message = await Message.create({
      conversationId: req.params.id,
      userId: req.user.uid,
      content,
      type,
      role,
      attachments,
      metadata,
      toolCalls: Array.isArray(toolCalls) ? toolCalls : null
    });
    
    console.log(`✅ [MESSAGES] Message created with ID: ${message.id}`);
    console.log(`✅ [MESSAGES] Message data:`, JSON.stringify(message).substring(0, 200));
    
    // Update conversation's last message
    conversation.lastMessage = content;
    conversation.updatedAt = admin.firestore.Timestamp.now();
    await conversation.save();
    
    // Queue title generation via QStash (async background task)
    if (role === 'user' && !conversation.titleGenerated) {
      const qstash = require('../services/qstash');
      const result = await qstash.generateTitle({
        conversationId: req.params.id,
        userId: req.user.uid,
        message: content
      });
      console.log(`[MESSAGES] Title generation ${result.queued ? 'queued' : 'skipped'}:`, result.messageId || result.reason);
    }
    
    console.log(`✅ [MESSAGES] Conversation updated, returning message`);
    res.status(201).json(message.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add pillar to conversation
router.post('/:id/pillars/:pillarId', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const { pillarId } = req.params;
    if (!conversation.pillarIds.includes(pillarId)) {
      conversation.pillarIds.push(pillarId);
      await conversation.save();
    }
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove pillar from conversation
router.delete('/:id/pillars/:pillarId', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    conversation.pillarIds = conversation.pillarIds.filter(id => id !== req.params.pillarId);
    await conversation.save();
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;