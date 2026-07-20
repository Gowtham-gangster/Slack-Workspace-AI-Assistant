'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  Sparkles,
  Search,
  MessageSquare,
  ClipboardList,
  Activity,
  Layers,
  Users,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowRight,
  Shield,
  Code,
  CheckCircle2,
  Database,
  ArrowUpRight,
  HelpCircle,
  Sun,
  Moon,
  AlertTriangle,
  Play,
  Menu,
  X
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import MobileBottomBar from '../components/MobileBottomBar';
import InteractiveDemoShowcase from '../components/InteractiveDemoShowcase';

const ThreeHeroScene = dynamic(() => import('../components/ThreeHeroScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">
      Initializing WebGL Context...
    </div>
  )
});

// Helper for count-up animations on scroll
const Counter = ({ value, duration = 2 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      if (start === end) return;

      const totalMiliseconds = duration * 1000;
      const incrementTime = Math.max(Math.floor(totalMiliseconds / end), 20);
      
      const timer = setInterval(() => {
        start += Math.ceil(end / (totalMiliseconds / incrementTime));
        if (start >= end) {
          clearInterval(timer);
          setCount(end);
        } else {
          setCount(start);
        }
      }, incrementTime);

      return () => clearInterval(timer);
    }
  }, [isInView, value, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
};

