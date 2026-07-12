import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { slackToUnicode, getBotUserIdForUser, getHumanSlackUserIdForUser } from '../utils/emoji.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { syncSlackWorkspace } from '../services/vectorStore.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';
import { generateText, generateTextStream } from '../services/ai.js';
import { generateLocalFallbackSummary, generateLocalFallbackActionPlans } from '../services/fallback.js';
import { cache, TTL, cacheKey } from '../services/cache.js';
import { sanitizeAIError } from '../middleware/errorHandler.js';


import { FileService } from '../services/fileService.js';

import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });


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

// GET /api/channels/users - Get mapped users (cached 5 min)
router.get('/users', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const key = cacheKey(userId, 'slack_users');
    const cached = cache.get<Record<string, { realName: string; name: string; avatar: string }>>(key);
    if (cached) {
      return res.json(cached);
    }

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

    cache.set(key, userMap, TTL.SLACK_USERS);
    res.json(userMap);
  } catch (error: any) {
    console.error('Failed to get slack users:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve slack users.' });
  }
});


const fileService = FileService.getInstance();

export async function saveFileMetadata(file: any) {
  await fileService.saveFileMetadata(file);
}

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
    if (parsed && parsed.ok === false) {
      console.error(`[Slack API Error] Failed to fetch history for channel ${channelId}:`, parsed.error);
    }
    const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);

    if (messages.length === 0) {
      return res.json([]);
    }

    // Batch all metadata queries — one query each instead of one per message
    const messageIds = messages.map((m: any) => m.ts);
    const placeholders = messageIds.map(() => '?').join(',');

    const [reactionsAll, pinsAll, bookmarksAll] = await Promise.all([
      db.query<any>(`SELECT emoji, user_id, message_id FROM chat_reactions WHERE message_id IN (${placeholders})`, messageIds),
      db.query<any>(`SELECT message_id, pinned_by FROM chat_pins WHERE message_id IN (${placeholders}) AND session_id = ?`, [...messageIds, channelId]),
      db.query<any>(`SELECT message_id FROM chat_bookmarks WHERE message_id IN (${placeholders}) AND user_id = ?`, [...messageIds, userId]),
    ]);

    // Build O(1) lookup maps
    const reactionsMap = new Map<string, any[]>();
    for (const r of reactionsAll) {
      if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, []);
      reactionsMap.get(r.message_id)!.push({ emoji: r.emoji, user_id: r.user_id });
    }
    const pinMap = new Map<string, any>(pinsAll.map((p: any) => [p.message_id, p]));
    const bookmarkSet = new Set<string>(bookmarksAll.map((b: any) => b.message_id));

    const botUserId = await getBotUserIdForUser(userId);
    const humanSlackUserId = await getHumanSlackUserIdForUser(userId);

    const formattedMessages = messages.map((m: any) => {
      const pin = pinMap.get(m.ts);
      
      // Parse Slack native reactions
      const slackReactions: any[] = [];
      if (m.reactions && Array.isArray(m.reactions)) {
        for (const sr of m.reactions) {
          const unicodeEmoji = slackToUnicode(sr.name);
          if (sr.users && Array.isArray(sr.users)) {
            for (const sUser of sr.users) {
              const resolvedUserId = (sUser === botUserId || (humanSlackUserId && sUser === humanSlackUserId)) ? 1 : sUser;
              slackReactions.push({
                emoji: unicodeEmoji,
                user_id: resolvedUserId
              });
            }
          }
        }
      }

      // Merge with local reactions
      const localReactions = reactionsMap.get(m.ts) || [];
      const combinedMap = new Map<string, any>();
      for (const r of slackReactions) {
        combinedMap.set(`${r.emoji}_${r.user_id}`, r);
      }
      for (const r of localReactions) {
        combinedMap.set(`${r.emoji}_${r.user_id}`, r);
      }
      const combinedReactions = Array.from(combinedMap.values());

      return {
        ...m,
        id: m.ts,
        reactions: combinedReactions,
        isPinned: !!pin,
        pinnedBy: pin ? pin.pinned_by : null,
        isBookmarked: bookmarkSet.has(m.ts),
        replyCount: m.reply_count || 0
      };
    });

    // Cache any Slack files metadata in our database
    for (const m of messages) {
      if (m.files && Array.isArray(m.files)) {
        for (const file of m.files) {
          await saveFileMetadata(file);
        }
      }
    }

    res.json(formattedMessages);
  } catch (error: any) {
    console.error('Failed to get live messages:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve live channel messages.' });
  }
});


