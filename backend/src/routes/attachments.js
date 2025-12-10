const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { admin, firestore, logger } = require('../config/firebase');
const OCRService = require('../services/ocrService');

// Get storage bucket
const bucket = admin.storage().bucket();

// Detect serverless environment
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Set up multer for temporary file storage
const uploadDir = isServerless 
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../temp-uploads');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info({ uploadDir }, '[Attachments] Created temp upload directory');
  } catch (error) {
    logger.warn({ err: error, uploadDir }, '[Attachments] Could not create upload directory');
  }
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    logger.info({ filename: file.originalname }, '[Attachments] Handling file upload');
    const destDir = fs.existsSync(uploadDir) ? uploadDir : (isServerless ? '/tmp' : uploadDir);
    cb(null, destDir);
  },
  filename: function(req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Filter to accept certain file types
const fileFilter = (req, file, cb) => {
  // Accept PDFs, images, and common document types
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Initialize multer
const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB file size limit
  }
});

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  logger.error({ err }, '[Attachments] Multer error');
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: {
        code: 'upload-error',
        message: `File upload error: ${err.message}`,
        field: err.field
      }
    });
  } else if (err) {
    return res.status(500).json({
      error: {
        code: 'server-error',
        message: err.message || 'Unknown server error during file upload'
      }
    });
  }
  next();
};

// Debug info route
router.get('/debug-info', (req, res) => {
  try {
    let tempDirWritable = false;
    
    try {
      fs.accessSync(uploadDir, fs.constants.W_OK | fs.constants.R_OK);
      tempDirWritable = true;
    } catch (e) {
      tempDirWritable = false;
    }
    
    res.json({
      success: true,
      config: {
        bucketName: bucket.name,
        projectId: admin.app().options.projectId,
        environment: process.env.NODE_ENV,
        isServerless,
        uploadDir,
        tempDirExists: fs.existsSync(uploadDir),
        tempDirWritable,
        mistralConfigured: !!process.env.MISTRAL_API_KEY
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Upload attachment
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'missing-file',
          message: 'No file was uploaded'
        }
      });
    }

    logger.info({ filename: req.file.originalname }, '[Attachments] Processing file upload');
    
    // Extract projectId from body or query
    const projectId = req.body.projectId || req.query.projectId;
    
    if (!projectId) {
      // Clean up temp file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: {
          code: 'missing-project-id',
          message: 'Project ID is required'
        }
      });
    }
    
    // Generate a unique ID for this attachment
    const attachmentId = uuidv4();
    
    // Get file extension
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    // Prepare upload path in Firebase Storage
    const storagePath = `projects/${projectId}/attachments/${attachmentId}${fileExtension}`;
    
    // Prepare metadata
    const metadata = {
      contentType: req.file.mimetype,
      metadata: {
        fileName: req.file.originalname,
        projectId,
        uploadedAt: new Date().toISOString()
      }
    };
    
    logger.info({ storagePath }, '[Attachments] Uploading to Firebase Storage');
    
    // Upload to Firebase Storage
    await bucket.upload(req.file.path, {
      destination: storagePath,
      metadata
    });
    
    logger.info('[Attachments] File uploaded to Firebase Storage');
    
    // Generate a signed URL
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });
    
    // Determine if OCR will be applied
    const willApplyOCR = req.file.mimetype === 'application/pdf';
    
    // Save attachment record in Firestore
    const attachmentRef = firestore.collection('projects').doc(projectId).collection('attachments').doc();
    
    await attachmentRef.set({
      id: attachmentId,
      type: 'attachment',
      title: req.file.originalname,
      url: signedUrl,
      path: storagePath,
      mimeType: req.file.mimetype,
      fileType: req.file.originalname.split('.').pop().toLowerCase(),
      originalName: req.file.originalname,
      size: req.file.size,
      ocrStatus: willApplyOCR ? 'pending' : 'not_applicable',
      ocrMetadata: willApplyOCR ? {
        queued: new Date().toISOString(),
        fileSize: req.file.size,
        fileType: req.file.mimetype
      } : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info({ attachmentId }, '[Attachments] Attachment record saved to Firestore');
    
    // If the file is a PDF, process it with OCR asynchronously
    if (willApplyOCR) {
      logger.info({ attachmentId }, '[Attachments] Starting asynchronous OCR processing for PDF');
      
      // Process with OCR in the background (don't await)
      OCRService.processDocument(req.file.path, projectId, attachmentId)
        .then(result => {
          logger.info({
            attachmentId,
            contentLength: result.data.ocrContent?.length || 0,
            pageCount: result.data.ocrMetadata?.pageCount || 0
          }, '[Attachments] OCR processing completed');
        })
        .catch(error => {
          logger.error({
            err: error,
            attachmentId
          }, '[Attachments] OCR processing failed');
        });
    } else {
      // For non-PDF files, clean up immediately
      logger.info({ mimeType: req.file.mimetype }, '[Attachments] Skipping OCR for non-PDF file');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    // Return success response
    res.json({
      success: true,
      attachmentId,
      fileName: req.file.originalname,
      url: signedUrl,
      path: storagePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      ocrStatus: willApplyOCR ? 'pending' : 'not_applicable',
      ocrProcessing: willApplyOCR
    });
    
  } catch (error) {
    logger.error({ err: error }, '[Attachments] Error in file upload');
    
    // Clean up temporary file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: {
        code: 'upload-failed',
        message: error.message || 'Failed to upload attachment'
      }
    });
  }
});

