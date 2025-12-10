const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { logger } = require('./config/firebase');
const { initializeTasks } = require('./services/tasks');
const apiRoutes = require('./routes/api');

// Initialize background tasks
initializeTasks();
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const phoneAuthRoutes = require('./routes/phone-auth');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const taskRoutes = require('./routes/tasks');
const entryRoutes = require('./routes/entries');
const thoughtRoutes = require('./routes/thoughts');
const projectRoutes = require('./routes/projects');
const aiRoutes = require('./routes/ai');
const realtimeRoutes = require('./routes/realtime');
const workerRoutes = require('./routes/workers');
const testRoutes = require('./routes/test');
const adminUiRoutes = require('./routes/admin');
const agentRoutes = require('./routes/agents');
const triggerRoutes = require('./routes/triggers');
const attachmentRoutes = require('./routes/attachments');

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
    message: 'Squirrel 2.0 Backend API',
    version: '2.0.0',
    endpoints: {
      auth: '/auth',
      api: '/api',
      users: '/users',
      projects: '/api/projects',
      conversations: '/api/conversations',
      messages: '/api/messages',
      tasks: '/api/tasks',
      entries: '/api/entries',
      thoughts: '/api/thoughts',
      agents: '/api/agents',
      triggers: '/api/triggers',
      attachments: '/api/attachments'
    }
  });
});

app.use('/auth', authRoutes);
app.use('/auth/phone', phoneAuthRoutes);
app.use('/api', apiRoutes);
app.use('/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/thoughts', thoughtRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/test', testRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/connection-admin/api', adminUiRoutes);

const adminPublicPath = path.join(__dirname, '../public/connection-admin');
app.use('/connection-admin', express.static(adminPublicPath, { index: 'index.html' }));
app.get('/connection-admin/*', (req, res) => {
  res.sendFile(path.join(adminPublicPath, 'index.html'));
});

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error middleware');
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Squirrel 2.0 Backend listening');
});
