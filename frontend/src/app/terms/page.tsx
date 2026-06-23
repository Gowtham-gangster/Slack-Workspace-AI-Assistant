'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Zap, ArrowLeft, Scale, ShieldCheck, HeartHandshake, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../components/AuthContext';

export default function TermsOfServicePage() {
  const { user } = useAuth();

  return (
    <div className="relative bg-[#030408] text-[#e8eaf0] selection:bg-[#7c6af7]/35 min-h-screen overflow-x-hidden font-sans">
      
      {/* Immersive background glows */}
      <div className="absolute top-[-10%] right-[5%] w-[50vw] h-[50vw] rounded-full bg-[#8b5cf6]/5 blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#7c6af7]/5 blur-[160px] pointer-events-none z-0" />

      {/* FIXED NAV BAR */}
      <header className="fixed top-0 left-0 right-0 h-16 shrink-0 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl border-b border-white/[0.05] bg-[#030408]/65 z-50">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#7c6af7] to-[#6366f1] shadow-[0_4px_16px_rgba(124,106,247,0.35)]">
            <Zap className="w-4.5 h-4.5 text-white" fill="white" />
          </div>
          <div>
            <span className="font-bold text-[14px] text-white tracking-tight">Slack AI</span>
            <span className="text-[10px] block text-[#7c6af7] font-semibold tracking-wider uppercase leading-none">Intelligence Engine</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 pt-32 pb-24 px-6 max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4 text-center mb-16"
        >
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#7c6af7]/10 border border-[#7c6af7]/25 text-[#a78bfa]">
            <Scale className="w-3.5 h-3.5" />
            Agreement Terms
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Terms of Service
          </h1>
          <p className="text-slate-400 text-[14px] font-mono">
            Last Updated: June 22, 2026
          </p>
        </motion.div>

        {/* Highlight Cards */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
        >
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center text-center space-y-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#7c6af7]/10 text-[#a78bfa] border border-[#7c6af7]/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-[15px]">Responsibility</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              You maintain all governance and operational authority over connected API scopes and credentials on your systems.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center text-center space-y-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0ea5e9]/10 text-[#38bdf8] border border-[#0ea5e9]/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-[15px]">Service Use</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Subject to these terms, we grant a non-exclusive license to operate our local indexing tools and visualization dashboards.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center text-center space-y-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#f43f5e]/10 text-[#f472b6] border border-[#f43f5e]/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-[15px]">Disclaimers</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              We offer analytics and summaries "as-is". Verify critical items manually before acting on AI decisions.
            </p>
          </div>
        </motion.div>

        {/* Legal Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="prose prose-invert max-w-none space-y-10 text-[14.5px] text-slate-300 leading-relaxed font-sans"
        >
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">01.</span>
              Acceptance of Terms
            </h2>
            <p>
              By accessing, integrating, or utilizing the <strong>Slack AI Workspace Assistant</strong> software, web console, or MCP plugins (collectively, the "Services"), you agree to compile with and be bound by these Terms of Service ("Terms"). If you represent an enterprise or entity, you represent that you possess authorization to bind such entity to these Terms.
            </p>
            <p>
              If you disagree with any portion of these provisions, you must immediately deactivate all Slack tokens, disconnect connected local databases, and discontinue use of the Services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">02.</span>
              License and Scope of Use
            </h2>
            <p>
              We grant you a limited, non-transferable, revocable license to deploy our database connector scripts, local Model Context Protocol (MCP) handlers, and frontend reporting UI within your designated workspace. This license is subject to the following strict conditions:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>You will not copy, modify, reverse engineer, or attempt to extract the source code of private frontend components unless explicitly permitted under open-source exceptions.</li>
              <li>You will not configure the background polling scheduler to make excessive API requests that intentionally throttle, block, or abuse Slack's developer guidelines.</li>
              <li>You agree to comply with Slack's developer terms of service when configuring token permissions.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">03.</span>
              Host Sandboxing & Database Security
            </h2>
            <p>
              Because our solution runs database indexes (such as local MySQL tables or local vector directories) inside your own server environment, you acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li><strong>Environment Configuration:</strong> You are solely responsible for securing files containing database secrets, OAuth credentials, and API environment variables.</li>
              <li><strong>Local Infrastructure Maintenance:</strong> We are not liable for database index corruption, data loss within your local cluster, or unauthorized access to local ports or MCP processes on your network.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">04.</span>
              AI Summarizations & Accuracy Disclaimer
            </h2>
            <p>
              The Slack AI Workspace Assistant uses natural language models to compile conversation insights, assign tasks, and categorize sentiment.
            </p>
            <div className="p-4 rounded-xl border border-yellow-500/15 bg-yellow-500/5 text-slate-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-[12.5px] leading-relaxed">
                <strong>CRITICAL NOTICE:</strong> Artificial intelligence outputs can occasionally manifest inaccuracies, hallucinations, or misattributions. The automatically generated action items, timeline summaries, and insights represent machine estimations. You must independently audit and verify all critical engineering directions, system plans, and timeline schedules before execution.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">05.</span>
              Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WE OR OUR DEVELOPERS BE LIABLE FOR ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF BUSINESS PROFITS, DATA LEAKS, SYSTEM INTEGRITY LOSS, OR ANY OTHER PECUNIARY LOSS) ARISING OUT OF THE USE OR INABILITY TO USE THIS PRODUCT.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">06.</span>
              Modifications and Contact
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. Updates will be indicated by a revision of the "Last Updated" date at the top of this document. Continued use of the service following modifications constitutes your agreement to the updated Terms.
            </p>
            <p>
              For legal inquiries or technical assistance, contact the developer desk or email legal@slack-ai-assistant.local.
            </p>
          </section>
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="relative border-t border-white/[0.05] bg-[#04050a] py-12 px-6 lg:px-12 z-10">
        <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#7c6af7] to-[#6366f1]">
              <Zap className="w-3.5 h-3.5 text-white" fill="white" />
            </div>
            <span>© 2026 Slack AI Workspace Assistant. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
