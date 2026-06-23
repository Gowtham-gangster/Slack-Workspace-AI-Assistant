import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { runAgentCompletion } from '../services/ai.js';
import { searchSemanticStore } from '../services/vectorStore.js';

const router = Router();

// GET /api/chat/sessions
router.get('/sessions', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await db.query(`
      SELECT * FROM chat_sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `, [req.user!.id]);
    res.json(sessions);
  } catch (error) {
    console.error('Failed to get chat sessions:', error);
    res.status(500).json({ error: 'Failed to retrieve chat sessions.' });
  }
});

// POST /api/chat/sessions
router.post('/sessions', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { title } = req.body;
  const sessionId = uuidv4();
  const sessionTitle = title || 'New Conversation';

  try {
    await db.execute(`
      INSERT INTO chat_sessions (id, user_id, title)
      VALUES (?, ?, ?)
    `, [sessionId, req.user!.id, sessionTitle]);

    res.status(201).json({ id: sessionId, title: sessionTitle });
  } catch (error) {
    console.error('Failed to create chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session.' });
  }
});

// GET /api/chat/sessions/:id
router.get('/sessions/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify session belongs to user
    const session = await db.queryOne<any>('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }

    const messages = await db.query<any>('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', [req.params.id]);

    // Also fetch associated tool executions for these messages
    const formattedMessages = [];
    for (const m of messages) {
      const toolExecutions = await db.query<any>('SELECT * FROM tool_executions WHERE message_id = ?', [m.id]);
      formattedMessages.push({
        ...m,
        toolExecutions
      });
    }

    res.json({
      session,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Failed to get chat session messages:', error);
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

// DELETE /api/chat/sessions/:id
router.delete('/sessions/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.execute('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }

    res.json({ message: 'Chat session deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete chat session:', error);
    res.status(500).json({ error: 'Failed to delete chat session.' });
  }
});

// GET /api/chat/sessions/:id/stream - SSE Streaming Chat Completion
router.get('/sessions/:id/stream', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id;
  const prompt = req.query.prompt as string;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt query parameter is required.' });
  }

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    // 1. Verify session belongs to user
    const session = await db.queryOne<any>('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', [sessionId, req.user!.id]);

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // disable buffering for proxy servers like nginx
    });

    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();

    // 2. Save user message in database
    await db.execute(`
      INSERT INTO chat_messages (id, session_id, role, content)
      VALUES (?, ?, 'user', ?)
    `, [userMessageId, sessionId, prompt]);

    // Update session timestamp
    await db.execute('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId]);

    const userId = req.user!.id;
    // 3. Search local semantic store (RAG) for matching context
    console.log(`Running RAG query for prompt: "${prompt}"`);
    const ragContext = await searchSemanticStore(prompt, userId, 5, 0.45);
    
    // Fetch available channels from database for LLM context
    let channelListStr = 'No channels cached yet.';
    let defaultChannelStr = 'using a default channel in the channel list';
    try {
      const cachedChannels = await db.query<any>('SELECT id, name FROM slack_channels WHERE db_user_id = ?', [userId]);
      if (cachedChannels.length > 0) {
        channelListStr = cachedChannels.map(c => `#${c.name} (ID: ${c.id})`).join(', ');
        const defaultChan = cachedChannels.find(c => c.name === 'general' || c.name === 'all-gowtham') || cachedChannels[0];
        defaultChannelStr = `using "#${defaultChan.name}" (ID: ${defaultChan.id})`;
      }
    } catch (dbErr) {
      console.warn('Failed to query cached channels for system prompt:', dbErr);
    }

    let systemPromptText = `You are "Slack AI Workspace Assistant", a helpful AI collaborator.
You are connected to the user's Slack workspace through the Model Context Protocol (MCP) server.
You have access to tools that allow you to search messages, list channels, fetch message histories, get user profiles, and send Slack messages/replies.
Always prefer calling the appropriate MCP tool to fetch recent and accurate workspace data rather than guessing.

Available channels in the workspace: ${channelListStr}.

CRITICAL INSTRUCTION FOR MESSAGE RETRIEVAL:
If the user asks to see, retrieve, search, list, or check actual Slack messages (e.g., "latest msgs", "messages from #general", "what did pushpa say", "search for database messages"):
1. You MUST call the appropriate MCP tool (e.g., slack_get_channel_history) to retrieve the actual messages.
2. If no channel name is explicitly specified in the query, you MUST default to ${defaultChannelStr} as the target channel. Do NOT ask the user which channel they want.
3. Once you retrieve the messages, do NOT output any conversational text, introductory statements, explanations, or summaries.
4. Output ONLY a raw JSON array of the retrieved messages inside a markdown code block exactly like this:
\`\`\`json
[
  {
    "user": "Real Name (or User ID if name not found)",
    "text": "message text",
    "ts": "timestamp (ts)",
    "channel": "channel-name"
  }
]
\`\`\`
If no messages are found, output an empty JSON array \`[]\` inside the markdown code block. Do not write anything else.

Guidelines for other queries:
1. Provide comprehensive, structured summaries when summarizing channels or threads.
2. If asked about action items, deadlines, blockers, decisions, or sentiment, format them clearly using bullet points and headers.
3. Be professional and objective. Do not expose private tokens.
4. Keep the tone helpful, staff-engineer-level, and precise.
`;

    if (ragContext.length > 0) {
      const contextBlocks = ragContext.map((c, i) => {
        const typeLabel = c.entityType.toUpperCase();
        return `[Context #${i+1}] [Type: ${typeLabel}] (Similarity: ${(c.similarity * 100).toFixed(1)}%)
Content: ${c.content}`;
      }).join('\n---\n');

      systemPromptText += `\nHere is relevant historical context retrieved from local semantic search of Slack history:
---
${contextBlocks}
---
Use this context to inform your responses when matching historical references.
`;
    }

    // 4. Retrieve message history for this session (excluding the user's message just added)
    const historyRows = await db.query<any>(`
      SELECT role, content 
      FROM chat_messages 
      WHERE session_id = ? AND id != ?
      ORDER BY created_at ASC
    `, [sessionId, userMessageId]) as Array<{ role: 'user' | 'assistant'; content: string }>;

    // Map history to AI format
    const messagesHistory: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
      { role: 'system', content: systemPromptText }
    ];

    for (const h of historyRows) {
      messagesHistory.push({ role: h.role, content: h.content });
    }

    // Push the current user message
    messagesHistory.push({ role: 'user', content: prompt });

    // 5. Run the Agent Loop
    console.log('Spawning agent loop completion...');
    let assistantResponse = '';

    assistantResponse = await runAgentCompletion(
      messagesHistory,
      assistantMessageId,
      userId,
      (event) => {
        // Stream text, tool_start, tool_end events directly to the frontend
        if (event.type === 'text') {
          sendEvent('text', { content: event.content });
        } else if (event.type === 'tool_start') {
          sendEvent('tool_start', { toolName: event.toolName, toolArgs: event.toolArgs });
        } else if (event.type === 'tool_end') {
          sendEvent('tool_end', { toolName: event.toolName, status: event.status, result: event.result });
        }
      }
    );

    // 6. Save assistant message in database
    await db.execute(`
      INSERT INTO chat_messages (id, session_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `, [assistantMessageId, sessionId, assistantResponse]);

    // Update chat session title if it was default
    const sessionDetails = await db.queryOne<any>('SELECT title FROM chat_sessions WHERE id = ?', [sessionId]);
    if (sessionDetails && sessionDetails.title === 'New Conversation') {
      const shortTitle = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
      await db.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', [shortTitle, sessionId]);
      sendEvent('session_update', { title: shortTitle });
    }

    sendEvent('done', { messageId: assistantMessageId });
  } catch (error: any) {
    console.error('Chat stream error:', error);
    sendEvent('error', { error: error?.message || 'AI agent error occurred' });
  } finally {
    res.end();
  }
});

// GET /api/chat/search - Semantic search matching query
router.get('/search', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: 'q (query string) is required.' });
  }
  try {
    const userId = req.user!.id;
    const results = await searchSemanticStore(query, userId, 10, 0.3);
    res.json(results);
  } catch (error: any) {
    console.error('Failed to run semantic search:', error);
    res.status(500).json({ error: error?.message || 'Failed to search workspace history.' });
  }
});

export default router;
