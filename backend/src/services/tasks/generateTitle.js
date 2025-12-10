/**
 * Generate conversation title from first message
 * Uses OpenAI to create a concise, descriptive title
 */

const OpenAI = require('openai');
const admin = require('firebase-admin');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEFAULT_TITLES = ['new conversation', 'untitled', 'untitled conversation', ''];

/**
 * Generate a title for a conversation based on its first message
 */
async function generateTitle({ conversationId, userId, message }) {
  console.log(`[GenerateTitle] Starting for conversation: ${conversationId}`);

  if (!conversationId) {
    console.log('[GenerateTitle] Skipped: No conversationId');
    return { success: false, reason: 'missing_conversation_id' };
  }

  try {
    const db = admin.firestore();
    const conversationRef = db.collection('conversations').doc(conversationId);
    const doc = await conversationRef.get();

    if (!doc.exists) {
      console.log('[GenerateTitle] Skipped: Conversation not found');
      return { success: false, reason: 'not_found' };
    }

    const data = doc.data();

    // Check if title already generated
    if (data.titleGenerated) {
      console.log('[GenerateTitle] Skipped: Title already generated');
      return { success: false, reason: 'already_generated' };
    }

    // Check if title is not a default
    const currentTitle = (data.title || '').trim().toLowerCase();
    if (currentTitle && !DEFAULT_TITLES.includes(currentTitle)) {
      console.log('[GenerateTitle] Skipped: Has custom title');
      return { success: false, reason: 'has_custom_title' };
    }

    // Get message content
    const content = message || data.firstMessage || data.lastMessage;
    if (!content) {
      console.log('[GenerateTitle] Skipped: No message content');
      return { success: false, reason: 'no_content' };
    }

    // Generate title with OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a concise title (3-6 words) for this conversation. Return only the title, no quotes or punctuation.'
        },
        {
          role: 'user',
          content: content.substring(0, 500)
        }
      ],
      temperature: 0.7,
      max_tokens: 20
    });

    const title = response.choices[0].message.content.trim();
    console.log(`[GenerateTitle] Generated: "${title}"`);

    // Update Firestore
    await conversationRef.update({
      title,
      titleGenerated: true,
      titleGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[GenerateTitle] Updated conversation: ${conversationId}`);
    return { success: true, title };

  } catch (error) {
    console.error('[GenerateTitle] Error:', error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

module.exports = generateTitle;


