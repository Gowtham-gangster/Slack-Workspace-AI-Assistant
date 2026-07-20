'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { Sparkles, Lock, AlertCircle, Check, Sun, Moon, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!token) {
      setError('Invalid reset link. No password reset token was found in the URL.');
    }
  }, [token]);

  const ambientParticles = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 12 + 18,
    }));
  }, []);

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMinLength = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Missing reset token. Please check your reset link and try again.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (!isMinLength || !hasUppercase || !hasLowercase || !hasSpecial) {
      setError('Password must meet all strength requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword: password }
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. The link might have expired or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`fixed inset-0 w-full overflow-hidden selection:bg-[#7c6af7]/30 transition-colors duration-500 ${
      isLightMode ? 'bg-[#f8fafc]' : 'bg-[#030408]'
    }`}>
      
      {/* Visual background elements */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ perspective: '1000px' }}
      >
        <motion.div
          animate={{ rotateZ: 360 }}
          transition={{ duration: 65, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(70deg) rotateY(-10deg)',
          }}
        >
          <div className={`absolute w-[900px] h-[900px] rounded-full border border-dashed transition-colors duration-500 ${isLightMode ? 'border-[#7c6af7]/15' : 'border-[#7c6af7]/22'}`} />
          <div className={`absolute w-[750px] h-[750px] rounded-full border border-solid transition-colors duration-500 ${isLightMode ? 'border-[#7c6af7]/10' : 'border-[#7c6af7]/16'}`} />
          <div className={`absolute w-[600px] h-[600px] rounded-full border border-dashed transition-colors duration-500 ${isLightMode ? 'border-[#0ea5e9]/12' : 'border-[#0ea5e9]/18'}`} />
          <div className={`absolute w-[450px] h-[450px] rounded-full border border-solid transition-colors duration-500 ${isLightMode ? 'border-[#10b981]/10' : 'border-[#10b981]/15'}`} />
          <div className={`absolute w-[300px] h-[300px] rounded-full border border-dashed transition-colors duration-500 ${isLightMode ? 'border-[#7c6af7]/8' : 'border-[#7c6af7]/12'}`} />
        </motion.div>
      </div>

      {/* Ambient Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#7c6af7]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#0ea5e9]/10 blur-[130px]" />
      </div>

      {/* Sparkles */}
      {mounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {ambientParticles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute bg-white/10 rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                boxShadow: '0 0 8px rgba(255, 255, 255, 0.3)',
              }}
              animate={{
                y: [0, -120],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "linear",
              }}
            />
          ))}
        </div>
      )}

      {/* Header bar */}
      <header className={`fixed top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md transition-all duration-500 ${
        isLightMode
          ? 'bg-white/40 border-slate-200/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
          : 'bg-[#030408]/40 border-white/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
      }`}>
        <Link
          href="/login"
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
            isLightMode
              ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              : 'text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </Link>

        <button
          onClick={toggleTheme}
          className={`inline-flex items-center justify-center p-2 rounded-xl border transition-all duration-300 ${
            isLightMode
              ? 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900'
              : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.08] hover:text-white'
          }`}
          aria-label="Toggle Theme"
        >
          {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </header>

      {/* Inner smooth-scroll layer — sits above background, below header */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden pt-20 pb-10 flex items-start justify-center px-4" style={{ scrollBehavior: 'smooth' }}>

      {/* Reset Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`w-full max-w-md backdrop-blur-xl p-8 rounded-[32px] border relative z-10 transition-all duration-500 mb-4 ${
          isLightMode
            ? 'bg-white/70 border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)]'
            : 'bg-[#080911]/60 border-white/[0.06] shadow-2xl'
        }`}
      >
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
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
          <span className="text-[11px] font-bold text-[#7c6af7] tracking-wider uppercase mb-1">Slack AI</span>
          <p className="text-xs font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-[#7c6af7] via-purple-400 to-[#6366f1] mb-2 px-2">
            Turn Workspace Noise Into Actionable Intelligence.
          </p>
          <h1 className={`text-2xl font-extrabold tracking-tight text-center transition-colors duration-500 ${
            isLightMode ? 'text-slate-900' : 'text-white'
          }`}>
            Reset Password
          </h1>
          <p className={`text-xs mt-2 text-center max-w-[320px] leading-relaxed transition-colors duration-500 ${
            isLightMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {success 
              ? 'Your password has been successfully reset. You can now use your new password to sign in.'
              : 'Choose a strong new password to protect your account and regain access.'}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <p className="leading-relaxed font-medium">{error}</p>
          </motion.div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="flex justify-center p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-12 h-12 mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-3.5 rounded-xl bg-gradient-to-r from-[#7c6af7] to-[#6366f1] text-white font-bold text-sm hover:shadow-[0_4px_16px_rgba(124,106,247,0.3)] transition-all"
            >
              Proceed to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}>New Password</label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!token}
                  className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${
                    isLightMode
                      ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                      : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}>Confirm New Password</label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!token}
                  className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${
                    isLightMode
                      ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                      : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {password.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`p-3.5 rounded-2xl border space-y-2.5 transition-all duration-500 ${
                  isLightMode ? 'bg-slate-50/80 border-slate-100' : 'bg-white/[0.01] border-white/[0.04]'
                }`}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Password Strength Requirements</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                      isMinLength 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                    }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                      isMinLength 
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                    }`}>Min 8 characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                      hasUppercase
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                    }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                      hasUppercase 
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                    }`}>Uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                      hasLowercase
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                    }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                      hasLowercase 
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                    }`}>Lowercase letter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                      hasSpecial
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                    }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                      hasSpecial 
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                    }`}>Special character</span>
                  </div>
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:shadow-[0_4px_16px_rgba(124,106,247,0.3)] text-white font-bold text-sm transition-all hover:scale-[1.01] flex justify-center items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </motion.div>
      </div>{/* end inner scroll layer */}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030408] text-white">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
