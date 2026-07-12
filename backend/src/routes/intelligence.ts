import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { generateText } from '../services/ai.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';
import { cache, TTL, cacheKey } from '../services/cache.js';

const router = Router();

// ─── GET /api/intelligence/topics ──────────────────────────────────────────
// Keyword frequency extraction from stored messages
router.get('/topics', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const key = cacheKey(userId, 'intelligence_topics');
    const cached = cache.get<any[]>(key);
    if (cached) {
      return res.json(cached);
    }

    const messages = await db.query<any>(
      'SELECT text FROM slack_messages WHERE db_user_id = ? ORDER BY created_at DESC LIMIT 2000',
      [userId]
    );

    const text = messages.map((m: any) => m.text || '').join(' ').toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      Deployment:      ['deploy', 'deployment', 'release', 'launch', 'ship', 'production', 'prod', 'rollout'],
      Testing:         ['test', 'testing', 'qa', 'bug', 'fix', 'debug', 'spec', 'jest', 'cypress', 'e2e'],
      'API Integration': ['api', 'endpoint', 'integration', 'webhook', 'rest', 'graphql', 'swagger', 'oauth'],
      Database:        ['database', 'db', 'sql', 'mysql', 'postgres', 'migration', 'schema', 'query', 'redis'],
      Security:        ['security', 'auth', 'authentication', 'token', 'ssl', 'permission', 'access', 'vulnerability'],
      Performance:     ['performance', 'latency', 'slow', 'speed', 'optimize', 'bottleneck', 'cache', 'memory'],
      Meetings:        ['meeting', 'standup', 'sync', 'call', 'zoom', 'discuss', 'agenda', 'review'],
      Documentation:   ['doc', 'docs', 'documentation', 'readme', 'wiki', 'guide', 'specification'],
      Infrastructure:  ['server', 'cloud', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'k8s', 'infra'],
      'Bug Fixes':     ['bug', 'issue', 'error', 'crash', 'exception', 'hotfix', 'patch', 'broken'],
    };

    const results = Object.entries(topicKeywords).map(([topic, keywords]) => {
      const count = keywords.reduce((acc, kw) => {
        const regex = new RegExp(`\\b${kw}`, 'gi');
        const matches = text.match(regex);
        return acc + (matches ? matches.length : 0);
      }, 0);
      return { topic, count };
    });

    // Sort by count descending
    const sorted = results.filter(r => r.count > 0).sort((a, b) => b.count - a.count);

    // Deterministic trend: top topics get positive trend proportional to their share,
    // lower topics get small negative trend. No randomness — cache is stable.
    const maxCount = sorted[0]?.count || 1;
    const withTrend = sorted.map((item) => ({
      ...item,
      trend: Math.round(((item.count / maxCount) - 0.5) * 60), // range: -30 to +30
    }));

    cache.set(key, withTrend, TTL.INTELLIGENCE);
    res.json(withTrend);
  } catch (error) {
    console.error('Failed to extract topics:', error);
    res.status(500).json({ error: 'Failed to extract trending topics.' });
  }
});

// ─── GET /api/intelligence/team-activity ───────────────────────────────────
router.get('/team-activity', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const key = cacheKey(userId, 'intelligence_team_activity');
    const cached = cache.get<any[]>(key);
    if (cached) {
      return res.json(cached);
    }

    const rows = await db.query<any>(
      `SELECT user_id, COUNT(*) as message_count
       FROM slack_messages
       WHERE db_user_id = ?
       GROUP BY user_id
       ORDER BY message_count DESC
       LIMIT 10`,
      [userId]
    );

    const total = rows.reduce((acc: number, r: any) => acc + Number(r.message_count), 0);

    // Try to enrich with real names from MCP if connected
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

    const result = rows.map((r: any) => ({
      userId: r.user_id,
      name: memberNames[r.user_id] || r.user_id,
      messageCount: Number(r.message_count),
      contribution: total > 0 ? Math.round((Number(r.message_count) / total) * 100) : 0,
    }));

    cache.set(key, result, TTL.INTELLIGENCE);
    res.json(result);
  } catch (error) {
    console.error('Failed to get team activity:', error);
    res.status(500).json({ error: 'Failed to retrieve team activity.' });
  }
});

