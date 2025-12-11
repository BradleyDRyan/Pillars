/**
 * SMS Webhook Routes
 * 
 * Handles inbound SMS from Twilio, processes with Claude, and sends response
 */

const express = require('express');
const router = express.Router();
const { User, Conversation, Message } = require('../models');
const { sendSMS, validateWebhook, normalizePhoneNumber } = require('../services/twilio');
const { chatCompletion } = require('../services/anthropic');
const { logger } = require('../config/firebase');

// System prompt for SMS conversations
const SMS_SYSTEM_PROMPT = `You are a helpful, concise AI assistant communicating via SMS text message.

Key guidelines:
- Keep responses SHORT and to the point (SMS has character limits)
- Be warm and conversational, like texting a knowledgeable friend
- Use simple language, avoid jargon
- If a topic requires a long explanation, offer to break it into multiple messages or suggest they check the app for more detail
- Remember context from the conversation history provided

The user is texting you on their phone. Respond naturally and helpfully.`;

/**
 * Get or create an SMS conversation for a user
 */
async function getOrCreateSMSConversation(userId) {
  // Look for existing SMS conversation
  const existingConvos = await Conversation.findByUserId(userId);
  const smsConvo = existingConvos.find(c => c.metadata?.channel === 'sms');
  
  if (smsConvo) {
    logger.info({ conversationId: smsConvo.id, userId }, 'Found existing SMS conversation');
    return smsConvo;
  }
  
  // Create new SMS conversation
  const conversation = await Conversation.create({
    userId,
    title: 'SMS Chat',
    pillarIds: [],
    metadata: {
      channel: 'sms',
      createdVia: 'twilio'
    }
  });
  
  logger.info({ conversationId: conversation.id, userId }, 'Created new SMS conversation');
  return conversation;
}

/**
 * Get recent messages for context (last N messages)
 */
async function getRecentMessages(conversationId, limit = 20) {
  const messages = await Message.findByConversationId(conversationId, limit);
  
  // Convert to format expected by Claude
  return messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));
}

/**
 * POST /api/sms/webhook
 * Twilio webhook for inbound SMS
 */
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  
  logger.info({ body: req.body }, '📱 [SMS] Incoming webhook');
  
  try {
    // Extract message details from Twilio
    const { From: fromPhone, Body: messageBody, MessageSid: messageSid } = req.body;
    
    if (!fromPhone || !messageBody) {
      logger.warn({ fromPhone, hasBody: !!messageBody }, '[SMS] Missing required fields');
      return res.status(400).send('Missing required fields');
    }
    
    const normalizedPhone = normalizePhoneNumber(fromPhone);
    logger.info({ phone: normalizedPhone, messageLength: messageBody.length, messageSid }, '📱 [SMS] Processing message');
    
    // 1. Find or create user by phone
    const user = await User.findOrCreateByPhone(normalizedPhone);
    logger.info({ userId: user.id, phone: normalizedPhone, isNew: user.source === 'sms' }, '📱 [SMS] User resolved');
    
    // 2. Get or create SMS conversation
    const conversation = await getOrCreateSMSConversation(user.id);
    
    // 3. Save inbound message
    const inboundMessage = await Message.create({
      conversationId: conversation.id,
      userId: user.id,
      sender: user.id,
      content: messageBody,
      role: 'user',
      type: 'text',
      metadata: {
        channel: 'sms',
        twilioMessageSid: messageSid,
        phone: normalizedPhone
      }
    });
    logger.info({ messageId: inboundMessage.id }, '📱 [SMS] Saved inbound message');
    
    // 4. Get conversation history for context
    const history = await getRecentMessages(conversation.id);
    
    // 5. Build messages for Claude (system + history)
    const claudeMessages = [
      { role: 'system', content: SMS_SYSTEM_PROMPT },
      ...history
    ];
    
    // 6. Call Claude for response
    logger.info({ historyLength: history.length }, '📱 [SMS] Calling Claude');
    const aiResponse = await chatCompletion(claudeMessages, {
      maxTokens: 500, // Keep SMS responses concise
      temperature: 0.7
    });
    
    const responseText = aiResponse.content || "I'm sorry, I couldn't generate a response. Please try again.";
    logger.info({ responseLength: responseText.length }, '📱 [SMS] Got Claude response');
    
    // 7. Save AI response message
    const outboundMessage = await Message.create({
      conversationId: conversation.id,
      userId: user.id,
      sender: 'assistant',
      content: responseText,
      role: 'assistant',
      type: 'text',
      metadata: {
        channel: 'sms',
        model: 'claude'
      }
    });
    logger.info({ messageId: outboundMessage.id }, '📱 [SMS] Saved outbound message');
    
    // 8. Update conversation's last message
    conversation.lastMessage = responseText;
    await conversation.save();
    
    // 9. Send response via Twilio SMS
    await sendSMS(normalizedPhone, responseText);
    
    const duration = Date.now() - startTime;
    logger.info({ duration, userId: user.id, conversationId: conversation.id }, '📱 [SMS] Complete');
    
    // Return empty TwiML response (we sent the message via API)
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '📱 [SMS] Error processing webhook');
    
    // Still return 200 to Twilio to prevent retries
    // But send an error message to the user
    try {
      const { From: fromPhone } = req.body;
      if (fromPhone) {
        await sendSMS(
          normalizePhoneNumber(fromPhone),
          "Sorry, I encountered an error. Please try again in a moment."
        );
      }
    } catch (smsError) {
      logger.error({ error: smsError.message }, '📱 [SMS] Failed to send error message');
    }
    
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

/**
 * GET /api/sms/status
 * Health check endpoint
 */
router.get('/status', (req, res) => {
  const { isConfigured } = require('../services/twilio');
  
  res.json({
    status: 'ok',
    twilioConfigured: isConfigured(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
