'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '../../components/AppLayout';
import { apiFetch, getAuthToken } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { 
  Settings as SettingsIcon, 
  Save, 
  ShieldCheck, 
  HelpCircle,
  CheckCircle,
  XCircle,
  Database,
  Link2,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface SettingsData {
  mcp_server_url?: string;
  mcp_slack_bot_token?: string;
  mcp_slack_team_id?: string;
  slack_workspace_name?: string;
  slack_workspace_icon?: string;
  slack_bot_user_id?: string;
  slack_connected_user_id?: string;
  slack_connected_at?: string;
  slack_enterprise_id?: string;
  openai_api_key?: string;
  openai_model_name?: string;
  openai_api_base?: string;
  openai_embedding_model_name?: string;
  report_schedule?: string;
}

export default function SettingsPage() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<SettingsData>({});
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse Slack OAuth status or error query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const error = params.get('error');

      if (status === 'connected') {
        setSaveStatus({ type: 'success', message: 'Successfully connected to your Slack Workspace!' });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (error) {
        let errorMsg = 'Slack connection failed.';
        if (error === 'access_denied') {
          errorMsg = 'Slack OAuth authorization was denied or canceled.';
        } else if (error === 'invalid_state') {
          errorMsg = 'OAuth state validation failed (CSRF check).';
        } else if (error === 'invalid_user') {
          errorMsg = 'User identification mismatch during OAuth.';
        } else if (error === 'server_configuration_missing') {
          errorMsg = 'Slack App configuration (Client ID/Secret) is missing on the server.';
        } else if (error === 'token_exchange_failed') {
          errorMsg = 'Failed to exchange authorization code for Slack tokens.';
        } else {
          errorMsg = `Slack OAuth failed: ${decodeURIComponent(error)}`;
        }
        setSaveStatus({ type: 'error', message: errorMsg });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (saveStatus && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [saveStatus]);

  // Fetch settings on mount
  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/api/settings')
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleConnectSlack = () => {
    const token = getAuthToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    window.location.href = `${backendUrl}/api/auth/slack?token=${encodeURIComponent(token || '')}`;
  };

  const handleDisconnectSlack = async () => {
    if (confirm('Are you sure you want to disconnect the Slack Workspace? This will stop conversation syncing.')) {
      try {
        await apiFetch('/api/auth/slack/disconnect', { method: 'POST' });
        setSaveStatus({ type: 'success', message: 'Slack Workspace disconnected successfully.' });
        queryClient.invalidateQueries({ queryKey: ['settings'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      } catch (err: any) {
        setSaveStatus({ type: 'error', message: err?.message || 'Failed to disconnect Slack.' });
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Mutation to save settings
  const saveMutation = useMutation({
    mutationFn: (data: SettingsData) => apiFetch('/api/settings', {
      method: 'POST',
      body: data
    }),
    onSuccess: () => {
      setSaveStatus({ type: 'success', message: 'Settings saved successfully. Slack MCP subprocess restarted if credentials changed.' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setTimeout(() => setSaveStatus(null), 5000);
    },
    onError: (err: any) => {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to save settings.' });
    }
  });

  // Mutation to clear settings
  const clearSettingsMutation = useMutation({
    mutationFn: () => apiFetch('/api/settings', {
      method: 'DELETE'
    }),
    onSuccess: () => {
      setSaveStatus({ type: 'success', message: 'All system settings have been cleared and reset to defaults.' });
      setFormData({});
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setTimeout(() => setSaveStatus(null), 5000);
    },
    onError: (err: any) => {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to clear settings.' });
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const data = await apiFetch('/api/settings/diagnostics');
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ status: 'error', error: err?.message || 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const confirmClearSettings = () => {
    if (confirm('Are you sure you want to clear all configurations? This will delete your Slack integrations and API keys.')) {
      clearSettingsMutation.mutate();
    }
  };

  return (
    <AppLayout>
      <div ref={containerRef} className="flex-1 flex flex-col h-full min-h-0">
        {/* Top Header */}
        <header className="h-14 md:h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 bg-card/30">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <h2 className={`text-sm font-semibold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>System Settings</h2>
          </div>
        </header>

        {/* Settings Page Content */}
        <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-8">
          {/* Status Message */}
          {saveStatus && (
            <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
              saveStatus.type === 'success' 
                ? isLightMode
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : isLightMode
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {saveStatus.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
              <p>{saveStatus.message}</p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-6">
              <div className="h-20 bg-secondary/15 rounded-3xl animate-pulse" />
              <div className="h-40 bg-secondary/15 rounded-3xl animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Config Forms (col-span-8) */}
              <form onSubmit={handleSave} className="lg:col-span-8 space-y-8">
                
                {/* Slack MCP Server Settings */}
                <div className="glass rounded-3xl p-6 space-y-6">
                  <div className="flex items-center gap-2.5 border-b border-border pb-3">
                    <Link2 className="w-5 h-5 text-primary" />
                    <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Slack MCP Integration</h3>
                  </div>

                  {formData.mcp_slack_bot_token ? (
                    <div className="space-y-6 animate-fade-in">
                      <div className="flex items-center gap-4 bg-emerald-500/[0.03] p-4 rounded-2xl border border-emerald-500/10">
                        {formData.slack_workspace_icon ? (
                          <img
                            src={formData.slack_workspace_icon}
                            alt="Workspace Icon"
                            className="w-12 h-12 rounded-xl object-cover border border-border/80 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                            {(formData.slack_workspace_name || 'S').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-bold truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                            {formData.slack_workspace_name || 'Slack Workspace'}
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            ID: {formData.mcp_slack_team_id || 'Unknown'}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                          Connected
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-secondary/5 p-3.5 rounded-xl border border-border/20">
                          <span className="block text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1 ml-0.5">Connected User</span>
                          <span className={`font-mono ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                            {formData.slack_connected_user_id || 'Unknown'}
                          </span>
                        </div>
                        <div className="bg-secondary/5 p-3.5 rounded-xl border border-border/20">
                          <span className="block text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1 ml-0.5">Connected At</span>
                          <span className={isLightMode ? 'text-slate-700' : 'text-slate-200'}>
                            {formData.slack_connected_at ? new Date(formData.slack_connected_at).toLocaleString() : 'Unknown'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={handleConnectSlack}
                          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reconnect Slack
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectSlack}
                          className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-all flex items-center gap-1.5 ${
                            isLightMode
                              ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-600'
                              : 'border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Disconnect Slack
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center py-8 border-2 border-dashed border-border/40 rounded-2xl bg-secondary/[0.02]">
                        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto px-4">
                          Slack Workspace is not connected. Connect now to automatically authorize the required scopes and sync your workspace channels.
                        </p>
                        <button
                          type="button"
                          onClick={handleConnectSlack}
                          className="px-5 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all inline-flex items-center gap-2 shadow-md shadow-primary/20"
                        >
                          <Link2 className="w-4 h-4" />
                          Connect Slack Workspace
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI & OpenAI settings */}
                <div className="glass rounded-3xl p-6 space-y-6">
                  <div className="flex items-center gap-2.5 border-b border-border pb-3">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>AI Engine & OpenAI API</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        OpenAI API Base URL (OpenAI-compatible API Base)
                      </label>
                      <input
                        type="text"
                        name="openai_api_base"
                        value={formData.openai_api_base || ''}
                        onChange={handleChange}
                        placeholder="https://api.openai.com/v1"
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-400 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        OpenAI API Key
                      </label>
                      <input
                        type="password"
                        name="openai_api_key"
                        value={formData.openai_api_key || ''}
                        onChange={handleChange}
                        placeholder="sk-..."
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-400 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        Chat Completion Model Name
                      </label>
                      <input
                        type="text"
                        name="openai_model_name"
                        value={formData.openai_model_name || ''}
                        onChange={handleChange}
                        placeholder="gemini-2.5-flash"
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-400 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        Embedding Model Name (RAG Layer)
                      </label>
                      <input
                        type="text"
                        name="openai_embedding_model_name"
                        value={formData.openai_embedding_model_name || ''}
                        onChange={handleChange}
                        placeholder="gemini-embedding-2"
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-400 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        Report Schedule Preference
                      </label>
                      <select
                        name="report_schedule"
                        value={formData.report_schedule || 'daily'}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm transition-all outline-none ${
                          isLightMode ? 'text-slate-800 bg-white border-slate-200' : 'text-white'
                        }`}
                      >
                        <option value="daily">Daily Summary Reports</option>
                        <option value="weekly">Weekly Team Reports</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Form buttons */}
                  <div className="flex items-center gap-4 justify-between">
                    {/* Diagnostics */}
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className={`px-5 py-3 rounded-xl border text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-2 ${
                        isLightMode 
                          ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700' 
                          : 'border-border/60 bg-secondary/20 hover:bg-secondary/40 text-slate-300'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                      Test Assistant Diagnostics
                    </button>

                    {/* Save button */}
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-55"
                    >
                      <Save className="w-4 h-4" />
                      Save System Configurations
                    </button>
                  </div>
              </form>

              {/* Right Column: Sidebar Actions & Danger Zone (col-span-4) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Danger Zone */}
                <div className="glass rounded-3xl p-6 border-red-500/10 bg-red-500/[0.01] space-y-4">
                  <div className="flex items-center gap-2 border-b border-red-500/20 pb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Danger Zone</h3>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Clearing configurations will remove your Slack integration token and AI API credentials. This will stop MCP synchronizations.
                  </p>
                  <button
                    type="button"
                    onClick={confirmClearSettings}
                    disabled={clearSettingsMutation.isPending}
                    className={`w-full py-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      isLightMode
                        ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700'
                        : 'border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300'
                    }`}
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                    Reset System Settings
                  </button>
                </div>

                {/* Diagnostics Output Section */}
                {testResult && (
                  <div className={`glass rounded-3xl p-6 space-y-3 animate-fade-in ${
                    isLightMode ? 'border border-slate-200' : 'border border-border/40'
                  }`}>
                    <h4 className={`text-xs font-bold flex items-center gap-1.5 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                      <HelpCircle className="w-4 h-4 text-primary" />
                      Diagnostics Output
                    </h4>
                    <div className={`text-[10px] font-mono p-3 rounded-2xl overflow-x-auto whitespace-pre-wrap max-h-60 ${
                      isLightMode ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-black/40 border border-border/20 text-slate-300'
                    }`}>
                      {JSON.stringify(testResult, null, 2)}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
