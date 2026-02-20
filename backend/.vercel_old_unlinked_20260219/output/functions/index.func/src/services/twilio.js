/**
 * Twilio SMS Service
 * 
 * Handles sending SMS messages and validating incoming webhooks
 */

const twilio = require('twilio');
const { logger } = require('../config/firebase');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

/**
 * Get or create Twilio client
 */
const getClient = () => {
  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured');
    return null;
  }
  
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  
  return twilioClient;
};

/**
 * Check if Twilio is configured
 */
const isConfigured = () => {
  return Boolean(accountSid && authToken && twilioPhoneNumber);
};

/**
 * Send an SMS message
 * @param {string} to - Recipient phone number (E.164 format)
 * @param {string} body - Message content
 * @returns {Promise<object>} Twilio message response
 */
const sendSMS = async (to, body) => {
  const client = getClient();
  
  if (!client) {
    throw new Error('Twilio client not configured');
  }
  
  if (!twilioPhoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }
  
  // Truncate message if too long (SMS limit is 1600 chars, but keep it reasonable)
  const truncatedBody = body.length > 1500 
    ? body.substring(0, 1497) + '...' 
    : body;
  
  logger.info({ to, bodyLength: truncatedBody.length }, 'Sending SMS');
  
  try {
    const message = await client.messages.create({
      body: truncatedBody,
      from: twilioPhoneNumber,
      to: to
    });
    
    logger.info({ messageSid: message.sid, to }, 'SMS sent successfully');
    return message;
  } catch (error) {
    logger.error({ error: error.message, to }, 'Failed to send SMS');
    throw error;
  }
};

/**
 * Validate that a request came from Twilio
 * @param {string} signature - X-Twilio-Signature header
 * @param {string} url - Full URL of the webhook
 * @param {object} params - Request body params
 * @returns {boolean} Whether the request is valid
 */
const validateWebhook = (signature, url, params) => {
  if (!authToken) {
    logger.warn('Cannot validate webhook: auth token not configured');
    return false;
  }
  
  return twilio.validateRequest(authToken, signature, url, params);
};

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number
 * @returns {string} Normalized phone number
 */
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    }
  }
  
  return normalized;
};

module.exports = {
  getClient,
  isConfigured,
  sendSMS,
  validateWebhook,
  normalizePhoneNumber
};

