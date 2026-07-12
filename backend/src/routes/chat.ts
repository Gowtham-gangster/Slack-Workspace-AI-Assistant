import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { broadcastReactionUpdate } from '../services/websocket.js';
import { slackToUnicode, unicodeToSlack, getBotUserIdForUser, getHumanSlackUserIdForUser } from '../utils/emoji.js';
import { cache, cacheKey } from '../services/cache.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { runAgentCompletion } from '../services/ai.js';
import { searchSemanticStore } from '../services/vectorStore.js';
import { generateLocalFallbackAiAction } from '../services/fallback.js';
import { sanitizeAIError } from '../middleware/errorHandler.js';

const router = Router();



async function ensureMessageExists(
  messageId: string,
  sessionId: string,
  userId: number,
  content: string = '',
  role: string = 'assistant',
  threadTs: string | null = null
) {
  const session = await db.queryOne<any>('SELECT id FROM chat_sessions WHERE id = ?', [sessionId]);
  if (!session) {
    await db.execute(
      'INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)',
      [sessionId, userId, `Channel Session (${sessionId})`]
    );
  }

  const msg = await db.queryOne<any>('SELECT id FROM chat_messages WHERE id = ?', [messageId]);
  if (!msg) {
    const isSlackChan = sessionId.startsWith('C') || sessionId.startsWith('D') || sessionId.startsWith('G');
    const slackChannelId = isSlackChan ? sessionId : null;
    const slackMessageTs = isSlackChan ? messageId : null;
    const slackThreadTs = isSlackChan ? threadTs : null;

    await db.execute(`
      INSERT INTO chat_messages (id, session_id, role, content, slack_channel_id, slack_message_ts, slack_thread_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [messageId, sessionId, role, content, slackChannelId, slackMessageTs, slackThreadTs]);
  }
}

// POST /api/chat/messages/:id/react
router.post('/messages/:id/react', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  const { emoji, sessionId, content, role } = req.body;
  const userId = req.user!.id;
  if (!emoji) return res.status(400).json({ error: 'Emoji is required.' });
  try {
    if (sessionId) {
      await ensureMessageExists(messageId, sessionId, userId, content || '', role || 'assistant');
    }
    const existing = await db.queryOne<any>(
      'SELECT * FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [messageId, userId, emoji]
    );

    // Outgoing Slack reaction sync
    const isSlackChan = sessionId && (sessionId.startsWith('C') || sessionId.startsWith('D') || sessionId.startsWith('G'));
    if (isSlackChan) {
      console.log(`[Reaction API called] toggling emoji ${emoji} on message ${messageId} in channel ${sessionId} (Slack Channel)`);
      const tokenRow = await db.queryOne<{ value: string }>(
        'SELECT value FROM settings WHERE user_id = ? AND `key` = "mcp_slack_bot_token"',
        [userId]
      );
      const slackToken = tokenRow?.value;
      if (!slackToken) {
        return res.status(400).json({ error: 'Slack Bot Token is missing in configuration settings.' });
      }

      // Fire and forget: launch the Slack API call in the background asynchronously
      (async () => {
        try {
          // Query live reactions from Slack as source of truth
          const getRes = await fetch(`https://slack.com/api/reactions.get?channel=${sessionId}&timestamp=${messageId}`, {
            headers: { 'Authorization': `Bearer ${slackToken}` }
          });
          const getData = await getRes.json() as any;
          
          let alreadyReacted = false;
          if (getData.ok && getData.message && getData.message.reactions) {
            const slackEmojiName = unicodeToSlack(emoji);
            const botUserId = await getBotUserIdForUser(userId);
            const humanSlackUserId = await getHumanSlackUserIdForUser(userId);
            
            const matchReaction = getData.message.reactions.find((r: any) => r.name === slackEmojiName);
            if (matchReaction && matchReaction.users) {
              alreadyReacted = matchReaction.users.some((u: any) => u === botUserId || (humanSlackUserId && u === humanSlackUserId));
            }
          }

          const actionUrl = alreadyReacted ? 'https://slack.com/api/reactions.remove' : 'https://slack.com/api/reactions.add';
          const slackEmojiName = unicodeToSlack(emoji);

          if (alreadyReacted) {
            console.log(`[Assistant clicked remove] emoji: ${emoji} (slack: ${slackEmojiName}) on message ${messageId}`);
          } else {
            console.log(`[Assistant clicked add] emoji: ${emoji} (slack: ${slackEmojiName}) on message ${messageId}`);
          }

          const slackRes = await fetch(actionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              channel: sessionId,
              timestamp: messageId,
              name: slackEmojiName
            })
          });
          const slackData = await slackRes.json() as any;
          if (slackData.ok) {
            if (alreadyReacted) {
              console.log(`[Slack reactions.remove success] for emoji: ${emoji} on message ${messageId}`);
            } else {
              console.log(`[Slack reactions.add success] for emoji: ${emoji} on message ${messageId}`);
            }
          } else {
            const ignoreErrors = ['already_reacted', 'no_reaction', 'already_removed'];
            if (!ignoreErrors.includes(slackData.error)) {
              console.error(`[SlackSync] Slack rejected reaction ${slackEmojiName} in background:`, slackData.error);
            }
          }

          // Clear timeline cache to prevent serving stale reactions
          cache.delByPrefix(cacheKey(userId, 'timeline'));
        } catch (slackErr) {
          console.error('[SlackSync] Background Slack API call error:', slackErr);
        }
      })();

      // Strategy A: Return success immediately to frontend to close picker/popups, deferring updates to the webhook events
      return res.json({ action: existing ? 'removed' : 'added', emoji, success: true });
    }

    if (existing) {
      await db.execute(
        'DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        [messageId, userId, emoji]
      );
    } else {
      await db.execute(
        'INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
        [messageId, userId, emoji]
      );
      
      // Send notification to message author if it's not them reacting
      const message = await db.queryOne<any>(
        `SELECT m.role, m.content, s.user_id as author_id, s.title
         FROM chat_messages m
         JOIN chat_sessions s ON m.session_id = s.id
         WHERE m.id = ?`,
        [messageId]
      );
      
      if (message && message.author_id !== userId) {
        const user = await db.queryOne<any>('SELECT email, full_name FROM users WHERE id = ?', [userId]);
        const username = user?.full_name || user?.email || 'Someone';
        
        await db.execute(
          'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
          [
            message.author_id,
            'reaction',
            'New Reaction',
            `${username} reacted with ${emoji} to your message`,
            `/dashboard?session=${sessionId}&message=${messageId}`
          ]
        );
      }
    }

    // Fetch and merge reactions list to broadcast via WebSocket
    let combinedReactions: any[] = [];
    if (isSlackChan) {
      const tokenRow = await db.queryOne<{ value: string }>(
        'SELECT value FROM settings WHERE user_id = ? AND `key` = "mcp_slack_bot_token"',
        [userId]
      );
      const slackToken = tokenRow?.value;
      if (slackToken) {
        try {
          const getRes = await fetch(`https://slack.com/api/reactions.get?channel=${sessionId}&timestamp=${messageId}`, {
            headers: { 'Authorization': `Bearer ${slackToken}` }
          });
          const getData = await getRes.json() as any;
          if (getData.ok && getData.message) {
            const botUserId = await getBotUserIdForUser(userId);
            const humanSlackUserId = await getHumanSlackUserIdForUser(userId);
            const slackReactions: any[] = [];
            if (getData.message.reactions && Array.isArray(getData.message.reactions)) {
               for (const sr of getData.message.reactions) {
                 const uEmoji = slackToUnicode(sr.name);
                 if (sr.users && Array.isArray(sr.users)) {
                   for (const sUser of sr.users) {
                     const resolvedUserId = (sUser === botUserId || (humanSlackUserId && sUser === humanSlackUserId)) ? 1 : sUser;
                     slackReactions.push({
                       emoji: uEmoji,
                       user_id: resolvedUserId
                     });
                   }
                 }
               }
            }
            
            const localReactions = await db.query<any>(
              'SELECT emoji, user_id FROM chat_reactions WHERE message_id = ?',
              [messageId]
            );
            const combinedMap = new Map<string, any>();
            for (const r of slackReactions) {
              combinedMap.set(`${r.emoji}_${r.user_id}`, r);
            }
            for (const r of localReactions) {
              combinedMap.set(`${r.emoji}_${r.user_id}`, r);
            }
            combinedReactions = Array.from(combinedMap.values());
          }
        } catch (getErr) {
          console.error('[SlackSync] Failed to retrieve fresh Slack reactions for broadcast:', getErr);
        }
      }
    } else {
      combinedReactions = await db.query<any>(
        'SELECT emoji, user_id FROM chat_reactions WHERE message_id = ?',
        [messageId]
      );
    }

    // Broadcast update through WebSocket
    broadcastReactionUpdate(messageId, sessionId || '', combinedReactions);

    res.json({ action: existing ? 'removed' : 'added', emoji, reactions: combinedReactions });
  } catch (error) {
    console.error('Failed to toggle reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction.' });
  }
});

