require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../config/firebase');

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

let anthropicClient = null;
let cachedApiKey = null;

const hasApiKey = () => {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key.trim().length > 0);
};

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (!anthropicClient || cachedApiKey !== apiKey) {
    anthropicClient = new Anthropic({ apiKey });
    cachedApiKey = apiKey;
  }

  return anthropicClient;
};

const ensureConfigured = () => {
  const client = getClient();
  if (!client) {
    const message = 'Anthropic API key not configured. Set ANTHROPIC_API_KEY in your environment.';
    logger.warn(message);
    throw new Error(message);
  }
};

const normalizeContent = content => {
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return content.text;
  }
  return '';
};

const transformMessages = messages => {
  let systemPrompt;

  const transformed = (messages || []).reduce((acc, message) => {
    if (!message || !message.role) {
      return acc;
    }

    if (message.role === 'system') {
      // Anthropic only supports one system prompt, so keep the latest non-empty one.
      const content = normalizeContent(message.content);
      if (content) {
        systemPrompt = content;
      }
      return acc;
    }

    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const text = normalizeContent(message.content);

    if (!text) {
      return acc;
    }

    acc.push({
      role,
      content: [
        {
          type: 'text',
          text
        }
      ]
    });

    return acc;
  }, []);

  return { systemPrompt, transformed };
};

const buildToolConfig = options => {
  const tools = [];
  
  // Add web_search if enabled
  if (options.useWebSearch) {
    const maxUses = Number.isInteger(options.webSearchMaxUses)
      ? Math.max(1, options.webSearchMaxUses)
      : 3;
    
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: maxUses
    });
  }
  
  // Add custom tools if provided
  if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
    tools.push(...options.tools);
  }
  
  return tools.length > 0 ? { tools, tool_choice: { type: 'auto' } } : {};
};

const chatCompletion = async (messages, options = {}) => {
  ensureConfigured();

  const { systemPrompt, transformed } = transformMessages(messages);
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1024;
  const client = getClient();
  const toolConfig = buildToolConfig(options);

  logger.debug(
    {
      model,
      temperature,
      maxTokens,
      systemPromptPresent: Boolean(systemPrompt),
      messageCount: transformed.length,
      useWebSearch: Boolean(options.useWebSearch)
    },
    '[anthropic] chatCompletion request'
  );

  const response = await client.messages.create({
    model,
    system: systemPrompt,
    messages: transformed,
    temperature,
    max_tokens: maxTokens,
    ...toolConfig
  });

  const text = (response.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  logger.debug(
    {
      model,
      tokenUsage: response.usage,
      responseLength: text.length,
      toolUse: toolConfig.tools ? 'web_search' : 'none',
      contentBlocks: response.content?.length || 0
    },
    '[anthropic] chatCompletion response'
  );

  return {
    id: response.id,
    role: 'assistant',
    content: text,
    rawContent: response.content || [], // Include full content array for block conversion
    usage: response.usage
  };
};

const chatCompletionStream = async function* (messages, options = {}) {
  ensureConfigured();

  const { systemPrompt, transformed } = transformMessages(messages);
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1024;
  const client = getClient();
  const toolConfig = buildToolConfig(options);

  logger.debug(
    {
      model,
      temperature,
      maxTokens,
      systemPromptPresent: Boolean(systemPrompt),
      messageCount: transformed.length,
      useWebSearch: Boolean(options.useWebSearch)
    },
    '[anthropic] chatCompletionStream request'
  );

  const stream = await client.messages.stream({
    model,
    system: systemPrompt,
    messages: transformed,
    temperature,
    max_tokens: maxTokens,
    ...toolConfig
  });

  let finalMessage;
  const toolUseBlocks = [];

  try {
    for await (const event of stream) {
      // Handle text deltas
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const chunk = event.delta.text;
        if (chunk) {
          yield chunk;
        }
      }
      // Handle tool_use block start
      else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        const toolUse = event.content_block;
        toolUseBlocks.push({
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input || {}
        });
      }
      // Handle tool_use input deltas (for streaming tool inputs)
      else if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
        // Tool input is being streamed, but we'll get it from finalMessage
        // Just track that we're in a tool_use block
      }
      // Handle message stop
      else if (event.type === 'message_stop') {
        finalMessage = await stream.finalMessage();
        break;
      }
    }
  } finally {
    if (!finalMessage) {
      try {
        finalMessage = await stream.finalMessage();
      } catch (error) {
        logger.debug({ err: error }, '[anthropic] Unable to fetch final stream message');
      }
    }
    
    // Yield final message metadata if available (for block conversion)
    if (finalMessage && options.includeFinalMessage) {
      yield { __finalMessage: finalMessage, __toolUseBlocks: toolUseBlocks };
    }
    
    logger.debug('[anthropic] chatCompletionStream finished');
  }
};

const getStatus = () => {
  const configured = hasApiKey();
  return {
    configured,
    model: configured ? DEFAULT_MODEL : null
  };
};

module.exports = {
  chatCompletion,
  chatCompletionStream,
  getStatus,
  ensureConfigured,
  getClient,
  transformMessages,
  buildToolConfig
};
