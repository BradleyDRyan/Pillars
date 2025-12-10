/**
 * Context Builder Module
 *
 * Builds system prompts, request context, and project context
 * for Claude API requests.
 *
 * Key Responsibilities:
 * - Build comprehensive system prompts (date, tool behavior)
 * - Extract and format project context from parameters
 * - Combine multiple system prompt sources
 */

const { behaviorPrompt: TOOL_BEHAVIOR_PROMPT } = require('../tools');
const { firestore } = require('../../config/firebase');

/**
 * Gets the current date context for Claude
 */
function getCurrentDateContext() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  return `Current date and time: ${now.toLocaleDateString('en-US', options)}`;
}

/**
 * Base system prompt that defines Claude's capabilities
 */
const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to tools that allow you to read and analyze documents.

IMPORTANT - Tool Usage:
- You HAVE tools available to help users
- When a user asks about documents, files, or PDFs, use the read_file tool
- Don't say you can't access files - you CAN use tools to read documents in the user's projects
- If you need to find files in a project, use read_file with projectId parameter
- If the user mentions a specific document, search for it using the query parameter

Be helpful, concise, and use your tools when appropriate.`;

/**
 * Builds a complete system prompt from multiple sources
 *
 * @param {Object} options - Options for building system prompt
 * @param {string} [options.system] - System messages from message history
 * @param {Object} [options.projectContext] - Project context object
 * @param {string} [options.userId] - User ID
 * @returns {Promise<string>} Complete system prompt
 */
async function buildSystemPrompt({
  system = null,
  projectContext = null,
  userId = null
} = {}) {
  const systemParts = [];

  // 1. Add base system prompt
  systemParts.push(BASE_SYSTEM_PROMPT);

  // 2. Add system messages from conversation
  if (system) {
    systemParts.push(system);
  }

  // 3. Add project context if available
  if (projectContext && projectContext.id) {
    let projectContextText = `\nPROJECT CONTEXT:\nYou are assisting with the "${projectContext.title || 'Untitled Project'}" project (ID: ${projectContext.id}).`;
    
    if (projectContext.instructions) {
      projectContextText += `\n\nProject Instructions:\n${projectContext.instructions}`;
    }
    
    // Add available files
    if (projectContext.files && projectContext.files.length > 0) {
      projectContextText += '\n\nAVAILABLE FILES IN THIS PROJECT:';
      projectContext.files.forEach(file => {
        const statusIcon = file.hasContent ? '✓' : '⏳';
        projectContextText += `\n- ${statusIcon} "${file.title}" (ID: ${file.id})`;
      });
      projectContextText += '\n\nTo read a file, use the read_file tool with the attachmentId shown above.';
    } else {
      projectContextText += '\n\nNo PDF files have been uploaded to this project yet.';
    }
    
    systemParts.push(projectContextText);
    console.log(`[ContextBuilder] Added project context: ${projectContext.title} (${projectContext.id}) with ${projectContext.files?.length || 0} files`);
  }

  // 4. Add current date context
  systemParts.push(getCurrentDateContext());

  // 5. Add tool behavior prompts
  if (TOOL_BEHAVIOR_PROMPT) {
    systemParts.push(`\nTOOL USAGE INSTRUCTIONS:\n${TOOL_BEHAVIOR_PROMPT}`);
  }

  // Combine all parts
  return systemParts.filter(Boolean).join('\n\n');
}

/**
 * Builds project context from request parameters
 * Fetches project data and available files from Firestore
 *
 * @param {Object} params - Request parameters
 * @param {string} [params.projectId] - Project ID
 * @returns {Promise<Object>} Project context object with files
 */
async function buildProjectContext(params = {}) {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const projectId = params.projectId || null;
  
  if (!projectId) {
    return null;
  }

  try {
    // Fetch project data from Firestore (optional - might not exist)
    let projectData = {};
    try {
      const projectDoc = await firestore.collection('projects').doc(projectId).get();
      if (projectDoc.exists) {
        projectData = projectDoc.data();
        console.log(`[ContextBuilder] Found project: ${projectData.name || projectData.title || projectId}`);
      } else {
        console.log(`[ContextBuilder] Project document not found, but will still check attachments: ${projectId}`);
      }
    } catch (projError) {
      console.log(`[ContextBuilder] Could not fetch project doc: ${projError.message}`);
    }
    
    // Fetch available PDF files in this project
    // Try simple query first (no compound index needed)
    let files = [];
    try {
      console.log(`[ContextBuilder] Fetching attachments from projects/${projectId}/attachments`);
      
      const attachmentsSnapshot = await firestore
        .collection('projects')
        .doc(projectId)
        .collection('attachments')
        .limit(20)
        .get();
      
      console.log(`[ContextBuilder] Raw attachment count: ${attachmentsSnapshot.docs.length}`);
      
      // Filter PDFs in memory
      files = attachmentsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: data.id || doc.id,
            title: data.title || data.originalName || 'Untitled',
            mimeType: data.mimeType,
            status: data.ocrStatus || 'unknown',
            hasContent: data.ocrStatus === 'completed'
          };
        })
        .filter(f => f.mimeType === 'application/pdf');
      
      console.log(`[ContextBuilder] Found ${files.length} PDF files in project ${projectId}`);
      if (files.length > 0) {
        console.log(`[ContextBuilder] Files:`, files.map(f => `${f.title} (${f.status})`));
      }
    } catch (fileError) {
      console.error('[ContextBuilder] Error fetching files:', fileError.message, fileError.stack);
    }
    
    return {
      id: projectId,
      title: projectData.title || projectData.name || null,
      instructions: projectData.instructions || null,
      description: projectData.description || null,
      files
    };
  } catch (error) {
    console.error('[ContextBuilder] Error fetching project data:', error);
    return {
      id: projectId,
      title: null,
      instructions: null,
      files: []
    };
  }
}

/**
 * Builds the complete request payload for Anthropic API
 *
 * @param {Object} options - Payload options
 * @param {string} options.model - Model ID
 * @param {number} options.maxTokens - Maximum tokens
 * @param {Array} options.messages - Conversation messages
 * @param {Array} options.tools - Tool definitions
 * @param {string} options.systemPrompt - Complete system prompt
 * @param {number} [options.temperature] - Temperature setting
 * @returns {Object} Request payload for Anthropic API
 */
function buildRequestPayload({
  model,
  maxTokens,
  messages,
  tools,
  systemPrompt,
  temperature = 0.7
}) {
  const payload = {
    model,
    max_tokens: maxTokens,
    messages,
    system: systemPrompt,
    temperature
  };

  // Only add tools if there are any
  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = { type: 'auto' };
  }

  return payload;
}

module.exports = {
  buildSystemPrompt,
  buildProjectContext,
  buildRequestPayload,
  getCurrentDateContext,
  BASE_SYSTEM_PROMPT
};
