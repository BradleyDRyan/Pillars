/**
 * SSE Manager for Agent Streaming
 * Handles Server-Sent Events for tool calls and results
 */

const { logger } = require('../config/firebase');

/**
 * Sets up SSE headers
 */
function setSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders?.();
}

/**
 * Sends an SSE event
 */
function sendSSE(res, data) {
  if (!res || res.destroyed) {
    return;
  }
  
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    logger.debug({ err: error }, '[sse-manager] Failed to send SSE event');
  }
}

/**
 * Emits a text delta event
 */
function emitTextDelta(res, text, context = {}) {
  sendSSE(res, {
    type: 'text',
    content: text,
    ...context
  });
}

/**
 * Emits a tool call event
 */
function emitToolCall(res, toolBlock, context = {}) {
  sendSSE(res, {
    type: 'tool_call',
    data: {
      id: toolBlock.id,
      name: toolBlock.name,
      input: toolBlock.input || {}
    },
    metadata: {
      status: 'tool_call',
      ...context
    }
  });
}

/**
 * Emits a tool result event
 */
function emitToolResult(res, toolBlock, result, context = {}) {
  sendSSE(res, {
    type: 'tool_result',
    data: {
      id: toolBlock.id,
      name: toolBlock.name,
      content: result.content || '',
      isError: result.isError || false
    },
    metadata: {
      status: result.isError ? 'tool_error' : 'tool_result',
      ...context
    }
  });
}

/**
 * Emits final completion event
 */
function emitFinal(res, content, context = {}) {
  sendSSE(res, {
    type: 'complete',
    content,
    ...context
  });
}

/**
 * Emits error event
 */
function emitError(res, error, context = {}) {
  sendSSE(res, {
    type: 'error',
    error: error.message || String(error),
    ...context
  });
}

/**
 * Ends the SSE stream
 */
function emitEndOfStream(res) {
  try {
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.debug({ err: error }, '[sse-manager] Failed to end SSE stream');
  }
}

module.exports = {
  setSSEHeaders,
  sendSSE,
  emitTextDelta,
  emitToolCall,
  emitToolResult,
  emitFinal,
  emitError,
  emitEndOfStream
};


