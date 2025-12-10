/**
 * Read File Tool
 * 
 * Reads PDF documents that have been uploaded to a project.
 * Can read a specific attachment by ID, or search for files in a project.
 */

const definition = {
  name: 'read_file',
  description: [
    'Reads PDF documents that have been uploaded to a project.',
    'Can read a specific attachment by ID, or search for files in a project.',
    'Returns the extracted text content from the document.'
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      attachmentId: {
        type: 'string',
        description: 'ID of a specific attachment to read. Use this if the user referenced a specific file.'
      },
      projectId: {
        type: 'string',
        description: 'Project ID to search for files. Required if searching by query.'
      },
      query: {
        type: 'string',
        description: 'Optional search query to find relevant files by name or content in the project.'
      }
    }
  }
};

const behaviorPrompt = [
  'Use `read_file` when the user asks about documents, PDFs, or uploaded files.',
  'If you know the specific attachmentId, provide it directly.',
  'If searching a project, provide the projectId and optionally a query to filter results.',
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
async function getAttachmentById(attachmentId, projectId = null) {
  const { firestore, logger } = getFirebase();
  
  logger.info({ attachmentId, projectId }, '[readFile] Looking up attachment by ID');

  // If projectId provided, search in that project first
  if (projectId) {
    const attachmentRef = firestore
      .collection('projects')
      .doc(projectId)
      .collection('attachments');
    
    const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
    
    if (!querySnapshot.empty) {
      return {
        projectId,
        ...querySnapshot.docs[0].data()
      };
    }
  }

  // Search across all projects
  const projectsRef = firestore.collection('projects');
  const projectsSnapshot = await projectsRef.get();

  for (const projectDoc of projectsSnapshot.docs) {
    const attachmentsRef = projectDoc.ref.collection('attachments');
    const querySnapshot = await attachmentsRef.where('id', '==', attachmentId).get();

    if (!querySnapshot.empty) {
      return {
        projectId: projectDoc.id,
        ...querySnapshot.docs[0].data()
      };
    }
  }

  return null;
}

/**
 * Search for files in a project
 */
async function searchFilesInProject(projectId, query = null) {
  const { firestore, logger } = getFirebase();
  
  logger.info({ projectId, query }, '[readFile] Searching files in project');

  const attachmentsRef = firestore
    .collection('projects')
    .doc(projectId)
    .collection('attachments');

  // Get attachments (simple query, filter in memory to avoid index issues)
  console.log(`[readFile] Fetching attachments from projects/${projectId}/attachments`);
  const snapshot = await attachmentsRef.limit(50).get();
  
  console.log(`[readFile] Raw attachment count: ${snapshot.docs.length}`);

  // Filter PDFs in memory
  let attachments = snapshot.docs
    .map(doc => ({
      projectId,
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
    projectId: attachment.projectId,
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
  const { attachmentId, projectId, query } = input;
  const contextProjectId = handlerContext?.project?.id || projectId;

  console.log('[readFile] Handler called', { attachmentId, projectId: contextProjectId, query });

  try {
    // Case 1: Read specific attachment by ID
    if (attachmentId) {
      const attachment = await getAttachmentById(attachmentId, contextProjectId);

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

    // Case 2: Search files in a project
    if (contextProjectId) {
      const attachments = await searchFilesInProject(contextProjectId, query);

      if (attachments.length === 0) {
        return {
          content: JSON.stringify({
            projectId: contextProjectId,
            query: query || null,
            files: [],
            message: query 
              ? `No PDF files matching "${query}" found in this project.`
              : 'No PDF files found in this project.'
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
          projectId: contextProjectId,
          query: query || null,
          fileCount: formattedList.length,
          files: formattedList,
          message: `Found ${formattedList.length} PDF files. Use attachmentId to read a specific file.`
        })
      };
    }

    // No attachmentId or projectId provided
    return {
      content: JSON.stringify({
        error: 'missing_parameters',
        message: 'Please provide either an attachmentId to read a specific file, or a projectId to search for files.'
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
