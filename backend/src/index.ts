import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/index.js';
import { MCPClientManager } from './services/mcpClient.js';

// Load routes
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import channelRoutes from './routes/channels.js';
import reportsRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import intelligenceRoutes from './routes/intelligence.js';
import timelineRoutes from './routes/timeline.js';
import knowledgeRoutes from './routes/knowledge.js';
import actionsRoutes from './routes/actions.js';
import analyticsRoutes from './routes/analytics.js';
import memoryRoutes from './routes/memory.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Enable standard middlewares
app.use(cors({
  origin: '*', // For local development simplicity. Can be configured per project
  credentials: true
}));
app.use(express.json());

// 4. Register REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/actions', actionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/memory', memoryRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    mcp: MCPClientManager.getInstance(1).getConnectionStatus()
  });
});

// 2. Initialize Database tables and seeds, then start server
async function startServer() {
  try {
    console.log('Initializing MySQL Database...');
    await initializeDatabase();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('CRITICAL: Database initialization failed:', error);
    process.exit(1);
  }

  // 5. Start Express server
  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`Slack AI Workspace Assistant Backend Running`);
    console.log(`Listening on http://localhost:${PORT}`);
    console.log(`===============================================`);
  });

  // 6. Graceful shutdown handler
  const shutdown = async () => {
    console.log('\nShutting down backend server gracefully...');
    server.close(async () => {
      console.log('Express HTTP server closed.');
      await MCPClientManager.disconnectAll();
      console.log('Backend shutdown completed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