// Get OCR status for an attachment
router.get('/ocr-status/:attachmentId', async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    if (!attachmentId) {
      return res.status(400).json({
        error: {
          code: 'missing-parameters',
          message: 'Attachment ID is required'
        }
      });
    }
    
    // Find the document across all projects
    const projectsRef = firestore.collection('projects');
    const projectsSnapshot = await projectsRef.get();
    
    let attachmentDoc = null;
    let foundProjectId = null;
    
    for (const projectDoc of projectsSnapshot.docs) {
      const attachmentsRef = projectDoc.ref.collection('attachments');
      const querySnapshot = await attachmentsRef.where('id', '==', attachmentId).get();
      
      if (!querySnapshot.empty) {
        attachmentDoc = querySnapshot.docs[0].data();
        foundProjectId = projectDoc.id;
        break;
      }
    }
    
    if (!attachmentDoc) {
      return res.status(404).json({
        error: {
          code: 'not-found',
          message: 'Attachment not found'
        }
      });
    }
    
    res.json({
      success: true,
      attachmentId,
      projectId: foundProjectId,
      title: attachmentDoc.title,
      mimeType: attachmentDoc.mimeType,
      ocrStatus: attachmentDoc.ocrStatus || 'not_processed',
      ocrMetadata: attachmentDoc.ocrMetadata || {},
      hasOcrContent: !!attachmentDoc.ocrContent,
      ocrContentLength: attachmentDoc.ocrContent?.length || 0,
      ocrImagesCount: attachmentDoc.ocrImages?.length || 0
    });
  } catch (error) {
    logger.error({ err: error }, '[Attachments] Error retrieving OCR status');
    res.status(500).json({
      error: {
        code: 'server-error',
        message: error.message || 'Failed to retrieve OCR status'
      }
    });
  }
});

// Get OCR results for a specific attachment
router.get('/ocr/:projectId/:attachmentId', async (req, res) => {
  try {
    const { projectId, attachmentId } = req.params;
    
    if (!projectId || !attachmentId) {
      return res.status(400).json({
        error: {
          code: 'missing-parameters',
          message: 'Project ID and Attachment ID are required'
        }
      });
    }
    
    const attachmentRef = firestore.collection('projects').doc(projectId).collection('attachments');
    const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
    
    if (querySnapshot.empty) {
      return res.status(404).json({
        error: {
          code: 'not-found',
          message: 'Attachment not found'
        }
      });
    }
    
    const attachmentDoc = querySnapshot.docs[0].data();
    
    res.json({
      success: true,
      attachmentId,
      ocrStatus: attachmentDoc.ocrStatus || 'not_processed',
      ocrContent: attachmentDoc.ocrContent || null,
      ocrMetadata: attachmentDoc.ocrMetadata || {},
      ocrImages: attachmentDoc.ocrImages || [],
      title: attachmentDoc.title,
      url: attachmentDoc.url
    });
  } catch (error) {
    logger.error({ err: error }, '[Attachments] Error retrieving OCR results');
    res.status(500).json({
      error: {
        code: 'server-error',
        message: error.message || 'Failed to retrieve OCR results'
      }
    });
  }
});

