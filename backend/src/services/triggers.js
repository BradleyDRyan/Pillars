/**
 * Trigger Service
 * 
 * Handles schedule-based triggers for proactive nudges
 */

const cronParser = require('cron-parser');
const { db, FieldValue, logger } = require('../config/firebase');
const { sendSMS } = require('./twilio');
const { chatCompletion } = require('./anthropic');

/**
 * Get all triggers that are due to fire
 * Queries across all users' trigger subcollections
 */
async function getTriggersToFire() {
  const now = new Date();
  
  // Query all user triggers where enabled=true and nextFireAt <= now
  // Note: This requires a collection group query
  const triggersRef = db.collectionGroup('triggers');
  const snapshot = await triggersRef
    .where('enabled', '==', true)
    .where('nextFireAt', '<=', now)
    .get();
  
  const triggers = [];
  for (const doc of snapshot.docs) {
    // Extract userId from the document path: /users/{userId}/triggers/{triggerId}
    const pathParts = doc.ref.path.split('/');
    const userId = pathParts[1];
    
    triggers.push({
      id: doc.id,
      ref: doc.ref,
      userId,
      ...doc.data()
    });
  }
  
  logger.info({ count: triggers.length }, 'Found triggers to fire');
  return triggers;
}

/**
 * Check if a trigger should fire (respects limits, quiet hours, etc.)
 */
async function shouldFireTrigger(trigger, user) {
  // Check if user has opted in to proactive nudges
  const prefsDoc = await db.collection('coachPreferences').doc(trigger.userId).get();
  const prefs = prefsDoc.exists ? prefsDoc.data() : {};
  
  if (prefs.proactiveCheckIns === false) {
    logger.info({ triggerId: trigger.id, userId: trigger.userId }, 'User opted out of proactive nudges');
    return false;
  }
  
  // Check quiet hours (simplified: 10pm - 7am in user's timezone)
  const userTimezone = trigger.timezone || prefs.preferredTime || 'America/Chicago';
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  const hour = userTime.getHours();
  
  if (hour >= 22 || hour < 7) {
    logger.info({ triggerId: trigger.id, hour }, 'Quiet hours - skipping');
    return false;
  }
  
  // Check daily limit (max 3 nudges per day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayNudges = await db.collection('nudgeHistory')
    .where('userId', '==', trigger.userId)
    .where('sentAt', '>=', todayStart)
    .get();
  
  if (todayNudges.size >= 3) {
    logger.info({ triggerId: trigger.id, count: todayNudges.size }, 'Daily limit reached');
    return false;
  }
  
  return true;
}

/**
 * Generate the nudge message content
 */
async function generateNudgeContent(trigger, user, template) {
  // If template has fixed content, use it
  if (template?.messageTemplate) {
    return template.messageTemplate;
  }
  
  // Otherwise, generate with AI
  const prefsDoc = await db.collection('coachPreferences').doc(trigger.userId).get();
  const prefs = prefsDoc.exists ? prefsDoc.data() : {};
  
  const systemPrompt = buildNudgeSystemPrompt(trigger, prefs, template);
  
  const response = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Generate a nudge message.' }
  ], {
    maxTokens: 200,
    temperature: 0.8
  });
  
  return response.content || "Hey! Just checking in. How are you doing today?";
}

/**
 * Build the system prompt for nudge generation
 */
