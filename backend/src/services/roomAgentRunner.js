/**
 * Room Agent Runner
 * 
 * Runs an agent autonomously within a room context.
 * The agent sees room history, decides what to do, and posts its response.
 * 
 * Key difference from agentRunner.js:
 * - Agent operates in a shared room (not its own conversation)
 * - Agent owns its output (drafts go to agent's workspace, not the room)
 * - Room messages just reference the drafts
 */

const { logger } = require('../config/firebase');
const { RoomMessage, AgentDraft, Agent } = require('../models');
const { chatCompletion, chatCompletionStream } = require('./anthropic');
const { getToolDefinitions, executeTool } = require('./toolRegistry');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

/**
 * Build system prompt for an agent operating in a room
 */
function buildRoomAgentSystemPrompt(agent, room) {
  const basePrompt = `You are ${agent.name} (@${agent.handle}), an AI agent participating in a group chat room called "${room.name}".

${agent.description || ''}

${agent.systemPrompt || ''}

IMPORTANT CONTEXT:
- You are in a group chat with a human editor-in-chief and potentially other AI agents
- When you create content (like principles, pillars, etc.), it goes to YOUR workspace as a draft
- The human will review and approve your drafts before publishing
- Reference your drafts in your messages so the human knows what you created
- Be collaborative - you may be responding alongside other agents

When creating onboarding content:
- Create principles as first-person "I" statements
- Make them actionable and inspiring
- Keep them to 1-2 sentences
- They will be created as drafts for review`;

  return basePrompt;
}

/**
 * Build messages array from room history
 */
async function buildRoomMessages(room, triggerMessageId, agent) {
  // Get recent messages for context
  const recentMessages = await RoomMessage.findRecent(room.id, 20);
  
  const messages = [];
  
  for (const msg of recentMessages) {
    // Convert to Anthropic format
    if (msg.senderType === 'user') {
      messages.push({
        role: 'user',
        content: msg.content
      });
    } else if (msg.senderType === 'agent') {
      // Agent messages become assistant messages
      // But we need to handle the case where multiple agents responded
      const prefix = msg.senderId === agent.id ? '' : `[@${msg.senderHandle}]: `;
      messages.push({
        role: 'assistant',
        content: prefix + msg.content
      });
    }
  }
  
  // Ensure proper alternation (Anthropic requirement)
  const fixedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prevMsg = fixedMessages[fixedMessages.length - 1];
    
    if (prevMsg && prevMsg.role === msg.role) {
      // Same role twice - merge or insert synthetic message
      if (msg.role === 'assistant') {
        fixedMessages.push({ role: 'user', content: '[Continue]' });
      } else {
        // Merge user messages
        prevMsg.content += '\n' + msg.content;
        continue;
      }
    }
    fixedMessages.push(msg);
  }
  
  // Ensure last message is from user (if it's from assistant, add prompt)
  if (fixedMessages.length > 0 && fixedMessages[fixedMessages.length - 1].role === 'assistant') {
    fixedMessages.push({
      role: 'user',
      content: `@${agent.handle}, please respond to the conversation.`
    });
  }
  
  return fixedMessages;
}

/**
 * Get tools for this agent, plus draft creation tools
 */
function getAgentTools(agent) {
  // Get agent's configured tools
  const agentTools = agent.tools?.length > 0 
    ? getToolDefinitions(agent.tools)
    : [];
  
  // Add draft creation tools (always available to agents in rooms)
  const draftTools = [
    {
      name: 'create_draft',
      description: 'Create a draft in your workspace. The draft will be reviewed by the editor before publishing.',
      input_schema: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['onboarding_pillar', 'onboarding_principle', 'text'],
            description: 'Type of content being drafted'
          },
          title: {
            type: 'string',
            description: 'Title or short summary of the draft'
          },
          content: {
            type: 'object',
            description: 'The content of the draft. Shape depends on contentType.',
            properties: {
              text: { type: 'string', description: 'For principles: the principle text. For pillars: the pillar name.' },
              description: { type: 'string', description: 'Optional description' },
              pillarId: { type: 'string', description: 'For principles: the pillar this belongs to' }
            }
          }
        },
        required: ['contentType', 'title', 'content']
      }
    },
    {
      name: 'list_my_drafts',
      description: 'List drafts in your workspace',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'pending_review', 'approved', 'rejected'],
            description: 'Filter by status'
          },
          limit: {
            type: 'number',
            description: 'Max number of drafts to return'
          }
        }
      }
    }
  ];
  
  return [...agentTools, ...draftTools];
}

