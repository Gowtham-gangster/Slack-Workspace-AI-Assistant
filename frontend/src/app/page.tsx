'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useRouter } from 'next/navigation';
import InteractiveDemoShowcase from '../components/InteractiveDemoShowcase';
import { 
  Sparkles, 
  MessageSquare, 
  Search, 
  Layers, 
  TrendingUp, 
  Shield, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  CheckSquare, 
  AlertCircle,
  BarChart3,
  Globe,
  Database,
  Lock,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '../components/AuthContext';

const ThreeHeroScene = dynamic(() => import('../components/ThreeHeroScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">
      Initializing WebGL Context...
    </div>
  )
});

// Helper component for counting animation
const Counter = ({ value, duration = 2 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const totalMs = duration * 1000;
    const stepMs = 30;
    const steps = totalMs / stepMs;
    const increment = (end - start) / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepMs);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
};

// Use cases definition
const useCases = [
  {
    icon: Search,
    color: '#7c6af7',
    title: 'Natural Language Search',
    desc: 'Query your entire Slack history using natural language. Find discussions, links, files, and key answers instantly.'
  },
  {
    icon: Layers,
    color: '#0ea5e9',
    title: 'Channel Summarization',
    desc: 'Condense hundred-message channels into clean, structured executive summaries with key highlights and key takeaways.'
  },
  {
    icon: CheckSquare,
    color: '#10b981',
    title: 'Action Item Extraction',
    desc: 'Automatically catch assigned tasks, deadlines, and responsibilities mentioned across project channels.'
  },
  {
    icon: TrendingUp,
    color: '#f59e0b',
    title: 'Sentiment & Health Analytics',
    desc: 'Monitor team sentiment, track activity velocity, and identify potential project blockers early.'
  },
  {
    icon: Globe,
    color: '#ec4899',
    title: 'Multi-Language Translation',
    desc: 'Translate message threads seamlessly across global team members while preserving context.'
  },
  {
    icon: Database,
    color: '#8b5cf6',
    title: 'Semantic Knowledge Graph',
    desc: 'Connect decisions to project outcomes and build an auto-updating organizational memory.'
  }
];

