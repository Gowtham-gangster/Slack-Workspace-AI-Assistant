import { MCPClientManager, parseMCPResponse } from '../src/services/mcpClient.ts';
import { generateText } from '../src/services/ai.ts';
import { initializeDatabase } from '../src/db/index.ts';

async function test() {
  initializeDatabase();
  const mcpManager = MCPClientManager.getInstance();
  await mcpManager.initializeClient();
  
  console.log('Fetching channel history...');
  const response = await mcpManager.callTool('slack_get_channel_history', {
    channel_id: 'C0BC420MMHP',
    limit: 50
  });
  
  const parsed = parseMCPResponse(response);
  const messages = parsed?.messages || (Array.isArray(parsed) ? parsed : []);
  console.log('Messages retrieved:', messages.length);
  
  if (messages.length === 0) {
    console.log('No messages found in channel.');
    return;
  }
  
  const messagesText = messages.map((m: any) => `User ${m.user || 'bot'}: ${m.text || ''}`).reverse().join('\n');
  const prompt = `Extract all action plans, tasks, owners, and deadlines discussed in this channel. 
Return ONLY a valid JSON array of objects, with no markdown code blocks, backticks, or extra text. 
Each object must have these exact keys: task, owner, status, deadline.
If there are no tasks, return an empty array [].

Slack Discussion:
${messagesText}`;
  
  console.log('Calling generateText...');
  const llmResult = await generateText(prompt);
  console.log('LLM Result:', llmResult);
}

test().then(() => process.exit(0)).catch(console.error);
