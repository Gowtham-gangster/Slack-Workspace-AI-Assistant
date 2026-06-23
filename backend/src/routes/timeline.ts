import { Router, Response } from 'express';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';
import { generateText } from '../services/ai.js';

const router = Router();

// ─── GET /api/timeline/:channelId ──────────────────────────────────────────
router.get('/:channelId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit as string) || 40;

    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) await mcpManager.initializeClient();

    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit,
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages.length) {
      return res.json([]);
    }

    const sorted = [...messages].sort((a: any, b: any) => parseFloat(a.ts) - parseFloat(b.ts));

    const msgText = sorted.map((m: any, i: number) => {
      const t = new Date(parseFloat(m.ts) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${i}: [${t}] ${m.user || 'bot'}: ${(m.text || '').slice(0, 120)}`;
    }).join('\n');

    const prompt = `Analyze these Slack messages and classify each into timeline events.
Return ONLY a valid JSON array with no markdown or code blocks.

Messages:
${msgText}

Return an array of objects. For each meaningful message (skip trivial ones like "ok", "thanks", "👍"), include:
{"index": <message index 0-based>, "category": "<one of: Deployment|Testing|Bug|Decision|Meeting|Task|Discussion|Infrastructure|Alert|Update>", "title": "<concise 4-8 word event title>", "description": "<10-20 word description>"}

Focus on important events only. Return 5-15 events maximum.`;

    const aiResult = await generateText(prompt, userId);
    let clean = aiResult.trim();
    if (clean.startsWith('```')) {
      const lines = clean.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      clean = lines.join('\n').trim();
    }

    let events: any[] = [];
    try {
      events = JSON.parse(clean);
    } catch {
      // fallback: convert messages directly without AI classification
      events = sorted.slice(0, 15).map((m: any, i: number) => ({
        index: i,
        category: 'Discussion',
        title: (m.text || 'Message').slice(0, 40),
        description: (m.text || '').slice(0, 80),
      }));
    }

    // Merge AI events with original message data
    const result = events.map((ev: any) => {
      const msg = sorted[ev.index] || sorted[0];
      return {
        id: msg?.ts || String(ev.index),
        timestamp: msg?.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : new Date().toISOString(),
        userId: msg?.user || 'unknown',
        category: ev.category,
        title: ev.title,
        description: ev.description,
        rawText: msg?.text || '',
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Timeline generation failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate timeline.' });
  }
});

export default router;
