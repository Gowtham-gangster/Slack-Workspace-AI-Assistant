import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'slack-ai-assistant-secret-key-12345';
const BACKEND_URL = 'http://localhost:3001';

async function testRetrieveEndpoint() {
  console.log('Generating dummy JWT Token...');
  const token = jwt.sign(
    { id: 1, username: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const queries = [
    { query: 'latest 5 messages', description: 'Default query (latest messages)' },
    { query: 'latest 10 messages from general', description: 'Query targeting #general' },
    { query: 'messages containing hello', description: 'Query filtering by keyword hello' }
  ];

  for (const q of queries) {
    console.log(`\n--------------------------------------------`);
    console.log(`Testing query: "${q.query}" (${q.description})`);
    console.log(`--------------------------------------------`);

    try {
      const response = await fetch(`${BACKEND_URL}/api/channels/retrieve-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: q.query
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Error response (${response.status}):`, errText);
        continue;
      }

      const data = await response.json() as any;
      console.log('✓ Response Status: Success');
      console.log('✓ Explanation:', data.explanation);
      console.log('✓ Resolved Channel:', data.channelName, `(ID: ${data.channelId})`);
      console.log('✓ Filters parsed:', JSON.stringify(data.filters, null, 2));
      console.log(`✓ Messages retrieved: ${data.messages?.length || 0}`);
      if (data.messages && data.messages.length > 0) {
        console.log('First message preview:', data.messages[0]);
      }
    } catch (e: any) {
      console.error('Fetch request failed:', e.message);
    }
  }
}

testRetrieveEndpoint().catch(console.error);
