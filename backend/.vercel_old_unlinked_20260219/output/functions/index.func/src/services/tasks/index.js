/**
 * Register all background tasks
 */

const backgroundTasks = require('../backgroundTasks');
const generateTitle = require('./generateTitle');

function initializeTasks() {
  backgroundTasks.register('generateTitle', generateTitle);
  console.log('[Tasks] All background tasks registered');
}

module.exports = { initializeTasks };


