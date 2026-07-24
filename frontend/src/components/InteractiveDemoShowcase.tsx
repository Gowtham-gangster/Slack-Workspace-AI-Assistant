'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Sparkles, 
  CheckCircle2, 
  CheckSquare, 
  MessageSquare, 
  Clock, 
  Activity, 
  Shield, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Copy, 
  Check, 
  ArrowRight,
  User,
  ExternalLink,
  Bot,
  Zap,
  Layers,
  FileText,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface CardItem {
  id: string;
  number: string;
  title: string;
  tagline: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  query: string;
  thinking: string;
  responseHeadline: string;
  responseData: Array<{
    type: 'search' | 'summary' | 'decision' | 'task' | 'text' | 'reminder' | 'analytics' | 'alert';
    content: any;
  }>;
}

const showcaseCards: CardItem[] = [
  {
    id: 'search',
    number: '01',
    title: 'Search Slack Messages',
    tagline: 'Semantic vector search across thousands of channels in milliseconds.',
    category: 'Search & Discovery',
    icon: Search,
    color: '#7c6af7',
    query: 'What did Alex decide regarding the Database Migration strategy in #prod-engineering?',
    thinking: 'Searching 4,280 indexed messages across #prod-engineering and #db-ops...',
    responseHeadline: 'Found 3 high-confidence matches from thread archive:',
    responseData: [
      {
        type: 'search',
        content: {
          channel: '#prod-engineering',
          author: 'Alex Mercer (Staff Engineer)',
          avatar: 'A',
          timestamp: 'Yesterday at 3:42 PM',
          score: '98% match',
          snippet: 'We agreed to use PostgreSQL 16 with zero-downtime blue/green migration pattern. Read-replicas will handle analytics queries during cutover.',
        }
      }
    ]
  },
  {
    id: 'summary',
    number: '02',
    title: 'AI Channel Summary',
    tagline: 'Instant executive bullet points for unread channels and long threads.',
    category: 'Summarization',
    icon: Sparkles,
    color: '#8b5cf6',
    query: 'Summarize unread discussions in #release-v4.2 for today.',
    thinking: 'Synthesizing 142 unread messages into executive key takeaways...',
    responseHeadline: 'Today\'s #release-v4.2 Executive Summary:',
    responseData: [
      {
        type: 'summary',
        content: [
          'Release v4.2 passed all automated CI/CD security and regression test suites.',
          'Staging deployment verified by QA team; load testing confirmed 45ms avg latency.',
          'Rollout window scheduled for tonight at 10:00 PM EST with 15-min maintenance alert.'
        ]
      }
    ]
  },
  {
    id: 'decisions',
    number: '03',
    title: 'Decision Detection',
    tagline: 'Automatically map architectural and business decisions made in conversations.',
    category: 'Decision Graph',
    icon: CheckCircle2,
    color: '#10b981',
    query: 'Show architectural decisions agreed upon this week in engineering.',
    thinking: 'Scanning decision threads and stakeholder approval tags...',
    responseHeadline: 'Detected 2 Approved Decisions:',
    responseData: [
      {
        type: 'decision',
        content: {
          title: 'Adopt OAuth2 with PKCE for Internal Microservices',
          channel: '#security-architecture',
          status: 'Approved',
          stakeholders: ['@Sarah (Principal Architect)', '@David (VP Product)'],
          date: 'July 19, 2026'
        }
      }
    ]
  },
  {
    id: 'actions',
    number: '04',
    title: 'Action Item Extraction',
    tagline: 'Extract pending tasks, assigned owners, and due dates buried in threads.',
    category: 'Task Tracking',
    icon: CheckSquare,
    color: '#f59e0b',
    query: 'Extract pending action items from today\'s #product-design sync.',
    thinking: 'Extracting task assignments, assignees, and target deadlines...',
    responseHeadline: 'Extracted 3 Action Items:',
    responseData: [
      {
        type: 'task',
        content: [
          { task: 'Update Figma component library with new purple gradient tokens', assignee: '@Elena', due: 'Tomorrow 5 PM', priority: 'High' },
          { task: 'Prepare mobile responsive design specs for landing page', assignee: '@Marcus', due: 'July 22', priority: 'Medium' }
        ]
      }
    ]
  },
  {
    id: 'chat',
    number: '05',
    title: 'AI Workspace Chat',
    tagline: 'Conversational copilot to draft reports, query history, and synthesize insights.',
    category: 'Conversational AI',
    icon: MessageSquare,
    color: '#0ea5e9',
    query: 'Draft a status update for leadership based on #launch-marketing updates.',
    thinking: 'Formulating executive briefing from #launch-marketing activity...',
    responseHeadline: 'Leadership Status Briefing:',
    responseData: [
      {
        type: 'text',
        content: 'Leadership Update: The Q3 marketing campaign is 85% complete. Assets for social, email, and landing page are finalized. Launch remains on track for Thursday 9 AM EST.'
      }
    ]
  },
  {
    id: 'analytics',
    number: '06',
    title: 'Channel Analytics & Pulse',
    tagline: 'Monitor thread velocity, team sentiment, and message volume health.',
    category: 'Workspace Pulse',
    icon: Activity,
    color: '#6366f1',
    query: 'Show activity pulse and team sentiment for #customer-feedback.',
    thinking: 'Calculating channel velocity metrics and sentiment indicators...',
    responseHeadline: '#customer-feedback Health Metrics:',
    responseData: [
      {
        type: 'analytics',
        content: {
          sentiment: '94% Positive',
          volume: '342 messages / 24h',
          activeUsers: '48 team members',
          trend: '+18% activity vs last week'
        }
      }
    ]
  }
];

