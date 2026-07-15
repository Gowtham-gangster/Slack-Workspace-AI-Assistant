import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { initializeDatabase, db } from './db/index.js';
import { MCPClientManager } from './services/mcpClient.js';
import { securityMiddleware, sanitizeBody } from './middleware/security.js';
import { generalLimiter, authLimiter, syncLimiter, summarizeLimiter, reportLimiter, searchLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware, notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';
import { sendReminderEmail, isEmailConfigured, verifyTransporter, getEmailHealthStatus } from './services/emailService.js';

// Load routes
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import emailRoutes from './routes/email.js';
import channelRoutes from './routes/channels.js';
import reportsRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import intelligenceRoutes from './routes/intelligence.js';
import timelineRoutes from './routes/timeline.js';
import knowledgeRoutes from './routes/knowledge.js';
import actionsRoutes from './routes/actions.js';
import analyticsRoutes from './routes/analytics.js';
import memoryRoutes from './routes/memory.js';
import chatRoutes from './routes/chat.js';
import filesRoutes from './routes/files.js';
import notificationsRoutes from './routes/notifications.js';
import slackRoutes from './routes/slack.js';
import { initWebSocketServer, broadcastReminderFired } from './services/websocket.js';


const app = express();
const PORT = Number(process.env.PORT) || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Trusted Origins ────────────────────────────────────────────────────────
const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Always allow all localhost ports in development
if (!IS_PRODUCTION) {
  ALLOWED_ORIGINS.push(
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:3001', 'http://127.0.0.1:3001',
    'http://localhost:7505', 'http://127.0.0.1:7505',
    'http://localhost:4000', 'http://localhost:5000',
    'http://localhost:8080', 'http://localhost:8000',
  );
}

// ─── 1. Request Tracing ──────────────────────────────────────────────────────
app.set('trust proxy', 1); // Trust first proxy for correct IP detection
app.use(requestIdMiddleware);

// ─── 2. Security Headers (Helmet) ───────────────────────────────────────────
app.use(...securityMiddleware);

// ─── 3. CORS ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    console.log(`[CORS Check] Origin: "${origin}" | Whitelisted:`, ALLOWED_ORIGINS);
    // Allow non-browser requests (Postman, server-to-server) in development
    if (!origin && !IS_PRODUCTION) return callback(null, true);
    // Allow if origin is in whitelist
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS Blocked] Origin "${origin}" not allowed by whitelist:`, ALLOWED_ORIGINS);
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
app.use(express.json({
  limit: '2mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
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
app.use('/api/email', emailRoutes);
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
app.use('/api/chat', chatRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/slack', slackRoutes);

// ─── Direct Slack OAuth Redirect Routes ──────────────────────────────────────
app.get('/auth/slack', (req, res) => {
  const queryStr = new URLSearchParams(req.query as any).toString();
  res.redirect(`/api/auth/slack${queryStr ? '?' + queryStr : ''}`);
});
app.get('/auth/slack/callback', (req, res) => {
  const queryStr = new URLSearchParams(req.query as any).toString();
  res.redirect(`/api/auth/slack/callback${queryStr ? '?' + queryStr : ''}`);
});

// ─── 9. Health Check ─────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const emailHealth = await getEmailHealthStatus();
  res.json({
    status: 'ok',
    database: 'connected',
    mcp: MCPClientManager.getInstance(1).getConnectionStatus(),
    email: emailHealth
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

  // Verify transporter initialization during backend startup
  try {
    console.log('[Startup] Verifying email transporter status...');
    const result = await verifyTransporter();
    if (result.success) {
      console.log('[Startup] Email delivery transporter is verified and ready.');
    } else {
      console.warn(`[Startup] Email delivery startup warning: ${result.error}`);
    }
  } catch (emailErr) {
    console.error('[Startup] Failed to verify email transporter connection:', emailErr);
  }

  const server = http.createServer(app);

  initWebSocketServer(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`Slack AI Workspace Assistant Backend Running`);
    console.log(`Listening on http://localhost:${PORT}`);
    console.log(`Security: Helmet ✓ | CORS ✓ | Rate Limits ✓ | Compression ✓`);
    console.log(`Mode: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`Email Reminders: ${isEmailConfigured() ? '✓ SMTP configured' : '⚠ SMTP not configured (in-app only)'}`);
    console.log(`===============================================`);
  });

  // ─── Background Reminder Email Job (runs every 60 seconds) ────────────────
  let reminderJobTick = 0;
  const reminderJob = setInterval(async () => {
    reminderJobTick++;
    try {
      const now = new Date();
      // Find all due reminders not yet notified
      const dueReminders = await db.query<any>(`
        SELECT r.id, r.user_id, r.message_id, r.content, r.session_id,
               r.remind_at, r.created_at,
               u.email, u.full_name,
               COALESCE(m.content, r.content) as message_content
        FROM chat_reminders r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN chat_messages m ON r.message_id = m.id
        WHERE r.dismissed = 0 AND r.email_sent = 0 AND r.remind_at <= ?
      `, [now]);

      if (dueReminders.length === 0) return;

      console.log(`[ReminderJob] Found ${dueReminders.length} due reminder(s) to process.`);

      for (const reminder of dueReminders) {
        const userEmail = reminder.email;
        const userName = reminder.full_name || reminder.email || 'there';
        const messageContent = reminder.message_content || 'No message content available.';

        // 1. Broadcast real-time WebSocket alert to the connected client
        try {
          broadcastReminderFired(reminder.user_id, {
            id: reminder.id,
            message_id: reminder.message_id,
            session_id: reminder.session_id,
            content: messageContent,
            remind_at: reminder.remind_at
          });
        } catch (wsErr) {
          console.error('[ReminderJob] Failed to broadcast WebSocket reminder alert:', wsErr);
        }

        // 2. Send fallback email notification if SMTP is configured
        let emailSentStatus = 1; // Default to 1 (processed/skipped)
        if (isEmailConfigured()) {
          if (userEmail && userEmail.includes('@')) {
            const success = await sendReminderEmail({
              toEmail: userEmail,
              toName: userName,
              messageContent,
              reminderId: reminder.id,
              channelName: reminder.session_id || undefined,
              setAt: new Date(reminder.created_at)
            });
            emailSentStatus = success ? 1 : 2; // 1 = success, 2 = failed delivery attempt
          }
        }

        // 3. Mark as notified + email_sent in database
        await db.execute(
          'UPDATE chat_reminders SET email_sent = ?, notified = 1 WHERE id = ?',
          [emailSentStatus, reminder.id]
        );
      }
    } catch (err) {
      console.error('[ReminderJob] Error processing reminders:', err);
    }

    // SEC-05 + SEC-06: Hourly cleanup of unbounded audit tables (every 3600 ticks ≈ 60 minutes)
    if (reminderJobTick % 3600 === 0) {
      try {
        await db.execute("DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 24 HOUR");
        await db.execute("DELETE FROM refresh_tokens WHERE (revoked = 1 OR expires_at < NOW()) AND created_at < NOW() - INTERVAL 7 DAY");
        console.log('[Cleanup] Pruned stale login_attempts and refresh_tokens rows.');
      } catch (cleanupErr) {
        console.error('[Cleanup] Failed to prune stale rows:', cleanupErr);
      }
    }
  }, 1000); // run every 1 second (1000ms) for millisecond-level responsiveness


  const shutdown = async () => {
    console.log('\nShutting down backend server gracefully...');
    clearInterval(reminderJob);
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