// Interactive scenario demo cards
const scenarios = [
  {
    category: 'Daily Catch-Up',
    icon: Clock,
    color: '#7c6af7',
    query: 'Summarize #general channel for today',
    type: 'summary',
    responseHeadline: 'Executive Summary — #general (Today)',
    responseData: [
      {
        type: 'summary',
        content: [
          'Frontend team deployed Dark Mode optimization across all core pages.',
          'Database migration scheduled for Friday 10:00 PM UTC.',
          'David resolved Slack OAuth token refreshing bug.'
        ]
      }
    ]
  },
  {
    category: 'Decision Tracking',
    icon: CheckSquare,
    color: '#10b981',
    query: 'What decisions were made about Database Migration?',
    type: 'decision',
    responseHeadline: 'Approved Decisions — Database Architecture',
    responseData: [
      {
        type: 'decision',
        content: {
          title: 'Migrate to MySQL Cluster with Replica Read Nodes',
          status: 'APPROVED',
          stakeholders: ['Engineering Lead', 'DevOps Team']
        }
      }
    ]
  },
  {
    category: 'Action Items',
    icon: Layers,
    color: '#f59e0b',
    query: 'Show pending tasks assigned to Alex',
    type: 'task',
    responseHeadline: 'Open Action Items — Alex',
    responseData: [
      {
        type: 'task',
        content: [
          { task: 'Prepare staging load-testing script', assignee: 'Alex' },
          { task: 'Update API OpenAPI specification docs', assignee: 'Alex' }
        ]
      }
    ]
  }
];

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Scroll bindings for animations
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"]
  });

  const opacityScene = useTransform(scrollYProgress, [0, 0.8, 1], [1, 1, 0.2]);

  const [activeStep, setActiveStep] = useState(1);

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

  if (loading) {
    return (
      <div ref={targetRef} className="fixed inset-0 w-full h-full flex flex-col items-center justify-center font-mono text-xs z-50 transition-colors duration-500 bg-[#030408] text-slate-300">
        <div className="w-8 h-8 border-2 border-[#7c6af7]/30 border-t-[#7c6af7] rounded-full animate-spin mb-3" />
        <span className="text-[11px] font-semibold text-[#7c6af7] animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div ref={targetRef} className="relative min-h-screen overflow-x-hidden selection:bg-[#7c6af7]/35 transition-colors duration-500 bg-[#030408] text-slate-300">
      
      {/* Immersive background glows */}
      <div className="absolute top-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full bg-[#7c6af7]/8 blur-[130px] pointer-events-none z-0 transition-opacity duration-500 opacity-100" />
      <div className="absolute bottom-[20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#0ea5e9]/4 blur-[150px] pointer-events-none z-0 transition-opacity duration-500 opacity-100" />
      <div className="absolute top-[40%] right-[10%] w-[45vw] h-[45vw] rounded-full bg-[#8b5cf6]/5 blur-[130px] pointer-events-none z-0 transition-opacity duration-500 opacity-100" />

      {/* FIXED NAV BAR */}
      <header className="fixed top-0 left-0 right-0 h-16 shrink-0 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl border-b transition-all duration-500 z-50 border-white/[0.05] bg-[#030408]/65">
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
            <span className="font-bold text-[14px] tracking-tight transition-colors duration-300 text-white">Slack AI</span>
            <span className="text-[10px] block text-[#7c6af7] font-semibold tracking-wider uppercase leading-none">WORKSPACE ASSISTANT</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium transition-colors duration-300 text-slate-400">
          <button onClick={() => scrollTo('demo')} className="hover:text-[#7c6af7] transition-colors cursor-pointer hover:text-white">Interactive Demo</button>
          <button onClick={() => scrollTo('features')} className="hover:text-[#7c6af7] transition-colors cursor-pointer hover:text-white">Use Cases</button>
          <button onClick={() => scrollTo('story')} className="hover:text-[#7c6af7] transition-colors cursor-pointer hover:text-white">Vacation Story</button>
          <button onClick={() => scrollTo('security')} className="hover:text-[#7c6af7] transition-colors cursor-pointer hover:text-white">Security</button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-[12px] font-semibold transition-all text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]"
          >
            Sign In
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border transition-all bg-white/5 border-white/10 text-slate-300"
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
            className="fixed top-16 left-0 right-0 z-40 p-6 border-b backdrop-blur-2xl md:hidden shadow-2xl bg-[#06070d]/95 border-white/10 text-white"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 bg-[#7c6af7]/10 border border-[#7c6af7]/25 text-[#a78bfa]"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Turn Workspace Noise Into Actionable Intelligence.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] transition-colors duration-300 text-white"
            >
              Stop Digging Through Slack. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#7c6af7] to-[#0ea5e9]">
                Ask AI Instead.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-[14px] md:text-[16px] max-w-xl leading-relaxed transition-colors duration-300 text-slate-400"
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
            </motion.div>
          </div>

          {/* Right Column: Immersive 3D WebGL Scene */}
          <div className="lg:col-span-6 h-[520px] sm:h-[560px] lg:h-[650px] relative w-full rounded-3xl overflow-hidden">
            {/* Mockup Preview */}
            <motion.div style={{ opacity: opacityScene }} className="w-full h-full">
              <ThreeHeroScene />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ────────────────── SECTION 2: INTERACTIVE DEMO ────────────────── */}
      <section id="demo" className="relative z-10 py-24 sm:py-32 transition-colors duration-500 bg-gradient-to-b from-transparent via-[#05060a]/80 to-[#05060a]">
        <InteractiveDemoShowcase />
      </section>

      {/* ────────────────── SECTION 3: USE CASES GRID ────────────────── */}
      <section id="features" className="relative z-10 py-24 px-6 lg:px-12 transition-colors duration-500 bg-[#05060a]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-7xl mx-auto w-full"
        >
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c6af7]">Use Cases</span>
            <h2 className="text-3xl md:text-4xl font-extrabold transition-colors duration-300 text-white">Supercharge your team's productivity</h2>
            <p className="text-[14px] transition-colors duration-300 text-slate-400">Everything you need to capture decisions, track action items, and find information instantly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="group relative p-6 rounded-3xl border overflow-hidden transition-all duration-300 hover:scale-[1.02] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02]"
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

                  <h3 className="text-lg font-bold mb-2 transition-colors duration-300 text-white">
                    {feat.title}
                  </h3>
                  
                  <p className="text-[13px] leading-relaxed transition-colors duration-300 text-slate-400">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 4: STORY SECTION ────────────────── */}
      <section id="story" className="relative z-10 py-32 px-6 lg:px-12 transition-colors duration-500 bg-[#030408]">
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
              
              <div className="glass p-6 rounded-3xl border border-white/[0.06] bg-[#080911]/60 shadow-2xl space-y-6 relative z-10">
                
                {/* Simulated Slack Sidebar bubble */}
                <div className="flex items-center gap-3 border-b pb-4 border-white/5">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                    S
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white">Slack Workspace</h4>
                    <span className="text-[10px] text-slate-500">99+ unread messages</span>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold animate-pulse">
                    Vacation Mode Active
                  </span>
                </div>

                {/* User Prompt */}
                <div className="flex items-start gap-2.5 justify-end">
                  <div className="border rounded-xl rounded-tr-none px-3.5 py-2 text-[11.5px] max-w-[80%] bg-[#7c6af7]/15 border-[#7c6af7]/25 text-white">
                    <span className="font-semibold">"What did I miss while I was out this week?"</span>
                  </div>
                </div>

                {/* AI Briefing */}
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#6366f1] flex items-center justify-center text-[9px] font-bold text-white">
                    <Zap className="w-3 h-3" fill="white" />
                  </div>
                  <div className="flex-grow rounded-xl p-4 text-[11px] space-y-3 border bg-black/35 border-white/5 text-slate-300">
                    <div className="font-bold border-b pb-1.5 flex items-center justify-between border-white/5">
                      <span>AI Catch-up Assistant</span>
                      <span className="text-[8.5px] text-[#7c6af7] font-semibold tracking-wider uppercase">Active Briefing</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-bold text-[#c084fc] block text-[9.5px] uppercase tracking-wider mb-0.5">⭐ Main Highlights</span>
                        <p className="text-[10px] leading-relaxed text-slate-300">The frontend team integrated a global theme toggler and optimized the user profile layout. David resolved an API scoping blocker with Slack sync.</p>
                      </div>
                      <div>
                        <span className="font-bold text-[#34d399] block text-[9.5px] uppercase tracking-wider mb-0.5">✓ Critical Decisions</span>
                        <p className="text-[10px] leading-relaxed text-slate-300">Migration to MySQL replica is approved; sqlite file was archived.</p>
                      </div>
                      <div>
                        <span className="font-bold text-[#fbbf24] block text-[9.5px] uppercase tracking-wider mb-0.5">⚠️ Upcoming Deadlines</span>
                        <div className="flex items-center justify-between text-[9px] font-mono border px-2 py-1 rounded mt-0.5 text-slate-400 bg-white/[0.02] border-white/5">
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
              
              <h2 className="text-3xl md:text-5xl font-extrabold transition-colors duration-300 text-white leading-tight">
                Catch up instantly after <br />
                time away.
              </h2>
              
              <p className="text-[14.5px] leading-relaxed transition-colors duration-300 text-slate-400">
                Returning from vacation, parental leave, or a long weekend shouldn't mean spending your first morning reading thousands of chaotic unread Slack threads.
              </p>
              
              <p className="text-[14.5px] leading-relaxed transition-colors duration-300 text-slate-400">
                Workspace AI acts as your communication copilot. Simply ask **"What did I miss?"** to get a structured briefing of summaries, decisions, blockers, and deadlines in under a minute.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 5: TRUST & METRICS ────────────────── */}
      <section id="metrics" className="relative z-10 py-20 px-6 lg:px-12 transition-colors duration-500 bg-[#030408]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto w-full"
        >
          <div className="glass p-8 lg:p-12 rounded-[40px] border backdrop-blur-md relative overflow-hidden transition-all duration-500 border-white/[0.06] bg-[#080911]/45">
            {/* Overlay grid lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 relative z-10 text-center">
              
              <div className="space-y-2">
                <p className="text-3xl md:text-5xl font-extrabold transition-colors duration-300 text-white">
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
                <p className="text-3xl md:text-5xl font-extrabold transition-colors duration-300 text-white">
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
      <section id="security" className="relative z-10 py-24 px-6 lg:px-12 transition-colors duration-500 bg-[#030408]">
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
              
              <h2 className="text-3xl md:text-4xl font-extrabold transition-colors duration-300 text-white leading-tight">
                Secure Connections, <br />
                Encrypted Data.
              </h2>
              
              <p className="text-[14px] transition-colors duration-300 text-slate-400 leading-relaxed">
                We prioritize data privacy and workspace security above all else. Your Slack integrations run locally through the Model Context Protocol (MCP) server, keeping sensitive keys and message database contents inside your sandboxed system environment.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span className="text-[13px] transition-colors duration-300 text-slate-300">Local credential encryption in environment files</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span className="text-[13px] transition-colors duration-300 text-slate-300">Read-only API token configuration option</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span className="text-[13px] transition-colors duration-300 text-slate-300">Compatible with open-source local LLMs & embedding engines</span>
                </div>
              </div>
            </div>

            {/* Architecture mockup */}
            <div className="lg:col-span-6 p-8 rounded-3xl border transition-colors duration-300 border-white/[0.06] bg-[#090b14]/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#7c6af7]">Secure Architecture</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              </div>

              <div className="space-y-4 text-[12px] font-mono">
                <div className="p-4 rounded-xl border transition-colors bg-white/[0.02] border-white/5 text-slate-300">
                  <div className="font-bold mb-1 text-white">Slack Workspace API</div>
                  <div className="text-slate-500">Secured via OAuth2 or local Bot User Tokens.</div>
                </div>

                <div className="flex justify-center my-1 text-slate-600 text-lg">↓</div>

                <div className="p-4 rounded-xl border transition-colors bg-[#7c6af7]/5 border-[#7c6af7]/15">
                  <div className="text-[#a78bfa] font-bold mb-1">Local MCP Slack Subprocess</div>
                  <div className="text-slate-400">Strictly sandboxed execution loop runs commands on your network host.</div>
                </div>

                <div className="flex justify-center my-1 text-slate-600 text-lg">↓</div>

                <div className="p-4 rounded-xl border transition-colors bg-white/[0.02] border-white/5 text-slate-300">
                  <div className="font-bold mb-1 text-white">MySQL Vector / Embedded Database</div>
                  <div className="text-slate-500">All summaries and vector embeddings stored inside SQL cluster.</div>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </section>

      {/* ────────────────── SECTION 7: CTA FOOTER ────────────────── */}
      <footer className="relative border-t transition-colors duration-500 z-10 border-white/[0.05] bg-[#04050a] pt-10 pb-10 px-6 lg:px-12">

        {/* Footer copyright links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto w-full pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] font-medium transition-colors border-white/5 text-slate-500"
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
            <Link href="/support" className="transition-colors hover:text-slate-300">Support</Link>
            <Link href="/privacy" className="transition-colors hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="transition-colors hover:text-slate-300">Terms of Service</Link>
          </div>
        </motion.div>
      </footer>

    </div>
  );
}
