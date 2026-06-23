import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { syncSlackWorkspace } from '../services/vectorStore.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';
import { generateText } from '../services/ai.js';
import { generateLocalFallbackSummary, generateLocalFallbackActionPlans } from '../services/fallback.js';


const router = Router();

// GET /api/channels
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const channels = await db.query('SELECT * FROM slack_channels WHERE db_user_id = ? ORDER BY name ASC', [req.user!.id]);
    res.json(channels);
  } catch (error) {
    console.error('Failed to query slack channels:', error);
    res.status(500).json({ error: 'Failed to retrieve cached channels.' });
  }
});

// GET /api/channels/users - Get mapped users
router.get('/users', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    const usersResponse = await mcpManager.callTool('slack_get_users', {});
    const parsedUsers = parseMCPResponse(usersResponse);
    const members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);
    
    const userMap: Record<string, { realName: string; name: string; avatar: string }> = {};
    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m.id) continue;
        userMap[m.id] = {
          realName: m.profile?.real_name || m.real_name || m.name || 'Unknown User',
          name: m.name || m.id,
          avatar: m.profile?.image_48 || m.profile?.image_32 || ''
        };
      }
    }
    res.json(userMap);
  } catch (error: any) {
    console.error('Failed to get slack users:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve slack users.' });
  }
});

// GET /api/channels/:id/messages - Retrieve live messages from Slack channel
router.get('/:id/messages', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  const limit = parseInt(req.query.limit as string) || 20;
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: limit
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);
    res.json(messages);
  } catch (error: any) {
    console.error('Failed to get live messages:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve live channel messages.' });
  }
});

// GET /api/channels/:id/summarize - Summarize live messages in a channel
router.get('/:id/summarize', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    
    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: 40
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages || messages.length === 0) {
      return res.json({ summary: 'No recent messages found in this channel to summarize.' });
    }

    const messagesText = messages.map((m: any) => `User ${m.user || 'bot'}: ${m.text || ''}`).reverse().join('\n');
    const prompt = `You are an expert workplace communication analyst.
Your task is to analyze Slack conversations and generate a PROFESSIONAL CHANNEL SUMMARY.

IMPORTANT RULES:
- DO NOT summarize message-by-message.
- DO NOT describe who said what unless it is critical.
- DO NOT generate a chat transcript.
- DO NOT create a chronological recap.

Instead:
1. Understand the overall purpose of the discussion.
2. Identify the main context.
3. Group related messages into topics.
4. Extract decisions.
5. Extract action items.
6. Extract blockers or concerns.
7. Produce a concise executive summary.

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT

# Conversation Summary

## Main Context
Provide a 2-4 sentence explanation of what the discussion was primarily about.

## Key Discussion Points
* Topic 1
* Topic 2
* Topic 3
...

## Important Insights
* Insight 1
* Insight 2
...

## Decisions Made
* Decision 1
(If none, state: "No explicit decisions were made.")

## Action Items
| Task | Owner | Status |
| ---- | ------ | ------- |
(If none, state: "No action items identified.")

## Risks / Blockers
List any blockers, concerns, dependencies, or unresolved questions.
(If none, state: "No blockers identified.")

## Participants
Mention only active contributors.

## Final Outcome
Summarize the final conclusion or result of the conversation in 2-3 sentences.

━━━━━━━━━━━━━━━━━━━━━━
WRITING STYLE
- Professional, Executive-friendly, Concise, Business-oriented.
- Focus on outcomes and meaning, not chronology or individual messages.

Slack Discussion:
${messagesText}`;
    
    let summary: string;
    try {
      summary = await generateText(prompt, userId);
    } catch (err: any) {
      if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        let members: any[] = [];
        try {
          const usersResponse = await mcpManager.callTool('slack_get_users', {});
          const parsedUsers = parseMCPResponse(usersResponse);
          members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);
        } catch (_) {}
        const channelInfo = await db.queryOne<{ name: string }>('SELECT name FROM slack_channels WHERE db_user_id = ? AND id = ?', [userId, channelId]);
        const channelName = channelInfo?.name || channelId;
        summary = generateLocalFallbackSummary(messages, channelName, members);
      } else {
        throw err;
      }
    }
    res.json({ summary });
  } catch (error: any) {
    console.error('Failed to summarize channel:', error);
    res.status(500).json({ error: error?.message || 'Failed to summarize channel.' });
  }
});