// GET /api/chat/messages/:id/thread
router.get('/messages/:id/thread', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  try {
    const replies = await db.query<any>(
      'SELECT * FROM chat_threads WHERE parent_message_id = ? ORDER BY created_at ASC',
      [messageId]
    );
    res.json(replies);
  } catch (error) {
    console.error('Failed to get thread replies:', error);
    res.status(500).json({ error: 'Failed to get thread replies.' });
  }
});

// POST /api/chat/messages/:id/thread
router.post('/messages/:id/thread', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  const { content, role } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required.' });
  try {
    const parent = await db.queryOne<any>('SELECT role, content, session_id FROM chat_messages WHERE id = ?', [messageId]);
    if (!parent) return res.status(404).json({ error: 'Parent message not found.' });

    const replyId = uuidv4();
    await db.execute(`
      INSERT INTO chat_threads (id, parent_message_id, session_id, role, content)
      VALUES (?, ?, ?, ?, ?)
    `, [replyId, messageId, parent.session_id, role || 'user', content]);

    await db.execute('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [parent.session_id]);

    // Send notification to parent message author
    const session = await db.queryOne<any>('SELECT user_id, title FROM chat_sessions WHERE id = ?', [parent.session_id]);
    if (session && session.user_id !== req.user!.id) {
      const user = await db.queryOne<any>('SELECT email, full_name FROM users WHERE id = ?', [req.user!.id]);
      const username = user?.full_name || user?.email || 'Someone';
      
      await db.execute(
        'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
        [
          session.user_id,
          'reply',
          'New Reply',
          `${username} replied to your message`,
          `/dashboard?session=${parent.session_id}&message=${messageId}`
        ]
      );
    }

    let aiReply = null;
    if (!role || role === 'user') {
      const aiReplyId = uuidv4();
      const replies = await db.query<any>(
        'SELECT role, content FROM chat_threads WHERE parent_message_id = ? ORDER BY created_at ASC',
        [messageId]
      );
      
      const threadHistory = [
        { role: 'system', content: 'You are responding to a thread reply in the user\'s workspace assistant. Keep your response brief, relevant, and direct.' },
        { role: parent.role === 'user' ? 'user' : 'assistant', content: parent.content }
      ];
      for (const r of replies) {
        threadHistory.push({ role: r.role, content: r.content });
      }
      
      const assistantResponse = await runAgentCompletion(
        threadHistory as any,
        aiReplyId,
        req.user!.id,
        () => {}
      );

      await db.execute(`
        INSERT INTO chat_threads (id, parent_message_id, session_id, role, content)
        VALUES (?, ?, ?, 'assistant', ?)
      `, [aiReplyId, messageId, parent.session_id, assistantResponse]);

      aiReply = {
        id: aiReplyId,
        parent_message_id: messageId,
        session_id: parent.session_id,
        role: 'assistant',
        content: assistantResponse,
        created_at: new Date()
      };
    }

    res.status(201).json({
      userReply: {
        id: replyId,
        parent_message_id: messageId,
        session_id: parent.session_id,
        role: role || 'user',
        content,
        created_at: new Date()
      },
      aiReply
    });
  } catch (error) {
    console.error('Failed to post thread reply:', error);
    res.status(500).json({ error: 'Failed to post thread reply.' });
  }
});

