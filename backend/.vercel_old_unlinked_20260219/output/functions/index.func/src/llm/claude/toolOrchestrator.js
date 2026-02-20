/**
 * Tool Orchestrator
 *
 * Builds tool definitions for Claude API calls.
 * Simplified version with only file reading tools.
 */

const { definitions: BUILT_IN_TOOL_DEFINITIONS } = require('../tools');

/**
 * Build tool definitions array for Claude API
 * @param {Array} customTools - Optional custom tools to merge
 * @returns {Array} - Array of tool definitions
 */
function buildToolDefinitions(customTools = []) {
  
  if (!Array.isArray(customTools) || customTools.length === 0) {
    return BUILT_IN_TOOL_DEFINITIONS;
  }

  const byName = new Map(BUILT_IN_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));
  const merged = [...BUILT_IN_TOOL_DEFINITIONS];

  customTools.forEach((tool) => {
    if (!tool || typeof tool !== 'object' || typeof tool.name !== 'string') {
      return;
    }

    if (byName.has(tool.name)) {
      // Override existing tool
      const index = merged.findIndex(t => t.name === tool.name);
      if (index >= 0) {
        merged[index] = { ...byName.get(tool.name), ...tool };
      }
      return;
    }

    merged.push(tool);
  });

  return merged;
}

/**
 * Filter tools by context (simplified - no task context filtering needed)
 * @param {Array} tools - Array of tool definitions
 * @param {Object} context - Context object (unused in simplified version)
 * @returns {Array} - Filtered tools
 */
function filterToolsByContext(tools, context = null) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  // All tools are available (no task context filtering)
  return tools;
}

module.exports = {
  buildToolDefinitions,
  filterToolsByContext
};
