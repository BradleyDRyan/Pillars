const express = require('express');
const router = express.Router();
const { Conversation, Message } = require('../models');
const { verifyToken } = require('../middleware/auth');
const admin = require('firebase-admin');
const backgroundTasks = require('../services/backgroundTasks');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const projectId = req.query.projectId || null;
    const conversations = await Conversation.findByUserId(req.user.uid, projectId);
    res.json(conversations.map(c => c.toJSON()));
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
    let projectIds = req.body.projectIds || [];
    
    const conversation = await Conversation.create({
      ...req.body,
      projectIds,
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

router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
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

// Add project to conversation
router.post('/:id/projects/:projectId', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const { projectId } = req.params;
    if (!conversation.projectIds.includes(projectId)) {
      conversation.projectIds.push(projectId);
      await conversation.save();
    }
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove project from conversation
router.delete('/:id/projects/:projectId', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    conversation.projectIds = conversation.projectIds.filter(id => id !== req.params.projectId);
    await conversation.save();
    res.json(conversation.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;