// GET /api/channels/:id/summarize - Summarize live messages in a channel (cached 10 min)
router.get('/:id/summarize', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  try {
    const userId = req.user!.id;
    const key = cacheKey(userId, 'summarize', channelId);
    const cached = cache.get<{ summary: string }>(key);
    if (cached) {
      return res.json(cached);
    }

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
Your task is to analyze Slack conversations and generate a PROFESSIONAL, COMPREHENSIVE CHANNEL SUMMARY.

IMPORTANT RULES:
- DO NOT summarize message-by-message.
- DO NOT generate a chronological recap or chat transcript.
- DO NOT ignore any discussion topic. If multiple distinct topics are discussed (e.g., specific movies like Pushpa or Bahubali, meeting schedules, codebase bugs, deployment issues), you MUST list and describe each one under "Main Topics"!

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT - YOU MUST INCLUDE ALL 14 SECTIONS BELOW WITH THESE EXACT HEADINGS:

# Conversation Summary

## 1. Executive Summary
Provide a concise, high-level synthesis (2-4 sentences) summarizing the conversation.

## 2. Main Topics
Provide a detailed breakdown of EVERY distinct topic discussed. Do not ignore any topic. If they discussed multiple separate things, summarize each one clearly.

## 3. Key Decisions
List all explicit agreements, decisions, or resolutions. (If none, state "No explicit decisions were made.")

## 4. Important Updates
List any major status updates or project progress items shared.

## 5. Action Items
Provide a structured Markdown table:
| Task | Owner | Status |
(If none, state "No action items identified.")

## 6. Deadlines & Milestones
List any dates, times, or milestones mentioned for deliverables.

## 7. Risks & Blockers
List any blocker issues, code design friction, environment downtime, or project risks.

## 8. Open Questions
List any unresolved questions, dependencies, or outstanding inquiries.

## 9. Participants
List all active users/contributors who participated in the conversation.

## 10. Mentioned Files
List all file names, uploads, or attachments shared or referenced. (If none, state "None.")

## 11. Mentioned Links
List all URLs, links, or web resources shared. (If none, state "None.")

## 12. Technical Discussions
Summarize technical details, architecture decisions, database changes, or code review points discussed.

## 13. Business Discussions
Summarize business objectives, client requirements, operational updates, or project planning points discussed.

## 14. Final Outcome
Synthesize the ultimate conclusion or result of the discussion in 2-3 sentences.

━━━━━━━━━━━━━━━━━━━━━━
Slack Discussion:
${messagesText}`;
    
    const shouldStream = req.query.stream === 'true';

    if (shouldStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      let completeSummary = '';
      try {
        completeSummary = await generateTextStream(prompt, userId, (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        });
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
          completeSummary = generateLocalFallbackSummary(messages, channelName, members);
          res.write(`data: ${JSON.stringify({ token: completeSummary })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ error: err?.message || String(err) })}\n\n`);
          return res.end();
        }
      }

      cache.set(key, { summary: completeSummary }, TTL.CHANNEL_SUMMARY);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

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
    const result = { summary };
    cache.set(key, result, TTL.CHANNEL_SUMMARY);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to summarize channel:', error);
    res.status(500).json({ error: sanitizeAIError(error, 'Failed to summarize channel.') });
  }
});

// GET /api/channels/:id/action-plans - Extract action items from a channel (cached 10 min)
router.get('/:id/action-plans', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  try {
    const userId = req.user!.id;
    const plansKey = cacheKey(userId, 'action_plans', channelId);
    const cachedPlans = cache.get<any[]>(plansKey);
    if (cachedPlans) {
      return res.json(cachedPlans);
    }

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

    if (tasks && tasks.length > 0) {
      cache.set(plansKey, tasks, TTL.ACTION_PLANS);
    }
    res.json(tasks);
  } catch (error: any) {
    console.error('Failed to extract action items:', error);
    res.status(500).json({ error: sanitizeAIError(error, 'Failed to extract action items.') });
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

async function uploadAttachmentToSlack(token: string, channelId: string, attachment: { name: string; data: string; type: string }) {
  try {
    // 1. Parse Base64 data to buffer
    const match = attachment.data.match(/^data:(.+);base64,(.+)$/);
    const base64Data = match ? match[2] : attachment.data;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 2. Call files.getUploadURLExternal
    const getUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        filename: attachment.name,
        length: String(buffer.length),
      }).toString()
    });
    
    const urlData = await getUrlResponse.json() as any;
    if (!urlData.ok) {
      throw new Error(`getUploadURLExternal failed: ${urlData.error || 'unknown error'}`);
    }
    
    // 3. Upload the file to the upload_url
    const uploadResponse = await fetch(urlData.upload_url, {
      method: 'POST',
      body: buffer
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload to Slack S3 storage failed with status ${uploadResponse.status}`);
    }
    
    // 4. Call files.completeUploadExternal
    const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel_id: channelId,
        files: [{ id: urlData.file_id }]
      })
    });
    
    const completeData = await completeResponse.json() as any;
    if (!completeData.ok) {
      throw new Error(`completeUploadExternal failed: ${completeData.error || 'unknown error'}`);
    }
    
    if (completeData.files && Array.isArray(completeData.files)) {
      for (const file of completeData.files) {
        await saveFileMetadata(file);
      }
    }
    
    return completeData;
  } catch (err: any) {
    console.error(`Failed to upload attachment ${attachment.name} to Slack:`, err);
    throw err;
  }
}

