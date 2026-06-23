import { db } from '../src/db/index.ts';
import { initializeDatabase } from '../src/db/index.ts';

async function test() {
  initializeDatabase();
  const apiKeyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key') as { value: string } | undefined;
  const apiKey = apiKeyRow?.value || '';

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'user', content: 'latest msgs' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'slack_get_channel_history',
            description: 'Get history',
            parameters: {
              type: 'object',
              properties: {
                channel_id: { type: 'string' }
              },
              required: ['channel_id']
            }
          }
        }
      ],
      stream: true
    })
  });

  const body = response.body;
  if (!body) {
    console.log('No body');
    return;
  }

  for await (const chunk of body as any) {
    console.log('CHUNK:', chunk.toString());
  }
}

test().catch(console.error);
