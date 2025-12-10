/**
 * Tool Result Handlers
 *
 * Registry for post-processing tool results.
 * Simplified version - currently no tools need post-processing.
 */

const RESULT_HANDLERS = {};

/**
 * Register a handler for post-processing a tool's results
 * @param {string} toolName - Name of the tool
 * @param {Function} handlerFn - Handler function
 */
function registerResultHandler(toolName, handlerFn) {
  if (typeof toolName !== 'string' || typeof handlerFn !== 'function') {
    throw new Error('registerResultHandler requires a tool name and handler function');
  }

  RESULT_HANDLERS[toolName] = handlerFn;
}

/**
 * Process a tool result through its registered handler (if any)
 * @param {string} toolName - Name of the tool
 * @param {Object} toolBlock - Original tool block
 * @param {Object} result - Tool execution result
 * @param {Object} context - Handler context
 * @returns {Promise<Object>} - Processed result
 */
async function processToolResult(toolName, toolBlock, result, context = {}) {
  const handler = RESULT_HANDLERS[toolName];
  if (!handler) {
    return result;
  }

  try {
    const updated = await handler(toolBlock, result, context);
    return updated || result;
  } catch (error) {
    console.error('[toolResultHandlers] Failed to process tool result', {
      tool: toolName,
      error: error?.message || error
    });
    return result;
  }
}

// No result handlers registered for read_file tool
// The tool returns data directly without post-processing

module.exports = {
  registerResultHandler,
  processToolResult
};