// GET /api/channels/:id/action-plans - Extract action items from a channel
router.get('/:id/action-plans', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    
    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: 50
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages || messages.length === 0) {
      return res.json([]);
    }

    const messagesText = messages.map((m: any) => `User ${m.user || 'bot'}: ${m.text || ''}`).reverse().join('\n');
    const prompt = `Extract all action plans, tasks, owners, and deadlines discussed in this channel. 
Return ONLY a valid JSON array of objects, with no markdown code blocks, backticks, or extra text. 
Each object must have these exact keys: task, owner, status, deadline.
If there are no tasks, return an empty array [].

Slack Discussion:
${messagesText}`;
    
    let tasks = [];
    try {
      const llmResult = await generateText(prompt, userId);
      
      // Clean markdown wrappers if any
      let content = llmResult.trim();
      if (content.startsWith('```')) {
        const lines = content.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        content = lines.join('\n').trim();
      }

      try {
        tasks = JSON.parse(content);
      } catch (parseErr) {
        console.warn('Failed to parse LLM action plans to JSON, raw text was:', content);
      }
    } catch (err: any) {
      if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        let members: any[] = [];
        try {
          const usersResponse = await mcpManager.callTool('slack_get_users', {});
          const parsedUsers = parseMCPResponse(usersResponse);
          members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);
        } catch (_) {}
        tasks = generateLocalFallbackActionPlans(messages, members);
      } else {
        throw err;
      }
    }

    res.json(tasks);
  } catch (error: any) {
    console.error('Failed to extract action items:', error);
    res.status(500).json({ error: error?.message || 'Failed to extract action items.' });
  }
});

// GET /api/channels/:id/active-members - Analyze channel active membership
router.get('/:id/active-members', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    
    // Get last 100 messages to check user activity levels
    const response = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: 100
    });
    const parsed = parseMCPResponse(response);
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (!messages || messages.length === 0) {
      return res.json([]);
    }

    // 1. Calculate posting frequencies per user
    const freqs: Record<string, number> = {};
    for (const m of messages) {
      const u = m.user;
      if (!u) continue;
      freqs[u] = (freqs[u] || 0) + 1;
    }

    const sortedUsers = Object.entries(freqs).sort((a, b) => b[1] - a[1]);

    // 2. Fetch workspace users profiles list to match IDs to names
    const usersResponse = await mcpManager.callTool('slack_get_users', {});
    const parsedUsers = parseMCPResponse(usersResponse);
    const members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);

    const memberMap = new Map<string, { realName: string; name: string; avatar: string }>();
    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m.id) continue;
        memberMap.set(m.id, {
          realName: m.profile?.real_name || m.real_name || m.name || 'Unknown User',
          name: m.name || m.id,
          avatar: m.profile?.image_48 || m.profile?.image_32 || ''
        });
      }
    }

    // 3. Construct the sorted output list
    const activeMembers = sortedUsers.map(([userId, count]) => {
      const details = memberMap.get(userId) || { realName: 'Unknown User', name: userId, avatar: '' };
      return {
        userId,
        count,
        realName: details.realName,
        name: details.name,
        avatar: details.avatar
      };
    });

    res.json(activeMembers);
  } catch (error: any) {
    console.error('Failed to analyze members:', error);
    res.status(500).json({ error: error?.message || 'Failed to analyze active members.' });
  }
});

// POST /api/channels/:id/messages - Post message directly to Slack channel
router.post('/:id/messages', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    const response = await mcpManager.callTool('slack_post_message', {
      channel_id: channelId,
      text: text
    });
    const parsed = parseMCPResponse(response);
    res.json({ message: 'Message posted successfully.', response: parsed });
  } catch (error: any) {
    console.error('Failed to post message to Slack:', error);
    res.status(500).json({ error: error?.message || 'Failed to post message to Slack.' });
  }
});

