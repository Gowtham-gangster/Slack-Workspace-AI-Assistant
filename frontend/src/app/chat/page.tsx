'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import { apiFetch, getAuthToken } from '../../lib/api';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  Terminal, 
  Plus, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Clock,
  Compass
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ToolExecution {
  tool_name: string;
  arguments: string; // JSON string
  result?: string; // JSON string
  status: 'success' | 'error' | 'running';
  executed_at?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  toolExecutions?: ToolExecution[];
}

// Custom simple parser to render assistant text (headers, bold, lists, and code blocks)
function renderChatMarkdown(md: string, onCopyCode: (text: string) => void, isLightMode: boolean) {
  if (!md) return '';
  
  // Format code blocks
  let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    return `
      <div class="my-4 rounded-xl border overflow-hidden font-mono text-xs ${
        isLightMode ? 'border-slate-200 bg-slate-50' : 'border-border bg-[#0b0c13]'
      }">
        <div class="flex items-center justify-between px-4 py-2 border-b text-[10px] ${
          isLightMode ? 'border-slate-200 bg-slate-100/80 text-slate-500' : 'border-border bg-[#0d0f18] text-muted-foreground'
        }">
          <span>${lang || 'code'}</span>
          <button class="flex items-center gap-1 transition-colors code-copy-btn ${
            isLightMode ? 'hover:text-slate-900 text-slate-500' : 'hover:text-white text-muted-foreground'
          }" data-code="${encodeURIComponent(code)}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
        <pre class="p-4 overflow-x-auto ${isLightMode ? 'text-slate-800' : 'text-slate-300'}"><code>${escapedCode}</code></pre>
      </div>
    `;
  });

  // Standard markdown rendering
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, `<h4 class="text-xs font-bold mt-4 mb-2 uppercase tracking-wide ${isLightMode ? 'text-slate-800' : 'text-white'}">$1</h4>`)
    .replace(/^## (.*$)/gim, '<h3 class="text-sm font-bold text-primary mt-6 mb-2">$1</h3>')
    .replace(/^# (.*$)/gim, `<h2 class="text-base font-bold mt-8 mb-3 ${isLightMode ? 'text-slate-800' : 'text-white'}">$1</h2>`)
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, `<strong class="font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}">$1</strong>`)
    // Bullet lists
    .replace(/^\* (.*$)/gim, `<li class="ml-4 list-disc pl-1 py-0.5 text-xs ${isLightMode ? 'text-slate-655' : 'text-slate-300'}">$1</li>`)
    .replace(/^- (.*$)/gim, `<li class="ml-4 list-disc pl-1 py-0.5 text-xs ${isLightMode ? 'text-slate-655' : 'text-slate-300'}">$1</li>`);

  // Paragraph wrapping
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('<li') || p.trim().startsWith('<div') || p.trim().startsWith('<h')) {
      return p;
    }
    return `<p class="text-xs leading-relaxed mb-3 ${isLightMode ? 'text-slate-655' : 'text-slate-300'}">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return html;
}

function parseMessageList(content: string): any[] | null {
  if (!content) return null;
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```')) {
    const lines = cleanContent.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1].startsWith('```')) lines.pop();
    cleanContent = lines.join('\n').trim();
  }
  
  if (cleanContent.startsWith('[') && cleanContent.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleanContent);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