/**
 * Execute a tool for an agent in room context
 */
async function executeAgentTool(toolName, toolInput, context) {
  const { agent, room, triggerMessageId } = context;
  
  // Handle draft-specific tools
  if (toolName === 'create_draft') {
    const draft = await AgentDraft.create({
      agentId: agent.id,
      contentType: toolInput.contentType,
      title: toolInput.title,
      content: toolInput.content,
      status: 'draft',
      sourceRoomId: room.id,
      sourceMessageId: triggerMessageId
    });
    
    return {
      success: true,
      draftId: draft.id,
      title: draft.title,
      contentType: draft.contentType,
      message: `Draft created: "${draft.title}". It will appear in your workspace for review.`
    };
  }
  
  if (toolName === 'list_my_drafts') {
    const drafts = await AgentDraft.findByAgentId(agent.id, {
      status: toolInput.status,
      limit: toolInput.limit || 10
    });
    
    return {
      drafts: drafts.map(d => ({
        id: d.id,
        title: d.title,
        contentType: d.contentType,
        status: d.status,
        createdAt: d.createdAt
      })),
      count: drafts.length
    };
  }
  
  // Fall back to standard tool execution
  return executeTool(toolName, toolInput);
}

/**
 * Run an agent in a room (non-streaming)
 * 
 * The agent processes room context, potentially uses tools,
 * and posts a response message to the room.
 */
async function runAgentInRoom(room, agent, triggerMessageId, reason = 'mentioned') {
  logger.info({
    roomId: room.id,
    agentId: agent.id,
    agentHandle: agent.handle,
    triggerMessageId,
    reason
  }, '[room-agent-runner] Starting agent run');
  
  const systemPrompt = buildRoomAgentSystemPrompt(agent, room);
  const messages = await buildRoomMessages(room, triggerMessageId, agent);
  const tools = getAgentTools(agent);
  
  const context = { agent, room, triggerMessageId };
  
  try {
    let conversationMessages = [...messages];
    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 10;
    let fullResponse = '';
    const createdDrafts = [];
    
    while (continueLoop && iterations < maxIterations) {
      iterations++;
      
      const response = await anthropic.messages.create({
        model: agent.model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: conversationMessages
      });
      
      // Process response
      if (response.stop_reason === 'tool_use') {
        // Add assistant message
        conversationMessages.push({
          role: 'assistant',
          content: response.content
        });
        
        // Execute tools
        const toolResults = [];
        for (const block of response.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
          } else if (block.type === 'tool_use') {
            try {
              const result = await executeAgentTool(block.name, block.input, context);
              
              // Track created drafts
              if (block.name === 'create_draft' && result.draftId) {
                createdDrafts.push({
                  agentId: agent.id,
                  draftId: result.draftId
                });
              }
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
            } catch (error) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
            }
          }
        }
        
        conversationMessages.push({
          role: 'user',
          content: toolResults
        });
      } else {
        // End turn - extract final text
        for (const block of response.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
          }
        }
        continueLoop = false;
      }
    }
    
    // Post agent's message to the room
    const agentMessage = await RoomMessage.createAgentMessage(
      room.id,
      agent,
      fullResponse,
      {
        draftRefs: createdDrafts,
        triggerMessageId,
        metadata: { reason, iterations }
      }
    );
    
    // Update room's last message
    await room.updateLastMessage(`[@${agent.handle}]: ${fullResponse.substring(0, 50)}...`);
    
    logger.info({
      roomId: room.id,
      agentId: agent.id,
      messageId: agentMessage.id,
      draftsCreated: createdDrafts.length
    }, '[room-agent-runner] Agent run completed');
    
    return {
      message: agentMessage,
      draftsCreated: createdDrafts
    };
    
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      roomId: room.id,
      agentId: agent.id
    }, '[room-agent-runner] Agent run failed');
    
    // Post error message to room
    try {
      await RoomMessage.createAgentMessage(
        room.id,
        agent,
        `Sorry, I encountered an error: ${error.message}`,
        {
          triggerMessageId,
          metadata: { error: true, errorMessage: error.message }
        }
      );
    } catch (msgError) {
      logger.error({ error: msgError.message }, '[room-agent-runner] Failed to post error message');
    }
    
    throw error;
  }
}

