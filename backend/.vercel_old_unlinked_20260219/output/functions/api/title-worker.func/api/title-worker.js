/**
 * Title Worker - Generates conversation titles asynchronously
 * Called by QStash after a new conversation message
 */

// Initialize Firebase
require('../src/config/firebase');

const { createWorker } = require('../src/services/worker');
const generateTitle = require('../src/services/tasks/generateTitle');

module.exports = createWorker('TitleWorker', async (body) => {
  const { conversationId, userId, message } = body;

  if (!conversationId || !message) {
    throw new Error('conversationId and message are required');
  }

  return await generateTitle({ conversationId, userId, message });
});

// Config for Vercel (disable body parsing)
module.exports.config = { api: { bodyParser: false } };
