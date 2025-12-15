/**
 * Admin SSE Manager - Manages SSE streaming with block sequencing
 * 
 * Modeled after imagine repo's sseManager.js and BlockStreamBuilder.
 * Key feature: Each block has a sequence number for correct inline rendering.
 */

const { logger } = require('../config/firebase');

/**
 * Creates a new block stream context for a request
 * Tracks sequence numbers and group IDs for tool call linking
 */
function createBlockStreamContext() {
  return {
    sequenceCounter: 0,
    groupCounter: 0,
    currentGroupId: null
  };
}

/**
 * Sets up SSE headers for streaming
 */
function setSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/**
 * Sends a raw SSE event
 */
function sendSSE(res, data) {
  if (!res || res.destroyed) {
    return false;
  }
  
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch (error) {
    logger.debug({ err: error }, '[admin-sse] Failed to send SSE event');
    return false;
  }
}

/**
 * Emits a text block with sequence
 */
function emitText(res, ctx, text, options = {}) {
  const sequence = ctx.sequenceCounter++;
  
  return sendSSE(res, {
    type: 'text',
    data: { text },
    metadata: {
      sequence,
      status: options.status || 'streaming',
      timestamp: new Date().toISOString(),
      ...options.metadata
    }
  });
}

/**
 * Emits a tool_use block (tool call starting)
 */
function emitToolStart(res, ctx, toolData) {
  const sequence = ctx.sequenceCounter++;
  ctx.groupCounter++;
  ctx.currentGroupId = `tool-group-${ctx.groupCounter}`;
  
  return sendSSE(res, {
    type: 'tool_use',
    data: {
      id: toolData.id,
      name: toolData.name,
      input: toolData.input || {}
    },
    metadata: {
      sequence,
      status: 'tool_call',
      groupId: ctx.currentGroupId,
      groupIndex: ctx.groupCounter,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits a tool_result block
 */
function emitToolResult(res, ctx, toolData, result, isError = false) {
  const sequence = ctx.sequenceCounter++;
  
  return sendSSE(res, {
    type: 'tool_result',
    data: {
      id: toolData.id,
      name: toolData.name,
      content: result,
      isError
    },
    metadata: {
      sequence,
      status: isError ? 'error' : 'complete',
      groupId: ctx.currentGroupId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits agent start event (when an agent begins responding)
 */
function emitAgentStart(res, ctx, agentData) {
  return sendSSE(res, {
    type: 'agent_start',
    data: {
      agentId: agentData.id,
      agentHandle: agentData.handle,
      agentName: agentData.name
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits agent end event
 */
function emitAgentEnd(res, ctx, agentData) {
  return sendSSE(res, {
    type: 'agent_end',
    data: {
      agentId: agentData.id,
      agentHandle: agentData.handle
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits message saved event
 */
function emitMessageSaved(res, messageData) {
  return sendSSE(res, {
    type: 'message_saved',
    data: {
      messageId: messageData.id,
      conversationId: messageData.conversationId
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits error event
 */
function emitError(res, error) {
  return sendSSE(res, {
    type: 'error',
    data: {
      message: error.message || String(error)
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits done event and ends stream
 */
function emitDone(res) {
  sendSSE(res, {
    type: 'done',
    data: {},
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
  
  try {
    res.end();
  } catch (error) {
    logger.debug({ err: error }, '[admin-sse] Failed to end stream');
  }
}

/**
 * Builds the contents array from accumulated blocks
 * This is what gets saved to the message
 */
function buildContentsFromBlocks(blocks) {
  return blocks.map((block, index) => ({
    type: block.type,
    data: block.data,
    metadata: {
      ...block.metadata,
      sequence: block.metadata?.sequence ?? index
    }
  }));
}

module.exports = {
  createBlockStreamContext,
  setSSEHeaders,
  sendSSE,
  emitText,
  emitToolStart,
  emitToolResult,
  emitAgentStart,
  emitAgentEnd,
  emitMessageSaved,
  emitError,
  emitDone,
  buildContentsFromBlocks
};