// POST /api/channels/retrieve-messages - On-Demand Slack Message Retriever
router.post('/retrieve-messages', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { query, currentChannelId } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }

    // 1. Fetch channel list from DB or fallback/auto-fetch via MCP if empty
    let channels = await db.query<{ id: string, name: string }>('SELECT id, name FROM slack_channels WHERE db_user_id = ?', [userId]);
    if (channels.length === 0) {
      try {
        const mcpResponse = await mcpManager.callTool('slack_list_channels', { types: ['public_channel'] });
        const parsedRes = parseMCPResponse(mcpResponse);
        const mcpChannels = parsedRes?.channels || (Array.isArray(parsedRes) ? parsedRes : []);
        if (Array.isArray(mcpChannels) && mcpChannels.length > 0) {
          const insertChannelQuery = `
            INSERT INTO slack_channels (db_user_id, id, name, is_private, topic, purpose, member_count, last_synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
            ON DUPLICATE KEY UPDATE name = VALUES(name), last_synced_at = CURRENT_TIMESTAMP()
          `;
          for (const ch of mcpChannels) {
            await db.execute(insertChannelQuery, [
              userId,
              ch.id,
              ch.name || ch.id,
              ch.is_private ? 1 : 0,
              ch.topic?.value || '',
              ch.purpose?.value || '',
              ch.num_members || 0
            ]);
          }
          channels = await db.query<{ id: string, name: string }>('SELECT id, name FROM slack_channels WHERE db_user_id = ?', [userId]);
        }
      } catch (err) {
        console.error('Failed to auto-fetch slack channels during retrieval:', err);
      }
    }

    // 2. Parse the query locally using regex — NO LLM call needed
    const q = query.toLowerCase().trim();

    interface ParsedParams {
      channelName: string | null;
      limit: number;
      username: string | null;
      keyword: string | null;
      timeWindowMinutes: number | null;
      explanation: string;
    }

    const params: ParsedParams = {
      channelName: null,
      limit: 50,
      username: null,
      keyword: null,
      timeWindowMinutes: null,
      explanation: ''
    };

    // --- Channel: "from #general", "in general", "channel general" ---
    const channelMatch = q.match(/(?:from\s+#?|in\s+#?|channel\s+#?)([a-z0-9_-]+)/);
    if (channelMatch) {
      params.channelName = channelMatch[1];
    }

    // --- Username: "@gowtham", "from gowtham", "by gowtham", "messages from gowtham" ---
    const userAtMatch = q.match(/@([a-z0-9._-]+)/);
    const userFromMatch = !userAtMatch && q.match(/(?:from|by)\s+([a-z][a-z0-9._\- ]+?)(?:\s+in|\s+from|\s+containing|\s+keyword|$)/);
    if (userAtMatch) {
      params.username = userAtMatch[1];
    } else if (userFromMatch && !params.channelName) {
      params.username = userFromMatch[1].trim();
    }

    // --- Explicit message count: "last 50 messages", "latest 100 msgs", "50 messages" ---
    const countMatch = q.match(/(?:last|latest|top|get|show|fetch)?\s*(\d+) \s*(?:messages?|msgs?)/);
    if (countMatch) {
      params.limit = Math.max(1, Math.min(200, parseInt(countMatch[1])));
    }

    // --- Time window: "last 30 mins", "last 2 hours", "today", "last hour", "recent", "latest" ---
    const minsMatch = q.match(/last\s+(\d+)\s+(?:min(?:ute)?s?)/);
    const hoursMatch = q.match(/last\s+(\d+)\s+hours?/);
    const daysMatch = q.match(/last\s+(\d+)\s+days?/);
    const todayMatch = q.match(/\btoday\b/);
    const weekMatch = q.match(/\b(?:last\s+week|this\s+week)\b/);
    const lastHourMatch = q.match(/\blast\s+hour\b/);
    const recentMatch = q.match(/\b(?:latest|recent|new)\b/);

    if (minsMatch) {
      params.timeWindowMinutes = parseInt(minsMatch[1]);
    } else if (hoursMatch) {
      params.timeWindowMinutes = parseInt(hoursMatch[1]) * 60;
    } else if (daysMatch) {
      params.timeWindowMinutes = parseInt(daysMatch[1]) * 1440;
    } else if (lastHourMatch) {
      params.timeWindowMinutes = 60;
    } else if (todayMatch) {
      params.timeWindowMinutes = 1440;
    } else if (weekMatch) {
      params.timeWindowMinutes = 10080;
    }

    // --- Keyword filter: "containing X", "with X", "keyword X", or quoted "X" ---
    const containingMatch = q.match(/(?:containing|contains|with|keyword)\s+"?([^"]+?)"?(?:\s+from|\s+in|$)/);
    const quotedMatch = !containingMatch && q.match(/"([^"]+)"/);
    if (containingMatch) {
      params.keyword = containingMatch[1].trim();
    } else if (quotedMatch) {
      params.keyword = quotedMatch[1].trim();
    }

    // --- Fallback Keyword Extraction ---
    if (!params.keyword) {
      let cleanQ = q;
      cleanQ = cleanQ.replace(/(?:from\s+#?|in\s+#?|channel\s+#?)[a-z0-9_-]+/g, '');
      cleanQ = cleanQ.replace(/(?:last|latest|top|get|show|fetch)?\s*\d+\s+(?:messages?|msgs?)/g, '');
      cleanQ = cleanQ.replace(/last\s+\d+\s+(?:min(?:ute)?s?|hours?|days?)/g, '');
      cleanQ = cleanQ.replace(/\b(?:today|last\s+week|this\s+week|last\s+hour|latest|recent|new)\b/g, '');
      cleanQ = cleanQ.replace(/@([a-z0-9._-]+)/g, '');
      
      if (params.username) {
        const userEscaped = params.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const userRemoveRegex = new RegExp(`(?:from|by)\\s+${userEscaped}`, 'gi');
        cleanQ = cleanQ.replace(userRemoveRegex, '');
      }

      cleanQ = cleanQ.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"?]/g, '');
      cleanQ = cleanQ.trim().replace(/\s+/g, ' ');

      if (cleanQ.length > 0) {
        params.keyword = cleanQ;
      }
    }

    // --- Intent Detection Classifier ---
    let intent: 'LATEST' | 'LAST_N' | 'TIME_RANGE' | 'KEYWORD' | 'SEMANTIC' | 'USER' | 'CHANNEL' = 'KEYWORD';

    const isLatestQuery = /^(?:show\s+)?(?:latest|recent|new)(?:\s+msgs?|\s+messages?)?$/.test(q);
    const isLastNQuery = countMatch !== null;
    const isTimeRangeQuery = isTimeRangeTrigger(q);

    function isTimeRangeTrigger(str: string): boolean {
      return /\b(?:last\s+\d+\s+(?:min|minute|hour|day)s?|today|yesterday|last\s+week|last\s+month|last\s+hour)\b/.test(str);
    }

    const hasExplicitKeyword = containingMatch !== null || quotedMatch !== null;

    if (!hasExplicitKeyword) {
      if (isLatestQuery) {
        intent = 'LATEST';
        params.keyword = null;
      } else if (isLastNQuery) {
        intent = 'LAST_N';
        params.keyword = null;
      } else if (isTimeRangeQuery) {
        intent = 'TIME_RANGE';
        params.keyword = null;
      } else if (params.username && q.replace(/(?:from|by)\s+[a-z0-9._\- ]+/g, '').trim().length === 0) {
        intent = 'USER';
        params.keyword = null;
      } else if (params.channelName && q.replace(/(?:in|from|channel)\s+#?[a-z0-9_-]+/g, '').trim().length === 0) {
        intent = 'CHANNEL';
        params.keyword = null;
      } else {
        const words = q.split(' ').filter((w: string) => w.length > 2);
        if (words.length >= 3) {
          intent = 'SEMANTIC';
        } else {
          intent = 'KEYWORD';
        }
      }
    }

    // Set search basis explanation
    params.explanation = params.keyword ? `Searching for: "${params.keyword}"` : 'Searching...';

    // 3. Resolve Channel ID
    let channelId = currentChannelId;
    let matchedChannelName = '';
    
    if (params.channelName) {
      const cleanName = params.channelName.toLowerCase().replace(/^#/, '');
      const matched = channels.find(c => c.name.toLowerCase() === cleanName);
      if (matched) {
        channelId = matched.id;
        matchedChannelName = matched.name;
      }
    }

    if (!channelId && channels.length > 0) {
      channelId = channels[0].id;
      matchedChannelName = channels[0].name;
    } else if (channelId && !matchedChannelName) {
      const matched = channels.find(c => c.id === channelId);
      if (matched) {
        matchedChannelName = matched.name;
      }
    }

    if (!channelId) {
      return res.status(404).json({ error: 'No Slack channels could be resolved. Please sync your workspace first.' });
    }

    // 4. Resolve username/real name to user ID
    let filterUserId: string | null = null;
    let matchedRealName = '';
    if (params.username) {
      try {
        const cleanUsername = params.username.toLowerCase().replace(/^@/, '');
        const usersResponse = await mcpManager.callTool('slack_get_users', {});
        const parsedUsers = parseMCPResponse(usersResponse);
        const members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);
        if (Array.isArray(members)) {
          const matchedUser = members.find((m: any) => {
            const name = (m.name || '').toLowerCase();
            const realName = (m.real_name || m.profile?.real_name || '').toLowerCase();
            const displayName = (m.profile?.display_name || '').toLowerCase();
            return name === cleanUsername || realName === cleanUsername || displayName === cleanUsername || realName.includes(cleanUsername);
          });
          if (matchedUser) {
            filterUserId = matchedUser.id;
            matchedRealName = matchedUser.profile?.real_name || matchedUser.real_name || matchedUser.name;
          }
        }
      } catch (err) {
        console.error('Failed to fetch Slack users for username matching:', err);
      }
    }

    // 5. Fetch message history based on intent
    let fetchLimit = 100;
    if (intent === 'LATEST') {
      fetchLimit = 5;
    } else if (intent === 'LAST_N') {
      fetchLimit = params.limit || 50;
    }

    const historyResponse = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: fetchLimit
    });
    
    const parsedHistory = parseMCPResponse(historyResponse);
    let messages = parsedHistory?.messages || (Array.isArray(parsedHistory) ? parsedHistory : []);
    const initialCount = messages.length;

    // Filter by user ID if requested (for any mode)
    if (filterUserId) {
      messages = messages.filter((m: any) => m.user === filterUserId);
    }

    // Set dynamic explanation basis based on intent
    let explanationText = '';
    if (intent === 'LATEST') {
      explanationText = `Showing latest ${messages.length} messages`;
    } else if (intent === 'LAST_N') {
      explanationText = `Showing latest ${messages.length} messages`;
    } else if (intent === 'TIME_RANGE') {
      const rangeText = q.includes('hour') ? 'the past hour' : q.includes('today') ? 'today' : q.includes('yesterday') ? 'yesterday' : 'the specified time range';
      explanationText = `Showing messages from ${rangeText}`;
    } else if (intent === 'USER') {
      explanationText = `Showing messages from ${matchedRealName || params.username}`;
    } else if (intent === 'CHANNEL') {
      explanationText = `Showing messages in #${matchedChannelName}`;
    } else {
      explanationText = `Searching for "${params.keyword || query}"`;
    }

    let finalMessages = [];

    // Route logic
    if (intent === 'LATEST' || intent === 'LAST_N' || intent === 'TIME_RANGE' || intent === 'USER' || intent === 'CHANNEL') {
      // For chronological, user, or time-range queries: do NOT score or threshold!
      // Simply filter by time ranges if required
      if (intent === 'TIME_RANGE' && params.timeWindowMinutes) {
        const cutoffTs = (Date.now() / 1000) - (params.timeWindowMinutes * 60);
        messages = messages.filter((m: any) => {
          const msgTs = parseFloat(m.ts);
          return !isNaN(msgTs) && msgTs >= cutoffTs;
        });
      }
      
      // Map to return format
      finalMessages = messages.map((m: any) => ({
        ...m,
        relevanceScore: 100, // standard complete relevance for direct retrieval requests
        matchedTerms: []
      }));
    } else {
      // KEYWORD or SEMANTIC Search with Scoring & Threshold (score >= 70)
      const cleanText = (txt: string) => {
        return txt
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"?]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      function getLevenshteinDistance(a: string, b: string): number {
        const tmp = [];
        for (let i = 0; i <= a.length; i++) tmp[i] = [i];
        for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(
              tmp[i - 1][j] + 1,
              tmp[i][j - 1] + 1,
              tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
          }
        }
        return tmp[a.length][b.length];
      }

      function getSimilarityRatio(a: string, b: string): number {
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1.0;
        return 1.0 - getLevenshteinDistance(a, b) / maxLen;
      }

      const searchKeyword = params.keyword || '';
      const normalizedQuery = cleanText(searchKeyword || query);
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);

      const STOPWORDS = new Set(['the', 'and', 'for', 'this', 'that', 'with', 'from', 'have', 'were', 'was', 'are', 'you', 'your', 'select', 'where']);

      const CONCEPT_EXPANSIONS: Record<string, string[]> = {
        bahubali: ["bahubali", "baahubali", "mahishmati", "katappa", "bhallaladeva", "amarendra", "mahendra", "devasena", "sivagami", "rajamouli", "epic", "kingdom", "movie", "film"],
        baahubali: ["bahubali", "baahubali", "mahishmati", "katappa", "bhallaladeva", "amarendra", "mahendra", "devasena", "sivagami", "rajamouli", "epic", "kingdom", "movie", "film"],
        pushpa: ["pushpa", "allu arjun", "sukumar", "rashmika", "fahadh", "red sanders", "shekhawat", "movie", "film"],
        project: ["project", "deployment", "jira", "sprint", "milestone", "release", "frontend", "backend", "database", "sync"],
        tech: ["api", "mcp", "typescript", "node", "express", "sqlite", "react", "nextjs", "embeddings", "vector"]
      };

      const activeConcepts = new Set<string>();
      const conceptTerms = new Set<string>();

      for (const word of queryWords) {
        if (STOPWORDS.has(word)) continue;
        if (CONCEPT_EXPANSIONS[word]) {
          activeConcepts.add(word);
          CONCEPT_EXPANSIONS[word].forEach(t => conceptTerms.add(t));
        }
        for (const [key, terms] of Object.entries(CONCEPT_EXPANSIONS)) {
          if (terms.includes(word) || terms.some(t => getSimilarityRatio(t, word) > 0.8)) {
            activeConcepts.add(key);
            terms.forEach(t => conceptTerms.add(t));
          }
        }
      }

      const scoredMessages = [];
      const nowSeconds = Date.now() / 1000;
      const twoHoursInSeconds = 2 * 60 * 60;

      for (const msg of messages) {
        const msgText = msg.text || '';
        const normalizedMsg = cleanText(msgText);
        const msgWords = normalizedMsg.split(' ').filter(w => w.length > 2);

        let keywordScore = 0;
        let semanticScore = 0;
        let entityScore = 0;
        let recencyScore = 0;
        const matchedTerms = new Set<string>();

        // 1. Keyword Match (+50)
        const nonTrivialQueryWords = queryWords.filter(w => !STOPWORDS.has(w));
        let hasKeywordMatch = false;
        for (const qw of nonTrivialQueryWords) {
          if (msgWords.includes(qw) || normalizedMsg.includes(qw)) {
            hasKeywordMatch = true;
            matchedTerms.add(qw);
          }
        }
        if (hasKeywordMatch) {
          keywordScore = 50;
        }

        // 2. Semantic/Fuzzy Match (+30)
        let maxFuzzyRatio = 0;
        for (const qw of nonTrivialQueryWords) {
          for (const mw of msgWords) {
            const ratio = getSimilarityRatio(qw, mw);
            if (ratio > maxFuzzyRatio) {
              maxFuzzyRatio = ratio;
            }
            if (ratio >= 0.75) {
              matchedTerms.add(mw);
            }
          }
        }
        if (maxFuzzyRatio >= 0.75) {
          semanticScore = Math.round(maxFuzzyRatio * 30);
        }

        // 3. Entity Match (+20)
        let hasEntityMatch = false;
        for (const ct of conceptTerms) {
          if (STOPWORDS.has(ct)) continue;
          if (msgWords.includes(ct) || normalizedMsg.includes(ct)) {
            hasEntityMatch = true;
            matchedTerms.add(ct);
          }
        }
        if (hasEntityMatch) {
          entityScore = 20;
        }

        // 4. Recent Message Bonus (+5)
        const msgTs = parseFloat(msg.ts);
        if (!isNaN(msgTs) && (nowSeconds - msgTs) <= twoHoursInSeconds) {
          recencyScore = 5;
        }

        const totalScore = keywordScore + semanticScore + entityScore + recencyScore;

        if (totalScore >= 70) {
          scoredMessages.push({
            ...msg,
            relevanceScore: totalScore,
            semanticSimilarity: maxFuzzyRatio,
            matchedTerms: Array.from(matchedTerms),
            recency: msgTs
          });
        }
      }

      scoredMessages.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        if (b.semanticSimilarity !== a.semanticSimilarity) {
          return b.semanticSimilarity - a.semanticSimilarity;
        }
        return b.recency - a.recency;
      });

      const limitCount = Math.min(20, params.limit || 10);
      finalMessages = scoredMessages.slice(0, limitCount);

      if (finalMessages.length > 0) {
        explanationText = `Found ${finalMessages.length} relevant messages`;
      } else {
        explanationText = `No relevant messages found`;
      }
    }

    let summary = 'No matching messages found.';
    let participants: string[] = [];
    let relatedTopics: string[] = [];

    if (finalMessages.length > 0) {
      // Extract unique participants
      const uniqueUsers = [...new Set(finalMessages.map((m: any) => m.user).filter(Boolean))];
      let memberNames: Record<string, string> = {};
      try {
        const usersResponse = await mcpManager.callTool('slack_get_users', {});
        const parsedUsers = parseMCPResponse(usersResponse);
        const members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);
        if (Array.isArray(members)) {
          for (const m of members) {
            if (m.id) memberNames[m.id] = m.real_name || m.name || m.id;
          }
        }
      } catch (_) {}

      participants = uniqueUsers.map((u: any) => memberNames[u] || u);

      // Extract topics locally
      const text = finalMessages.map((m: any) => m.text || '').join(' ').toLowerCase();
      const potentialTopics = ['Deployment', 'Testing', 'API Integration', 'Database', 'Security', 'Performance', 'Bug Fixes'];
      const topicKeywords: Record<string, string[]> = {
        Deployment: ['deploy', 'deployment', 'release', 'launch', 'prod'],
        Testing: ['test', 'testing', 'qa', 'jest', 'cypress'],
        'API Integration': ['api', 'endpoint', 'integration', 'oauth'],
        Database: ['database', 'db', 'sql', 'mysql', 'postgres', 'schema'],
        Security: ['security', 'auth', 'token', 'permission'],
        Performance: ['performance', 'latency', 'optimize', 'cache'],
        'Bug Fixes': ['bug', 'fix', 'error', 'crash', 'issue']
      };
      relatedTopics = potentialTopics.filter(t => 
        topicKeywords[t].some(kw => text.includes(kw))
      );
      if (relatedTopics.length === 0) {
        relatedTopics = ['General Discussion'];
      }

      // Generate AI Summary of search results
      try {
        const msgsStr = finalMessages.slice(0, 15).map((m: any) => {
          const name = memberNames[m.user] || m.user;
          return `${name}: ${m.text}`;
        }).join('\n');
        const prompt = `Review these Slack messages retrieved for the query "${query}".
Summarize the key takeaways and context in 2-3 sentences. Keep it concise.
Messages:
${msgsStr}`;
        const summaryText = await generateText(prompt, userId);
        summary = summaryText.trim();
      } catch (err) {
        summary = `Found ${finalMessages.length} matching messages in #${matchedChannelName}.`;
      }
    }

    res.json({
      success: true,
      explanation: explanationText,
      channelId,
      channelName: matchedChannelName,
      messages: finalMessages,
      summary,
      participants,
      relatedTopics,
      filters: {
        limit: fetchLimit,
        username: params.username || null,
        userId: filterUserId,
        matchedRealName: matchedRealName || null,
        keyword: params.keyword || null,
        initialCount,
        finalCount: finalMessages.length
      }
    });

  } catch (error: any) {
    console.error('Failed to retrieve on-demand Slack messages:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve on-demand Slack messages.' });
  }
});

// POST /api/channels/sync
router.post('/sync', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    console.log('Starting manual Slack workspace sync...');
    
    // Sync first 10 channels, 50 messages each for quick local setup
    const stats = await syncSlackWorkspace(userId, 10, 50);
    
    console.log('Workspace sync complete:', stats);
    res.json({
      message: 'Workspace synced successfully.',
      ...stats
    });
  } catch (error: any) {
    console.error('Workspace sync failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to sync workspace.' });
  }
});

export default router;