function buildNudgeSystemPrompt(trigger, prefs, template) {
  const templateName = template?.name || 'check-in';
  const tone = prefs.tone || 'Supportive';
  const style = prefs.communicationStyle || 'Balanced';
  const useEmojis = prefs.useEmojis !== false;
  
  let prompt = `You are a personal coach sending a proactive ${templateName} message via SMS.

Guidelines:
- Keep it SHORT (1-2 sentences max, this is SMS)
- Be ${style.toLowerCase()} in your approach
- Use a ${tone.toLowerCase()} tone
${useEmojis ? '- Feel free to use 1-2 emojis' : '- Do not use emojis'}
- Ask an engaging question or provide a thoughtful prompt
- Make it feel personal, not generic

`;

  // Add template-specific instructions
  if (template?.id === 'morning-checkin') {
    prompt += `This is a morning check-in. Focus on:
- Setting intentions for the day
- Energy and mindset
- One thing to focus on`;
  } else if (template?.id === 'evening-reflection') {
    prompt += `This is an evening reflection. Focus on:
- Wins from the day
- Lessons learned
- Gratitude`;
  } else if (template?.id === 'weekly-review') {
    prompt += `This is a weekly review prompt. Focus on:
- Progress on goals
- What went well
- What to improve next week`;
  }
  
  return prompt;
}

/**
 * Send the nudge via appropriate channel
 */
async function sendNudge(trigger, user, content) {
  // For now, only SMS is supported
  // TODO: Add push notification support
  
  if (!user.phone) {
    logger.warn({ userId: trigger.userId }, 'User has no phone number');
    return { success: false, reason: 'no_phone' };
  }
  
  try {
    await sendSMS(user.phone, content);
    return { success: true, channel: 'sms' };
  } catch (error) {
    logger.error({ error: error.message, userId: trigger.userId }, 'Failed to send SMS nudge');
    return { success: false, reason: error.message };
  }
}

/**
 * Fire a single trigger - generate content and send nudge
 */
async function fireTrigger(trigger) {
  const startTime = Date.now();
  logger.info({ triggerId: trigger.id, userId: trigger.userId }, 'Firing trigger');
  
  try {
    // Get user data
    const userDoc = await db.collection('users').doc(trigger.userId).get();
    const user = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : { id: trigger.userId };
    
    // Check if should fire
    if (!await shouldFireTrigger(trigger, user)) {
      // Update nextFireAt even if we skip
      await updateNextFireAt(trigger);
      return { success: false, reason: 'skipped' };
    }
    
    // Get template if exists
    let template = null;
    if (trigger.templateId) {
      const templateDoc = await db.collection('triggerTemplates').doc(trigger.templateId).get();
      template = templateDoc.exists ? { id: templateDoc.id, ...templateDoc.data() } : null;
    }
    
    // Generate content
    const content = await generateNudgeContent(trigger, user, template);
    
    // Send nudge
    const result = await sendNudge(trigger, user, content);
    
    // Log to nudgeHistory
    await db.collection('nudgeHistory').add({
      userId: trigger.userId,
      triggerId: trigger.id,
      templateId: trigger.templateId || null,
      content,
      channel: result.channel || 'unknown',
      status: result.success ? 'delivered' : 'failed',
      error: result.reason || null,
      sentAt: FieldValue.serverTimestamp()
    });
    
    // Update trigger stats
    await trigger.ref.update({
      lastFiredAt: FieldValue.serverTimestamp(),
      fireCount: FieldValue.increment(1)
    });
    
    // Calculate next fire time
    await updateNextFireAt(trigger);
    
    const duration = Date.now() - startTime;
    logger.info({ triggerId: trigger.id, duration, success: result.success }, 'Trigger fired');
    
    return result;
    
  } catch (error) {
    logger.error({ error: error.message, triggerId: trigger.id }, 'Error firing trigger');
    
    // Still update nextFireAt to prevent stuck triggers
    await updateNextFireAt(trigger);
    
    return { success: false, reason: error.message };
  }
}

/**
 * Calculate and update the next fire time for a trigger
 */
async function updateNextFireAt(trigger) {
  try {
    const cron = trigger.cron || '0 9 * * *'; // Default: 9am daily
    const timezone = trigger.timezone || 'America/Chicago';
    
    const options = {
      currentDate: new Date(),
      tz: timezone
    };
    
    const interval = cronParser.parseExpression(cron, options);
    const nextDate = interval.next().toDate();
    
    await trigger.ref.update({
      nextFireAt: nextDate
    });
    
    logger.info({ triggerId: trigger.id, nextFireAt: nextDate }, 'Updated next fire time');
    
  } catch (error) {
    logger.error({ error: error.message, triggerId: trigger.id }, 'Error updating next fire time');
  }
}

