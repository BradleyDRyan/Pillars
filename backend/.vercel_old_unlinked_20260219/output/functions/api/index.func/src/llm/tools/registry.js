const path = require('path');

/**
 * Tool Registry
 * 
 * Simplified registry with only the read_file tool for PDF document reading.
 */

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const createTool = (name, modulePath, options = {}) => ({
  name,
  module: modulePath,
  enabled: options.enabled,
  enableEnv: options.enableEnv,
  disableEnv: options.disableEnv
});

// Single tool for reading PDF documents
const FILE_TOOLS = [
  createTool('read_file', './files/readFile')
];

const TOOL_REGISTRY = [...FILE_TOOLS];

const isEnabled = (entry) => {
  if (typeof entry.enabled === 'boolean') {
    return entry.enabled;
  }
  if (entry.disableEnv && toBoolean(process.env[entry.disableEnv], false)) {
    return false;
  }
  if (entry.enableEnv) {
    return toBoolean(process.env[entry.enableEnv], false);
  }
  return true;
};

function loadRegisteredTools() {
  const modules = [];
  
  console.log('[tools] loadRegisteredTools called');
  console.log('[tools] Registry size:', TOOL_REGISTRY.length);
  console.log('[tools] __dirname:', __dirname);

  for (const entry of TOOL_REGISTRY) {
    console.log('[tools] Processing:', entry.name);
    
    if (!isEnabled(entry)) {
      console.log('[tools] Skipping disabled:', entry.name);
      continue;
    }

    const resolvedPath = path.join(__dirname, entry.module);
    console.log('[tools] Path:', resolvedPath);
    
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(resolvedPath)];
      
      const toolModule = require(resolvedPath);
      
      console.log('[tools] Loaded module:', {
        name: entry.name,
        hasDefinition: !!toolModule?.definition,
        hasHandler: typeof toolModule?.handler === 'function',
        definitionName: toolModule?.definition?.name
      });
      
      if (!toolModule?.definition || typeof toolModule?.handler !== 'function') {
        console.warn('[tools] Missing definition/handler:', entry.name);
        continue;
      }
      
      modules.push(toolModule);
      console.log('[tools] ✓ Added tool:', entry.name);
    } catch (error) {
      console.error('[tools] ✗ Failed to load:', entry.name);
      console.error('[tools] Error:', error.message);
      console.error('[tools] Stack:', error.stack);
    }
  }

  console.log('[tools] Total loaded:', modules.length);
  return modules;
}

module.exports = {
  TOOL_REGISTRY,
  loadRegisteredTools
};
