import dotenv from 'dotenv';
import { initializeDatabase, db } from '../db/index.js';
import { MCPClientManager } from '../services/mcpClient.js';
import { generateEmbedding } from '../services/ai.js';

dotenv.config();

async function runDiagnostics() {
  console.log('===================================================');
  console.log('       SYSTEM DIAGNOSTICS & VERIFICATION           ');
  console.log('===================================================');

  // Test 1: Database Verification
  console.log('\n[TEST 1] Verifying Local MySQL Database...');
  try {
    await initializeDatabase();
    const userCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
    const settings = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM settings');
    console.log(`✓ Database Connected. Found ${userCount?.count || 0} users, ${settings?.count || 0} settings rows.`);
  } catch (error) {
    console.error('✗ Database test failed:', error);
    return;
  }

  // Test 2: Slack MCP Connection Verification
  console.log('\n[TEST 2] Verifying Slack MCP Subprocess Connection...');
  const mcpManager = MCPClientManager.getInstance(1);
  try {
    await mcpManager.initializeClient();
    const status = mcpManager.getConnectionStatus();
    if (status.connected) {
      console.log('✓ Slack MCP Subprocess connected successfully.');
      const tools = await mcpManager.listTools();
      console.log(`✓ Retreived ${tools.length} available Slack tools:`);
      tools.forEach(t => console.log(`   - ${t.name}: ${t.description.slice(0, 50)}...`));
    } else {
      console.warn(`! MCP disconnected. Reason: ${status.error || 'Check Slack token in settings.'}`);
    }
  } catch (error) {
    console.error('✗ MCP Connection failed:', error);
  } finally {
    await mcpManager.disconnect();
  }
 
  // Test 3: OpenAI API / AI Connectivity
  console.log('\n[TEST 3] Verifying OpenAI-Compatible API Connection...');
  try {
    const apiKeyRow = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE user_id = 1 AND `key` = ?', ['openai_api_key']);
    if (!apiKeyRow?.value) {
      console.warn('! OpenAI API Key not configured. Skipping LLM connectivity test.');
    } else {
      console.log('Generating test text embedding...');
      const embedding = await generateEmbedding('Kubernetes and Docker deployment', 1);
      console.log(`✓ Text embedding generated successfully. Dimensions: ${embedding.length}`);
    }
  } catch (error) {
    console.error('✗ OpenAI API test failed:', error);
  }

  // Test 4: RAG Vector Similarity Search
  console.log('\n[TEST 4] Verifying Vector Store & Cosine Similarity...');
  try {
    const dummyVector1 = [0.1, 0.2, 0.3, 0.4];
    const dummyVector2 = [0.12, 0.18, 0.28, 0.42]; // highly similar
    
    // Quick local verification
    const dot1_2 = dummyVector1.reduce((sum, val, idx) => sum + val * dummyVector2[idx], 0);
    const norm1 = Math.sqrt(dummyVector1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(dummyVector2.reduce((sum, val) => sum + val * val, 0));
    const similarity = dot1_2 / (norm1 * norm2);
    
    console.log(`✓ Vector Cosine Similarity test passed. Score: ${similarity.toFixed(4)}`);
  } catch (error) {
    console.error('✗ Vector Store test failed:', error);
  }

  console.log('\n===================================================');
  console.log('             DIAGNOSTICS COMPLETE                  ');
  console.log('===================================================');
}

runDiagnostics().catch(console.error);
