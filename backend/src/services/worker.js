/**
 * Worker Utilities
 * Shared utilities for QStash background workers
 */

const { Receiver } = require('@upstash/qstash');

// Skip signature verification (hardcoded for now - TODO: fix signature issues)
const SKIP_SIGNATURE_VERIFICATION = true;

/**
 * Get raw body from request (needed for signature verification)
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Create a QStash worker handler
 * 
 * @param {string} name - Worker name for logging
 * @param {Function} handler - Async function that processes the task
 * @returns {Function} - Vercel serverless function
 * 
 * @example
 * // api/my-worker.js
 * const { createWorker } = require('../src/services/worker');
 * 
 * module.exports = createWorker('MyWorker', async (body) => {
 *   const { someId, someData } = body;
 *   // Do work...
 *   return { success: true };
 * });
 */
function createWorker(name, handler) {
  const workerFn = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get raw body
    const rawBody = await getRawBody(req);
    let body;
    
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error(`[${name}] Invalid JSON body`);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    console.log(`[${name}] Received request`, {
      hasSignature: !!req.headers['upstash-signature'],
      bodyKeys: Object.keys(body)
    });

    // Signature verification (skipped for now)
    if (!SKIP_SIGNATURE_VERIFICATION) {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      });

      try {
        const isValid = await receiver.verify({
          signature: req.headers['upstash-signature'],
          body: rawBody,
        });
        
        if (!isValid) {
          console.error(`[${name}] Invalid signature`);
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } catch (error) {
        console.error(`[${name}] Signature error:`, error.message);
        return res.status(401).json({ error: 'Signature verification failed' });
      }
    }

    // Execute handler
    try {
      console.log(`[${name}] Processing...`);
      const result = await handler(body);
      console.log(`[${name}] Completed`, result);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error(`[${name}] Failed:`, error);
      return res.status(500).json({ 
        error: `${name} failed`, 
        message: error.message 
      });
    }
  };

  // Disable body parsing for signature verification
  workerFn.config = {
    api: { bodyParser: false }
  };

  return workerFn;
}

module.exports = {
  createWorker,
  getRawBody,
  SKIP_SIGNATURE_VERIFICATION
};


