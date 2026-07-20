'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#06070d] text-white p-6 relative overflow-hidden font-sans selection:bg-[#7c6af7]/35">
      {/* Ambient Top Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.3) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center relative z-10 p-8 rounded-3xl border border-white/10 bg-[#0d0e16]/80 backdrop-blur-xl shadow-2xl flex flex-col items-center"
      >
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7c6af7] to-[#4f46e5] blur-lg opacity-60 scale-110" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9d8fff] via-[#7c6af7] to-[#4f46e5] p-0.5 shadow-[0_0_24px_rgba(124,106,247,0.6)]">
            <div className="w-full h-full rounded-[10px] bg-[#1a1730] flex items-center justify-center overflow-hidden">
              <img
                src="/slack-app-icon.png"
                alt="Slack AI Workspace Assistant Logo"
                className="w-11 h-11 object-contain"
              />
            </div>
          </div>
        </div>

        <span className="text-[11px] font-bold tracking-wider uppercase text-[#7c6af7] mb-1">
          Slack AI Workspace Assistant
        </span>

        <h1 className="text-5xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          404
        </h1>

        <p className="text-base font-semibold text-white mb-2">
          Page Not Found
        </p>

        <p className="text-xs text-[#a78bfa] font-medium mb-6">
          Turn Workspace Noise Into Actionable Intelligence.
        </p>

        <p className="text-xs text-slate-400 leading-relaxed mb-8">
          The page you are looking for does not exist or has been moved. Return to your workspace dashboard to continue analyzing team conversations.
        </p>

        <div className="flex items-center gap-3 w-full">
          <Link
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:shadow-[0_4px_20px_rgba(124,106,247,0.4)] transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </motion.div>

      <footer className="absolute bottom-6 text-center text-xs text-slate-500 font-mono">
        © 2026 Slack AI Workspace Assistant. All rights reserved.
      </footer>
    </div>
  );
}
