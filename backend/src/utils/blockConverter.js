/**
 * Converts Claude API responses to block-based format
 */

const BlockType = {
  TEXT: 'text',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  WEB_SEARCH: 'web_search',
  WEB_FETCH: 'web_fetch',
  PLAN: 'plan'
};

function createBlock(type, data, metadata = {}) {
  return {
    type,
    data,
    metadata: {
      ...metadata,
      sequence: metadata.sequence ?? Date.now()
    },
    key: metadata.key || `${type}-${Date.now()}-${Math.random()}`
  };
}

/**
 * Parses XML-like tool call tags from text content
 * Example: <search><query>test</query></search>
 */
function parseToolCallsFromText(text) {
  const toolCalls = [];
  const toolCallPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match;
  let lastIndex = 0;
  const parts = [];

  while ((match = toolCallPattern.exec(text)) !== null) {
    const [fullMatch, toolName, innerContent] = match;
    const beforeMatch = text.substring(lastIndex, match.index);
    
    // Add text before the tool call
    if (beforeMatch.trim()) {
      parts.push({ type: 'text', content: beforeMatch });
    }
    
    // Parse inner content (e.g., <query>value</query>)
    const innerPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
    const input = {};
    let innerMatch;
    while ((innerMatch = innerPattern.exec(innerContent)) !== null) {
      const [, key, value] = innerMatch;
      input[key] = value.trim();
    }
    
    // If no inner tags found, use the whole inner content as query
    if (Object.keys(input).length === 0 && innerContent.trim()) {
      input.query = innerContent.trim();
    }
    
    toolCalls.push({
      type: 'tool_use',
      name: toolName,
      input,
      id: `${toolName}-${Date.now()}-${Math.random()}`
    });
    
    parts.push({ type: 'tool_call', toolCall: toolCalls[toolCalls.length - 1] });
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add remaining text after last tool call
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining.trim()) {
      parts.push({ type: 'text', content: remaining });
    }
  }
  
  return { parts, toolCalls };
}

/**
 * Converts Claude API message content to blocks
 * Claude returns content as an array of blocks (text, tool_use, etc.)
 */
function convertClaudeContentToBlocks(claudeContent) {
  if (!Array.isArray(claudeContent)) {
    // If it's just a string, parse tool calls from it
    if (typeof claudeContent === 'string') {
      const { parts, toolCalls } = parseToolCallsFromText(claudeContent);
      const blocks = [];
      let sequence = 0;
      
      for (const part of parts) {
        if (part.type === 'text') {
          blocks.push(createBlock(
            BlockType.TEXT,
            { text: part.content },
            { sequence: sequence++ }
          ));
        } else if (part.type === 'tool_call') {
          blocks.push(createBlock(
            BlockType.TOOL_USE,
            {
              id: part.toolCall.id,
              name: part.toolCall.name,
              input: part.toolCall.input
            },
            { sequence: sequence++ }
          ));
        }
      }
      
      // If no blocks created, create a single text block
      if (blocks.length === 0) {
        blocks.push(createBlock(BlockType.TEXT, { text: claudeContent }, { sequence: 0 }));
      }
      
      return blocks;
    }
    return [];
  }

  const blocks = [];
  let sequence = 0;

  for (const item of claudeContent) {
    if (item.type === 'text') {
      const text = item.text || '';
      
      // Check if text contains tool call tags
      if (text.includes('<') && text.includes('>')) {
        const { parts } = parseToolCallsFromText(text);
        for (const part of parts) {
          if (part.type === 'text') {
            blocks.push(createBlock(
              BlockType.TEXT,
              { text: part.content },
              { sequence: sequence++ }
            ));
          } else if (part.type === 'tool_call') {
            blocks.push(createBlock(
              BlockType.TOOL_USE,
              {
                id: part.toolCall.id,
                name: part.toolCall.name,
                input: part.toolCall.input
              },
              { sequence: sequence++ }
            ));
          }
        }
      } else {
        blocks.push(createBlock(
          BlockType.TEXT,
          { text },
          { sequence: sequence++ }
        ));
      }
    } else if (item.type === 'tool_use') {
      blocks.push(createBlock(
        BlockType.TOOL_USE,
        {
          id: item.id,
          name: item.name,
          input: item.input || {}
        },
        { sequence: sequence++ }
      ));
    }
    // Handle other types as needed
  }

  return blocks;
}

/**
 * Converts tool execution results to tool_result blocks
 */
function createToolResultBlock(toolUseId, toolName, result, isError = false) {
  return createBlock(
    BlockType.TOOL_RESULT,
    {
      id: toolUseId,
      name: toolName,
      rawContent: typeof result === 'string' ? result : JSON.stringify(result),
      parsed: typeof result === 'object' ? result : null,
      isError
    },
    { sequence: Date.now() }
  );
}

/**
 * Merges tool_use and tool_result blocks together
 * Matches tool_result blocks to their corresponding tool_use blocks
 */
function mergeToolBlocks(blocks) {
  const result = [];
  const toolUseMap = new Map();
  const toolResults = [];

  // First pass: collect tool_use blocks and other blocks
  for (const block of blocks) {
    if (block.type === BlockType.TOOL_USE) {
      toolUseMap.set(block.data.id, block);
      result.push(block);
    } else if (block.type === BlockType.TOOL_RESULT) {
      toolResults.push(block);
    } else {
      result.push(block);
    }
  }

  // Second pass: insert tool_result blocks after their corresponding tool_use
  for (const toolResult of toolResults) {
    const toolUseId = toolResult.data.id || toolResult.data.tool_use_id;
    const toolUseIndex = result.findIndex(
      b => b.type === BlockType.TOOL_USE && b.data.id === toolUseId
    );
    
    if (toolUseIndex >= 0) {
      // Insert after the tool_use block
      result.splice(toolUseIndex + 1, 0, toolResult);
    } else {
      // If no matching tool_use found, just append
      result.push(toolResult);
    }
  }

  return result;
}

module.exports = {
  BlockType,
  createBlock,
  convertClaudeContentToBlocks,
  createToolResultBlock,
  mergeToolBlocks
};