function formatTime(ts: string | number) {
  if (!ts) return '';
  try {
    const val = typeof ts === 'string' ? parseFloat(ts) : ts;
    const date = new Date(val > 10000000000 ? val : val * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(ts);
  }
}

function ChatPageContent() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const { slackUsers } = useAuth();

  const getUserDisplayName = (userId: string) => {
    return slackUsers[userId]?.realName || userId;
  };

  const getUserInitials = (userId: string) => {
    const name = slackUsers[userId]?.realName || userId;
    return name.slice(0, 2).toUpperCase();
  };
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionIdParam = searchParams.get('id');

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedToolIdx, setExpandedToolIdx] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch list of active chat sessions
  const { data: sessions, isLoading: isSessionsLoading } = useQuery<ChatSession[]>({
    queryKey: ['chatSessions'],
    queryFn: () => apiFetch('/api/chat/sessions')
  });

  // Fetch messages for active session
  const { data: sessionData, refetch: refetchMessages } = useQuery<{ session: ChatSession; messages: ChatMessage[] }>({
    queryKey: ['sessionMessages', activeSessionId],
    queryFn: () => apiFetch(`/api/chat/sessions/${activeSessionId}`),
    enabled: !!activeSessionId
  });

  // Sync activeSessionId with URL param
  useEffect(() => {
    if (sessionIdParam) {
      setActiveSessionId(sessionIdParam);
    } else if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
      router.push(`/chat?id=${sessions[0].id}`);
    }
  }, [sessionIdParam, sessions]);

  // Load retrieved messages into state
  useEffect(() => {
    if (sessionData) {
      setMessages(sessionData.messages);
    }
  }, [sessionData]);

  // Scroll to bottom on message load/change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Event delegation to capture Copy button clicks inside rendered markdown
  useEffect(() => {
    const handleCopyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.code-copy-btn');
      if (btn) {
        const code = btn.getAttribute('data-code');
        if (code) {
          navigator.clipboard.writeText(decodeURIComponent(code));
          const label = btn.querySelector('span');
          if (label) {
            const originalText = label.textContent;
            label.textContent = 'Copied!';
            setTimeout(() => {
              label.textContent = originalText;
            }, 2000);
          }
        }
      }
    };
    document.addEventListener('click', handleCopyClick);
    return () => document.removeEventListener('click', handleCopyClick);
  }, [messages]);

  // Mutation to create new session
  const createSessionMutation = useMutation({
    mutationFn: () => apiFetch('/api/chat/sessions', { method: 'POST' }),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      setActiveSessionId(newSession.id);
      setMessages([]);
      router.push(`/chat?id=${newSession.id}`);
    }
  });

  // Streaming text submission using native fetch Reader
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSessionId || isStreaming) return;

    const userPrompt = input.trim();
    setInput('');
    setIsStreaming(true);

    const userMessageId = Math.random().toString();
    const assistantMessageId = Math.random().toString();

    // 1. Optimistically add User Message
    const newUserMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: userPrompt,
      created_at: new Date().toISOString()
    };

    // 2. Add placeholder Assistant Message
    const newAssistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      toolExecutions: []
    };

    setMessages(prev => [...prev, newUserMsg, newAssistantMsg]);

    const token = getAuthToken();
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const streamUrl = `${BACKEND_URL}/api/chat/sessions/${activeSessionId}/stream?prompt=${encodeURIComponent(userPrompt)}`;

    try {
      const response = await fetch(streamUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Streaming failed to initiate.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('Readable stream not supported.');

      let accumulatedText = '';
      let activeTools: ToolExecution[] = [];

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;
          if (cleaned.startsWith('data: ')) {
            try {
              const event = JSON.parse(cleaned.slice(6));
              
              if (event.type === 'text') {
                accumulatedText += event.content;
                // Update active assistant message content
                setMessages(prev => prev.map(msg => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, content: accumulatedText };
                  }
                  return msg;
                }));
              } else if (event.type === 'tool_start') {
                // Add a new tool execution to the timeline
                const newTool: ToolExecution = {
                  tool_name: event.toolName,
                  arguments: JSON.stringify(event.toolArgs),
                  status: 'running'
                };
                activeTools = [...activeTools, newTool];
                setMessages(prev => prev.map(msg => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, toolExecutions: activeTools };
                  }
                  return msg;
                }));
              } else if (event.type === 'tool_end') {
                // Update running tool execution status to success/error
                activeTools = activeTools.map(t => {
                  if (t.tool_name === event.toolName && t.status === 'running') {
                    return {
                      ...t,
                      status: event.status,
                      result: JSON.stringify(event.result)
                    };
                  }
                  return t;
                });
                setMessages(prev => prev.map(msg => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, toolExecutions: activeTools };
                  }
                  return msg;
                }));
              } else if (event.type === 'session_update') {
                // Session title updated from "New Conversation" to prompt summary
                queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
              }
            } catch (err) {
              console.warn('Malformed stream JSON:', cleaned);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Streaming error:', err);
      // Append error message to assistant response
      setMessages(prev => prev.map(msg => {
        if (msg.id === assistantMessageId) {
          return { ...msg, content: msg.content + `\n\n*(Error: ${err?.message || 'Lost connection to AI server.'})*` };
        }
        return msg;
      }));
    } finally {
      setIsStreaming(false);
      refetchMessages(); // reload session history cleanly
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    createSessionMutation.mutate();
  };

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar Nav */}
      <Sidebar />

      {/* Split view panel */}
      <div className="flex-1 flex h-full overflow-hidden">
        
        {/* Left Side: Sessions history list (1/4 width) */}
        <div className="w-64 border-r border-border flex flex-col h-full bg-card/10 shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Conversations</h3>
            <button
              onClick={handleNewChat}
              disabled={createSessionMutation.isPending}
              className="p-1.5 rounded-lg bg-primary hover:bg-primary/95 text-white transition-all shadow-md shadow-primary/10 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isSessionsLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-secondary/15 rounded-xl animate-pulse" />
                <div className="h-10 bg-secondary/15 rounded-xl animate-pulse" />
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground px-4">
                No conversations. Click '+' to start.
              </div>
            ) : (
              sessions.map(s => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (!isStreaming) {
                        setActiveSessionId(s.id);
                        router.push(`/chat?id=${s.id}`);
                      }
                    }}
                    className={`px-3.5 py-3 rounded-2xl cursor-pointer text-xs font-medium transition-all truncate flex items-center gap-2 ${
                      isActive 
                        ? (isLightMode ? 'bg-slate-100 border border-slate-200 text-slate-800 shadow-sm' : 'bg-secondary/40 border border-border/80 text-white shadow-sm') 
                        : (isLightMode ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-800' : 'text-muted-foreground hover:bg-secondary/25 hover:text-white')
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Chat Dialog window (3/4 width) */}
        <div className="flex-1 flex flex-col h-full bg-card/5 overflow-hidden relative">
          
          {activeSessionId ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header Info */}
              <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0 bg-card/20">
                <div className="min-w-0 pr-4">
                  <h2 className={`text-sm font-bold truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                    {sessions?.find(s => s.id === activeSessionId)?.title || 'AI Chat Session'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Slack RAG Active</span>
                </div>
              </header>

              {/* Chat Scroll Viewport */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                    <Compass className="w-10 h-10 text-primary mb-4 animate-spin-slow" />
                    <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-750' : 'text-white'}`}>Ask about Slack</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      "What happened in engineering today?" or "Summarize blockers discussed this week." 
                      The AI will call the Slack MCP Server and search local embeddings to answer.
                    </p>
                  </div>
                )}

                {messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div 
                      key={m.id} 
                      className={`flex flex-col max-w-3xl w-full ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      {/* Message bubble */}
                      <div className={`p-4 rounded-3xl text-sm leading-relaxed relative ${
                        isUser 
                          ? 'bg-[#1a1b24] text-white rounded-tr-none border border-border/40' 
                          : `bg-transparent ${isLightMode ? 'text-slate-805' : 'text-slate-200'}`
                      }`}>
                        
                        {/* Copy / Actions floating top right for AI */}
                        {!isUser && m.content && (
                          <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopyMessage(m.id, m.content)}
                              className="p-1 rounded bg-secondary/85 text-muted-foreground hover:text-white border border-border"
                              title="Copy Response"
                            >
                              {copiedId === m.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}

                        {/* Rendering content */}
                        {isUser ? (
                          <p className="text-xs">{m.content}</p>
                        ) : (() => {
                          const parsedMessages = parseMessageList(m.content);
                          if (parsedMessages) {
                            return (
                              <div className="w-full space-y-3 mt-1 min-w-[320px]">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                  Retrieved Slack Messages ({parsedMessages.length})
                                </div>
                                 {parsedMessages.map((msg: any, idx: number) => {
                                  const avatar = slackUsers[msg.user]?.avatar || '';
                                  return (
                                    <div key={idx} className={`p-3 border rounded-2xl flex items-start gap-3 ${
                                      isLightMode ? 'bg-slate-50 border-slate-200/60' : 'bg-secondary/10 border border-border/20'
                                    }`}>
                                      {avatar ? (
                                        <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 uppercase">
                                          {getUserInitials(msg.user || 'U')}
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                          <span className={`text-xs font-bold truncate pr-2 max-w-[150px] ${isLightMode ? 'text-slate-750' : 'text-slate-200'}`}>{getUserDisplayName(msg.user || 'Unknown User')}</span>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {msg.channel && (
                                              <span className="text-[9px] bg-secondary/30 px-1.5 py-0.25 rounded-md text-muted-foreground border border-border/30 font-medium">
                                                #{msg.channel}
                                              </span>
                                            )}
                                            <span className="text-[9px] text-muted-foreground">{formatTime(msg.ts)}</span>
                                          </div>
                                        </div>
                                        <p className={`text-xs whitespace-pre-wrap ${isLightMode ? 'text-slate-655' : 'text-slate-300'}`}>{msg.text}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <div 
                              className={`prose max-w-none text-xs ${isLightMode ? 'prose-slate text-slate-800' : 'prose-invert text-slate-300'}`}
                              dangerouslySetInnerHTML={{ __html: renderChatMarkdown(m.content, () => {}, isLightMode) }}
                            />
                          );
                        })()}
                      </div>

                      {/* Tool Execution Timeline Nodes */}
                      {!isUser && m.toolExecutions && m.toolExecutions.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-border/80 space-y-2.5 w-full">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            MCP Tool Executions ({m.toolExecutions.length})
                          </div>
                          {m.toolExecutions.map((tool, idx) => {
                            const nodeKey = `${m.id}-${idx}`;
                            const isExpanded = expandedToolIdx === nodeKey;
                            return (
                              <div key={idx} className={`border rounded-xl overflow-hidden text-xs ${
                                isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-secondary/10 border-border/30'
                              }`}>
                                <button
                                  onClick={() => setExpandedToolIdx(isExpanded ? null : nodeKey)}
                                  className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-secondary/20 transition-all text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className={`font-semibold font-mono text-[11px] ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                                      {tool.tool_name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                      tool.status === 'success' 
                                        ? 'bg-emerald-500/10 text-emerald-400' 
                                        : tool.status === 'error' 
                                          ? 'bg-red-500/10 text-red-400' 
                                          : 'bg-primary/10 text-primary animate-pulse'
                                    }`}>
                                      {tool.status}
                                    </span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                  </div>
                                </button>
                                
                                {isExpanded && (
                                  <div className="p-3 border-t border-border/30 bg-black/30 space-y-2 text-[10px] font-mono overflow-x-auto">
                                    <div>
                                      <span className="text-muted-foreground font-bold uppercase tracking-wide text-[8px] block mb-0.5">Arguments</span>
                                      <pre className={`whitespace-pre-wrap ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>{JSON.stringify(JSON.parse(tool.arguments || '{}'), null, 2)}</pre>
                                    </div>
                                    {tool.result && (
                                      <div>
                                        <span className="text-muted-foreground font-bold uppercase tracking-wide text-[8px] block mb-0.5">Output Response</span>
                                        <pre className={`whitespace-pre-wrap ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>{JSON.stringify(JSON.parse(tool.result), null, 2)}</pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loading/thinking indicator during stream */}
                {isStreaming && messages[messages.length - 1]?.content === '' && (
                  <div className="flex items-center gap-2.5 max-w-sm mr-auto text-xs text-muted-foreground py-2 pl-4">
                    <Sparkles className="w-4 h-4 text-primary animate-spin" />
                    <span>AI Assistant is compiling Slack query...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Textarea Input */}
              <div className="p-6 border-t border-border bg-card/25 shrink-0">
                <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center">
                  <input
                    type="text"
                    required
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about Slack workspace..."
                    disabled={isStreaming}
                    className={`w-full pl-5 pr-14 py-4 rounded-2xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none disabled:opacity-50 ${
                      isLightMode ? 'text-slate-800 bg-slate-100/50 border-slate-200' : 'text-white'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isStreaming || !input.trim()}
                    className="absolute right-3.5 p-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all shadow-md shadow-primary/10 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="p-4 rounded-3xl bg-secondary/15 text-muted-foreground mb-4">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h3 className={`text-base font-bold ${isLightMode ? 'text-slate-750' : 'text-white'}`}>No Conversation Selected</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                Choose a conversation from the sidebar history, or click the '+' button to start a new chat.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
