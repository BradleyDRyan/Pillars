/**
 * SSE (Server-Sent Events) Manager
 *
 * Standardizes all Server-Sent Events emissions with consistent formatting,
 * metadata, and timestamps. Matches Anthropic Claude's block-based streaming.
 *
 * Event Types:
 * - text: Streaming text deltas
 * - tool_call: Claude is calling a tool
 * - tool_result: Tool execution completed
 * - ui_component: Render special UI (file reading status, etc.)
 * - final: Complete accumulated response
 * - end_of_stream: Connection closing
 * - error: Error messages
 */

/**
 * Sends a Server-Sent Event with proper formatting
 * @param {Object} res - Express response object
 * @param {Object} payload - Event payload to send
 */
function sendSSE(res, payload) {
  if (!res || res.writableEnded) {
    return;
  }

  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (error) {
    console.error('[sseManager] Failed to serialize SSE event', error);
  }
}

/**
 * Builds standard metadata object for SSE events
 * @param {Object} options - Metadata options
 * @returns {Object} Metadata object with timestamp
 */
function buildMetadata({
  status,
  model = null,
  conversationId = null,
  userId = null,
  source = null,
  ...extra
}) {
  return {
    status,
    ...(model && { model }),
    ...(conversationId && { conversationId }),
    ...(userId && { userId }),
    ...(source && { source }),
    ...extra,
    timestamp: new Date().toISOString()
  };
}

/**
 * Sets standard SSE headers on response
 * @param {Object} res - Express response object
 */
function setSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
}

/**
 * Emits a text delta event (streaming text from Claude)
 * @param {Object} res - Express response object
 * @param {string} text - Text content to stream
 * @param {Object} context - Request context (model, conversationId, userId)
 */
function emitTextDelta(res, text, context = {}) {
  if (!text || typeof text !== 'string') {
    return;
  }

  sendSSE(res, {
    type: 'text',
    data: text,
    metadata: buildMetadata({
      status: 'streaming',
      ...context
    })
  });
}

/**
 * Emits a tool call event (Claude is calling a tool)
 * @param {Object} res - Express response object
 * @param {Object} toolBlock - Tool block from Claude response
 * @param {Object} context - Request context
 */
function emitToolCall(res, toolBlock, context = {}) {
  sendSSE(res, {
    type: 'tool_call',
    data: {
      id: toolBlock.id,
      name: toolBlock.name,
      input: toolBlock.input
    },
    metadata: buildMetadata({
      status: 'tool_call',
      source: toolBlock.name,
      ...context
    })
  });
}

/**
 * Emits a tool result event (tool execution completed)
 * @param {Object} res - Express response object
 * @param {Object} toolBlock - Original tool block
 * @param {Object} result - Tool execution result
 * @param {Object} context - Request context
 */
function emitToolResult(res, toolBlock, result, context = {}) {
  sendSSE(res, {
    type: 'tool_result',
    data: {
      id: toolBlock.id,
      name: toolBlock.name,
      content: result.content,
      isError: result.isError || false
    },
    metadata: buildMetadata({
      status: result.isError ? 'tool_error' : 'tool_result',
      source: toolBlock.name,
      ...context
    })
  });
}

/**
 * Emits a UI component event (renders special UI in frontend)
 * @param {Object} res - Express response object
 * @param {Object} componentData - Component configuration
 * @param {Object} options - Additional options
 */
function emitUIComponent(res, componentData, { source = null, context = {} } = {}) {
  sendSSE(res, {
    type: 'ui_component',
    data: componentData,
    metadata: buildMetadata({
      status: 'complete',
      componentReady: true,
      source,
      ...context
    })
  });
}

/**
 * Emits an error event
 * @param {Object} res - Express response object
 * @param {string|Error} error - Error message or Error object
 * @param {Object} context - Request context
 * @param {string} code - Error code
 */
function emitError(res, error, context = {}, code = null) {
  const message = error?.message || String(error);

  sendSSE(res, {
    type: 'error',
    data: {
      message,
      ...(code && { code })
    },
    metadata: buildMetadata({
      status: 'error',
      ...context
    })
  });
}

/**
 * Emits a final message event (end of assistant response)
 * @param {Object} res - Express response object
 * @param {string} fullText - Complete accumulated text
 * @param {Object} context - Request context
 */
function emitFinal(res, fullText, context = {}) {
  sendSSE(res, {
    type: 'final',
    data: fullText,
    metadata: buildMetadata({
      status: 'complete',
      ...context
    })
  });
}

/**
 * Emits end of stream event (closes SSE connection)
 * @param {Object} res - Express response object
 */
function emitEndOfStream(res) {
  sendSSE(res, {
    type: 'end_of_stream',
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Emits file reading status (for read_file tool)
 * @param {Object} res - Express response object
 * @param {string} status - Status: 'reading', 'complete', 'error'
 * @param {Object} fileInfo - File information
 */
function emitFileReadingStatus(res, status, fileInfo = {}) {
  sendSSE(res, {
    type: 'file_reading',
    data: {
      status,
      title: fileInfo.title || 'Document',
      attachmentId: fileInfo.attachmentId || null,
      pageCount: fileInfo.pageCount || null,
      message: status === 'reading' 
        ? `Reading "${fileInfo.title || 'document'}"...`
        : status === 'complete'
          ? `Read "${fileInfo.title || 'document'}"`
          : `Failed to read "${fileInfo.title || 'document'}"`
    },
    metadata: buildMetadata({
      status,
      source: 'read_file'
    })
  });
}

// Legacy compatibility - map old function names
const emitModelEvent = (res, event) => sendSSE(res, event);

module.exports = {
  // Core functions
  sendSSE,
  buildMetadata,
  setSSEHeaders,

  // Event emitters
  emitTextDelta,
  emitToolCall,
  emitToolResult,
  emitUIComponent,
  emitError,
  emitFinal,
  emitEndOfStream,
  emitFileReadingStatus,

  // Legacy compatibility
  emitModelEvent
};