// High-fidelity Slack Workspace & AI Insights dashboard simulator for the Hero section
const HeroDashboardMockup = () => {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="w-full h-full flex flex-col bg-[#07080f]/90 border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl relative select-none font-sans text-slate-300">
      {/* OS Titlebar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] bg-white/[0.01] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          <span className="text-[10px] font-mono ml-2 text-slate-500">workspace-copilot-chat</span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#7c6af7]/10 border border-[#7c6af7]/15 text-[#a78bfa] text-[9.5px] font-mono">
          <Sparkles className="w-3.5 h-3.5 text-[#7c6af7] animate-pulse" />
          <span>AI Copilot: Online</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-grow p-5 flex flex-col justify-between overflow-y-auto space-y-4">
        {/* User Question */}
        <div className="flex items-start gap-3 justify-end shrink-0">
          <div className="bg-[#7c6af7]/15 border border-[#7c6af7]/25 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-[12px] max-w-[85%] shadow-sm">
            <p className="font-semibold text-slate-100">"Summarize the database migration status for the team."</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-[#a78bfa] border border-[#a78bfa]/20 shrink-0">
            U
          </div>
        </div>

        {/* AI Assistant Answer */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#6366f1] flex items-center justify-center text-[10px] font-bold text-white shadow-md shadow-[#7c6af7]/20 shrink-0">
            <Zap className="w-3.5 h-3.5" fill="white" />
          </div>
          <div className="flex-1 bg-[#0d0e16]/80 border border-white/[0.05] rounded-2xl rounded-tl-none p-4 space-y-3.5 shadow-lg max-w-[88%] relative">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
              <span className="text-[11.5px] font-bold text-white flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#a78bfa] animate-pulse" />
                Workspace AI
              </span>
              <span className="text-[9.5px] text-slate-500 font-mono">Just now</span>
            </div>

            <p className="text-[12px] text-slate-300 leading-relaxed font-medium">
              I've indexed the **#db-migration** channel conversations. Here is the structured summary:
            </p>

            {/* Quick tabs inside the mockup */}
            <div className="flex gap-1.5 border-b border-white/[0.04] pb-2">
              {['Summary', 'Decisions', 'Tasks'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md border transition-all ${
                    activeTab === tab.toLowerCase()
                      ? 'bg-[#7c6af7]/15 border-[#7c6af7]/35 text-[#a78bfa]'
                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="text-[11.5px] leading-relaxed text-slate-400 min-h-[90px] font-sans">
              {activeTab === 'summary' && (
                <p>
                  Gowtham completed the MySQL replica setup and marked it ready. Priya is set to load-test the database with a 10k dataset today to check synchronization latency and verify query performance under load.
                </p>
              )}
              {activeTab === 'decisions' && (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 text-slate-300">
                    <span className="text-[#34d399] font-bold shrink-0">✓</span>
                    <span>Approved staging load testing using 10k mock entries before launching in production.</span>
                  </div>
                </div>
              )}
              {activeTab === 'tasks' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5">
                    <span className="text-slate-300 font-medium">Load test DB replica with 10k dataset</span>
                    <span className="text-[9px] text-[#fbbf24] bg-[#fbbf24]/10 px-1.5 py-0.5 rounded font-mono font-bold">@Priya</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5">
                    <span className="text-slate-500 line-through">Verify MySQL replica setup completion</span>
                    <span className="text-[9px] text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded font-mono font-bold">@Gowtham</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Simulation Bar */}
      <div className="px-5 py-3 border-t border-white/[0.05] bg-[#030408]/60 flex items-center justify-between text-[9.5px] text-slate-500 font-mono shrink-0">
        <span>Click tabs to preview AI outputs</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" /> Interactive Mockup</span>
      </div>
    </div>
  );
};

// Unified high-fidelity mockup visualizer for the interactive section
const PipelineUIVisualizer = ({
  scenario,
  isTyping,
  typedText,
  showResponse
}: {
  scenario: any;
  isTyping: boolean;
  typedText: string;
  showResponse: boolean;
}) => {
  const [activeSubTab, setActiveSubTab] = useState('summary');

  useEffect(() => {
    setActiveSubTab('summary');
  }, [scenario]);

  return (
    <div className="w-full h-full flex flex-col bg-[#07080f]/90 border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative select-none font-sans text-slate-300">
      {/* App Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05] bg-[#030408]/40 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          <span className="text-[10px] font-mono ml-2 text-slate-500">workspace-copilot-interactive</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c6af7]/10 border border-[#7c6af7]/15 text-[#a78bfa] text-[9.5px] font-mono font-bold">
          <Sparkles className="w-3.5 h-3.5 text-[#7c6af7] animate-pulse" />
          <span>Interactive Assistant</span>
        </div>
      </div>

      {/* Dynamic Content Frame */}
      <div className="flex-grow p-5 relative overflow-hidden flex flex-col justify-between h-[520px] bg-[#030408]/20">
        
        {/* Chat Stream */}
        <div className="flex-grow overflow-y-auto space-y-4 pr-1">
          {/* User message (types character-by-character) */}
          <div className="flex items-start gap-3 justify-end shrink-0">
            <div className="bg-[#7c6af7]/15 border border-[#7c6af7]/25 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-[12px] max-w-[85%] shadow-sm">
              <span className="font-semibold text-slate-100">{typedText}</span>
              {isTyping && <span className="inline-block w-1.5 h-3 bg-[#7c6af7] ml-0.5 animate-pulse" />}
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-[#a78bfa] border border-[#a78bfa]/20 shrink-0">
              U
            </div>
          </div>

          {/* AI Loader or Response */}
          {isTyping && typedText.length === scenario.query.length && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#6366f1] flex items-center justify-center text-[10px] font-bold text-white shadow-md shrink-0">
                <Zap className="w-3.5 h-3.5" fill="white" />
              </div>
              <div className="bg-[#0d0e16]/80 border border-white/[0.05] rounded-2xl rounded-tl-none p-3.5 text-[11px] text-slate-500 flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>Summarizing channels...</span>
              </div>
            </motion.div>
          )}

          {showResponse && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#6366f1] flex items-center justify-center text-[10px] font-bold text-white shadow-md shadow-[#7c6af7]/20 shrink-0">
                <Zap className="w-3.5 h-3.5" fill="white" />
              </div>
              <div className="flex-grow bg-[#0d0e16]/80 border border-white/[0.05] rounded-2xl rounded-tl-none p-4 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
                  <span className="text-[11.5px] font-bold text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#a78bfa]" />
                    AI Copilot Response
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">Index updated 2m ago</span>
                </div>

                {/* Sub tabs for different result categories */}
                <div className="flex flex-wrap gap-1.5 border-b border-white/[0.04] pb-2">
                  {['Summary', 'Decisions', 'Action Items', 'Risks'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSubTab(tab.toLowerCase().replace(' ', ''))}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                        activeSubTab === tab.toLowerCase().replace(' ', '')
                          ? 'bg-[#7c6af7]/15 border-[#7c6af7]/35 text-[#a78bfa]'
                          : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab content area */}
                <div className="text-[12px] leading-relaxed text-slate-300 min-h-[140px] font-sans">
                  {activeSubTab === 'summary' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2"
                    >
                      <p>{scenario.summary}</p>
                    </motion.div>
                  )}

                  {activeSubTab === 'decisions' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2"
                    >
                      {scenario.decisions.map((dec: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[#34d399] font-bold">✓</span>
                          <span>{dec}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activeSubTab === 'actionitems' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2.5"
                    >
                      {scenario.actions.map((act: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded border ${
                              act.status === 'Completed' ? 'border-[#34d399] bg-[#34d399]/15' : 'border-white/20'
                            } flex items-center justify-center text-[9px] text-[#34d399]`}>
                              {act.status === 'Completed' ? '✓' : ''}
                            </div>
                            <span className={act.status === 'Completed' ? 'line-through text-slate-500' : 'text-slate-200'}>
                              {act.task}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border" style={{ backgroundColor: act.color + '15', color: act.color, borderColor: act.color + '25' }}>
                            {act.owner}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activeSubTab === 'risks' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2"
                    >
                      {scenario.risks.map((risk: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 bg-[#f43f5e]/5 border border-[#f43f5e]/15 p-2.5 rounded-xl">
                          <span className="text-[#f43f5e] font-bold">⚠️</span>
                          <span className="text-slate-300">{risk}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[9.5px] font-mono text-slate-600 border-t border-white/5 pt-3.5 flex items-center justify-between shrink-0">
          <span>Connected: slack-workspace-mcp</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-ping" />
            <span>AI Index Synced</span>
          </span>
        </div>
      </div>
    </div>
  );
};

const scenarios = [
  {
    query: "What happened in engineering this week?",
    summary: "The engineering team successfully completed the migration to the new MySQL production database on Tuesday. The front-end team integrated a global theme settings panel, and David resolved the Slack bot API rate limit issue.",
    decisions: [
      "MySQL production migration is officially complete; sqlite database file is deactivated.",
      "Decided to change sync frequencies to 15-minute intervals to avoid API limit errors."
    ],
    actions: [
      { task: "Load test DB replica with 10k dataset", owner: "@Priya", status: "In Progress", color: "#0ea5e9" },
      { task: "Coordinate replica parameters with cloud ops", owner: "@David", status: "Pending", color: "#fbbf24" },
      { task: "Document Slack MCP sync setup guide", owner: "@Priya", status: "Completed", color: "#10b981" }
    ],
    risks: [
      "MySQL read latencies could spike during peak traffic hours if caching rules are not optimized.",
      "Slack API rate limits may block real-time messages if batch indexing runs overlap."
    ]
  },
  {
    query: "Are there any blockers or decisions in support?",
    summary: "Customer support reports a surge in setup inquiries. Users are confused by the Slack Bot Token credentials scope setup. Inquiries are resolved quickly, but documentation is currently a major bottleneck.",
    decisions: [
      "Create a public integration setup guide to reduce ticket volumes.",
      "Add helper tooltips to the credentials input form in workspace settings."
    ],
    actions: [
      { task: "Draft setup guide documentation", owner: "@Priya", status: "In Progress", color: "#0ea5e9" },
      { task: "Add UI settings credentials tooltips", owner: "@Gowtham", status: "Pending", color: "#fbbf24" }
    ],
    risks: [
      "Setup bottlenecks may impact user trial conversions if documentation is not launched this week.",
      "OAuth scoping updates require security re-verification."
    ]
  },
  {
    query: "Give me the team updates from the #general channel.",
    summary: "General channel updates include announcements about the new workspace assistant launch. Priya shared slides for the upcoming demo sync.",
    decisions: [
      "The company-wide demo is scheduled for Thursday at 2 PM EST.",
      "All teams must submit progress updates by Wednesday EOD."
    ],
    actions: [
      { task: "Share slides in the general Slack channel", owner: "@Priya", status: "Completed", color: "#10b981" },
      { task: "Submit progress updates on engineering tasks", owner: "@Gowtham", status: "Pending", color: "#fbbf24" }
    ],
    risks: [
      "Delayed slide submission by remote teams may push the review meeting schedule.",
      "Overlapping presentation slots could exceed the 30-minute demo window."
    ]
  }
];

const useCases = [
  {
    icon: Search,
    title: "Find Lost Conversations",
    desc: "Instantly retrieve facts, links, and design mockups buried deep in old threads. No more endless scrolling through weeks of backlog.",
    color: "#7c6af7"
  },
  {
    icon: ClipboardList,
    title: "Generate Meeting Summaries",
    desc: "Turn chaotic standups, product reviews, and brainstorming channels into clean, structured written summaries in one click.",
    color: "#0ea5e9"
  },
  {
    icon: CheckCircle2,
    title: "Track Action Items",
    desc: "Detect tasks automatically from team conversations, compile deadlines, and assign clear owners to keep everyone accountable.",
    color: "#10b981"
  },
  {
    icon: Users,
    title: "Discover Team Decisions",
    desc: "Highlight final agreements, consensus points, and project greenlights without reading back through multi-threaded chats.",
    color: "#8b5cf6"
  },
  {
    icon: Activity,
    title: "Monitor Workspace Health",
    desc: "Observe topic velocities, identify conversational bottlenecks, and gauge team sentiment using clean, elegant metrics dashboards.",
    color: "#fbbf24"
  },
  {
    icon: Layers,
    title: "Search Across Channels",
    desc: "Connect information from public channels, private rooms, and direct messages in a unified security-audited search view.",
    color: "#f43f5e"
  }
];

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';

  // Scroll bindings for animations
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"]
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const opacityScene = useTransform(scrollYProgress, [0, 0.8, 1], [1, 1, 0.2]);

  const [activeStep, setActiveStep] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const [activeScenario, setActiveScenario] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [showResponse, setShowResponse] = useState(false);

  useEffect(() => {
    let active = true;
    setIsTyping(true);
    setShowResponse(false);
    setTypedText('');

    const targetQuery = scenarios[activeScenario].query;
    let index = 0;

    const interval = setInterval(() => {
      if (!active) return;
      if (index < targetQuery.length) {
        setTypedText(targetQuery.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          if (!active) return;
          setIsTyping(false);
          setShowResponse(true);
        }, 800);
      }
    }, 25);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeScenario]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Scroll to element helper
  const scrollTo = (id: string) => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={targetRef} className={`relative min-h-screen overflow-x-hidden selection:bg-[#7c6af7]/35 transition-colors duration-500 ${
      isLightMode ? 'bg-gradient-to-tr from-white via-indigo-50/15 to-blue-50/20 text-slate-800' : 'bg-[#030408] text-slate-300'
    }`}>
      
      {/* Immersive background glows */}
      <div className={`absolute top-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full bg-[#7c6af7]/8 blur-[130px] pointer-events-none z-0 transition-opacity duration-500 ${isLightMode ? 'opacity-30' : 'opacity-100'}`} />
      <div className={`absolute bottom-[20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#0ea5e9]/4 blur-[150px] pointer-events-none z-0 transition-opacity duration-500 ${isLightMode ? 'opacity-20' : 'opacity-100'}`} />
      <div className={`absolute top-[40%] right-[10%] w-[45vw] h-[45vw] rounded-full bg-[#8b5cf6]/5 blur-[130px] pointer-events-none z-0 transition-opacity duration-500 ${isLightMode ? 'opacity-30' : 'opacity-100'}`} />

      {/* FIXED NAV BAR */}
      <header className={`fixed top-0 left-0 right-0 h-16 shrink-0 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl border-b transition-all duration-500 z-50 ${
        isLightMode
          ? 'border-slate-200/50 bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
          : 'border-white/[0.05] bg-[#030408]/65'
      }`}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#4f46e5] blur-md opacity-50 scale-110" />
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#9d8fff] via-[#7c6af7] to-[#4f46e5] p-[1.5px] shadow-[0_0_14px_rgba(124,106,247,0.5)]">
              <div className="w-full h-full rounded-[9px] bg-[#1a1730] flex items-center justify-center overflow-hidden">
                <img
                  src="/slack-app-icon.png"
                  alt="Slack AI Workspace Assistant Logo"
                  className="w-5 h-5 object-contain"
                />
              </div>
            </div>
          </div>
          <div>
            <span className={`font-bold text-[14px] tracking-tight transition-colors duration-300 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Slack AI</span>
            <span className="text-[10px] block text-[#7c6af7] font-semibold tracking-wider uppercase leading-none">WORKSPACE ASSISTANT</span>
          </div>
        </div>

        <nav className={`hidden md:flex items-center gap-8 text-[13px] font-medium transition-colors duration-300 ${
          isLightMode ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <button onClick={() => scrollTo('demo')} className={`hover:text-[#7c6af7] transition-colors cursor-pointer ${isLightMode ? 'hover:text-slate-900' : 'hover:text-white'}`}>Interactive Demo</button>
          <button onClick={() => scrollTo('features')} className={`hover:text-[#7c6af7] transition-colors cursor-pointer ${isLightMode ? 'hover:text-slate-900' : 'hover:text-white'}`}>Use Cases</button>
          <button onClick={() => scrollTo('story')} className={`hover:text-[#7c6af7] transition-colors cursor-pointer ${isLightMode ? 'hover:text-slate-900' : 'hover:text-white'}`}>Vacation Story</button>
          <button onClick={() => scrollTo('security')} className={`hover:text-[#7c6af7] transition-colors cursor-pointer ${isLightMode ? 'hover:text-slate-900' : 'hover:text-white'}`}>Security</button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className={`inline-flex items-center justify-center p-2 rounded-xl border transition-all duration-300 outline-none ${
              isLightMode
                ? 'bg-slate-100/60 border-slate-200 text-slate-700 shadow-sm hover:bg-slate-200/80 hover:text-slate-900'
                : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.08] hover:text-white'
            }`}
            aria-label="Toggle Theme"
          >
            {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <Link
            href="/login"
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${
              isLightMode
                ? 'text-slate-700 bg-[#7c6af7]/10 hover:bg-[#7c6af7]/20 border border-[#7c6af7]/20 shadow-sm'
                : 'text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]'
            }`}
          >
            Sign In
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-2 rounded-xl border transition-all ${
              isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
            }`}
            aria-label="Toggle Mobile Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MOBILE NAV DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 left-0 right-0 z-40 p-6 border-b backdrop-blur-2xl md:hidden shadow-2xl ${
              isLightMode ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-[#06070d]/95 border-white/10 text-white'
            }`}
          >
            <div className="flex flex-col gap-4 text-sm font-semibold">
              <button onClick={() => scrollTo('demo')} className="text-left py-2 border-b border-white/5">Interactive Demo</button>
              <button onClick={() => scrollTo('features')} className="text-left py-2 border-b border-white/5">Use Cases</button>
              <button onClick={() => scrollTo('story')} className="text-left py-2 border-b border-white/5">Vacation Story</button>
              <button onClick={() => scrollTo('security')} className="text-left py-2 border-b border-white/5">Security</button>
              <Link href="/support" onClick={() => setIsMobileMenuOpen(false)} className="text-left py-2 border-b border-white/5 text-[#7c6af7]">Help & Support</Link>
              <Link href="/privacy" onClick={() => setIsMobileMenuOpen(false)} className="text-left py-2 border-b border-white/5">Privacy Policy</Link>
              <Link href="/terms" onClick={() => setIsMobileMenuOpen(false)} className="text-left py-2">Terms & Conditions</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────── SECTION 1: HERO ────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20 z-10 px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center max-w-7xl mx-auto w-full">
          
          {/* Left Column: Copy */}
          <div className="lg:col-span-6 flex flex-col items-start text-left space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                isLightMode
                  ? 'bg-[#7c6af7]/8 border border-[#7c6af7]/20 text-[#6366f1]'
                  : 'bg-[#7c6af7]/10 border border-[#7c6af7]/25 text-[#a78bfa]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Intelligent Workspace Assistant
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className={`text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] transition-colors duration-300 ${
                isLightMode ? 'text-slate-900' : 'text-white'
              }`}
            >
              Stop Digging Through Slack. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#7c6af7] to-[#0ea5e9]">
                Ask AI Instead.
              </span>
            </motion.h1>

            {/* Official Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="inline-flex items-center gap-2 py-1 text-base md:text-lg lg:text-xl font-medium tracking-tight"
            >
              <Sparkles className="w-4.5 h-4.5 text-[#a78bfa] shrink-0 animate-pulse" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7c6af7] via-purple-400 to-[#6366f1] font-semibold">
                Turn Workspace Noise Into Actionable Intelligence.
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className={`text-[14px] md:text-[16px] max-w-xl leading-relaxed transition-colors duration-300 ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Search conversations, summarize channels, find decisions, and track action items across your entire workspace.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-wrap gap-4 pt-2"
            >
              <Link
                href={user ? "/dashboard" : "/login"}
                className="px-6 py-3.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:shadow-[0_6px_24px_rgba(124,106,247,0.45)] transition-all transform hover:scale-[1.02]"
              >
                Start Analyzing
              </Link>
              <button
                onClick={() => scrollTo('demo')}
                className={`px-6 py-3.5 rounded-xl text-[13px] font-bold border transition-all flex items-center gap-2 ${
                  isLightMode
                    ? 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    : 'border-white/10 hover:bg-white/5 text-slate-300'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Watch Demo
              </button>
            </motion.div>
          </div>

          {/* Right Column: Immersive 3D WebGL Scene */}
          <div className="lg:col-span-6 h-[340px] sm:h-[450px] lg:h-[650px] relative w-full rounded-3xl overflow-hidden">
            {/* Mockup Preview */}
            <motion.div style={{ opacity: opacityScene }} className="w-full h-full">
              <ThreeHeroScene />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ────────────────── SECTION 2: INTERACTIVE DEMO ────────────────── */}
      <section id="demo" className={`relative z-10 py-24 sm:py-32 transition-colors duration-500 ${
        isLightMode
          ? 'bg-gradient-to-b from-transparent via-slate-100/50 to-slate-100'
          : 'bg-gradient-to-b from-transparent via-[#05060a]/80 to-[#05060a]'
      }`}>
        <InteractiveDemoShowcase />
      </section>

      {/* ────────────────── SECTION 3: USE CASES GRID ────────────────── */}
      <section id="features" className={`relative z-10 py-24 px-6 lg:px-12 transition-colors duration-500 ${
        isLightMode ? 'bg-[#f8fafc]/50' : 'bg-[#05060a]'
      }`}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-7xl mx-auto w-full"
        >
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c6af7]">Use Cases</span>
            <h2 className={`text-3xl md:text-4xl font-extrabold transition-colors duration-300 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Supercharge your team's productivity</h2>
            <p className={`text-[14px] transition-colors duration-300 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Everything you need to capture decisions, track action items, and find information instantly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className={`group relative p-6 rounded-3xl border overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                    isLightMode
                      ? 'border-slate-100 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_50px_rgba(124,106,247,0.08)] hover:border-slate-200/80 text-slate-800'
                      : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Subtle hover gradient ring */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 100% 0%, ${feat.color}15 0%, transparent 60%)`,
                    }}
                  />

                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 border"
                    style={{
                      background: `${feat.color}10`,
                      borderColor: `${feat.color}25`,
                      color: feat.color,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className={`text-lg font-bold mb-2 transition-colors duration-300 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    {feat.title}
                  </h3>
                  
                  <p className={`text-[13px] leading-relaxed transition-colors duration-300 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 4: STORY SECTION ────────────────── */}
      <section id="story" className={`relative z-10 py-32 px-6 lg:px-12 transition-colors duration-500 ${
        isLightMode ? 'bg-[#f8fafc]' : 'bg-[#030408]'
      }`}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto w-full"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Story Visual */}
            <div className="lg:col-span-6 order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-[#7c6af7]/5 rounded-3xl blur-2xl pointer-events-none" />
              
              <div className={`glass p-6 rounded-3xl border ${
                isLightMode ? 'border-slate-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.04)] text-slate-800' : 'border-white/[0.06] bg-[#080911]/60 shadow-2xl'
              } space-y-6 relative z-10`}>
                
                {/* Simulated Slack Sidebar bubble */}
                <div className={`flex items-center gap-3 border-b pb-4 ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                    S
                  </div>
                  <div>
                    <h4 className={`text-[13px] font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Slack Workspace</h4>
                    <span className="text-[10px] text-slate-500">99+ unread messages</span>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold animate-pulse">
                    Vacation Mode Active
                  </span>
                </div>

                {/* User Prompt */}
                <div className="flex items-start gap-2.5 justify-end">
                  <div className={`border rounded-xl rounded-tr-none px-3.5 py-2 text-[11.5px] max-w-[80%] ${
                    isLightMode ? 'bg-[#7c6af7]/10 border-[#7c6af7]/20 text-slate-800' : 'bg-[#7c6af7]/15 border-[#7c6af7]/25 text-white'
                  }`}>
                    <span className="font-semibold">"What did I miss while I was out this week?"</span>
                  </div>
                </div>

                {/* AI Briefing */}
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#6366f1] flex items-center justify-center text-[9px] font-bold text-white">
                    <Zap className="w-3 h-3" fill="white" />
                  </div>
                  <div className={`flex-grow rounded-xl p-4 text-[11px] space-y-3 border ${
                    isLightMode ? 'bg-slate-50 border-slate-100 text-slate-700 shadow-sm' : 'bg-black/35 border-white/5 text-slate-300'
                  }`}>
                    <div className={`font-bold border-b pb-1.5 flex items-center justify-between ${isLightMode ? 'border-slate-200/50' : 'border-white/5'}`}>
                      <span>AI Catch-up Assistant</span>
                      <span className="text-[8.5px] text-[#7c6af7] font-semibold tracking-wider uppercase">Active Briefing</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-bold text-[#c084fc] block text-[9.5px] uppercase tracking-wider mb-0.5">⭐ Main Highlights</span>
                        <p className={`text-[10px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>The frontend team integrated a global theme toggler and optimized the user profile layout. David resolved an API scoping blocker with Slack sync.</p>
                      </div>
                      <div>
                        <span className="font-bold text-[#34d399] block text-[9.5px] uppercase tracking-wider mb-0.5">✓ Critical Decisions</span>
                        <p className={`text-[10px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>Migration to MySQL replica is approved; sqlite file was archived.</p>
                      </div>
                      <div>
                        <span className="font-bold text-[#fbbf24] block text-[9.5px] uppercase tracking-wider mb-0.5">⚠️ Upcoming Deadlines</span>
                        <div className={`flex items-center justify-between text-[9px] font-mono border px-2 py-1 rounded mt-0.5 ${
                          isLightMode ? 'text-slate-500 bg-slate-100 border-slate-200/50' : 'text-slate-400 bg-white/[0.02] border-white/5'
                        }`}>
                          <span>• Database load test staging run</span>
                          <span className="text-amber-500 font-bold">Due Tomorrow</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Story Copy */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#8b5cf6]/10 border border-[#8b5cf6]/25 text-[#c084fc]">
                Workplace Scenarios
              </span>
              
              <h2 className={`text-3xl md:text-5xl font-extrabold transition-colors duration-300 ${isLightMode ? 'text-slate-900' : 'text-white'} leading-tight`}>
                Catch up instantly after <br />
                time away.
              </h2>
              
              <p className={`text-[14.5px] leading-relaxed transition-colors duration-300 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Returning from vacation, parental leave, or a long weekend shouldn't mean spending your first morning reading thousands of chaotic unread Slack threads.
              </p>
              
              <p className={`text-[14.5px] leading-relaxed transition-colors duration-300 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Workspace AI acts as your communication copilot. Simply ask **"What did I miss?"** to get a structured briefing of summaries, decisions, blockers, and deadlines in under a minute.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 5: TRUST & METRICS ────────────────── */}
      <section id="metrics" className={`relative z-10 py-20 px-6 lg:px-12 transition-colors duration-500 ${
        isLightMode ? 'bg-[#f8fafc]' : 'bg-[#030408]'
      }`}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto w-full"
        >
          <div className={`glass p-8 lg:p-12 rounded-[40px] border backdrop-blur-md relative overflow-hidden transition-all duration-500 ${
            isLightMode ? 'border-slate-100 bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)]' : 'border-white/[0.06] bg-[#080911]/45'
          }`}>
            {/* Overlay grid lines */}
            <div className={`absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none ${
              isLightMode ? 'opacity-10' : ''
            }`} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 relative z-10 text-center">
              
              <div className="space-y-2">
                <p className={`text-3xl md:text-5xl font-extrabold transition-colors duration-300 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  <Counter value={100} />K+
                </p>
                <p className="text-[12px] uppercase tracking-wider font-semibold text-slate-500">
                  Messages Analyzed
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-3xl md:text-5xl font-extrabold text-[#7c6af7]">
                  <Counter value={95} />%
                </p>
                <p className="text-[12px] uppercase tracking-wider font-semibold text-slate-500">
                  Search Accuracy
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-3xl md:text-5xl font-extrabold text-[#0ea5e9]">
                  &lt; <Counter value={3} />s
                </p>
                <p className="text-[12px] uppercase tracking-wider font-semibold text-slate-500">
                  Summaries
                </p>
              </div>

              <div className="space-y-2">
                <p className={`text-3xl md:text-5xl font-extrabold transition-colors duration-300 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  <Counter value={10} />+
                </p>
                <p className="text-[12px] uppercase tracking-wider font-semibold text-slate-500">
                  Connected Channels
                </p>
              </div>

            </div>
          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 6: ENTERPRISE SECURITY ────────────────── */}
      <section id="security" className={`relative z-10 py-24 px-6 lg:px-12 transition-colors duration-500 ${
        isLightMode ? 'bg-[#f8fafc]' : 'bg-[#030408]'
      }`}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto w-full"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Copy */}
            <div className="lg:col-span-6 space-y-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#10b981]/10 border border-[#10b981]/25 text-[#34d399]">
                <Shield className="w-3.5 h-3.5" />
                Enterprise Grade Privacy
              </span>
              
              <h2 className={`text-3xl md:text-4xl font-extrabold transition-colors duration-300 ${isLightMode ? 'text-slate-900' : 'text-white'} leading-tight`}>
                Secure Connections, <br />
                Encrypted Data.
              </h2>
              
              <p className={`text-[14px] transition-colors duration-300 ${isLightMode ? 'text-slate-500' : 'text-slate-400'} leading-relaxed`}>
                We prioritize data privacy and workspace security above all else. Your Slack integrations run locally through the Model Context Protocol (MCP) server, keeping sensitive keys and message database contents inside your sandboxed system environment.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span className={`text-[13px] transition-colors duration-300 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Local credential encryption in environment files</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span className={`text-[13px] transition-colors duration-300 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Read-only API token configuration option</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span className={`text-[13px] transition-colors duration-300 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Compatible with open-source local LLMs & embedding engines</span>
                </div>
              </div>
            </div>

            {/* Architecture mockup */}
            <div className={`lg:col-span-6 p-8 rounded-3xl border transition-colors duration-300 ${
              isLightMode
                ? 'border-slate-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.04)] text-slate-800'
                : 'border-white/[0.06] bg-[#090b14]/50'
            } space-y-6`}>
              <div className={`flex items-center justify-between pb-4 border-b ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#7c6af7]">Secure Architecture</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              </div>

              <div className="space-y-4 text-[12px] font-mono">
                <div className={`p-4 rounded-xl border transition-colors ${
                  isLightMode ? 'bg-slate-50 border-slate-100 text-slate-800 shadow-sm' : 'bg-white/[0.02] border-white/5 text-slate-300'
                }`}>
                  <div className={`font-bold mb-1 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Slack Workspace API</div>
                  <div className={isLightMode ? 'text-slate-500' : 'text-slate-500'}>Secured via OAuth2 or local Bot User Tokens.</div>
                </div>

                <div className="flex justify-center my-1 text-slate-600 text-lg">↓</div>

                <div className={`p-4 rounded-xl border transition-colors ${
                  isLightMode ? 'bg-[#7c6af7]/5 border-[#7c6af7]/15' : 'bg-[#7c6af7]/5 border-[#7c6af7]/15'
                }`}>
                  <div className={`${isLightMode ? 'text-[#7c6af7]' : 'text-[#a78bfa]'} font-bold mb-1`}>Local MCP Slack Subprocess</div>
                  <div className={isLightMode ? 'text-slate-600' : 'text-slate-400'}>Strictly sandboxed execution loop runs commands on your network host.</div>
                </div>

                <div className="flex justify-center my-1 text-slate-600 text-lg">↓</div>

                <div className={`p-4 rounded-xl border transition-colors ${
                  isLightMode ? 'bg-slate-50 border-slate-100 text-slate-800 shadow-sm' : 'bg-white/[0.02] border-white/5 text-slate-300'
                }`}>
                  <div className={`font-bold mb-1 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>MySQL Vector / Embedded Database</div>
                  <div className={isLightMode ? 'text-slate-500' : 'text-slate-500'}>All summaries and vector embeddings stored  inside SQL cluster.</div>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 7: CTA FOOTER ────────────────── */}
      <footer className={`relative border-t transition-colors duration-500 z-10 ${
        isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-white/[0.05] bg-[#04050a]'
      } pt-10 pb-10 px-6 lg:px-12`}>

        {/* Footer copyright links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className={`max-w-6xl mx-auto w-full pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] font-medium transition-colors ${
            isLightMode ? 'border-slate-200 text-slate-500' : 'border-white/5 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#7c6af7] to-[#4f46e5] blur-sm opacity-50 scale-110" />
              <div className="relative w-6 h-6 rounded-lg bg-gradient-to-br from-[#9d8fff] via-[#7c6af7] to-[#4f46e5] p-[1px] shadow-[0_0_8px_rgba(124,106,247,0.5)]">
                <div className="w-full h-full rounded-[5px] bg-[#1a1730] flex items-center justify-center overflow-hidden">
                  <img
                    src="/slack-app-icon.png"
                    alt="Slack AI Workspace Assistant Logo"
                    className="w-3.5 h-3.5 object-contain"
                  />
                </div>
              </div>
            </div>
            <span>© 2026 Slack AI Workspace Assistant. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 pb-12 md:pb-0">
            <Link href="/support" className={`transition-colors ${isLightMode ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}>Support</Link>
            <Link href="/privacy" className={`transition-colors ${isLightMode ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}>Privacy Policy</Link>
            <Link href="/terms" className={`transition-colors ${isLightMode ? 'hover:text-slate-800' : 'hover:text-slate-300'}`}>Terms of Service</Link>
          </div>
        </motion.div>
      </footer>
      <MobileBottomBar />
    </div>
  );
}
