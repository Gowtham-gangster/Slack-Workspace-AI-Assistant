'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../components/AuthContext';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  ArrowLeft,
  User,
  FileText
} from 'lucide-react';

const LinkedInIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.75a1.48 1.48 0 1 0 0 2.96 1.48 1.48 0 0 0 0-2.96z" />
  </svg>
);

// Reusable Support Content Component
function SupportContent({ isGuest }: { isGuest: boolean }) {
  const { user } = useAuth();
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL || 'https://www.linkedin.com';
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'pusuloorigowtham@outlook.com';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus(null);

    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to send support request');
      }

      setFormStatus({
        type: 'success',
        message: 'Thank you! Your message has been sent to our support team.'
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setFormStatus({
        type: 'error',
        message: err.message || 'An unexpected error occurred. Please try again or email us directly.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto px-4 ${isGuest ? '' : 'py-8'}`}>
      
      {/* Page Title & Subtitle */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Help & Support Center</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
          Support
        </h1>

        <p className="text-sm md:text-base max-w-lg mx-auto leading-relaxed text-slate-400">
          Need help or have suggestions? Feel free to reach out directly via LinkedIn, Email, or the Contact Form below.
        </p>
      </motion.div>

      {/* Support Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto w-full mb-10">
        
        {/* Card 1: LinkedIn */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -4 }}
          className="p-6 md:p-8 rounded-3xl border flex flex-col justify-between transition-all duration-300 relative group overflow-hidden bg-card/80 border-border/80 glass-elevated hover:border-primary/40"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-[#0a66c2]/10 border border-[#0a66c2]/20 text-[#0a66c2]">
              <LinkedInIcon className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold mb-2 text-foreground">LinkedIn</h2>
            
            <p className="text-xs md:text-sm leading-relaxed mb-6 text-slate-400">
              Connect professionally, share feedback, or discuss collaborations.
            </p>
          </div>

          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs md:text-sm font-bold text-white bg-[#0a66c2] hover:bg-[#08529c] transition-all shadow-md shadow-[#0a66c2]/20 group-hover:scale-[1.02] active:scale-95"
          >
            <span>Visit LinkedIn</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Card 2: Email */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -4 }}
          className="p-6 md:p-8 rounded-3xl border flex flex-col justify-between transition-all duration-300 relative group overflow-hidden bg-card/80 border-border/80 glass-elevated hover:border-primary/40"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-primary/10 border border-primary/20 text-primary">
              <Mail className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold mb-2 text-foreground">Email</h2>
            
            <p className="text-xs md:text-sm leading-relaxed mb-6 text-slate-400">
              For technical support, bug reports, business inquiries, or feature suggestions.
            </p>
          </div>

          <a
            href={`mailto:${supportEmail}`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs md:text-sm font-bold text-white bg-gradient-to-tr from-primary to-accent hover:opacity-95 transition-all shadow-md shadow-primary/20 group-hover:scale-[1.02] active:scale-95"
          >
            <span>Send Email</span>
            <Mail className="w-4 h-4" />
          </a>
        </motion.div>

      </div>

      {/* Contact Form Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="max-w-2xl mx-auto w-full p-6 md:p-8 rounded-3xl border bg-card/80 border-border/80 glass-elevated"
      >
        <div className="flex items-center gap-3 mb-6 border-b border-border/40 pb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Direct Contact Form</h2>
            <p className="text-xs text-slate-400">
              Fill out your request below to send an instant message to our support team.
            </p>
          </div>
        </div>

        {formStatus && (
          <div className={`p-4 rounded-2xl mb-6 flex items-start gap-3 border text-xs font-semibold ${
            formStatus.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {formStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{formStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 ml-1">
                Your Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Gowtham Pusuloori"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-xs font-medium border outline-none transition-all bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 ml-1">
                Your Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="email"
                  required
                  placeholder="e.g. name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-xs font-medium border outline-none transition-all bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 ml-1">
              Subject *
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                required
                placeholder="e.g. Feature request / Bug report / Technical question"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-xs font-medium border outline-none transition-all bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 ml-1">
              Message *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe your issue, question, or feedback in detail..."
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              className="w-full p-4 rounded-xl text-xs font-medium border outline-none transition-all resize-none bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Support Form</span>
              </>
            )}
          </button>
        </form>
      </motion.div>

    </div>
  );
}

export default function SupportPage() {
  const { user } = useAuth();

  // If user is authenticated, render inside the authenticated workspace layout
  if (user) {
    return (
      <AppLayout mainClassName="selection:bg-primary/30">
          <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.15) 0%, transparent 70%)' }} />
          <SupportContent isGuest={false} />
      </AppLayout>
    );
  }

  // If guest user, render inside clean public layout with fixed header & footer
  return (
    <div className="min-h-screen w-full flex flex-col font-sans relative overflow-x-hidden selection:bg-primary/30 bg-[#06070d] text-slate-100">
      {/* Ambient Top Glow */}
      <div className="absolute top-0 left-0 right-0 h-96 pointer-events-none z-0"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.18) 0%, transparent 70%)' }} />

      {/* FIXED PUBLIC HEADER */}
      <header className="fixed top-0 left-0 right-0 h-16 shrink-0 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl border-b z-50 transition-all duration-300 border-white/[0.08] bg-[#06070d]/70">
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
            <span className="font-bold text-[14px] tracking-tight block text-white">Slack AI</span>
            <span className="text-[10px] block text-[#7c6af7] font-semibold tracking-wider uppercase leading-none">WORKSPACE ASSISTANT</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all border-white/10 bg-white/5 hover:bg-white/10 text-slate-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      {/* Public Content Body with top padding for fixed header */}
      <main className="flex-1 flex flex-col justify-center relative z-10 pt-24 pb-16 px-4">
        <SupportContent isGuest={true} />
      </main>

      {/* Public Footer */}
      <footer className="border-t py-6 px-6 lg:px-12 text-xs transition-colors relative z-10 border-white/10 text-slate-500 bg-black/40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 Slack AI Workspace Assistant. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
