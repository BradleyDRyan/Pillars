const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { admin, firestore, logger } = require('../config/firebase');

// Get storage bucket
const bucket = admin.storage().bucket();

/**
 * Service for processing documents through Mistral OCR
 */
class OCRService {
  /**
   * Process a PDF document with Mistral OCR
   * @param {string} filePath - Local path to the PDF file
   * @param {string} projectId - Project ID the document belongs to
   * @param {string} attachmentId - ID of the attachment in Firestore
   * @returns {Promise<Object>} - OCR processing results
   */
  static async processDocument(filePath, projectId, attachmentId) {
    try {
      logger.info({ filePath, projectId, attachmentId }, '[OCRService] Starting OCR processing');
      
      // Verify the file exists
      if (!fs.existsSync(filePath)) {
        logger.error({ filePath }, '[OCRService] File not found');
        throw new Error(`File not found: ${filePath}`);
      }
      
      const fileStats = fs.statSync(filePath);
      logger.info({ filePath, size: fileStats.size }, '[OCRService] File exists');
      
      // Update OCR status to processing
      await this.updateOCRStatus(projectId, attachmentId, 'processing');
      
      // Read the file and convert to base64
      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');
      logger.info({ base64Length: base64Content.length }, '[OCRService] File converted to base64');
      
      // Call Mistral OCR API
      logger.info('[OCRService] Calling Mistral OCR API...');
      const ocrResults = await this.callMistralOCR(base64Content);
      logger.info('[OCRService] Mistral OCR API call successful');
      
      // Process and store OCR results
      logger.info('[OCRService] Storing OCR results...');
      const storedResults = await this.storeOCRResults(projectId, attachmentId, ocrResults);
      logger.info('[OCRService] OCR results stored successfully');
      
      // Clean up the temporary file after successful processing
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info({ filePath }, '[OCRService] Cleaned up temporary file');
        }
      } catch (cleanupError) {
        logger.error({ err: cleanupError }, '[OCRService] Error cleaning up temporary file');
      }
      
