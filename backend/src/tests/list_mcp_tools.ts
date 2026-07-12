import { db } from '../db/index.js';
import { MCPClientManager } from '../services/mcpClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    await db.connect();
    const manager = MCPClientManager.getInstance(3);
    console.log('Initializing MCP Client...');
    await manager.initializeClient();
    const tools = await manager.listTools();
    const threadTools = tools.filter(t => t.name === 'slack_reply_to_thread' || t.name === 'slack_get_thread_replies');
    for (const tool of threadTools) {
      console.log(`Tool: ${tool.name}`);
      console.log(JSON.stringify(tool.inputSchema, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
