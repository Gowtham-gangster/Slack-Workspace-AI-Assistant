import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { db } from "../db/index.js";

export class MCPClientManager {
  private static instances = new Map<number, MCPClientManager>();
  private userId: number;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnecting = false;
  private connectionError: string | null = null;
  private cachedUsers: any = null;
  private cachedUsersTime = 0;

  private constructor(userId: number) {
    this.userId = userId;
  }

  public static getInstance(userId: number): MCPClientManager {
    if (!MCPClientManager.instances.has(userId)) {
      MCPClientManager.instances.set(userId, new MCPClientManager(userId));
    }
    return MCPClientManager.instances.get(userId)!;
  }

  public static async disconnectAll(): Promise<void> {
    for (const [uid, manager] of MCPClientManager.instances.entries()) {
      console.log(`Disconnecting Slack MCP Client for user ${uid}...`);
      await manager.disconnect();
    }
    MCPClientManager.instances.clear();
  }

  /**
   * Initializes or restarts the MCP connection using the configured Slack Bot Token
   */
  public async initializeClient(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;
    this.connectionError = null;

    try {
      // 1. Clean up existing connection if it exists
      await this.disconnect();

      // 2. Fetch credentials from database
      const tokenRow = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE user_id = ? AND `key` = ?', [this.userId, 'mcp_slack_bot_token']);
      const teamIdRow = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE user_id = ? AND `key` = ?', [this.userId, 'mcp_slack_team_id']);

      const token = tokenRow?.value;
      const teamId = teamIdRow?.value;

      if (!token) {
        console.warn('MCP Slack Bot Token is not configured. MCP Client will not start.');
        this.connectionError = 'Slack Bot Token is missing in configuration settings.';
        this.isConnecting = false;
        return;
      }

      // 2.5 Validate token and teamId via Slack auth.test API
      console.log(`Validating Slack credentials for user ${this.userId}...`);
      const authTestResponse = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
      if (!authTestResponse.ok) {
        // Do not expose raw API response (may contain sensitive info)
        throw new Error(`Slack API returned HTTP ${authTestResponse.status} during credential validation.`);
      }
      const authData = await authTestResponse.json() as any;
      if (!authData.ok) {
        // Expose only the Slack error code, not the full response
        throw new Error(`Slack Authentication Failed: ${authData.error || 'invalid_auth'}`);
      }
      if (teamId && authData.team_id !== teamId) {
        throw new Error(`Mismatched Team ID: Configured Slack Team ID "${teamId}" does not match the Slack Workspace Team ID "${authData.team_id}" for this Bot Token.`);
      }
      console.log(`Slack credentials validated successfully. Workspace: ${authData.team} (ID: ${authData.team_id}).`);

      console.log('Initializing Slack MCP Client...');
      
      // Determine command name based on OS (use cmd.exe /c on Windows to bypass spawn security limitations)
      let command = 'npx';
      let args = ['-y', '@modelcontextprotocol/server-slack'];
      
      if (process.platform === 'win32') {
        command = 'cmd.exe';
        args = ['/c', 'npx -y @modelcontextprotocol/server-slack'];
      }
      
      const env = {
        ...process.env,
        SLACK_BOT_TOKEN: token,
      };

      // Add team ID if specified
      if (teamId) {
        (env as any).SLACK_TEAM_ID = teamId;
      }

      console.log(`Spawning Slack MCP Server: ${command} ${args.join(' ')}`);
      
      this.transport = new StdioClientTransport({
        command,
        args,
        env
      });

      this.client = new Client(
        { name: "slack-ai-assistant-client", version: "1.0.0" },
        { capabilities: {} }
      );

      await this.client.connect(this.transport);
      console.log('Successfully connected to Slack MCP Server.');
    } catch (error: any) {
      console.error('Failed to connect to Slack MCP Server:', error);
      this.connectionError = error?.message || String(error);
      this.client = null;
      this.transport = null;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Retrieves list of available tools from the MCP server
   */
  public async listTools(): Promise<any[]> {
    if (!this.client) {
      // Try to initialize on-demand if not connected
      await this.initializeClient();
    }
    if (!this.client) {
      throw new Error(`MCP Client is not connected. Reason: ${this.connectionError || 'Unknown connection error'}`);
    }

    try {
      const response = await this.client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error('Failed to list tools from MCP server:', error);
      throw error;
    }
  }

  /**
   * Invokes an MCP tool and logs the execution in the database
   */
  public async callTool(toolName: string, args: any, messageId: string | null = null): Promise<any> {
    if (toolName === 'slack_get_users' && this.cachedUsers && (Date.now() - this.cachedUsersTime < 300000)) {
      console.log(`[MCP Tool Call] Returning cached slack_get_users response.`);
      return this.cachedUsers;
    }

    if (!this.client) {
      await this.initializeClient();
    }
    if (!this.client) {
      throw new Error(`MCP Client is not connected. Reason: ${this.connectionError || 'Unknown connection error'}`);
    }

    const argsString = JSON.stringify(args);
    console.log(`[MCP Tool Call] Running: ${toolName} with args: ${argsString}`);

    let result: any = null;
    let status: 'success' | 'error' = 'success';

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args
      });
      result = response;
      console.log(`[MCP Tool Call Success] ${toolName} returned:`, JSON.stringify(response).substring(0, 1000));
      if (toolName === 'slack_get_users') {
        this.cachedUsers = response;
        this.cachedUsersTime = Date.now();
      }
      return response;
    } catch (error: any) {
      status = 'error';
      result = { error: error?.message || String(error) };
      console.error(`[MCP Tool Call Error] ${toolName}:`, error);
      throw error;
    } finally {
      // Log tool execution in database
      try {
        await db.execute(`
          INSERT INTO tool_executions (message_id, tool_name, arguments, result, status)
          VALUES (?, ?, ?, ?, ?)
        `, [
          messageId,
          toolName,
          argsString,
          JSON.stringify(result),
          status
        ]);
      } catch (logError) {
        console.error('Failed to write tool execution audit log:', logError);
      }
    }
  }

  /**
   * Disconnects and cleans up process resources
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {
        // ignore errors during cleanup
      }
      this.client = null;
    }
    this.transport = null;
    console.log('Slack MCP Server connection closed.');
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  public getConnectionStatus() {
    return {
      connected: this.client !== null,
      connecting: this.isConnecting,
      error: this.connectionError
    };
  }
}

/**
 * Helper to parse standard MCP content text array responses
 */
export function parseMCPResponse(response: any): any {
  if (!response || !response.content || !Array.isArray(response.content)) {
    return response;
  }
  const textItem = response.content.find((c: any) => c.type === 'text');
  if (!textItem || !textItem.text) {
    return response;
  }
  try {
    return JSON.parse(textItem.text);
  } catch (e) {
    // Return the text directly if not valid JSON
    return textItem.text;
  }
}
