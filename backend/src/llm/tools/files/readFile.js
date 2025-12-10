/**
 * Read File Tool
 * 
 * Reads PDF documents that have been uploaded to a pillar.
 * Can read a specific attachment by ID, or search for files in a pillar.
 */

const definition = {
  name: 'read_file',
  description: [
    'Reads PDF documents that have been uploaded to a pillar.',
    'Can read a specific attachment by ID, or search for files in a pillar.',
    'Returns the extracted text content from the document.'
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      attachmentId: {
        type: 'string',
        description: 'ID of a specific attachment to read. Use this if the user referenced a specific file.'
      },
      pillarId: {
        type: 'string',
        description: 'Pillar ID to search for files. Required if searching by query.'
      },
      query: {
        type: 'string',
        description: 'Optional search query to find relevant files by name or content in the pillar.'
      }
    }
  }
};

const behaviorPrompt = [
  'Use `read_file` when the user asks about documents, PDFs, or uploaded files.',
  'If you know the specific attachmentId, provide it directly.',
  'If searching a pillar, provide the pillarId and optionally a query to filter results.',
  'After reading, summarize the key points from the document for the user.'
].join(' ');

/**
 * Get Firebase instances (lazy load to avoid initialization issues)
 */
function getFirebase() {
  const firebase = require('../../../config/firebase');
  return {
    firestore: firebase.firestore,
    logger: firebase.logger
  };
}

/**
 * Get a specific attachment by ID
 */
async function getAttachmentById(attachmentId, pillarId = null) {
  const { firestore, logger } = getFirebase();
  
  logger.info({ attachmentId, pillarId }, '[readFile] Looking up attachment by ID');

  // If pillarId provided, search in that pillar first
  if (pillarId) {
    const attachmentRef = firestore
      .collection('pillars')
      .doc(pillarId)
      .collection('attachments');
    
    const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
    
    if (!querySnapshot.empty) {
      return {
        pillarId,
        ...querySnapshot.docs[0].data()
      };
    }
  }

  // Search across all pillars
  const pillarsRef = firestore.collection('pillars');
  const pillarsSnapshot = await pillarsRef.get();

  for (const pillarDoc of pillarsSnapshot.docs) {
    const attachmentsRef = pillarDoc.ref.collection('attachments');
    const querySnapshot = await attachmentsRef.where('id', '==', attachmentId).get();

    if (!querySnapshot.empty) {
      return {
        pillarId: pillarDoc.id,
        ...querySnapshot.docs[0].data()
      };
    }
  }

  return null;
}

/**
 * Search for files in a pillar
 */
async function searchFilesInPillar(pillarId, query = null) {
  const { firestore, logger } = getFirebase();
  
  logger.info({ pillarId, query }, '[readFile] Searching files in pillar');

  const attachmentsRef = firestore
    .collection('pillars')
    .doc(pillarId)
    .collection('attachments');

  // Get attachments (simple query, filter in memory to avoid index issues)
  console.log(`[readFile] Fetching attachments from pillars/${pillarId}/attachments`);
  const snapshot = await attachmentsRef.limit(50).get();
  
  console.log(`[readFile] Raw attachment count: ${snapshot.docs.length}`);

  // Filter PDFs in memory
  let attachments = snapshot.docs
    .map(doc => ({
      pillarId,
      ...doc.data()
    }))
    .filter(att => att.mimeType === 'application/pdf');
  
  console.log(`[readFile] Found ${attachments.length} PDFs`);

  // Filter by query if provided (simple title/content matching)
  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase();
    attachments = attachments.filter(att => {
      const titleMatch = att.title?.toLowerCase().includes(lowerQuery);
      const contentMatch = att.ocrContent?.toLowerCase().includes(lowerQuery);
      return titleMatch || contentMatch;
    });
  }

  return attachments;
}

/**
 * Format attachment for response
 */
