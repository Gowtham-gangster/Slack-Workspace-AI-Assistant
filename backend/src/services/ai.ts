// Using global fetch (standard in Node 18+)
import { db } from '../db/index.js';
import { MCPClientManager } from './mcpClient.js';

// Ordered list of fallback models to try when primary is overloaded
const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
];

// ── In-memory cache for API config (TTL: 60s per user) ──────────────
const apiConfigCache = new Map<number, { value: Awaited<ReturnType<typeof _getAPIConfigUncached>>; expiresAt: number }>();
const API_CONFIG_TTL_MS = 60_000;

// ── In-memory cache for MCP tools (TTL: 5 min per user) ─────────────
const mcpToolsCache = new Map<number, { value: any[]; expiresAt: number }>();
const MCP_TOOLS_TTL_MS = 5 * 60_000;

/** Sleep helper */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps a fetch call with automatic retry + model fallback.
 * Retries on 503 (overloaded) and 429 (rate limited) with exponential backoff.
 * On 503, also tries next model in the fallback chain before giving up.
 */
async function fetchWithRetry(
  buildRequest: (model: string) => { url: string; init: RequestInit },
  primaryModel: string,
  maxRetries = 3
): Promise<Response> {
  const models = GEMINI_FALLBACK_MODELS.includes(primaryModel)
    ? [primaryModel, ...GEMINI_FALLBACK_MODELS.filter(m => m !== primaryModel)]
    : [primaryModel];

  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { url, init } = buildRequest(model);
      const response = await fetch(url, init);

      if (response.ok) return response;

      const status = response.status;
      const errText = await response.text();

      if (status === 503 || status === 429) {
        // Daily quota limit exceeded - fail fast immediately without any retries
        const isDailyQuotaExceeded = status === 429 && (
          errText.includes('Quota exceeded') ||
          errText.includes('free_tier') ||
          errText.includes('daily') ||
          errText.includes('RESOURCE_EXHAUSTED')
        );

        if (isDailyQuotaExceeded) {
          console.error(`[AI] Daily LLM quota exceeded for model ${model}. Failing fast.`);
          throw new Error(`LLM error: ${status} ${errText}`);
        }

        const isOverload = errText.includes('UNAVAILABLE') || errText.includes('overloaded') || status === 429;
        if (isOverload) {
          const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[AI] Model ${model} returned ${status}. Waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}...`);
          await sleep(waitMs);
          lastError = new Error(`LLM error: ${status} ${errText}`);
          continue; // retry same model
        }
      }

      // Non-retryable error — throw immediately
      throw new Error(`LLM error: ${status} ${errText}`);
    }
    
    // If the error was a rate limit/quota limit (429), do not try fallback models (they share the key/quota)
    if (lastError?.message?.includes('429')) {
      console.warn(`[AI] Model failed with 429 rate limit. Skipping fallback models to prevent delay.`);
      break;
    }
    
    // All retries exhausted for this model, try next fallback
    console.warn(`[AI] All retries exhausted for model ${model}. Trying next fallback...`);
  }

  throw lastError || new Error('All AI models failed to respond.');
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

interface StreamedToolCall {
  id?: string;
  name?: string;
  arguments: string;
}

/** Raw uncached implementation — do not call directly outside of getAPIConfig */
async function _getAPIConfigUncached(userId: number): Promise<{ apiKey: string; apiBase: string; model: string; embedModel: string }> {
  // Batch all 4 settings in a single query for speed
  const rows = await db.query<{ key: string; value: string }>(
    'SELECT `key`, value FROM settings WHERE user_id = ? AND `key` IN (?, ?, ?, ?)',
    [userId, 'openai_api_key', 'openai_api_base', 'openai_model_name', 'openai_embedding_model_name']
  );
  const settingsMap: Record<string, string> = {};
  for (const r of rows) settingsMap[r.key] = r.value;

  let apiKey = settingsMap['openai_api_key'] || process.env.OPENAI_API_KEY || '';
  let apiBase = settingsMap['openai_api_base'] || 'https://api.openai.com/v1';
  let model = settingsMap['openai_model_name'] || 'gemini-2.5-flash';
  let embedModel = settingsMap['openai_embedding_model_name'] || 'gemini-embedding-2';

  // Normalize apiBase
  apiBase = apiBase.trim();
  if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);

  // Detect Gemini API key or base URL
  const isGemini = apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.') || apiBase.includes('generativelanguage.googleapis.com');

  if (isGemini) {
    if (!apiBase.includes('generativelanguage.googleapis.com')) {
      apiBase = 'https://generativelanguage.googleapis.com/v1beta/openai';
    }
    if (model === 'gpt-4o' || model.startsWith('gpt-') || model.includes('gemini-1.')) {
      model = 'gemini-2.5-flash';
    }
    if (embedModel.startsWith('text-embedding-') || !embedModel.startsWith('gemini-')) {
      embedModel = 'gemini-embedding-2';
    }
  }

  return { apiKey, apiBase, model, embedModel };
}

/** Cached wrapper — returns config from memory if fresh, otherwise re-fetches */
export async function getAPIConfig(userId: number): Promise<{ apiKey: string; apiBase: string; model: string; embedModel: string }> {
  const cached = apiConfigCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const value = await _getAPIConfigUncached(userId);
  apiConfigCache.set(userId, { value, expiresAt: Date.now() + API_CONFIG_TTL_MS });
  return value;
}

/** Call this when the user updates their settings so config is re-fetched next time */
export function invalidateAPIConfigCache(userId: number): void {
  apiConfigCache.delete(userId);
}

export async function generateEmbedding(text: string, userId: number): Promise<number[]> {
  const { apiKey, apiBase, embedModel: model } = await getAPIConfig(userId);

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured for embeddings. Please configure it in Settings.');
  }

  const response = await fetch(`${apiBase}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input: text,
      model: model
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${errText}`);
  }

  const data = await response.json() as any;
  if (!data?.data?.[0]?.embedding) {
    throw new Error('Invalid response structure from Embeddings API');
  }
  return data.data[0].embedding;
}

export async function generateText(prompt: string, userId: number): Promise<string> {
  const { apiKey, apiBase, model } = await getAPIConfig(userId);

  if (!apiKey) {
    throw new Error('API Key is not configured in Settings.');
  }

  const response = await fetchWithRetry(
    (currentModel) => ({
      url: `${apiBase}/chat/completions`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        })
      }
    }),
    model
  );

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

export async function generateTextStream(
  prompt: string,
  userId: number,
  onToken: (token: string) => void
): Promise<string> {
  const { apiKey, apiBase, model } = await getAPIConfig(userId);

  if (!apiKey) {
    throw new Error('API Key is not configured in Settings.');
  }

  const response = await fetchWithRetry(
    (currentModel) => ({
      url: `${apiBase}/chat/completions`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          stream: true
        })
      }
    }),
    model
  );

  const body = response.body;
  if (!body) {
    throw new Error('Response body is empty');
  }

  let textResponse = '';
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  for await (const chunk of body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned) continue;
      if (cleaned === 'data: [DONE]') continue;
      if (cleaned.startsWith('data: ')) {
        try {
          const json = JSON.parse(cleaned.slice(6));
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            textResponse += delta.content;
            onToken(delta.content);
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }
  }

  if (buffer && buffer.startsWith('data: ')) {
    try {
      const json = JSON.parse(buffer.slice(6));
      const delta = json.choices?.[0]?.delta;
      if (delta?.content) {
        textResponse += delta.content;
        onToken(delta.content);
      }
    } catch (e) {}
  }

  return textResponse;
}

export async function runAgentCompletion(
  messages: Message[],
  messageId: string, // current message ID for logging tool calls
  userId: number,
  onEvent: (event: { type: string; content?: any; status?: string; toolName?: string; toolArgs?: any; result?: any }) => void
): Promise<string> {
  const { apiKey, apiBase, model } = await getAPIConfig(userId);

  if (!apiKey) {
    throw new Error('API key is not configured. Please set it in Settings.');
  }

  const mcpManager = MCPClientManager.getInstance(userId);
  
  // 1. Fetch available tools from the Slack MCP Server (cached per user, 5-min TTL)
  let mcpTools: any[] = [];
  try {
    const toolsCached = mcpToolsCache.get(userId);
    if (toolsCached && Date.now() < toolsCached.expiresAt) {
      mcpTools = toolsCached.value;
    } else {
      mcpTools = await mcpManager.listTools();
      mcpToolsCache.set(userId, { value: mcpTools, expiresAt: Date.now() + MCP_TOOLS_TTL_MS });
    }
  } catch (error) {
    console.warn('Failed to retrieve MCP tools. AI agent will run without Slack tools.', error);
  }

  // Format MCP tools to OpenAI tool definitions
  const tools = mcpTools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));

  // We keep running the completion in a loop until the assistant output doesn't request any tools
  let currentMessages = [...messages];
  let loopCount = 0;
  const maxLoops = 8; // prevent infinite loops

  while (loopCount < maxLoops) {
    loopCount++;
    console.log(`Agent loop run #${loopCount}`);

    const requestBody: any = {
      model,
      messages: currentMessages,
      stream: true
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetchWithRetry(
      (currentModel) => ({
        url: `${apiBase}/chat/completions`,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ ...requestBody, model: currentModel })
        }
      }),
      model
    );

    const body = response.body;
    if (!body) {
      throw new Error('Response body is empty');
    }

    // Accumulators for this stream pass
    let textResponse = '';
    const streamedToolCalls: StreamedToolCall[] = [];

    // Parse the stream
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    for await (const chunk of body as any) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;
        if (cleaned === 'data: [DONE]') continue;
        if (cleaned.startsWith('data: ')) {
          try {
            const json = JSON.parse(cleaned.slice(6));
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle text content streaming
            if (delta.content) {
              textResponse += delta.content;
              onEvent({ type: 'text', content: delta.content });
            }

            // Handle tool calls streaming
            if (delta.tool_calls) {
              for (let i = 0; i < delta.tool_calls.length; i++) {
                const tc = delta.tool_calls[i];
                const idx = typeof tc.index === 'number' ? tc.index : i;
                if (!streamedToolCalls[idx]) {
                  streamedToolCalls[idx] = { arguments: '' };
                }
                if (tc.id) streamedToolCalls[idx].id = tc.id;
                if (tc.function?.name) streamedToolCalls[idx].name = tc.function.name;
                if (tc.function?.arguments) {
                  streamedToolCalls[idx].arguments += tc.function.arguments;
                }
              }
            }
          } catch (e) {
            // Ignore parse errors from malformed chunks
          }
        }
      }
    }

    // Process remainder buffer
    if (buffer && buffer.startsWith('data: ')) {
      try {
        const json = JSON.parse(buffer.slice(6));
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) {
          textResponse += delta.content;
          onEvent({ type: 'text', content: delta.content });
        }
      } catch (e) {}
    }

    // Filter out undefined index values from tool calls array
    const activeToolCalls = streamedToolCalls.filter(tc => tc !== undefined && tc.name);

    if (activeToolCalls.length === 0) {
      // No tools called, this is the final answer!
      return textResponse;
    }

    // The assistant called tools! We must execute them and update the context.
    const assistantMessage: Message = {
      role: 'assistant',
      content: textResponse || '',
      tool_calls: activeToolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name!,
          arguments: tc.arguments
        }
      }))
    };

    currentMessages.push(assistantMessage);

    // Run each tool call sequentially or in parallel
    for (const tc of activeToolCalls) {
      const toolName = tc.name!;
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(tc.arguments || '{}');
      } catch (err) {
        console.warn(`Failed to parse arguments for tool ${toolName}: ${tc.arguments}`);
      }

      // Notify the frontend we are executing a tool
      onEvent({
        type: 'tool_start',
        toolName,
        toolArgs: parsedArgs
      });

      let toolResultText = '';
      try {
        const toolResponse = await mcpManager.callTool(toolName, parsedArgs, messageId);
        toolResultText = JSON.stringify(toolResponse);
        
        onEvent({
          type: 'tool_end',
          toolName,
          status: 'success',
          result: toolResponse
        });
      } catch (toolError: any) {
        toolResultText = JSON.stringify({ error: toolError?.message || String(toolError) });
        
        onEvent({
          type: 'tool_end',
          toolName,
          status: 'error',
          result: { error: toolError?.message || String(toolError) }
        });
      }

      // Append tool response to chat history
      currentMessages.push({
        role: 'tool',
        content: toolResultText,
        tool_call_id: tc.id!,
        name: toolName
      });
    }
  }

  throw new Error('AI agent exceeded maximum tool call loops without a final response.');
}