      logger.info({ attachmentId }, '[OCRService] OCR processing complete');
      return storedResults;
    } catch (error) {
      logger.error({ err: error, filePath, projectId, attachmentId }, '[OCRService] OCR processing error');
      
      // Update OCR status to failed
      await this.updateOCRStatus(projectId, attachmentId, 'failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Clean up the temporary file even if processing failed
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info({ filePath }, '[OCRService] Cleaned up temporary file after error');
        }
      } catch (cleanupError) {
        logger.error({ err: cleanupError }, '[OCRService] Error cleaning up temporary file');
      }
      
      throw error;
    }
  }
  
  /**
   * Call Mistral OCR API to process a document
   * @param {string} base64Content - Base64-encoded document content
   * @returns {Promise<Object>} - OCR API response
   */
  static async callMistralOCR(base64Content) {
    try {
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      if (!mistralApiKey) {
        throw new Error('MISTRAL_API_KEY environment variable is not set');
      }
      
      logger.info({
        modelVersion: 'mistral-ocr-latest',
        contentLength: base64Content.length,
        apiKeyPresent: !!mistralApiKey
      }, '[OCRService] Preparing Mistral API request');
      
      const startTime = Date.now();
      
      const response = await axios.post(
        'https://api.mistral.ai/v1/ocr',
        {
          model: 'mistral-ocr-latest',
          document: {
            type: 'document_url',
            document_url: `data:application/pdf;base64,${base64Content}`
          },
          include_image_base64: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mistralApiKey}`
          },
          timeout: 120000 // 120 second timeout
        }
      );
      
      const responseTime = Date.now() - startTime;
      
      logger.info({
        responseTimeMs: responseTime,
        statusCode: response.status,
        model: response.data.model,
        pageCount: response.data.pages?.length || 0,
        totalTextLength: response.data.pages?.reduce((sum, page) => sum + (page.markdown?.length || 0), 0) || 0,
        imageCount: response.data.pages?.reduce((sum, page) => sum + (page.images?.length || 0), 0) || 0
      }, '[OCRService] Mistral OCR API call successful');
      
      return response.data;
    } catch (error) {
      logger.error({
        errorType: error.name,
        statusCode: error.response?.status,
        errorMessage: error.message,
        responseData: error.response?.data
      }, '[OCRService] Mistral OCR API call failed');
      
      const errorDetails = error.response?.data?.error || error.response?.data?.detail || error.message;
      throw new Error(`Mistral OCR API call failed: ${errorDetails}`);
    }
  }
  
  /**
   * Store OCR results in Firestore
   * @param {string} projectId - Project ID the document belongs to
   * @param {string} attachmentId - ID of the attachment in Firestore
   * @param {Object} ocrResults - Results from Mistral OCR API
   * @returns {Promise<Object>} - Updated document data
   */
  static async storeOCRResults(projectId, attachmentId, ocrResults) {
    try {
      logger.info({ attachmentId }, '[OCRService] Storing OCR results');
      
      // Extract text content and metadata from OCR results
      const content = this.extractTextContent(ocrResults);
      const metadata = {
        pageCount: ocrResults.pages?.length || 0,
        processedAt: new Date().toISOString(),
        model: ocrResults.model || 'mistral-ocr-latest'
      };
      
      logger.info({
        attachmentId,
        contentLength: content.length,
        pageCount: metadata.pageCount
      }, '[OCRService] Content extraction complete');
      
      // Extract and process images if present
      const images = this.extractImages(ocrResults);
      logger.info({
        attachmentId,
        extractedImageCount: images.length
      }, '[OCRService] Image extraction complete');
      
      // Store extracted images in Firebase Storage
      const imageUrls = await this.storeImages(projectId, attachmentId, images);
      logger.info({
        attachmentId,
        storedImageCount: imageUrls.length
      }, '[OCRService] Images stored successfully');
      
      // Update the attachment document with OCR results
      const attachmentRef = firestore.collection('projects').doc(projectId).collection('attachments');
      const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
      
      if (querySnapshot.empty) {
        throw new Error(`Attachment not found: ${attachmentId}`);
      }
      
      const documentRef = querySnapshot.docs[0].ref;
      await documentRef.update({
        ocrContent: content,
        ocrStatus: 'completed',
        ocrMetadata: metadata,
        ocrImages: imageUrls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const updatedDoc = await documentRef.get();
      
      logger.info({
        attachmentId,
        contentLength: content.length,
        imageCount: imageUrls.length
      }, '[OCRService] OCR results stored successfully');
      
      return {
        success: true,
        documentId: updatedDoc.id,
        data: updatedDoc.data()
      };
    } catch (error) {
      logger.error({ err: error, attachmentId }, '[OCRService] Error storing OCR results');
      throw error;
    }
  }
  
  /**
   * Extract text content from OCR results
   * @param {Object} ocrResults - Results from Mistral OCR API
   * @returns {string} - Consolidated text content in Markdown format
   */
  static extractTextContent(ocrResults) {
    if (!ocrResults.pages || !Array.isArray(ocrResults.pages)) {
      return '';
    }
    
    // Combine all pages into a single Markdown document
    return ocrResults.pages.map(page => page.markdown || '').join('\n\n');
  }
  
  /**
   * Extract images from OCR results
   * @param {Object} ocrResults - Results from Mistral OCR API
   * @returns {Array} - Array of extracted images
   */
  static extractImages(ocrResults) {
    const images = [];
    
    if (!ocrResults.pages || !Array.isArray(ocrResults.pages)) {
      return images;
    }
    
    // Process each page to extract images
    ocrResults.pages.forEach((page, pageIndex) => {
      if (page.images && Array.isArray(page.images)) {
        page.images.forEach((image, imageIndex) => {
          if (image.base64) {
            images.push({
              pageIndex,
              imageIndex,
              base64: image.base64,
              contentType: image.content_type || 'image/png',
              filename: `page${pageIndex + 1}_image${imageIndex + 1}.${image.content_type?.split('/')?.[1] || 'png'}`
            });
          }
        });
      }
    });
    
    return images;
  }
  
  /**
   * Store extracted images in Firebase Storage
   * @param {string} projectId - Project ID the document belongs to
   * @param {string} attachmentId - ID of the attachment in Firestore
   * @param {Array} images - Array of extracted images
   * @returns {Promise<Array>} - Array of image URLs
   */
  static async storeImages(projectId, attachmentId, images) {
    const imageUrls = [];
    
    if (!images || images.length === 0) {
      return imageUrls;
    }
    
    logger.info({ imageCount: images.length }, '[OCRService] Storing extracted images');
    
    // Create a temporary directory for the images
    const tempDir = path.join(__dirname, '../temp-images');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Process each image
    for (const image of images) {
      try {
        // Decode base64 content
        const imageBuffer = Buffer.from(image.base64, 'base64');
        
        // Write to temporary file
        const tempFilePath = path.join(tempDir, image.filename);
        fs.writeFileSync(tempFilePath, imageBuffer);
        
        // Upload to Firebase Storage
        const storagePath = `projects/${projectId}/attachments/${attachmentId}/images/${image.filename}`;
        
        await bucket.upload(tempFilePath, {
          destination: storagePath,
          metadata: {
            contentType: image.contentType,
            metadata: {
              pageIndex: image.pageIndex,
              imageIndex: image.imageIndex,
              extractedFromOCR: true
            }
          }
        });
        
        // Generate signed URL
        const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
          action: 'read',
          expires: '03-01-2500'
        });
        
        imageUrls.push({
          url: signedUrl,
          path: storagePath,
          pageIndex: image.pageIndex,
          imageIndex: image.imageIndex,
          filename: image.filename
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempFilePath);
      } catch (error) {
        logger.error({ err: error, filename: image.filename }, '[OCRService] Error storing image');
      }
    }
    
    // Clean up temporary directory if empty
    try {
      const remainingFiles = fs.readdirSync(tempDir);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(tempDir);
      }
    } catch (error) {
      logger.error({ err: error }, '[OCRService] Error cleaning up temporary directory');
    }
    
    return imageUrls;
  }
  
  /**
   * Update OCR status for a document
   * @param {string} projectId - Project ID the document belongs to
   * @param {string} attachmentId - ID of the attachment in Firestore
   * @param {string} status - New OCR status (pending, processing, completed, failed)
   * @param {Object} metadata - Additional metadata to store
   * @returns {Promise<void>}
   */
  static async updateOCRStatus(projectId, attachmentId, status, metadata = {}) {
    try {
      const attachmentRef = firestore.collection('projects').doc(projectId).collection('attachments');
      const querySnapshot = await attachmentRef.where('id', '==', attachmentId).get();
      
      if (querySnapshot.empty) {
        throw new Error(`Attachment not found: ${attachmentId}`);
      }
      
      const documentRef = querySnapshot.docs[0].ref;
      
      const updateObj = {
        ocrStatus: status,
        ocrMetadata: {
          ...metadata,
          updatedAt: new Date().toISOString()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await documentRef.update(updateObj);
      
      logger.info({ attachmentId, status }, '[OCRService] Updated OCR status');
    } catch (error) {
      logger.error({ err: error, attachmentId, status }, '[OCRService] Error updating OCR status');
      throw error;
    }
  }
}

module.exports = OCRService;

