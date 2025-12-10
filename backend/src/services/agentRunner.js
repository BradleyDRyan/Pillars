const { logger } = require('../config/firebase');
const { chatCompletion, chatCompletionStream } = require('./anthropic');
const Agent = require('../models/Agent');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { convertClaudeContentToBlocks, createToolResultBlock, mergeToolBlocks } = require('../utils/blockConverter');

/**
 * Runs an agent and posts the result as a message in its conversation.
 * 
 * @param {string} agentId - The ID of the agent to run
 * @param {object} options - Optional parameters
 * @param {string} options.model - Override the agent's model
 * @param {number} options.temperature - Override temperature
 * @param {number} options.maxTokens - Override max tokens
 * @returns {Promise<object>} - Returns { agent, conversation, message }
 */
const runAgent = async (agentId, options = {}) => {
  if (!agentId) {
    throw new Error('Agent ID is required');
  }

  logger.info({ agentId, options }, '[agent-runner] Starting agent run');

  // Fetch agent
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  // Fetch or create conversation
  let conversation = await Conversation.findByAgentId(agentId);
  if (!conversation) {
    // Create conversation if it doesn't exist
    conversation = await Conversation.create({
      userId: agent.userId,
      agentId: agent.id,
      title: agent.name,
      lastMessage: null
    });
    
    // Update agent with conversationId
    await Agent.update(agent.id, { conversationId: conversation.id });
    agent.conversationId = conversation.id;
  }

  // Fetch recent messages for context (last 10)
  const recentMessages = await Message.findByConversationId(conversation.id, 10);

  // Build messages array for Claude
  const messages = buildAgentMessages(agent, recentMessages);

  try {
    // Call Claude API
    const claudeResponse = await chatCompletion(messages, {
      model: options.model || agent.model || undefined,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens || 2000,
      useWebSearch: agent.enableWebSearch,
      webSearchMaxUses: options.webSearchMaxUses
    });

    const resultContent = claudeResponse.content.trim();
    
    // Convert Claude response to blocks
    const blocks = convertClaudeContentToBlocks(claudeResponse.rawContent || []);
    
    // If no blocks were created but we have text, create a text block
    if (blocks.length === 0 && resultContent) {
      blocks.push({
        type: 'text',
        data: { text: resultContent },
        metadata: { sequence: 0 }
      });
    }

    // Create message in conversation with blocks
    const message = await Message.create({
      conversationId: conversation.id,
      userId: agent.userId,
      sender: agent.id, // Message is from the agent
      content: resultContent, // Keep for backward compatibility
      type: 'text',
      role: 'assistant',
      blocks: blocks.length > 0 ? blocks : null, // Store blocks array
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        model: options.model || agent.model || null,
        enableWebSearch: agent.enableWebSearch,
        usage: claudeResponse.usage || null
      }
    });

    // Update conversation lastMessage and updatedAt
    conversation.lastMessage = resultContent.substring(0, 200); // Truncate for preview
    await conversation.save();

    logger.info(
      { agentId: agent.id, conversationId: conversation.id, messageId: message.id },
      '[agent-runner] Agent run completed successfully'
    );

    return {
      agent,
      conversation,
      message
    };
  } catch (error) {
    logger.error(
      { err: error, agentId: agent.id },
      '[agent-runner] Agent run failed'
    );

    // Optionally create an error message
    try {
      const errorMessage = await Message.create({
        conversationId: conversation.id,
        userId: agent.userId,
        sender: agent.id,
        content: `Error: ${error.message}`,
        type: 'text',
        role: 'assistant',
        metadata: {
          agentId: agent.id,
          error: true,
          errorMessage: error.message
        }
      });
      
      conversation.lastMessage = `Error: ${error.message}`;
      await conversation.save();
    } catch (msgError) {
      logger.error({ err: msgError }, '[agent-runner] Failed to create error message');
    }

    throw error;
  }
};

/**
 * Builds messages array for Claude API from agent instructions and recent conversation history.
 */
