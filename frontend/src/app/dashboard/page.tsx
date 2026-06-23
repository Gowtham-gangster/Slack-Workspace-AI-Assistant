'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import { apiFetch } from '../../lib/api';
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

interface LiveMessage { ts: string; user: string; text: string; }

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

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="flex items-start gap-3 p-3.5 rounded-2xl animate-fadeIn"
       style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
    <p className="text-[12px] leading-relaxed" style={{ color: '#fca5a5' }}>{message}</p>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="py-10 text-center rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
    <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
         style={{ background: 'rgba(255,255,255,0.03)' }}>
      <Sparkles className="w-5 h-5" style={{ color: '#374151' }} />
    </div>
    <p className="text-[12px]" style={{ color: '#4b5563' }}>{text}</p>
  </div>
);

/* ─────────────────── main page ─────────────────── */
export default function DashboardPage() {
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

  const getUserAvatar = (userId: string) => {
    return slackUsers[userId]?.avatar || '';
  };
  const queryClient = useQueryClient();
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboardStats'],
    queryFn: () => apiFetch('/api/dashboard/stats'),
    refetchInterval: 15000,
  });

  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['channelsList'],
    queryFn: () => apiFetch('/api/channels'),
  });

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
    const c = messagesEndRef.current?.parentElement;
    if (c) c.scrollTop = c.scrollHeight;
  }, [liveMessages]);

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

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() || !selectedChannelId || posting) return;
    setPosting(true); setPostStatus(null);
    try {
      await apiFetch(`/api/channels/${selectedChannelId}/messages`, { method: 'POST', body: { text: postText.trim() } });
      setPostText(''); setPostStatus('success');
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
    setLoadingSummary(true); setSummaryError(null); setSummaryText(null);
    try { const d = await apiFetch(`/api/channels/${selectedChannelId}/summarize`); setSummaryText(d.summary); }
    catch (err: any) { setSummaryError(err?.message || 'Failed to generate summary.'); }
    finally { setLoadingSummary(false); }
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
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* Ambient orbs */}
      <div className="bg-orb w-[600px] h-[600px] opacity-[0.06]"
           style={{ background: '#7c6af7', top: '-200px', left: '180px' }} />
      <div className="bg-orb w-[400px] h-[400px] opacity-[0.04]"
           style={{ background: '#0ea5e9', bottom: '-100px', right: '100px' }} />

      <Sidebar />

      {/* Main scroll area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto relative z-10">

        {/* ── Top bar ── */}
        <header className="h-14 shrink-0 flex items-center justify-between px-8 sticky top-0 z-20"
                style={{
                  background: isLightMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(6,7,13,0.85)',
                  backdropFilter: 'blur(16px)',
                  borderBottom: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)'
                }}>
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4" style={{ color: '#7c6af7' }} />
            <span className={`text-[13px] font-semibold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Assistant Overview</span>
            <div className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                 style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
              Live
            </div>
          </div>

          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all duration-200 disabled:opacity-50"
            style={{
              background: syncing ? 'rgba(124,106,247,0.2)' : 'linear-gradient(135deg, #7c6af7, #6366f1)',
              border: '1px solid rgba(124,106,247,0.4)',
              boxShadow: syncing ? 'none' : '0 4px 16px rgba(124,106,247,0.25)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Workspace'}
          </button>
        </header>

        {/* ── Content ── */}
        <div className="p-7 space-y-7 max-w-6xl w-full mx-auto pb-16">

          {/* Notifications */}
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
            <div className="flex items-center justify-between px-6 py-4"
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
              <div className="flex items-center gap-2">
                <select
                  value={fetchLimit}
                  onChange={e => setFetchLimit(Number(e.target.value))}
                  className={`glass-input px-3 py-2 rounded-xl text-[12px] cursor-pointer ${isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'}`}
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
                  className={`glass-input px-3 py-2 rounded-xl text-[12px] cursor-pointer ${isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'}`}
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
              </div>
            </div>

            {/* Filter bar */}
            <div className="px-6 pt-4 pb-2">
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
            <div className="px-6 pb-4 h-[340px] overflow-y-auto space-y-2.5 pt-2">
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
                  const avatar = getUserAvatar(msg.user);
                  return (
                    <div key={idx} className="msg-bubble flex gap-3 items-start px-3 py-2.5 rounded-xl cursor-default">
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
                          <span className={`text-[11px] font-semibold font-sans ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{getUserDisplayName(msg.user)}</span>
                          <span className="text-[9px]" style={{ color: isLightMode ? '#6b7280' : '#4b5563' }}>{fmtDate(msg.ts)} {fmtTime(msg.ts)}</span>
                        </div>
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: isLightMode ? '#334155' : '#d1d5db' }}>{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Post message */}
            <div className="px-6 pb-5">
              <form onSubmit={handlePostMessage}
                    className="flex items-center gap-2.5 p-1.5 rounded-2xl relative"
                    style={{
                      background: isLightMode ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.03)',
                      border: isLightMode ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ml-1"
                     style={{ background: 'rgba(124,106,247,0.15)' }}>
                  <Send className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                </div>
                <input
                  type="text"
                  required
                  placeholder={`Message #${currentChannelName}…`}
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  disabled={posting}
                  className={`flex-1 bg-transparent text-[13px] outline-none py-2 ${isLightMode ? 'text-slate-800 placeholder:text-slate-400' : 'text-white placeholder:text-[#374151]'}`}
                />
                <button
                  type="submit"
                  disabled={posting || !postText.trim()}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #7c6af7, #6366f1)',
                    boxShadow: '0 2px 12px rgba(124,106,247,0.3)',
                  }}
                >
                  {posting ? 'Sending…' : 'Send'}
                </button>
              </form>

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
      </main>
    </div>
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
