import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { MCPClientManager } from '../services/mcpClient.js';
import { generateText } from '../services/ai.js';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const channelCountRow = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM slack_channels WHERE db_user_id = ?', [userId]);
    const messageCountRow = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM slack_messages WHERE db_user_id = ?', [userId]);
    const reportCountRow = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM saved_reports WHERE user_id = ?', [userId]);
    const actionCountRow = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM action_items WHERE user_id = ?', [userId]);
    
    // Get recent reports
    const recentReports = await db.query<any>(`
      SELECT id, title, type, created_at 
      FROM saved_reports 
      WHERE user_id = ?
      ORDER BY created_at DESC 
      LIMIT 5
    `, [userId]);

    // Get recent searches (from tool executions where tool_name = 'slack_search_messages')
    const recentSearchesRows = await db.query<any>(`
      SELECT DISTINCT te.arguments, te.executed_at 
      FROM tool_executions te
      JOIN chat_messages cm ON te.message_id = cm.id
      JOIN chat_sessions cs ON cm.session_id = cs.id
      WHERE cs.user_id = ? AND (te.tool_name = 'slack_search_messages' OR te.tool_name = 'search_messages')
      ORDER BY te.executed_at DESC 
      LIMIT 5
    `, [userId]);

    const recentSearches = recentSearchesRows.map((s: any) => {
      try {
        const parsed = JSON.parse(s.arguments);
        return {
          query: parsed.query || parsed.text || 'Generic Search',
          executedAt: s.executed_at
        };
      } catch (e) {
        return {
          query: 'Workspace Search',
          executedAt: s.executed_at
        };
      }
    });

    // Get current MCP connection status
    const mcpStatus = MCPClientManager.getInstance(userId).getConnectionStatus();

    res.json({
      stats: {
        totalChannels: channelCountRow?.count || 0,
        messagesAnalyzed: messageCountRow?.count || 0,
        savedReportsCount: reportCountRow?.count || 0,
        actionItemsCount: actionCountRow?.count || 0,
        mcpConnected: mcpStatus.connected
      },
      recentReports,
      recentSearches
    });
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats.' });
  }
});

// GET /api/dashboard/intelligence-score
router.get('/intelligence-score', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const channelCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM slack_channels WHERE db_user_id = ?', [userId]))?.count || 0;
    const messageCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM slack_messages WHERE db_user_id = ?', [userId]))?.count || 0;
    const reportCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM saved_reports WHERE user_id = ?', [userId]))?.count || 0;
    const actionCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM action_items WHERE user_id = ?', [userId]))?.count || 0;
    const completedCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM action_items WHERE user_id = ? AND status = ?', [userId, 'completed']))?.count || 0;
    const mcpConnected = MCPClientManager.getInstance(userId).getConnectionStatus().connected;

    // Compute sub-scores (0-100)
    const communicationQuality = Math.min(100, Math.round((messageCount / 50) * 100));
    const decisionTracking = Math.min(100, Math.round(reportCount * 15));
    const taskCompletion = actionCount > 0 ? Math.round((completedCount / actionCount) * 100) : 0;
    const knowledgeCoverage = Math.min(100, Math.round((channelCount / 10) * 100));
    const connectionScore = mcpConnected ? 85 : 20;

    const overallScore = Math.round(
      (communicationQuality * 0.25) +
      (decisionTracking * 0.2) +
      (taskCompletion * 0.2) +
      (knowledgeCoverage * 0.2) +
      (connectionScore * 0.15)
    );

    res.json({
      overall: overallScore,
      communicationQuality,
      decisionTracking,
      taskCompletion,
      knowledgeCoverage,
      connectionScore,
    });
  } catch (error) {
    console.error('Intelligence score failed:', error);
    res.status(500).json({ error: 'Failed to compute intelligence score.' });
  }
});

// GET /api/dashboard/insights
router.get('/insights', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const messageCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM slack_messages WHERE db_user_id = ?', [userId]))?.count || 0;
    const channelCount = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM slack_channels WHERE db_user_id = ?', [userId]))?.count || 0;

    if (messageCount < 5) {
      return res.json({ insights: [
        { type: 'info', text: 'Sync your Slack workspace to unlock AI-powered insights about your team.' }
      ]});
    }

    // Sample recent messages for AI insight generation
    const recentMessages = await db.query<any>(
      `SELECT text FROM slack_messages WHERE db_user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );

    const sample = recentMessages.map((m: any) => m.text || '').filter(Boolean).slice(0, 30).join('\n');

    const prompt = `Based on these recent Slack messages, generate 4 concise, specific AI insights about this workspace.
Return ONLY a valid JSON array with no markdown or code blocks.

Messages:
${sample}

Stats: ${messageCount} total messages, ${channelCount} channels

Return exactly this structure:
[{"type": "<positive|warning|neutral|info>", "text": "<specific insight about actual content, 10-20 words>"}]

Examples of good insights:
- "Deployment discussions increased 42% compared to last week"
- "3 unresolved testing tasks identified across 2 channels"
- "Database migration was the most discussed topic this week"
- "Team response time averages under 15 minutes"`;

    try {
      const aiResult = await generateText(prompt, userId);
      let clean = aiResult.trim();
      if (clean.startsWith('```')) {
        const lines = clean.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        clean = lines.join('\n').trim();
      }
      const insights = JSON.parse(clean);
      res.json({ insights: Array.isArray(insights) ? insights : [] });
    } catch {
      res.json({ insights: [
        { type: 'info', text: `${messageCount} messages indexed across ${channelCount} channels.` },
        { type: 'positive', text: 'Workspace knowledge base is ready for AI queries.' },
      ]});
    }
  } catch (error) {
    console.error('Insights generation failed:', error);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

export default router;