// POST /api/channels/:id/messages - Post message directly to Slack channel
router.post('/:id/messages', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const channelId = req.params.id;
  const { text, attachments, fileIds, threadTs } = req.body;

  if (!text && (!attachments || attachments.length === 0) && (!fileIds || fileIds.length === 0)) {
    return res.status(400).json({ error: 'Message text, attachments, or fileIds are required.' });
  }

  try {
    const userId = req.user!.id;
    const tokenRow = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE user_id = ? AND `key` = ?', [userId, 'mcp_slack_bot_token']);
    const token = tokenRow?.value;

    if (!token) {
      return res.status(400).json({ error: 'Slack Bot Token is not configured.' });
    }

    let postResponse: any = null;

    // A. Support the new Slack file upload completion flow
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel_id: channelId,
          files: fileIds.map(id => ({ id })),
          initial_comment: text || undefined,
          thread_ts: threadTs || undefined
        })
      });

      const completeData = await completeResponse.json() as any;
      if (!completeData.ok) {
        throw new Error(`completeUploadExternal failed: ${completeData.error || 'unknown error'}`);
      }
      if (completeData.files && Array.isArray(completeData.files)) {
        for (const file of completeData.files) {
          await saveFileMetadata(file);
        }
      }
      postResponse = completeData;
    } 
    // B. Fallback to old base64 attachments if present
    else if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        await uploadAttachmentToSlack(token, channelId, att);
      }
      if (text) {
        const mcpManager = MCPClientManager.getInstance(userId);
        if (!mcpManager.isConnected()) {
          await mcpManager.initializeClient();
        }
        const response = await mcpManager.callTool('slack_post_message', {
          channel_id: channelId,
          text: text
        });
        postResponse = parseMCPResponse(response);
      }
    } 
    // C. Regular text message
    else {
      const mcpManager = MCPClientManager.getInstance(userId);
      if (!mcpManager.isConnected()) {
        await mcpManager.initializeClient();
      }
      if (threadTs) {
        const response = await mcpManager.callTool('slack_reply_to_thread', {
          channel_id: channelId,
          thread_ts: threadTs,
          text: text
        });
        postResponse = parseMCPResponse(response);
      } else {
        const response = await mcpManager.callTool('slack_post_message', {
          channel_id: channelId,
          text: text
        });
        postResponse = parseMCPResponse(response);
      }
    }

    res.json({ message: 'Message posted successfully.', response: postResponse });
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
    const minsMatch = q.match(/last\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:min(?:ute)?s?)/);
    const hoursMatch = q.match(/last\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+hours?/);
    const daysMatch = q.match(/last\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?/);
    const todayMatch = q.match(/\btoday\b/);
    const weekMatch = q.match(/\b(?:last\s+week|this\s+week)\b/);
    const lastHourMatch = q.match(/\blast\s+(?:one|an)?\s*hour\b/);
    const recentMatch = q.match(/\b(?:latest|recent|new)\b/);

    const mapNumberWord = (word: string): number => {
      const parsed = parseInt(word);
      if (!isNaN(parsed)) return parsed;
      const mapping: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10
      };
      return mapping[word.toLowerCase()] || 1;
    };

    if (minsMatch) {
      params.timeWindowMinutes = mapNumberWord(minsMatch[1]);
    } else if (hoursMatch) {
      params.timeWindowMinutes = mapNumberWord(hoursMatch[1]) * 60;
    } else if (daysMatch) {
      params.timeWindowMinutes = mapNumberWord(daysMatch[1]) * 1440;
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
      return /\b(?:last\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|an)\s+(?:min|minute|hour|day)s?|today|yesterday|last\s+week|last\s+month|last\s+(?:one|an)?\s*hour)\b/.test(str);
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

        // 1. Keyword & Synonym Concept Match (+50)
        const nonTrivialQueryWords = queryWords.filter(w => !STOPWORDS.has(w));
        let hasKeywordMatch = false;
        for (const qw of nonTrivialQueryWords) {
          if (msgWords.includes(qw) || normalizedMsg.includes(qw)) {
            hasKeywordMatch = true;
            matchedTerms.add(qw);
          } else {
            // Perform concept mapping matching (e.g. bahubali concept synonyms)
            const synonyms = CONCEPT_EXPANSIONS[qw];
            if (synonyms) {
              for (const syn of synonyms) {
                if (msgWords.includes(syn) || normalizedMsg.includes(syn)) {
                  hasKeywordMatch = true;
                  matchedTerms.add(syn);
                  break;
                }
              }
            }
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
    
    // Invalidate user's cache after synchronization
    cache.delByPrefix(cacheKey(userId, ''));
    
    console.log('Workspace sync complete:', stats);
    res.json({
      message: 'Workspace synced successfully.',
      ...stats
    });
  } catch (error: any) {
    console.error('Workspace sync failed:', error);
    res.status(500).json({ error: sanitizeAIError(error, 'Failed to sync workspace.') });
  }
});

