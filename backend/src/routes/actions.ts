import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';
import { generateText } from '../services/ai.js';

const router = Router();

// ─── GET /api/actions ──────────────────────────────────────────────────────
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = await db.query<any>(
      `SELECT * FROM action_items WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch action items:', error);
    res.status(500).json({ error: 'Failed to retrieve action items.' });
  }
});

// ─── POST /api/actions/extract ─────────────────────────────────────────────
// Extract tasks from a channel via AI and save them
router.post('/extract', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { channelId, channelName } = req.body;

    if (!channelId) return res.status(400).json({ error: 'channelId is required.' });

    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) await mcpManager.initializeClient();

    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId, limit: 80
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages.length) {
      return res.json({ extracted: 0, items: [] });
    }

    const msgText = messages.map((m: any) =>
      `${m.user || 'bot'}: ${m.text || ''}`
    ).filter(Boolean).slice(0, 50).join('\n');

    const prompt = `Extract all action items and tasks from these Slack messages.
Return ONLY a valid JSON array with no markdown or code blocks.

Messages:
${msgText}

Return an array of objects:
[{"task": "<clear task description>", "owner": "<username or 'Unassigned'>", "status": "pending", "dueDate": "<YYYY-MM-DD if mentioned or null>"}]

Rules:
- Only extract real action items, tasks, todos, or assignments
- Maximum 10 items
- If no clear tasks found, return empty array []`;

    const aiResult = await generateText(prompt, userId);
    let clean = aiResult.trim();
    if (clean.startsWith('```')) {
      const lines = clean.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      clean = lines.join('\n').trim();
    }

    let items: any[] = [];
    try {
      items = JSON.parse(clean);
      if (!Array.isArray(items)) items = [];
    } catch { items = []; }

    // Save to DB
    const saved = [];
    for (const item of items) {
      const id = uuidv4();
      await db.execute(
        `INSERT IGNORE INTO action_items (id, user_id, channel_id, channel_name, task, owner, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [id, userId, channelId, channelName || channelId, item.task, item.owner || 'Unassigned', 'pending', item.dueDate || null]
      );
      saved.push({ id, ...item, channelId, channelName: channelName || channelId, status: 'pending' });
    }

    res.json({ extracted: saved.length, items: saved });
  } catch (error: any) {
    console.error('Action extraction failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to extract action items.' });
  }
});

// ─── PUT /api/actions/:id ──────────────────────────────────────────────────
router.put('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { status, owner, dueDate } = req.body;

    await db.execute(
      `UPDATE action_items SET status = ?, owner = ?, due_date = ? WHERE id = ? AND user_id = ?`,
      [status || 'pending', owner || 'Unassigned', dueDate || null, id, userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update action item:', error);
    res.status(500).json({ error: 'Failed to update action item.' });
  }
});

// ─── DELETE /api/actions/:id ───────────────────────────────────────────────
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await db.execute(`DELETE FROM action_items WHERE id = ? AND user_id = ?`, [id, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete action item:', error);
    res.status(500).json({ error: 'Failed to delete action item.' });
  }
});

export default router;
