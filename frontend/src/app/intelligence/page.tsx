'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AppLayout from '../../components/AppLayout';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import AIErrorAlert from '../../components/AIErrorAlert';
import {
  Brain, TrendingUp, TrendingDown, Users, BarChart3,
  Smile, Meh, Frown, Activity, RefreshCw, Hash,
  AlertCircle, ChevronRight, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const categoryColors: Record<string, string> = {
  Deployment: '#7c6af7', Testing: '#6366f1', 'API Integration': '#8b5cf6',
  Database: '#0ea5e9', Security: '#f59e0b', Performance: '#ef4444',
  Meetings: '#10b981', Documentation: '#14b8a6', Infrastructure: '#ec4899',
  'Bug Fixes': '#f97316',
};

export default function IntelligencePage() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const [selectedChannel, setSelectedChannel] = useState('');
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  const { data: channels } = useQuery<any[]>({
    queryKey: ['channelsList'],
    queryFn: () => apiFetch('/api/channels'),
  });

  const { data: topics, isLoading: topicsLoading } = useQuery<any[]>({
    queryKey: ['intelligenceTopics'],
    queryFn: () => apiFetch('/api/intelligence/topics'),
  });

  const { data: teamActivity, isLoading: teamLoading } = useQuery<any[]>({
    queryKey: ['teamActivity'],
    queryFn: () => apiFetch('/api/intelligence/team-activity'),
  });

  const { data: channelHealth, isLoading: healthLoading } = useQuery<any[]>({
    queryKey: ['channelHealth'],
    queryFn: () => apiFetch('/api/intelligence/channel-health'),
  });

  const handleSentimentAnalysis = async () => {
    if (!selectedChannel || analyzingSentiment) return;
    setAnalyzingSentiment(true);
    setSentimentError(null);
    setSentimentData(null);
    try {
      const d = await apiFetch('/api/intelligence/sentiment', {
        method: 'POST',
        body: { channelId: selectedChannel },
      });
      setSentimentData(d);
    } catch (err: any) {
      setSentimentError(err?.message || 'Failed to analyze sentiment.');
    } finally {
      setAnalyzingSentiment(false);
    }
  };

  const card = `rounded-2xl border transition-all ${isLightMode
    ? 'bg-white border-slate-200/80 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.07]'}`;

  const healthColor = (h: string) =>
    h === 'active' ? '#10b981' : h === 'moderate' ? '#f59e0b' : '#6b7280';

  return (
    <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', boxShadow: '0 4px 16px rgba(124,106,247,0.35)' }}>
                <Brain className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Workspace Intelligence</h1>
                <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>AI-powered insights from your Slack workspace</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Trending Topics ── */}
            <div className={`${card} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4" style={{ color: '#7c6af7' }} />
                <h2 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Trending Topics</h2>
              </div>
              {topicsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                  ))}
                </div>
              ) : !topics?.length ? (
                <p className="text-sm text-center py-8" style={{ color: '#6b7280' }}>Sync workspace to see trending topics</p>
              ) : (
                <div className="space-y-2">
                  {topics.slice(0, 8).map((t: any) => (
                    <div key={t.topic} className="flex items-center gap-3 p-2.5 rounded-xl group transition-all"
                         style={{ background: isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryColors[t.topic] || '#7c6af7' }} />
                      <span className={`text-sm font-medium flex-1 ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>{t.topic}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,106,247,0.12)', color: '#7c6af7' }}>{t.count}</span>
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${t.trend > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                        {t.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(t.trend)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Team Activity ── */}
            <div className={`${card} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4" style={{ color: '#7c6af7' }} />
                <h2 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Team Activity</h2>
              </div>
              {teamLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                  ))}
                </div>
              ) : !teamActivity?.length ? (
                <p className="text-sm text-center py-8" style={{ color: '#6b7280' }}>Sync workspace to see team activity</p>
              ) : (
                <div className="space-y-2">
                  {teamActivity.slice(0, 8).map((m: any, i: number) => {
                    const colors = ['#7c6af7', '#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#10b981'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={m.userId} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                             style={{ background: color }}>
                          {(m.name || m.userId).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className={`text-xs font-medium truncate ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                              {m.name || m.userId}
                            </span>
                            <span className="text-xs" style={{ color: '#9ca3af' }}>{m.contribution}%</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }}>
                            <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${m.contribution}%`, background: color }} />
                          </div>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{m.messageCount}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Sentiment Analysis ── */}
            <div className={`${card} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <Smile className="w-4 h-4" style={{ color: '#7c6af7' }} />
                <h2 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Sentiment Analysis</h2>
              </div>

              <div className="flex gap-2 mb-4">
                <select
                  value={selectedChannel}
                  onChange={e => setSelectedChannel(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm border outline-none ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.05] border-white/[0.1] text-slate-200'}`}
                >
                  <option value="">Select a channel…</option>
                  {channels?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleSentimentAnalysis}
                  disabled={!selectedChannel || analyzingSentiment}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)' }}
                >
                  {analyzingSentiment ? (
                    <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  Analyze
                </button>
              </div>

              {sentimentError && (
                <AIErrorAlert
                  error={sentimentError}
                  onRetry={handleSentimentAnalysis}
                  className="mb-4"
                />
              )}

              {sentimentData ? (
                <div>
                  <div className="flex justify-center mb-4">
                    <div className="relative w-24 h-24">
                      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                                stroke={isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)'} />
                        <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                                stroke={sentimentData.score >= 70 ? '#10b981' : sentimentData.score >= 40 ? '#f59e0b' : '#ef4444'}
                                strokeDasharray={`${sentimentData.score} ${100 - sentimentData.score}`}
                                strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{sentimentData.score}</span>
                        <span className="text-[9px]" style={{ color: '#9ca3af' }}>score</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Positive', value: sentimentData.positive, icon: Smile, color: '#10b981' },
                      { label: 'Neutral', value: sentimentData.neutral, icon: Meh, color: '#f59e0b' },
                      { label: 'Negative', value: sentimentData.negative, icon: Frown, color: '#ef4444' },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2.5 rounded-xl" style={{ background: isLightMode ? '#f8fafc' : 'rgba(255,255,255,0.03)' }}>
                        <s.icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
                        <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}%</div>
                        <div className="text-[9px]" style={{ color: '#9ca3af' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {sentimentData.summary && (
                    <p className="text-xs italic text-center" style={{ color: '#9ca3af' }}>"{sentimentData.summary}"</p>
                  )}
                </div>
              ) : !analyzingSentiment && (
                <div className="text-center py-6">
                  <Smile className="w-8 h-8 mx-auto mb-2" style={{ color: '#374151' }} />
                  <p className="text-xs" style={{ color: '#6b7280' }}>Select a channel and click Analyze</p>
                </div>
              )}
            </div>

            {/* ── Channel Health ── */}
            <div className={`${card} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4" style={{ color: '#7c6af7' }} />
                <h2 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Channel Health</h2>
              </div>
              {healthLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                  ))}
                </div>
              ) : !channelHealth?.length ? (
                <p className="text-sm text-center py-8" style={{ color: '#6b7280' }}>Sync workspace to see channel health</p>
              ) : (
                <div className="space-y-2">
                  {channelHealth.slice(0, 8).map((ch: any) => (
                    <div key={ch.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                         style={{ background: isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}>
                      <Hash className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c6af7' }} />
                      <span className={`text-xs font-medium flex-1 truncate ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>{ch.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${healthColor(ch.health)}15`, color: healthColor(ch.health) }}>
                        {ch.health}
                      </span>
                      <div className="w-16 h-1.5 rounded-full" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${ch.engagementScore}%`, background: healthColor(ch.health) }} />
                      </div>
                      <span className="text-[10px] shrink-0 font-medium" style={{ color: '#9ca3af' }}>{ch.engagementScore}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
    </AppLayout>
  );
}
