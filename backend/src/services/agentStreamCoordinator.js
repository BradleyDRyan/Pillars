/**
 * Agent Stream Coordinator
 * Coordinates streaming agent execution with tool handling
 * Based on imagine project's streamCoordinator pattern
 */

const { logger } = require('../config/firebase');
const { chatCompletionStream } = require('./anthropic');
const { executeToolsInParallel } = require('../llm/claude/toolExecutor');
const { emitTextDelta, emitFinal, emitError, emitEndOfStream } = require('./sseManager');
const { convertClaudeContentToBlocks } = require('../utils/blockConverter');
const { definitions: toolDefinitions } = require('../llm/tools');
const Message = require('../models/Message');

const MAX_TOOL_ITERATIONS = 10;
const MAX_PARALLEL_TOOLS = 5; // Limit concurrent tool executions

/**
 * Builds tool definitions from agent's allowedTools
 */
function buildToolDefinitionsFromAgent(agent) {
  const tools = [];
  
  // Add web_search if enabled (Anthropic native tool)
  if (agent.enableWebSearch) {
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 10
    });
  }
  
  // Add custom tools from allowedTools
  if (Array.isArray(agent.allowedTools) && agent.allowedTools.length > 0) {
    const toolMap = new Map(toolDefinitions.map(t => [t.name, t]));
    
    agent.allowedTools.forEach(toolName => {
      if (toolName === 'web_search') {
        // Already added above if enableWebSearch is true
        return;
      }
      
      const toolDef = toolMap.get(toolName);
      if (toolDef) {
        // Convert tool definition to Anthropic format
        // Anthropic expects: { name, description, input_schema: { type: 'object', properties: {...}, required: [...] } }
        const inputSchema = toolDef.input_schema || {};
        tools.push({
          name: toolDef.name,
          description: toolDef.description || '',
          input_schema: {
            type: 'object',
            properties: inputSchema.properties || {},
            required: inputSchema.required || []
          }
        });
      }
    });
  }
  
  return { tools };
}

/**
 * Streams agent execution with tool handling
 */
