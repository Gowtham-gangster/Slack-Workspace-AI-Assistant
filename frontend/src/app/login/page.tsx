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
  const { login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
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
          callback: handleGoogleSignIn,
        });

        const btn = document.getElementById('google-signin-button');
        if (btn) {
          btn.innerHTML = '';
          win.google.accounts.id.renderButton(btn, {
            theme: isLightMode ? 'outline' : 'filled_dark',
            size: 'large',
            text: 'continue_with',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    <main className={`min-h-screen w-full flex items-center justify-center relative px-4 overflow-hidden selection:bg-[#7c6af7]/30 transition-colors duration-500 ${
      isLightMode ? 'bg-[#f8fafc]' : 'bg-[#030408]'
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
      <header className={`fixed top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md transition-all duration-500 ${
        isLightMode
          ? 'bg-white/40 border-slate-200/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
          : 'bg-[#030408]/40 border-white/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
      }`}>
        <Link
          href="/"
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
            isLightMode
              ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              : 'text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`w-full max-w-md backdrop-blur-xl p-8 rounded-[32px] border relative z-10 transition-all duration-500 ${
          isLightMode
            ? 'bg-white/70 border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)]'
            : 'bg-[#080911]/60 border-white/[0.06] shadow-2xl'
        }`}
      >
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#7c6af7] to-[#6366f1] text-white mb-4 shadow-[0_4px_20px_rgba(124,106,247,0.3)]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className={`text-2xl font-extrabold tracking-tight text-center transition-colors duration-500 ${
            isLightMode ? 'text-slate-900' : 'text-white'
          }`}>
            {isRegistering ? 'Create Your Account' : 'Welcome Back'}
          </h1>
          <p className={`text-xs mt-2 text-center max-w-[320px] leading-relaxed transition-colors duration-500 ${
            isLightMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {isRegistering
              ? 'Join our workspace to collaborate, analyze threads, and synthesize actions with AI.'
              : 'Sign in to collaborate, search workspace records, and summarize channels with AI.'}
          </p>
        </div>

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
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}>Full Name</label>
              <div className="relative mb-2">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${
                    isLightMode
                      ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                      : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                  }`}
                />
              </div>
            </motion.div>
          )}

          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>Email Address</label>
            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <input
                type="text"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${
                  isLightMode
                    ? 'bg-slate-50/50 border-slate-200 focus:border-[#7c6af7] focus:ring-[#7c6af7]/20 text-slate-900 placeholder-slate-400'
                    : 'bg-white/[0.02] border-white/[0.08] focus:border-[#7c6af7]/80 focus:ring-[#7c6af7]/30 text-white placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>Password</label>
            <div className="relative">
              <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${
                  isLightMode
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

          {isRegistering && password.length > 0 && (
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
                    password.length >= 8 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                  }`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                    password.length >= 8 
                      ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                      : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                  }`}>Min 8 characters</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    /[A-Z]/.test(password)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                  }`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                    /[A-Z]/.test(password) 
                      ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                      : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                  }`}>Uppercase letter</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    /[a-z]/.test(password)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                  }`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                    /[a-z]/.test(password) 
                      ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                      : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                  }`}>Lowercase letter</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    /[^A-Za-z0-9]/.test(password)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : (isLightMode ? 'bg-slate-100 text-slate-400 border border-slate-200/50' : 'bg-white/[0.02] text-slate-500 border border-white/[0.06]')
                  }`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                    /[^A-Za-z0-9]/.test(password) 
                      ? (isLightMode ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                      : (isLightMode ? 'text-slate-400' : 'text-slate-500')
                  }`}>Special character</span>
                </div>
              </div>
            </motion.div>
          )}

          {isRegistering && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-500 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}>Confirm Password</label>
              <div className="relative mb-2">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-500 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-1 transition-all outline-none ${
                    isLightMode
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

          {isRegistering && (
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
                className={`mt-0.5 rounded focus:ring-offset-0 focus:ring-1 w-3.5 h-3.5 transition-all ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-[#7c6af7] focus:ring-[#7c6af7]/20'
                    : 'border-white/[0.1] bg-white/[0.02] text-[#7c6af7] focus:ring-[#7c6af7]/30'
                }`}
              />
              <label htmlFor="agreeTerms" className={`text-xs leading-normal select-none transition-colors duration-500 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
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
            ) : isRegistering ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider for SSO */}
        <div className="flex items-center gap-3 my-6">
          <span className={`flex-1 border-t transition-colors duration-500 ${isLightMode ? 'border-slate-200' : 'border-white/[0.06]'}`} />
          <span className={`font-bold tracking-widest text-[9px] uppercase shrink-0 transition-colors duration-500 ${
            isLightMode ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {isRegistering ? 'Or Sign Up With' : 'Or Sign In With'}
          </span>
          <span className={`flex-1 border-t transition-colors duration-500 ${isLightMode ? 'border-slate-200' : 'border-white/[0.06]'}`} />
        </div>

        {/* Google SSO Container */}
        <div className="flex justify-center w-full min-h-[44px]">
          <div 
            id="google-signin-button" 
            className="w-full flex justify-center" 
            style={{ display: googleClientConfigured ? 'flex' : 'none' }}
          />
          {!googleClientConfigured && (
            <div className={`w-full p-3 rounded-xl border text-[10px] text-center leading-relaxed transition-all duration-500 ${
              isLightMode ? 'bg-amber-500/5 border-amber-500/20 text-amber-600' : 'bg-amber-500/5 border-amber-500/10 text-amber-500/70'
            }`}>
              Google Sign-In will be active once you replace the placeholder client ID in <code className="text-amber-400">frontend/.env.local</code>.
            </div>
          )}
        </div>

        {/* Toggle registered trigger */}
        <div className="mt-6 text-center">
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
        </div>
      </motion.div>
    </main>
  );
}
