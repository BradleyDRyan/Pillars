/**
 * Cron Routes
 * 
 * Endpoints called by Vercel Cron jobs
 */

const express = require('express');
const router = express.Router();
const { processAllTriggers } = require('../services/triggers');
const { logger } = require('../config/firebase');

// Verify cron request is from Vercel
const verifyCronSecret = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Check for Vercel cron header or our secret
  if (authHeader === `Bearer ${cronSecret}`) {
    return next();
  }
  
  // Vercel also sends this header for cron jobs
  if (req.headers['x-vercel-cron'] === '1') {
    return next();
  }
  
  logger.warn({ headers: req.headers }, 'Unauthorized cron request');
  return res.status(401).json({ error: 'Unauthorized' });
};

/**
 * POST /api/cron/process-triggers
 * Process all due triggers and send nudges
 * Called every 15 minutes by Vercel Cron
 */
router.post('/process-triggers', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();
  logger.info('Cron job started: process-triggers');
  
  try {
    const results = await processAllTriggers();
    
    const duration = Date.now() - startTime;
    logger.info({ ...results, duration }, 'Cron job completed: process-triggers');
    
    res.json({
      success: true,
      ...results,
      duration
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Cron job failed: process-triggers');
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/cron/status
 * Health check for cron system
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
