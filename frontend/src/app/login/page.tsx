'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../components/AuthContext';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { Sparkles, Lock, Mail, AlertCircle, ArrowLeft, User, Check, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleClientConfigured, setGoogleClientConfigured] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setMounted(true);
    router.prefetch('/dashboard');
  }, [router]);

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

  const handleGoogleSignIn = async (response: any) => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/google', {
        method: 'POST',
        body: { credential: response.credential }
      });
      login(data.token, data.user, '/dashboard', data.refreshToken);
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gToken = params.get('g_token');
      const gUser = params.get('g_user');
      const gRefresh = params.get('g_refresh');
      const err = params.get('error');

      if (err) {
        setError(decodeURIComponent(err));
        window.history.replaceState({}, '', window.location.pathname);
      } else if (gToken && gUser) {
        try {
          const parsedUser = JSON.parse(gUser);
          login(gToken, parsedUser, '/dashboard', gRefresh || undefined);
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          setError('Failed to process Google sign-in payload.');
        }
      }
    }
  }, [login]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    const isConfigured = clientId && !clientId.includes('your-google-client-id');
    setGoogleClientConfigured(!!isConfigured);

    if (!isConfigured) {
      return;
    }

    const initGoogle = () => {
      const win = window as any;
      if (win.google?.accounts?.id) {
        win.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'redirect',
          login_uri: `${window.location.origin}/api/auth/google/callback`,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        try {
          win.google.accounts.id.cancel();
        } catch {
          // Ignore
        }

        const btn = document.getElementById('google-signin-button');
        if (btn) {
          btn.innerHTML = '';
          win.google.accounts.id.renderButton(btn, {
            type: 'standard',
            theme: isLightMode ? 'outline' : 'filled_dark',
            size: 'large',
            text: isRegistering ? 'signup_with' : 'continue_with',
            shape: 'rectangular',
            width: 382, // matches container width
            logo_alignment: 'center',
          });
        }
      }
    };

    const win = window as any;
    if (win.google?.accounts?.id) {
      setTimeout(initGoogle, 100);
    } else {
      win.onGoogleScriptLoad = () => {
        setTimeout(initGoogle, 100);
      };
    }

    return () => {
      win.onGoogleScriptLoad = null;
    };
  }, [isRegistering, isLightMode]);

  if (authLoading || user) {
    return (
      <div className={`fixed inset-0 w-full h-full flex flex-col items-center justify-center font-mono text-xs z-50 transition-colors duration-500 ${isLightMode ? 'bg-white text-slate-700' : 'bg-[#030408] text-slate-300'
        }`}>
        <div className="w-8 h-8 border-2 border-[#7c6af7]/30 border-t-[#7c6af7] rounded-full animate-spin mb-3" />
        <span className="text-[11px] font-semibold text-[#7c6af7] animate-pulse">Redirecting to Dashboard...</span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isForgotPassword) {
      if (!email) {
        setError('Email Address is required.');
        return;
      }
      setError(null);
      setForgotPasswordSuccess(null);
      setLoading(true);
      try {
        const data = await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: { email }
        });
        setForgotPasswordSuccess(data.message || 'A password reset link has been sent to your email address.');
      } catch (err: any) {
        setError(err?.message || 'Failed to request password reset. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isRegistering) {
      if (!fullName.trim()) {
        setError('Full Name is required.');
        return;
      }
      if (!email) {
        setError('Email Address is required.');
        return;
      }
      if (!password) {
        setError('Password is required.');
        return;
      }

      // Password validation
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasSpecial = /[^A-Za-z0-9]/.test(password);
      const isMinLength = password.length >= 8;

      if (!isMinLength || !hasUppercase || !hasLowercase || !hasSpecial) {
        setError('Password must meet all strength requirements.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      if (!agreeTerms) {
        setError('You must agree to the Terms of Service and Privacy Policy.');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Please fill in all fields.');
        return;
      }
    }

    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        // Register flow
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: { email, password, fullName: fullName.trim() }
        });
        // Auto-login after registration
        const loginData = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        login(loginData.token, loginData.user, '/dashboard', loginData.refreshToken);
      } else {
        // Login flow
        const loginData = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        login(loginData.token, loginData.user, '/dashboard', loginData.refreshToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`fixed inset-0 w-full overflow-hidden selection:bg-[#7c6af7]/30 transition-colors duration-500 ${isLightMode ? 'bg-[#f8fafc]' : 'bg-[#030408]'
      }`}>
      {/* Background script for Google Client */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          const win = window as any;
          if (win.onGoogleScriptLoad) {
            win.onGoogleScriptLoad();
          }
        }}
      />

      {/* Visual background elements */}
      {/* 1. 3D Magnetic Orbit Plane Backdrop */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          perspective: '1000px',
        }}
      >
        <motion.div
          animate={{
            rotateZ: 360
          }}
          transition={{
            duration: 65,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(70deg) rotateY(-10deg)',
          }}
        >
          {/* Orbit Rings */}
          <div className={`absolute w-[900px] h-[900px] rounded-full border border-dashed transition-colors duration-500 ${isLightMode ? 'border-[#7c6af7]/15' : 'border-[#7c6af7]/22'}`} />
          <div className={`absolute w-[750px] h-[750px] rounded-full border border-solid transition-colors duration-500 ${isLightMode ? 'border-[#7c6af7]/10' : 'border-[#7c6af7]/16'}`} />
          <div className={`absolute w-[600px] h-[600px] rounded-full border border-dashed transition-colors duration-500 ${isLightMode ? 'border-[#0ea5e9]/12' : 'border-[#0ea5e9]/18'}`} />
          <div className={`absolute w-[450px] h-[450px] rounded-full border border-solid transition-colors duration-500 ${isLightMode ? 'border-[#10b981]/10' : 'border-[#10b981]/15'}`} />
          <div className={`absolute w-[300px] h-[300px] rounded-full border border-dashed transition-colors duration-500 ${isLightMode ? 'border-[#7c6af7]/8' : 'border-[#7c6af7]/12'}`} />

          {/* Glowing Orbit Nodes */}
          <div className="absolute w-[900px] h-[900px] rounded-full">
            <div className="w-2.5 h-2.5 bg-[#7c6af7] rounded-full absolute top-1/2 left-0 -translate-y-1/2 shadow-[0_0_12px_#7c6af7]" />
          </div>
          <div className="absolute w-[600px] h-[600px] rounded-full">
            <div className="w-2 h-2 bg-[#0ea5e9] rounded-full absolute top-0 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#0ea5e9]" />
          </div>
          <div className="absolute w-[450px] h-[450px] rounded-full">
            <div className="w-2 h-2 bg-[#10b981] rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#10b981]" />
          </div>
        </motion.div>
      </div>



      {/* 3. Slow-drifting Ambient Blobs */}
      {/* Purple/Indigo Blob */}
      <motion.div
        animate={{
          y: [0, 40, -20, 0],
          x: [0, 30, -10, 0],
          scale: [1, 1.08, 0.95, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#7c6af7]/10 blur-[120px] pointer-events-none"
      />

      {/* Cyan/Blue Blob */}
      <motion.div
        animate={{
          y: [0, -50, 30, 0],
          x: [0, -40, 20, 0],
          scale: [1, 1.12, 0.98, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#0ea5e9]/10 blur-[130px] pointer-events-none"
      />

      {/* Emerald/Mint Blob */}
      <motion.div
        animate={{
          y: [0, 30, -30, 0],
          x: [0, -30, 30, 0],
          scale: [1, 1.05, 0.95, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[30%] left-[10%] w-[450px] h-[450px] rounded-full bg-[#10b981]/5 blur-[120px] pointer-events-none"
      />

      {/* 4. Ambient Particle Sparkles */}
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

      {/* Top Banner */}
      <header className={`fixed top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md transition-all duration-500 ${isLightMode
          ? 'bg-white/40 border-slate-200/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
          : 'bg-[#030408]/40 border-white/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
        }`}>
        <Link
          href="/"
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${isLightMode
              ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              : 'text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
            }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>

        <button
          onClick={toggleTheme}
          className={`inline-flex items-center justify-center p-2 rounded-xl border transition-all duration-300 ${isLightMode
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`w-full max-w-md backdrop-blur-xl p-8 rounded-[32px] border relative z-10 transition-all duration-500 mb-4 ${isLightMode
              ? 'bg-white/70 border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)]'
              : 'bg-[#080911]/60 border-white/[0.06] shadow-2xl'
            }`}
        >
          {/* Brand header */}
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
            <h1 className={`text-2xl font-extrabold tracking-tight text-center transition-colors duration-500 ${isLightMode ? 'text-slate-900' : 'text-white'
              }`}>
              {isForgotPassword ? 'Reset Your Password' : isRegistering ? 'Create Your Account' : 'Welcome Back'}
            </h1>
            {isForgotPassword && (
              <p className={`text-xs mt-2 text-center max-w-[320px] leading-relaxed transition-colors duration-500 ${isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                Enter the email associated with your account and we'll send you a link to reset your password.
              </p>
            )}
          </div>

          {/* Success banner */}
          {forgotPasswordSuccess && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5"
            >
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <p className="leading-relaxed font-medium">{forgotPasswordSuccess}</p>
            </motion.div>
          )}

          {/* Error banner */}
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

          {/* Auth form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {!isForgotPassword && isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}>Full Name</label>
                <div className="relative mb-2">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${isLightMode ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                  <input
                    type="text"
                    name="user_fullname"
                    autoComplete="off"
                    aria-autocomplete="none"
                    placeholder="Enter full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${isLightMode
                        ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                        : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                      }`}
                  />
                </div>
              </motion.div>
            )}

            <div>
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${isLightMode ? 'text-slate-600' : 'text-slate-400'
                }`}>Email Address</label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${isLightMode ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                <input
                  type="text"
                  name="user_email_address"
                  autoComplete="off"
                  aria-autocomplete="none"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${isLightMode
                      ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                      : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                    }`}
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className={`block text-[11px] font-bold uppercase tracking-wider transition-colors duration-500 ${isLightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>Password</label>
                  {!isRegistering && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError(null);
                        setForgotPasswordSuccess(null);
                      }}
                      className="text-xs text-[#7c6af7] hover:text-[#6366f1] hover:underline font-bold transition-colors"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${isLightMode ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="user_password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${isLightMode
                        ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                        : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-400 hover:text-slate-600 dark:hover:text-white`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {!isForgotPassword && isRegistering && password.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`p-3.5 rounded-2xl border space-y-2.5 transition-all duration-500 ${isLightMode ? 'bg-slate-50/80 border-slate-100' : 'bg-white/[0.01] border-white/[0.04]'
                  }`}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Password Strength Requirements</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${password.length >= 8
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                      }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${password.length >= 8
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400')
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                      }`}>Min 8 characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${/[A-Z]/.test(password)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                      }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${/[A-Z]/.test(password)
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400')
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                      }`}>Uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${/[a-z]/.test(password)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                      }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${/[a-z]/.test(password)
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400')
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                      }`}>Lowercase letter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${/[^A-Za-z0-9]/.test(password)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                      }`}>
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className={`text-[10px] font-semibold transition-colors duration-300 ${/[^A-Za-z0-9]/.test(password)
                        ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400')
                        : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                      }`}>Special character</span>
                  </div>
                </div>
              </motion.div>
            )}

            {!isForgotPassword && isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}>Confirm Password</label>
                <div className="relative mb-2">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${isLightMode ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="user_confirm_password"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${isLightMode
                        ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                        : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-400 hover:text-slate-600 dark:hover:text-white`}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {!isForgotPassword && isRegistering && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-2.5 px-1 py-1"
              >
                <input
                  id="agreeTerms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className={`mt-0.5 rounded focus:ring-offset-0 focus:ring-1 w-3.5 h-3.5 transition-all ${isLightMode
                      ? 'border-slate-300 bg-white text-[#7c6af7] focus:ring-[#7c6af7]/20'
                      : 'border-white/[0.1] bg-white/[0.02] text-[#7c6af7] focus:ring-[#7c6af7]/30'
                    }`}
                />
                <label htmlFor="agreeTerms" className={`text-xs leading-normal select-none transition-colors duration-500 ${isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                  I agree to the{' '}
                  <Link href="/terms" className="text-[#7c6af7] hover:text-[#6366f1] hover:underline font-semibold transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-[#7c6af7] hover:text-[#6366f1] hover:underline font-semibold transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#7c6af7] to-[#6366f1] hover:shadow-[0_4px_16px_rgba(124,106,247,0.3)] text-white font-bold text-sm transition-all hover:scale-[1.01] flex justify-center items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isForgotPassword ? (
                'Send Reset Link'
              ) : isRegistering ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider for SSO */}
          {!isForgotPassword && (
            <>
              <div className="flex items-center gap-3 my-6">
                <span className={`flex-1 border-t transition-colors duration-500 ${isLightMode ? 'border-slate-200' : 'border-white/[0.06]'}`} />
                <span className={`font-bold tracking-widest text-[9px] uppercase shrink-0 transition-colors duration-500 ${isLightMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                  {isRegistering ? 'Or Sign Up With' : 'Or Sign In With'}
                </span>
                <span className={`flex-1 border-t transition-colors duration-500 ${isLightMode ? 'border-slate-200' : 'border-white/[0.06]'}`} />
              </div>

              {/* Google SSO Container */}
              <div className="flex justify-center w-full min-h-[44px] relative">
                {googleClientConfigured ? (
                  <>
                    {/* Hidden Google SDK container */}
                    <div
                      id="google-signin-button"
                      className="absolute opacity-0 pointer-events-none"
                      aria-hidden="true"
                    />
                    {/* Visible custom Google button without email suggestion */}
                    <button
                      type="button"
                      onClick={() => {
                        const hiddenBtn = document.querySelector('#google-signin-button div[role="button"]') as HTMLElement;
                        if (hiddenBtn) {
                          hiddenBtn.click();
                        } else {
                          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
                          if (clientId) {
                            const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
                              client_id: clientId,
                              redirect_uri: `${window.location.origin}/api/auth/google/callback`,
                              response_type: 'id_token',
                              scope: 'openid email profile',
                              prompt: 'select_account',
                              nonce: Math.random().toString(36).substring(2),
                            }).toString();
                            window.location.href = googleAuthUrl;
                          }
                        }
                      }}
                      className={`w-full py-3 px-4 rounded-xl border flex items-center justify-center gap-3 text-xs font-semibold transition-all duration-300 hover:scale-[1.01] ${isLightMode
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]'
                        }`}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{isRegistering ? 'Sign Up with Google' : 'Sign In with Google'}</span>
                    </button>
                  </>
                ) : (
                  <div className={`w-full p-3 rounded-xl border text-[10px] text-center leading-relaxed transition-all duration-500 ${isLightMode ? 'bg-amber-500/5 border-amber-500/20 text-amber-600' : 'bg-amber-500/5 border-amber-500/10 text-amber-500/70'
                    }`}>
                    Google Sign-In will be active once you replace the placeholder client ID in <code className="text-amber-400">frontend/.env.local</code>.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Toggle registered trigger */}
          <div className="mt-6 text-center">
            {isForgotPassword ? (
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setError(null);
                  setForgotPasswordSuccess(null);
                }}
                className="text-xs text-[#7c6af7] hover:text-[#6366f1] hover:underline font-bold transition-colors"
              >
                Back to Sign In
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setFullName('');
                  setConfirmPassword('');
                  setAgreeTerms(false);
                  setError(null);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="text-xs text-[#7c6af7] hover:text-[#6366f1] hover:underline font-bold transition-colors"
              >
                {isRegistering
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </button>
            )}
          </div>
        </motion.div>
      </div>{/* end inner scroll layer */}
    </main>
  );
}
