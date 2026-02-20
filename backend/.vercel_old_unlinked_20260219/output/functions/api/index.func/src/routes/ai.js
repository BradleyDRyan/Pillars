const express = require('express');
const router = express.Router();
const { generateEmbedding } = require('../services/openai');
const {
  chatCompletion: claudeChatCompletion,
  getStatus: getClaudeStatus
} = require('../services/anthropic');
const { verifyToken } = require('../middleware/auth');
const { runClaudeToolStream } = require('../llm/claude/toolStreamRunner');

/**
 * Main chat streaming endpoint - uses Claude with tools
 * 
 * SSE Event Types:
 * - connected: Initial connection established
 * - text: Streaming text delta
 * - tool_call: Claude is calling a tool
 * - tool_result: Tool execution completed
 * - file_reading: File reading status (for read_file tool)
 * - final: Complete accumulated response
 * - end_of_stream: Connection closing
 * - error: Error occurred
 */
router.post(['/chat/stream', '/stream-chat-direct'], verifyToken, async (req, res) => {
  console.log('🎯 [ai/chat/stream] Claude streaming endpoint called');
  
  const { 
    messages, 
    model, 
    temperature, 
    maxTokens,
    conversationId,
    pillarId 
  } = req.body;
  
  console.log(`📝 [ai/chat/stream] Model: ${model || 'default'}, Messages: ${messages?.length}`);
  console.log(`📝 [ai/chat/stream] PillarId: ${pillarId}, ConversationId: ${conversationId}`);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Handle client disconnect
  req.on('close', () => {
    console.log('❌ [ai/chat/stream] Client disconnected');
    if (!res.writableEnded) {
      res.end();
    }
  });

  try {
    await runClaudeToolStream({
      messages,
      res,
      model,
      temperature,
      maxTokens,
      requestContext: {
        conversationId: conversationId || null,
        userId: req.user?.uid || null,
        pillarId: pillarId || null
      },
      handlerContext: {
        userId: req.user?.uid || null,
        conversationId: conversationId || null,
        pillar: pillarId ? { id: pillarId } : null
      }
    });
  } catch (error) {
    console.error('[ai/chat/stream] Stream failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Stream failed' });
    }
  }
});

/**
 * Claude tools streaming endpoint (explicit)
 * Same as /chat/stream but with explicit tool parameters
 */
router.post('/claude/tools/stream', verifyToken, async (req, res) => {
  const { 
    messages, 
    customTools, 
    conversationId, 
    pillar, 
    pillarId,
    model, 
    temperature, 
    maxTokens 
  } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  req.on('close', () => {
    if (!res.writableEnded) {
      res.end();
    }
  });

  const resolvedPillarId = pillar?.id || pillarId || null;

  try {
    await runClaudeToolStream({
      messages,
      customTools,
      res,
      model,
      temperature,
      maxTokens,
      requestContext: {
        conversationId: conversationId || null,
        userId: req.user?.uid || null,
        pillarId: resolvedPillarId,
        runId: req.body?.runId
      },
      handlerContext: {
        userId: req.user?.uid || null,
        conversationId: conversationId || null,
        pillar: resolvedPillarId ? { id: resolvedPillarId } : null
      }
    });
  } catch (error) {
    console.error('[ai/claude/tools/stream] Tool stream failed', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Tool stream failed' });
    }
  }
});

/**
 * Non-streaming Claude chat endpoint
 */
router.post('/claude/chat', verifyToken, async (req, res) => {
  try {
    const { messages, model, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await claudeChatCompletion(messages, {
      model,
      temperature,
      maxTokens
    });

    res.json({
      success: true,
      message: response
    });
  } catch (error) {
    console.error('Claude chat error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process Claude chat request'
    });
  }
});

/**
 * Generate embedding endpoint (uses OpenAI)
 */
router.post('/embedding', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const embedding = await generateEmbedding(text);
    res.json({ 
      success: true,
      embedding 
    });
  } catch (error) {
    console.error('Embedding error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate embedding' 
    });
  }
});

/**
 * Check AI service status
 */
router.get('/status', async (req, res) => {
  const claudeStatus = getClaudeStatus();
  const openaiConfigured = process.env.OPENAI_API_KEY &&
                           process.env.OPENAI_API_KEY !== 'your-openai-api-key-here';

  // Direct tool loading
  let toolInfo = { count: 0, names: [], error: null };
  try {
    const path = require('path');
    const toolPath = path.resolve(__dirname, '../llm/tools/files/readFile.js');
    const tool = require(toolPath);
    toolInfo = {
      count: tool?.definition ? 1 : 0,
      names: tool?.definition?.name ? [tool.definition.name] : [],
      hasHandler: typeof tool?.handler === 'function'
    };
  } catch (err) {
    toolInfo = { error: err.message };
  }

  res.json({
    claude: claudeStatus,
    openai: {
      configured: openaiConfigured,
      message: openaiConfigured ? 'OpenAI API is configured (for embeddings)' : 'OpenAI API key not configured'
    },
    defaultProvider: 'claude',
    toolInfo
  });
});

/**
 * Test SSE endpoint
 */
router.get('/test-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write('data: {"type":"connected"}\n\n');

  const text = "Hello! This is a Claude streaming test.";
  let index = 0;

  const interval = setInterval(() => {
    if (index < text.length) {
      const data = JSON.stringify({ 
        type: 'text', 
        data: text[index],
        metadata: { status: 'streaming' }
      });
      res.write(`data: ${data}\n\n`);
      index++;
    } else {
      res.write('data: {"type":"final","data":"Hello! This is a Claude streaming test."}\n\n');
      res.write('data: {"type":"end_of_stream"}\n\n');
      clearInterval(interval);
      res.end();
    }
  }, 50);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

module.exports = router;