export default function InteractiveDemoShowcase() {
  const isLightMode = false;

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [typedQuery, setTypedQuery] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentCard = showcaseCards[activeCardIndex];

  // Animated typing and response sequence
  useEffect(() => {
    setIsTyping(true);
    setIsThinking(false);
    setShowResult(false);
    setTypedQuery('');

    const targetQuery = currentCard.query;
    let charIdx = 0;

    const typingInterval = setInterval(() => {
      if (charIdx <= targetQuery.length) {
        setTypedQuery(targetQuery.slice(0, charIdx));
        charIdx++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
        setIsThinking(true);

        setTimeout(() => {
          setIsThinking(false);
          setShowResult(true);
        }, 700);
      }
    }, 25);

    return () => clearInterval(typingInterval);
  }, [activeCardIndex]);

  const handleNext = () => {
    setActiveCardIndex((prev) => (prev + 1) % showcaseCards.length);
  };

  const handlePrev = () => {
    setActiveCardIndex((prev) => (prev - 1 + showcaseCards.length) % showcaseCards.length);
  };

  const handleReplay = () => {
    setTypedQuery('');
    setIsTyping(true);
    setIsThinking(false);
    setShowResult(false);
    
    let charIdx = 0;
    const targetQuery = currentCard.query;
    const typingInterval = setInterval(() => {
      if (charIdx <= targetQuery.length) {
        setTypedQuery(targetQuery.slice(0, charIdx));
        charIdx++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
        setIsThinking(true);

        setTimeout(() => {
          setIsThinking(false);
          setShowResult(true);
        }, 700);
      }
    }, 25);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCard.responseData[0].content.snippet || currentCard.query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const IconComponent = currentCard.icon;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 font-sans selection:bg-[#7c6af7]/35">
      
      {/* ────────────────── SECTION HEADER ────────────────── */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#7c6af7]/10 text-[#7c6af7] border border-[#7c6af7]/20">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Interactive Product Experience</span>
        </div>
        <h2 className={`text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
          See Slack AI in Action
        </h2>
        <p className={`text-xs sm:text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Explore how AI indexes messages, synthesizes decisions, and structures actionable updates across your workspace.
        </p>
      </div>

      {/* ────────────────── MOBILE CAROUSEL LAYOUT (SCREEN WIDTH < 1024px) ────────────────── */}
      <div className="block lg:hidden w-full space-y-4">
        
        {/* Mobile Header Bar & Progress Counter */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border backdrop-blur-xl ${
          isLightMode ? 'bg-white/80 border-slate-200 text-slate-800' : 'bg-[#0b0c16]/80 border-white/10 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#7c6af7] font-mono">
              Card {activeCardIndex + 1} / {showcaseCards.length}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              isLightMode ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-300'
            }`}>
              {currentCard.category}
            </span>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            {showcaseCards.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveCardIndex(idx)}
                aria-label={`Go to feature card ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeCardIndex === idx
                    ? 'w-6 bg-[#7c6af7]'
                    : isLightMode
                    ? 'w-2 bg-slate-300 hover:bg-slate-400'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Mobile Feature Card */}
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className={`w-full rounded-3xl p-5 sm:p-6 border backdrop-blur-xl relative overflow-hidden shadow-2xl ${
            isLightMode ? 'bg-white/90 border-slate-200' : 'bg-[#080911]/90 border-white/10'
          }`}
        >
          {/* Card Top Title */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                style={{ backgroundColor: currentCard.color }}
              >
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-base font-bold tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  {currentCard.title}
                </h3>
                <p className={`text-xs mt-0.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {currentCard.tagline}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive AI Console Simulation */}
          <div className={`w-full rounded-2xl p-4 border font-mono text-xs mb-4 ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-[#04050a] border-white/10'
          }`}>
            {/* User Prompt */}
            <div className="flex items-start gap-2 border-b border-white/5 pb-3 mb-3">
              <span className="text-[#7c6af7] font-bold shrink-0">User &gt;</span>
              <p className={`font-semibold leading-relaxed ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
                {typedQuery}
                {isTyping && <span className="inline-block w-1.5 h-3.5 bg-[#7c6af7] ml-1 animate-pulse" />}
              </p>
            </div>

            {/* AI Thinking Step */}
            {isThinking && (
              <div className="flex items-center gap-2 text-[11px] text-[#a78bfa] py-2 animate-pulse">
                <Bot className="w-4 h-4" />
                <span>{currentCard.thinking}</span>
              </div>
            )}

            {/* AI Result Output */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 pt-1"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7c6af7]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{currentCard.responseHeadline}</span>
                </div>

                {/* Search Match */}
                {currentCard.responseData[0].type === 'search' && (
                  <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    isLightMode ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-200'
                  }`}>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#7c6af7] mb-1.5">
                      <span>{currentCard.responseData[0].content.channel}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#7c6af7]/20 text-[#a78bfa]">
                        {currentCard.responseData[0].content.score}
                      </span>
                    </div>
                    <p className="italic mb-2">"{currentCard.responseData[0].content.snippet}"</p>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      By {currentCard.responseData[0].content.author} • {currentCard.responseData[0].content.timestamp}
                    </span>
                  </div>
                )}

                {/* Summary Bullets */}
                {currentCard.responseData[0].type === 'summary' && (
                  <ul className="space-y-2 font-sans text-xs">
                    {currentCard.responseData[0].content.map((bullet: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] mt-1.5 shrink-0" />
                        <span className={isLightMode ? 'text-slate-700' : 'text-slate-300'}>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Decision Card */}
                {currentCard.responseData[0].type === 'decision' && (
                  <div className={`p-3 rounded-xl border ${
                    isLightMode ? 'bg-emerald-50/50 border-emerald-200 text-slate-800' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span>{currentCard.responseData[0].content.title}</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px]">
                        {currentCard.responseData[0].content.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      Approved by {currentCard.responseData[0].content.stakeholders.join(', ')}
                    </span>
                  </div>
                )}

                {/* Task Items */}
                {currentCard.responseData[0].type === 'task' && (
                  <div className="space-y-2 font-sans text-xs">
                    {currentCard.responseData[0].content.map((t: any, i: number) => (
                      <div key={i} className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
                      }`}>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-[#7c6af7] shrink-0" />
                          <span className={isLightMode ? 'text-slate-800' : 'text-slate-200'}>{t.task}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold shrink-0">
                          {t.assignee}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Default Text */}
                {currentCard.responseData[0].type === 'text' && (
                  <p className={`font-sans text-xs leading-relaxed ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    {currentCard.responseData[0].content}
                  </p>
                )}

                {/* Reminder Card */}
                {currentCard.responseData[0].type === 'reminder' && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    isLightMode ? 'bg-pink-50/50 border-pink-200' : 'bg-pink-950/20 border-pink-500/20'
                  }`}>
                    <div>
                      <span className="text-xs font-bold text-pink-400 block">
                        {currentCard.responseData[0].content.topic}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        Scheduled for {currentCard.responseData[0].content.time}
                      </span>
                    </div>
                    <Clock className="w-4 h-4 text-pink-400 shrink-0" />
                  </div>
                )}

                {/* Analytics Card */}
                {currentCard.responseData[0].type === 'analytics' && (
                  <div className="grid grid-cols-2 gap-2 font-sans text-xs">
                    <div className={`p-2.5 rounded-xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                      <span className="text-[10px] text-slate-400 block">Sentiment</span>
                      <span className="text-sm font-extrabold text-indigo-400">
                        {currentCard.responseData[0].content.sentiment}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                      <span className="text-[10px] text-slate-400 block">Velocity</span>
                      <span className="text-sm font-extrabold text-indigo-400">
                        {currentCard.responseData[0].content.volume}
                      </span>
                    </div>
                  </div>
                )}

                {/* Alert Card */}
                {currentCard.responseData[0].type === 'alert' && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 font-sans text-xs">
                    <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        {currentCard.responseData[0].content.severity}
                      </span>
                      <span className="text-[10px] text-red-400">{currentCard.responseData[0].content.time}</span>
                    </div>
                    <p className="text-xs">{currentCard.responseData[0].content.title}</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Touch Controls Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                aria-label="Previous Feature Card"
                className={`min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                  isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <button
                onClick={handleReplay}
                aria-label="Replay AI Animation"
                className={`min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Replay</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleNext}
                aria-label="Next Feature Card"
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ────────────────── DESKTOP TWO-COLUMN LAYOUT (SCREEN WIDTH >= 1024px) ────────────────── */}
      <div className="hidden lg:grid grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: 8 Selectable Feature Cards */}
        <div className="col-span-5 space-y-3">
          {showcaseCards.map((card, idx) => {
            const isActive = activeCardIndex === idx;
            const CardIcon = card.icon;

            return (
              <button
                key={card.id}
                onClick={() => setActiveCardIndex(idx)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-start gap-3.5 group cursor-pointer relative overflow-hidden ${
                  isActive
                    ? isLightMode
                      ? 'bg-white border-[#7c6af7] shadow-xl shadow-[#7c6af7]/10 ring-2 ring-[#7c6af7]/20'
                      : 'bg-[#0d0e18] border-[#7c6af7] shadow-2xl shadow-[#7c6af7]/20 ring-1 ring-[#7c6af7]/40'
                    : isLightMode
                    ? 'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-slate-300'
                    : 'bg-[#06070d]/60 border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                }`}
              >
                <div 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white shadow-md' : 'text-slate-400 bg-white/5'
                  }`}
                  style={{ backgroundColor: isActive ? card.color : undefined }}
                >
                  <CardIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c6af7]">
                      {card.category}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold ${isActive ? 'text-[#7c6af7]' : 'text-slate-500'}`}>
                      {card.number}
                    </span>
                  </div>

                  <h3 className={`text-sm font-bold tracking-tight mt-0.5 ${
                    isActive ? (isLightMode ? 'text-slate-900' : 'text-white') : (isLightMode ? 'text-slate-700' : 'text-slate-300')
                  }`}>
                    {card.title}
                  </h3>

                  <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                    isLightMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {card.tagline}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Side: Live Interactive AI Console Visualizer */}
        <div className="col-span-7 flex flex-col">
          <div className={`flex-1 rounded-3xl p-6 border backdrop-blur-xl relative flex flex-col justify-between shadow-2xl overflow-hidden ${
            isLightMode ? 'bg-white/90 border-slate-200' : 'bg-[#080911]/90 border-white/10'
          }`}>
            
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md"
                  style={{ backgroundColor: currentCard.color }}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    {currentCard.title}
                  </h4>
                  <span className="text-[11px] text-[#7c6af7] font-semibold block">
                    {currentCard.category}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReplay}
                  aria-label="Replay AI Simulation"
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Replay</span>
                </button>

                <button
                  onClick={handleCopy}
                  aria-label="Copy AI Output"
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Output'}</span>
                </button>
              </div>
            </div>

            {/* AI Console Screen */}
            <div className={`flex-1 rounded-2xl p-5 border font-mono text-xs overflow-y-auto space-y-4 mb-6 ${
              isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-[#04050a] border-white/10'
            }`}>
              
              {/* User Prompt */}
              <div className="flex items-start gap-3 border-b border-white/5 pb-4">
                <span className="text-[#7c6af7] font-bold shrink-0">User &gt;</span>
                <p className={`font-semibold leading-relaxed text-sm ${isLightMode ? 'text-slate-800' : 'text-slate-100'}`}>
                  {typedQuery}
                  {isTyping && <span className="inline-block w-2 h-4 bg-[#7c6af7] ml-1 animate-pulse" />}
                </p>
              </div>

              {/* AI Thinking Animation */}
              {isThinking && (
                <div className="flex items-center gap-2.5 text-xs text-[#a78bfa] py-3 animate-pulse">
                  <Bot className="w-4 h-4" />
                  <span>{currentCard.thinking}</span>
                </div>
              )}

              {/* AI Output Visualizer */}
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-2"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#7c6af7]">
                    <Sparkles className="w-4 h-4" />
                    <span>{currentCard.responseHeadline}</span>
                  </div>

                  {/* Search Match */}
                  {currentCard.responseData[0].type === 'search' && (
                    <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                      isLightMode ? 'bg-white border-slate-200 text-slate-700 shadow-sm' : 'bg-white/5 border-white/10 text-slate-200'
                    }`}>
                      <div className="flex items-center justify-between font-semibold text-[#7c6af7]">
                        <span>{currentCard.responseData[0].content.channel}</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-[#7c6af7]/20 text-[#a78bfa]">
                          {currentCard.responseData[0].content.score}
                        </span>
                      </div>
                      <p className="italic text-sm">"{currentCard.responseData[0].content.snippet}"</p>
                      <span className="text-xs text-slate-400 block font-sans">
                        Author: {currentCard.responseData[0].content.author} • {currentCard.responseData[0].content.timestamp}
                      </span>
                    </div>
                  )}

                  {/* Summary Bullets */}
                  {currentCard.responseData[0].type === 'summary' && (
                    <ul className="space-y-2.5 font-sans text-xs sm:text-sm">
                      {currentCard.responseData[0].content.map((bullet: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#7c6af7] mt-1.5 shrink-0" />
                          <span className={isLightMode ? 'text-slate-800' : 'text-slate-200'}>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Decision Card */}
                  {currentCard.responseData[0].type === 'decision' && (
                    <div className={`p-4 rounded-xl border ${
                      isLightMode ? 'bg-emerald-50/60 border-emerald-200 text-slate-800' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    }`}>
                      <div className="flex items-center justify-between font-bold text-sm mb-1.5">
                        <span>{currentCard.responseData[0].content.title}</span>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          {currentCard.responseData[0].content.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block font-sans">
                        Approved by {currentCard.responseData[0].content.stakeholders.join(', ')} on {currentCard.responseData[0].content.date}
                      </span>
                    </div>
                  )}

                  {/* Task Items */}
                  {currentCard.responseData[0].type === 'task' && (
                    <div className="space-y-2.5 font-sans text-xs sm:text-sm">
                      {currentCard.responseData[0].content.map((t: any, i: number) => (
                        <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${
                          isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'
                        }`}>
                          <div className="flex items-center gap-3">
                            <CheckSquare className="w-4 h-4 text-[#7c6af7] shrink-0" />
                            <span className={isLightMode ? 'text-slate-800' : 'text-slate-200'}>{t.task}</span>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-bold shrink-0">
                            {t.assignee}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Default Text */}
                  {currentCard.responseData[0].type === 'text' && (
                    <p className={`font-sans text-xs sm:text-sm leading-relaxed ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                      {currentCard.responseData[0].content}
                    </p>
                  )}

                  {/* Reminder Card */}
                  {currentCard.responseData[0].type === 'reminder' && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                      isLightMode ? 'bg-pink-50/60 border-pink-200' : 'bg-pink-950/20 border-pink-500/30'
                    }`}>
                      <div>
                        <span className="text-sm font-bold text-pink-400 block">
                          {currentCard.responseData[0].content.topic}
                        </span>
                        <span className="text-xs text-slate-400 font-sans">
                          Scheduled for {currentCard.responseData[0].content.time}
                        </span>
                      </div>
                      <Clock className="w-5 h-5 text-pink-400 shrink-0" />
                    </div>
                  )}

                  {/* Analytics Card */}
                  {currentCard.responseData[0].type === 'analytics' && (
                    <div className="grid grid-cols-2 gap-3 font-sans text-xs sm:text-sm">
                      <div className={`p-3.5 rounded-xl border ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}`}>
                        <span className="text-xs text-slate-400 block">Sentiment Score</span>
                        <span className="text-base font-extrabold text-indigo-400">
                          {currentCard.responseData[0].content.sentiment}
                        </span>
                      </div>
                      <div className={`p-3.5 rounded-xl border ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}`}>
                        <span className="text-xs text-slate-400 block">Message Velocity</span>
                        <span className="text-base font-extrabold text-indigo-400">
                          {currentCard.responseData[0].content.volume}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Alert Card */}
                  {currentCard.responseData[0].type === 'alert' && (
                    <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 font-sans text-xs sm:text-sm">
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          {currentCard.responseData[0].content.severity}
                        </span>
                        <span className="text-xs text-red-400">{currentCard.responseData[0].content.time}</span>
                      </div>
                      <p className="text-xs sm:text-sm">{currentCard.responseData[0].content.title}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Ready to explore with your Slack team?</span>
              </div>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