// GET /api/channels/:channelId/messages/:ts/thread - Fetch Slack thread replies
router.get('/:channelId/messages/:ts/thread', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { channelId, ts } = req.params;
  try {
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }
    const response = await mcpManager.callTool('slack_get_thread_replies', {
      channel_id: channelId,
      thread_ts: ts
    });
    const parsed = parseMCPResponse(response);
    const replies = parsed?.messages || (Array.isArray(parsed) ? parsed : []);
    
    const formatted = replies.map((r: any) => ({
      id: r.ts,
      parent_message_id: ts,
      session_id: channelId,
      role: r.user === 'US' || r.user === userId.toString() ? 'user' : 'assistant',
      content: r.text || '',
      created_at: new Date(parseFloat(r.ts) * 1000).toISOString(),
      user: r.user
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error('Failed to retrieve Slack thread replies:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve Slack thread replies.' });
  }
});

// POST /api/channels/:channelId/messages/:ts/thread - Post thread reply to Slack
router.post('/:channelId/messages/:ts/thread', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { channelId, ts } = req.params;
  const { content, fileIds } = req.body;
  if (!content && (!fileIds || fileIds.length === 0)) {
    return res.status(400).json({ error: 'Content or fileIds are required.' });
  }
  try {
    const userId = req.user!.id;
    const tokenRow = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE user_id = ? AND `key` = ?', [userId, 'mcp_slack_bot_token']);
    const token = tokenRow?.value;

    if (!token) {
      return res.status(400).json({ error: 'Slack Bot Token is not configured.' });
    }

    let postResponse: any = null;

    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel_id: channelId,
          files: fileIds.map(id => ({ id })),
          initial_comment: content || undefined,
          thread_ts: ts
        })
      });

      const completeData = await completeResponse.json() as any;
      if (!completeData.ok) {
        throw new Error(`completeUploadExternal failed: ${completeData.error || 'unknown error'}`);
      }
      if (completeData.files && Array.isArray(completeData.files)) {
        for (const file of completeData.files) {
          await saveFileMetadata(file);
        }
      }
      postResponse = completeData;
    } else {
      const mcpManager = MCPClientManager.getInstance(userId);
      if (!mcpManager.isConnected()) {
        await mcpManager.initializeClient();
      }
      const response = await mcpManager.callTool('slack_reply_to_thread', {
        channel_id: channelId,
        thread_ts: ts,
        text: content
      });
      postResponse = parseMCPResponse(response);
    }

    res.status(201).json({
      userReply: {
        id: postResponse?.ts || postResponse?.file_ids?.[0] || Math.random().toString(),
        parent_message_id: ts,
        session_id: channelId,
        role: 'user',
        content: content || '',
        created_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Failed to post Slack thread reply:', error);
    res.status(500).json({ error: error?.message || 'Failed to post thread reply.' });
  }
});

// POST /api/channels/:id/upload-file - Multipart file upload direct to Slack S3 via getUploadURLExternal
router.post('/:id/upload-file', authenticateJWT, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded in the "file" field.' });
  }

  try {
    const userId = req.user!.id;
    const result = await fileService.uploadFileDirect(
      userId,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      req.file.buffer
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to upload file.' });
  }
});

export default router;
