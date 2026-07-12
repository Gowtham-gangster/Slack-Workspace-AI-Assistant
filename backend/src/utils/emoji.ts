import toEmoji from 'emoji-name-map';
import { db } from '../db/index.js';

const botUserIdCache = new Map<number, string>();

export async function getBotUserIdForUser(userId: number): Promise<string | null> {
  if (botUserIdCache.has(userId)) {
    return botUserIdCache.get(userId) || null;
  }

  try {
    const tokenRow = await db.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE user_id = ? AND `key` = "mcp_slack_bot_token"',
      [userId]
    );
    const slackToken = tokenRow?.value;
    if (!slackToken) return null;

    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { 'Authorization': `Bearer ${slackToken}` }
    });
    const authData = await res.json() as any;
    if (authData.ok && authData.user_id) {
      botUserIdCache.set(userId, authData.user_id);
      return authData.user_id;
    }
  } catch (err) {
    console.error('[EmojiUtil] Failed to fetch bot user ID for caching:', err);
  }
  return null;
}

const humanSlackUserIdCache = new Map<number, string>();

export async function getHumanSlackUserIdForUser(userId: number): Promise<string | null> {
  if (humanSlackUserIdCache.has(userId)) {
    return humanSlackUserIdCache.get(userId) || null;
  }

  try {
    const userRow = await db.queryOne<{ email: string; full_name: string }>(
      'SELECT email, full_name FROM users WHERE id = ?',
      [userId]
    );
    if (!userRow) return null;

    const tokenRow = await db.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE user_id = ? AND `key` = "mcp_slack_bot_token"',
      [userId]
    );
    const slackToken = tokenRow?.value;
    if (!slackToken) return null;

    const res = await fetch('https://slack.com/api/users.list', {
      headers: { 'Authorization': `Bearer ${slackToken}` }
    });
    const data = await res.json() as any;
    if (data.ok && Array.isArray(data.members)) {
      for (const member of data.members) {
        const email = member.profile?.email;
        const realName = member.real_name || member.profile?.real_name;
        
        if (email && email.toLowerCase() === userRow.email.toLowerCase()) {
          humanSlackUserIdCache.set(userId, member.id);
          return member.id;
        }
        if (realName && userRow.full_name && realName.toLowerCase() === userRow.full_name.toLowerCase()) {
          humanSlackUserIdCache.set(userId, member.id);
          return member.id;
        }
      }
    }
  } catch (err) {
    console.error('[EmojiUtil] Failed to resolve human Slack user ID:', err);
  }
  return null;
}

const MANUAL_SLACK_TO_EMOJI: Record<string, string> = {
  'thumbsup': '👍',
  '+1': '👍',
  'heart': '❤️',
  'joy': '😂',
  'laughing': '😂',
  'fire': '🔥',
  'clap': '👏',
  'tada': '🎉',
  'open_mouth': '😮',
  'cry': '😢',
  'eyes': '👀',
  'rocket': '🚀'
};

const MANUAL_EMOJI_TO_SLACK: Record<string, string> = {
  '👍': 'thumbsup',
  '❤️': 'heart',
  '😂': 'joy',
  '🔥': 'fire',
  '👏': 'clap',
  '🎉': 'tada',
  '😮': 'open_mouth',
  '😢': 'cry',
  '👀': 'eyes',
  '🚀': 'rocket'
};

// Build reverse map dynamically
const unicodeToSlackMap: Record<string, string> = { ...MANUAL_EMOJI_TO_SLACK };

try {
  const allEmojis = (toEmoji as any).emoji;
  if (allEmojis) {
    for (const [name, emoji] of Object.entries(allEmojis)) {
      if (typeof emoji === 'string') {
        unicodeToSlackMap[emoji] = name;
      }
    }
  }
} catch (e) {
  console.error('[EmojiUtil] Failed to build dynamic reverse emoji map:', e);
}

export function slackToUnicode(slackName: string): string {
  // Strip colons if present (e.g. :fire: -> fire)
  const cleanName = slackName.replace(/:/g, '');
  
  if (MANUAL_SLACK_TO_EMOJI[cleanName]) {
    return MANUAL_SLACK_TO_EMOJI[cleanName];
  }
  
  const mapped = toEmoji.get(cleanName);
  return mapped || slackName; // Fallback to raw slackName if not found
}

export function unicodeToSlack(emoji: string): string {
  if (unicodeToSlackMap[emoji]) {
    return unicodeToSlackMap[emoji];
  }
  return emoji;
}
