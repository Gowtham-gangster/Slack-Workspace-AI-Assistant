'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion';
import {
  Home,
  LayoutDashboard,
  ArrowRight,
  Sparkles,
  Search,
  MessageSquare,
  Hash,
  Shield,
  Menu,
  X,
  FileQuestion,
  Zap,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';

export default function NotFound() {
  // Gracefully handle auth context if accessed inside or outside AuthProvider
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    user = null;
  }

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Set document title dynamically on client
  useEffect(() => {
    document.title = '404 | Slack AI Workspace Assistant';
  }, []);

  // Prevent body scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Framer Motion animation variants for mobile menu
  const mobileMenuVariants: Variants = {
    closed: {
      opacity: 0,
      y: -15,
      transition: {
        duration: 0.2,
        ease: 'easeInOut'
      }
    },
    open: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
        staggerChildren: 0.05,
        delayChildren: 0.05
      }
    }
  };

  const menuItemVariants: Variants = {
    closed: { opacity: 0, x: -10 },
    open: { opacity: 1, x: 0 }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-[#030408] text-white selection:bg-[#7c6af7]/35 font-sans">
      {/* ────────────────── 1. BACKGROUND VIDEO & DARK OVERLAY ────────────────── */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/slack-app-icon.png"
          className="absolute inset-0 w-full h-full object-cover opacity-35 scale-105 pointer-events-none z-0"
        >
          <source src="/404-bg.mp4" type="video/mp4" />
          <source
            src="https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-grid-in-blue-and-purple-43187-large.mp4"
            type="video/mp4"
          />
        </video>
        {/* Subtle Dark Overlay to improve contrast and readability without blurring */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030408]/90 via-[#06070d]/80 to-[#030408]/95 z-0" />
        <div className="absolute inset-0 bg-[#030408]/40 z-0" />

        {/* Ambient Top Glow Spotlights */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full pointer-events-none z-0 opacity-40 blur-[140px]"
          style={{
            background: 'radial-gradient(circle, rgba(124,106,247,0.35) 0%, rgba(79,70,229,0.15) 50%, transparent 70%)'
          }}
        />
      </div>

      {/* ────────────────── 2. NAVIGATION ────────────────── */}
      <header className="relative z-50 w-full h-16 shrink-0 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl border-b border-white/[0.06] bg-[#030408]/65">
        {/* Left: App Logo & Name */}
        <Link href="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded-xl p-1">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#4f46e5] blur-md opacity-60 group-hover:opacity-100 transition-opacity scale-110" />
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
            <span className="font-bold text-[14px] tracking-tight text-white block leading-tight">Slack AI</span>
            <span className="text-[9.5px] block text-[#7c6af7] font-semibold tracking-wider uppercase leading-none">WORKSPACE ASSISTANT</span>
          </div>
        </Link>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-slate-400">
          <Link href="/" className="hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded-md px-1 py-0.5">
            Interactive Demo
          </Link>
          <Link href="/#features" className="hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded-md px-1 py-0.5">
            Features
          </Link>
          <Link href="/#security" className="hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded-md px-1 py-0.5">
            Security
          </Link>
          <Link href="/support" className="hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded-md px-1 py-0.5">
            Support
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded-md px-1 py-0.5">
            Privacy
          </Link>
        </nav>

        {/* Right: Sign In / Dashboard Button & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          <Link
            href={user ? '/dashboard' : '/login'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7]"
          >
            <span>{user ? 'Go to Dashboard' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7]"
            aria-label="Toggle Navigation Menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ────────────────── MOBILE MENU DRAWER ────────────────── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={mobileMenuVariants}
            className="fixed top-16 left-0 right-0 z-40 p-6 border-b border-white/10 bg-[#06070d]/95 backdrop-blur-2xl md:hidden shadow-2xl flex flex-col gap-4 text-sm font-medium text-slate-300"
          >
            <motion.div variants={menuItemVariants}>
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 border-b border-white/5 hover:text-white transition-colors">
                Interactive Demo
              </Link>
            </motion.div>
            <motion.div variants={menuItemVariants}>
              <Link href="/#features" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 border-b border-white/5 hover:text-white transition-colors">
                Features
              </Link>
            </motion.div>
            <motion.div variants={menuItemVariants}>
              <Link href="/#security" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 border-b border-white/5 hover:text-white transition-colors">
                Security
              </Link>
            </motion.div>
            <motion.div variants={menuItemVariants}>
              <Link href="/support" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 border-b border-white/5 text-[#7c6af7] hover:text-[#a78bfa] transition-colors">
                Support
              </Link>
            </motion.div>
            <motion.div variants={menuItemVariants}>
              <Link href="/privacy" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 border-b border-white/5 hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </motion.div>
            <motion.div variants={menuItemVariants}>
              <Link href="/terms" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 hover:text-white transition-colors">
                Terms & Conditions
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────── 3. FLOATING GRAPHICS & CENTERED HERO ────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center py-12 lg:py-16 max-w-6xl mx-auto w-full">
        {/* Floating Illustration Card 1: Slack Message (Top Left) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0, y: [0, -10, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden lg:flex absolute top-10 left-4 xl:-left-6 z-10 p-3.5 rounded-2xl border border-white/10 bg-[#0d0e16]/85 backdrop-blur-xl shadow-2xl items-center gap-3 w-72 text-left"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            P
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-bold text-white">Priya</span>
              <span className="text-[9px] text-[#fbbf24] bg-[#fbbf24]/10 px-1.5 py-0.2 rounded font-mono">#general</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate font-mono">Where did this page go? 🔍</p>
          </div>
          <span className="text-[9px] font-bold text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 px-1.5 py-0.5 rounded">404</span>
        </motion.div>

        {/* Floating Illustration Card 2: AI Sparkle Status (Top Right) */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0, y: [0, 12, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden lg:flex absolute top-12 right-4 xl:-right-6 z-10 p-3.5 rounded-2xl border border-white/10 bg-[#0d0e16]/85 backdrop-blur-xl shadow-2xl flex-col gap-2 w-64 text-left"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#7c6af7] animate-pulse" />
              Workspace AI Copilot
            </span>
            <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-ping" />
          </div>
          <p className="text-[10.5px] text-slate-400 font-mono">Querying workspace index...</p>
          <div className="flex items-center justify-between text-[9.5px] text-slate-500 font-mono">
            <span>Result:</span>
            <span className="text-[#a78bfa] font-bold">0 matches (Route Missing)</span>
          </div>
        </motion.div>

        {/* Floating Illustration Card 3: Workspace Channel Badge (Bottom Left) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden xl:flex absolute bottom-12 left-2 z-10 p-3 rounded-xl border border-white/10 bg-[#0d0e16]/85 backdrop-blur-xl shadow-xl items-center gap-2.5 text-xs text-slate-300"
        >
          <div className="w-6 h-6 rounded-lg bg-[#7c6af7]/15 border border-[#7c6af7]/25 flex items-center justify-center text-[#a78bfa]">
            <Hash className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-[11px]">#db-migration</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
        </motion.div>

        {/* Floating Illustration Card 4: Search & Magnifying Glass (Bottom Right) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, 10, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden xl:flex absolute bottom-12 right-2 z-10 p-3 rounded-xl border border-white/10 bg-[#0d0e16]/85 backdrop-blur-xl shadow-xl items-center gap-2.5 text-xs text-slate-300"
        >
          <div className="w-6 h-6 rounded-lg bg-[#0ea5e9]/15 border border-[#0ea5e9]/25 flex items-center justify-center text-[#38bdf8]">
            <Search className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-[11px] text-slate-400">Searching route...</span>
          <span className="text-[10px] font-mono font-bold text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded">
            HTTP 404
          </span>
        </motion.div>

        {/* CENTER HERO CONTENT CONTAINER */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 max-w-2xl mx-auto flex flex-col items-center"
        >
          {/* Official Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide text-[#a78bfa] bg-[#7c6af7]/10 border border-[#7c6af7]/25 shadow-[0_0_20px_rgba(124,106,247,0.2)] mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#7c6af7] animate-pulse" />
            <span>Turn Workspace Noise Into Actionable Intelligence.</span>
          </div>

          {/* Large Glowing 404 Heading */}
          <div className="relative mb-2 select-none">
            {/* Background text glow */}
            <div className="absolute inset-0 blur-3xl opacity-60 bg-gradient-to-r from-[#7c6af7] via-[#6366f1] to-[#0ea5e9] scale-125 pointer-events-none" />
            
            <h1 className="relative text-8xl sm:text-9xl font-black tracking-tighter bg-gradient-to-r from-white via-indigo-100 to-[#7c6af7] bg-clip-text text-transparent filter drop-shadow-[0_0_50px_rgba(124,106,247,0.6)]">
              404
            </h1>
          </div>

          {/* Subtitle */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            Oops! The page you're looking for doesn't exist.
          </h2>

          {/* Supporting Text */}
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-lg mb-8 font-normal">
            The page may have been moved, renamed, or is no longer available. Let's get you back to your workspace.
          </p>

          {/* Primary Actions (Two Buttons) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
            {/* Primary Action: Return Home */}
            <Link
              href="/"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:from-[#6b56f5] hover:to-[#4f46e5] shadow-[0_0_25px_rgba(124,106,247,0.4)] hover:shadow-[0_0_35px_rgba(124,106,247,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Home className="w-4 h-4" />
              <span>Return Home</span>
            </Link>

            {/* Secondary Action: Open Dashboard */}
            <Link
              href={user ? '/dashboard' : '/login'}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-bold text-slate-200 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 hover:border-white/30 backdrop-blur-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7]"
            >
              <LayoutDashboard className="w-4 h-4 text-[#a78bfa]" />
              <span>Open Dashboard</span>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* ────────────────── 4. FOOTER ────────────────── */}
      <footer className="relative z-20 w-full shrink-0 border-t border-white/[0.06] bg-[#04050a]/80 backdrop-blur-xl py-6 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          {/* Left: Branding & Copyright */}
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

          {/* Center: Real Application Product Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
            <Link href="/" className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded px-1">
              Interactive Demo
            </Link>
            <Link href="/support" className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded px-1">
              Support
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded px-1">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] rounded px-1">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
