/**
 * Admin Conversations Routes - CRUD for admin chat conversations and messages
 */

const express = require('express');
const router = express.Router();
const { AdminConversation, AdminMessage } = require('../models');
const { logger } = require('../config/firebase');

/**
 * GET /api/admin-conversations
 * List all conversations
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const conversations = await AdminConversation.findAll(limit);
    res.json({ conversations: conversations.map(c => c.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message }, 'Error listing conversations');
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * POST /api/admin-conversations
 * Create a new conversation
 */
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await AdminConversation.create({
      title: title || 'New Conversation'
    });
    res.status(201).json({ conversation: conversation.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Error creating conversation');
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/admin-conversations/:id
 * Get a single conversation
 */
router.get('/:id', async (req, res) => {
  try {
    const conversation = await AdminConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ conversation: conversation.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting conversation');
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * PUT /api/admin-conversations/:id
 * Update a conversation (e.g., rename)
 */
router.put('/:id', async (req, res) => {
  try {
    const conversation = await AdminConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const { title } = req.body;
    if (title) {
      await conversation.update({ title });
    }
    
    res.json({ conversation: conversation.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Error updating conversation');
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/admin-conversations/:id
 * Delete a conversation and all its messages
 */
router.delete('/:id', async (req, res) => {
  try {
    const conversation = await AdminConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    await conversation.delete();
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error deleting conversation');
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * GET /api/admin-conversations/:id/messages
 * Get all messages for a conversation
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const conversation = await AdminConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const limit = parseInt(req.query.limit) || 100;
    const messages = await AdminMessage.findByConversationId(req.params.id, limit);
    
    res.json({ 
      conversation: conversation.toJSON(),
      messages: messages.map(m => m.toJSON())
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting messages');
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

module.exports = router;

