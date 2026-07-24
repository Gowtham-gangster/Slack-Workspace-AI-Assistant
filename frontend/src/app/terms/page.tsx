'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  ArrowLeft,
  Scale,
  ShieldCheck,
  HeartHandshake,
  AlertTriangle,
  FileText,
  ChevronUp,
  ArrowUpRight,
  Sparkles,
  Server,
  UserCheck,
  Mail,
  Ban,
  Copyright,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import MobileBottomBar from '../../components/MobileBottomBar';

const LinkedInIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const sections = [
  { id: 'acceptance-of-terms', title: '1. Acceptance of Terms' },
  { id: 'user-accounts', title: '2. User Accounts' },
  { id: 'acceptable-use', title: '3. Acceptable Use Policy' },
  { id: 'ai-disclaimer', title: '4. AI Output Disclaimer' },
  { id: 'slack-integration', title: '5. Slack Integration' },
  { id: 'intellectual-property', title: '6. Intellectual Property' },
  { id: 'service-availability', title: '7. Service Availability' },
  { id: 'limitation-of-liability', title: '8. Limitation of Liability' },
  { id: 'account-termination', title: '9. Account Termination' },
  { id: 'changes-to-terms', title: '10. Changes to Terms' },
  { id: 'contact', title: '11. Contact Information' }
];

