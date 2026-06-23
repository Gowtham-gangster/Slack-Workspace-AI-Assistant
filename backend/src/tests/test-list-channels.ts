import { MCPClientManager } from '../services/mcpClient.js';
import { db } from '../db/index.js';

async function testList() {
  const mcpManager = MCPClientManager.getInstance(1);
  await mcpManager.initializeClient();
  
  console.log('Testing slack_list_channels with no arguments...');
  try {
    const res1 = await mcpManager.callTool('slack_list_channels', {});
    console.log('Result (no args):', JSON.stringify(res1, null, 2));
  } catch (e) {
    console.error('Error (no args):', e);
  }

  console.log('\nTesting slack_list_channels with array types...');
  try {
    const res2 = await mcpManager.callTool('slack_list_channels', { types: ['public_channel'] });
    console.log('Result (array types):', JSON.stringify(res2, null, 2));
  } catch (e) {
    console.error('Error (array types):', e);
  }

  await mcpManager.disconnect();
}

testList().catch(console.error);
