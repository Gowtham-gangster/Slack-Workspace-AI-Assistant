'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '../../components/AppLayout';
import { apiFetch, getAuthToken } from '../../lib/api';
import { socketService } from '../../lib/socketService';
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(() => import('../../components/MessageComposer/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-[120px] w-full animate-pulse bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
});
import SlackMrkdwnRenderer from '../../components/MessageComposer/SlackMrkdwnRenderer';
import { FileVideo, FileAudio, FileCode, FileArchive, FileSpreadsheet, Play, Presentation } from 'lucide-react';
import {
  Hash,
  MessageSquare,
  FileText,
  Activity,
  Search,
  RefreshCw,
  TrendingUp,
  Clock,
  Sparkles,
  AlertCircle,
  Send,
  CheckCircle,
  Layers,
  Users,
  ClipboardList,
  Zap,
  ChevronRight,
  Filter,
  Timer,
  AtSign,
  Key,
  Brain,
  ChevronDown,
  ChevronUp,
  Plus, Check, Copy, ThumbsUp, Heart, Smile, Flame, Bookmark, Pin, Trash2, Edit3, MoreVertical, Paperclip, SmilePlus, Bell, Info, Mic, Image, CornerDownLeft, Eye, EyeOff, CheckSquare, Award, User, Link as LinkIcon, Compass, Terminal, X, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';

interface DashboardData {
  stats: {
    totalChannels: number;
    messagesAnalyzed: number;
    savedReportsCount: number;
    mcpConnected: boolean;
  };
  recentReports: Array<{ id: string; title: string; type: string; created_at: string; }>;
  recentSearches: Array<{ query: string; executedAt: string; }>;
}

interface Channel { id: string; name: string; }

interface LiveMessage {
  ts: string;
  user: string;
  text: string;
  reactions?: Array<{ emoji: string; user_id: number; }>;
  isPinned?: boolean;
  pinnedBy?: number | null;
  isBookmarked?: boolean;
  replyCount?: number;
  files?: any[];
  id?: string;
}

interface ActionPlan { task: string; owner: string; status: string; deadline: string; }

interface ActiveMember {
  userId: string; count: number; realName: string; name: string; avatar: string;
}

/* ─────────────────── helpers ─────────────────── */
const fmtTime = (ts: string) => {
  try {
    return new Date(parseFloat(ts) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const fmtDate = (ts: string) => {
  try {
    return new Date(parseFloat(ts) * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
};

const formatFriendlyDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

const avatarColor = (userId: string) => {
  const colors = ['#7c6af7','#6366f1','#8b5cf6','#0ea5e9','#14b8a6','#f59e0b','#ec4899','#10b981'];
  let h = 0; for (const c of userId) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
};

const reportBadge = (type: string): [string, string] => {
  const map: Record<string, [string,string]> = {
    meeting:     ['rgba(99,102,241,0.15)',  '#818cf8'],
    sentiment:   ['rgba(236,72,153,0.15)',  '#f472b6'],
    action_item: ['rgba(245,158,11,0.15)',  '#fbbf24'],
    weekly:      ['rgba(139,92,246,0.15)',  '#c084fc'],
  };
  return map[type] || ['rgba(16,185,129,0.15)', '#34d399'];
};

interface SummarySection {
  heading: string;
  content: string;
}

const parseSummary = (md: string): { title: string; sections: SummarySection[] } => {
  if (!md) return { title: '', sections: [] };

  const lines = md.split('\n');
  let title = 'Conversation Summary';
  const sections: SummarySection[] = [];
  let currentSection: SummarySection | null = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      title = trimmed.replace('# ', '').trim();
    } else if (trimmed.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: trimmed.replace('## ', '').trim(),
        content: ''
      };
    } else {
      if (currentSection) {
        if (currentSection.content) {
          currentSection.content += '\n' + trimmed;
        } else {
          currentSection.content = trimmed;
        }
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return { title, sections };
};

const BoldText = ({ text }: { text: string }) => {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className={`font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{part}</strong>;
        }
        return part;
      })}
    </>
  );
};

const renderCardContent = (content: string, isLightMode: boolean) => {
  if (!content) return null;

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const elements: React.ReactNode[] = [];

  // Check if it's a Markdown table
  if (lines[0] && lines[0].startsWith('|')) {
    const rows = lines.filter(l => l.startsWith('|') && !l.includes('---'));
    if (rows.length > 0) {
      const headerCols = rows[0].split('|').map(c => c.trim()).filter(Boolean);
      const dataRows = rows.slice(1).map(row => row.split('|').map(c => c.trim()).filter(Boolean));

      elements.push(
        <div key="table-wrapper" className={`overflow-x-auto rounded-xl border my-1 leading-normal ${
          isLightMode ? 'border-slate-200/60 bg-slate-50/50' : 'border-white/5 bg-black/15'
        }`}>
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className={`border-b ${isLightMode ? 'bg-slate-100/50 border-slate-200/50' : 'bg-white/5 border-white/5'}`}>
                {headerCols.map((h, i) => (
                  <th key={i} className={`px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-white/50'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((cols, i) => (
                <tr key={i} className={`border-b last:border-0 hover:bg-white/5 transition-colors ${isLightMode ? 'border-slate-100 hover:bg-slate-100/30' : 'border-white/5'}`}>
                  {cols.map((c, j) => (
                    <td key={j} className={`px-3 py-1.5 font-medium ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      return elements;
    }
  }

  // Check if bullet list
  const bullets = lines.filter(l => l.startsWith('* ') || l.startsWith('- '));
  if (bullets.length > 0) {
    elements.push(
      <ul key="bullet-list" className={`flex flex-col gap-1.5 list-disc pl-4 mt-1 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
        {bullets.map((b, i) => {
          const text = b.replace(/^[\*\-]\s+/, '');
          return (
            <li key={i} className="p-0 m-0 leading-[1.6] text-[14px]">
              <BoldText text={text} />
            </li>
          );
        })}
      </ul>
    );
    return elements;
  }

  // Paragraph list
  lines.forEach((line, i) => {
    elements.push(
      <p key={i} className={`text-[14px] leading-[1.7] mb-2.5 last:mb-0 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
        <BoldText text={line} />
      </p>
    );
  });

  return elements;
};

const MarkdownRenderer = ({ text, isLightMode }: { text: string; isLightMode: boolean }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const parseInlineStyles = (txt: string) => {
    const parts = txt.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className={`font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-muted-foreground">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${isLightMode ? 'bg-slate-100 text-slate-800' : 'bg-black/30 text-slate-200 border border-white/5'}`}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const flushList = () => {
    if (inList && listItems.length > 0) {
      renderedElements.push(
        <ul key={`ul-${renderedElements.length}`} className={`flex flex-col gap-1 my-2 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushList();
      if (inCodeBlock) {
        renderedElements.push(
          <pre key={`code-${lineIndex}`} className={`p-3 my-2 overflow-x-auto rounded-xl border font-mono text-[10px] leading-normal ${
            isLightMode ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-white/5 bg-black/20 text-slate-300'
          }`}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (trimmed.startsWith('#### ')) {
      flushList();
      renderedElements.push(
        <h5 key={`h4-${lineIndex}`} className={`text-xs font-bold mt-3 mb-1.5 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
          {parseInlineStyles(trimmed.slice(5))}
        </h5>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      renderedElements.push(
        <h4 key={`h3-${lineIndex}`} className={`text-[13px] font-bold mt-4 mb-2 flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
          {parseInlineStyles(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      renderedElements.push(
        <h3 key={`h2-${lineIndex}`} className={`text-sm font-bold mt-4 mb-2 ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
          {parseInlineStyles(trimmed.slice(3))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      renderedElements.push(
        <h2 key={`h1-${lineIndex}`} className={`text-base font-bold mt-5 mb-2.5 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
          {parseInlineStyles(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('> ')) {
      flushList();
      renderedElements.push(
        <blockquote key={`quote-${lineIndex}`} className={`border-l-4 pl-3 py-1 my-2 italic ${
          isLightMode ? 'border-slate-300 bg-slate-50/50 text-slate-700' : 'border-border bg-white/5 text-slate-300'
        }`}>
          {parseInlineStyles(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      inList = true;
      listItems.push(
        <li key={`li-${lineIndex}`} className="list-disc ml-4 my-1 text-[11px] leading-relaxed">
          {parseInlineStyles(trimmed.slice(2))}
        </li>
      );
      return;
    }

    if (!trimmed) {
      flushList();
      return;
    }

    flushList();
    renderedElements.push(
      <p key={`p-${lineIndex}`} className={`my-1.5 leading-relaxed text-[11px] ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
        {parseInlineStyles(line)}
      </p>
    );
  });

  flushList();

  return <div className="flex flex-col">{renderedElements}</div>;
};

/* ─────────────────── sub-components ─────────────────── */
const SectionHeader = ({ icon: Icon, title, subtitle, action }: {
  icon: any; title: string; subtitle?: string; action?: React.ReactNode
}) => {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
             style={{ background: 'rgba(124,106,247,0.15)', border: '1px solid rgba(124,106,247,0.2)' }}>
          <Icon className="w-4 h-4" style={{ color: '#7c6af7' }} />
        </div>
        <div>
          <h3 className={`text-[14px] font-bold leading-none ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{title}</h3>
          {subtitle && <p className="text-[11px] mt-0.5 leading-none" style={{ color: isLightMode ? '#6b7280' : '#9ca3af' }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
};

const PrimaryBtn = ({ onClick, disabled, loading, loadingText, children, className = '' }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all duration-200 disabled:opacity-40 ${className}`}
    style={{
      background: 'linear-gradient(135deg, #7c6af7, #6366f1)',
      boxShadow: '0 4px 16px rgba(124,106,247,0.3)',
    }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(124,106,247,0.45)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(124,106,247,0.3)'; }}
  >
    {loading ? (
      <>
        <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        {loadingText}
      </>
    ) : children}
  </button>
);

const ErrorBanner = ({ message }: { message: string }) => {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl animate-fadeIn"
         style={{ 
           background: isLightMode ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.08)', 
           border: isLightMode ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(239,68,68,0.2)' 
         }}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: isLightMode ? '#dc2626' : '#f87171' }} />
      <p className="text-[12px] leading-relaxed font-medium" style={{ color: isLightMode ? '#991b1b' : '#fca5a5' }}>{message}</p>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="py-10 text-center rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
    <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
         style={{ background: 'rgba(255,255,255,0.03)' }}>
      <Sparkles className="w-5 h-5" style={{ color: '#374151' }} />
    </div>
    <p className="text-[12px]" style={{ color: '#4b5563' }}>{text}</p>
  </div>
);

interface FileUpload {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'uploaded' | 'failed' | 'cancelled';
  fileId?: string;
  error?: string;
  cancelXHR?: XMLHttpRequest;
  previewUrl?: string;
}

/* ─────────────────── main page ─────────────────── */
export default function DashboardPage() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const { slackUsers } = useAuth();

  const getUserDisplayName = (userId: string) => {
    if (!userId) return 'Unknown';
    const clean = userId.replace(/[<@>]/g, '');
    const mapped = slackUsers[clean];
    return mapped?.realName || mapped?.name || clean;
  };

  const getUserInitials = (userId: string) => {
    const name = slackUsers[userId]?.realName || userId;
    return name.slice(0, 2).toUpperCase();
  };

  const getUserAvatar = (userId: string) => {
    return slackUsers[userId]?.avatar || '';
  };
  const queryClient = useQueryClient();
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<any | null>(null);

  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<string | null>(null);

  const [analyticsTab, setAnalyticsTab] = useState<'summary' | 'actions' | 'members'>('summary');
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [retrieverQuery, setRetrieverQuery] = useState('');
  const [loadingRetriever, setLoadingRetriever] = useState(false);
  const [retrieverError, setRetrieverError] = useState<string | null>(null);
  const [retrieverResult, setRetrieverResult] = useState<any | null>(null);

  const [fetchLimit, setFetchLimit] = useState(5);
  const [filterQuery, setFilterQuery] = useState('');

  const { user } = useAuth();
  const [activeThreadParentId, setActiveThreadParentId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<any[]>([]);
  const [threadInput, setThreadInput] = useState('');
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isThreadSending, setIsThreadSending] = useState(false);

  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [openedMenuMessageId, setOpenedMenuMessageId] = useState<string | null>(null);
  const [openedMoreMenuMsgId, setOpenedMoreMenuMsgId] = useState<string | null>(null);
  const [readMessageIds, setReadMessageIds] = useState<Record<string, boolean>>({});

  const toggleReadStatus = useCallback((ts: string) => {
    setReadMessageIds(prev => ({
      ...prev,
      [ts]: !prev[ts]
    }));
  }, []);

  const handleDeleteMessage = useCallback((ts: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      queryClient.setQueryData(['liveMessages', selectedChannelId, fetchLimit], (oldData: any[]) => {
        if (!oldData) return [];
        return oldData.filter((m: any) => (m.ts || m.id) !== ts);
      });
    }
  }, [queryClient, selectedChannelId, fetchLimit]);

  const activeMenuRef = useRef<{ emoji: string | null; ai: string | null }>({ emoji: null, ai: null });
  useEffect(() => { activeMenuRef.current = { emoji: activeEmojiPickerMsgId, ai: openedMenuMessageId }; }, [activeEmojiPickerMsgId, openedMenuMessageId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click is inside any action toolbar, popup, or trigger, ignore
      if (target.closest('[data-msg-toolbar]') || target.closest('.ai-actions-dropdown') || target.closest('.more-options-dropdown') || target.closest('[data-ai-trigger]') || target.closest('[data-more-trigger]')) return;
      setOpenedMenuMessageId(null);
      setOpenedMoreMenuMsgId(null);
      setActiveEmojiPickerMsgId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenedMenuMessageId(null);
        setOpenedMoreMenuMsgId(null);
        setActiveEmojiPickerMsgId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-close AI actions dropdown if the message scrolls out of the visible viewport of the message pane
  useEffect(() => {
    if (!openedMenuMessageId) return;

    const handleScroll = () => {
      const msgElement = document.getElementById(`msg-${openedMenuMessageId}`);
      const scrollContainer = messagesEndRef.current?.parentElement;
      if (msgElement && scrollContainer) {
        const rect = msgElement.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        // If the message scrolls out of the visible vertical bounds of the scroll container, close the dropdown
        if (rect.bottom < containerRect.top || rect.top > containerRect.bottom) {
          setOpenedMenuMessageId(null);
        }
      }
    };

    const c = messagesEndRef.current?.parentElement;
    if (c) {
      c.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (c) {
        c.removeEventListener('scroll', handleScroll);
      }
    };
  }, [openedMenuMessageId]);

  // WebSocket setup via SocketService singleton
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      socketService.disconnect();
      return;
    }

    socketService.initialize(token, {
      onConnect: () => {
        setSocketStatus('connected');
        setIsSocketReconnecting(false);
      },
      onDisconnect: () => {
        setSocketStatus('disconnected');
      },
      onReconnecting: (attempt) => {
        setSocketStatus('connecting');
        setIsSocketReconnecting(true);
      }
    });

    socketService.onReactionUpdate((data: any) => {
      const { messageId, reactions, channelId } = data;
      console.log(`[WebSocket] Live reaction update received for msg ${messageId}:`, reactions);
      
      // Instantly update React Query cache for liveMessages
      queryClient.setQueryData(['liveMessages', channelId, fetchLimit], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.map((m: any) => {
          if (m.id === messageId || m.ts === messageId) {
            return {
              ...m,
              reactions
            };
          }
          return m;
        });
      });
      console.log(`[Frontend updated] reaction state updated for message: ${messageId}, channelId: ${channelId}`);
    });

    socketService.onMessage((data: any) => {
      const { channelId, message } = data;
      console.log(`[WebSocket] Live message received for channel ${channelId}:`, message);
      queryClient.setQueryData(['liveMessages', channelId, fetchLimit], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return [message];
        const exists = oldData.some((m: any) => (m.id || m.ts) === (message.id || message.ts));
        if (exists) return oldData;
        return [message, ...oldData];
      });
    });

    socketService.onMessageChanged((data: any) => {
      const { channelId, message } = data;
      console.log(`[WebSocket] Live message change received for msg ${message.id}:`, message);
      queryClient.setQueryData(['liveMessages', channelId, fetchLimit], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.map((m: any) => {
          if ((m.id || m.ts) === (message.id || message.ts)) {
            return {
              ...m,
              text: message.text
            };
          }
          return m;
        });
      });
    });

    socketService.onMessageDeleted((data: any) => {
      const { channelId, deletedTs } = data;
      console.log(`[WebSocket] Live message delete received for msg ${deletedTs}`);
      queryClient.setQueryData(['liveMessages', channelId, fetchLimit], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.filter((m: any) => (m.id || m.ts) !== deletedTs);
      });
    });

    socketService.onReminderFired((reminder: any) => {
      console.log(`[WebSocket] Live reminder fired:`, reminder);
      const formattedReminder = {
        id: reminder.id,
        message_id: reminder.message_id,
        session_id: reminder.session_id,
        content: reminder.content || 'Your scheduled reminder is due!'
      };
      setReminderToasts(prev => [formattedReminder, ...prev]);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification("Slack AI Assistant Reminder", {
          body: reminder.content || 'Your scheduled reminder is due!',
          icon: '/favicon.ico'
        });
      }
    });

    return () => {
      socketService.offReactionUpdate();
      socketService.offMessage();
      socketService.offMessageChanged();
      socketService.offMessageDeleted();
      socketService.offReminderFired();
    };
  }, [fetchLimit, queryClient]);

  // Request browser notification permissions on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Join socket channel room when channel selection or connection changes
  useEffect(() => {
    if (selectedChannelId && socketStatus === 'connected') {
      socketService.joinChannel(selectedChannelId);
    }
  }, [selectedChannelId, socketStatus]);

  const [infoModalMessage, setInfoModalMessage] = useState<any | null>(null);
  const [reminderMessage, setReminderMessage] = useState<any | null>(null);
  const [taskMessage, setTaskMessage] = useState<any | null>(null);
  const [aiActionResult, setAiActionResult] = useState<{ title: string; text: string } | null>(null);
  const [isRunningAiAction, setIsRunningAiAction] = useState(false);

  const [activeImageLightbox, setActiveImageLightbox] = useState<{ url: string; name: string; size?: number } | null>(null);
  const [activeVideoPlayer, setActiveVideoPlayer] = useState<{ url: string; name: string; size?: number } | null>(null);
  const [activePdfViewer, setActivePdfViewer] = useState<{ url: string; name: string; size?: number; originalUrl?: string; filetype?: string } | null>(null);
  const [activeCodeViewer, setActiveCodeViewer] = useState<{ url: string; name: string; content?: string } | null>(null);

  const handleOpenImageLightbox = useCallback((url: string, name: string, size?: number) => {
    setActiveImageLightbox({ url, name, size });
  }, []);

  const handleOpenVideoPlayer = useCallback((url: string, name: string, size?: number) => {
    setActiveVideoPlayer({ url, name, size });
  }, []);

  const handleOpenPdfViewer = useCallback((url: string, name: string, size?: number, originalUrl?: string, filetype?: string) => {
    setActivePdfViewer({ url, name, size, originalUrl, filetype });
  }, []);

  const getProxyDownloadUrl = useCallback((file: any, download: boolean = false) => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const token = getAuthToken() || '';
    const fileUrl = file.url_private_download || file.url_private || '';
    return `${BACKEND_URL}/api/files/${file.id}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(file.name || '')}${download ? '&download=true' : ''}`;
  }, []);

  const handleOpenCodeViewer = useCallback(async (file: any) => {
    const proxyUrl = getProxyDownloadUrl(file);
    const token = getAuthToken();
    setActiveCodeViewer({ url: proxyUrl, name: file.name, content: 'Loading content...' });
    try {
      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const text = await response.text();
        setActiveCodeViewer({ url: proxyUrl, name: file.name, content: text });
      } else {
        throw new Error('Failed to read file contents');
      }
    } catch (err: any) {
      setActiveCodeViewer({ url: proxyUrl, name: file.name, content: `Error loading file: ${err?.message || 'Unknown error'}` });
    }
  }, [getProxyDownloadUrl]);

  const [attachments, setAttachments] = useState<FileUpload[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [mentionQuery, setMentionQuery] = useState<{ type: '@' | '#'; query: string; index: number } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const [taskForm, setTaskForm] = useState({ task: '', owner: 'Unassigned', dueDate: '', priority: 'medium' });
  const [reminderDuration, setReminderDuration] = useState('60');
  const [customRemindAt, setCustomRemindAt] = useState('');
  const [reminderToasts, setReminderToasts] = useState<any[]>([]); // fired reminders shown as toasts
  const [showMyReminders, setShowMyReminders] = useState(false); // "My Reminders" panel

  const [selectedMobileMsg, setSelectedMobileMsg] = useState<any | null>(null);
  const longPressTimerRef = useRef<any>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);
  const [showBookmarksDropdown, setShowBookmarksDropdown] = useState(false);
  const [highlightedMessageTs, setHighlightedMessageTs] = useState<string | null>(null);

  // Clear highlight after 4 seconds
  useEffect(() => {
    if (highlightedMessageTs) {
      const timer = setTimeout(() => {
        setHighlightedMessageTs(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [highlightedMessageTs]);

  const handleSelectSavedMessage = (b: any) => {
    const targetMsgId = b.message_id || b.id;
    if (!targetMsgId) return;
    
    // Set larger limit to guarantee old message is fetched and loaded in list
    setFetchLimit(100);
    
    // Switch channel/session
    setSelectedChannelId(b.session_id);
    
    // Trigger highlight
    setHighlightedMessageTs(targetMsgId);
    
    setShowBookmarksDropdown(false);
  };

  const handleSelectPinnedMessage = (p: any) => {
    const targetMsgId = p.message_id || p.id;
    if (!targetMsgId) return;

    // Set larger limit to guarantee old message is fetched and loaded in list
    setFetchLimit(100);

    // Trigger highlight
    setHighlightedMessageTs(targetMsgId);

    setShowPinnedDropdown(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pinnedDropdownRef = useRef<HTMLDivElement>(null);
  const bookmarksDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBookmarksDropdown && bookmarksDropdownRef.current && !bookmarksDropdownRef.current.contains(event.target as Node)) {
        const btn = document.querySelector('[title="Saved Messages"]');
        if (!btn || !btn.contains(event.target as Node)) {
          setShowBookmarksDropdown(false);
        }
      }
      if (showPinnedDropdown && pinnedDropdownRef.current && !pinnedDropdownRef.current.contains(event.target as Node)) {
        const btn = document.querySelector('[title="Pinned Messages"]');
        if (!btn || !btn.contains(event.target as Node)) {
          setShowPinnedDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBookmarksDropdown, showPinnedDropdown]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboardStats'],
    queryFn: () => apiFetch('/api/dashboard/stats'),
    refetchInterval: 15000,
  });

  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['channelsList'],
    queryFn: () => apiFetch('/api/channels'),
  });

  const getChannelDisplayName = (channelId: string) => {
    if (!channelId) return 'Workspace';
    const ch = channels?.find(c => c.id === channelId);
    return ch ? `#${ch.name}` : 'Workspace';
  };

  const { data: intelligenceScore, isLoading: loadingScore } = useQuery<any>({
    queryKey: ['intelligenceScore'],
    queryFn: () => apiFetch('/api/dashboard/intelligence-score'),
    refetchInterval: 30000,
  });

  const { data: insightsData, isLoading: loadingInsights } = useQuery<any>({
    queryKey: ['dashboardInsights'],
    queryFn: () => apiFetch('/api/dashboard/insights'),
    refetchInterval: 60000,
  });

  const [showInsights, setShowInsights] = useState(true);

  const { data: liveMessages, refetch: refetchLiveMessages, isFetching: isFetchingMessages } =
    useQuery<LiveMessage[]>({
      queryKey: ['liveMessages', selectedChannelId, fetchLimit],
      queryFn: () => apiFetch(`/api/channels/${selectedChannelId}/messages`, { params: { limit: String(fetchLimit) } }),
      enabled: !!selectedChannelId,
      refetchInterval: 10000,
    });

  const { data: pinnedMessages, refetch: refetchPins } = useQuery<any[]>({
    queryKey: ['pinnedMessages', selectedChannelId],
    queryFn: () => apiFetch(`/api/chat/sessions/${selectedChannelId}/pins`),
    enabled: !!selectedChannelId
  });

  const { data: bookmarkedMessages, refetch: refetchBookmarks } = useQuery<any[]>({
    queryKey: ['bookmarkedMessages'],
    queryFn: () => apiFetch('/api/chat/bookmarks'),
  });

  const { data: pendingReminders, refetch: refetchReminders } = useQuery<any[]>({
    queryKey: ['myReminders'],
    queryFn: () => apiFetch('/api/chat/reminders'),
    refetchInterval: 30000,
  });

  // Poll for due reminders every 30 seconds and show toast notifications
  useEffect(() => {
    const pollDueReminders = async () => {
      try {
        const due: any[] = await apiFetch('/api/chat/reminders/due');
        if (due && due.length > 0) {
          setReminderToasts(prev => [...prev, ...due]);
          refetchReminders();
        }
      } catch (e) { /* silent */ }
    };
    pollDueReminders(); // run immediately on mount
    const interval = setInterval(pollDueReminders, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeThreadParentId && selectedChannelId) {
      setIsThreadLoading(true);
      apiFetch(`/api/channels/${selectedChannelId}/messages/${activeThreadParentId}/thread`)
        .then((res: any[]) => {
          setThreadReplies(res);
        })
        .catch(err => console.error(err))
        .finally(() => setIsThreadLoading(false));
    }
  }, [activeThreadParentId, selectedChannelId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadReplies]);

  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannelId) {
      const preferred = channels.find(c => c.name === 'general') || channels.find(c => c.id === 'C0BC420MMHP') || channels[0];
      setSelectedChannelId(preferred ? preferred.id : channels[0].id);
    }
  }, [channels, selectedChannelId]);

  useEffect(() => {
    setSummaryText(null); setActionPlans([]); setActiveMembers([]);
    setSummaryError(null); setPlansError(null); setMembersError(null);
  }, [selectedChannelId]);

  useEffect(() => {
    if (highlightedMessageTs) return;
    const c = messagesEndRef.current?.parentElement;
    if (c) c.scrollTop = c.scrollHeight;
  }, [liveMessages, highlightedMessageTs]);

  const syncMutation = useMutation({
    mutationFn: () => apiFetch('/api/channels/sync', { method: 'POST' }),
    onMutate: () => { setSyncing(true); setSyncError(null); setSyncSuccess(null); },
    onSuccess: (d) => {
      setSyncSuccess(d);
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['channelsList'] });
      refetchLiveMessages();
    },
    onError: (err: any) => setSyncError(err?.message || 'Sync failed.'),
    onSettled: () => setSyncing(false),
  });

  const EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '😮', '😢', '👀', '🚀'];

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string, content: string, msgUser: string) => {
    setActiveEmojiPickerMsgId(null);
    setSelectedMobileMsg(null);

    const queryKey = ['liveMessages', selectedChannelId, fetchLimit];
    const previousMessages = queryClient.getQueryData(queryKey);

    // Optimistic UI Update
    queryClient.setQueryData(queryKey, (oldMessages: any) => {
      if (!oldMessages || !Array.isArray(oldMessages)) return oldMessages;
      return oldMessages.map((m: any) => {
        if (m.id === messageId || m.ts === messageId) {
          const currentReactions = m.reactions || [];
          const localUserId = user?.id || 1;
          const userReactionIndex = currentReactions.findIndex(
            (r: any) => r.emoji === emoji && Number(r.user_id) === Number(localUserId)
          );

          let newReactions = [...currentReactions];
          if (userReactionIndex > -1) {
            newReactions.splice(userReactionIndex, 1);
          } else {
            newReactions.push({ emoji, user_id: localUserId });
          }
          return { ...m, reactions: newReactions };
        }
        return m;
      });
    });

    try {
      console.log(`[Reaction API called] toggling emoji ${emoji} on message ${messageId} in channel ${selectedChannelId}`);
      await apiFetch(`/api/chat/messages/${messageId}/react`, {
        method: 'POST',
        body: { 
          emoji, 
          sessionId: selectedChannelId,
          content,
          role: msgUser === 'US' || msgUser === user?.id?.toString() ? 'user' : 'assistant'
        }
      });
    } catch (e) {
      console.error('[Reaction API error] failed to toggle reaction, rolling back optimistic UI:', e);
      // Rollback to previous state on error
      queryClient.setQueryData(queryKey, previousMessages);
    }
  }, [selectedChannelId, user, fetchLimit, queryClient]);

  const handleToggleBookmark = useCallback(async (msg: LiveMessage) => {
    try {
      if (msg.isBookmarked) {
        await apiFetch(`/api/chat/bookmarks/${msg.ts}`, { method: 'DELETE' });
      } else {
        await apiFetch('/api/chat/bookmarks', {
          method: 'POST',
          body: { 
            messageId: msg.ts, 
            sessionId: selectedChannelId,
            content: msg.text,
            role: msg.user || 'user'
          }
        });
      }
      refetchLiveMessages();
      refetchBookmarks();
      setSelectedMobileMsg(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedChannelId, refetchLiveMessages, refetchBookmarks]);

  const handleTogglePin = useCallback(async (msg: LiveMessage) => {
    try {
      if (msg.isPinned) {
        await apiFetch(`/api/chat/sessions/${selectedChannelId}/pins/${msg.ts}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/chat/sessions/${selectedChannelId}/pins`, {
          method: 'POST',
          body: { 
            messageId: msg.ts,
            content: msg.text,
            role: msg.user || 'user'
          }
        });
      }
      refetchLiveMessages();
      refetchPins();
      setSelectedMobileMsg(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedChannelId, refetchLiveMessages, refetchPins]);

  const handleRunAiAction = useCallback(async (msgId: string, action: string, actionTitle: string, content: string) => {
    setIsRunningAiAction(true);
    setSelectedMobileMsg(null);
    try {
      const res = await apiFetch(`/api/chat/messages/${msgId}/ai-action`, {
        method: 'POST',
        body: { 
          action, 
          sessionId: selectedChannelId,
          content,
          role: 'assistant'
        }
      });
      setAiActionResult({ title: actionTitle, text: res.result });
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningAiAction(false);
    }
  }, [selectedChannelId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.task.trim() || !taskMessage) return;
    try {
      await apiFetch('/api/actions', {
        method: 'POST',
        body: {
          task: taskForm.task,
          owner: taskForm.owner,
          dueDate: taskForm.dueDate || null,
          channelId: selectedChannelId,
          channelName: channels?.find(c => c.id === selectedChannelId)?.name || 'Slack Channel'
        }
      });
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
      setTaskMessage(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetReminder = async () => {
    if (!reminderMessage) return;
    
    let remindAt: Date;
    if (reminderDuration === 'custom') {
      if (!customRemindAt) {
        alert('Please select a valid custom date and time.');
        return;
      }
      remindAt = new Date(customRemindAt);
      if (isNaN(remindAt.getTime())) {
        alert('Invalid date and time selected.');
        return;
      }
      if (remindAt.getTime() <= Date.now()) {
        alert('Reminder time must be in the future.');
        return;
      }
    } else {
      const minutes = parseInt(reminderDuration);
      remindAt = new Date(Date.now() + minutes * 60 * 1000);
    }

    try {
      await apiFetch(`/api/chat/messages/${reminderMessage.ts}/reminder`, {
        method: 'POST',
        body: { 
          remindAt,
          sessionId: selectedChannelId,
          content: reminderMessage.text,
          role: reminderMessage.user === 'US' ? 'user' : 'assistant'
        }
      });
      setReminderMessage(null);
      setCustomRemindAt('');
      refetchReminders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissReminderToast = async (reminderId: number) => {
    setReminderToasts(prev => prev.filter(r => r.id !== reminderId));
    try {
      await apiFetch(`/api/chat/reminders/${reminderId}/dismiss`, { method: 'PATCH' });
      refetchReminders();
    } catch (e) { console.error(e); }
  };

  const handleDeleteReminder = async (reminderId: number) => {
    try {
      await apiFetch(`/api/chat/reminders/${reminderId}`, { method: 'DELETE' });
      refetchReminders();
    } catch (e) { console.error(e); }
  };



  const handleSendThreadReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInput.trim() || !activeThreadParentId || isThreadSending) return;

    const replyText = threadInput.trim();
    setThreadInput('');
    setIsThreadSending(true);

    const optId = Math.random().toString();
    const optReply = {
      id: optId,
      parent_message_id: activeThreadParentId,
      session_id: selectedChannelId,
      role: 'user',
      content: replyText,
      created_at: new Date().toISOString(),
      user: 'US'
    };
    setThreadReplies(prev => [...prev, optReply]);

    try {
      const res = await apiFetch(`/api/channels/${selectedChannelId}/messages/${activeThreadParentId}/thread`, {
        method: 'POST',
        body: { content: replyText }
      });
      setThreadReplies(prev => prev.filter(r => r.id !== optId).concat(res.userReply));
      refetchLiveMessages();
    } catch (err) {
      console.error(err);
      setThreadReplies(prev => prev.filter(r => r.id !== optId));
    } finally {
      setIsThreadSending(false);
    }
  };

  const handleFormatText = (prefix: string, suffix: string = prefix) => {
    const textarea = composerRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const selectedText = text.substring(start, end);
    const replacement = prefix + selectedText + suffix;
    
    setPostText(text.substring(0, start) + replacement + text.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      handleFormatText('*');
    } else if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      handleFormatText('_');
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePostMessage(e);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const uploadFile = async (uploadId: string, file: File) => {
    const token = getAuthToken();
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    setAttachments(prev => prev.map(item => 
      item.id === uploadId ? { ...item, status: 'uploading' } : item
    ));

    const xhr = new XMLHttpRequest();
    
    setAttachments(prev => prev.map(item => 
      item.id === uploadId ? { ...item, cancelXHR: xhr } : item
    ));

    console.log('✓ File selected:', file.name);

    xhr.open('POST', `${BACKEND_URL}/api/channels/${selectedChannelId}/upload-file`);
    
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', file);
    console.log('✓ FormData created');

    console.log('✓ Request sent');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setAttachments(prev => prev.map(item => 
          item.id === uploadId ? { ...item, progress: percent } : item
        ));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.fileId) {
            console.log('✓ Upload completed, Slack fileId:', res.fileId);
            setAttachments(prev => prev.map(item => 
              item.id === uploadId ? { ...item, status: 'uploaded', fileId: res.fileId, progress: 100 } : item
            ));
          } else {
            throw new Error('No fileId returned from server');
          }
        } catch (err: any) {
          console.error('✗ Processing failed:', err?.message);
          setAttachments(prev => prev.map(item => 
            item.id === uploadId ? { ...item, status: 'failed', error: err?.message || 'Processing failed' } : item
          ));
        }
      } else {
        let errorMsg = 'Upload failed';
        try {
          const res = JSON.parse(xhr.responseText);
          errorMsg = res.error || errorMsg;
        } catch (_) {}
        console.error('✗ Upload failed:', errorMsg);
        setAttachments(prev => prev.map(item => 
          item.id === uploadId ? { ...item, status: 'failed', error: errorMsg } : item
        ));
      }
    };

    xhr.onerror = () => {
      console.error('✗ Request network failure');
      setAttachments(prev => prev.map(item => 
        item.id === uploadId ? { ...item, status: 'failed', error: 'Network failure' } : item
      ));
    };

    xhr.onabort = () => {
      console.log('✗ Upload cancelled by user');
      setAttachments(prev => prev.map(item => 
        item.id === uploadId ? { ...item, status: 'cancelled' } : item
      ));
    };

    xhr.send(formData);
  };

  const handleCancelUpload = (uploadId: string) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === uploadId);
      if (item && item.cancelXHR) {
        item.cancelXHR.abort();
      }
      return prev.map(a => a.id === uploadId ? { ...a, status: 'cancelled' } : a);
    });
  };

  const handleRetryUpload = (uploadId: string) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === uploadId);
      if (item && item.file) {
        uploadFile(uploadId, item.file);
        return prev.map(a => a.id === uploadId ? { ...a, status: 'queued', progress: 0, error: undefined } : a);
      }
      return prev;
    });
  };

  const handleRemoveAttachment = (uploadId: string) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === uploadId);
      if (item) {
        if (item.cancelXHR && (item.status === 'uploading' || item.status === 'queued')) {
          item.cancelXHR.abort();
        }
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return prev.filter(a => a.id !== uploadId);
    });
  };

  const processFiles = (files: FileList | File[]) => {
    const disallowedExtensions = ['exe', 'bat', 'cmd', 'sh', 'com', 'msi', 'scr', 'vbs', 'js', 'jar', 'bin', 'wsf'];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension && disallowedExtensions.includes(extension)) {
        alert(`Upload blocked for security: executable files and scripts (.${extension}) are not allowed.`);
        continue;
      }

      if (file.size > 1024 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max allowed size is 1GB.`);
        continue;
      }

      const uploadId = 'up-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      
      const newUpload: FileUpload = {
        id: uploadId,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        progress: 0,
        status: 'queued',
        previewUrl
      };

      setAttachments(prev => [...prev, newUpload]);
      uploadFile(uploadId, file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        const voiceFile = new File([audioBlob], `voice_message_${Date.now()}.mp3`, { type: 'audio/mpeg' });
        processFiles([voiceFile]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic access denied', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPostText(val);

    const caretPos = e.target.selectionStart;
    const textBeforeCaret = val.substring(0, caretPos);
    
    const atMatch = textBeforeCaret.match(/@(\w*)$/);
    const hashMatch = textBeforeCaret.match(/#(\w*)$/);

    if (atMatch) {
      setMentionQuery({ type: '@', query: atMatch[1], index: caretPos - atMatch[0].length });
    } else if (hashMatch) {
      setMentionQuery({ type: '#', query: hashMatch[1], index: caretPos - hashMatch[0].length });
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (name: string, id: string) => {
    if (!mentionQuery) return;
    const textarea = composerRef.current;
    if (!textarea) return;

    const val = postText;
    const before = val.substring(0, mentionQuery.index);
    const after = val.substring(textarea.selectionStart);
    const replacement = mentionQuery.type === '@' ? `@${name} ` : `#${name} `;

    setPostText(before + replacement + after);
    setMentionQuery(null);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(mentionQuery.index + replacement.length, mentionQuery.index + replacement.length);
    }, 50);
  };

  const handleMessageTouchStart = useCallback((msg: LiveMessage) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMobileMsg(msg);
    }, 600);
  }, []);

  const handleMessageTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!postText.trim() && attachments.length === 0) || !selectedChannelId || posting) return;

    // Check if any uploads are in progress or queued
    const hasUnfinishedUploads = attachments.some(a => a.status === 'uploading' || a.status === 'queued');
    if (hasUnfinishedUploads) {
      alert('Please wait for all files to finish uploading before sending.');
      return;
    }

    const fileIds = attachments
      .filter(a => a.status === 'uploaded' && a.fileId)
      .map(a => a.fileId as string);

    setPosting(true); setPostStatus(null);
    try {
      await apiFetch(`/api/channels/${selectedChannelId}/messages`, { 
        method: 'POST', 
        body: { 
          text: postText.trim(),
          fileIds: fileIds
        } 
      });
      setPostText('');
      setAttachments([]);
      setPostStatus('success');
      refetchLiveMessages();
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setTimeout(() => setPostStatus(null), 3000);
    } catch { setPostStatus('error'); } finally { setPosting(false); }
  };

  const handleRetrieveMessages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retrieverQuery.trim() || loadingRetriever) return;
    setLoadingRetriever(true); setRetrieverError(null); setRetrieverResult(null);
    try {
      const d = await apiFetch('/api/channels/retrieve-messages', {
        method: 'POST',
        body: { query: retrieverQuery.trim(), currentChannelId: selectedChannelId },
      });
      setRetrieverResult(d);
    } catch (err: any) {
      setRetrieverError(err?.message || 'Failed to retrieve messages.');
    } finally { setLoadingRetriever(false); }
  };

  const handleGetChannelSummary = async () => {
    if (!selectedChannelId || loadingSummary) return;
    setLoadingSummary(true);
    setSummaryError(null);
    setSummaryText(''); // start empty to show progression

    try {
      const token = localStorage.getItem('app-token');
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const streamUrl = `${BACKEND_URL}/api/channels/${selectedChannelId}/summarize?stream=true`;

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
            const dataStr = cleaned.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.token) {
                setSummaryText(prev => (prev || '') + data.token);
              }
            } catch (err) {
              console.warn('Malformed stream JSON:', cleaned);
            }
          }
        }
      }
    } catch (err: any) {
      setSummaryError(err?.message || 'Failed to generate summary.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGetActionPlans = async () => {
    if (!selectedChannelId || loadingPlans) return;
    setLoadingPlans(true); setPlansError(null); setActionPlans([]);
    try { const d = await apiFetch(`/api/channels/${selectedChannelId}/action-plans`); setActionPlans(d || []); }
    catch (err: any) { setPlansError(err?.message || 'Failed to extract action items.'); }
    finally { setLoadingPlans(false); }
  };

  const handleGetActiveMembers = async () => {
    if (!selectedChannelId || loadingMembers) return;
    setLoadingMembers(true); setMembersError(null); setActiveMembers([]);
    try { const d = await apiFetch(`/api/channels/${selectedChannelId}/active-members`); setActiveMembers(d || []); }
    catch (err: any) { setMembersError(err?.message || 'Failed to analyze active members.'); }
    finally { setLoadingMembers(false); }
  };

  const currentChannelName = channels?.find(c => c.id === selectedChannelId)?.name || 'channel';

  const filteredMessages = liveMessages?.filter(m =>
    !filterQuery || m.text?.toLowerCase().includes(filterQuery.toLowerCase())
  ) || [];

  /* ─── stat cards ─── */
  const stats = [
    {
      label: 'Total Channels',
      value: isLoading ? '—' : String(data?.stats.totalChannels ?? 0),
      sub: 'Synced from workspace',
      icon: Hash,
      color: '#7c6af7',
    },
    {
      label: 'Messages Indexed',
      value: isLoading ? '—' : String(data?.stats.messagesAnalyzed ?? 0),
      sub: 'In local database',
      icon: MessageSquare,
      color: '#6366f1',
    },
    {
      label: 'Saved Reports',
      value: isLoading ? '—' : String(data?.stats.savedReportsCount ?? 0),
      sub: 'Analytics exports',
      icon: FileText,
      color: '#8b5cf6',
    },
    {
      label: 'MCP Status',
      value: isLoading ? 'Checking' : data?.stats.mcpConnected ? 'Connected' : 'Offline',
      sub: 'Slack MCP subprocess',
      icon: Activity,
      color: data?.stats.mcpConnected ? '#10b981' : '#ef4444',
      isStatus: true,
      connected: data?.stats.mcpConnected,
    },
  ];

  return (
    <AppLayout>
      {/* Ambient orbs */}
      <div className="bg-orb w-[600px] h-[600px] opacity-[0.06]"
           style={{ background: '#7c6af7', top: '-200px', left: '180px' }} />
      <div className="bg-orb w-[400px] h-[400px] opacity-[0.04]"
           style={{ background: '#0ea5e9', bottom: '-100px', right: '100px' }} />

        {/* ── Top bar ── */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-20 gap-3"
                style={{
                  background: isLightMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(6,7,13,0.85)',
                  backdropFilter: 'blur(16px)',
                  borderBottom: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)'
                }}>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <TrendingUp className="w-4 h-4 shrink-0" style={{ color: '#7c6af7' }} />
            <span className={`text-[13px] font-semibold truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Assistant Overview</span>
            <div className="hidden sm:flex ml-2 items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0"
                 style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
              Live
            </div>
          </div>

          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncing}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-[12px] font-semibold text-white transition-all duration-200 disabled:opacity-50 shrink-0 touch-manipulation"
            style={{
              background: syncing ? 'rgba(124,106,247,0.2)' : 'linear-gradient(135deg, #7c6af7, #6366f1)',
              border: '1px solid rgba(124,106,247,0.4)',
              boxShadow: syncing ? 'none' : '0 4px 16px rgba(124,106,247,0.25)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Workspace'}</span>
            <span className="sm:hidden">{syncing ? '…' : 'Sync'}</span>
          </button>
        </header>

        {/* ── Content ── */}
        <div className="p-4 sm:p-6 md:p-7 space-y-5 sm:space-y-7 max-w-6xl w-full mx-auto">

          {/* Notifications */}
          {isSocketReconnecting && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl animate-pulse"
                 style={{ 
                   background: isLightMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.09)', 
                   border: isLightMode ? '1px solid rgba(245,158,11,0.18)' : '1px solid rgba(245,158,11,0.22)' 
                 }}>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <p className="text-[12px] font-semibold text-amber-500">Reconnecting to real-time service...</p>
            </div>
          )}
          {syncError && <ErrorBanner message={`Sync failed: ${syncError}${syncError.endsWith('.') ? '' : '.'} Verify your Slack Bot Token in Settings.`} />}
          {syncSuccess && (
            <div className="flex items-center gap-3 p-4 rounded-2xl animate-fadeIn"
                 style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: 'rgba(16,185,129,0.15)' }}>
                <CheckCircle className="w-4 h-4" style={{ color: '#34d399' }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: '#34d399' }}>Sync completed successfully</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(52,211,153,0.65)' }}>
                  {syncSuccess.channelsSynced} channels · {syncSuccess.messagesSynced} messages
                </p>
              </div>
            </div>
          )}

          {/* ── Workspace Intelligence Score Widget ── */}
          <section className={`rounded-3xl border p-6 grid grid-cols-1 md:grid-cols-3 gap-6 transition-all ${
            isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'
          }`}>
            {/* Circular Ring widget */}
            <div className="flex flex-col items-center justify-center md:border-r md:pr-6"
                 style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                          stroke={isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.06)'} />
                  <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                          stroke="url(#scoreGrad)"
                          strokeDasharray={`${loadingScore ? 0 : intelligenceScore?.overall || 0} 100`}
                          strokeLinecap="round" />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7c6af7" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                    {loadingScore ? '—' : intelligenceScore?.overall || 0}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: '#9ca3af' }}>Score</span>
                </div>
              </div>
              <div className="text-center mt-3">
                <h4 className={`text-xs font-bold ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>Workspace Intelligence</h4>
                <p className="text-[10px]" style={{ color: '#6b7280' }}>Overall team collaboration health</p>
              </div>
            </div>

            {/* Sub-scores details */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 md:pt-0">
              {[
                { label: 'Communication Quality', score: intelligenceScore?.communicationQuality || 0, color: '#7c6af7' },
                { label: 'Decision Tracking', score: intelligenceScore?.decisionTracking || 0, color: '#6366f1' },
                { label: 'Task Completion', score: intelligenceScore?.taskCompletion || 0, color: '#10b981' },
                { label: 'Knowledge Coverage', score: intelligenceScore?.knowledgeCoverage || 0, color: '#0ea5e9' },
              ].map((sub, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span style={{ color: isLightMode ? '#64748b' : '#9ca3af' }}>{sub.label}</span>
                    <span className={`font-bold ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
                      {loadingScore ? '—' : `${sub.score}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: loadingScore ? '0%' : `${sub.score}%`, background: sub.color }} />
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2 flex items-center justify-between text-[10px] pt-2 border-t"
                   style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#6b7280' }}>MCP Server Connection:</span>
                <span className={`font-bold uppercase ${data?.stats.mcpConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {data?.stats.mcpConnected ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </section>

          {/* ── Channel Viewer ── */}
          <section className="glass-elevated rounded-3xl overflow-hidden" style={{ border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)' }}>

            {/* Panel header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4"
                 style={{
                   borderBottom: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)',
                   background: isLightMode ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.02)'
                 }}>
              <SectionHeader
                icon={MessageSquare}
                title="Interactive Channel Viewer"
                subtitle={`#${currentChannelName} · auto-refreshes every 10s`}
              />

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={fetchLimit}
                  onChange={e => setFetchLimit(Number(e.target.value))}
                  className={`glass-input px-3 py-2 rounded-xl text-[12px] cursor-pointer flex-1 min-w-[110px] sm:flex-none ${isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'}`}
                  style={{ fontFamily: 'Inter, sans-serif', minWidth: 120 }}
                >
                  <option value={5}>Latest 5</option>
                  <option value={10}>Latest 10</option>
                  <option value={20}>Latest 20</option>
                  <option value={50}>Latest 50</option>
                  <option value={100}>Latest 100</option>
                  <option value={200}>Latest 200</option>
                </select>

                <select
                  value={selectedChannelId}
                  onChange={e => setSelectedChannelId(e.target.value)}
                  className={`glass-input px-3 py-2 rounded-xl text-[12px] cursor-pointer flex-1 min-w-[110px] sm:flex-none ${isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'}`}
                  style={{ fontFamily: 'Inter, sans-serif', minWidth: 130 }}
                >
                  {channels?.map(ch => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => refetchLiveMessages()}
                  disabled={isFetchingMessages}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                  style={{
                    background: isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
                    border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)',
                    color: isFetchingMessages ? '#7c6af7' : '#6b7280',
                  }}
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMessages ? 'animate-spin' : ''}`} />
                </button>

                {/* Pinned Messages Dropdown in Dashboard Channel Viewer */}
                <div className="relative">
                  <button
                    onClick={() => { setShowPinnedDropdown(!showPinnedDropdown); setShowBookmarksDropdown(false); }}
                    type="button"
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                      showPinnedDropdown 
                        ? 'border-primary text-primary bg-primary/10' 
                        : (isLightMode ? 'bg-[#000000]/02 border-[#000000]/06 text-[#6b7280]' : 'bg-[#ffffff]/04 border-[#ffffff]/08 text-[#6b7280]')
                    }`}
                    title="Pinned Messages"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {pinnedMessages && pinnedMessages.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-bold px-1 rounded-full">{pinnedMessages.length}</span>
                    )}
                  </button>

                  {showPinnedDropdown && (
                    <div 
                      ref={pinnedDropdownRef}
                      className={`absolute right-0 mt-2 w-80 max-h-80 overflow-y-auto rounded-2xl border shadow-2xl p-4 flex flex-col gap-3 z-[100] ${
                        isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pinned Channel Messages</span>
                        <button onClick={() => setShowPinnedDropdown(false)} className="text-[9px] text-primary hover:underline font-bold">Close</button>
                      </div>
                      {!pinnedMessages || pinnedMessages.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">No pinned messages in this channel.</div>
                      ) : (
                        pinnedMessages.map((p) => (
                          <div 
                            key={p.id} 
                            onClick={() => handleSelectPinnedMessage(p)}
                            className="p-2.5 border border-border/30 rounded-xl bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all duration-200 flex flex-col gap-1.5 text-[11px] cursor-pointer"
                          >
                            <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                              <span className="font-bold">{getUserDisplayName(p.user || p.role || 'Unknown')}</span>
                              <div className="flex items-center gap-1.5">
                                <span>{formatFriendlyDate(p.pinned_at)}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePin({ ts: p.id, isPinned: true, text: p.content, user: p.user || p.role });
                                  }}
                                  className="text-red-400 hover:text-red-500 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                                  title="Unpin Message"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                            <p className="truncate line-clamp-2 max-w-full text-foreground/90 font-medium">{p.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Bookmarked / Saved Messages Dropdown in Dashboard Channel Viewer */}
                <div className="relative">
                  <button
                    onClick={() => { setShowBookmarksDropdown(!showBookmarksDropdown); setShowPinnedDropdown(false); }}
                    type="button"
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                      showBookmarksDropdown 
                        ? 'border-amber-500 text-amber-500 bg-amber-500/10' 
                        : (isLightMode ? 'bg-[#000000]/02 border-[#000000]/06 text-[#6b7280]' : 'bg-[#ffffff]/04 border-[#ffffff]/08 text-[#6b7280]')
                    }`}
                    title="Saved Messages"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {bookmarkedMessages && bookmarkedMessages.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-bold px-1 rounded-full">{bookmarkedMessages.length}</span>
                    )}
                  </button>

                  {showBookmarksDropdown && (
                    <div 
                      ref={bookmarksDropdownRef}
                      className={`absolute right-0 mt-2 w-80 max-h-80 overflow-y-auto rounded-2xl border shadow-2xl p-4 flex flex-col gap-3 z-[100] ${
                        isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saved Messages</span>
                        <button onClick={() => setShowBookmarksDropdown(false)} className="text-[9px] text-amber-500 hover:underline font-bold">Close</button>
                      </div>
                      {!bookmarkedMessages || bookmarkedMessages.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">No saved messages.</div>
                      ) : (
                        bookmarkedMessages.map((b) => (
                          <div 
                            key={b.id} 
                            onClick={() => handleSelectSavedMessage(b)}
                            className="p-2.5 border border-border/30 rounded-xl bg-card/40 hover:bg-card/70 hover:border-amber-500/30 transition-all duration-200 flex flex-col gap-1.5 text-[11px] cursor-pointer"
                          >
                            <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                              <span className="font-bold">{getUserDisplayName(b.user || b.role || 'Unknown')}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-500 font-bold">{getChannelDisplayName(b.session_id)}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleBookmark({ ts: b.id, isBookmarked: true, text: b.content, user: b.user || b.role });
                                  }}
                                  className="text-amber-500 hover:text-amber-600 p-0.5 rounded hover:bg-amber-500/10 transition-colors"
                                  title="Unsave Message"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                            <p className="truncate line-clamp-2 max-w-full text-foreground/90 font-medium">{b.content}</p>
                            <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                              <span>Sent {fmtDate(b.id)} {fmtTime(b.id)}</span>
                              <span>Saved {formatFriendlyDate(b.saved_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter bar */}
            <div className="px-4 sm:px-6 pt-4 pb-2">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                   style={{
                     background: isLightMode ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255,255,255,0.03)',
                     border: isLightMode ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255,255,255,0.07)'
                   }}>
                <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: '#4b5563' }} />
                <input
                  type="text"
                  placeholder="Filter messages in this view by keyword…"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  className={`flex-1 bg-transparent text-[12px] outline-none ${isLightMode ? 'text-slate-800 placeholder:text-slate-400' : 'text-white placeholder:text-[#374151]'}`}
                />
                {filterQuery && (
                  <button onClick={() => setFilterQuery('')} className="text-[10px] px-2 py-0.5 rounded-lg"
                          style={{ color: '#6b7280', background: 'rgba(255,255,255,0.06)' }}>clear</button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="px-4 sm:px-6 pb-4 h-[280px] sm:h-[340px] overflow-y-auto space-y-2.5 pt-2">
              {isFetchingMessages && !liveMessages ? (
                <div className="space-y-3 pt-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-xl skeleton shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className={`h-3 skeleton rounded-lg w-${i % 2 === 0 ? '1/4' : '1/3'}`} />
                        <div className={`h-4 skeleton rounded-lg w-${i % 2 === 0 ? '3/4' : '1/2'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredMessages.length === 0 ? (
                <EmptyState text={filterQuery ? 'No messages match your filter.' : 'No messages found. Try syncing or post one below!'} />
              ) : (
                [...filteredMessages].reverse().map((msg, idx) => {
                  const isHighlighted = !!highlightedMessageTs && (
                    String(highlightedMessageTs) === String(msg.ts) || 
                    String(highlightedMessageTs) === String(msg.id)
                  );
                  return (
                    <MessageItem
                      key={msg.ts || msg.id || idx}
                      msg={msg}
                      idx={idx}
                      isHighlighted={isHighlighted}
                      activeEmojiPickerMsgId={activeEmojiPickerMsgId}
                      setActiveEmojiPickerMsgId={setActiveEmojiPickerMsgId}
                      openedMenuMessageId={openedMenuMessageId}
                      setOpenedMenuMessageId={setOpenedMenuMessageId}
                      openedMoreMenuMsgId={openedMoreMenuMsgId}
                      setOpenedMoreMenuMsgId={setOpenedMoreMenuMsgId}
                      readMessageIds={readMessageIds}
                      toggleReadStatus={toggleReadStatus}
                      handleDeleteMessage={handleDeleteMessage}
                      hoveredMessageId={hoveredMessageId}
                      setHoveredMessageId={setHoveredMessageId}
                      setActiveThreadParentId={setActiveThreadParentId}
                      handleToggleReaction={handleToggleReaction}
                      handleToggleBookmark={handleToggleBookmark}
                      handleTogglePin={handleTogglePin}
                      handleRunAiAction={handleRunAiAction}
                      setTaskMessage={setTaskMessage}
                      setTaskForm={setTaskForm}
                      setReminderMessage={setReminderMessage}
                      setInfoModalMessage={setInfoModalMessage}
                      handleMessageTouchStart={handleMessageTouchStart}
                      handleMessageTouchEnd={handleMessageTouchEnd}
                      onOpenImageLightbox={handleOpenImageLightbox}
                      onOpenVideoPlayer={handleOpenVideoPlayer}
                      onOpenPdfViewer={handleOpenPdfViewer}
                      onOpenCodeViewer={handleOpenCodeViewer}
                    />
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Post message */}
            <div 
              className={`px-6 pb-5 relative transition-all duration-200 ${
                isDraggingOver ? 'bg-primary/5 border border-dashed border-primary/30 rounded-3xl mx-2 my-1' : ''
              }`} 
              onDragOver={handleDragOver} 
              onDragLeave={handleDragLeave} 
              onDrop={handleFileDrop}
            >
              
              {/* File Upload Preview bar */}
              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-3 bg-secondary/10 rounded-2xl border border-border/40 max-h-60 overflow-y-auto">
                  {attachments.map((att) => {
                    const isImage = att.type.startsWith('image/');
                    const sizeFriendly = (att.size / (1024 * 1024)).toFixed(2) + ' MB';
                    const extension = att.name.split('.').pop()?.toUpperCase() || 'FILE';

                    let FileIcon = FileText;
                    if (att.type.startsWith('video/')) FileIcon = FileVideo;
                    else if (att.type.startsWith('audio/')) FileIcon = FileAudio;
                    else if (att.type.startsWith('text/') || att.type.includes('json') || att.type.includes('xml')) FileIcon = FileCode;
                    else if (att.type.includes('zip') || att.type.includes('tar') || att.type.includes('rar') || att.type.includes('7z')) FileIcon = FileArchive;
                    else if (att.type.includes('sheet') || att.type.includes('excel') || att.type.includes('csv')) FileIcon = FileSpreadsheet;

                    return (
                      <div 
                        key={att.id} 
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          att.status === 'failed' ? 'border-red-500/30 bg-red-500/5' : 
                          att.status === 'uploaded' ? 'border-emerald-500/20 bg-emerald-500/5' : 
                          'bg-card border-border/50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-secondary/30 flex items-center justify-center relative">
                          {isImage && att.previewUrl ? (
                            <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                          ) : (
                            <FileIcon className={`w-5 h-5 ${
                              att.status === 'failed' ? 'text-red-400' :
                              att.status === 'uploaded' ? 'text-emerald-400' : 'text-primary'
                            }`} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-semibold truncate text-foreground/90">{att.name}</span>
                            <span className="text-[8px] uppercase font-mono px-1 rounded bg-secondary/50 text-muted-foreground">{extension}</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                            <span>{sizeFriendly}</span>
                            <span className={`font-semibold ${
                              att.status === 'uploaded' ? 'text-emerald-400' :
                              att.status === 'failed' ? 'text-red-400' : 
                              att.status === 'cancelled' ? 'text-slate-400' : 'text-primary animate-pulse'
                            }`}>
                              {att.status === 'uploading' ? `Uploading... ${att.progress}%` : 
                               att.status === 'uploaded' ? 'Completed' : 
                               att.status === 'failed' ? 'Failed' : 
                               att.status === 'cancelled' ? 'Cancelled' : 'Queued'}
                            </span>
                          </div>
                          
                          {att.status === 'failed' && att.error && (
                            <div className="text-[8px] text-red-400/90 mt-0.5 leading-snug break-all font-semibold" style={{ maxWidth: '160px' }}>
                              {att.error}
                            </div>
                          )}

                          {(att.status === 'uploading' || att.status === 'queued') && (
                            <div className="w-full h-1 bg-secondary/50 rounded-full mt-1 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${att.progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 shrink-0 ml-1">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="p-1 text-muted-foreground hover:text-red-400 hover:bg-secondary/20 rounded-md transition-colors"
                            title="Remove File"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {att.status === 'uploading' && (
                            <button 
                              type="button" 
                              onClick={() => handleCancelUpload(att.id)}
                              className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-md transition-colors text-[9px] font-bold"
                              title="Cancel Upload"
                            >
                              Cancel
                            </button>
                          )}
                          {att.status === 'failed' && (
                            <button 
                              type="button" 
                              onClick={() => handleRetryUpload(att.id)}
                              className="p-1 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors text-[9px] font-bold"
                              title="Retry Upload"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mentions Autocomplete suggestions */}
              {mentionQuery && (
                <div className={`max-w-xs absolute bottom-28 left-6 w-64 max-h-48 overflow-y-auto rounded-2xl border shadow-2xl p-2 z-50 ${
                  isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
                }`}>
                  <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase border-b border-border/30 tracking-wider">
                    {mentionQuery.type === '@' ? 'Users List' : 'Channels List'}
                  </div>
                  {mentionQuery.type === '@' ? (
                    Object.keys(slackUsers)
                      .filter(id => (slackUsers[id]?.realName || id).toLowerCase().includes(mentionQuery.query.toLowerCase()))
                      .map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selectMention(slackUsers[id]?.realName || id, id)}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-secondary/40 rounded-lg truncate flex items-center gap-1.5 font-semibold text-foreground/90"
                        >
                          <User className="w-3 h-3 text-primary shrink-0" />
                          {slackUsers[id]?.realName || id}
                        </button>
                      ))
                  ) : (
                    channels
                      ?.filter(c => c.name.toLowerCase().includes(mentionQuery.query.toLowerCase()))
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectMention(c.name, c.id)}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-secondary/40 rounded-lg truncate flex items-center gap-1.5 font-semibold text-foreground/90"
                        >
                          <span className="text-primary font-bold shrink-0">#</span>
                          {c.name}
                        </button>
                      ))
                  )}
                </div>
              )}

              <RichTextEditor
                channelId={selectedChannelId}
                channels={channels || []}
                users={slackUsers}
                posting={posting}
                onSend={async (text) => {
                  setPosting(true); setPostStatus(null);
                  try {
                    const fileIds = attachments
                      .filter(a => a.status === 'uploaded' && a.fileId)
                      .map(a => a.fileId as string);

                    await apiFetch(`/api/channels/${selectedChannelId}/messages`, { 
                      method: 'POST', 
                      body: { 
                        text: text,
                        fileIds: fileIds
                      } 
                    });
                    setAttachments([]);
                    setPostStatus('success');
                    refetchLiveMessages();
                    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
                    setTimeout(() => setPostStatus(null), 3000);
                  } catch { 
                    setPostStatus('error'); 
                  } finally { 
                    setPosting(false); 
                  }
                }}
                attachments={attachments}
                onFileInputChange={handleFileInputChange}
                isRecording={isRecording}
                recordDuration={recordDuration}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onRemoveAttachment={(id) => {
                  setAttachments(prev => prev.filter(a => a.id !== id));
                }}
                onPaste={handlePaste}
              />

              {postStatus === 'success' && (
                <div className="flex items-center gap-2 mt-2 text-[11px] animate-fadeIn px-2"
                     style={{ color: '#34d399' }}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Message posted successfully!
                </div>
              )}
            </div>
          </section>

          {/* ── AI Command Center & Insights Panel ── */}
          <section className={`rounded-3xl border p-6 space-y-6 ${
            isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'
          }`}>
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <Brain className="w-4.5 h-4.5 text-[#7c6af7]" />
                <h3 className={`text-[14px] font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>AI Command Center</h3>
              </div>
              <p className="text-[11px]" style={{ color: isLightMode ? '#6b7280' : '#9ca3af' }}>
                Ask anything or explore the indexed knowledge base using conversational commands
              </p>
            </div>

            {/* Quick-pick examples */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Suggestions:</span>
              {[
                { label: 'Decisions', q: 'What decisions were made in this channel?' },
                { label: 'Unresolved tasks', q: 'Show unresolved action items' },
                { label: 'Timeline summary', q: 'latest 50 messages' },
                { label: 'Team activity', q: 'Who is contributing most?' }
              ].map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setRetrieverQuery(chip.q);
                    apiFetch('/api/channels/retrieve-messages', {
                      method: 'POST',
                      body: { query: chip.q, currentChannelId: selectedChannelId },
                    }).then(d => setRetrieverResult(d)).catch(err => setRetrieverError(err?.message));
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
                    isLightMode
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-400'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Query form */}
            <form onSubmit={handleRetrieveMessages} className="flex gap-2.5">
              <div className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all"
                   style={{
                     background: isLightMode ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                     border: isLightMode ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'
                   }}
                   onFocusCapture={e => (e.currentTarget as HTMLElement).style.border = '1px solid rgba(124,106,247,0.5)'}
                   onBlurCapture={e => (e.currentTarget as HTMLElement).style.border = isLightMode ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'}
              >
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#4b5563' }} />
                <input
                  type="text"
                  required
                  placeholder='Search messages (e.g. "production release blocker" or "bahubali")...'
                  value={retrieverQuery}
                  onChange={e => setRetrieverQuery(e.target.value)}
                  disabled={loadingRetriever}
                  className={`flex-1 bg-transparent text-[12px] outline-none ${isLightMode ? 'text-slate-800 placeholder:text-slate-400' : 'text-white placeholder:text-[#374151]'}`}
                />
              </div>
              <PrimaryBtn
                loading={loadingRetriever}
                loadingText="Searching…"
                disabled={loadingRetriever || !retrieverQuery.trim()}
                className="px-6 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                Query
              </PrimaryBtn>
            </form>

            {loadingRetriever && (
              <div className="flex items-center gap-2 text-[12px] text-slate-400 font-mono animate-pulse">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400/30 border-t-slate-400 animate-spin shrink-0" />
                Searching for: <span className="text-white font-semibold">"{retrieverQuery}"</span>
              </div>
            )}

            {retrieverError && <ErrorBanner message={retrieverError} />}

            {retrieverResult && !loadingRetriever && (
              <div className="space-y-4 animate-fadeInUp">
                <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl"
                     style={{
                       background: isLightMode ? 'rgba(124,106,247,0.08)' : 'rgba(124,106,247,0.06)',
                       border: '1px solid rgba(124,106,247,0.15)'
                     }}>
                  <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c6af7' }} />
                  <span className={`text-[11px] font-semibold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{retrieverResult.explanation}</span>
                  <div className="flex flex-wrap gap-2 ml-auto items-center">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                          style={{
                            background: 'rgba(124,106,247,0.15)',
                            color: '#7c6af7',
                            border: '1px solid rgba(124,106,247,0.25)'
                          }}>
                      {retrieverResult.messages.length} results
                    </span>
                  </div>
                </div>

                {/* AI Summary Card */}
                {retrieverResult.summary && (
                  <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                    isLightMode ? 'bg-slate-50 border-slate-200/80 text-slate-705' : 'bg-white/[0.02] border-white/[0.06] text-slate-300'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-2 font-bold text-[10px] uppercase tracking-wider text-violet-400">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      AI Search Summary
                    </div>
                    <p className="italic">"{retrieverResult.summary}"</p>
                  </div>
                )}

                {/* Metadata Row: Participants & Topics */}
                {((retrieverResult.participants && retrieverResult.participants.length > 0) || 
                  (retrieverResult.relatedTopics && retrieverResult.relatedTopics.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Participants */}
                    {retrieverResult.participants && retrieverResult.participants.length > 0 && (
                      <div className={`p-3 rounded-2xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/[0.01] border-white/[0.06]'}`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Key Contributors</span>
                        <div className="flex flex-wrap gap-1.5">
                          {retrieverResult.participants.slice(0, 6).map((p: string, idx: number) => (
                            <span key={idx} className="text-[9px] font-semibold px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Related Topics */}
                    {retrieverResult.relatedTopics && retrieverResult.relatedTopics.length > 0 && (
                      <div className={`p-3 rounded-2xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/[0.01] border-white/[0.06]'}`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Related Topics</span>
                        <div className="flex flex-wrap gap-1.5">
                          {retrieverResult.relatedTopics.slice(0, 6).map((t: string, idx: number) => (
                            <span key={idx} className="text-[9px] font-semibold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="max-h-[320px] overflow-y-auto space-y-2.5 rounded-2xl p-3"
                     style={{
                       background: isLightMode ? 'rgba(0,0,0,0.01)' : 'rgba(0,0,0,0.2)',
                       border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)'
                     }}>
                  {retrieverResult.messages.length === 0 ? (
                    <EmptyState text="No relevant messages found." />
                  ) : (
                    retrieverResult.messages.map((msg: any, idx: number) => {
                      const avatar = getUserAvatar(msg.user);
                      return (
                        <div key={idx} className="msg-bubble flex gap-3 items-start px-3 py-2.5 rounded-xl transition-all hover:bg-white/[0.02]">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-7 h-7 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold uppercase shrink-0"
                                 style={{ background: avatarColor(msg.user || 'U'), opacity: 0.85 }}>
                               {getUserInitials(msg.user)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2 mb-1.5">
                              <div className="flex items-baseline gap-2">
                                <span className={`text-[11px] font-semibold font-sans ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{getUserDisplayName(msg.user)}</span>
                                <span className="text-[9px]" style={{ color: isLightMode ? '#6b7280' : '#4b5563' }}>{fmtDate(msg.ts)} {fmtTime(msg.ts)}</span>
                              </div>
                              {msg.relevanceScore !== undefined && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                                      style={{
                                        background: msg.relevanceScore >= 90 ? 'rgba(16,185,129,0.12)' : msg.relevanceScore >= 75 ? 'rgba(124,106,247,0.12)' : 'rgba(245,158,11,0.12)',
                                        color: msg.relevanceScore >= 90 ? '#10b981' : msg.relevanceScore >= 75 ? '#7c6af7' : '#fbbf24',
                                        borderColor: msg.relevanceScore >= 90 ? 'rgba(16,185,129,0.25)' : msg.relevanceScore >= 75 ? 'rgba(124,106,247,0.25)' : 'rgba(245,158,11,0.25)'
                                      }}>
                                  Relevance: {msg.relevanceScore}%
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: isLightMode ? '#334155' : '#d1d5db' }}>{msg.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* AI Insights Collapsible Panel */}
            <div className="border-t pt-4" style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => setShowInsights(!showInsights)}
                className="flex items-center justify-between w-full text-left font-bold text-xs"
                style={{ color: isLightMode ? '#4b5563' : '#9ca3af' }}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  AI Workspace Insights
                </span>
                {showInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showInsights && (
                <div className="mt-3.5 space-y-2.5 animate-fadeIn">
                  {loadingInsights ? (
                    <div className="space-y-2">
                      <div className="h-6 skeleton rounded-xl w-3/4" />
                      <div className="h-6 skeleton rounded-xl w-2/3" />
                    </div>
                  ) : !insightsData?.insights?.length ? (
                    <p className="text-[11px] italic" style={{ color: '#6b7280' }}>No general insights calculated yet.</p>
                  ) : (
                    insightsData.insights.map((ins: any, idx: number) => {
                      const isWarn = ins.type === 'warning';
                      const isPos = ins.type === 'positive';
                      return (
                        <div key={idx} className="flex gap-2.5 p-3 rounded-2xl border text-xs font-semibold leading-relaxed"
                             style={isWarn ? {
                               background: isLightMode ? '#fffbeb' : 'rgba(245,158,11,0.04)',
                               borderColor: isLightMode ? '#fef3c7' : 'rgba(245,158,11,0.1)',
                               color: isLightMode ? '#b45309' : '#fcd34d'
                             } : isPos ? {
                               background: isLightMode ? '#f0fdf4' : 'rgba(16,185,129,0.04)',
                               borderColor: isLightMode ? '#dcfce7' : 'rgba(16,185,129,0.1)',
                               color: isLightMode ? '#15803d' : '#6ee7b7'
                             } : {
                               background: isLightMode ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                               borderColor: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.05)',
                               color: isLightMode ? '#475569' : '#94a3b8'
                             }}>
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{ins.text}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Analytics Panel ── */}
          <section className="glass rounded-3xl p-6" style={{ border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-5">
              <SectionHeader icon={Activity} title="Channel Analytics" subtitle="AI-powered insights from conversation history" />

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl"
                   style={{
                     background: isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
                     border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)'
                   }}>
                {([
                  { key: 'summary', icon: Layers,         label: 'Summary'  },
                  { key: 'actions', icon: ClipboardList,  label: 'Actions'  },
                  { key: 'members', icon: Users,           label: 'Members'  },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAnalyticsTab(tab.key)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200"
                    style={analyticsTab === tab.key
                      ? { background: 'linear-gradient(135deg,#7c6af7,#6366f1)', color: '#fff', boxShadow: '0 4px 12px rgba(124,106,247,0.35)' }
                      : { color: isLightMode ? '#4b5563' : '#8b949e' }}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-[200px]">

              {/* Summary tab */}
              {analyticsTab === 'summary' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px]" style={{ color: '#6b7280' }}>
                      Concise summary + highlights from the last 40 messages in <span className="font-mono text-[#a78bfa]">#{currentChannelName}</span>
                    </p>
                    <PrimaryBtn onClick={handleGetChannelSummary} disabled={loadingSummary || !selectedChannelId} loading={loadingSummary} loadingText="Summarizing…">
                      <Sparkles className="w-3.5 h-3.5" />
                      Summarize
                    </PrimaryBtn>
                  </div>
                  {summaryError && <ErrorBanner message={summaryError} />}
                  {summaryText ? (
                    (() => {
                      let data: any;
                      try {
                        let raw = summaryText.trim();
                        if (raw.startsWith('```')) {
                          const lines = raw.split('\n');
                          if (lines[0].startsWith('```')) lines.shift();
                          if (lines[lines.length - 1].startsWith('```')) lines.pop();
                          raw = lines.join('\n').trim();
                        }
                        data = JSON.parse(raw);
                      } catch (e) {
                        return (
                          <div className="mx-auto max-w-[900px] w-full mt-2">
                            <div className={`p-5 rounded-2xl text-[14px] leading-7 select-text ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-sm text-slate-700' 
                                : 'glass text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)' }}>
                              {summaryText}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="mx-auto max-w-[900px] w-full mt-2 space-y-4">
                          <h2 className={`text-[24px] font-bold mb-6 select-text ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                            Conversation Summary
                          </h2>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Main Context / Conversation Overview */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] md:col-span-2 ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Conversation Overview
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <p className={`text-[14px] leading-[1.7] ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                <BoldText text={data.conversationOverview} />
                              </p>
                            </div>

                            {/* Discussion Themes */}
                            {data.discussionThemes && data.discussionThemes.length > 0 && (
                              <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] md:col-span-2 ${
                                isLightMode 
                                  ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                  : 'glass hover:border-white/10 text-slate-300'
                              }`}
                                   style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                                <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                  Discussion Themes
                                </h3>
                                <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                                <div className="space-y-3">
                                  {data.discussionThemes.map((theme: any, i: number) => (
                                    <div key={i} className={`p-3.5 rounded-xl border flex flex-col md:flex-row justify-between gap-3 ${
                                      isLightMode ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.01]'
                                    }`}>
                                      <div className="flex-1">
                                        <h4 className={`text-[14px] font-bold mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{theme.theme}</h4>
                                        <p className={`text-[13px] leading-[1.6] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{theme.summary}</p>
                                      </div>
                                      <span className={`self-start px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                        theme.importance?.toLowerCase() === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                        theme.importance?.toLowerCase() === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      }`}>
                                        {theme.importance} Importance
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Key Discussion Points */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Key Discussion Points
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <ul className={`flex flex-col gap-1.5 list-disc pl-4 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                {data.keyDiscussionPoints?.map((p: string, i: number) => (
                                  <li key={i} className="p-0 m-0 leading-[1.6] text-[14px]"><BoldText text={p} /></li>
                                ))}
                              </ul>
                            </div>

                            {/* Important Insights */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Important Insights
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <ul className={`flex flex-col gap-1.5 list-disc pl-4 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                {data.importantInsights?.map((p: string, i: number) => (
                                  <li key={i} className="p-0 m-0 leading-[1.6] text-[14px]"><BoldText text={p} /></li>
                                ))}
                              </ul>
                            </div>

                            {/* Decisions Made */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Decisions Made
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <ul className={`flex flex-col gap-1.5 list-disc pl-4 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                {data.decisions?.map((p: string, i: number) => (
                                  <li key={i} className="p-0 m-0 leading-[1.6] text-[14px]"><BoldText text={p} /></li>
                                ))}
                              </ul>
                            </div>

                            {/* Risks / Blockers */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Risks / Blockers
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <ul className={`flex flex-col gap-1.5 list-disc pl-4 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                {data.risks?.map((p: string, i: number) => (
                                  <li key={i} className="p-0 m-0 leading-[1.6] text-[14px]"><BoldText text={p} /></li>
                                ))}
                              </ul>
                            </div>

                            {/* Action Items */}
                            {data.actionItems && data.actionItems.length > 0 && (
                              <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] md:col-span-2 ${
                                isLightMode 
                                  ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                  : 'glass hover:border-white/10 text-slate-300'
                              }`}
                                   style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                                <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                  Action Items
                                </h3>
                                <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                                <div className={`overflow-x-auto rounded-xl border my-1 leading-normal ${
                                  isLightMode ? 'border-slate-200/60 bg-slate-50/50' : 'border-white/5 bg-black/15'
                                }`}>
                                  <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                      <tr className={`border-b ${isLightMode ? 'bg-slate-100/50 border-slate-200/50' : 'bg-white/5 border-white/5'}`}>
                                        <th className={`px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-white/50'}`}>Task</th>
                                        <th className={`px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-white/50'}`}>Owner</th>
                                        <th className={`px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-white/50'}`}>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {data.actionItems.map((item: any, i: number) => (
                                        <tr key={i} className={`border-b last:border-0 hover:bg-white/5 transition-colors ${
                                          isLightMode ? 'border-slate-100 hover:bg-slate-100/30' : 'border-white/5'
                                        }`}>
                                          <td className={`px-3 py-1.5 font-medium ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>{item.task}</td>
                                          <td className={`px-3 py-1.5 font-medium ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>{getUserDisplayName(item.owner)}</td>
                                          <td className={`px-3 py-1.5 font-medium ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                              item.status?.toLowerCase() === 'completed' ? (isLightMode ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400') :
                                              item.status?.toLowerCase() === 'in progress' ? (isLightMode ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/10 text-amber-400') :
                                              (isLightMode ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/10 text-blue-400')
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Participants */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] md:col-span-2 ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Participants
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <p className={`text-[14px] leading-[1.7] ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                {data.participants?.join(', ') || 'No contributors detected.'}
                              </p>
                            </div>

                            {/* Final Outcome */}
                            <div className={`p-4 rounded-2xl flex flex-col justify-start transition-all duration-300 hover:scale-[1.01] md:col-span-2 ${
                              isLightMode 
                                ? 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200/80 text-slate-800' 
                                : 'glass hover:border-white/10 text-slate-300'
                            }`}
                                 style={{ border: isLightMode ? '' : '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', paddingBottom: '12px' }}>
                              <h3 className={`text-[16px] font-semibold mb-1 ${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'}`}>
                                Final Outcome
                              </h3>
                              <div className={`w-full border-t mb-3 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`} />
                              <p className={`text-[14px] leading-[1.7] font-medium ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                                <BoldText text={data.finalOutcome} />
                              </p>
                            </div>

                          </div>
                        </div>
                      );
                    })()
                  ) : !loadingSummary && <EmptyState text='Click "Summarize" to generate channel insights.' />}
                </div>
              )}

              {/* Actions tab */}
              {analyticsTab === 'actions' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px]" style={{ color: '#6b7280' }}>
                      Extract tasks, owners, and deadlines from the conversation.
                    </p>
                    <PrimaryBtn onClick={handleGetActionPlans} disabled={loadingPlans || !selectedChannelId} loading={loadingPlans} loadingText="Extracting…">
                      <ClipboardList className="w-3.5 h-3.5" />
                      Extract Items
                    </PrimaryBtn>
                  </div>
                  {plansError && <ErrorBanner message={plansError} />}
                  {actionPlans.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden" style={{ border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)' }}>
                      <table className="w-full text-left border-collapse text-[12px]">
                        <thead>
                          <tr style={{
                            background: isLightMode ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.03)',
                            borderBottom: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)'
                          }}>
                            {['Task', 'Owner', 'Status', 'Deadline'].map(h => (
                              <th key={h} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {actionPlans.map((p, i) => {
                            const st = (p.status || '').toLowerCase();
                            const badgeClass = st.includes('done') || st.includes('complete') ? 'badge-done' : st.includes('progress') || st.includes('started') ? 'badge-progress' : 'badge-pending';
                            return (
                              <tr key={i} className="transition-colors" style={{ borderBottom: isLightMode ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                                <td className={`px-4 py-3 font-medium ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{p.task}</td>
                                <td className="px-4 py-3" style={{ color: isLightMode ? '#6b7280' : '#9ca3af' }}>{p.owner ? getUserDisplayName(p.owner) : 'Unassigned'}</td>
                                <td className="px-4 py-3">
                                  <span className={`${badgeClass} px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase`}>{p.status || 'Pending'}</span>
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px]" style={{ color: isLightMode ? '#6b7280' : '#6b7280' }}>{p.deadline || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : !loadingPlans && <EmptyState text='Click "Extract Items" to parse action plans from this channel.' />}
                </div>
              )}

              {/* Members tab */}
              {analyticsTab === 'members' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px]" style={{ color: '#6b7280' }}>
                      Participation analysis based on recent message frequency.
                    </p>
                    <PrimaryBtn onClick={handleGetActiveMembers} disabled={loadingMembers || !selectedChannelId} loading={loadingMembers} loadingText="Analyzing…">
                      <Users className="w-3.5 h-3.5" />
                      Analyze
                    </PrimaryBtn>
                  </div>
                  {membersError && <ErrorBanner message={membersError} />}
                  {activeMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeMembers.map((m, i) => {
                        const color = avatarColor(m.userId || m.name);
                        const pct = activeMembers[0].count > 0 ? (m.count / activeMembers[0].count) * 100 : 0;
                        return (
                          <div key={i} className="p-4 rounded-2xl transition-all duration-200 group shadow-sm bg-card"
                               style={{
                                 background: isLightMode ? '#ffffff' : 'rgba(255,255,255,0.03)',
                                 border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)'
                               }}
                               onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = '1px solid rgba(124,106,247,0.25)'}
                               onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)'}>
                            <div className="flex items-center gap-3 mb-3">
                              {m.avatar ? (
                                <img src={m.avatar} alt={m.realName} className="w-9 h-9 rounded-xl shrink-0 object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold uppercase shrink-0"
                                     style={{ background: color }}>
                                  {(m.realName || m.name || 'US').slice(0, 2)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h5 className={`text-[13px] font-semibold truncate leading-none ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{m.realName || m.name}</h5>
                                <p className="text-[10px] mt-0.5 font-mono" style={{ color: isLightMode ? '#6b7280' : '#4b5563' }}>@{m.name}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[18px] font-bold leading-none" style={{ color }}>{m.count}</span>
                                <span className="text-[9px] block uppercase tracking-wide mt-0.5" style={{ color: isLightMode ? '#6b7280' : '#374151' }}>posts</span>
                              </div>
                            </div>
                            {/* Activity bar */}
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                   style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}80, ${color})` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : !loadingMembers && <EmptyState text='Click "Analyze" to see the most active members in this channel.' />}
                </div>
              )}
            </div>
          </section>

          {/* ── Recent Reports ── */}
          <section className="glass rounded-3xl p-6" style={{ border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-5">
              <SectionHeader icon={FileText} title="Recent Reports" subtitle="Saved analytics exports" />
              <Link
                href="/reports"
                className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
                style={{ color: '#7c6af7' }}
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {!data?.recentReports || data.recentReports.length === 0 ? (
              <EmptyState text="No reports saved yet. Generate your first report →" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.recentReports.slice(0, 3).map(report => {
                  const [bg, fg] = reportBadge(report.type);
                  return (
                    <Link
                      key={report.id}
                      href={`/reports?id=${report.id}`}
                      className="group p-4 rounded-2xl flex flex-col justify-between transition-all duration-200 min-h-[110px] bg-card shadow-sm"
                      style={{
                        background: isLightMode ? '#ffffff' : 'rgba(255,255,255,0.03)',
                        border: isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)'
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = isLightMode ? '#ffffff' : 'rgba(124,106,247,0.06)';
                        (e.currentTarget as HTMLElement).style.border = '1px solid rgba(124,106,247,0.25)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = isLightMode ? '#ffffff' : 'rgba(255,255,255,0.03)';
                        (e.currentTarget as HTMLElement).style.border = isLightMode ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)';
                      }}
                    >
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mb-2.5"
                              style={{ background: bg, color: fg }}>
                          {report.type}
                        </span>
                        <p className={`text-[13px] font-semibold leading-snug group-hover:text-[#7c6af7] transition-colors ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                          {report.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-3 text-[10px]" style={{ color: '#4b5563' }}>
                        <Clock className="w-3 h-3" />
                        {new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

        </div>

      {/* Thread Drawer side drawer panel */}
      {activeThreadParentId && (
        <div className="fixed md:relative inset-0 md:inset-auto md:w-[380px] border-l flex flex-col h-full bg-card shrink-0 z-40 transition-all shadow-2xl"
             style={{
               borderLeft: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
               background: isLightMode ? 'rgba(255,255,255,0.98)' : 'rgba(15,16,27,0.98)'
             }}>
          
          {/* Thread Header */}
          <div className="p-4 border-b flex items-center justify-between shrink-0"
               style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Thread replies</h4>
            </div>
            <button 
              onClick={() => setActiveThreadParentId(null)}
              className="text-xs text-muted-foreground hover:text-foreground font-bold"
            >
              Close
            </button>
          </div>

          {/* Thread messages list viewport */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Render parent message */}
            {(() => {
              const parent = liveMessages?.find(m => m.ts === activeThreadParentId);
              if (!parent) return null;
              return (
                <div className="p-3.5 border-b pb-4 mb-2 flex flex-col gap-2"
                     style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-bold">{getUserDisplayName(parent.user)}</span>
                    <span>{fmtDate(parent.ts)} {fmtTime(parent.ts)}</span>
                  </div>
                  <p className="text-xs leading-relaxed font-semibold text-foreground/95">{parent.text}</p>
                </div>
              );
            })()}

            {/* Loading Thread Replies */}
            {isThreadLoading ? (
              <div className="space-y-3 py-6">
                <div className="h-10 bg-secondary/15 rounded-xl animate-pulse" />
                <div className="h-10 bg-secondary/15 rounded-xl animate-pulse" />
              </div>
            ) : threadReplies.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground px-4">
                No thread replies yet. Reply below.
              </div>
            ) : (
              threadReplies.map((r) => {
                const isRepUser = r.role === 'user';
                const isThinking = r.content === '';
                return (
                  <div key={r.id} className={`p-3 rounded-2xl flex flex-col gap-1.5 max-w-[85%] ${
                    isRepUser 
                      ? 'ml-auto bg-[#7c6af7]/10 border border-[#7c6af7]/20 text-[#7c6af7]' 
                      : (isLightMode ? 'mr-auto bg-slate-100 border border-slate-200 text-slate-800' : 'mr-auto bg-secondary/10 border border-border/20 text-foreground')
                  }`}>
                    <div className="flex justify-between items-center text-[8px] text-muted-foreground/80">
                      <span className="font-bold">{getUserDisplayName(r.user || (isRepUser ? 'user' : 'assistant'))}</span>
                      {!isThinking && <span>{formatFriendlyDate(r.created_at)}</span>}
                    </div>
                    
                    {isThinking ? (
                      <div className="flex space-x-1 items-center py-1">
                        <span className="w-1 h-1 bg-[#7c6af7] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 bg-[#7c6af7] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 bg-[#7c6af7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{r.content}</p>
                    )}
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Thread reply composer */}
          <form onSubmit={handleSendThreadReply} className="p-4 border-t bg-card/25 shrink-0 flex gap-2"
                style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              required
              placeholder="Reply to thread..."
              value={threadInput}
              onChange={(e) => setThreadInput(e.target.value)}
              disabled={isThreadSending}
              className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/40 ${
                isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-slate-900 border-border text-white'
              }`}
            />
            <button
              type="submit"
              disabled={isThreadSending || !threadInput.trim()}
              className="p-2 rounded-xl bg-primary text-white hover:bg-primary/95 transition-all shadow-md shadow-primary/10 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}

      {/* MODAL 1: Message Info */}
      {infoModalMessage && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-4" onClick={() => setInfoModalMessage(null)}>
          <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl border flex flex-col gap-4 ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Info className="w-4 h-4 text-primary" /> Message metadata</h4>
              <button onClick={() => setInfoModalMessage(null)} className="text-xs text-muted-foreground hover:text-foreground font-bold">Close</button>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-border/10 py-1.5">
                <span className="text-muted-foreground">Message ID</span>
                <span className="font-mono text-[10px] break-all">{infoModalMessage.id}</span>
              </div>
              <div className="flex justify-between border-b border-border/10 py-1.5">
                <span className="text-muted-foreground">Author Role</span>
                <span className="font-semibold uppercase">{infoModalMessage.role}</span>
              </div>
              <div className="flex justify-between border-b border-border/10 py-1.5">
                <span className="text-muted-foreground">Created At</span>
                <span>{formatFriendlyDate(infoModalMessage.created_at)}</span>
              </div>
              {infoModalMessage.edited_at && (
                <div className="flex justify-between border-b border-border/10 py-1.5">
                  <span className="text-muted-foreground">Edited At</span>
                  <span>{formatFriendlyDate(infoModalMessage.edited_at)}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/10 py-1.5">
                <span className="text-muted-foreground">Pinned Status</span>
                <span>{infoModalMessage.isPinned ? 'Yes (Pinned)' : 'No'}</span>
              </div>
              <div className="flex justify-between border-b border-border/10 py-1.5">
                <span className="text-muted-foreground">Bookmarked</span>
                <span>{infoModalMessage.isBookmarked ? 'Yes (Saved)' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Convert to Task */}
      {taskMessage && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-4" onClick={() => setTaskMessage(null)}>
          <form onSubmit={handleCreateTask} className={`w-full max-w-md p-6 rounded-3xl shadow-2xl border flex flex-col gap-4 ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Check className="w-4 h-4 text-[#7c6af7]" /> Convert message to task</h4>
              <button type="button" onClick={() => setTaskMessage(null)} className="text-xs text-muted-foreground hover:text-foreground font-bold">Cancel</button>
            </div>
            
            <div className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-semibold">Task description</label>
                <textarea
                  required
                  value={taskForm.task}
                  onChange={e => setTaskForm({ ...taskForm, task: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border border-border outline-none focus:border-primary ${
                    isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f101a] text-white border-border/40'
                  }`}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-semibold">Owner</label>
                  <input
                    type="text"
                    value={taskForm.owner}
                    onChange={e => setTaskForm({ ...taskForm, owner: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border border-border outline-none focus:border-primary ${
                      isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f101a] text-white border-border/40'
                    }`}
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-semibold">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border border-border outline-none focus:border-primary ${
                      isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f101a] text-white border-border/40'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-semibold">Priority</label>
                <select
                  value={taskForm.priority}
                  onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border border-border outline-none focus:border-primary ${
                    isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f101a] text-white border-border/40'
                  }`}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl transition-all shadow-md shadow-primary/10 mt-2">
                Save Task to Action Center
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Set Reminder */}
      {reminderMessage && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-4" onClick={() => setReminderMessage(null)}>
          <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl border flex flex-col gap-4 ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Bell className="w-4 h-4 text-[#7c6af7]" /> Set message reminder</h4>
              <div className="flex items-center gap-2">
                <button onClick={() => { setReminderMessage(null); setShowMyReminders(true); }} className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                  <Bell className="w-3 h-3" /> My Reminders
                </button>
                <button onClick={() => setReminderMessage(null)} className="text-xs text-muted-foreground hover:text-foreground font-bold">✕</button>
              </div>
            </div>

            {/* Message Preview */}
            <div className={`text-xs rounded-xl p-3 border border-border/40 ${isLightMode ? 'bg-slate-50 text-slate-700' : 'bg-[#0f101a] text-slate-300'} line-clamp-3 leading-relaxed`}>
              "{reminderMessage.text?.slice(0, 160)}{reminderMessage.text?.length > 160 ? '…' : ''}"
            </div>
            
            <div className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-semibold">Remind me in:</label>
                <select
                  value={reminderDuration}
                  onChange={e => setReminderDuration(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border border-border outline-none focus:border-primary ${
                    isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f101a] text-white border-border/40'
                  }`}
                >
                  <option value="10">10 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                  <option value="1440">24 hours (Tomorrow)</option>
                  <option value="custom">Custom Date & Time</option>
                </select>
              </div>

              {reminderDuration === 'custom' && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-muted-foreground font-semibold">Select Date & Time:</label>
                  <input
                    type="datetime-local"
                    value={customRemindAt}
                    onChange={e => setCustomRemindAt(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    className={`w-full p-2.5 rounded-xl border border-border outline-none focus:border-primary ${
                      isLightMode ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f101a] text-white border-border/40'
                    }`}
                  />
                </div>
              )}

              <button 
                type="button" 
                onClick={handleSetReminder}
                className="w-full py-3 bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" /> Set Reminder
              </button>
              <p className="text-center text-muted-foreground text-[10px]">You'll receive an in-app notification and email (if configured)</p>
            </div>
          </div>
        </div>
      )}

      {/* My Reminders Panel (slide-in drawer) */}
      {showMyReminders && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex justify-end" onClick={() => setShowMyReminders(false)}>
          <div className={`w-full max-w-sm h-full flex flex-col shadow-2xl overflow-hidden ${
            isLightMode ? 'bg-white' : 'bg-[#141624]'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/40">
              <h3 className="font-bold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-[#7c6af7]" /> My Reminders</h3>
              <button onClick={() => setShowMyReminders(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!pendingReminders || pendingReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
                  <Bell className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No pending reminders</p>
                  <p className="text-xs text-muted-foreground/60">Use "Remind Me Later" on any message to schedule a reminder.</p>
                </div>
              ) : (
                pendingReminders.map((r: any) => {
                  const remindAt = new Date(r.remind_at);
                  const isPast = remindAt < new Date();
                  const content = r.message_content || r.content || 'No content';
                  return (
                    <div key={r.id} className={`p-3 rounded-xl border text-xs ${
                      isPast ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border/40'
                    } ${isLightMode ? 'bg-slate-50' : 'bg-[#0f101a]'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`flex items-center gap-1 font-semibold ${isPast ? 'text-yellow-400' : 'text-primary'}`}>
                          <Bell className="w-3 h-3" />
                          {isPast ? 'Due now' : remindAt.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <button onClick={() => handleDeleteReminder(r.id)} className="text-muted-foreground hover:text-red-400 transition-colors" title="Delete reminder">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                        "{content.slice(0, 140)}{content.length > 140 ? '…' : ''}"
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reminder Toast Notifications Stack */}
      {reminderToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-3 max-w-sm w-full">
          {reminderToasts.map((reminder: any) => {
            const content = reminder.message_content || reminder.content || 'Message reminder';
            return (
              <div 
                key={reminder.id}
                onClick={() => handleSelectSavedMessage(reminder)}
                className="bg-[#141624] border border-[#7c6af7]/40 rounded-2xl shadow-2xl p-4 flex gap-3 items-start animate-slide-up cursor-pointer hover:bg-slate-800/40 transition-colors"
                style={{ animation: 'slideUpFade 0.3s ease-out forwards' }}
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#6366f1] flex items-center justify-center">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white mb-0.5">⏰ Message Reminder (Click to view)</p>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    "{content.slice(0, 120)}{content.length > 120 ? '…' : ''}"
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDismissReminderToast(reminder.id); }}
                  className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 4: AI Action results */}
      {aiActionResult && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-4" onClick={() => setAiActionResult(null)}>
          <div className={`w-full max-w-2xl p-6 rounded-3xl shadow-2xl border flex flex-col gap-4 ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary animate-pulse" /> {aiActionResult.title}</h4>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(aiActionResult.text);
                  }}
                  className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy response
                </button>
                <button onClick={() => setAiActionResult(null)} className="text-xs text-muted-foreground hover:text-foreground font-bold">Close</button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-96 text-xs leading-relaxed max-w-none text-foreground/90 p-4 border border-border/40 rounded-2xl bg-secondary/5 font-medium">
              <MarkdownRenderer text={aiActionResult.text} isLightMode={isLightMode} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Running AI actions loading */}
      {isRunningAiAction && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex flex-col gap-3 items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs font-semibold text-white tracking-wide animate-pulse">Running AI collaborator query...</span>
        </div>
      )}

      {/* Mobile Action Menu Overlay */}
      {selectedMobileMsg && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-end sm:hidden" onClick={() => setSelectedMobileMsg(null)}>
          <div className={`w-full rounded-t-3xl p-6 flex flex-col gap-3.5 shadow-2xl border-t ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0" />
            
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Message Quick Actions</span>
              <button onClick={() => setSelectedMobileMsg(null)} className="text-xs text-primary font-bold">Close</button>
            </div>

            <div className="flex justify-between items-center py-2 px-2 bg-secondary/10 rounded-2xl gap-1 shrink-0 overflow-x-auto">
              {EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  onClick={() => handleToggleReaction(selectedMobileMsg.ts, emoji, selectedMobileMsg.text, selectedMobileMsg.user)}
                  className="text-xl px-1 hover:scale-110 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold mt-2">
              <button onClick={() => { setActiveThreadParentId(selectedMobileMsg.ts); setSelectedMobileMsg(null); }} className="w-full text-left p-3 hover:bg-secondary/25 rounded-2xl flex items-center gap-2 border border-border/20"><MessageSquare className="w-4 h-4 text-primary" /> Reply Thread</button>
              <button onClick={() => handleToggleBookmark(selectedMobileMsg)} className="w-full text-left p-3 hover:bg-secondary/25 rounded-2xl flex items-center gap-2 border border-border/20"><Bookmark className="w-4 h-4 text-amber-500" /> {selectedMobileMsg.isBookmarked ? 'Unsave Msg' : 'Save Message'}</button>
              <button onClick={() => handleTogglePin(selectedMobileMsg)} className="w-full text-left p-3 hover:bg-secondary/25 rounded-2xl flex items-center gap-2 border border-border/20"><Pin className="w-4 h-4 text-sky-400" /> {selectedMobileMsg.isPinned ? 'Unpin Msg' : 'Pin Message'}</button>
              <button onClick={() => { setInfoModalMessage({ id: selectedMobileMsg.ts, role: selectedMobileMsg.user === 'US' ? 'user' : 'assistant', content: selectedMobileMsg.text, created_at: new Date(parseFloat(selectedMobileMsg.ts) * 1000).toISOString(), isPinned: selectedMobileMsg.isPinned, isBookmarked: selectedMobileMsg.isBookmarked }); setSelectedMobileMsg(null); }} className="w-full text-left p-3 hover:bg-secondary/25 rounded-2xl flex items-center gap-2 border border-border/20"><Info className="w-4 h-4 text-purple-400" /> Message Info</button>
            </div>

            <div className="border-t border-border/40 my-1" />

            <div className="flex flex-col gap-1.5 text-xs font-semibold">
              <button onClick={() => handleRunAiAction(selectedMobileMsg.ts, 'explain', 'AI Explanation', selectedMobileMsg.text)} className="w-full text-left p-2.5 hover:bg-secondary/25 rounded-xl flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Explain message with AI</button>
              <button onClick={() => { setTaskMessage(selectedMobileMsg); setTaskForm({ task: selectedMobileMsg.text.slice(0, 100), owner: 'Unassigned', dueDate: '', priority: 'medium' }); }} className="w-full text-left p-2.5 hover:bg-secondary/25 rounded-xl flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Convert to Task</button>
              <button onClick={() => setReminderMessage(selectedMobileMsg)} className="w-full text-left p-2.5 hover:bg-secondary/25 rounded-xl flex items-center gap-2"><Bell className="w-4 h-4 text-yellow-400" /> Remind Me Later</button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 6: Image Lightbox */}
      {activeImageLightbox && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setActiveImageLightbox(null)}>
          <div className="relative max-w-4xl w-full flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setActiveImageLightbox(null)} 
              className="absolute -top-10 right-0 text-white hover:text-slate-300 font-bold text-sm bg-white/10 px-3 py-1.5 rounded-xl transition-all"
            >
              ✕ Close
            </button>
            <img 
              src={activeImageLightbox.url} 
              alt={activeImageLightbox.name} 
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10" 
            />
            <div className="flex flex-col sm:flex-row items-center justify-between w-full text-white bg-black/60 px-5 py-3 rounded-2xl border border-white/5 backdrop-blur-md gap-2">
              <div className="min-w-0 text-center sm:text-left">
                <p className="text-xs font-bold truncate max-w-md">{activeImageLightbox.name}</p>
                {activeImageLightbox.size && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Size: {(activeImageLightbox.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>
              <a 
                href={`${activeImageLightbox.url}&download=true`} 
                download={activeImageLightbox.name}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#7c6af7] hover:bg-[#7c6af7]/90 transition-all shadow-lg shadow-[#7c6af7]/20"
              >
                Download Image
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Video Player */}
      {activeVideoPlayer && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setActiveVideoPlayer(null)}>
          <div className="relative max-w-3xl w-full flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setActiveVideoPlayer(null)} 
              className="absolute -top-10 right-0 text-white hover:text-slate-300 font-bold text-sm bg-white/10 px-3 py-1.5 rounded-xl transition-all"
            >
              ✕ Close
            </button>
            <video 
              src={activeVideoPlayer.url} 
              controls 
              autoPlay
              className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl border border-white/10" 
            />
            <div className="flex flex-col sm:flex-row items-center justify-between w-full text-white bg-black/60 px-5 py-3 rounded-2xl border border-white/5 backdrop-blur-md gap-2">
              <div className="min-w-0 text-center sm:text-left">
                <p className="text-xs font-bold truncate max-w-md">{activeVideoPlayer.name}</p>
                {activeVideoPlayer.size && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Size: {(activeVideoPlayer.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>
              <a 
                href={`${activeVideoPlayer.url}&download=true`} 
                download={activeVideoPlayer.name}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#7c6af7] hover:bg-[#7c6af7]/90 transition-all shadow-lg shadow-[#7c6af7]/20"
              >
                Download Video
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: PDF Viewer */}
      {activePdfViewer && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4" onClick={() => setActivePdfViewer(null)}>
          <div className={`relative max-w-4xl w-full h-[85vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border/40 shrink-0">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> {
                    activePdfViewer.filetype && ['doc', 'docx'].includes(activePdfViewer.filetype) ? 'Word Document Preview' :
                    activePdfViewer.filetype && ['xls', 'xlsx'].includes(activePdfViewer.filetype) ? 'Excel Spreadsheet Preview' :
                    activePdfViewer.filetype && ['ppt', 'pptx'].includes(activePdfViewer.filetype) ? 'PowerPoint Presentation Preview' :
                    'PDF Document Preview'
                  }
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-md">{activePdfViewer.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href={activePdfViewer.originalUrl || `${activePdfViewer.url}&download=true`} 
                  download={activePdfViewer.name}
                  className="text-xs text-primary hover:underline font-bold"
                >
                  {
                    activePdfViewer.filetype && ['doc', 'docx'].includes(activePdfViewer.filetype) ? 'Download Word Document' :
                    activePdfViewer.filetype && ['xls', 'xlsx'].includes(activePdfViewer.filetype) ? 'Download Excel Spreadsheet' :
                    activePdfViewer.filetype && ['ppt', 'pptx'].includes(activePdfViewer.filetype) ? 'Download PowerPoint Presentation' :
                    'Download PDF'
                  }
                </a>
                <button onClick={() => setActivePdfViewer(null)} className="text-xs text-muted-foreground hover:text-foreground font-bold bg-secondary/20 px-3 py-1.5 rounded-xl transition-all">✕ Close</button>
              </div>
            </div>
            <div className="flex-1 bg-secondary/5 relative">
              <iframe 
                src={activePdfViewer.url} 
                className="w-full h-full border-0" 
                title={activePdfViewer.name} 
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: Code Viewer */}
      {activeCodeViewer && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4" onClick={() => setActiveCodeViewer(null)}>
          <div className={`relative max-w-4xl w-full h-[80vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#141624] border-border'
          }`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border/40 shrink-0">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-[#7c6af7]" /> Source Code Viewer
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-md">{activeCodeViewer.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => activeCodeViewer.content && navigator.clipboard.writeText(activeCodeViewer.content)}
                  className="text-xs text-primary hover:underline font-bold"
                >
                  Copy Code
                </button>
                <button onClick={() => setActiveCodeViewer(null)} className="text-xs text-muted-foreground hover:text-foreground font-bold bg-secondary/20 px-3 py-1.5 rounded-xl transition-all">✕ Close</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-secondary/5 font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre-wrap font-mono select-text text-foreground/90">{activeCodeViewer.content}</pre>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}

/* ─── Tag chip ─── */
function Tag({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
          style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

/* ─── Time window label ─── */
function fmtWindow(mins: number) {
  if (mins < 60)    return `Last ${mins} mins`;
  if (mins < 1440)  return `Last ${mins / 60}h`;
  if (mins === 1440) return 'Today';
  return `Last ${mins / 1440} day(s)`;
}

interface MessageItemProps {
  msg: any;
  idx: number;
  isHighlighted?: boolean;
  activeEmojiPickerMsgId: string | null;
  setActiveEmojiPickerMsgId: (id: string | null) => void;
  openedMenuMessageId: string | null;
  setOpenedMenuMessageId: (id: string | null) => void;
  openedMoreMenuMsgId: string | null;
  setOpenedMoreMenuMsgId: (id: string | null) => void;
  readMessageIds: Record<string, boolean>;
  toggleReadStatus: (ts: string) => void;
  handleDeleteMessage: (ts: string) => void;
  hoveredMessageId: string | null;
  setHoveredMessageId: (id: string | null) => void;
  setActiveThreadParentId: (id: string | null) => void;
  handleToggleReaction: (ts: string, emoji: string, text: string, user: string) => void;
  handleToggleBookmark: (msg: any) => void;
  handleTogglePin: (msg: any) => void;
  handleRunAiAction: (ts: string, action: string, title: string, text: string) => void;
  setTaskMessage: (msg: any) => void;
  setTaskForm: (form: any) => void;
  setReminderMessage: (msg: any) => void;
  setInfoModalMessage: (msg: any) => void;
  handleMessageTouchStart: (msg: any) => void;
  handleMessageTouchEnd: () => void;
  onOpenImageLightbox: (url: string, name: string, size?: number) => void;
  onOpenVideoPlayer: (url: string, name: string, size?: number) => void;
  onOpenPdfViewer: (url: string, name: string, size?: number, originalUrl?: string, filetype?: string) => void;
  onOpenCodeViewer: (file: any) => void;
}

const MessageItem = React.memo(({
  msg,
  idx,
  isHighlighted = false,
  activeEmojiPickerMsgId,
  setActiveEmojiPickerMsgId,
  openedMenuMessageId,
  setOpenedMenuMessageId,
  openedMoreMenuMsgId,
  setOpenedMoreMenuMsgId,
  readMessageIds,
  toggleReadStatus,
  handleDeleteMessage,
  hoveredMessageId,
  setHoveredMessageId,
  setActiveThreadParentId,
  handleToggleReaction,
  handleToggleBookmark,
  handleTogglePin,
  handleRunAiAction,
  setTaskMessage,
  setTaskForm,
  setReminderMessage,
  setInfoModalMessage,
  handleMessageTouchStart,
  handleMessageTouchEnd,
  onOpenImageLightbox,
  onOpenVideoPlayer,
  onOpenPdfViewer,
  onOpenCodeViewer
}: MessageItemProps) => {
  const { user, slackUsers } = useAuth();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';

  const EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '😮', '😢', '👀', '🚀'];

  const getUserAvatar = (userId: string) => {
    return slackUsers[userId]?.avatar || null;
  };

  const getUserInitials = (userId: string) => {
    if (!userId) return 'U';
    const clean = userId.replace(/[<@>]/g, '');
    const mapped = slackUsers[clean];
    if (mapped?.realName) {
      const parts = mapped.realName.split(' ');
      if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
      return mapped.realName.slice(0, 2).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const avatarColor = (userId: string) => {
    const colors = ['#7c6af7', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getUserDisplayName = (userId: string) => {
    if (!userId) return 'Unknown';
    const clean = userId.replace(/[<@>]/g, '');
    const mapped = slackUsers[clean];
    return mapped?.realName || mapped?.name || clean;
  };

  const fmtDate = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const fmtTime = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };



  const avatar = getUserAvatar(msg.user);
  const isMsgUser = msg.user === 'US' || msg.user === user?.id?.toString();
  
  // Group Reactions by emoji
  const reactionsMap: Record<string, any[]> = {};
  if (msg.reactions) {
    msg.reactions.forEach((r: any) => {
      if (!reactionsMap[r.emoji]) reactionsMap[r.emoji] = [];
      reactionsMap[r.emoji].push(r);
    });
  }

  const prevReactionsKeysRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const currentKeys = Object.keys(reactionsMap);
    const removedKeys = prevReactionsKeysRef.current.filter(k => !currentKeys.includes(k));
    for (const rk of removedKeys) {
      console.log(`[Frontend removed emoji] emoji: ${rk} from message: ${msg.ts}`);
    }
    prevReactionsKeysRef.current = currentKeys;
  }, [reactionsMap, msg.ts]);

  const elementRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isHighlighted && elementRef.current) {
      const el = elementRef.current;
      const timer = setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  return (
    <div 
      ref={elementRef}
      id={`msg-${msg.ts}`}
      onMouseEnter={() => setHoveredMessageId(msg.ts)}
      onMouseLeave={() => setHoveredMessageId(null)}
      className={`msg-bubble flex gap-3 items-start px-3 py-2.5 rounded-xl relative transition-all duration-500 border border-transparent ${
        isHighlighted
          ? isLightMode 
            ? 'bg-amber-100/60 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] scale-[1.01]' 
            : 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.1)] scale-[1.01]'
          : isLightMode 
            ? 'hover:bg-slate-100/50' 
            : 'hover:bg-white/[0.02]'
      }`}
      onTouchStart={() => handleMessageTouchStart(msg)}
      onTouchEnd={handleMessageTouchEnd}
    >
      {/* Interactive Actions Toolbar */}
      <div 
        data-msg-toolbar 
        className={`absolute -top-3.5 z-40 flex items-center bg-card border border-border shadow-2xl rounded-2xl p-1 gap-1 transition-opacity duration-150 right-3 ${
          (activeEmojiPickerMsgId === msg.ts || openedMenuMessageId === msg.ts || openedMoreMenuMsgId === msg.ts)
            ? 'opacity-100 pointer-events-auto'
            : (activeEmojiPickerMsgId !== null || openedMenuMessageId !== null || openedMoreMenuMsgId !== null)
              ? 'opacity-0 pointer-events-none'
              : (hoveredMessageId === msg.ts)
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
        }`}
      >
        
        {/* Emojis selector trigger */}
        <div className="relative">
          <button 
            type="button"
            className="p-1 rounded-xl hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
            title="Add Reaction"
            onClick={(e) => {
              e.stopPropagation();
              setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.ts ? null : msg.ts);
              setOpenedMenuMessageId(null);
            }}
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
          
          {activeEmojiPickerMsgId === msg.ts && (
            <div className="absolute bottom-8 flex gap-1 bg-card border border-border shadow-2xl rounded-2xl p-2 z-50 right-0" onClick={e => e.stopPropagation()}>
              {EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  type="button"
                  onClick={() => handleToggleReaction(msg.ts, emoji, msg.text, msg.user)}
                  className="text-base hover:scale-125 transition-transform px-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread reply */}
        <button 
          type="button"
          onClick={() => setActiveThreadParentId(msg.ts)}
          className="p-1.5 rounded-xl hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
          title="Reply in Thread"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        {/* Bookmark / Save */}
        <button 
          type="button"
          onClick={() => handleToggleBookmark(msg)}
          className={`p-1.5 rounded-xl hover:bg-secondary/40 transition-colors ${
            msg.isBookmarked ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'
          }`}
          title={msg.isBookmarked ? "Remove Bookmark" : "Save Message"}
        >
          <Bookmark className="w-3.5 h-3.5" fill={msg.isBookmarked ? "currentColor" : "none"} />
        </button>

        {/* Pin */}
        <button 
          type="button"
          onClick={() => handleTogglePin(msg)}
          className={`p-1.5 rounded-xl hover:bg-secondary/40 transition-colors ${
            msg.isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
          title={msg.isPinned ? "Unpin Message" : "Pin Message"}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>

        {/* AI actions dropdown */}
        <div className="relative">
          <button 
            type="button"
            data-ai-trigger="true"
            onClick={(e) => {
              e.stopPropagation();
              setOpenedMenuMessageId(openedMenuMessageId === msg.ts ? null : msg.ts);
              setActiveEmojiPickerMsgId(null);
            }}
            className={`p-1.5 rounded-xl hover:bg-secondary/40 flex items-center transition-colors ${
              openedMenuMessageId === msg.ts ? 'bg-[#7c6af7]/10 text-[#7c6af7] dark:bg-[#7c6af7]/20 dark:text-[#a78bfa]' : 'text-[#7c6af7] hover:opacity-85'
            }`}
            title="AI Actions"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          
          {openedMenuMessageId === msg.ts && (
            <div className={`ai-actions-dropdown absolute ${idx < 3 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} w-52 rounded-xl shadow-2xl p-2 z-50 right-0`} onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => handleRunAiAction(msg.ts, 'explain', 'AI Explanation', msg.text)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Info className="w-3.5 h-3.5 text-sky-500 shrink-0" /> Explain Message</button>
              <button type="button" onClick={() => handleRunAiAction(msg.ts, 'summarize', 'AI Summary', msg.text)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Compass className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Summarize Points</button>
              <button type="button" onClick={() => handleRunAiAction(msg.ts, 'translate', 'AI Translation', msg.text)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Terminal className="w-3.5 h-3.5 text-purple-500 shrink-0" /> Translate Message</button>
              <button type="button" onClick={() => handleRunAiAction(msg.ts, 'improve', 'Improved Text', msg.text)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Edit3 className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Improve Grammar</button>
              <button type="button" onClick={() => handleRunAiAction(msg.ts, 'rewrite', 'Professional Rewrite', msg.text)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Rewrite Professionally</button>
              <div className="border-t border-slate-200 dark:border-slate-600 my-1.5" />
              <button type="button" onClick={() => { setTaskMessage(msg); setTaskForm({ task: msg.text.slice(0, 100), owner: 'Unassigned', dueDate: '', priority: 'medium' }); }} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Convert to Task</button>
              <button type="button" onClick={() => setReminderMessage(msg)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100"><Bell className="w-3.5 h-3.5 text-yellow-500 shrink-0" /> Remind Me Later</button>
            </div>
          )}
        </div>

        {/* 3-Dots Options Dropdown */}
        <div className="relative">
          <button 
            type="button"
            data-more-trigger="true"
            onClick={(e) => {
              e.stopPropagation();
              setOpenedMoreMenuMsgId(openedMoreMenuMsgId === msg.ts ? null : msg.ts);
              setOpenedMenuMessageId(null);
              setActiveEmojiPickerMsgId(null);
            }}
            className={`p-1.5 rounded-xl hover:bg-secondary/40 flex items-center transition-colors ${
              openedMoreMenuMsgId === msg.ts ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="More Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {openedMoreMenuMsgId === msg.ts && (
            <div 
              className={`more-options-dropdown absolute ${idx < 3 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} w-52 rounded-xl shadow-2xl p-2 z-50 right-0 border ${
                isLightMode ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#141624] border-border text-slate-100'
              }`}
              onClick={e => e.stopPropagation()}
            >
              {/* 1. Mark Read / Unread */}
              <button 
                type="button" 
                onClick={() => {
                  toggleReadStatus(msg.ts);
                  setOpenedMoreMenuMsgId(null);
                }} 
                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg flex items-center gap-2 text-[11px] font-semibold transition-colors"
              >
                {readMessageIds[msg.ts] ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Mark as Unread
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Mark as Read
                  </>
                )}
              </button>

              {/* 2. Remind Me Later */}
              <button 
                type="button" 
                onClick={() => {
                  setReminderMessage(msg);
                  setOpenedMoreMenuMsgId(null);
                }} 
                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg flex items-center gap-2 text-[11px] font-semibold transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-yellow-500 shrink-0" /> Remind Me Later
              </button>

              {/* 3. Convert to Task */}
              <button 
                type="button" 
                onClick={() => {
                  setTaskMessage(msg);
                  setTaskForm({ task: msg.text ? msg.text.slice(0, 100) : '', owner: 'Unassigned', dueDate: '', priority: 'medium' });
                  setOpenedMoreMenuMsgId(null);
                }} 
                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg flex items-center gap-2 text-[11px] font-semibold transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Convert to Task
              </button>

              {/* 4. Copy Message */}
              <button 
                type="button" 
                onClick={() => {
                  if (msg.text) {
                    navigator.clipboard.writeText(msg.text);
                    alert('Message text copied to clipboard!');
                  }
                  setOpenedMoreMenuMsgId(null);
                }} 
                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg flex items-center gap-2 text-[11px] font-semibold transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-teal-500 shrink-0" /> Copy Msg
              </button>

              <div className="border-t border-slate-200 dark:border-slate-700/60 my-1" />

              {/* 5. Message Info */}
              <button 
                type="button" 
                onClick={() => {
                  setInfoModalMessage({ id: msg.ts, role: isMsgUser ? 'user' : 'assistant', content: msg.text, created_at: new Date(parseFloat(msg.ts) * 1000).toISOString(), isPinned: msg.isPinned, isBookmarked: msg.isBookmarked });
                  setOpenedMoreMenuMsgId(null);
                }} 
                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg flex items-center gap-2 text-[11px] font-semibold transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" /> Msg Info
              </button>

              {/* 6. Delete Message */}
              <button 
                type="button" 
                onClick={() => {
                  handleDeleteMessage(msg.ts);
                  setOpenedMoreMenuMsgId(null);
                }} 
                className="w-full text-left p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2 text-[11px] font-semibold text-rose-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {avatar ? (
        <img src={avatar} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-bold uppercase shrink-0"
             style={{ background: avatarColor(msg.user || 'U'), opacity: 0.85 }}>
          {getUserInitials(msg.user)}
        </div>
      )}
      
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-[11px] font-semibold font-sans flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
            {getUserDisplayName(msg.user)}
            {msg.isPinned && <Pin className="w-2.5 h-2.5 text-primary rotate-45 shrink-0" />}
            {msg.isBookmarked && <Bookmark className="w-2.5 h-2.5 text-amber-500 shrink-0" fill="currentColor" />}
          </span>
          <span className="text-[9px]" style={{ color: isLightMode ? '#6b7280' : '#4b5563' }}>{fmtDate(msg.ts)} {fmtTime(msg.ts)}</span>
        </div>
        <div 
          className="text-[12px] leading-relaxed slack-message-body"
          style={{ color: isLightMode ? '#334155' : '#d1d5db' }}
        >
          <SlackMrkdwnRenderer text={msg.text || ''} users={slackUsers} />
        </div>
        
        {/* Render File Attachments */}
        {msg.files && msg.files.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-2.5 max-w-lg">
            {msg.files.map((file: any) => {
              const isImage = file.mimetype?.startsWith('image/');
              const isVideo = file.mimetype?.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(file.filetype || '');
              const isAudio = file.mimetype?.startsWith('audio/') || ['mp3', 'wav', 'aac', 'm4a'].includes(file.filetype || '');
              const isPdf = file.mimetype === 'application/pdf' || file.filetype === 'pdf';
              const isCode = ['java', 'javascript', 'typescript', 'python', 'cpp', 'c', 'html', 'css', 'react', 'node', 'markdown', 'sql', 'log', 'js', 'ts', 'py', 'cpp', 'html', 'css', 'md', 'sql'].includes(file.filetype || '');

              const sizeFriendly = file.size ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : '';
              
              const getProxyDownloadUrl = (f: any, download: boolean = false) => {
                const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                const token = getAuthToken() || '';
                const fileUrl = f.url_private_download || f.url_private || '';
                return `${BACKEND_URL}/api/files/${f.id}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(f.name || '')}${download ? '&download=true' : ''}`;
              };
              
              const downloadUrl = getProxyDownloadUrl(file);

              // 1. Image Lightbox trigger
              if (isImage) {
                return (
                  <div key={file.id} className="rounded-xl overflow-hidden border border-border/40 bg-card max-w-sm hover:border-primary/40 transition-all shadow-sm">
                    <img 
                      src={downloadUrl} 
                      alt={file.name} 
                      className="max-h-48 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity" 
                      onClick={() => onOpenImageLightbox(downloadUrl, file.name, file.size)}
                    />
                    <div className="p-2.5 text-[10px] text-muted-foreground border-t border-border/40 flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground/80">{file.name}</span>
                      {sizeFriendly && <span className="shrink-0">{sizeFriendly}</span>}
                    </div>
                  </div>
                );
              }

              // 2. Video Player trigger
              if (isVideo) {
                const durationMin = file.duration_ms ? Math.floor(file.duration_ms / 1000 / 60) : 0;
                const durationSec = file.duration_ms ? Math.floor((file.duration_ms / 1000) % 60).toString().padStart(2, '0') : '';
                const durationStr = file.duration_ms ? `${durationMin}:${durationSec}` : '';

                return (
                  <div 
                    key={file.id} 
                    onClick={() => onOpenVideoPlayer(downloadUrl, file.name, file.size)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-primary/40 transition-all cursor-pointer bg-card hover:bg-secondary/10"
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 relative overflow-hidden group/vid">
                      {file.thumb_video ? (
                        <img src={downloadUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileVideo className="w-5 h-5" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover/vid:opacity-100 transition-opacity">
                        <Play className="w-3 h-3 text-white fill-current" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate text-foreground">{file.name}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {sizeFriendly ? `${sizeFriendly} • ` : ''}Video
                        {durationStr ? ` (${durationStr})` : ''}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold text-primary hover:underline shrink-0 flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 fill-current" /> Play
                    </span>
                  </div>
                );
              }

              // 3. Audio Player inline
              if (isAudio) {
                return (
                  <div 
                    key={file.id} 
                    className="p-3.5 rounded-xl border border-border/30 bg-card flex items-center gap-3.5 max-w-sm hover:border-primary/30 transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <p className="text-[11px] font-semibold truncate text-foreground">{file.name}</p>
                      <p className="text-[9px] text-muted-foreground">{sizeFriendly ? `${sizeFriendly} • ` : ''}Audio File</p>
                      <audio src={downloadUrl} controls className="w-full h-6 mt-1 scale-95 origin-left" />
                    </div>
                  </div>
                );
              }

              // 4. PDF Viewer trigger
              if (isPdf) {
                return (
                  <div 
                    key={file.id} 
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card hover:bg-secondary/5 transition-all max-w-sm w-full"
                  >
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate text-foreground">{file.name}</p>
                      <p className="text-[9px] text-muted-foreground">{sizeFriendly ? `${sizeFriendly} • ` : ''}PDF Document</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 ml-1">
                      <button
                        onClick={() => onOpenPdfViewer(downloadUrl, file.name, file.size)}
                        className="text-[9px] font-bold text-primary hover:underline"
                      >
                        Open
                      </button>
                      <span className="text-muted-foreground/30 text-[10px]">|</span>
                      <a
                        href={getProxyDownloadUrl(file, true)}
                        download={file.name}
                        className="text-[9px] font-bold text-primary hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                );
              }

              // 5. Code Viewer trigger
              if (isCode) {
                return (
                  <div 
                    key={file.id} 
                    onClick={() => onOpenCodeViewer(file)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-primary/40 transition-all cursor-pointer bg-card hover:bg-secondary/10"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-500/10 text-slate-400 flex items-center justify-center shrink-0">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate text-foreground">{file.name}</p>
                      <p className="text-[9px] text-muted-foreground">{sizeFriendly ? `${sizeFriendly} • ` : ''}Source Code</p>
                    </div>
                    <span className="text-[9px] font-bold text-primary hover:underline shrink-0">View Code</span>
                  </div>
                );
              }

              // 6. Generic Files / Office docs / Word / Excel / PowerPoint
              let brandColorBg = 'bg-primary/10';
              let brandColorText = 'text-primary';
              let FileIcon: any = FileText;
              let fileTypeName = file.pretty_type || file.filetype || 'Document';

              if (['doc', 'docx'].includes(file.filetype || '')) {
                brandColorBg = 'bg-blue-500/10';
                brandColorText = 'text-blue-500';
                FileIcon = FileText;
                fileTypeName = 'Word Document';
              } else if (['xls', 'xlsx', 'csv'].includes(file.filetype || '')) {
                brandColorBg = 'bg-emerald-500/10';
                brandColorText = 'text-emerald-500';
                FileIcon = FileSpreadsheet;
                fileTypeName = 'Excel Spreadsheet';
              } else if (['ppt', 'pptx'].includes(file.filetype || '')) {
                brandColorBg = 'bg-orange-600/10';
                brandColorText = 'text-orange-600';
                FileIcon = Presentation;
                fileTypeName = 'PowerPoint Presentation';
              } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(file.filetype || '')) {
                brandColorBg = 'bg-amber-500/10';
                brandColorText = 'text-amber-500';
                FileIcon = FileArchive;
                fileTypeName = 'Compressed Archive';
              }

              const previewPdfUrl = file.converted_pdf
                ? (() => {
                    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                    const token = getAuthToken() || '';
                    const previewName = file.name ? (file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`) : 'preview.pdf';
                    return `${BACKEND_URL}/api/files/${file.id}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(file.converted_pdf)}&filename=${encodeURIComponent(previewName)}`;
                  })()
                : null;

              if (previewPdfUrl) {
                return (
                  <div 
                    key={file.id} 
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card hover:bg-secondary/5 transition-all max-w-sm w-full"
                  >
                    <div className={`w-10 h-10 rounded-lg ${brandColorBg} ${brandColorText} flex items-center justify-center shrink-0`}>
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate text-foreground">{file.name}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">{sizeFriendly ? `${sizeFriendly} • ` : ''}{fileTypeName}</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 ml-1">
                      <button
                        onClick={() => onOpenPdfViewer(previewPdfUrl, file.name, file.size, getProxyDownloadUrl(file, true), file.filetype)}
                        className="text-[9px] font-bold text-primary hover:underline"
                      >
                        Open
                      </button>
                      <span className="text-muted-foreground/30 text-[10px]">|</span>
                      <a
                        href={getProxyDownloadUrl(file, true)}
                        download={file.name}
                        className="text-[9px] font-bold text-primary hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                );
              }

              return (
                <a 
                  key={file.id}
                  href={getProxyDownloadUrl(file, true)} 
                  download={file.name}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-primary/30 transition-all bg-card hover:bg-secondary/5"
                >
                  <div className={`w-10 h-10 rounded-lg ${brandColorBg} ${brandColorText} flex items-center justify-center shrink-0`}>
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold truncate text-foreground">{file.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{sizeFriendly ? `${sizeFriendly} • ` : ''}{fileTypeName}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </a>
              );
            })}
          </div>
        )}

        {/* Reactions Bar list */}
        {Object.keys(reactionsMap).length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {Object.keys(reactionsMap).map(emoji => {
              const list = reactionsMap[emoji];
              const userReacted = user ? list.some(r => r.user_id === user.id) : false;
              const namesList = list.map(r => (user && r.user_id === user.id) ? 'You' : (slackUsers[r.user_id]?.realName || `User ${r.user_id}`)).join(', ');
              return (
                <div 
                  key={emoji}
                  onClick={() => handleToggleReaction(msg.ts, emoji, msg.text, msg.user)}
                  className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                    userReacted 
                      ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-sm' 
                      : 'bg-secondary/10 border-border/30 hover:bg-secondary/20 text-muted-foreground'
                  }`}
                  title={`Reacted by: ${namesList}`}
                >
                  <span>{emoji}</span>
                  <span>{list.length}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Thread Replies count link */}
        {msg.replyCount && msg.replyCount > 0 ? (
          <button
            type="button"
            onClick={() => setActiveThreadParentId(msg.ts)}
            className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1 mt-1.5"
          >
            <MessageSquare className="w-3 h-3" />
            {msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        ) : null}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.msg.ts === nextProps.msg.ts &&
         prevProps.msg.text === nextProps.msg.text &&
         prevProps.msg.isPinned === nextProps.msg.isPinned &&
         prevProps.msg.isBookmarked === nextProps.msg.isBookmarked &&
         JSON.stringify(prevProps.msg.reactions) === JSON.stringify(nextProps.msg.reactions) &&
         (prevProps.activeEmojiPickerMsgId === prevProps.msg.ts) === (nextProps.activeEmojiPickerMsgId === nextProps.msg.ts) &&
         (prevProps.openedMenuMessageId === prevProps.msg.ts) === (nextProps.openedMenuMessageId === nextProps.msg.ts) &&
         (prevProps.hoveredMessageId === prevProps.msg.ts) === (nextProps.hoveredMessageId === nextProps.msg.ts);
});