export default function TermsOfServicePage() {
  const { user } = useAuth();
  const isLightMode = false;

  const [activeSection, setActiveSection] = useState('acceptance-of-terms');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL || 'https://www.linkedin.com/in/pusuloorigowtham7505/';
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'pusuloorigowtham@outlook.com';

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
              <Scale className="w-4 h-4 text-primary" />
              <span>Terms Menu</span>
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
                        layoutId="activeDotTerms"
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
                <HeartHandshake className="w-4 h-4 text-primary" />
                <span>Fair Use Agreement</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                By accessing Slack AI Workspace Assistant, you agree to comply with these terms and acceptable use guidelines.
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
              <Scale className="w-3.5 h-3.5" />
              <span>Terms & Conditions Agreement</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
              Terms & Conditions
            </h1>

            <p className={`text-sm md:text-base leading-relaxed mb-4 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>
              These Terms & Conditions set out the rules and conditions for accessing and using the <strong>Slack AI Workspace Assistant</strong> platform, API services, and Slack integration features.
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
              <span>Last Updated: July 20, 2026</span>
              <span>•</span>
              <span>Effective Date: Immediate</span>
            </div>
          </motion.div>

          {/* Section 1: Acceptance of Terms */}
          <section id="acceptance-of-terms" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>1. Acceptance of Terms</span>
            </h2>
            
            <div className={`p-6 rounded-3xl border space-y-4 leading-relaxed text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                By creating an account, accessing, or using <strong>Slack AI Workspace Assistant</strong>, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions and our Privacy Policy.
              </p>
              <p>
                If you do not agree with any part of these terms, you must refrain from accessing or using our application.
              </p>
            </div>
          </section>

          {/* Section 2: User Accounts */}
          <section id="user-accounts" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              <span>2. User Accounts & Responsibilities</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>To use our services, you must register an account and maintain accurate credentials:</p>
              
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span><strong>Account Confidentiality:</strong> You are solely responsible for keeping your password and authentication token confidential.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span><strong>Account Activity:</strong> You are responsible for all activities, requests, and AI queries executed under your user credentials.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span><strong>Accurate Information:</strong> You agree to provide true, accurate, and current registration information.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3: Acceptable Use Policy */}
          <section id="acceptable-use" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Ban className="w-5 h-5 text-primary" />
              <span>3. Acceptable Use Policy</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>You agree not to misuse the application or assist others in doing so. You must NOT:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { title: 'AI Feature Abuse', desc: 'Executing automated spam scripts or rate-limit circumvention.' },
                  { title: 'Malicious Content', desc: 'Uploading viruses, malware, or harmful scripts.' },
                  { title: 'Unauthorized Access', desc: 'Attempting to breach security or access other users\' data.' },
                  { title: 'Reverse Engineering', desc: 'Decompiling, scraping, or reverse engineering backend APIs.' },
                  { title: 'Slack Scope Misuse', desc: 'Bypassing authorized Slack permissions or workspace consent.' },
                  { title: 'Spam & Harassment', desc: 'Using workspace notifications to send unsolicited messages.' }
                ].map((item, i) => (
                  <div key={i} className={`p-3.5 rounded-2xl border ${
                    isLightMode ? 'bg-rose-500/5 border-rose-500/15' : 'bg-rose-500/10 border-rose-500/20'
                  }`}>
                    <span className="font-bold text-rose-600 dark:text-rose-400 block mb-0.5">{item.title}</span>
                    <span className="text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 4: AI Output Disclaimer */}
          <section id="ai-disclaimer" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>4. AI Features & Output Disclaimer</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-4 text-sm ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                Our AI capabilities (summaries, action plans, decision tracking, and grammar checks) generate outputs based on probabilistic machine learning models.
              </p>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Disclaimer: AI-generated summaries and task suggestions are provided for informational assistance only. Users should review and verify critical business decisions before relying on them.</span>
              </div>
            </div>
          </section>

          {/* Section 5: Slack Integration */}
          <section id="slack-integration" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-primary" />
              <span>5. Slack Integration Permissions</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                Slack integration features depend entirely on OAuth 2.0 permissions granted by your workspace administrator. The application cannot access channels, files, or messages outside approved scopes.
              </p>
            </div>
          </section>

          {/* Section 6: Intellectual Property */}
          <section id="intellectual-property" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Copyright className="w-5 h-5 text-primary" />
              <span>6. Intellectual Property Rights</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                All rights, title, and interest in and to <strong>Slack AI Workspace Assistant</strong> (including source code, UI designs, brand logos, graphics, and architectural components) remain the exclusive intellectual property of the developer.
              </p>
            </div>
          </section>

          {/* Section 7: Service Availability */}
          <section id="service-availability" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <span>7. Service Availability & Maintenance</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                We strive to maintain high uptime and system availability. However, the platform may undergo occasional scheduled maintenance, software updates, or feature improvements without prior notice.
              </p>
            </div>
          </section>

          {/* Section 8: Limitation of Liability */}
          <section id="limitation-of-liability" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>8. Limitation of Liability</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                The application is provided on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis without warranties of any kind, express or implied. To the maximum extent permitted by law, the developer shall not be liable for indirect, incidental, or consequential damages resulting from platform use.
              </p>
            </div>
          </section>

          {/* Section 9: Account Termination */}
          <section id="account-termination" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Ban className="w-5 h-5 text-primary" />
              <span>9. Account Termination & Suspension</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                We reserve the right to suspend or terminate user accounts that violate our Acceptable Use Policy, engage in abuse, or attempt unauthorized system access.
              </p>
            </div>
          </section>

          {/* Section 10: Changes to Terms */}
          <section id="changes-to-terms" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <span>10. Changes to Terms</span>
            </h2>

            <div className={`p-6 rounded-3xl border space-y-3 text-sm leading-relaxed ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm text-slate-700' : 'bg-card/70 border-border/70 text-slate-300'
            }`}>
              <p>
                We may update these Terms & Conditions periodically to reflect feature additions, API updates, or legal compliance. Continued use of the service following updates constitutes acceptance of revised terms.
              </p>
            </div>
          </section>

          {/* Section 11: Contact Information */}
          <section id="contact" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <span>11. Contact Information</span>
            </h2>

            <div className={`p-6 md:p-8 rounded-3xl border space-y-6 ${
              isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-card/70 border-border/70'
            }`}>
              <p className="text-sm text-muted-foreground">
                If you have questions or legal inquiries regarding these Terms & Conditions, please contact us:
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
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomBar />
    </div>
  );
}
