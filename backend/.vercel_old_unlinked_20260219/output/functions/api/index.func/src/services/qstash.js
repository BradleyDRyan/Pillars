/**
 * QStash Service
 * Publishes background tasks to QStash for async processing
 * 
 * Usage:
 *   const qstash = require('./qstash');
 *   await qstash.publish('title-worker', { conversationId, userId, message });
 */

const { Client } = require('@upstash/qstash');

let client = null;

function getClient() {
  if (!client && process.env.QSTASH_TOKEN) {
    client = new Client({ token: process.env.QSTASH_TOKEN });
  }
  return client;
}

function getBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Publish a task to a worker
 * 
 * @param {string} workerName - Worker name (e.g., 'title-worker')
 * @param {object} payload - Task data
 * @param {object} options - Optional: { delay: 5, retries: 3 }
 */
async function publish(workerName, payload, options = {}) {
  const qstash = getClient();
  
  if (!qstash) {
    console.warn('[QStash] No token configured');
    return { queued: false, reason: 'no_token' };
  }

  const url = `${getBaseUrl()}/api/${workerName}`;
  
  console.log('[QStash] Publishing', { worker: workerName, url });

  try {
    const result = await qstash.publishJSON({
      url,
      body: payload,
      delay: options.delay ? `${options.delay}s` : undefined,
      retries: options.retries,
    });

    console.log('[QStash] Published', { messageId: result.messageId });
    return { queued: true, messageId: result.messageId };
  } catch (error) {
    console.error('[QStash] Error:', error.message);
    return { queued: false, reason: 'error', error: error.message };
  }
}

// Convenience methods for specific tasks
const tasks = {
  generateTitle: (data) => publish('title-worker', data),
  // Add more tasks here as needed:
  // summarize: (data) => publish('summarize-worker', data),
  // notify: (data) => publish('notify-worker', data),
};

module.exports = {
  publish,
  ...tasks,
};