/**
 * Run an agent in a room with streaming (SSE)
 * 
 * Similar to runAgentInRoom but streams the response.
 */
async function runAgentInRoomStream(room, agent, triggerMessageId, res, options = {}) {
  logger.info({
    roomId: room.id,
    agentId: agent.id,
    triggerMessageId
  }, '[room-agent-runner] Starting streaming agent run');
  
  const systemPrompt = buildRoomAgentSystemPrompt(agent, room);
  const messages = await buildRoomMessages(room, triggerMessageId, agent);
  const tools = getAgentTools(agent);
  
  const context = { agent, room, triggerMessageId };
  
  // Helper to emit SSE events
  const emit = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };
  
  emit('agent_start', { id: agent.id, handle: agent.handle, name: agent.name });
  
  try {
    let conversationMessages = [...messages];
    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 10;
    let fullResponse = '';
    const createdDrafts = [];
    
    while (continueLoop && iterations < maxIterations) {
      iterations++;
      
      const stream = await anthropic.messages.stream({
        model: agent.model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: conversationMessages
      });
      
      let currentToolUse = null;
      let toolInputJson = '';
      
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            // Text block starting
          } else if (event.content_block.type === 'tool_use') {
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            };
            toolInputJson = '';
            emit('tool_start', { id: currentToolUse.id, name: currentToolUse.name });
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullResponse += event.delta.text;
            emit('text', { text: event.delta.text, agentHandle: agent.handle });
          } else if (event.delta.type === 'input_json_delta') {
            toolInputJson += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try {
              currentToolUse.input = JSON.parse(toolInputJson);
            } catch (e) {
              currentToolUse.input = {};
            }
          }
        }
      }
      
      const finalMessage = await stream.finalMessage();
      
      if (finalMessage.stop_reason === 'tool_use') {
        conversationMessages.push({
          role: 'assistant',
          content: finalMessage.content
        });
        
        const toolResults = [];
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            try {
              const result = await executeAgentTool(block.name, block.input, context);
              
              if (block.name === 'create_draft' && result.draftId) {
                createdDrafts.push({ agentId: agent.id, draftId: result.draftId });
              }
              
              emit('tool_result', { id: block.id, name: block.name, result });
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
            } catch (error) {
              emit('tool_error', { id: block.id, name: block.name, error: error.message });
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
            }
          }
        }
        
        conversationMessages.push({
          role: 'user',
          content: toolResults
        });
      } else {
        continueLoop = false;
      }
    }
    
    // Save agent message
    const agentMessage = await RoomMessage.createAgentMessage(
      room.id,
      agent,
      fullResponse,
      {
        draftRefs: createdDrafts,
        triggerMessageId,
        metadata: { iterations }
      }
    );
    
    await room.updateLastMessage(`[@${agent.handle}]: ${fullResponse.substring(0, 50)}...`);
    
    emit('agent_end', { 
      id: agent.id, 
      handle: agent.handle,
      messageId: agentMessage.id,
      draftsCreated: createdDrafts
    });
    
    return { message: agentMessage, draftsCreated: createdDrafts };
    
  } catch (error) {
    logger.error({
      error: error.message,
      roomId: room.id,
      agentId: agent.id
    }, '[room-agent-runner] Streaming agent run failed');
    
    emit('agent_error', { 
      id: agent.id, 
      handle: agent.handle, 
      error: error.message 
    });
    
    throw error;
  }
}

module.exports = {
  runAgentInRoom,
  runAgentInRoomStream,
  buildRoomAgentSystemPrompt,
  getAgentTools
};

