/**
 * Admin Streaming Routes - SSE streaming chat with block sequencing and @ mention routing
 * 
 * Modeled after imagine repo's streaming architecture.
 * Key features:
 * - Block sequencing for inline tool rendering
 * - @ mention parsing and agent routing
 * - Message persistence to Firestore
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { Agent, AdminConversation, AdminMessage } = require('../models');
const { getToolDefinitions, executeTool } = require('../services/toolRegistry');
const {
  createBlockStreamContext,
  setSSEHeaders,
  emitText,
  emitToolStart,
  emitToolResult,
  emitAgentStart,
  emitAgentEnd,
  emitMessageSaved,
  emitError,
  emitDone
} = require('../services/adminSseManager');
const { logger } = require('../config/firebase');

const anthropic = new Anthropic();

/**
 * Parse @ mentions from text
 * Returns array of handles without the @ symbol
 */
function parseMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  
  return [...new Set(mentions)]; // Deduplicate
}

/**
 * Build system prompt for an agent
 */
function buildAgentSystemPrompt(agent) {
  const basePrompt = `You are ${agent.name}, an AI assistant in the Pillars admin interface.`;
  
  if (agent.systemPrompt) {
    return `${basePrompt}\n\n${agent.systemPrompt}`;
  }
  
  return `${basePrompt}

The Pillars app helps users develop good habits based on principles of wisdom.

The content hierarchy is:
1. Pillars - Top-level categories (e.g., "Relationships", "Career", "Health")
2. Themes - Sub-categories within pillars (e.g., "Marriage" under "Relationships")
3. Principles - Individual pieces of wisdom/life lessons within themes

Be conversational and helpful. Format your responses with markdown for readability.`;
}

/**
 * Default system prompt when no specific agent is invoked
 */
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant in the Pillars admin interface.

The Pillars app helps users develop good habits based on principles of wisdom.

The content hierarchy is:
1. Pillars - Top-level categories (e.g., "Relationships", "Career", "Health")  
2. Themes - Sub-categories within pillars (e.g., "Marriage" under "Relationships")
3. Principles - Individual pieces of wisdom/life lessons within themes

When users give you text to extract wisdom from:
1. First use list_pillars to see what already exists
2. Create new pillars/themes only if needed
3. Extract principles as actionable, concise wisdom
4. All new principles are created as drafts for review

