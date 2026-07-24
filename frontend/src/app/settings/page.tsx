'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '../../components/AppLayout';
import { apiFetch, getAuthToken } from '../../lib/api';
import { 
  Settings as SettingsIcon, 
  Save, 
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
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<SettingsData>({});
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse Slack OAuth status or error query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const slackStatus = urlParams.get('slack');
    const slackError = urlParams.get('error');

    if (slackStatus === 'connected') {
      setSaveStatus({ type: 'success', message: 'Successfully connected Slack Workspace via OAuth!' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (slackError) {
      setSaveStatus({ type: 'error', message: `Slack Connection Error: ${decodeURIComponent(slackError)}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch current settings
  const { data: settingsData, isLoading } = useQuery<SettingsData>({
    queryKey: ['systemSettings'],
    queryFn: () => apiFetch('/api/settings'),
  });

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData);
    }
  }, [settingsData]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: (newSettings: SettingsData) => apiFetch('/api/settings', {
      method: 'POST',
      body: newSettings,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      setSaveStatus({ type: 'success', message: 'Configurations saved successfully!' });
      setTimeout(() => setSaveStatus(null), 4000);
    },
    onError: (err: any) => {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to save configurations.' });
    },
  });

  // Clear Settings Mutation
  const clearSettingsMutation = useMutation({
    mutationFn: () => apiFetch('/api/settings', {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      setFormData({});
      setSaveStatus({ type: 'success', message: 'Configurations reset to default.' });
      setTimeout(() => setSaveStatus(null), 4000);
    },
    onError: (err: any) => {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to clear settings.' });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    saveMutation.mutate(formData);
  };

  const handleConnectSlack = () => {
    const token = getAuthToken();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${API_BASE_URL}/api/auth/slack/install?token=${encodeURIComponent(token || '')}`;
  };

  const handleDisconnectSlack = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Slack Workspace integration?')) return;
    try {
      await apiFetch('/api/auth/slack/disconnect', { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      setFormData(prev => ({
        ...prev,
        mcp_slack_bot_token: '',
        mcp_slack_team_id: '',
        slack_workspace_name: '',
        slack_workspace_icon: '',
        slack_connected_user_id: '',
        slack_connected_at: '',
      }));
      setSaveStatus({ type: 'success', message: 'Slack Workspace integration disconnected.' });
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to disconnect Slack.' });
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/settings/test', { method: 'POST' });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ status: 'error', message: err?.message || 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const confirmClearSettings = () => {
    if (window.confirm('Are you sure you want to reset all system configurations? This will delete saved Slack tokens and AI API keys.')) {
      clearSettingsMutation.mutate();
    }
  };

  return (
    <AppLayout>
      <div ref={containerRef} className="flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="border-b border-border/80 bg-card/60 backdrop-blur-xl px-4 sm:px-6 md:px-8 py-5 shrink-0">
          <div className="flex items-center gap-3 max-w-[1400px] mx-auto">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">System Settings</h1>
              <p className="text-xs text-muted-foreground">Configure Slack integration tokens, custom LLM credentials, and RAG preferences</p>
            </div>
          </div>
        </header>

        {/* Settings Page Content */}
        <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-8">
          {/* Status Message */}
          {saveStatus && (
            <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
              saveStatus.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
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
                    <h3 className="text-sm font-bold text-white">Slack MCP Integration</h3>
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
                          <h4 className="text-sm font-bold truncate text-white">
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
                          <span className="font-mono text-slate-200">
                            {formData.slack_connected_user_id || 'Unknown'}
                          </span>
                        </div>
                        <div className="bg-secondary/5 p-3.5 rounded-xl border border-border/20">
                          <span className="block text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1 ml-0.5">Connected At</span>
                          <span className="text-slate-200">
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
                          className="px-4 py-2.5 rounded-xl border font-bold text-xs transition-all flex items-center gap-1.5 border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400"
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
                    <h3 className="text-sm font-bold text-white">AI Engine & OpenAI API</h3>
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
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none text-white"
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
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none text-white"
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
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none text-white"
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
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none text-white"
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
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm transition-all outline-none text-white"
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
                    className="px-5 py-3 rounded-xl border text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-2 border-border/60 bg-secondary/20 hover:bg-secondary/40 text-slate-300"
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
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Clearing configurations will remove your Slack integration token and AI API credentials. This will stop MCP synchronizations.
                  </p>
                  <button
                    type="button"
                    onClick={confirmClearSettings}
                    disabled={clearSettingsMutation.isPending}
                    className="w-full py-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                    Reset System Settings
                  </button>
                </div>

                {/* Diagnostics Output Section */}
                {testResult && (
                  <div className="glass rounded-3xl p-6 space-y-3 animate-fade-in border border-border/40">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-white">
                      <HelpCircle className="w-4 h-4 text-primary" />
                      Diagnostics Output
                    </h4>
                    <div className="text-[10px] font-mono p-3 rounded-2xl overflow-x-auto whitespace-pre-wrap max-h-60 bg-black/40 border border-border/20 text-slate-300">
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