// POST /api/chat/sessions/:id/pins
router.post('/sessions/:id/pins', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id;
  const { messageId, content, role } = req.body;
  if (!messageId) return res.status(400).json({ error: 'messageId is required.' });
  try {
    await ensureMessageExists(messageId, sessionId, req.user!.id, content || '', role || 'assistant');

    await db.execute(`
      INSERT IGNORE INTO chat_pins (session_id, message_id, pinned_by)
      VALUES (?, ?, ?)
    `, [sessionId, messageId, req.user!.id]);

    res.json({ message: 'Message pinned successfully.' });
  } catch (error) {
    console.error('Failed to pin message:', error);
    res.status(500).json({ error: 'Failed to pin message.' });
  }
});

// DELETE /api/chat/sessions/:id/pins/:messageId
router.delete('/sessions/:id/pins/:messageId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id;
  const messageId = req.params.messageId;
  try {
    await db.execute('DELETE FROM chat_pins WHERE session_id = ? AND message_id = ?', [sessionId, messageId]);
    res.json({ message: 'Message unpinned successfully.' });
  } catch (error) {
    console.error('Failed to unpin message:', error);
    res.status(500).json({ error: 'Failed to unpin message.' });
  }
});

// GET /api/chat/sessions/:id/pins
router.get('/sessions/:id/pins', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id;
  try {
    const pins = await db.query<any>(`
      SELECT m.*, m.role AS user, p.created_at as pinned_at, u.email as pinned_by_email
      FROM chat_pins p
      JOIN chat_messages m ON p.message_id = m.id
      JOIN users u ON p.pinned_by = u.id
      WHERE p.session_id = ?
      ORDER BY p.created_at DESC
    `, [sessionId]);
    res.json(pins);
  } catch (error) {
    console.error('Failed to get pinned messages:', error);
    res.status(500).json({ error: 'Failed to get pinned messages.' });
  }
});

