/**
 * Simple in-memory background task queue
 * Clean, minimal implementation for async tasks
 */

class BackgroundTasks {
  constructor() {
    this.handlers = new Map();
    this.queue = [];
    this.processing = false;
  }

  /**
   * Register a task handler
   */
  register(taskName, handler) {
    this.handlers.set(taskName, handler);
    console.log(`[BackgroundTasks] Registered: ${taskName}`);
  }

  /**
   * Queue a task for background processing
   */
  async run(taskName, data) {
    if (!this.handlers.has(taskName)) {
      console.warn(`[BackgroundTasks] No handler for: ${taskName}`);
      return;
    }

    this.queue.push({ taskName, data, queuedAt: Date.now() });
    console.log(`[BackgroundTasks] Queued: ${taskName}`);

    // Process queue if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process queued tasks
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const { taskName, data, queuedAt } = this.queue.shift();
      const handler = this.handlers.get(taskName);

      try {
        console.log(`[BackgroundTasks] Running: ${taskName}`);
        await handler(data);
        console.log(`[BackgroundTasks] Completed: ${taskName} (${Date.now() - queuedAt}ms)`);
      } catch (error) {
        console.error(`[BackgroundTasks] Failed: ${taskName}`, error.message);
      }
    }

    this.processing = false;
  }
}

// Singleton instance
const backgroundTasks = new BackgroundTasks();

module.exports = backgroundTasks;


