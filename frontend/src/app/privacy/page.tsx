'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  CheckCircle2,
  FileText,
  ChevronUp,
  Sun,
  Moon,
  ArrowUpRight,
  Sparkles,
  Server,
  Database,
  UserCheck,
  Cookie,
  Mail
} from 'lucide-react';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import MobileBottomBar from '../../components/MobileBottomBar';

const LinkedInIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const sections = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'information-we-collect', title: '2. Information We Collect' },
  { id: 'how-we-use', title: '3. How We Use Information' },
  { id: 'ai-features', title: '4. AI Features & Data Processing' },
  { id: 'slack-integration', title: '5. Slack Integration & Scopes' },
  { id: 'data-security', title: '6. Data Security & Encryption' },
  { id: 'cookies', title: '7. Cookies & Local Storage' },
  { id: 'third-party-services', title: '8. Third-Party Services' },
  { id: 'user-rights', title: '9. Your Rights & Choices' },
  { id: 'contact', title: '10. Contact Information' }
];

export default function PrivacyPolicyPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isLightMode = theme === 'light';

  const [activeSection, setActiveSection] = useState('introduction');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL || 'https://www.linkedin.com/in/pusuloorigowtham7505/';
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@slackai.app';

  // Track scroll progress and active section
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
      setShowBackToTop(window.scrollY > 300);

      // Section intersection detection
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
      if (isAtBottom) {
        setActiveSection(sections[sections.length - 1].id);
        return;
      }

      const scrollPosition = window.scrollY + 250;
      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i].id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans relative overflow-x-hidden selection:bg-primary/30 ${
      isLightMode ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#06070d] text-slate-100'
    }`}>
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-transparent z-[100]">
        <div
          className="h-full bg-gradient-to-r from-primary via-accent to-purple-500 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Ambient Top Glow */}
      <div className="absolute top-0 left-0 right-0 h-96 pointer-events-none z-0"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.18) 0%, transparent 70%)' }} />

      {/* FIXED PUBLIC HEADER */}
      <header className={`fixed top-0 left-0 right-0 h-16 shrink-0 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl border-b z-50 transition-all duration-300 ${
        isLightMode ? 'border-slate-200/60 bg-white/75 shadow-sm' : 'border-white/[0.08] bg-[#06070d]/70'
      }`}>
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
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
            <span className={`font-bold text-[14px] tracking-tight block ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Slack AI</span>
            <span className="text-[10px] block text-[#7c6af7] font-semibold tracking-wider uppercase leading-none">WORKSPACE ASSISTANT</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all text-muted-foreground hover:text-foreground ${
              isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
            }`}
            aria-label="Toggle Theme"
          >
            {isLightMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-primary" />}
          </button>

          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isLightMode 
                ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm' 
                : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      {/* Mobile Sticky Table of Contents Dropdown */}
      <div className={`lg:hidden sticky top-16 z-30 px-4 py-2.5 border-b backdrop-blur-xl transition-colors ${
        isLightMode ? 'bg-white/90 border-slate-200' : 'bg-[#06070d]/90 border-white/10'
      }`}>
        <div className="flex items-center gap-2 max-w-7xl mx-auto">
          <FileText className="w-4 h-4 text-[#7c6af7] shrink-0" />
          <select
            value={activeSection}
            onChange={(e) => scrollToSection(e.target.value)}
            className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none transition-colors ${
              isLightMode ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'
            }`}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id} className={isLightMode ? 'bg-white text-slate-800' : 'bg-[#0a0b14] text-white'}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Page Layout with Constant Fixed Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-20 z-10 flex gap-12">

        {/* Desktop Constant Fixed Table of Contents Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 relative">
          <div className="fixed top-24 w-64 space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Table of Contents</span>
            </div>

            <nav className="space-y-1">
              {sections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between group cursor-pointer ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                        : isLightMode
                        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{section.title}</span>
                    {isActive && (
                      <motion.span
                        layoutId="activeDot"
                        className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className={`p-4 rounded-2xl border text-xs space-y-2 mt-6 ${
              isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Privacy Guarantee</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your data is used strictly to power your AI Workspace Assistant. We never sell your personal data.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 max-w-3xl min-w-0">
          
          {/* Header Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12 border-b border-border/50 pb-8"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono mb-4 border"
                 style={{
                   background: 'rgba(124,106,247,0.1)',
                   borderColor: 'rgba(124,106,247,0.2)',
                   color: '#7c6af7'
                 }}>
              <Shield className="w-3.5 h-3.5" />
              <span>Legal & Privacy Statement</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
              Privacy Policy
            </h1>

            <p className={`text-sm md:text-base leading-relaxed mb-4 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>
              This Privacy Policy explains how <strong>Slack AI Workspace Assistant</strong> collects, uses, protects, and handles your information when you interact with our application, services, and integrated Slack workspace features.
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
              <span>Last Updated: July 20, 2026</span>
              <span>•</span>
              <span>Effective Date: Immediate</span>
            </div>
          </motion.div>

          {/* Section 1: Introduction */}
          <section id="introduction" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <span>1. Introduction</span>
            </h2>
            
            <div className={`p-6 rounded-3xl border space-y-4 leading-relaxed text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                Welcome to <strong>Slack AI Workspace Assistant</strong>. We respect your privacy and are committed to protecting the personal data and workspace information you share with us.
              </p>
              <p>
                This policy outlines our transparent data practices. We collect and process only the minimal information strictly necessary to provide intelligent workspace assistance, automated summaries, decision tracking, and seamless team collaboration.
              </p>
            </div>
          </section>

          {/* Section 2: Information We Collect */}
          <section id="information-we-collect" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <span>2. Information We Collect</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>Depending on your interactions with the application, we collect the following categories of data:</p>
              
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { title: 'Identity & Contact', desc: 'Full Name, Email Address, Account credentials' },
                  { title: 'Account Profile', desc: 'Avatar URL, User ID, Profile bio, preferences' },
                  { title: 'Workspace Context', desc: 'Connected Slack Team ID, Workspace Name, Icon' },
                  { title: 'Slack OAuth Tokens', desc: 'User & Bot access tokens (encrypted at rest)' },
                  { title: 'Messages & Content', desc: 'Channel messages needed for requested AI features' },
                  { title: 'Uploaded Files', desc: 'Documents, attachments, code snippets for analysis' },
                  { title: 'Notification Rules', desc: 'Email reminder schedules, channel alerts' },
                  { title: 'System Diagnostics', desc: 'Error logs, browser type, request metadata' }
                ].map((item, idx) => (
                  <li key={idx} className={`p-3.5 rounded-2xl border text-xs ${
                    isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}>
                    <span className="font-bold text-foreground block mb-0.5">{item.title}</span>
                    <span className="text-muted-foreground">{item.desc}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Password Security Note: All account passwords are encrypted using bcrypt salt hashing. We never store or display plaintext passwords.</span>
              </div>
            </div>
          </section>

          {/* Section 3: How We Use Information */}
          <section id="how-we-use" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              <span>3. How We Use Your Information</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>We process your data strictly to operate and enhance our application. Purpose of processing includes:</p>
              
              <div className="space-y-2 pt-2">
                {[
                  'Secure Authentication: Authenticating your login sessions and verifying account ownership.',
                  'Workspace AI Assistance: Generating channel summaries, key decisions, action plans, and risk metrics.',
                  'Slack Synchronization: Fetching authorized messages and channels to power team intelligence features.',
                  'Email Notifications: Dispatching password reset links, reminder alerts, and support responses.',
                  'System Optimization: Monitoring system uptime, diagnosing bugs, and enhancing performance.',
                  'Product Improvement: Refining user experience, interface responsiveness, and feature usability.'
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 4: AI Features & Data Processing */}
          <section id="ai-features" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>4. AI Features & Data Processing</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                Our application incorporates advanced artificial intelligence to deliver high-value workspace capabilities, including:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: 'Channel Summarization', desc: 'Condensing lengthy Slack threads into clear executive highlights.' },
                  { title: 'Action Item Extraction', desc: 'Automatically identifying tasks, assignees, and deadlines.' },
                  { title: 'Sentiment & Health Analytics', desc: 'Evaluating workspace engagement and team sentiment trends.' },
                  { title: 'Grammar & Tone Refinement', desc: 'Improving clarity and tone in message compositions.' },
                  { title: 'Multi-Language Translation', desc: 'Translating team messages across international languages.' },
                  { title: 'Semantic Knowledge Graph', desc: 'Mapping topics, decisions, and project entities.' }
                ].map((item, i) => (
                  <div key={i} className={`p-3.5 rounded-2xl border text-xs ${
                    isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}>
                    <span className="font-bold text-foreground block mb-0.5">{item.title}</span>
                    <span className="text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                <strong>Important:</strong> AI model processing is performed ephemerally solely to fulfill user-initiated requests. Your workspace messages are never used to train public, foundation AI models.
              </p>
            </div>
          </section>

          {/* Section 5: Slack Integration & Scopes */}
          <section id="slack-integration" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-primary" />
              <span>5. Slack Integration & Scopes</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                When you connect Slack to the application, we interact with Slack Web APIs using OAuth 2.0. We access only the permissions explicitly authorized by workspace administrators and users during the connection consent flow.
              </p>
              
              <p className="text-xs text-muted-foreground">
                We do not access, read, or store data outside your approved scopes. You can revoke access at any time through your Slack Workspace App Management settings or via our application settings page.
              </p>
            </div>
          </section>

          {/* Section 6: Data Security & Encryption */}
          <section id="data-security" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <span>6. Data Security & Encryption</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                We employ technical and organizational safeguards to protect your data against unauthorized access, loss, or alteration:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { title: 'HTTPS / TLS Encryption', desc: 'All data transferred between client and server is encrypted in transit using TLS 1.3.' },
                  { title: 'Password Hashing', desc: 'Passwords hashed with bcrypt (salt factor 10+) before database storage.' },
                  { title: 'JWT Access Tokens', desc: 'Stateless, short-lived JSON Web Tokens with cryptographically signed secrets.' },
                  { title: 'Access Controls', desc: 'Role-based access rules limiting data access strictly to authorized users.' }
                ].map((sec, i) => (
                  <div key={i} className={`p-3.5 rounded-2xl border ${
                    isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}>
                    <span className="font-bold text-foreground block mb-0.5">{sec.title}</span>
                    <span className="text-muted-foreground">{sec.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 7: Cookies & Local Storage */}
          <section id="cookies" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Cookie className="w-5 h-5 text-primary" />
              <span>7. Cookies & Local Storage</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                We use browser local storage and essential session tokens exclusively for functionality, including:
              </p>
              <ul className="list-disc pl-5 text-xs space-y-1 text-muted-foreground">
                <li>Maintaining authenticated user login sessions (`auth_token`).</li>
                <li>Persisting dark/light theme preferences (`app-theme-mode`).</li>
                <li>Remembering user UI layout states (e.g. collapsed sidebar preference).</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                We do not use third-party tracking cookies or sell behavioral tracking data to advertising networks.
              </p>
            </div>
          </section>

          {/* Section 8: Third-Party Services */}
          <section id="third-party-services" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-primary" />
              <span>8. Third-Party Services</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                To provide enterprise-grade reliability, we utilize trusted cloud service providers:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { name: 'Slack API', role: 'Workspace communication integration' },
                  { name: 'OpenAI API', role: 'Intelligence processing & summarization' },
                  { name: 'Resend / SMTP', role: 'Transactional email delivery & reminders' },
                  { name: 'Railway', role: 'Backend API application hosting & MySQL DB' },
                  { name: 'Vercel', role: 'Next.js frontend application deployment' }
                ].map((tp, idx) => (
                  <div key={idx} className={`p-3.5 rounded-2xl border ${
                    isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}>
                    <span className="font-bold text-foreground block mb-0.5">{tp.name}</span>
                    <span className="text-muted-foreground">{tp.role}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Each service provider operates under its own privacy policy governing data handling.
              </p>
            </div>
          </section>

          {/* Section 9: Your Rights & Choices */}
          <section id="user-rights" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-primary" />
              <span>9. Your Rights & Choices</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>You have full control over your personal data:</p>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Access & Update:</strong> Modify your profile info and password directly in your Profile settings.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Disconnect Slack:</strong> Unlink Slack integration anytime via Workspace Settings.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Account Deletion:</strong> Permanently delete your user account and stored data via Profile settings.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 10: Contact Information */}
          <section id="contact" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <span>10. Contact Information</span>
            </h2>

            <div className={`p-6 md:p-8 rounded-3xl border space-y-6 ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-card/70 border-border/70'
            }`}>
              <p className="text-sm text-muted-foreground">
                If you have questions, feedback, or privacy requests regarding this policy, feel free to contact us:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  href="/support"
                  className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${
                    isLightMode
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-muted-foreground block font-bold">Help & Support</span>
                    <span className="text-xs font-semibold truncate flex items-center gap-1">
                      <span>Contact Support Team</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>

                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${
                    isLightMode
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0a66c2]/10 border border-[#0a66c2]/20 flex items-center justify-center text-[#0a66c2] shrink-0">
                    <LinkedInIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-muted-foreground block font-bold">LinkedIn Profile</span>
                    <span className="text-xs font-semibold truncate flex items-center gap-1">
                      <span>Developer Profile</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className={`fixed bottom-20 right-6 z-40 p-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all cursor-pointer ${
              isLightMode
                ? 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'
                : 'bg-[#141624]/90 border-white/10 text-white hover:bg-[#181a2e]'
            }`}
            title="Back to top"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Public Footer */}
      <footer className={`border-t py-6 px-6 lg:px-12 text-xs transition-colors relative z-10 ${
        isLightMode ? 'border-slate-200 text-slate-500 bg-white/70' : 'border-white/10 text-slate-500 bg-black/40'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 Slack AI Workspace Assistant. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomBar />
    </div>
  );
}