// POST /api/chat/bookmarks
router.post('/bookmarks', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { messageId, sessionId, content, role } = req.body;
  if (!messageId || !sessionId) return res.status(400).json({ error: 'messageId and sessionId are required.' });
  try {
    await ensureMessageExists(messageId, sessionId, req.user!.id, content || '', role || 'assistant');
    await db.execute(`
      INSERT IGNORE INTO chat_bookmarks (user_id, session_id, message_id)
      VALUES (?, ?, ?)
    `, [req.user!.id, sessionId, messageId]);
    res.json({ message: 'Message saved successfully.' });
  } catch (error) {
    console.error('Failed to bookmark message:', error);
    res.status(500).json({ error: 'Failed to bookmark message.' });
  }
});

// DELETE /api/chat/bookmarks/:messageId
router.delete('/bookmarks/:messageId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.messageId;
  try {
    await db.execute('DELETE FROM chat_bookmarks WHERE user_id = ? AND message_id = ?', [req.user!.id, messageId]);
    res.json({ message: 'Message unsaved successfully.' });
  } catch (error) {
    console.error('Failed to remove bookmark:', error);
    res.status(500).json({ error: 'Failed to remove bookmark.' });
  }
});

// GET /api/chat/bookmarks
router.get('/bookmarks', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookmarks = await db.query<any>(`
      SELECT m.*, m.role AS user, b.created_at as saved_at, s.title as session_title, c.name as channel_name
      FROM chat_bookmarks b
      JOIN chat_messages m ON b.message_id = m.id
      JOIN chat_sessions s ON b.session_id = s.id
      LEFT JOIN slack_channels c ON b.session_id = c.id AND c.db_user_id = ?
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [req.user!.id, req.user!.id]);
    res.json(bookmarks);
  } catch (error) {
    console.error('Failed to get bookmarks:', error);
    res.status(500).json({ error: 'Failed to get saved messages.' });
  }
});

// GET /api/chat/reminders — list all pending (non-dismissed) reminders for the user
router.get('/reminders', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reminders = await db.query<any>(`
      SELECT r.*, m.content as message_content
      FROM chat_reminders r
      LEFT JOIN chat_messages m ON r.message_id = m.id
      WHERE r.user_id = ? AND r.dismissed = 0
      ORDER BY r.remind_at ASC
    `, [req.user!.id]);
    res.json(reminders);
  } catch (error) {
    console.error('Failed to get reminders:', error);
    res.status(500).json({ error: 'Failed to retrieve reminders.' });
  }
});

// GET /api/chat/reminders/due — return fired but not yet notified+dismissed reminders (for frontend polling)
router.get('/reminders/due', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const due = await db.query<any>(`
      SELECT r.id, r.message_id, r.remind_at, r.created_at,
             r.content, r.session_id,
             COALESCE(m.content, r.content) as message_content
      FROM chat_reminders r
      LEFT JOIN chat_messages m ON r.message_id = m.id
      WHERE r.user_id = ? AND r.dismissed = 0 AND r.notified = 0 AND r.remind_at <= ?
      ORDER BY r.remind_at ASC
    `, [req.user!.id, now]);

    // Mark as notified (in-app delivered)
    if (due.length > 0) {
      const ids = due.map((r: any) => r.id);
      await db.execute(
        `UPDATE chat_reminders SET notified = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }

    res.json(due);
  } catch (error) {
    console.error('Failed to get due reminders:', error);
    res.status(500).json({ error: 'Failed to retrieve due reminders.' });
  }
});

