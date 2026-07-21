'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../../components/AppLayout';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import { Clock, Hash, AlertCircle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import AIErrorAlert from '../../components/AIErrorAlert';

const CATEGORY_CONFIG: Record<string, { color: string; bg: string }> = {
  Deployment:     { color: '#7c6af7', bg: 'rgba(124,106,247,0.12)' },
  Testing:        { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  Bug:            { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  Decision:       { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  Meeting:        { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  Task:           { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Discussion:     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  Infrastructure: { color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  Alert:          { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  Update:         { color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
};

const avatarColor = (id: string) => {
  const colors = ['#7c6af7','#6366f1','#8b5cf6','#0ea5e9','#14b8a6','#f59e0b','#ec4899','#10b981'];
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
};

export default function TimelinePage() {
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
  const [selectedChannel, setSelectedChannel] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

  const { data: channels } = useQuery<any[]>({
    queryKey: ['channelsList'],
    queryFn: () => apiFetch('/api/channels'),
  });

  const { data: events, isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ['timeline', selectedChannel, limit],
    queryFn: () => apiFetch(`/api/timeline/${selectedChannel}?limit=${limit}`),
    enabled: !!selectedChannel,
  });

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch { return ''; }
  };

  return (
    <AppLayout>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', boxShadow: '0 4px 16px rgba(124,106,247,0.35)' }}>
                <Clock className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Activity Timeline</h1>
                <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>AI-generated timeline from Slack conversations</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className={`flex gap-3 mb-8 p-4 rounded-2xl border ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'}`}>
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
              <select
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none appearance-none ${
                  isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.05] border-white/[0.1] text-slate-200'
                }`}
              >
                <option value="">Select a channel to generate timeline…</option>
                {channels?.map((c: any) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className={`px-3 py-2.5 rounded-xl text-sm border outline-none ${
                isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.05] border-white/[0.1] text-slate-200'
              }`}
            >
              <option value={20}>Last 20 msgs</option>
              <option value={40}>Last 40 msgs</option>
              <option value={80}>Last 80 msgs</option>
            </select>
            {selectedChannel && (
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)' }}
              >
                <Zap className="w-3 h-3" />
                Generate
              </button>
            )}
          </div>

          {/* Timeline */}
          {!selectedChannel && (
            <div className={`text-center py-20 rounded-2xl border ${isLightMode ? 'border-slate-200 bg-white' : 'border-white/[0.07] bg-white/[0.02]'}`}>
              <Clock className="w-12 h-12 mx-auto mb-4" style={{ color: '#374151' }} />
              <p className={`text-base font-medium mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Select a Channel</p>
              <p className="text-sm" style={{ color: '#6b7280' }}>Choose a Slack channel to generate an AI activity timeline</p>
            </div>
          )}

          {isLoading && selectedChannel && (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-12 h-4 rounded mt-1" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.12)' }} />
                    <div className="w-0.5 h-16 mt-1" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.05)' }} />
                  </div>
                  <div className="flex-1 h-16 rounded-xl" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                </div>
              ))}
            </div>
          )}

          {error && (
            <AIErrorAlert
              error={error as any}
              onRetry={refetch}
              className="mb-6"
            />
          )}

          {events && events.length === 0 && selectedChannel && !isLoading && (
            <div className={`text-center py-16 rounded-2xl border ${isLightMode ? 'border-slate-200 bg-white' : 'border-white/[0.07] bg-white/[0.02]'}`}>
              <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: '#374151' }} />
              <p className="text-sm" style={{ color: '#6b7280' }}>No significant events found in this channel</p>
            </div>
          )}

          {events && events.length > 0 && (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[5.5rem] top-0 bottom-0 w-px"
                   style={{ background: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }} />

              <div className="space-y-4">
                {events.map((ev: any, i: number) => {
                  const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.Discussion;
                  const isExpanded = expandedId === ev.id;
                  return (
                    <div key={ev.id || i} className="flex gap-4 items-start group">
                      {/* Time */}
                      <div className="w-20 shrink-0 text-right pt-3">
                        <span className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>{fmtTime(ev.timestamp)}</span>
                        <div className="text-[9px]" style={{ color: '#6b7280' }}>{fmtDate(ev.timestamp)}</div>
                      </div>

                      {/* Dot */}
                      <div className="relative z-10 shrink-0 mt-3">
                        <div className="w-3 h-3 rounded-full ring-4 transition-all group-hover:scale-125"
                             style={{
                               background: cfg.color,
                               boxShadow: `0 0 0 4px ${isLightMode ? '#f8fafc' : '#06070d'}`,
                             }} />
                      </div>

                      {/* Card */}
                      <div
                        className={`flex-1 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                          isLightMode ? 'bg-white border-slate-200 hover:shadow-md' : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]'
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Avatar */}
                            {getUserAvatar(ev.userId) ? (
                              <img src={getUserAvatar(ev.userId)} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                   style={{ background: avatarColor(ev.userId || 'U') }}>
                                {getUserInitials(ev.userId)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{ background: cfg.bg, color: cfg.color }}>
                                  {ev.category}
                                </span>
                                <span className="text-[10px] font-medium animate-fadeIn" style={{ color: isLightMode ? '#6b7280' : '#9ca3af' }}>
                                  by {getUserDisplayName(ev.userId)}
                                </span>
                              </div>
                              <p className={`text-sm font-semibold leading-snug ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                                {ev.title}
                              </p>
                              <p className={`text-xs mt-0.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                {ev.description}
                              </p>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
                                       : <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />}
                        </div>
                        {isExpanded && ev.rawText && (
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                            <p className="text-xs italic" style={{ color: '#9ca3af' }}>"{ev.rawText.slice(0, 200)}{ev.rawText.length > 200 ? '…' : ''}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </AppLayout>
  );
}
