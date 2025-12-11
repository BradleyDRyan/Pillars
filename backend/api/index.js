const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { logger } = require('../src/config/firebase');
const apiRoutes = require('../src/routes/api');
const authRoutes = require('../src/routes/auth');
const userRoutes = require('../src/routes/users');
const phoneAuthRoutes = require('../src/routes/phone-auth');
const conversationRoutes = require('../src/routes/conversations');
const messageRoutes = require('../src/routes/messages');
const taskRoutes = require('../src/routes/tasks');
const pillarRoutes = require('../src/routes/pillars');
const principleRoutes = require('../src/routes/principles');
const insightRoutes = require('../src/routes/insights');
const wisdomRoutes = require('../src/routes/wisdoms');
const resourceRoutes = require('../src/routes/resources');
// const thoughtRoutes = require('../src/routes/thoughts'); // Disabled - Thought model doesn't exist
const aiRoutes = require('../src/routes/ai');
const realtimeRoutes = require('../src/routes/realtime');
const testRoutes = require('../src/routes/test');
const adminUiRoutes = require('../src/routes/admin');
const agentRoutes = require('../src/routes/agents');
const attachmentRoutes = require('../src/routes/attachments');
const smsRoutes = require('../src/routes/sms');

// Initialize background tasks
const { initializeTasks } = require('../src/services/tasks');
initializeTasks();

const app = express();

// Trust proxy headers on Vercel (required for proper IP detection)
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
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

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
      principles: '/api/principles',
      insights: '/api/insights',
      wisdoms: '/api/wisdoms',
      resources: '/api/resources',
      conversations: '/api/conversations',
      messages: '/api/messages',
      tasks: '/api/tasks',
      agents: '/api/agents',
      attachments: '/api/attachments',
      sms: '/api/sms'
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
app.use('/api/wisdoms', wisdomRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tasks', taskRoutes);
// app.use('/api/thoughts', thoughtRoutes); // Disabled - Thought model doesn't exist
app.use('/api/ai', aiRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/test', testRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/sms', smsRoutes);
app.use('/connection-admin/api', adminUiRoutes);

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