function formatAttachmentResponse(attachment) {
  if (!attachment) {
    return null;
  }

  const hasOcrContent = attachment.ocrStatus === 'completed' && attachment.ocrContent;

  return {
    attachmentId: attachment.id,
    pillarId: attachment.pillarId,
    title: attachment.title || attachment.originalName || 'Untitled',
    mimeType: attachment.mimeType,
    status: attachment.ocrStatus || 'unknown',
    pageCount: attachment.ocrMetadata?.pageCount || null,
    content: hasOcrContent ? attachment.ocrContent : null,
    contentPreview: hasOcrContent 
      ? attachment.ocrContent.substring(0, 500) + (attachment.ocrContent.length > 500 ? '...' : '')
      : null,
    error: attachment.ocrStatus === 'failed' 
      ? (attachment.ocrMetadata?.error || 'OCR processing failed')
      : null
  };
}

const handler = async (input = {}, handlerContext = {}) => {
  const { attachmentId, pillarId, query } = input;
  const contextPillarId = handlerContext?.pillar?.id || pillarId;

  console.log('[readFile] Handler called', { attachmentId, pillarId: contextPillarId, query });

  try {
    // Case 1: Read specific attachment by ID
    if (attachmentId) {
      const attachment = await getAttachmentById(attachmentId, contextPillarId);

      if (!attachment) {
        return {
          content: JSON.stringify({
            error: 'not_found',
            message: `Attachment with ID "${attachmentId}" not found.`
          }),
          isError: true
        };
      }

      const formatted = formatAttachmentResponse(attachment);

      if (!formatted.content) {
        if (formatted.status === 'pending' || formatted.status === 'processing') {
          return {
            content: JSON.stringify({
              ...formatted,
              message: 'Document is still being processed. Please try again in a moment.'
            })
          };
        }

        if (formatted.status === 'failed') {
          return {
            content: JSON.stringify({
              ...formatted,
              message: `Failed to extract content from "${formatted.title}": ${formatted.error}`
            }),
            isError: true
          };
        }

        return {
          content: JSON.stringify({
            ...formatted,
            message: 'No extracted content available for this document.'
          })
        };
      }

      return {
        content: JSON.stringify(formatted)
      };
    }

    // Case 2: Search files in a pillar
    if (contextPillarId) {
      const attachments = await searchFilesInPillar(contextPillarId, query);

      if (attachments.length === 0) {
        return {
          content: JSON.stringify({
            pillarId: contextPillarId,
            query: query || null,
            files: [],
            message: query 
              ? `No PDF files matching "${query}" found in this pillar.`
              : 'No PDF files found in this pillar.'
          })
        };
      }

      // If only one result, return full content
      if (attachments.length === 1) {
        const formatted = formatAttachmentResponse(attachments[0]);
        return {
          content: JSON.stringify(formatted)
        };
      }

      // Multiple results - return list with previews
      const formattedList = attachments.map(att => ({
        attachmentId: att.id,
        title: att.title || att.originalName || 'Untitled',
        status: att.ocrStatus || 'unknown',
        pageCount: att.ocrMetadata?.pageCount || null,
        hasContent: att.ocrStatus === 'completed' && !!att.ocrContent,
        contentPreview: att.ocrContent 
          ? att.ocrContent.substring(0, 200) + '...'
          : null
      }));

      return {
        content: JSON.stringify({
          pillarId: contextPillarId,
          query: query || null,
          fileCount: formattedList.length,
          files: formattedList,
          message: `Found ${formattedList.length} PDF files. Use attachmentId to read a specific file.`
        })
      };
    }

    // No attachmentId or pillarId provided
    return {
      content: JSON.stringify({
        error: 'missing_parameters',
        message: 'Please provide either an attachmentId to read a specific file, or a pillarId to search for files.'
      }),
      isError: true
    };

  } catch (error) {
    console.error('[readFile] Error:', error);
    return {
      content: JSON.stringify({
        error: 'read_failed',
        message: error.message || 'Failed to read file'
      }),
      isError: true
    };
  }
};

module.exports = {
  definition,
  behaviorPrompt,
  handler
};
