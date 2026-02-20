/**
 * Tool Index
 * 
 * Exports all tool definitions, handlers, and behavior prompts.
 * Pattern copied from imagine/backend/llm/tools/index.js
 */

const { loadRegisteredTools, TOOL_REGISTRY } = require('./registry');

let toolModules = [];
let definitions = [];

try {
  console.log('[tools/index] Starting tool loading...');
  toolModules = loadRegisteredTools();
  definitions = toolModules.map((tool) => tool.definition);
  console.log('[tools/index] Loaded', definitions.length, 'tools:', definitions.map(d => d?.name));
} catch (error) {
  console.error('[tools/index] FAILED to load tools:', error.message);
  console.error('[tools/index] Stack:', error.stack);
}

// Collect behavioral prompts from tools
const behaviorPrompts = [];

toolModules.forEach((tool) => {
  if (typeof tool.behaviorPrompt === 'string' && tool.behaviorPrompt.trim().length > 0) {
    behaviorPrompts.push(tool.behaviorPrompt);
  }
});

const TOOL_BEHAVIOR_PROMPT = behaviorPrompts.join('\n\n');
const behaviorPrompt = TOOL_BEHAVIOR_PROMPT;

const handlers = toolModules.reduce((map, tool) => {
  if (tool.definition?.name && typeof tool.handler === 'function') {
    map[tool.definition.name] = tool.handler;
  }
  return map;
}, {});

const getTool = (name) => {
  if (!name) {
    return null;
  }
  return toolModules.find((tool) => tool.definition?.name === name) || null;
};

module.exports = {
  toolModules,
  definitions,
  behaviorPrompts,
  behaviorPrompt,
  TOOL_BEHAVIOR_PROMPT,
  TOOL_REGISTRY,
  handlers,
  getTool
};
