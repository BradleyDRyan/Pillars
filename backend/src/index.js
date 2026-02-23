const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { logger } = require('./config/firebase');
const { initializeTasks } = require('./services/tasks');

// Initialize background tasks
initializeTasks();

// Routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const phoneAuthRoutes = require('./routes/phone-auth');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const pillarRoutes = require('./routes/pillars');
const pillarTemplateRoutes = require('./routes/pillar-templates');
const pillarVisualRoutes = require('./routes/pillar-visuals');
const principleRoutes = require('./routes/principles');
const insightRoutes = require('./routes/insights');
const aiRoutes = require('./routes/ai');
const realtimeRoutes = require('./routes/realtime');
const testRoutes = require('./routes/test');
const attachmentRoutes = require('./routes/attachments');
const smsRoutes = require('./routes/sms');
const coachPreferencesRoutes = require('./routes/coach-preferences');
const cronRoutes = require('./routes/cron');
const onboardingContentRoutes = require('./routes/onboarding-content');
const skillRoutes = require('./routes/skills');
const dayRoutes = require('./routes/days');
const dayBlockRoutes = require('./routes/day-blocks');
const dayTemplateRoutes = require('./routes/day-templates');
const blockTypeRoutes = require('./routes/block-types');
const todoRoutes = require('./routes/todos');
const habitRoutes = require('./routes/habits');
const pointEventRoutes = require('./routes/point-events');
const planRoutes = require('./routes/plan');
const eventRoutes = require('./routes/events');
const contextRoutes = require('./routes/context');
const schemaRoutes = require('./routes/schemas');

const app = express();
const PORT = process.env.PORT || 4310;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api', limiter);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Pillars Backend API',
    version: '3.0.0',
    endpoints: {
      auth: '/auth',
      api: '/api',
      users: '/users',
      pillars: '/api/pillars',
      pillarTemplates: '/api/pillar-templates',
      pillarVisuals: '/api/pillar-visuals',
      principles: '/api/principles',
      insights: '/api/insights',
      conversations: '/api/conversations',
      messages: '/api/messages',
      attachments: '/api/attachments',
      sms: '/api/sms',
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
app.use('/api/pillar-templates', pillarTemplateRoutes);
app.use('/api/pillar-visuals', pillarVisualRoutes);
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
  logger.error({ err }, 'Unhandled error middleware');
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Pillars Backend listening');
});