/**
 * Process all due triggers
 */
async function processAllTriggers() {
  const startTime = Date.now();
  logger.info('Starting trigger processing');
  
  const triggers = await getTriggersToFire();
  
  const results = {
    total: triggers.length,
    success: 0,
    skipped: 0,
    failed: 0
  };
  
  for (const trigger of triggers) {
    const result = await fireTrigger(trigger);
    
    if (result.success) {
      results.success++;
    } else if (result.reason === 'skipped') {
      results.skipped++;
    } else {
      results.failed++;
    }
  }
  
  const duration = Date.now() - startTime;
  logger.info({ ...results, duration }, 'Trigger processing complete');
  
  return results;
}

/**
 * Create a trigger for a user
 */
async function createUserTrigger(userId, data) {
  const { templateId, cron, timezone, enabled = true } = data;
  
  // Get template defaults if provided
  let template = null;
  if (templateId) {
    const templateDoc = await db.collection('triggerTemplates').doc(templateId).get();
    template = templateDoc.exists ? templateDoc.data() : null;
  }
  
  const triggerCron = cron || template?.defaultCron || '0 9 * * *';
  const triggerTimezone = timezone || template?.defaultTimezone || 'America/Chicago';
  
  // Calculate initial nextFireAt
  const options = {
    currentDate: new Date(),
    tz: triggerTimezone
  };
  const interval = cronParser.parseExpression(triggerCron, options);
  const nextFireAt = interval.next().toDate();
  
  const triggerRef = db.collection('users').doc(userId).collection('triggers').doc();
  
  const triggerData = {
    templateId: templateId || null,
    enabled,
    cron: triggerCron,
    timezone: triggerTimezone,
    nextFireAt,
    lastFiredAt: null,
    fireCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  
  await triggerRef.set(triggerData);
  
  return { id: triggerRef.id, ...triggerData };
}

/**
 * Update a user's trigger
 */
async function updateUserTrigger(userId, triggerId, data) {
  const triggerRef = db.collection('users').doc(userId).collection('triggers').doc(triggerId);
  
  const updates = {
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  };
  
  // Recalculate nextFireAt if cron or timezone changed
  if (data.cron || data.timezone) {
    const doc = await triggerRef.get();
    const current = doc.data();
    const cron = data.cron || current.cron;
    const timezone = data.timezone || current.timezone;
    
    const options = {
      currentDate: new Date(),
      tz: timezone
    };
    const interval = cronParser.parseExpression(cron, options);
    updates.nextFireAt = interval.next().toDate();
  }
  
  await triggerRef.update(updates);
  
  const updated = await triggerRef.get();
  return { id: triggerId, ...updated.data() };
}

/**
 * Delete a user's trigger
 */
async function deleteUserTrigger(userId, triggerId) {
  await db.collection('users').doc(userId).collection('triggers').doc(triggerId).delete();
}

/**
 * Get all triggers for a user
 */
async function getUserTriggers(userId) {
  const snapshot = await db.collection('users').doc(userId).collection('triggers').get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    nextFireAt: doc.data().nextFireAt?.toDate?.() || doc.data().nextFireAt,
    lastFiredAt: doc.data().lastFiredAt?.toDate?.() || doc.data().lastFiredAt,
    createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
  }));
}

/**
 * Get all trigger templates
 */
async function getTriggerTemplates() {
  const snapshot = await db.collection('triggerTemplates').where('enabled', '==', true).get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

module.exports = {
  getTriggersToFire,
  fireTrigger,
  processAllTriggers,
  createUserTrigger,
  updateUserTrigger,
  deleteUserTrigger,
  getUserTriggers,
  getTriggerTemplates,
  updateNextFireAt
};


