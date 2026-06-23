import { db } from '../db/index.js';
import { generateEmbedding } from './ai.js';
import { MCPClientManager, parseMCPResponse } from './mcpClient.js';

export interface SearchResult {
  entityType: 'message' | 'thread' | 'report';
  entityId: string;
  content: string;
  similarity: number;
  channelId?: string; // added if it's a message
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0; // standard mismatch fallback
  }
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return -1;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Saves or updates an embedding for an entity
 */
export async function saveEmbedding(
  userId: number,
  entityType: 'message' | 'thread' | 'report',
  entityId: string,
  content: string,
  embeddingVector: number[]
): Promise<void> {
  // Delete existing embedding for this entity to prevent duplicate records
  await db.execute(`
    DELETE FROM embeddings 
    WHERE user_id = ? AND entity_type = ? AND entity_id = ?
  `, [userId, entityType, entityId]);

  // Insert the new embedding
  await db.execute(`
    INSERT INTO embeddings (user_id, entity_type, entity_id, content, embedding)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, entityType, entityId, content, JSON.stringify(embeddingVector)]);
}

/**
 * Searches the database for entities semantically similar to the query text
 */
export async function searchSemanticStore(
  queryText: string,
  userId: number,
  limit = 5,
  threshold = 0.3
): Promise<SearchResult[]> {
  try {
    const queryVector = await generateEmbedding(queryText, userId);
    
    // Retrieve user-scoped embeddings from MySQL
    const allEmbeddings = await db.query<{
      entity_type: 'message' | 'thread' | 'report';
      entity_id: string;
      content: string;
      embedding: string;
    }>(`
      SELECT entity_type, entity_id, content, embedding 
      FROM embeddings
      WHERE user_id = ?
    `, [userId]);

    const results: SearchResult[] = [];

    for (const row of allEmbeddings) {
      try {
        const rowVector = JSON.parse(row.embedding) as number[];
        const similarity = cosineSimilarity(queryVector, rowVector);

        if (similarity >= threshold) {
          // If it's a message, check if we can join channel info
          let channelId: string | undefined = undefined;
          if (row.entity_type === 'message') {
            const msgInfo = await db.queryOne<{ channel_id: string }>('SELECT channel_id FROM slack_messages WHERE db_user_id = ? AND id = ?', [userId, row.entity_id]);
            channelId = msgInfo?.channel_id;
          }

          results.push({
            entityType: row.entity_type,
            entityId: row.entity_id,
            content: row.content,
            similarity,
            channelId
          });
        }
      } catch (parseError) {
        console.warn('Failed to parse vector embedding row ID:', row.entity_id, parseError);
      }
    }

    // Sort by similarity descending and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  } catch (error) {
    console.error('Local semantic search failed:', error);
    return [];
  }
}

/**
 * Sync channels lists and messages history from Slack MCP Server, and index them in RAG layer
 */
export async function syncSlackWorkspace(userId: number, channelLimit = 10, messagesPerChannel = 50): Promise<{ channelsSynced: number; messagesSynced: number; embeddedCount: number }> {
  const mcpManager = MCPClientManager.getInstance(userId);
  if (!mcpManager.isConnected()) {
    await mcpManager.initializeClient();
  }

  let channelsSynced = 0;
  let messagesSynced = 0;
  let embeddedCount = 0;

  try {
    // 1. Fetch channel list from MCP
    const mcpResponse = await mcpManager.callTool('slack_list_channels', { types: ['public_channel'] });
    const parsedRes = parseMCPResponse(mcpResponse);
    const channels = parsedRes?.channels || (Array.isArray(parsedRes) ? parsedRes : []);
    
    if (!Array.isArray(channels)) {
      console.warn('No channels returned from slack_list_channels, got:', mcpResponse);
      return { channelsSynced, messagesSynced, embeddedCount };
    }

    const insertChannelQuery = `
      INSERT INTO slack_channels (db_user_id, id, name, is_private, topic, purpose, member_count, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        topic = VALUES(topic),
        purpose = VALUES(purpose),
        member_count = VALUES(member_count),
        last_synced_at = CURRENT_TIMESTAMP()
    `;

    const insertMessageQuery = `
      REPLACE INTO slack_messages (db_user_id, id, channel_id, user_id, text, thread_ts, reply_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Only sync a few channels to prevent hitting heavy OpenAI/Gemini API limits immediately
    const channelsToSync = channels.slice(0, channelLimit);

    for (const ch of channelsToSync) {
      const channelId = ch.id;
      const channelName = ch.name || '';
      const topic = ch.topic?.value || '';
      const purpose = ch.purpose?.value || '';
      const memberCount = ch.num_members || 0;
      const isPrivate = ch.is_private ? 1 : 0;

      await db.execute(insertChannelQuery, [userId, channelId, channelName, isPrivate, topic, purpose, memberCount]);
      channelsSynced++;

      console.log(`Syncing messages for channel: #${channelName} (${channelId})`);

      // 2. Fetch history for this channel
      const historyResponse = await mcpManager.callTool('slack_get_channel_history', {
        channel_id: channelId,
        limit: messagesPerChannel
      });

      const parsedHistory = parseMCPResponse(historyResponse);
      const messages = parsedHistory?.messages || (Array.isArray(parsedHistory) ? parsedHistory : []);
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          const msgId = msg.ts;
          const msgUserId = msg.user || 'bot';
          const text = msg.text || '';
          const threadTs = msg.thread_ts || null;
          const replyCount = msg.reply_count || 0;

          if (!text.trim()) continue;

          await db.execute(insertMessageQuery, [userId, msgId, channelId, msgUserId, text, threadTs, replyCount]);
          messagesSynced++;

          // 3. Generate embedding and index for RAG if not already embedded
          const alreadyEmbedded = await db.queryOne<{ 1: number }>(
            "SELECT 1 FROM embeddings WHERE user_id = ? AND entity_type = 'message' AND entity_id = ?",
            [userId, msgId]
          );
          if (!alreadyEmbedded) {
            try {
              // Concatenate details for richer semantic search context
              const semanticText = `[Channel: #${channelName}] [User: ${msgUserId}]: ${text}`;
              const vector = await generateEmbedding(semanticText, userId);
              await saveEmbedding(userId, 'message', msgId, text, vector);
              embeddedCount++;
            } catch (embedError) {
              console.error(`Failed to generate embedding for message ${msgId}:`, embedError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Sync slack workspace completed with errors:', error);
  }

  return { channelsSynced, messagesSynced, embeddedCount };
}