const buildAgentMessages = (agent, recentMessages = []) => {
  const messages = [];

  // System message with agent instructions
  const systemInstructions = agent.instructions || `You are an autonomous agent named "${agent.name}".

${agent.description || 'Your task is to help the user by finding and reporting relevant information.'}

When you find information, report it clearly and concisely. If you find nothing new or relevant, indicate that clearly.

CRITICAL TOOL USAGE RULES:
- Maximum 3-5 tool calls TOTAL per response (not per tool type)
- For Amazon searches: Use ONLY 1-2 search queries maximum. Do NOT search for every variation or model.
- Combine related queries into a single, comprehensive search when possible
- If you need multiple searches, prioritize the most important ones
- After getting results, analyze them and report - do NOT keep searching endlessly
- If initial searches don't yield results, report that rather than trying many variations`;

  messages.push({
    role: 'system',
    content: systemInstructions
  });

  // Add recent conversation history (last 10 messages)
  // Only include user and assistant messages, skip system messages
  const conversationHistory = recentMessages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-10) // Last 10 messages
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }));

  messages.push(...conversationHistory);

  // If no conversation history, add a prompt to start
  if (conversationHistory.length === 0) {
    messages.push({
      role: 'user',
      content: `Please execute your instructions and report your findings.`
    });
  } else {
    // Add a prompt to continue the conversation
    messages.push({
      role: 'user',
      content: `Please continue monitoring and report any new findings.`
    });
  }

  return messages;
};

/**
 * Runs an agent with streaming support.
 * Yields chunks as they come from Claude API.
 * 
 * @param {string} agentId - The ID of the agent to run
 * @param {object} options - Optional parameters
 * @param {function} options.onChunk - Callback for each chunk (chunk) => void
 * @param {function} options.onComplete - Callback when complete (fullContent) => void
 * @returns {Promise<object>} - Returns { agent, conversation, message }
 */
const runAgentStream = async (agentId, options = {}) => {
  if (!agentId) {
    throw new Error('Agent ID is required');
  }

  logger.info({ agentId, options }, '[agent-runner] Starting streaming agent run');

  // Fetch agent
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  // Fetch or create conversation
  let conversation = await Conversation.findByAgentId(agentId);
  if (!conversation) {
    conversation = await Conversation.create({
      userId: agent.userId,
      agentId: agent.id,
      title: agent.name,
      lastMessage: null
    });
    
    await Agent.update(agent.id, { conversationId: conversation.id });
    agent.conversationId = conversation.id;
  }

  // Fetch recent messages for context (last 10)
  const recentMessages = await Message.findByConversationId(conversation.id, 10);

  // Build messages array for Claude
  const messages = buildAgentMessages(agent, recentMessages);

  try {
    // Create a placeholder message that we'll update as we stream
    const message = await Message.create({
      conversationId: conversation.id,
      userId: agent.userId,
      sender: agent.id,
      content: '', // Start empty, will be updated
      type: 'text',
      role: 'assistant',
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        model: options.model || agent.model || null,
        enableWebSearch: agent.enableWebSearch,
        streaming: true
      }
    });

    // Use stream coordinator for tool execution
    const { streamAgentExecution } = require('./agentStreamCoordinator');
    
    await streamAgentExecution(agent, conversation, message, messages, {
      res: options.res,
      onChunk: options.onChunk,
      onStart: options.onStart,
      model: options.model || agent.model || undefined,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens || 2000,
      webSearchMaxUses: options.webSearchMaxUses
    });

    // Reload message to get updated version
    const updatedMessage = await Message.findById(conversation.id, message.id);

    // Update conversation lastMessage and updatedAt
    conversation.lastMessage = updatedMessage.content.substring(0, 200);
    await conversation.save();

    // Call onComplete callback if provided
    if (options.onComplete) {
      options.onComplete(updatedMessage.content);
    }

    logger.info(
      { agentId: agent.id, conversationId: conversation.id, messageId: message.id },
      '[agent-runner] Streaming agent run completed successfully'
    );

    return {
      agent,
      conversation,
      message: updatedMessage
    };
  } catch (error) {
    logger.error(
      { err: error, agentId: agent.id },
      '[agent-runner] Streaming agent run failed'
    );

    // Create error message
    try {
      const errorMessage = await Message.create({
        conversationId: conversation.id,
        userId: agent.userId,
        sender: agent.id,
        content: `Error: ${error.message}`,
        type: 'text',
        role: 'assistant',
        metadata: {
          agentId: agent.id,
          error: true,
          errorMessage: error.message
        }
      });
      
      conversation.lastMessage = `Error: ${error.message}`;
      await conversation.save();
    } catch (msgError) {
      logger.error({ err: msgError }, '[agent-runner] Failed to create error message');
    }

    throw error;
  }
};

module.exports = {
  runAgent,
  runAgentStream
};

