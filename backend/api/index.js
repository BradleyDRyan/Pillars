const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { logger } = require('../src/config/firebase');

// Working routes (models exist)
const apiRoutes = require('../src/routes/api');
const authRoutes = require('../src/routes/auth');
const userRoutes = require('../src/routes/users');
const phoneAuthRoutes = require('../src/routes/phone-auth');
const conversationRoutes = require('../src/routes/conversations');
const messageRoutes = require('../src/routes/messages');
const pillarRoutes = require('../src/routes/pillars');
const principleRoutes = require('../src/routes/principles');
const insightRoutes = require('../src/routes/insights');
const aiRoutes = require('../src/routes/ai');
const realtimeRoutes = require('../src/routes/realtime');
const testRoutes = require('../src/routes/test');
const attachmentRoutes = require('../src/routes/attachments');
const smsRoutes = require('../src/routes/sms');
const coachPreferencesRoutes = require('../src/routes/coach-preferences');
const cronRoutes = require('../src/routes/cron');
const onboardingContentRoutes = require('../src/routes/onboarding-content');
const skillRoutes = require('../src/routes/skills');
const dayRoutes = require('../src/routes/days');
const dayBlockRoutes = require('../src/routes/day-blocks');
const dayTemplateRoutes = require('../src/routes/day-templates');
const blockTypeRoutes = require('../src/routes/block-types');
const todoRoutes = require('../src/routes/todos');
const habitRoutes = require('../src/routes/habits');
const pointEventRoutes = require('../src/routes/point-events');
const planRoutes = require('../src/routes/plan');
const eventRoutes = require('../src/routes/events');
const contextRoutes = require('../src/routes/context');
const schemaRoutes = require('../src/routes/schemas');

// Disabled routes - models don't exist (cleanup needed)
// const taskRoutes = require('../src/routes/tasks');        // UserTask model missing
// const pillarRoutes = require('../src/routes/pillars');    // UserTask, Wisdom, Resource models missing
// const wisdomRoutes = require('../src/routes/wisdoms');    // Wisdom model missing
// const resourceRoutes = require('../src/routes/resources'); // Resource model missing
// const thoughtRoutes = require('../src/routes/thoughts');  // Thought model missing
// const adminUiRoutes = require('../src/routes/admin');     // Trigger model missing

// Initialize background tasks
const { initializeTasks } = require('../src/services/tasks');
initializeTasks();

const app = express();

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress || 
           'unknown';
  }
});

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/api', limiter);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Pillars Backend API',
    version: '3.1.0',
    endpoints: {
      auth: '/auth',
      api: '/api',
      users: '/users',
      pillars: '/api/pillars',
      principles: '/api/principles',
      insights: '/api/insights',
      conversations: '/api/conversations',
      messages: '/api/messages',
      attachments: '/api/attachments',
      sms: '/api/sms',
      coachPreferences: '/api/coach-preferences',
      cron: '/api/cron',
      blockTypes: '/api/block-types',
      dayBlocks: '/api/days/:date/blocks',
      plan: '/api/plan/by-date/:date',
      todos: '/api/todos',
      habits: '/api/habits',
      pointEvents: '/api/point-events',
      events: '/api/events',
      context: '/api/context',
      schemas: '/api/schemas'
    }
  });
});

app.use('/auth', authRoutes);
app.use('/auth/phone', phoneAuthRoutes);
app.use('/api', apiRoutes);
app.use('/users', userRoutes);
app.use('/api/pillars', pillarRoutes);
app.use('/api/principles', principleRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/test', testRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/coach-preferences', coachPreferencesRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/onboarding-content', onboardingContentRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/days', dayRoutes);
app.use('/api/days/:date/blocks', dayBlockRoutes);
app.use('/api/day-templates', dayTemplateRoutes);
app.use('/api/block-types', blockTypeRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/point-events', pointEventRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/schemas', schemaRoutes);

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