async function streamAgentExecution(agent, conversation, message, messages, options = {}) {
  const res = options.res;
  const onChunk = options.onChunk;
  const onStart = options.onStart;
  
  if (!res) {
    throw new Error('Response object (res) is required for streaming');
  }

  // Build tool config from agent
  const toolConfig = buildToolDefinitionsFromAgent(agent);
  
  // Build conversation history
  const chatMessages = [...messages];
  let accumulatedText = '';
  let allBlocks = [];

  // Call onStart callback
  if (onStart) {
    onStart({
      messageId: message.id,
      agent,
      conversation
    });
  }

  try {
    // Main streaming loop (tool execution cycle)
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Stream from Claude API
      const stream = chatCompletionStream(chatMessages, {
        model: options.model || agent.model || undefined,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens || 2000,
        useWebSearch: agent.enableWebSearch,
        webSearchMaxUses: options.webSearchMaxUses,
        includeFinalMessage: true,
        tools: toolConfig.tools || [] // Pass tools array to buildToolConfig
      });

      let finalClaudeMessage = null;
      let toolUseBlocksFromStream = [];
      let iterationText = '';

      // Process stream chunks
      for await (const chunk of stream) {
        // Check if this is the final message metadata
        if (chunk && typeof chunk === 'object' && chunk.__finalMessage) {
          finalClaudeMessage = chunk.__finalMessage;
          toolUseBlocksFromStream = chunk.__toolUseBlocks || [];
          continue;
        }
        
        // Regular text chunk
        if (typeof chunk === 'string') {
          iterationText += chunk;
          accumulatedText += chunk;
          
          // Emit text delta via SSE
          emitTextDelta(res, chunk, {
            messageId: message.id,
            agentId: agent.id
          });
          
          // Call onChunk callback if provided
          if (onChunk) {
            onChunk(chunk);
          }
          
          // Update message content incrementally
          await Message.collection(conversation.id).doc(message.id).update({
            content: accumulatedText
          });
        }
      }

      // Get final message if not already captured
      if (!finalClaudeMessage && stream.finalMessage) {
        try {
          finalClaudeMessage = await stream.finalMessage();
        } catch (error) {
          logger.debug({ err: error }, '[agent-stream-coordinator] Unable to fetch final stream message');
        }
      }

      // Extract tool uses from final message
      const toolUses = [];
      if (finalClaudeMessage && Array.isArray(finalClaudeMessage.content)) {
        toolUses.push(...finalClaudeMessage.content.filter(block => block.type === 'tool_use'));
      }

      // Convert content to blocks
      if (finalClaudeMessage && finalClaudeMessage.content) {
        const iterationBlocks = convertClaudeContentToBlocks(finalClaudeMessage.content);
        allBlocks.push(...iterationBlocks);
      }

      // Add assistant message to conversation history
      if (finalClaudeMessage && finalClaudeMessage.content) {
        chatMessages.push({
          role: 'assistant',
          content: finalClaudeMessage.content
        });
      }

      // Check if streaming is complete (no tool uses)
      if (toolUses.length === 0) {
        break; // Exit streaming loop
      }

            // Limit the number of tools executed in parallel
            // Enforce strict limits: max 5 tools per iteration, with special handling for Amazon searches
            const amazonSearches = toolUses.filter(t => t.name === 'search_amazon');
            const maxAmazonSearches = 2; // Strict limit for Amazon searches
            
            if (amazonSearches.length > maxAmazonSearches) {
              logger.warn(
                { 
                  agentId: agent.id, 
                  amazonSearchCount: amazonSearches.length, 
                  maxAllowed: maxAmazonSearches 
                },
                '[agent-stream-coordinator] Too many Amazon searches, limiting to 2'
              );
              
              // Keep only the first 2 Amazon searches, remove the rest
              let amazonCount = 0;
              toolUses = toolUses.filter(t => {
                if (t.name === 'search_amazon') {
                  amazonCount++;
                  return amazonCount <= maxAmazonSearches;
                }
                return true;
              });
            }
            
            // Overall limit: max 5 tools per iteration
            if (toolUses.length > MAX_PARALLEL_TOOLS) {
              logger.warn(
                { 
                  agentId: agent.id, 
                  toolCount: toolUses.length, 
                  maxParallel: MAX_PARALLEL_TOOLS 
                },
                '[agent-stream-coordinator] Too many tool calls, limiting to 5'
              );
              toolUses = toolUses.slice(0, MAX_PARALLEL_TOOLS);
            }

      // Execute tools in batches to avoid overwhelming the system
      const toolBatches = [];
      for (let i = 0; i < toolUses.length; i += MAX_PARALLEL_TOOLS) {
        toolBatches.push(toolUses.slice(i, i + MAX_PARALLEL_TOOLS));
      }

      const allToolResults = [];
      for (const batch of toolBatches) {
        const batchResults = await executeToolsInParallel({
          toolUses: batch,
          res,
          handlerContext: {
            conversationId: conversation.id,
            userId: agent.userId,
            agentId: agent.id
          },
          requestContext: {
            messageId: message.id,
            agentId: agent.id
          }
        });
        allToolResults.push(...batchResults);
      }

      const toolResultsContent = allToolResults;

      // Add tool results to conversation history
      chatMessages.push({
        role: 'user',
        content: toolResultsContent
      });

      // Continue loop (Claude will process tool results and respond)
    }

    // Finalize message with all blocks
    const finalContent = accumulatedText.trim();
    
    // If no blocks but we have text, create a text block
    if (allBlocks.length === 0 && finalContent) {
      allBlocks = [{
        type: 'text',
        data: { text: finalContent },
        metadata: { sequence: 0 },
        key: 'text-0'
      }];
    }
    
    await Message.collection(conversation.id).doc(message.id).update({
      content: finalContent,
      blocks: allBlocks.length > 0 ? allBlocks : null,
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        model: options.model || agent.model || null,
        enableWebSearch: agent.enableWebSearch,
        streaming: false
      }
    });

    // Emit final completion event
    emitFinal(res, finalContent, {
      messageId: message.id,
      agentId: agent.id
    });

    return {
      content: finalContent,
      blocks: allBlocks
    };
  } catch (error) {
    logger.error({ err: error, agentId: agent.id }, '[agent-stream-coordinator] Streaming failed');
    
    emitError(res, error, {
      messageId: message.id,
      agentId: agent.id
    });
    
    throw error;
  }
}

module.exports = {
  streamAgentExecution,
  buildToolDefinitionsFromAgent
};

