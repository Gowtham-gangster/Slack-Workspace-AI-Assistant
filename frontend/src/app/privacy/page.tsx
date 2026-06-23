'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Zap, ArrowLeft, Shield, Lock, Eye, ScrollText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../components/AuthContext';

export default function PrivacyPolicyPage() {
  const { user } = useAuth();

  return (
    <div className="relative bg-[#030408] text-[#e8eaf0] selection:bg-[#7c6af7]/35 min-h-screen overflow-x-hidden font-sans">
      
      {/* Immersive background glows */}
      <div className="absolute top-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full bg-[#7c6af7]/5 blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#0ea5e9]/5 blur-[160px] pointer-events-none z-0" />

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
            <Shield className="w-3.5 h-3.5" />
            Privacy Protection
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Privacy Policy
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
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-[15px]">Local Execution</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              We leverage the Model Context Protocol (MCP) to run indexing processes locally or within your secure host environment.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center text-center space-y-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0ea5e9]/10 text-[#38bdf8] border border-[#0ea5e9]/20">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-[15px]">Strict Permissions</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              We only access channels and logs you explicitly connect. No stealth data mining or backend cross-tenant indexing.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center text-center space-y-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#10b981]/10 text-[#34d399] border border-[#10b981]/20">
              <ScrollText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-[15px]">Data Transparency</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Complete control over your database configuration (such as local MySQL or vector store) with clean purging tools.
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
              Introduction & Scope
            </h2>
            <p>
              Welcome to <strong>Slack AI Workspace Assistant</strong> ("we," "our," or "us"). We are committed to safeguarding your privacy and protecting the information generated during your team's workspace operations. This Privacy Policy details how we handle, index, store, and utilize data when you integrate our workspace analytics platform with your Slack API or Model Context Protocol (MCP) servers.
            </p>
            <p>
              By installing the integration, setting up the intelligence agent, or accessing our web dashboard, you consent to the collections and data practices outlined in this policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">02.</span>
              Information We Collect
            </h2>
            <p>
              To offer intelligent summarizations, vector searches, and project dashboards, we process specific communication artifacts from your connected Slack workspace:
            </p>
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-[#7c6af7] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white text-[13px] block">Workspace Tokens & Configuration Keys</span>
                  <span className="text-slate-400 text-[12.5px]">OAuth tokens, bot authorization credentials, and database connection strings. These are encrypted locally in your settings files.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-[#7c6af7] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white text-[13px] block">Slack Messages & Thread Structure</span>
                  <span className="text-slate-400 text-[12.5px]">Raw text content, timestamps, channel IDs, thread relations, and member handles from the channels you explicitly designate for indexing.</span>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-[#7c6af7] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white text-[13px] block">Analytical Metadata</span>
                  <span className="text-slate-400 text-[12.5px]">Derived counts, contribution speeds, theme classifications, and vector embedding representations calculated by our background parsers.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">03.</span>
              How We Use the Information
            </h2>
            <p>
              Collected intelligence logs serve only to deliver the application's core capabilities:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>Generating semantic indexes for workspace conversation search.</li>
              <li>Compiling automated summaries of long discussions and Slack threads.</li>
              <li>Detecting and auto-creating task lists and assigning owners based on message context.</li>
              <li>Calculating team contribution metrics and velocity charts on your private dashboard.</li>
              <li>Improving local natural language parser accuracy without uploading training logs to public models.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">04.</span>
              Data Protection & Storage Architecture
            </h2>
            <p>
              We operate under a <strong>sandbox-first local-storage philosophy</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li><strong>Local Data Control:</strong> Your Slack conversation databases and vector representations are kept locally on your host machines or inside your isolated MySQL instances. We do not host your Slack database on external cloud services.</li>
              <li><strong>API Transmission Security:</strong> When communicating with public AI endpoints (e.g., OpenAI or Anthropic API services) for language parsing, data is encrypted in transit via TLS 1.3 and is governed by those providers' strict API data retention policies (which explicitly disallow using prompt data for base model training).</li>
              <li><strong>Access Control:</strong> System passwords, API tokens, and workspace authorization cookies are encrypted locally using cryptographic wrappers before storage.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">05.</span>
              Your Choices and Data Purging
            </h2>
            <p>
              You maintain complete sovereignty over your organization's records. Through the dashboard's <Link href="/settings" className="text-[#a78bfa] hover:underline">Settings Panel</Link>, you can:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>Selectively add or remove channels from active indexing routines.</li>
              <li>Wipe cached summary logs and clear the local vector memory entirely.</li>
              <li>Revoke the Slack bot integration, immediately terminating all background polling routines.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[#7c6af7] font-mono text-[14px]">06.</span>
              Contact Us
            </h2>
            <p>
              If you have any questions or feedback regarding this Privacy Policy, or if you need assistance in configuring your local MCP sandbox to maximize data protection, please contact us at:
            </p>
            <p className="font-mono text-[13px] text-slate-400 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              Email: security@slack-ai-assistant.local<br />
              Developer Desk: C:\Users\P Gowtham\.gemini\antigravity\scratch\slack-ai-workspace-assistant
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
