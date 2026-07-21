import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { 
  broadcastReactionUpdate, 
  broadcastNewMessage, 
  broadcastMessageChanged, 
  broadcastMessageDeleted 
} from '../services/websocket.js';
import { slackToUnicode, getBotUserIdForUser, getHumanSlackUserIdForUser } from '../utils/emoji.js';
import { cache, cacheKey } from '../services/cache.js';

const router = Router();

// Middleware to verify Slack Request Signature
async function verifySlackRequest(req: Request, res: Response, next: any) {
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;
  
  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Retrieve signing secret from database settings
  const secretRow = await db.queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE user_id = 1 AND `key` = "mcp_slack_signing_secret"'
  );
  const signingSecret = secretRow?.value || process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    console.warn('[SlackWebhook] SLACK_SIGNING_SECRET is not configured. Skipping signature validation in development.');
    return next();
  }

  // Prevent replay attacks (check if timestamp is within 5 minutes)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    return res.status(400).json({ error: 'Outdated Slack signature request' });
  }

  const rawBody = (req as any).rawBody || '';
  const sigBasestring = 'v0:' + timestamp + ':' + rawBody;
  
  try {
    const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');
    
    if (crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'))) {
      return next();
    }
  } catch (err) {
    console.error('[SlackWebhook] Signature verification error:', err);
  }

  return res.status(401).json({ error: 'Invalid signature verification' });
}

// GET /api/slack/events
router.get('/events', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Slack events webhook endpoint ready. Accepts POST requests from Slack.' });
});