Be conversational and helpful. Format your responses with markdown for readability.`;

/**
 * Run a single agent with streaming and tool execution
 */
async function runAgent(res, ctx, agent, messages, tools) {
  const systemPrompt = agent ? buildAgentSystemPrompt(agent) : DEFAULT_SYSTEM_PROMPT;
  const agentTools = agent?.tools?.length > 0 
    ? getToolDefinitions(agent.tools)
    : tools;
  
  // Emit agent start
  if (agent) {
    emitAgentStart(res, ctx, { id: agent.id, handle: agent.handle, name: agent.name });
  }
  
  // Accumulated blocks for this response
  const blocks = [];
  let continueLoop = true;
  let iterations = 0;
  const maxIterations = 15;
  
  // Convert messages to Anthropic format
  let conversationMessages = messages.map(m => {
    if (m.toAnthropicFormat) {
      return m.toAnthropicFormat();
    }
    return { role: m.role, content: m.content || m.getTextContent?.() || '' };
  });
  
  while (continueLoop && iterations < maxIterations) {
    iterations++;
    
    try {
      const stream = await anthropic.messages.stream({
        model: agent?.model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: agentTools,
        messages: conversationMessages
      });
      
      let currentToolUse = null;
      let toolInputJson = '';
      let currentTextBuffer = '';
      
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            currentTextBuffer = '';
          } else if (event.content_block.type === 'tool_use') {
            // Flush any pending text
            if (currentTextBuffer) {
              blocks.push({
                type: 'text',
                data: { text: currentTextBuffer },
                metadata: { sequence: ctx.sequenceCounter - 1, status: 'complete' }
              });
            }
            
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            };
            toolInputJson = '';
            
            // Emit tool start with sequence
            emitToolStart(res, ctx, currentToolUse);
            blocks.push({
              type: 'tool_use',
              data: { id: currentToolUse.id, name: currentToolUse.name, input: {} },
              metadata: { sequence: ctx.sequenceCounter - 1, status: 'tool_call', groupId: ctx.currentGroupId }
            });
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            currentTextBuffer += event.delta.text;
            emitText(res, ctx, event.delta.text);
          } else if (event.delta.type === 'input_json_delta') {
            toolInputJson += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try {
              currentToolUse.input = JSON.parse(toolInputJson);
              // Update the last tool_use block with parsed input
              const lastToolBlock = blocks.find(b => 
                b.type === 'tool_use' && b.data.id === currentToolUse.id
              );
              if (lastToolBlock) {
                lastToolBlock.data.input = currentToolUse.input;
              }
            } catch (e) {
              currentToolUse.input = {};
            }
          } else if (currentTextBuffer) {
            // Save text block
            blocks.push({
              type: 'text',
              data: { text: currentTextBuffer },
              metadata: { sequence: ctx.sequenceCounter - 1, status: 'complete' }
            });
          }
        }
      }
      
      const finalMessage = await stream.finalMessage();
      
      if (finalMessage.stop_reason === 'tool_use') {
        // Add assistant message to conversation
        conversationMessages.push({
          role: 'assistant',
          content: finalMessage.content
        });
        
        // Execute tools and collect results
        const toolResults = [];
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            try {
              const result = await executeTool(block.name, block.input);
              
              // Emit tool result with sequence
              emitToolResult(res, ctx, block, result, false);
              blocks.push({
                type: 'tool_result',
                data: { id: block.id, name: block.name, content: result, isError: false },
                metadata: { sequence: ctx.sequenceCounter - 1, status: 'complete', groupId: ctx.currentGroupId }
              });
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
            } catch (error) {
              // Emit tool error
              emitToolResult(res, ctx, block, { error: error.message }, true);
              blocks.push({
                type: 'tool_result',
                data: { id: block.id, name: block.name, content: { error: error.message }, isError: true },
                metadata: { sequence: ctx.sequenceCounter - 1, status: 'error', groupId: ctx.currentGroupId }
              });
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
            }
          }
        }
        
        // Add tool results to conversation
        conversationMessages.push({
          role: 'user',
          content: toolResults
        });
      } else {
        continueLoop = false;
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Error in agent stream');
      emitError(res, error);
      continueLoop = false;
    }
  }
  
  // Emit agent end
  if (agent) {
    emitAgentEnd(res, ctx, { id: agent.id, handle: agent.handle });
  }
  
  return blocks;
}

/**
 * POST /api/admin-streaming/chat
 * Stream a chat response with tool calling and @ mention routing
 */
router.post('/chat', async (req, res) => {
  const { conversationId, message, messages: existingMessages } = req.body;
  
  if (!message && (!existingMessages || existingMessages.length === 0)) {
    return res.status(400).json({ error: 'Message or messages array is required' });
  }
  
  // Set up SSE
  setSSEHeaders(res);
  const ctx = createBlockStreamContext();
  
  try {
    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await AdminConversation.findById(conversationId);
      if (!conversation) {
        emitError(res, new Error('Conversation not found'));
        return emitDone(res);
      }
    } else {
      conversation = await AdminConversation.create({ title: 'New Conversation' });
    }
    
    // Parse mentions from the new message
    const userMessageText = message || (existingMessages?.slice(-1)[0]?.content) || '';
    const mentions = parseMentions(userMessageText);
    
    // Save user message
    const userMessage = await AdminMessage.createUserMessage(
      conversation.id,
      userMessageText,
      mentions
    );
    await conversation.incrementMessageCount();
    
    emitMessageSaved(res, { id: userMessage.id, conversationId: conversation.id });
    
    // Load conversation history
    const history = await AdminMessage.findByConversationId(conversation.id);
    
    // Get all available tools
    const allTools = getToolDefinitions();
    
    // Determine which agents to invoke
    let agentsToInvoke = [];
    
    // First, add explicitly mentioned agents
    if (mentions.length > 0) {
      for (const handle of mentions) {
        const agent = await Agent.findByHandle(handle);
        if (agent) {
          agentsToInvoke.push(agent);
        }
      }
    }
    
    // Then, add proactive agents (speakMode === 'proactive') if no specific agents mentioned
    // or always include them in multi-agent scenarios
    const allAgents = await Agent.findAll(false); // Only active agents
    const proactiveAgents = allAgents.filter(a => 
      a.speakMode === 'proactive' && 
      !agentsToInvoke.some(inv => inv?.id === a.id) // Not already included
    );
    
    // If no agents mentioned, let proactive agents respond
    if (agentsToInvoke.length === 0) {
      if (proactiveAgents.length > 0) {
        agentsToInvoke = proactiveAgents;
      } else {
        agentsToInvoke = [null]; // null = default assistant
      }
    }
    
    // Run each agent
    const allBlocks = [];
    
    for (const agent of agentsToInvoke) {
      const agentBlocks = await runAgent(res, ctx, agent, history, allTools);
      allBlocks.push(...agentBlocks);
    }
    
    // Save assistant message with all blocks
    if (allBlocks.length > 0) {
      const assistantMessage = await AdminMessage.createAssistantMessage(
        conversation.id,
        allBlocks,
        agentsToInvoke[0] ? {
          id: agentsToInvoke[0].id,
          handle: agentsToInvoke[0].handle,
          name: agentsToInvoke[0].name
        } : {}
      );
      await conversation.incrementMessageCount();
      
      emitMessageSaved(res, { id: assistantMessage.id, conversationId: conversation.id });
      
      // Generate title if this is a new conversation
      if (conversation.messageCount <= 2) {
        // Could call title generation here
      }
    }
    
    emitDone(res);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Error in admin streaming chat');
    emitError(res, error);
    emitDone(res);
  }
});

module.exports = router;
