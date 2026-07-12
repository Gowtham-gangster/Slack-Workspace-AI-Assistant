'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../components/AuthContext';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { 
  User, 
  Mail, 
  Lock, 
  Save, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  LogOut, 
  AlertTriangle,
  Sun,
  Moon,
  Palette
} from 'lucide-react';

export default function ProfilePage() {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';
  
  // Profile form states
  const [fullName, setFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  // Mutation to update profile details
  const updateProfileMutation = useMutation({
    mutationFn: (data: { email: string; fullName?: string; password?: string }) => apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: data
    }),
    onSuccess: (data) => {
      setProfileStatus({ type: 'success', message: 'User profile updated successfully.' });
      login(data.token, data.user, null, data.refreshToken);
      setProfilePassword('');
      setProfileConfirmPassword('');
      setTimeout(() => setProfileStatus(null), 5000);
    },
    onError: (err: any) => {
      setProfileStatus({ type: 'error', message: err?.message || 'Failed to update profile.' });
    }
  });

  // Mutation to delete user account
  const deleteAccountMutation = useMutation({
    mutationFn: () => apiFetch('/api/auth/account', {
      method: 'DELETE'
    }),
    onSuccess: () => {
      logout();
    },
    onError: (err: any) => {
      setProfileStatus({ type: 'error', message: err?.message || 'Failed to delete account.' });
    }
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileEmail) {
      setProfileStatus({ type: 'error', message: 'Email address cannot be blank.' });
      return;
    }

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setProfileStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    const payload: { email: string; fullName?: string; password?: string } = {
      email: profileEmail,
      fullName: fullName
    };

    if (profilePassword) {
      payload.password = profilePassword;
    }

    updateProfileMutation.mutate(payload);
  };

  const confirmDeleteAccount = () => {
    if (confirm('WARNING: Are you sure you want to delete your account? This action is permanent, and you will be signed out immediately.')) {
      deleteAccountMutation.mutate();
    }
  };

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar Nav */}
      <Sidebar />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0 bg-card/30">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className={`text-sm font-semibold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>My User Profile</h2>
          </div>
        </header>

        {/* Profile Content */}
        <div className="p-8 max-w-4xl w-full mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left: Edit Profile Card (col-span-7) */}
            <div className="md:col-span-7 glass rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-border pb-3 mb-2">
                <User className="w-5 h-5 text-primary" />
                <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Profile Details</h3>
              </div>

              {profileStatus && (
                <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
                  profileStatus.type === 'success' 
                    ? isLightMode
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : isLightMode
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {profileStatus.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
                  <p>{profileStatus.message}</p>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      suppressHydrationWarning
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Gowtham Pusuloori"
                      className={`w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none ${
                        isLightMode ? 'text-slate-800 placeholder-slate-450 bg-slate-100/50' : 'text-white'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      suppressHydrationWarning
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={`w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none ${
                        isLightMode ? 'text-slate-800 placeholder-slate-450 bg-slate-100/50' : 'text-white'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">
                      New Password (optional)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        suppressHydrationWarning
                        type="password"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-450 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        suppressHydrationWarning
                        type="password"
                        value={profileConfirmPassword}
                        onChange={(e) => setProfileConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-450 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <button
                  suppressHydrationWarning
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="px-6 py-3.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs transition-all shadow-md shadow-primary/10 flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save Profile Changes
                </button>
              </form>
            </div>

            {/* Right column: Theme Settings and Danger Zone Cards (col-span-5) */}
            <div className="md:col-span-5 space-y-6 flex flex-col">
              {/* Theme Settings Card */}
              <div className="glass rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-border pb-3 mb-2">
                  <Palette className="w-5 h-5 text-primary" />
                  <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>App Theme Settings</h3>
                </div>
                <p className="text-[11.5px] text-slate-400 leading-relaxed">
                  Customize the look and feel of your application workspace.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={() => { if (theme !== 'light') toggleTheme(); }}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all duration-300 ${
                      theme === 'light'
                        ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/5 font-bold'
                        : isLightMode
                        ? 'bg-slate-100/50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-200/80'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light Theme
                  </button>
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all duration-300 ${
                      theme === 'dark'
                        ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/5 font-bold'
                        : isLightMode
                        ? 'bg-slate-100/50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-200/80'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark Theme
                  </button>
                </div>
              </div>

              {/* Account Safety Card */}
              <div className="glass rounded-3xl p-6 border-red-500/10 bg-red-500/[0.01] flex flex-col justify-between flex-1 min-h-[220px]">
                <div>
                  <div className="flex items-center gap-2.5 border-b border-red-500/20 pb-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <h3 className="text-sm font-bold text-red-500">Account Safety</h3>
                  </div>
                  <p className="text-[11.5px] text-slate-400 leading-relaxed">
                    Permanently delete your profile account or log out of your active browser session here.
                  </p>
                </div>

                <div className="space-y-3 pt-6">
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={confirmDeleteAccount}
                    disabled={deleteAccountMutation.isPending}
                    className={`w-full py-3.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      isLightMode
                        ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700'
                        : 'border-red-600/30 bg-red-600/10 hover:bg-red-600/15 text-red-400 hover:text-red-300'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete User Account Permanently
                  </button>

                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={logout}
                    className={`w-full py-3.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isLightMode
                        ? 'border-slate-300 bg-slate-100/50 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900'
                        : 'border-slate-500/25 bg-slate-500/5 hover:bg-slate-500/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out of Session
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
