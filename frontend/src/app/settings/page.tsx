'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import { apiFetch } from '../../lib/api';
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
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar Nav */}
      <Sidebar />

      {/* Main Panel */}
      <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0 bg-card/30">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <h2 className={`text-sm font-semibold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>System Settings</h2>
          </div>
        </header>

        {/* Settings Page Content */}
        <div className="p-8 max-w-5xl w-full mx-auto space-y-8">
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
                    <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Slack MCP Integration</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        Slack Bot Token (SLACK_BOT_TOKEN)
                      </label>
                      <input
                        type="password"
                        name="mcp_slack_bot_token"
                        value={formData.mcp_slack_bot_token || ''}
                        onChange={handleChange}
                        placeholder="xoxb-..."
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-400 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">
                        Slack Team ID (SLACK_TEAM_ID)
                      </label>
                      <input
                        type="text"
                        name="mcp_slack_team_id"
                        value={formData.mcp_slack_team_id || ''}
                        onChange={handleChange}
                        placeholder="T..."
                        className={`w-full px-4 py-3 rounded-xl bg-input border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 text-sm placeholder-muted-foreground/60 transition-all outline-none ${
                          isLightMode ? 'text-slate-800 placeholder-slate-400 bg-slate-100/50' : 'text-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed ${
                    isLightMode ? 'bg-slate-50 border-slate-200/60 text-slate-600' : 'bg-secondary/20 border-border/40 text-muted-foreground'
                  }`}>
                    <div className="flex gap-2">
                      <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className={`font-semibold mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>How to obtain Slack Credentials</p>
                        <ul className={`list-disc pl-4 space-y-1 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                          <li><strong>Slack Bot Token</strong>: Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Slack API Apps</a>, select your app, navigate to <strong>OAuth & Permissions</strong>, and copy the <em>Bot User OAuth Token</em> (starts with <code>xoxb-</code>).</li>
                          <li><strong>Slack Team ID</strong>: Open Slack in your browser; the Team ID is the ID starting with <code>T</code> in the address URL (e.g. <code>client/T...</code>).</li>
                        </ul>
                      </div>
                    </div>
                  </div>
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
                    className="w-full py-3 rounded-xl border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
    </div>
  );
}
