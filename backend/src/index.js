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
const principleRoutes = require('./routes/principles');
const insightRoutes = require('./routes/insights');
const aiRoutes = require('./routes/ai');
const realtimeRoutes = require('./routes/realtime');
const testRoutes = require('./routes/test');
const attachmentRoutes = require('./routes/attachments');
const smsRoutes = require('./routes/sms');
const coachPreferencesRoutes = require('./routes/coach-preferences');
const adminApiRoutes = require('./routes/admin-api');
const cronRoutes = require('./routes/cron');
const onboardingContentRoutes = require('./routes/onboarding-content');
const adminChatRoutes = require('./routes/admin-chat');
const agentRoutes = require('./routes/agents');
const adminConversationRoutes = require('./routes/admin-conversations');
const adminStreamingRoutes = require('./routes/admin-streaming');
const roomRoutes = require('./routes/rooms');
const agentDraftRoutes = require('./routes/agent-drafts');
const dayRoutes = require('./routes/days');
const dayTemplateRoutes = require('./routes/day-templates');

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
      principles: '/api/principles',
      insights: '/api/insights',
      conversations: '/api/conversations',
      messages: '/api/messages',
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
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/test', testRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/coach-preferences', coachPreferencesRoutes);
app.use('/api/admin', adminApiRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/onboarding-content', onboardingContentRoutes);
app.use('/api/admin-chat', adminChatRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/admin-conversations', adminConversationRoutes);
app.use('/api/admin-streaming', adminStreamingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/agent-drafts', agentDraftRoutes);
app.use('/api/days', dayRoutes);
app.use('/api/day-templates', dayTemplateRoutes);

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
