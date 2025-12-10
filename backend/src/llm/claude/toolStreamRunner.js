/**
 * Claude Tool Stream Runner
 *
 * Main streaming loop for Claude API with tool execution support.
 * Handles the iterative process of streaming responses and executing tools.
 */

const {
  ensureConfigured,
  getClient,
  transformMessages
} = require('../../services/anthropic');
const { executeToolsInParallel } = require('./toolExecutor');
const { buildToolDefinitions, filterToolsByContext } = require('./toolOrchestrator');
const { buildSystemPrompt, buildProjectContext } = require('./contextBuilder');
const {
  setSSEHeaders,
  emitTextDelta,
  emitError,
  emitFinal,
  emitEndOfStream
} = require('./sseManager');

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
const MAX_TOOL_ITERATIONS = 4;

/**
 * Stream a single Claude response iteration
 */
async function streamSingleResponse({ client, payload, res, requestContext }) {
  const stream = await client.messages.stream(payload);
  let finalMessage = null;
  let accumulatedText = '';

  try {
    for await (const event of stream) {
      // Handle text deltas
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text;
        if (text) {
          accumulatedText += text;
          emitTextDelta(res, text, requestContext);
        }
      }
    }
  } finally {
    try {
      finalMessage = await stream.finalMessage();
    } catch (error) {
      console.error('[toolStreamRunner] Failed to fetch final message', error);
    }
  }

  return { finalMessage, accumulatedText };
}

/**
 * Main streaming function with tool execution loop
 *
 * @param {Object} options - Streaming options
 * @param {Array} options.messages - Conversation messages
 * @param {Array} options.customTools - Optional custom tools
 * @param {Object} options.requestContext - Request context (conversationId, userId, projectId, etc.)
 * @param {Object} options.handlerContext - Context for tool handlers
 * @param {Object} options.res - Express response object
 * @param {string} options.model - Claude model to use
 * @param {number} options.temperature - Temperature setting
 * @param {number} options.maxTokens - Max tokens for response
 */
async function runClaudeToolStream({
  messages,
  customTools,
  requestContext = {},
  handlerContext = {},
  res,
  model,
  temperature,
  maxTokens
}) {
  // Set SSE headers
  setSSEHeaders(res);
  
  // Send initial connected event
  res.write('data: {"type":"connected"}\n\n');

  try {
    ensureConfigured();
    const client = getClient();

    // Build tool definitions
    const definitions = filterToolsByContext(
      buildToolDefinitions(customTools),
      null
    );

    // Build project context from request
    const projectContext = await buildProjectContext({
      projectId: requestContext?.projectId
    });

    // Transform messages (extract system messages)
    const { systemPrompt: baseSystemPrompt, transformed: baseTransformed } = transformMessages(messages);

    // Build complete system prompt with context
    const fullSystemPrompt = await buildSystemPrompt({
      system: baseSystemPrompt,
      projectContext,
      userId: requestContext?.userId
    });

    const convo = [...baseTransformed];
    let fullAccumulatedText = '';

    console.log(`[toolStreamRunner] Project context:`, projectContext?.id || 'none');
    console.log(`[toolStreamRunner] Tools count:`, definitions.length);
    console.log(`[toolStreamRunner] Tools available:`, JSON.stringify(definitions.map(d => ({ name: d.name, hasSchema: !!d.input_schema }))));
    console.log(`[toolStreamRunner] System prompt length:`, fullSystemPrompt?.length || 0);
    console.log(`[toolStreamRunner] System prompt preview:`, fullSystemPrompt?.substring(0, 500));

    // Main streaming loop (iterates when tools are called)
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      console.log(`[toolStreamRunner] Iteration ${iteration + 1}, messages: ${convo.length}`);

      const { finalMessage, accumulatedText } = await streamSingleResponse({
        client,
        res,
        requestContext,
        payload: {
          model: model || DEFAULT_MODEL,
          system: fullSystemPrompt,
          messages: convo,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens || 2048,
          tools: definitions.length > 0 ? definitions : undefined,
          tool_choice: definitions.length > 0 ? { type: 'auto' } : undefined
        }
      });

      fullAccumulatedText += accumulatedText;

      if (!finalMessage) {
        emitError(res, 'Claude returned no message', requestContext, 'NO_RESPONSE');
        break;
      }

      // Add assistant response to conversation
      convo.push({
        role: finalMessage.role || 'assistant',
        content: finalMessage.content
      });

      // Check for tool uses
      const toolUses = finalMessage.content.filter((block) => block.type === 'tool_use');
      
      if (!toolUses || toolUses.length === 0) {
        // No tools called - streaming complete
        break;
      }

      console.log(`[toolStreamRunner] Executing ${toolUses.length} tool(s):`, 
        toolUses.map(t => t.name).join(', '));

      // Execute tools in parallel
      const toolResults = await executeToolsInParallel({
        toolUses,
        res,
        handlerContext: {
          ...handlerContext,
          conversationId: requestContext?.conversationId,
          userId: requestContext?.userId,
          // Pass project context to tools
          project: projectContext ? { id: projectContext.id } : handlerContext?.project
        },
        requestContext
      });

      if (!toolResults || toolResults.length === 0) {
        break;
      }

      // Add tool results to conversation for next iteration
      convo.push({
        role: 'user',
        content: toolResults
      });

      // Continue loop - Claude will process tool results
    }

    // Emit final complete message
    emitFinal(res, fullAccumulatedText, requestContext);

  } catch (error) {
    console.error('[toolStreamRunner] Stream error:', error);
    emitError(res, error.message || 'Streaming failed', requestContext, 'STREAM_ERROR');
  } finally {
    // Always end the stream
    emitEndOfStream(res);
    res.end();
  }
}

module.exports = {
  runClaudeToolStream
};
