'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import MobileBottomBar from '../../components/MobileBottomBar';
import { apiFetch } from '../../lib/api';
import AIErrorAlert from '../../components/AIErrorAlert';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Briefcase,
  Layers,
  ChevronRight,
  Info,
  Copy,
  Download,
  BarChart3,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from '../../components/ThemeContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

interface Report {
  id: string;
  title: string;
  content: string;
  type: 'daily' | 'weekly' | 'meeting' | 'sentiment' | 'action_item' | 'executive' | 'productivity' | 'risk' | 'project';
  channel_id: string;
  metadata: string; // JSON string
  created_at: string;
}

interface Channel {
  id: string;
  name: string;
}

// Simple custom Markdown to HTML renderer for rendering generated report markdown
function renderMarkdown(md: string, isLightMode: boolean) {
  if (!md) return '';
  
  let html = md
    // Escape HTML tags to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, `<h4 class="text-xs font-bold mt-4 mb-2 uppercase tracking-wide ${isLightMode ? 'text-slate-800' : 'text-white'}">$1</h4>`)
    .replace(/^## (.*$)/gim, '<h3 class="text-sm font-bold text-primary mt-6 mb-2 border-b border-border/40 pb-1">$1</h3>')
    .replace(/^# (.*$)/gim, `<h2 class="text-base font-bold mt-8 mb-3 ${isLightMode ? 'text-slate-800' : 'text-white'}">$1</h2>`)
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, `<strong class="font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}">$1</strong>`)
    // Lists
    .replace(/^\* (.*$)/gim, `<li class="ml-4 list-disc pl-1 py-0.5 text-xs ${isLightMode ? 'text-slate-600' : 'text-slate-300'}">$1</li>`)
    .replace(/^- (.*$)/gim, `<li class="ml-4 list-disc pl-1 py-0.5 text-xs ${isLightMode ? 'text-slate-600' : 'text-slate-300'}">$1</li>`)
    // Tables (Very basic Markdown table to HTML converter)
    .replace(/\|(.+)\|/gim, (match, cells: string) => {
      const isHeaderRow = cells.includes('---');
      if (isHeaderRow) return '';
      
      const cols = cells.split('|').map(c => c.trim()).filter(c => c !== '');
      return `<tr class="border-b ${isLightMode ? 'border-slate-200 hover:bg-slate-50' : 'border-border/40 hover:bg-secondary/15'}"><td class="px-4 py-2 text-xs ${isLightMode ? 'text-slate-600 font-medium' : 'text-slate-300'}">${cols.join(`</td><td class="px-4 py-2 text-xs ${isLightMode ? 'text-slate-600 font-medium' : 'text-slate-300'}">`)}</td></tr>`;
    });

  // Wrap table rows in a table tag
  html = html.replace(/(<tr[\s\S]+?<\/tr>)/g, `<table class="w-full text-left border-collapse border my-4 rounded-2xl overflow-hidden ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-border/40 bg-black/10'}">$1</table>`);
  // Combine consecutive table tags
  html = html.replace(/<\/table>\s*<table[^>]*>/g, '');

  // Add line breaks for double newlines (paragraphs)
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('<li') || p.trim().startsWith('<table') || p.trim().startsWith('<h') || p.trim().startsWith('<tr')) {
      return p;
    }
    return `<p class="text-xs leading-relaxed mb-3 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return html;
}

function ReportsPageContent() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const reportUrlId = searchParams.get('id');

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'report' | 'analytics'>('analytics');
  const [formData, setFormData] = useState({
    channelId: '',
    type: 'weekly',
    title: ''
  });
  const [genError, setGenError] = useState<string | null>(null);

  // Fetch Analytics Data
  const { data: volumeData } = useQuery<any[]>({
    queryKey: ['messageVolume'],
    queryFn: () => apiFetch('/api/analytics/message-volume'),
  });

  const { data: activeChannelsData } = useQuery<any[]>({
    queryKey: ['channelActivity'],
    queryFn: () => apiFetch('/api/analytics/channel-activity'),
  });

  const { data: taskStatusData } = useQuery<any>({
    queryKey: ['taskCompletionStats'],
    queryFn: () => apiFetch('/api/analytics/task-completion'),
  });

  // Fetch reports list
  const { data: reports, isLoading: isReportsLoading } = useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: () => apiFetch('/api/reports')
  });

  // Fetch channels list for the creation dropdown
  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => apiFetch('/api/channels')
  });

  // Sync state with URL parameter if present
  useEffect(() => {
    if (reportUrlId) {
      setSelectedReportId(reportUrlId);
    } else if (reports && reports.length > 0 && !selectedReportId) {
      setSelectedReportId(reports[0].id);
    }
  }, [reportUrlId, reports]);

  // Mutation to generate report
  const generateMutation = useMutation({
    mutationFn: (data: typeof formData) => apiFetch('/api/reports/generate', {
      method: 'POST',
      body: data
    }),
    onMutate: () => {
      setGenError(null);
    },
    onSuccess: (newReport) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setSelectedReportId(newReport.id);
      setShowCreateModal(false);
      setFormData({ channelId: '', type: 'weekly', title: '' });
    },
    onError: (err: any) => {
      setGenError(err?.message || 'Failed to generate report.');
    }
  });

  // Mutation to delete report
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reports/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      if (selectedReportId === deletedId) {
        setSelectedReportId(null);
      }
    }
  });

  const selectedReport = reports?.find(r => r.id === selectedReportId);

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting': return Briefcase;
      case 'sentiment': return TrendingUp;
      case 'weekly': return Layers;
      case 'executive': return Layers;
      case 'productivity': return BarChart3;
      case 'risk': return AlertCircle;
      case 'project': return Briefcase;
      default: return Calendar;
    }
  };

  const getReportBadgeStyle = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'sentiment': return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
      case 'action_item': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'weekly': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'executive': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'productivity': return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
      case 'risk': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'project': return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      default: return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  const copyToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt);
    alert('Report markdown copied to clipboard!');
  };

  const downloadMarkdownFile = (title: string, txt: string) => {
    const blob = new Blob([txt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMetadata = (report: Report) => {
    try {
      return JSON.parse(report.metadata);
    } catch (e) {
      return {};
    }
  };

  // Sync mode if report is selected
  useEffect(() => {
    if (selectedReportId) {
      setViewMode('report');
    }
  }, [selectedReportId]);

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar Nav */}
      <Sidebar />

      {/* Main Panel - Split screen layout */}
      <div className="flex-1 flex h-full overflow-hidden">
        
        {/* Left Side: Reports List (1/3 width) */}
        <div className="w-80 border-r border-border flex flex-col h-full bg-card/10 shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Reports & Charts</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedReportId(null);
                  setViewMode('analytics');
                }}
                className={`p-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  viewMode === 'analytics' && !selectedReportId
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/15'
                }`}
                title="View Workspace Charts"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white transition-all shadow-md shadow-primary/10"
                title="Generate New Report"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Viewport */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isReportsLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-16 bg-secondary/15 rounded-xl animate-pulse" />
                <div className="h-16 bg-secondary/15 rounded-xl animate-pulse" />
              </div>
            ) : !reports || reports.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground px-4">
                No reports saved yet. Click the '+' button to generate your first analysis.
              </div>
            ) : (
              reports.map(report => {
                const Icon = getReportTypeIcon(report.type);
                const isActive = report.id === selectedReportId;
                const meta = getMetadata(report);
                return (
                  <div
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setViewMode('report');
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isActive 
                        ? (isLightMode ? 'bg-slate-100 border-primary shadow-sm' : 'bg-secondary/40 border-primary shadow-sm') 
                        : (isLightMode ? 'bg-white border-slate-200/60 hover:bg-slate-50/50' : 'bg-secondary/10 border-border/40 hover:bg-secondary/20')
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isActive ? 'bg-primary/20 text-primary' : 'bg-secondary/30 text-muted-foreground'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${isActive ? (isLightMode ? 'text-primary font-bold' : 'text-white') : (isLightMode ? 'text-slate-700' : 'text-slate-350')}`}>{report.title}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{meta.channelName || 'Slack Channel'}</p>
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getReportBadgeStyle(report.type)}`}>
                          {report.type}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-3" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Content Area */}
        <div className="flex-1 flex flex-col h-full bg-card/5 overflow-hidden">
          {selectedReport && viewMode === 'report' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden animate-fadeIn">
              {/* Toolbar */}
              <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0 bg-card/20">
                <div className="min-w-0 pr-4">
                  <h2 className={`text-sm font-bold truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{selectedReport.title}</h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span>Generated on {new Date(selectedReport.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span className="capitalize">{selectedReport.type} analysis</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(selectedReport.content)}
                    className={`p-2 border rounded-xl hover:bg-secondary/15 transition-all text-xs flex items-center gap-1 ${
                      isLightMode ? 'border-slate-200 text-slate-700 bg-white' : 'border-border/50 text-slate-350'
                    }`}
                    title="Copy Markdown"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </button>
                  <button
                    onClick={() => downloadMarkdownFile(selectedReport.title, selectedReport.content)}
                    className={`p-2 border rounded-xl hover:bg-secondary/15 transition-all text-xs flex items-center gap-1 ${
                      isLightMode ? 'border-slate-200 text-slate-700 bg-white' : 'border-border/50 text-slate-350'
                    }`}
                    title="Download Markdown"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(selectedReport.id)}
                    disabled={deleteMutation.isPending}
                    className={`p-2 rounded-xl border transition-all ${
                      isLightMode
                        ? 'text-red-600 hover:bg-red-50 hover:border-red-200 border-slate-200'
                        : 'text-red-400 hover:bg-red-500/10 border-border/50 hover:border-red-500/25'
                    }`}
                    title="Delete Report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* Viewer body */}
              <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto">
                {/* Meta Summary Card */}
                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-4 ${
                  isLightMode ? 'bg-slate-50 border border-slate-200/60' : 'bg-secondary/10 border border-border/40'
                }`}>
                  <Info className="w-5 h-5 text-primary shrink-0" />
                  <div className={`text-[11px] leading-normal ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                    This report summarizes <span className={`font-semibold ${isLightMode ? 'text-slate-800 font-bold' : 'text-white'}`}>{getMetadata(selectedReport).messageCount || 'multiple'} Slack messages</span> from channel <span className={`font-semibold ${isLightMode ? 'text-slate-800 font-bold' : 'text-white'}`}>{getMetadata(selectedReport).channelName || 'Workspace'}</span>. The content is locally indexed in your assistant's RAG layer for semantic search.
                  </div>
                </div>

                {/* Main Markdown Content */}
                <article 
                  className={`prose max-w-none ${isLightMode ? 'prose-slate text-slate-800' : 'prose-invert text-slate-200'}`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedReport.content, isLightMode) }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 max-w-5xl w-full mx-auto animate-fadeIn">
              <div className="mb-6">
                <h2 className={`text-base font-bold flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                  <BarChart3 className="w-5 h-5 text-[#7c6af7]" />
                  Advanced Workspace Analytics
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Global visualization of communication volume, channel activity, and action completion rates</p>
              </div>

              {/* Grid of charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                
                {/* Chart 1: Message Volume Trend */}
                <div className={`p-5 rounded-3xl border flex flex-col min-h-[280px] ${isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.02] border-white/[0.07]'}`}>
                  <h3 className={`text-xs font-bold mb-4 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: '#7c6af7' }} />
                    Message Volume (Last 30 Days)
                  </h3>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={volumeData || []}>
                        <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickFormatter={(str) => {
                          try { return new Date(str).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch { return ''; }
                        }} />
                        <YAxis stroke="#64748b" fontSize={9} />
                        <Tooltip contentStyle={{ background: isLightMode ? '#fff' : '#111322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} labelStyle={{ fontSize: '10px', color: '#9ca3af' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        <Line type="monotone" dataKey="count" name="Messages" stroke="#7c6af7" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Channel Activity */}
                <div className={`p-5 rounded-3xl border flex flex-col min-h-[280px] ${isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.02] border-white/[0.07]'}`}>
                  <h3 className={`text-xs font-bold mb-4 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    <Layers className="w-3.5 h-3.5" style={{ color: '#0ea5e9' }} />
                    Top Active Channels
                  </h3>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeChannelsData || []} layout="vertical">
                        <XAxis type="number" stroke="#64748b" fontSize={9} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={9} width={60} />
                        <Tooltip contentStyle={{ background: isLightMode ? '#fff' : '#111322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        <Bar dataKey="message_count" name="Messages" radius={[0, 4, 4, 0]}>
                          {(activeChannelsData || []).map((_, index) => {
                            const colors = ['#7c6af7', '#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Task Completion Rate */}
                <div className={`p-5 rounded-3xl border flex flex-col min-h-[280px] md:col-span-2 ${isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.02] border-white/[0.07]'}`}>
                  <h3 className={`text-xs font-bold mb-4 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
                    Action Items Completion Rate
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 flex-1 min-h-[200px]">
                    <div className="w-48 h-48 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Pending', value: taskStatusData?.pending || 0, color: '#f59e0b' },
                              { name: 'In Progress', value: taskStatusData?.in_progress || 0, color: '#6366f1' },
                              { name: 'Completed', value: taskStatusData?.completed || 0, color: '#10b981' }
                            ].filter(item => item.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {[
                              { name: 'Pending', value: taskStatusData?.pending || 0, color: '#f59e0b' },
                              { name: 'In Progress', value: taskStatusData?.in_progress || 0, color: '#6366f1' },
                              { name: 'Completed', value: taskStatusData?.completed || 0, color: '#10b981' }
                            ].filter(item => item.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: isLightMode ? '#fff' : '#111322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3 flex-1 max-w-xs">
                      {[
                        { label: 'Pending tasks', val: taskStatusData?.pending || 0, color: '#f59e0b' },
                        { label: 'Tasks in progress', val: taskStatusData?.in_progress || 0, color: '#6366f1' },
                        { label: 'Completed tasks', val: taskStatusData?.completed || 0, color: '#10b981' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-2" style={{ color: isLightMode ? '#64748b' : '#9ca3af' }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                            {item.label}
                          </span>
                          <span className={isLightMode ? 'text-slate-800' : 'text-white'}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg glass p-6 rounded-3xl shadow-2xl relative animate-scale-up">
            <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
              <Plus className="w-4 h-4 text-primary" />
              Generate Workspace Report
            </h3>

            {genError && (
              <AIErrorAlert
                error={genError}
                onRetry={() => generateMutation.mutate(formData)}
                className="mb-4"
              />
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              generateMutation.mutate(formData);
            }} className="space-y-4">
              
              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                  Select Slack Channel
                </label>
                <select
                  required
                  value={formData.channelId}
                  onChange={(e) => setFormData(prev => ({ ...prev, channelId: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                    isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'
                  }`}
                >
                  <option value="">-- Choose Channel --</option>
                  {channels?.map(ch => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                  Analysis Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                    isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'
                  }`}
                >
                  <option value="daily">Daily Summary Report</option>
                  <option value="weekly">Weekly Summary Report</option>
                  <option value="meeting">Meeting Notes & Decisions</option>
                  <option value="sentiment">Sentiment Trends Analysis</option>
                  <option value="action_item">Action Items & Task Tracker</option>
                  <option value="executive">Executive Summary Report</option>
                  <option value="productivity">Team Productivity Report</option>
                  <option value="risk">Risk & Blockers Assessment</option>
                  <option value="project">Project Status & Roadmap</option>
                </select>
              </div>

              {/* Optional Custom Title */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                  Report Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for default title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                    isLightMode ? 'text-slate-800 bg-slate-100/50 border-slate-200' : 'text-white'
                  }`}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    isLightMode 
                      ? 'border-slate-200 text-slate-600 hover:bg-slate-50' 
                      : 'border-border/60 text-slate-300 hover:bg-secondary/40'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-md shadow-primary/10 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {generateMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Slack...
                    </>
                  ) : (
                    'Generate Report'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MobileBottomBar />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    }>
      <ReportsPageContent />
    </Suspense>
  );
}
