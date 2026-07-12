'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Key, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface AIErrorAlertProps {
  error: string | Error | null;
  onRetry?: () => void;
  className?: string;
}

export default function AIErrorAlert({ error, onRetry, className = '' }: AIErrorAlertProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  const rawMsg = typeof error === 'string' ? error : error.message || String(error);
  
  // Detect if this is a quota / limit / 429 error
  const isQuota = rawMsg.toLowerCase().includes('quota') || 
                  rawMsg.toLowerCase().includes('429') || 
                  rawMsg.toLowerCase().includes('limit') ||
                  rawMsg.toLowerCase().includes('resource_exhausted');

  return (
    <div 
      className={`rounded-2xl border backdrop-blur-md p-5 transition-all duration-300 relative overflow-hidden ${className} ${
        isLightMode 
          ? 'bg-rose-50/70 border-rose-200/80 shadow-sm text-slate-800' 
          : 'bg-rose-950/15 border-rose-900/30 text-rose-200'
      }`}
    >
      {/* Background soft warning glow */}
      <div 
        className="absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-40" 
        style={{
          background: isQuota 
            ? 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)' 
            : 'radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)'
        }}
      />

      <div className="flex flex-col sm:flex-row items-start gap-4 relative z-10">
        {/* Pulse warning icon */}
        <div className="relative shrink-0 mt-0.5">
          <div className={`absolute inset-0 rounded-xl animate-ping opacity-25 ${
            isQuota ? 'bg-amber-500' : 'bg-rose-500'
          }`} />
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative ${
            isLightMode 
              ? isQuota ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
              : isQuota ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold tracking-tight mb-1 ${
            isLightMode ? 'text-slate-900' : 'text-white'
          }`}>
            {isQuota ? 'AI Quota Limit Reached' : 'AI Service Offline'}
          </h4>
          <p className={`text-xs leading-relaxed mb-4 ${
            isLightMode ? 'text-slate-600' : 'text-slate-300'
          }`}>
            {isQuota 
              ? 'The workspace AI has hit its request limits (Gemini Free Tier allows 20 calls daily). The app is using local computation fallbacks, but some advanced summaries might be disabled.' 
              : 'An unexpected error occurred while communicating with the LLM API. Please verify your settings or backend logs.'
            }
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: 'linear-gradient(135deg, #7c6af7, #6366f1)',
                boxShadow: isLightMode ? '0 4px 10px rgba(124,106,247,0.2)' : 'none'
              }}
            >
              <Key className="w-3.5 h-3.5" />
              Configure Custom API Key
            </button>

            {onRetry && (
              <button
                onClick={onRetry}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  isLightMode
                    ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isLightMode 
                  ? 'hover:bg-slate-100 text-slate-500' 
                  : 'hover:bg-white/5 text-rose-300'
              }`}
            >
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showDetails ? 'Hide technical logs' : 'Show details'}
            </button>
          </div>

          {/* Collapsible Technical Details */}
          {showDetails && (
            <div className={`mt-3 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-32 relative ${
              isLightMode 
                ? 'bg-slate-100/80 border border-slate-200/50 text-slate-600' 
                : 'bg-black/20 border border-white/5 text-rose-300/80'
            }`}>
              <div className="absolute top-1 right-2 text-[9px] font-sans font-semibold tracking-wider uppercase text-slate-400">
                Log
              </div>
              <pre className="whitespace-pre-wrap">{rawMsg}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
