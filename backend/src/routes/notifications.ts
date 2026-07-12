import { Router } from 'express';
import type { Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications - Get all notifications for user
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unreadOnly === 'true';
    
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (unreadOnly) {
      query += ' AND read_status = 0';
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    
    const notifications = await db.query<any>(query, params);
    
    res.json(notifications);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get count of unread notifications
router.get('/unread-count', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_status = 0',
      [userId]
    );
    
    res.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Failed to fetch unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// POST /api/notifications - Create a new notification
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, type, title, message, link } = req.body;
    
    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await db.execute(
      'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, message, link || null]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    await db.execute(
      'UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    await db.execute(
      'UPDATE notifications SET read_status = 1 WHERE user_id = ? AND read_status = 0',
      [userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    await db.execute(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