// POST /api/slack/events
router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body;
  // Handle URL Verification Challenge directly so Slack can verify the endpoint
  if (body && body.type === 'url_verification') {
    console.log('[SlackWebhook] Responding to url_verification challenge:', body.challenge);
    return res.status(200).send(body.challenge);
  }
  return verifySlackRequest(req, res, next);
}, async (req: Request, res: Response) => {
  const body = req.body;

  // Immediately respond to Slack to prevent timeout retries
  res.status(200).send('ok');

  // 2. Handle Event Callback
  if (body.type === 'event_callback') {
    const event = body.event;
    if (!event) return;

    const eventType = event.type;
    if (eventType === 'message') {
      const channelId = event.channel;
      const subtype = event.subtype;

      // Resolve local user ID associated with this workspace
      const teamId = body.team_id || event.team || '';
      const userRow = await db.queryOne<{ user_id: number }>(
        'SELECT user_id FROM settings WHERE `key` = "mcp_slack_team_id" AND value = ?',
        [teamId]
      );
      const localUserId = userRow?.user_id || 1;

      if (subtype === 'message_changed') {
        const msg = event.message;
        if (msg) {
          const messageId = msg.ts;
          const text = msg.text || '';
          try {
            await db.execute(
              'UPDATE slack_messages SET text = ? WHERE db_user_id = ? AND id = ?',
              [text, localUserId, messageId]
            );
            console.log(`[SlackWebhook] Updated message ${messageId} in DB for user ${localUserId}`);
            broadcastMessageChanged(channelId, { id: messageId, ts: messageId, text, channel_id: channelId });
          } catch (err) {
            console.error('[SlackWebhook] Error handling message change event:', err);
          }
        }
      } else if (subtype === 'message_deleted') {
        const messageId = event.deleted_ts;
        if (messageId) {
          try {
            await db.execute(
              'DELETE FROM slack_messages WHERE db_user_id = ? AND id = ?',
              [localUserId, messageId]
            );
            console.log(`[SlackWebhook] Deleted message ${messageId} from DB for user ${localUserId}`);
            broadcastMessageDeleted(channelId, messageId);
          } catch (err) {
            console.error('[SlackWebhook] Error handling message delete event:', err);
          }
        }
      } else if (!subtype || subtype === 'bot_message') {
        const messageId = event.ts;
        const text = event.text || '';
        const slackUser = event.user || event.bot_id || 'bot';
        const threadTs = event.thread_ts || null;
        const eventId = body.event_id || `message_${channelId}_${messageId}`;

        try {
          // Idempotency check via event_id
          try {
            await db.execute('INSERT INTO slack_processed_events (event_id) VALUES (?)', [eventId]);
          } catch (dbErr) {
            console.log(`[SlackWebhook] Duplicate message event detected. Discarding: ${eventId}`);
            return;
          }

          await db.execute(
            'INSERT INTO slack_messages (db_user_id, id, channel_id, user_id, text, thread_ts) VALUES (?, ?, ?, ?, ?, ?)',
            [localUserId, messageId, channelId, slackUser, text, threadTs]
          );
          console.log(`[SlackWebhook] Saved new message ${messageId} in DB for user ${localUserId}`);
          
          broadcastNewMessage(channelId, {
            id: messageId,
            ts: messageId,
            channel_id: channelId,
            user: slackUser,
            text,
            thread_ts: threadTs,
            reactions: []
          });
        } catch (err) {
          console.error('[SlackWebhook] Error handling message event:', err);
        }
      }
    } else if (eventType === 'reaction_added' || eventType === 'reaction_removed') {
      const slackUser = event.user;
      const slackEmoji = event.reaction;
      const unicodeEmoji = slackToUnicode(slackEmoji);
      const messageId = event.item.ts;
      const channelId = event.item.channel;

      if (event.item.type !== 'message') return;

      const eventId = body.event_id || `${eventType}_${channelId}_${messageId}_${slackUser}_${slackEmoji}`;
      
      if (eventType === 'reaction_removed') {
        console.log(`[reaction_removed received] event_id: ${eventId}, emoji: ${slackEmoji} (${unicodeEmoji}) by user ${slackUser} on message ${messageId} in channel ${channelId}`);
      } else {
        console.log(`[reaction_added received] event_id: ${eventId}, emoji: ${slackEmoji} (${unicodeEmoji}) by user ${slackUser} on message ${messageId} in channel ${channelId}`);
      }

      try {
        // Enforce Idempotency check via Database Primary Key constraint
        try {
          await db.execute('INSERT INTO slack_processed_events (event_id) VALUES (?)', [eventId]);
        } catch (dbErr) {
          console.log(`[SlackWebhook] Duplicate event detected. Discarding: ${eventId}`);
          return;
        }

        // Resolve the user ID associated with this Slack workspace team_id
        const teamId = body.team_id || event.team || '';
        const userRow = await db.queryOne<{ user_id: number }>(
          'SELECT user_id FROM settings WHERE `key` = "mcp_slack_team_id" AND value = ?',
          [teamId]
        );
        const localUserId = userRow?.user_id || 1; // Fallback to 1

        // Fetch Slack bot token to query details
        const tokenRow = await db.queryOne<{ value: string }>(
          'SELECT value FROM settings WHERE user_id = ? AND `key` = "mcp_slack_bot_token"',
          [localUserId]
        );
        const slackToken = tokenRow?.value;
        if (!slackToken) return;

        // Determine if this reaction matches the local user (either bot user or human user)
        const botUserId = await getBotUserIdForUser(localUserId);
        const humanSlackUserId = await getHumanSlackUserIdForUser(localUserId);

        // If the reaction event was triggered by our local user (either bot client or user browser client on Slack),
        // we keep the local DB chat_reactions in sync.
        if (slackUser === botUserId || (humanSlackUserId && slackUser === humanSlackUserId)) {
          if (eventType === 'reaction_added') {
            // Ensure message exists in local DB before inserting reaction
            const session = await db.queryOne<{ id: string }>('SELECT id FROM chat_sessions WHERE id = ?', [channelId]);
            if (!session) {
              await db.execute(
                'INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)',
                [channelId, localUserId, `Channel Session (${channelId})`]
              );
            }
            const msg = await db.queryOne<{ id: string }>('SELECT id FROM chat_messages WHERE id = ?', [messageId]);
            if (!msg) {
              await db.execute(
                'INSERT INTO chat_messages (id, session_id, role, content, slack_channel_id, slack_message_ts) VALUES (?, ?, ?, ?, ?, ?)',
                [messageId, channelId, 'user', '', channelId, messageId]
              );
            }

            const existing = await db.queryOne<any>(
              'SELECT * FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
              [messageId, localUserId, unicodeEmoji]
            );
            if (!existing) {
              await db.execute(
                'INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
                [messageId, localUserId, unicodeEmoji]
              );
              console.log(`[Database updated] Inserted reaction: ${unicodeEmoji} for user ${localUserId} on message ${messageId}`);
            }
          } else {
            await db.execute(
              'DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
              [messageId, localUserId, unicodeEmoji]
            );
            console.log(`[Database updated] Deleted reaction: ${unicodeEmoji} for user ${localUserId} on message ${messageId}`);
          }

          // Clear cache on local reaction changes
          cache.delByPrefix(cacheKey(localUserId, 'timeline'));
        }

        // Fetch absolute source-of-truth reactions from Slack to broadcast
        const getRes = await fetch(`https://slack.com/api/reactions.get?channel=${channelId}&timestamp=${messageId}`, {
          headers: { 'Authorization': `Bearer ${slackToken}` }
        });
        const getData = await getRes.json() as any;

        if (getData.ok && getData.message) {
          const slackReactions: any[] = [];
          if (getData.message.reactions && Array.isArray(getData.message.reactions)) {
            for (const sr of getData.message.reactions) {
              const uEmoji = slackToUnicode(sr.name);
              if (sr.users && Array.isArray(sr.users)) {
                for (const sUser of sr.users) {
                  const resolvedUserId = (sUser === botUserId || (humanSlackUserId && sUser === humanSlackUserId)) ? localUserId : sUser;
                  slackReactions.push({
                    emoji: uEmoji,
                    user_id: resolvedUserId
                  });
                }
              }
            }
          }

          // Fetch local overrides
          const localReactions = await db.query<any>(
            'SELECT emoji, user_id FROM chat_reactions WHERE message_id = ?',
            [messageId]
          );

          // Merge lists
          const combinedMap = new Map<string, any>();
          for (const r of slackReactions) {
            combinedMap.set(`${r.emoji}_${r.user_id}`, r);
          }
          for (const r of localReactions) {
            combinedMap.set(`${r.emoji}_${r.user_id}`, r);
          }
          const combinedReactions = Array.from(combinedMap.values());

          // Broadcast reaction update to all connected clients
          console.log(`[WebSocket emitted] messageId: ${messageId}, channelId: ${channelId}, reactions count: ${combinedReactions.length}`);
          broadcastReactionUpdate(messageId, channelId, combinedReactions);
        }
      } catch (err) {
        console.error('[SlackWebhook] Error handling Slack reaction event:', err);
      }
    }
  }
});

export default router;
