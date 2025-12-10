/**
 * Tool Executor
 *
 * Executes tools and emits SSE events for tool calls and results.
 */

const { handlers: BUILT_IN_TOOL_HANDLERS } = require('../tools');
const { 
  emitToolCall, 
  emitToolResult,
  emitFileReadingStatus 
} = require('./sseManager');

/**
 * Execute a single tool
 * @param {Object} toolBlock - Tool block with name, id, and input
 * @param {Object} handlerContext - Context for the handler
 * @returns {Promise<Object>} - Result with content and isError
 */
async function executeTool(toolBlock, handlerContext = {}) {
  if (!toolBlock || !toolBlock.name) {
    return {
      content: 'Invalid tool block: missing name',
      isError: true
    };
  }

  const handler = BUILT_IN_TOOL_HANDLERS[toolBlock.name];
  if (typeof handler !== 'function') {
    return {
      content: `Tool "${toolBlock.name}" is not implemented.`,
      isError: true
    };
  }

  try {
    console.log('[toolExecutor] Executing tool:', toolBlock.name);
    
    const result = await handler(toolBlock.input || {}, handlerContext);
    
    return {
      content: result?.content ?? '',
      isError: Boolean(result?.isError),
      isAwaitingUser: Boolean(result?.isAwaitingUser),
      metadata: result?.metadata || null
    };
  } catch (error) {
    console.error('[toolExecutor] Tool execution failed', {
      tool: toolBlock.name,
      error: error?.message || error
    });

    return {
      content: `Tool "${toolBlock.name}" failed: ${error.message || 'unknown error'}`,
      isError: true
    };
  }
}

/**
 * Look up document title for read_file tool
 */
async function lookupDocumentTitle(input, handlerContext) {
  try {
    const firebase = require('../../config/firebase');
    const firestore = firebase.firestore;
    const attachmentId = input?.attachmentId;
    const projectId = handlerContext?.project?.id || input?.projectId;
    
    if (projectId) {
      const attachmentsRef = firestore
        .collection('projects')
        .doc(projectId)
        .collection('attachments');
      
      // If we have attachmentId, look up specifically
      if (attachmentId) {
        const querySnapshot = await attachmentsRef.where('id', '==', attachmentId).get();
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          return data.title || data.originalName || 'document';
        }
      }
      
      // No attachmentId - get all PDFs, if only one, use its title
      const allDocs = await attachmentsRef.limit(10).get();
      const pdfs = allDocs.docs
        .map(d => d.data())
        .filter(d => d.mimeType === 'application/pdf');
      
      if (pdfs.length === 1) {
        return pdfs[0].title || pdfs[0].originalName || 'document';
      }
    }
    
    // If query provided, use that as a hint
    if (input?.query) {
      return input.query;
    }
    
    return 'document';
  } catch (e) {
    return 'document';
  }
}

/**
 * Execute multiple tools in parallel with SSE event emission
 * @param {Object} options - Options object
 * @returns {Promise<Array>} - Array of tool result blocks
 */
async function executeToolsInParallel({
  toolUses,
  res,
  handlerContext,
  requestContext
}) {
  const runTool = async (toolBlock) => {
    // Emit tool_call event
    if (res) {
      emitToolCall(res, toolBlock, requestContext);
      
      // Special handling for read_file - look up title and emit file reading status
      if (toolBlock.name === 'read_file') {
        const fileTitle = await lookupDocumentTitle(toolBlock.input, handlerContext);
        emitFileReadingStatus(res, 'reading', { 
          title: fileTitle,
          attachmentId: toolBlock.input?.attachmentId
        });
      }
    }

    // Execute the tool
    const result = await executeTool(toolBlock, {
      ...handlerContext,
      toolCallId: toolBlock.id
    });

    // Emit tool_result event
    if (res) {
      emitToolResult(res, toolBlock, result, requestContext);
      
      // Special handling for read_file - emit completion status
      if (toolBlock.name === 'read_file') {
        try {
          const parsed = JSON.parse(result.content || '{}');
          emitFileReadingStatus(res, result.isError ? 'error' : 'complete', {
            title: parsed.title || 'document',
            attachmentId: parsed.attachmentId,
            pageCount: parsed.pageCount
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // Return Anthropic-format tool result block
    return {
      type: 'tool_result',
      tool_use_id: toolBlock.id,
      content: result.content ?? '',
      is_error: result.isError || undefined
    };
  };

  const results = await Promise.all(toolUses.map(runTool));
  return results.filter(Boolean);
}

module.exports = {
  executeTool,
  executeToolsInParallel
};
