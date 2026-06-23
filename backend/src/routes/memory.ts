import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { generateText } from '../services/ai.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';

const router = Router();

// POST /api/memory/query
router.post('/query', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query string is required.' });
    }

    // 1. Search DB for matching keywords in messages
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .map((w: string) => w.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"?]/g, ''))
      .filter((w: string) => w.length > 2 && !['the', 'and', 'for', 'this', 'that', 'with', 'from', 'have', 'are'].includes(w));

    let messages: any[] = [];
    if (words.length > 0) {
      const likeClauses = words.map(() => 'sm.text LIKE ?').join(' OR ');
      const likeParams = words.map((w: string) => `%${w}%`);
      messages = await db.query<any>(
        `SELECT sm.text, sm.user_id, sm.created_at, sc.name as channel_name 
         FROM slack_messages sm
         JOIN slack_channels sc ON sm.channel_id = sc.id AND sm.db_user_id = sc.db_user_id
         WHERE sm.db_user_id = ? AND (${likeClauses})
         ORDER BY sm.created_at DESC
         LIMIT 100`,
        [userId, ...likeParams]
      );
    }

    // Fallback: If no keyword matches, fetch most recent messages to provide general context
    if (messages.length === 0) {
      messages = await db.query<any>(
        `SELECT sm.text, sm.user_id, sm.created_at, sc.name as channel_name 
         FROM slack_messages sm
         JOIN slack_channels sc ON sm.channel_id = sc.id AND sm.db_user_id = sc.db_user_id
         WHERE sm.db_user_id = ?
         ORDER BY sm.created_at DESC
         LIMIT 80`,
         [userId]
      );
    }

    if (messages.length === 0) {
      return res.json({
        summary: 'No workspace messages indexed yet. Please sync your channels to enable AI memory.',
        decisions: [],
        participants: [],
        tasks: [],
        risks: [],
        timeline: []
      });
    }

    // Get user map from MCP if connected for cleaner names
    let memberNames: Record<string, string> = {};
    try {
      const mcpManager = MCPClientManager.getInstance(userId);
      if (mcpManager.isConnected()) {
        const usersResponse = await mcpManager.callTool('slack_get_users', {});
        const parsed = parseMCPResponse(usersResponse);
        const members = parsed?.members || (Array.isArray(parsed) ? parsed : []);
        for (const m of members) {
          if (m.id) memberNames[m.id] = m.real_name || m.name || m.id;
        }
      }
    } catch (_) {}

    // 2. Format context for AI
    const formattedMsgText = messages
      .slice(0, 60) // Stay safe within tokens
      .map((m: any) => {
        const name = memberNames[m.user_id] || m.user_id;
        const time = new Date(m.created_at).toLocaleDateString();
        return `[#${m.channel_name} - ${time}] ${name}: ${m.text}`;
      })
      .join('\n');

    // 3. Ask Gemini to extract structured answer
    const prompt = `You are an advanced AI Workspace Memory assistant.
Based on the Slack chat messages below, answer the user's query: "${query}"

Conversation Context:
${formattedMsgText}

Return ONLY a valid JSON object. Do not wrap in markdown \`\`\`json blocks.
The JSON must follow this exact schema:
{
  "summary": "<comprehensive markdown text directly answering the query, including citations if applicable. Use 2-3 paragraphs. You can use markdown bold **text**>",
  "decisions": ["<decision made 1>", "<decision made 2>"],
  "participants": ["<name 1>", "<name 2>"],
  "tasks": [{"task": "<extracted task name>", "owner": "<assignee or 'Unassigned'>"}],
  "risks": ["<blocker, issue or potential risk identified>"],
  "timeline": [{"time": "<date or relative time>", "event": "<description of activity/milestone>"}]
}

Ensure all arrays are present. If no matching details are found for a field, return an empty array [].`;

    const aiResponse = await generateText(prompt, userId);
    let clean = aiResponse.trim();
    if (clean.startsWith('```')) {
      const lines = clean.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      clean = lines.join('\n').trim();
    }

    try {
      const result = JSON.parse(clean);
      res.json(result);
    } catch {
      // Fallback response if JSON fails parsing
      res.json({
        summary: `Answer for "${query}":\n\nI processed ${messages.length} Slack messages but couldn't generate a structured response. Here is the query content: ${query}`,
        decisions: [],
        participants: [...new Set(messages.map(m => memberNames[m.user_id] || m.user_id))].slice(0, 5),
        tasks: [],
        risks: [],
        timeline: []
      });
    }

  } catch (error: any) {
    console.error('Memory query failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to query workspace memory.' });
  }
});

export default router;
