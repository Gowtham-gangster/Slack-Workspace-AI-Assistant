'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import {
  BookOpen, Search, Sparkles, CheckCircle2, AlertTriangle, Users,
  Clock, ClipboardList, Info, HelpCircle, ArrowRight
} from 'lucide-react';

interface MemoryResult {
  summary: string;
  decisions: string[];
  participants: string[];
  tasks: Array<{ task: string; owner: string }>;
  risks: string[];
  timeline: Array<{ time: string; event: string }>;
}

const EXAMPLE_PROMPTS = [
  "What decisions were made about deployment recently?",
  "Who participated in testing discussion and what tasks are assigned?",
  "List the main risks or blockers discussed this week",
  "Summarize key updates from meeting standups",
];

export default function WorkspaceMemoryPage() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const { slackUsers } = useAuth();

  const getUserDisplayName = (userId: string) => {
    return slackUsers[userId]?.realName || userId;
  };

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'decisions' | 'tasks' | 'timeline'>('summary');
  const [result, setResult] = useState<MemoryResult | null>(null);

  // Mutation to ask questions to Workspace Memory
  const queryMutation = useMutation<MemoryResult, Error, string>({
    mutationFn: (queryString) =>
      apiFetch('/api/memory/query', {
        method: 'POST',
        body: { query: queryString },
      }),
    onSuccess: (data) => {
      setResult(data);
      setActiveTab('summary');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || queryMutation.isPending) return;
    queryMutation.mutate(query);
  };

  const handleSelectExample = (prompt: string) => {
    setQuery(prompt);
    queryMutation.mutate(prompt);
  };

  const cardStyle = `rounded-2xl border transition-all ${
    isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'
  }`;

  const tabStyle = (tab: string) => {
    const active = activeTab === tab;
    return `px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
      active
        ? 'bg-gradient-to-r from-[#7c6af7] to-[#6366f1] text-white border-transparent shadow-md'
        : isLightMode
        ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
        : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:bg-white/[0.08]'
    }`;
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: isLightMode ? '#f8fafc' : '#06070d' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', boxShadow: '0 4px 16px rgba(124,106,247,0.35)' }}>
                <BookOpen className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>AI Workspace Memory</h1>
                <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Search and reconstruct details, context, and decisions across Slack threads</p>
              </div>
            </div>
          </div>

          {/* Query Search Form */}
          <div className={`${cardStyle} p-6 mb-8`}>
            <form onSubmit={handleSubmit} className="relative flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ask anything (e.g. 'What was discussed about security or API key?') ..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm border outline-none transition-all ${
                    isLightMode
                      ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-slate-300 focus:shadow-inner'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:bg-black/20 focus:border-white/[0.15]'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || queryMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)' }}
              >
                {queryMutation.isPending ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Recall</span>
                  </>
                )}
              </button>
            </form>

            {/* Suggestions */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1" style={{ color: '#9ca3af' }}>
                <HelpCircle className="w-3.5 h-3.5" />
                Suggested Queries
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectExample(prompt)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-left flex items-center gap-1.5 transition-all ${
                      isLightMode
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.07] text-slate-400'
                    }`}
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading Shimmer */}
          {queryMutation.isPending && (
            <div className="space-y-6">
              <div className={`${cardStyle} p-6 space-y-4`}>
                <div className="flex gap-2">
                  <div className="h-6 w-24 rounded animate-pulse" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />
                  <div className="h-6 w-24 rounded animate-pulse" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />
                </div>
                <div className="h-4 w-full rounded animate-pulse" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                <div className="h-4 w-5/6 rounded animate-pulse" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                <div className="h-4 w-4/5 rounded animate-pulse" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
              </div>
            </div>
          )}

          {/* Error boundary */}
          {queryMutation.error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl mb-8" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{queryMutation.error.message || 'Error occurred querying workspace memory'}</p>
            </div>
          )}

          {/* Query Result View */}
          {result && !queryMutation.isPending && (
            <div className={`${cardStyle} overflow-hidden`}>
              
              {/* Tabs */}
              <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                <button onClick={() => setActiveTab('summary')} className={tabStyle('summary')}>Summary</button>
                <button onClick={() => setActiveTab('decisions')} className={tabStyle('decisions')}>Decisions & Risks</button>
                <button onClick={() => setActiveTab('tasks')} className={tabStyle('tasks')}>Participants & Tasks</button>
                <button onClick={() => setActiveTab('timeline')} className={tabStyle('timeline')}>Timeline</button>
              </div>

              {/* Content Panel */}
              <div className="p-6">
                
                {/* ── SUMMARY TAB ── */}
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    <h3 className={`text-base font-bold flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      AI Analysis Summary
                    </h3>
                    <div className={`text-sm leading-relaxed whitespace-pre-line ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                      {result.summary}
                    </div>
                  </div>
                )}

                {/* ── DECISIONS TAB ── */}
                {activeTab === 'decisions' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Decisions */}
                    <div className="space-y-4">
                      <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Decisions Made
                      </h3>
                      {result.decisions.length === 0 ? (
                        <p className="text-xs italic text-slate-500">No clear decisions identified</p>
                      ) : (
                        <div className="space-y-2">
                          {result.decisions.map((dec, i) => (
                            <div key={i} className="flex gap-2.5 p-3 rounded-xl border text-xs font-semibold leading-relaxed"
                                 style={{
                                   background: isLightMode ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                                   borderColor: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.06)'
                                 }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                              <span className={isLightMode ? 'text-slate-700' : 'text-slate-200'}>{dec}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Risks */}
                    <div className="space-y-4">
                      <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Risks & Blockers
                      </h3>
                      {result.risks.length === 0 ? (
                        <p className="text-xs italic text-slate-500">No high-risk issues detected</p>
                      ) : (
                        <div className="space-y-2">
                          {result.risks.map((risk, i) => (
                            <div key={i} className="flex gap-2.5 p-3 rounded-xl border text-xs font-semibold leading-relaxed"
                                 style={{
                                   background: isLightMode ? '#fffbeb' : 'rgba(245,158,11,0.04)',
                                   borderColor: isLightMode ? '#fef3c7' : 'rgba(245,158,11,0.1)'
                                 }}>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span className={isLightMode ? 'text-amber-800' : 'text-amber-300'}>{risk}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── PARTICIPANTS & TASKS TAB ── */}
                {activeTab === 'tasks' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Participants */}
                    <div className="space-y-4">
                      <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                        <Users className="w-4 h-4 text-violet-400" />
                        Key Participants
                      </h3>
                      {result.participants.length === 0 ? (
                        <p className="text-xs italic text-slate-500">No participants identified</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {result.participants.map((person, i) => (
                            <span key={i} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                              isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
                            }`}>
                              <span className="w-2 h-2 rounded-full bg-violet-400" />
                              {getUserDisplayName(person)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tasks */}
                    <div className="space-y-4">
                      <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                        <ClipboardList className="w-4 h-4 text-sky-400" />
                        Task Assignments
                      </h3>
                      {result.tasks.length === 0 ? (
                        <p className="text-xs italic text-slate-500">No task assignments detected</p>
                      ) : (
                        <div className="space-y-2">
                          {result.tasks.map((t, i) => (
                            <div key={i} className="p-3 rounded-xl border text-xs flex items-center justify-between gap-3"
                                 style={{
                                   background: isLightMode ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                                   borderColor: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.06)'
                                 }}>
                              <span className={`font-semibold ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>{t.task}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#7c6af7]/10 text-[#7c6af7] shrink-0">
                                {getUserDisplayName(t.owner)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TIMELINE TAB ── */}
                {activeTab === 'timeline' && (
                  <div className="space-y-4">
                    <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                      <Clock className="w-4 h-4 text-teal-400" />
                      Sequence of Events
                    </h3>
                    {result.timeline.length === 0 ? (
                      <p className="text-xs italic text-slate-500">No events context captured</p>
                    ) : (
                      <div className="relative pl-6 border-l border-slate-500/20 space-y-4 ml-2 pt-1">
                        {result.timeline.map((ev, i) => (
                          <div key={i} className="relative group">
                            {/* Dot indicator */}
                            <span className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-teal-400 ring-4"
                                  style={{ boxShadow: `0 0 0 4px ${isLightMode ? '#ffffff' : '#0a0b12'}` }} />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-mono text-slate-400" style={{ color: '#7c6af7' }}>{ev.time}</span>
                              <p className={`text-xs font-semibold ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>{ev.event}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