// Manually trigger OCR processing for an attachment
router.post('/process-ocr/:projectId/:attachmentId', async (req, res) => {
  try {
    const { projectId, attachmentId } = req.params;
    
    if (!projectId || !attachmentId) {
      return res.status(400).json({
        error: {
          code: 'missing-parameters',
          message: 'Project ID and Attachment ID are required'
        }
      });
    }
    
    const attachmentRef = firestore.collection('projects').doc(projectId).collection('attachments');
    const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
    
    if (querySnapshot.empty) {
      return res.status(404).json({
        error: {
          code: 'not-found',
          message: 'Attachment not found'
        }
      });
    }
    
    const attachmentDoc = querySnapshot.docs[0].data();
    
    // Verify it's a PDF
    const isPDF = attachmentDoc.mimeType === 'application/pdf' || attachmentDoc.fileType === 'pdf';
    
    if (!isPDF) {
      return res.status(400).json({
        error: {
          code: 'invalid-file-type',
          message: 'OCR processing is only available for PDF files'
        }
      });
    }
    
    // Download file from storage
    const storagePath = attachmentDoc.path;
    const tempFilePath = path.join(uploadDir, `${Date.now()}-${attachmentDoc.title}`);
    
    await bucket.file(storagePath).download({
      destination: tempFilePath
    });
    
    logger.info({ attachmentId }, '[Attachments] Manual OCR processing started');
    
    // Process with OCR asynchronously
    OCRService.processDocument(tempFilePath, projectId, attachmentId)
      .then(result => {
        logger.info({ attachmentId }, '[Attachments] Manual OCR processing completed');
      })
      .catch(error => {
        logger.error({ err: error, attachmentId }, '[Attachments] Manual OCR processing failed');
      });
    
    res.json({
      success: true,
      message: 'OCR processing started',
      attachmentId,
      projectId,
      title: attachmentDoc.title,
      ocrStatus: 'processing',
      startedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, '[Attachments] Error starting OCR processing');
    res.status(500).json({
      error: {
        code: 'server-error',
        message: error.message || 'Failed to start OCR processing'
      }
    });
  }
});

// List all attachments for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        error: {
          code: 'missing-parameters',
          message: 'Project ID is required'
        }
      });
    }
    
    const attachmentsRef = firestore.collection('projects').doc(projectId).collection('attachments');
    const snapshot = await attachmentsRef.orderBy('createdAt', 'desc').get();
    
    const attachments = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    
    res.json({
      success: true,
      projectId,
      count: attachments.length,
      attachments
    });
  } catch (error) {
    logger.error({ err: error }, '[Attachments] Error listing attachments');
    res.status(500).json({
      error: {
        code: 'server-error',
        message: error.message || 'Failed to list attachments'
      }
    });
  }
});

// Delete an attachment
router.delete('/:projectId/:attachmentId', async (req, res) => {
  try {
    const { projectId, attachmentId } = req.params;
    
    if (!projectId || !attachmentId) {
      return res.status(400).json({
        error: {
          code: 'missing-parameters',
          message: 'Project ID and Attachment ID are required'
        }
      });
    }
    
    const attachmentRef = firestore.collection('projects').doc(projectId).collection('attachments');
    const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
    
    if (querySnapshot.empty) {
      return res.status(404).json({
        error: {
          code: 'not-found',
          message: 'Attachment not found'
        }
      });
    }
    
    const attachmentDoc = querySnapshot.docs[0];
    const attachmentData = attachmentDoc.data();
    
    // Delete from Firebase Storage
    if (attachmentData.path) {
      try {
        await bucket.file(attachmentData.path).delete();
        logger.info({ path: attachmentData.path }, '[Attachments] File deleted from storage');
      } catch (storageError) {
        logger.warn({ err: storageError }, '[Attachments] Could not delete file from storage');
      }
    }
    
    // Delete OCR images from storage
    if (attachmentData.ocrImages && attachmentData.ocrImages.length > 0) {
      for (const image of attachmentData.ocrImages) {
        if (image.path) {
          try {
            await bucket.file(image.path).delete();
          } catch (imageError) {
            logger.warn({ err: imageError, path: image.path }, '[Attachments] Could not delete OCR image');
          }
        }
      }
    }
    
    // Delete Firestore document
    await attachmentDoc.ref.delete();
    
    logger.info({ attachmentId }, '[Attachments] Attachment deleted');
    
    res.json({
      success: true,
      message: 'Attachment deleted',
      attachmentId
    });
  } catch (error) {
    logger.error({ err: error }, '[Attachments] Error deleting attachment');
    res.status(500).json({
      error: {
        code: 'server-error',
        message: error.message || 'Failed to delete attachment'
      }
    });
  }
});

module.exports = router;