// POST /api/chat/messages/:id/reminder
router.post('/messages/:id/reminder', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  const { remindAt, sessionId, content, role } = req.body;
  if (!remindAt) return res.status(400).json({ error: 'remindAt timestamp is required.' });
  try {
    if (sessionId) {
      await ensureMessageExists(messageId, sessionId, req.user!.id, content || '', role || 'assistant');
    }
    await db.execute(`
      INSERT INTO chat_reminders (user_id, message_id, session_id, content, remind_at)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user!.id, messageId, sessionId || null, content || null, new Date(remindAt)]);
    res.json({ message: 'Reminder set successfully.' });
  } catch (error) {
    console.error('Failed to set reminder:', error);
    res.status(500).json({ error: 'Failed to set reminder.' });
  }
});

// PATCH /api/chat/reminders/:id/dismiss — mark a specific reminder as dismissed
router.patch('/reminders/:id/dismiss', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const reminderId = parseInt(req.params.id);
  try {
    await db.execute(
      'UPDATE chat_reminders SET dismissed = 1 WHERE id = ? AND user_id = ?',
      [reminderId, req.user!.id]
    );
    res.json({ message: 'Reminder dismissed.' });
  } catch (error) {
    console.error('Failed to dismiss reminder:', error);
    res.status(500).json({ error: 'Failed to dismiss reminder.' });
  }
});

// DELETE /api/chat/reminders/:id — hard delete a reminder
router.delete('/reminders/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const reminderId = parseInt(req.params.id);
  try {
    await db.execute(
      'DELETE FROM chat_reminders WHERE id = ? AND user_id = ?',
      [reminderId, req.user!.id]
    );
    res.json({ message: 'Reminder deleted.' });
  } catch (error) {
    console.error('Failed to delete reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder.' });
  }
});



// PATCH /api/chat/messages/:id
router.patch('/messages/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required.' });
  try {
    const msg = await db.queryOne<any>(`
      SELECT m.id, s.user_id 
      FROM chat_messages m
      JOIN chat_sessions s ON m.session_id = s.id
      WHERE m.id = ?
    `, [messageId]);

    if (!msg || msg.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    await db.execute('UPDATE chat_messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?', [content, messageId]);
    res.json({ message: 'Message updated successfully.' });
  } catch (error) {
    console.error('Failed to update message:', error);
    res.status(500).json({ error: 'Failed to update message.' });
  }
});

// DELETE /api/chat/messages/:id
router.delete('/messages/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  try {
    const msg = await db.queryOne<any>(`
      SELECT m.id, s.user_id 
      FROM chat_messages m
      JOIN chat_sessions s ON m.session_id = s.id
      WHERE m.id = ?
    `, [messageId]);

    if (!msg || msg.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    await db.execute('UPDATE chat_messages SET deleted = 1, content = "This message was deleted." WHERE id = ?', [messageId]);
    res.json({ message: 'Message soft-deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete message:', error);
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// POST /api/chat/messages/:id/ai-action
router.post('/messages/:id/ai-action', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  const { action, sessionId, content, role } = req.body;
  if (!action) return res.status(400).json({ error: 'Action is required.' });
  let msgContent = content || '';
  try {
    if (sessionId) {
      await ensureMessageExists(messageId, sessionId, req.user!.id, content || '', role || 'assistant');
    }
    const msg = await db.queryOne<any>('SELECT content FROM chat_messages WHERE id = ?', [messageId]);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    msgContent = msg.content;

    let systemPrompt = '';
    if (action === 'explain') {
      systemPrompt = 'Explain the following message, highlighting any technical details, terminology, or key context in a simple and concise way.';
    } else if (action === 'summarize') {
      systemPrompt = 'Provide a high-level summary of the following message containing the most important takeaways.';
    } else if (action === 'translate') {
      systemPrompt = 'Translate the following message into three languages: Telugu, Hindi, and Simple Indian English. Format the output clearly with separate bold headings for each: "Telugu Translation:", "Hindi Translation:", and "Simple Indian English Translation:". Provide only the translation under each heading without extra commentary.';
    } else if (action === 'improve') {
      systemPrompt = 'Improve the grammar, clarity, and readability of the following text, keeping the original meaning intact.';
    } else if (action === 'rewrite') {
      systemPrompt = 'Rewrite the following text in a highly professional, workplace-appropriate tone.';
    } else {
      systemPrompt = `Analyze the following text according to: ${action}.`;
    }

    const aiMessageId = uuidv4();
    const history = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: msgContent }
    ];

    const result = await runAgentCompletion(
      history as any,
      aiMessageId,
      req.user!.id,
      () => {}
    );

    res.json({ result });
  } catch (error) {
    console.error('Failed to run AI action, attempting fallback:', error);
    try {
      const fallbackResult = generateLocalFallbackAiAction(action, msgContent);
      res.json({ result: fallbackResult });
    } catch (fallbackError) {
      console.error('Fallback failed too:', fallbackError);
      res.status(500).json({ error: 'Failed to complete AI action.' });
    }
  }
});



export default router;
