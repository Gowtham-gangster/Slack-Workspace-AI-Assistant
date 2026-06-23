import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/analytics/message-volume ─────────────────────────────────────
router.get('/message-volume', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = await db.query<any>(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM slack_messages
       WHERE db_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Message volume analytics failed:', error);
    res.status(500).json({ error: 'Failed to retrieve message volume.' });
  }
});

// ─── GET /api/analytics/channel-activity ───────────────────────────────────
router.get('/channel-activity', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = await db.query<any>(
      `SELECT sc.name, COUNT(sm.id) as message_count
       FROM slack_channels sc
       LEFT JOIN slack_messages sm ON sm.channel_id = sc.id AND sm.db_user_id = sc.db_user_id
       WHERE sc.db_user_id = ?
       GROUP BY sc.id, sc.name
       ORDER BY message_count DESC
       LIMIT 10`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Channel activity analytics failed:', error);
    res.status(500).json({ error: 'Failed to retrieve channel activity.' });
  }
});

// ─── GET /api/analytics/task-completion ────────────────────────────────────
router.get('/task-completion', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = await db.query<any>(
      `SELECT status, COUNT(*) as count FROM action_items WHERE user_id = ? GROUP BY status`,
      [userId]
    );
    const result = { pending: 0, in_progress: 0, completed: 0 };
    for (const r of rows) {
      if (r.status === 'pending') result.pending = Number(r.count);
      else if (r.status === 'in_progress') result.in_progress = Number(r.count);
      else if (r.status === 'completed') result.completed = Number(r.count);
    }
    res.json(result);
  } catch (error) {
    console.error('Task completion analytics failed:', error);
    res.status(500).json({ error: 'Failed to retrieve task completion.' });
  }
});

export default router;