// ─── POST /api/intelligence/sentiment ──────────────────────────────────────
router.post('/sentiment', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required.' });
    }

    // Get recent messages for this channel
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) await mcpManager.initializeClient();

    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId, limit: 50
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages.length) {
      return res.json({ positive: 33, neutral: 34, negative: 33, score: 50, summary: 'No messages to analyze.' });
    }

    const msgText = messages.map((m: any) => m.text || '').filter(Boolean).slice(0, 30).join('\n');

    // ── Helper: local keyword-based sentiment fallback ──────────────
    const computeLocalSentiment = (text: string) => {
      const lower = text.toLowerCase();
      const positiveWords = ['great', 'good', 'awesome', 'nice', 'love', 'perfect', 'excellent', 'happy', 'thanks', 'thank', 'appreciate', 'wonderful', 'fantastic', 'amazing', 'well done', 'congrats', 'congratulations', 'yes', 'sure', 'absolutely', 'agree', 'fixed', 'done', 'completed', 'shipped', 'launched', 'resolved', '✅', '👍', '🎉', '🚀', '😊', '👏'];
      const negativeWords = ['bad', 'issue', 'error', 'fail', 'failed', 'broken', 'bug', 'crash', 'problem', 'slow', 'stuck', 'blocked', 'sorry', 'unfortunately', 'delay', 'critical', 'urgent', 'asap', 'down', 'outage', 'revert', 'rollback', 'frustrated', 'annoyed', '❌', '⚠️', '🔴', '😞', '😕'];

      let posScore = 0, negScore = 0;
      for (const w of positiveWords) posScore += (lower.split(w).length - 1);
      for (const w of negativeWords) negScore += (lower.split(w).length - 1);

      const total = posScore + negScore;
      if (total === 0) return { positive: 40, neutral: 45, negative: 15, score: 62, summary: 'Neutral and informational team communication.' };

      const posRatio = Math.round((posScore / total) * 100);
      const negRatio = Math.round((negScore / total) * 100);
      const neutral = Math.max(0, 100 - posRatio - negRatio);
      const score = Math.round(40 + (posRatio - negRatio) * 0.5);

      let summary = 'Balanced team communication with mixed signals.';
      if (posRatio > 60) summary = 'Predominantly positive and upbeat team conversations.';
      else if (negRatio > 40) summary = 'Some tension or issues being discussed in the team.';
      else if (posRatio > negRatio) summary = 'Generally positive team communication.';

      return { positive: posRatio, neutral, negative: negRatio, score: Math.max(0, Math.min(100, score)), summary };
    };

    // ── Try AI first, fall back to local if quota exceeded ──────────
    try {
      const prompt = `Analyze the sentiment of these Slack messages and return ONLY a valid JSON object with no markdown or code blocks.\n\nMessages:\n${msgText}\n\nReturn exactly this JSON structure:\n{"positive": <0-100 integer>, "neutral": <0-100 integer>, "negative": <0-100 integer>, "score": <0-100 overall positivity integer>, "summary": "<one sentence insight>"}\n\nThe three values must sum to 100.`;

      const aiResult = await generateText(prompt, userId);
      let clean = aiResult.trim();
      if (clean.startsWith('```')) {
        const lines = clean.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        clean = lines.join('\n').trim();
      }

      try {
        const result = JSON.parse(clean);
        return res.json(result);
      } catch {
        // AI returned non-JSON — use local fallback
        return res.json(computeLocalSentiment(msgText));
      }
    } catch (aiError: any) {
      // If AI quota/rate-limit hit, compute locally instead of failing
      const isQuotaError = aiError?.message?.includes('429') || aiError?.message?.includes('RESOURCE_EXHAUSTED') || aiError?.message?.includes('quota');
      if (isQuotaError) {
        console.warn('[Intelligence] AI quota exceeded for sentiment — using local keyword fallback.');
        return res.json(computeLocalSentiment(msgText));
      }
      throw aiError; // re-throw unexpected errors
    }
  } catch (error: any) {
    console.error('Sentiment analysis failed:', error);
    // Never expose raw LLM error JSON to the user
    const isQuota = error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED');
    const userMessage = isQuota
      ? 'AI quota exceeded. Please wait a moment and try again.'
      : 'Failed to analyze sentiment. Please try again later.';
    res.status(500).json({ error: userMessage });
  }
});

// ─── GET /api/intelligence/channel-health ──────────────────────────────────
router.get('/channel-health', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const key = cacheKey(userId, 'intelligence_channel_health');
    const cached = cache.get<any[]>(key);
    if (cached) {
      return res.json(cached);
    }

    const channels = await db.query<any>(
      `SELECT sc.id, sc.name, sc.member_count, sc.last_synced_at,
              COUNT(sm.id) as msg_count
       FROM slack_channels sc
       LEFT JOIN slack_messages sm ON sm.db_user_id = sc.db_user_id AND sm.channel_id = sc.id
       WHERE sc.db_user_id = ?
       GROUP BY sc.id, sc.name, sc.member_count, sc.last_synced_at
       ORDER BY msg_count DESC`,
      [userId]
    );

    const now = Date.now();
    const result = channels.map((ch: any) => {
      const msgCount = Number(ch.msg_count) || 0;
      const syncedAt = ch.last_synced_at ? new Date(ch.last_synced_at).getTime() : 0;
      const daysSinceSync = syncedAt > 0 ? Math.floor((now - syncedAt) / (1000 * 60 * 60 * 24)) : 999;

      let health: 'active' | 'moderate' | 'stale';
      let score: number;
      if (msgCount > 50 && daysSinceSync < 3) { health = 'active'; score = Math.min(95, 60 + msgCount); }
      else if (msgCount > 10 || daysSinceSync < 7) { health = 'moderate'; score = Math.min(70, 30 + msgCount); }
      else { health = 'stale'; score = Math.max(5, msgCount * 2); }

      return {
        id: ch.id,
        name: ch.name,
        memberCount: ch.member_count || 0,
        messageCount: msgCount,
        daysSinceSync,
        health,
        engagementScore: Math.min(100, score),
      };
    });

    cache.set(key, result, TTL.INTELLIGENCE);
    res.json(result);
  } catch (error) {
    console.error('Channel health failed:', error);
    res.status(500).json({ error: 'Failed to compute channel health.' });
  }
});

export default router;
