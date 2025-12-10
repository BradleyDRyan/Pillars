/**
 * Context Builder Module
 *
 * Builds system prompts, request context, and pillar context
 * for Claude API requests.
 *
 * Key Responsibilities:
 * - Build comprehensive system prompts (date, tool behavior)
 * - Extract and format pillar context from parameters
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
- Don't say you can't access files - you CAN use tools to read documents in the user's pillars
- If you need to find files in a pillar, use read_file with pillarId parameter
- If the user mentions a specific document, search for it using the query parameter

Be helpful, concise, and use your tools when appropriate.`;

/**
 * Builds a complete system prompt from multiple sources
 *
 * @param {Object} options - Options for building system prompt
 * @param {string} [options.system] - System messages from message history
 * @param {Object} [options.pillarContext] - Pillar context object
 * @param {string} [options.userId] - User ID
 * @returns {Promise<string>} Complete system prompt
 */
async function buildSystemPrompt({
  system = null,
  pillarContext = null,
  userId = null
} = {}) {
  const systemParts = [];

  // 1. Add base system prompt
  systemParts.push(BASE_SYSTEM_PROMPT);

  // 2. Add system messages from conversation
  if (system) {
    systemParts.push(system);
  }

  // 3. Add pillar context if available
  if (pillarContext && pillarContext.id) {
    let pillarContextText = `\nPILLAR CONTEXT:\nYou are assisting with the "${pillarContext.name || 'Untitled Pillar'}" pillar (ID: ${pillarContext.id}).`;
    
    if (pillarContext.description) {
      pillarContextText += `\n\nPillar Description:\n${pillarContext.description}`;
    }
    
    // Add available files
    if (pillarContext.files && pillarContext.files.length > 0) {
      pillarContextText += '\n\nAVAILABLE FILES IN THIS PILLAR:';
      pillarContext.files.forEach(file => {
        const statusIcon = file.hasContent ? '✓' : '⏳';
        pillarContextText += `\n- ${statusIcon} "${file.title}" (ID: ${file.id})`;
      });
      pillarContextText += '\n\nTo read a file, use the read_file tool with the attachmentId shown above.';
    } else {
      pillarContextText += '\n\nNo PDF files have been uploaded to this pillar yet.';
    }
    
    systemParts.push(pillarContextText);
    console.log(`[ContextBuilder] Added pillar context: ${pillarContext.name} (${pillarContext.id}) with ${pillarContext.files?.length || 0} files`);
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
 * Builds pillar context from request parameters
 * Fetches pillar data and available files from Firestore
 *
 * @param {Object} params - Request parameters
 * @param {string} [params.pillarId] - Pillar ID
 * @returns {Promise<Object>} Pillar context object with files
 */
async function buildPillarContext(params = {}) {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const pillarId = params.pillarId || null;
  
  if (!pillarId) {
    return null;
  }

  try {
    // Fetch pillar data from Firestore
    let pillarData = {};
    try {
      const pillarDoc = await firestore.collection('pillars').doc(pillarId).get();
      if (pillarDoc.exists) {
        pillarData = pillarDoc.data();
        console.log(`[ContextBuilder] Found pillar: ${pillarData.name || pillarId}`);
      } else {
        console.log(`[ContextBuilder] Pillar document not found, but will still check attachments: ${pillarId}`);
      }
    } catch (pillarError) {
      console.log(`[ContextBuilder] Could not fetch pillar doc: ${pillarError.message}`);
    }
    
    // Fetch available PDF files in this pillar
    let files = [];
    try {
      console.log(`[ContextBuilder] Fetching attachments from pillars/${pillarId}/attachments`);
      
      const attachmentsSnapshot = await firestore
        .collection('pillars')
        .doc(pillarId)
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
      
      console.log(`[ContextBuilder] Found ${files.length} PDF files in pillar ${pillarId}`);
      if (files.length > 0) {
        console.log(`[ContextBuilder] Files:`, files.map(f => `${f.title} (${f.status})`));
      }
    } catch (fileError) {
      console.error('[ContextBuilder] Error fetching files:', fileError.message, fileError.stack);
    }
    
    return {
      id: pillarId,
      name: pillarData.name || null,
      description: pillarData.description || null,
      color: pillarData.color || null,
      files
    };
  } catch (error) {
    console.error('[ContextBuilder] Error fetching pillar data:', error);
    return {
      id: pillarId,
      name: null,
      description: null,
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
  buildPillarContext,
  buildRequestPayload,
  getCurrentDateContext,
  BASE_SYSTEM_PROMPT
};
