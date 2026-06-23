import { runAgentCompletion } from '../src/services/ai.ts';
import { initializeDatabase, db } from '../src/db/index.ts';

async function test() {
  initializeDatabase();
  
  // Fetch channels list for context
  let channelListStr = 'No channels cached yet.';
  try {
    const cachedChannels = db.prepare('SELECT id, name FROM slack_channels').all() as Array<{ id: string; name: string }>;
    if (cachedChannels.length > 0) {
      channelListStr = cachedChannels.map(c => `#${c.name} (ID: ${c.id})`).join(', ');
    }
  } catch (err) {}
  
  const systemPromptText = `You are "Slack AI Workspace Assistant", a helpful AI collaborator.
You are connected to the user's Slack workspace through the Model Context Protocol (MCP) server.
You have access to tools that allow you to search messages, list channels, fetch message histories, get user profiles, and send Slack messages/replies.
Always prefer calling the appropriate MCP tool to fetch recent and accurate workspace data rather than guessing.

Available channels in the workspace: ${channelListStr}.

CRITICAL INSTRUCTION FOR MESSAGE RETRIEVAL:
If the user asks to see, retrieve, search, list, or check actual Slack messages (e.g., "latest msgs", "messages from #general", "what did pushpa say", "search for database messages"):
1. You MUST call the appropriate MCP tool (e.g., slack_get_channel_history) to retrieve the actual messages.
2. If no channel name is explicitly specified in the query, you MUST default to using "#all-gowtham" (ID: C0BC420MMHP) as the target channel. Do NOT ask the user which channel they want.
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

  console.log('System Prompt Context:', channelListStr);
  console.log('Sending query: "latest msgs"...');
  
  const result = await runAgentCompletion([
    { role: 'system', content: systemPromptText },
    { role: 'user', content: 'latest msgs' }
  ], 'test-msg-id', (event) => {
    if (event.type === 'tool_start') {
      console.log('Tool start:', event.toolName, event.toolArgs);
    } else if (event.type === 'tool_end') {
      console.log('Tool end:', event.toolName, event.status);
    }
  });
  
  console.log('Final Agent Result:\n', result);
}

test().then(() => process.exit(0)).catch(console.error);
