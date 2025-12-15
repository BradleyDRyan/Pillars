/**
 * Room Routes - Group chat coordination spaces
 * 
 * Rooms are where you and agents collaborate. Agents are autonomous:
 * they decide themselves whether to respond based on mentions + their speakMode.
 */

const express = require('express');
const router = express.Router();
const { Room, RoomMessage, Agent, AgentDraft } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { logger } = require('../config/firebase');

router.use(verifyToken);

// ============================================
// ROOM CRUD
// ============================================

/**
 * GET /api/rooms
 * List all rooms for the current user
 */
router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const rooms = await Room.findByOwnerId(req.user.uid, includeArchived);
    
    res.json({ rooms: rooms.map(r => r.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list rooms');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rooms
 * Create a new room
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, memberAgentIds } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    
    // Validate agent IDs if provided
    const validAgentIds = [];
    if (memberAgentIds && Array.isArray(memberAgentIds)) {
      for (const agentId of memberAgentIds) {
        const agent = await Agent.findById(agentId);
        if (agent && agent.isActive) {
          validAgentIds.push(agentId);
        }
      }
    }
    
    const room = await Room.create({
      ownerId: req.user.uid,
      name: name.trim(),
      description: description?.trim() || '',
      memberAgentIds: validAgentIds
    });
    
    res.status(201).json({ room: room.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create room');
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rooms/:id
 * Get a room with its members
 */
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Fetch agent details for members
    const memberAgents = [];
    for (const agentId of room.memberAgentIds) {
      const agent = await Agent.findById(agentId);
      if (agent) {
        memberAgents.push({
          id: agent.id,
          name: agent.name,
          handle: agent.handle,
          description: agent.description,
          speakMode: agent.speakMode,
          isActive: agent.isActive
        });
      }
    }
    
    res.json({ 
      room: room.toJSON(),
      memberAgents
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get room');
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/rooms/:id
 * Update room details
 */
router.put('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const { name, description } = req.body;
    
    if (name !== undefined) room.name = name.trim();
    if (description !== undefined) room.description = description?.trim() || '';
    
    await room.save();
    
    res.json({ room: room.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update room');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rooms/:id/archive
 * Archive a room
 */
router.post('/:id/archive', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    await room.archive();
    
    res.json({ room: room.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to archive room');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/rooms/:id
 * Delete a room
 */
router.delete('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    await room.delete();
    
    res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete room');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MEMBERSHIP MANAGEMENT
// ============================================

/**
 * POST /api/rooms/:id/members
 * Add an agent to the room
 */
router.post('/:id/members', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }
    
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (!agent.isActive) {
      return res.status(400).json({ error: 'Cannot add inactive agent to room' });
    }
    
    await room.addAgent(agentId);
    
    res.json({ 
      room: room.toJSON(),
      addedAgent: {
        id: agent.id,
        name: agent.name,
        handle: agent.handle
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to add agent to room');
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/rooms/:id/members/:agentId
 * Remove an agent from the room
 */
router.delete('/:id/members/:agentId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    await room.removeAgent(req.params.agentId);
    
    res.json({ room: room.toJSON() });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to remove agent from room');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MESSAGES
// ============================================

/**
 * GET /api/rooms/:id/messages
 * Get messages in a room
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const limit = parseInt(req.query.limit) || 100;
    const messages = await RoomMessage.findByRoomId(req.params.id, { limit });
    
    res.json({ messages: messages.map(m => m.toJSON()) });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get room messages');
    res.status(500).json({ error: error.message });
  }
});

/**
 * Parse @mentions from text
 * Returns array of handles (without @)
 */
function parseMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  
  return [...new Set(mentions)];
}

/**
 * POST /api/rooms/:id/messages
 * Post a message to the room
 * 
 * This triggers autonomous agent responses based on mentions and speakMode.
 * Returns immediately with the user message; agent responses arrive via SSE.
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Parse mentions
    const mentions = parseMentions(content);
    
    // Create user message
    const userMessage = await RoomMessage.createUserMessage(
      room.id,
      req.user.uid,
      content.trim(),
      mentions
    );
    
    // Update room's last message
    await room.updateLastMessage(content.trim());
    
    // Determine which agents should respond (autonomous decision)
    const agentsToRespond = [];
    
    for (const agentId of room.memberAgentIds) {
      const agent = await Agent.findById(agentId);
      if (!agent || !agent.isActive) continue;
      
      // Agent's autonomous decision to respond:
      // 1. If mentioned, respond (regardless of speakMode)
      // 2. If speakMode is 'proactive', may respond to any message
      const isMentioned = mentions.includes(agent.handle.toLowerCase());
      const isProactive = agent.speakMode === 'proactive';
      
      if (isMentioned) {
        agentsToRespond.push({ agent, reason: 'mentioned' });
      } else if (isProactive) {
        // Proactive agents could respond, but let's limit this for now
        // In future: could add probability or relevance check
        agentsToRespond.push({ agent, reason: 'proactive' });
      }
    }
    
    logger.info({
      roomId: room.id,
      messageId: userMessage.id,
      mentions,
      agentsToRespond: agentsToRespond.map(a => ({ id: a.agent.id, handle: a.agent.handle, reason: a.reason }))
    }, 'Message posted, agents to respond');
    
    // Return the user message immediately
    // Agent responses will be triggered asynchronously
    res.status(201).json({ 
      message: userMessage.toJSON(),
      agentsTriggered: agentsToRespond.map(a => ({
        id: a.agent.id,
        handle: a.agent.handle,
        name: a.agent.name,
        reason: a.reason
      }))
    });
    
    // Trigger agent responses in parallel (fire-and-forget for now)
    // In the streaming version, these would stream via SSE
    if (agentsToRespond.length > 0) {
      triggerAgentResponses(room, userMessage, agentsToRespond);
    }
    
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to post message');
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger agent responses in parallel (non-streaming version)
 * 
 * Each agent runs independently and posts their own message to the room.
 */
async function triggerAgentResponses(room, triggerMessage, agentsToRespond) {
  const { runAgentInRoom } = require('../services/roomAgentRunner');
  
  // Run all agents in parallel
  const promises = agentsToRespond.map(({ agent, reason }) => 
    runAgentInRoom(room, agent, triggerMessage.id, reason)
      .catch(error => {
        logger.error({
          error: error.message,
          agentId: agent.id,
          roomId: room.id
        }, 'Agent response failed');
      })
  );
  
  await Promise.all(promises);
}

// ============================================
// AGENT DRAFTS (view from room context)
// ============================================

/**
 * GET /api/rooms/:id/drafts
 * Get all drafts from agents in this room
 */
router.get('/:id/drafts', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room || room.ownerId !== req.user.uid) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const status = req.query.status || 'pending_review';
    const allDrafts = [];
    
    // Get drafts from each member agent
    for (const agentId of room.memberAgentIds) {
      const drafts = await AgentDraft.findByAgentId(agentId, { 
        status,
        limit: 50 
      });
      
      // Add agent info to each draft
      const agent = await Agent.findById(agentId);
      for (const draft of drafts) {
        allDrafts.push({
          ...draft.toJSON(),
          agent: agent ? { id: agent.id, name: agent.name, handle: agent.handle } : null
        });
      }
    }
    
    // Sort by creation time (newest first)
    allDrafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ drafts: allDrafts });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get room drafts');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STREAMING CHAT
// ============================================

/**
 * POST /api/rooms/:id/chat/stream
 * Post a message and stream agent responses via SSE
 */
router.post('/:id/chat/stream', async (req, res) => {
  const room = await Room.findById(req.params.id);
  
  if (!room || room.ownerId !== req.user.uid) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const { content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();
  
  const emit = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };
  
  try {
    // Parse mentions
    const mentions = parseMentions(content);
    
    // Create user message
    const userMessage = await RoomMessage.createUserMessage(
      room.id,
      req.user.uid,
      content.trim(),
      mentions
    );
    
    await room.updateLastMessage(content.trim());
    
    emit('message_saved', { id: userMessage.id, roomId: room.id });
    
    // Determine which agents should respond
    const agentsToRespond = [];
    
    for (const agentId of room.memberAgentIds) {
      const agent = await Agent.findById(agentId);
      if (!agent || !agent.isActive) continue;
      
      const isMentioned = mentions.includes(agent.handle.toLowerCase());
      const isProactive = agent.speakMode === 'proactive';
      
      if (isMentioned) {
        agentsToRespond.push({ agent, reason: 'mentioned' });
      } else if (isProactive) {
        agentsToRespond.push({ agent, reason: 'proactive' });
      }
    }
    
    emit('agents_triggered', {
      agents: agentsToRespond.map(a => ({
        id: a.agent.id,
        handle: a.agent.handle,
        name: a.agent.name,
        reason: a.reason
      }))
    });
    
    // Run agents in parallel with streaming
    if (agentsToRespond.length > 0) {
      const { runAgentInRoomStream } = require('../services/roomAgentRunner');
      
      // For parallel streaming, we run all agents but they share the response stream
      // Each agent's output is prefixed with their handle
      const promises = agentsToRespond.map(({ agent }) =>
        runAgentInRoomStream(room, agent, userMessage.id, res)
          .catch(error => {
            logger.error({
              error: error.message,
              agentId: agent.id,
              roomId: room.id
            }, 'Streaming agent response failed');
          })
      );
      
      await Promise.all(promises);
    }
    
    emit('done', {});
    res.end();
    
  } catch (error) {
    logger.error({ error: error.message }, 'Streaming chat failed');
    emit('error', { message: error.message });
    res.end();
  }
});

module.exports = router;

