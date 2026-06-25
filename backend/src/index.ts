import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/index.js';
import { MCPClientManager } from './services/mcpClient.js';
import { securityMiddleware, sanitizeBody } from './middleware/security.js';
import { generalLimiter, authLimiter, syncLimiter, summarizeLimiter, reportLimiter, searchLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware, notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';

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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Trusted Origins ────────────────────────────────────────────────────────
const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Always allow localhost in development
if (!IS_PRODUCTION) {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

// ─── 1. Request Tracing ──────────────────────────────────────────────────────
app.set('trust proxy', 1); // Trust first proxy for correct IP detection
app.use(requestIdMiddleware);

// ─── 2. Security Headers (Helmet) ───────────────────────────────────────────
app.use(...securityMiddleware);

// ─── 3. CORS ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, server-to-server) in development
    if (!origin && !IS_PRODUCTION) return callback(null, true);
    // Allow if origin is in whitelist
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

// ─── 4. Compression ──────────────────────────────────────────────────────────
app.use(compression());

// ─── 5. Body Parsing + Sanitization ─────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(sanitizeBody);

// ─── 6. General Rate Limiter (all routes) ───────────────────────────────────
app.use('/api', generalLimiter);

// ─── 7. Route-Specific Rate Limiters ────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api/channels/sync', syncLimiter);
app.use('/api/channels/:id/summarize', summarizeLimiter);
app.use('/api/channels/:id/action-plans', summarizeLimiter);
app.use('/api/channels/retrieve-messages', searchLimiter);
app.use('/api/reports', reportLimiter);
app.use('/api/intelligence', summarizeLimiter);

// ─── 8. REST API Routes ──────────────────────────────────────────────────────
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

// ─── 9. Health Check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    mcp: MCPClientManager.getInstance(1).getConnectionStatus()
  });
});

// ─── 10. 404 + Global Error Handler ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── 11. Server Startup ───────────────────────────────────────────────────────
async function startServer() {
  try {
    console.log('Initializing MySQL Database...');
    await initializeDatabase();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('CRITICAL: Database initialization failed:', error);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`Slack AI Workspace Assistant Backend Running`);
    console.log(`Listening on http://localhost:${PORT}`);
    console.log(`Security: Helmet ✓ | CORS ✓ | Rate Limits ✓ | Compression ✓`);
    console.log(`Mode: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`===============================================`);
  });

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
