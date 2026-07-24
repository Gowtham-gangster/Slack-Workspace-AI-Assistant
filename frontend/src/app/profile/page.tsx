'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import AppLayout from '../../components/AppLayout';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../components/AuthContext';
import { 
  User, 
  Mail, 
  Lock, 
  Save, 
  Trash2, 
  LogOut, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function ProfilePage() {
  const { user, login, logout } = useAuth();
  
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

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string; password?: string }) => apiFetch('/api/users/profile', {
      method: 'PUT',
      body: data,
    }),
    onSuccess: (updatedUser: any) => {
      if (updatedUser) {
        const token = localStorage.getItem('auth_token') || '';
        login(token, {
          id: updatedUser.id,
          fullName: updatedUser.fullName || updatedUser.name,
          email: updatedUser.email,
        });
      }
      setProfilePassword('');
      setProfileConfirmPassword('');
      setProfileStatus({ type: 'success', message: 'Profile details updated successfully!' });
      setTimeout(() => setProfileStatus(null), 4000);
    },
    onError: (err: any) => {
      setProfileStatus({ type: 'error', message: err?.message || 'Failed to update profile.' });
    },
  });

  // Delete Account Mutation
  const deleteAccountMutation = useMutation({
    mutationFn: () => apiFetch('/api/users/profile', {
      method: 'DELETE',
    }),
    onSuccess: () => {
      logout();
    },
    onError: (err: any) => {
      setProfileStatus({ type: 'error', message: err?.message || 'Failed to delete account.' });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setProfileStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    const payload: { name?: string; email?: string; password?: string } = {};
    if (fullName !== user?.fullName) payload.name = fullName;
    if (profileEmail !== user?.email) payload.email = profileEmail;
    if (profilePassword) payload.password = profilePassword;
    if (profileEmail !== user?.email) payload.email = profileEmail;
    if (profilePassword) payload.password = profilePassword;

    if (Object.keys(payload).length === 0) {
      setProfileStatus({ type: 'error', message: 'No changes detected to save.' });
      return;
    }

    updateProfileMutation.mutate(payload);
  };

  const confirmDeleteAccount = () => {
    if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
      deleteAccountMutation.mutate();
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full min-h-0">
        {/* Top Header */}
        <header className="h-14 md:h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 bg-card/30">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-white">My User Profile</h2>
          </div>
        </header>

        {/* Profile Content */}
        <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left: Edit Profile Card (col-span-7) */}
            <div className="md:col-span-7 glass rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-border pb-3 mb-2">
                <User className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-white">Profile Details</h3>
              </div>

              {profileStatus && (
                <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
                  profileStatus.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
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
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none text-white"
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
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none text-white"
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
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none text-white"
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
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-slate-600 transition-all outline-none text-white"
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

            {/* Right column: Safety and Danger Zone Cards (col-span-5) */}
            <div className="md:col-span-5 space-y-6 flex flex-col">
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
                    className="w-full py-3.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 border-red-600/30 bg-red-600/10 hover:bg-red-600/15 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete User Account Permanently
                  </button>

                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={logout}
                    className="w-full py-3.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 border-slate-500/25 bg-slate-500/5 hover:bg-slate-500/10 text-slate-300 hover:text-white"
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
    </AppLayout>
  );
}
