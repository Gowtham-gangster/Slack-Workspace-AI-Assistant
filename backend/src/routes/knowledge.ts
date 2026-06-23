import { Router, Response } from 'express';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { generateText } from '../services/ai.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';

const router = Router();

// ─── GET /api/knowledge/graph/:channelId ───────────────────────────────────
router.get('/graph/:channelId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { channelId } = req.params;

    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) await mcpManager.initializeClient();

    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: 50,
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages.length) {
      return res.json({ nodes: [], edges: [] });
    }

    const msgText = messages.slice(0, 30).map((m: any) =>
      `User:${m.user || 'bot'}: ${(m.text || '').slice(0, 100)}`
    ).join('\n');

    const prompt = `Extract a knowledge graph from these Slack messages.
Return ONLY a valid JSON object with no markdown or code blocks.

Messages:
${msgText}

Return this exact structure:
{
  "nodes": [
    {"id": "<unique_id>", "label": "<name>", "type": "<Person|Topic|Task|Decision|Project>"}
  ],
  "edges": [
    {"source": "<node_id>", "target": "<node_id>", "label": "<relationship>"}
  ]
}

Rules:
- Extract 5-12 nodes maximum
- Types: Person (user IDs or names), Topic (tech topics), Task (action items), Decision (agreed choices), Project (project names)
- Create meaningful edges showing relationships
- Person node IDs should use the user ID from messages`;

    const aiResult = await generateText(prompt, userId);
    let clean = aiResult.trim();
    if (clean.startsWith('```')) {
      const lines = clean.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      clean = lines.join('\n').trim();
    }

    try {
      const graph = JSON.parse(clean);
      res.json(graph);
    } catch {
      // Fallback: build graph from message authors and keywords
      const users = [...new Set(messages.map((m: any) => m.user).filter(Boolean))].slice(0, 5);
      const nodes = users.map((u: any) => ({ id: u, label: u, type: 'Person' }));
      nodes.push({ id: 'channel', label: 'Channel Discussion', type: 'Topic' });
      const edges = users.map((u: any) => ({ source: u, target: 'channel', label: 'participated in' }));
      res.json({ nodes, edges });
    }
  } catch (error: any) {
    console.error('Knowledge graph failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate knowledge graph.' });
  }
});

export default router;
