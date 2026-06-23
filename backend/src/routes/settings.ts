import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { MCPClientManager } from '../services/mcpClient.js';

const router = Router();

// GET /api/settings
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = await db.query<{ key: string; value: string }>(
      'SELECT `key`, value FROM settings WHERE user_id = ?',
      [userId]
    );

    if (settings.length === 0) {
      // Lazy seed default settings for this user (with empty credentials so they see placeholders)
      const defaultSettings = [
        { key: 'mcp_server_url', value: '' },
        { key: 'mcp_slack_bot_token', value: '' },
        { key: 'mcp_slack_team_id', value: '' },
        { key: 'openai_api_key', value: '' },
        { key: 'openai_model_name', value: 'gemini-2.5-flash' },
        { key: 'openai_api_base', value: 'https://generativelanguage.googleapis.com/v1beta/openai' },
        { key: 'openai_embedding_model_name', value: 'gemini-embedding-2' },
        { key: 'report_schedule', value: 'daily' }
      ];

      for (const s of defaultSettings) {
        await db.execute(
          'INSERT IGNORE INTO settings (user_id, `key`, value) VALUES (?, ?, ?)',
          [userId, s.key, s.value]
        );
      }
      settings = defaultSettings;
    }

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    res.json(settingsMap);
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to retrieve configuration settings.' });
  }
});

// POST /api/settings
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const updates = req.body; // Key-Value map of settings to update

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid settings body. Must be an object.' });
  }

  try {
    const userId = req.user!.id;
    for (const [key, value] of Object.entries(updates)) {
      await db.execute(
        'INSERT INTO settings (user_id, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?',
        [userId, key, String(value), String(value)]
      );
    }

    // If Slack token or team ID was updated, restart the Slack MCP client connection
    if ('mcp_slack_bot_token' in updates || 'mcp_slack_team_id' in updates) {
      console.log(`Slack MCP credentials updated for user ${userId}. Re-initializing MCP Client...`);
      // Run asynchronously to avoid blocking the response
      MCPClientManager.getInstance(userId).initializeClient().catch(err => {
        console.error(`Failed to re-initialize MCP client after settings update for user ${userId}:`, err);
      });
    }

    res.json({ message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update configuration settings.' });
  }
});

// DELETE /api/settings
router.delete('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await db.execute('DELETE FROM settings WHERE user_id = ?', [userId]);
    // Re-initialize MCP Client asynchronously to clear session
    MCPClientManager.getInstance(userId).initializeClient().catch(err => {
      console.error(`Failed to re-initialize MCP client after clearing settings for user ${userId}:`, err);
    });
    res.json({ message: 'Configuration settings cleared successfully.' });
  } catch (error) {
    console.error('Failed to clear settings:', error);
    res.status(500).json({ error: 'Failed to clear settings.' });
  }
});

// GET /api/settings/diagnostics - Scoped Diagnostics for Authenticated User
router.get('/diagnostics', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    
    let toolCount = 0;
    let mcpError = null;
    try {
      if (!mcpManager.isConnected()) {
        await mcpManager.initializeClient();
      }
      const tools = await mcpManager.listTools();
      toolCount = tools.length;
    } catch (err: any) {
      mcpError = err.message || String(err);
    }

    const status = mcpManager.getConnectionStatus();
    res.json({
      status: 'ok',
      database: 'connected',
      mcp: {
        connected: status.connected && !mcpError,
        connecting: status.connecting,
        error: mcpError || status.error,
        toolsRetrieved: toolCount
      }
    });
  } catch (error: any) {
    console.error('Diagnostics check failed:', error);
    res.status(500).json({ error: 'Failed to run diagnostics connection test.' });
  }
});

export default router;

