'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import MobileBottomBar from '../../components/MobileBottomBar';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import {
  CheckSquare, Search, Trash2, Calendar, User, Hash, Plus,
  AlertCircle, ChevronRight, Zap, Play, CheckCircle2, Circle, RefreshCw
} from 'lucide-react';

const avatarColor = (id: string) => {
  const colors = ['#7c6af7','#6366f1','#8b5cf6','#0ea5e9','#14b8a6','#f59e0b','#ec4899','#10b981'];
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
};

interface ActionItem {
  id: string;
  user_id: number;
  channel_id: string;
  channel_name: string;
  task: string;
  owner: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string | null;
  created_at: string;
}

export default function ActionCenterPage() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const queryClient = useQueryClient();
  const { slackUsers } = useAuth();

  const getUserDisplayName = (userId: string) => {
    return slackUsers[userId]?.realName || userId;
  };

  const getUserInitials = (userId: string) => {
    const name = slackUsers[userId]?.realName || userId;
    return name.slice(0, 2).toUpperCase();
  };

  const getUserAvatar = (userId: string) => {
    return slackUsers[userId]?.avatar || '';
  };

  const [selectedChannel, setSelectedChannel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editOwner, setEditOwner] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Fetch all action items
  const { data: actionItems, isLoading, error } = useQuery<ActionItem[]>({
    queryKey: ['actionItems'],
    queryFn: () => apiFetch('/api/actions'),
  });

  // Fetch synced channels for scanning dropdown
  const { data: channels } = useQuery<any[]>({
    queryKey: ['channelsList'],
    queryFn: () => apiFetch('/api/channels'),
  });

  // Mutation to update task status/details
  const updateMutation = useMutation({
    mutationFn: ({ id, status, owner, dueDate }: { id: string; status?: string; owner?: string; dueDate?: string | null }) =>
      apiFetch(`/api/actions/${id}`, {
        method: 'PUT',
        body: { status, owner, dueDate },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
      setEditingItemId(null);
    },
  });

  // Mutation to delete a task
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/actions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
    },
  });

  // Mutation to extract tasks from channel history using AI
  const extractMutation = useMutation({
    mutationFn: ({ channelId, channelName }: { channelId: string; channelName: string }) =>
      apiFetch('/api/actions/extract', {
        method: 'POST',
        body: { channelId, channelName },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
      alert(`Successfully extracted ${data.extracted || 0} tasks!`);
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to scan channel for tasks.');
    }
  });

  const handleScanChannel = () => {
    if (!selectedChannel) return;
    const channel = channels?.find(c => c.id === selectedChannel);
    extractMutation.mutate({
      channelId: selectedChannel,
      channelName: channel?.name || selectedChannel
    });
  };

  const startEditing = (item: ActionItem) => {
    setEditingItemId(item.id);
    setEditOwner(item.owner);
    setEditDueDate(item.due_date ? item.due_date.substring(0, 10) : '');
  };

  const saveEdit = (id: string, currentStatus: string) => {
    updateMutation.mutate({
      id,
      status: currentStatus,
      owner: editOwner,
      dueDate: editDueDate || null
    });
  };

  // Filter items based on search query
  const filteredItems = actionItems?.filter(item => {
    const term = searchQuery.toLowerCase();
    const resolvedOwner = getUserDisplayName(item.owner);
    return (
      item.task.toLowerCase().includes(term) ||
      resolvedOwner.toLowerCase().includes(term) ||
      item.channel_name.toLowerCase().includes(term)
    );
  }) || [];

  // Group items by status
  const pendingItems = filteredItems.filter(item => item.status === 'pending');
  const inProgressItems = filteredItems.filter(item => item.status === 'in_progress');
  const completedItems = filteredItems.filter(item => item.status === 'completed');

  const cardStyle = `p-4 rounded-2xl border transition-all duration-200 ${
    isLightMode
      ? 'bg-white border-slate-200 hover:shadow-md'
      : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]'
  }`;

  const colHeaderStyle = `flex items-center justify-between mb-4 font-bold text-sm ${
    isLightMode ? 'text-slate-800' : 'text-white'
  }`;

  const inputStyle = `px-3 py-2 rounded-xl text-xs border outline-none ${
    isLightMode
      ? 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white'
      : 'bg-white/[0.05] border-white/[0.1] text-slate-200 focus:bg-black/40'
  }`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: isLightMode ? '#f8fafc' : '#06070d' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', boxShadow: '0 4px 16px rgba(124,106,247,0.35)' }}>
                <CheckSquare className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Action Center</h1>
                <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  AI-extracted action items and workspace tasks
                </p>
              </div>
            </div>

            {/* AI Scan Trigger */}
            <div className={`flex items-center gap-2 p-3 rounded-2xl border ${
              isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'
            }`}>
              <span className={`text-xs font-semibold ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Scan Channel:</span>
              <select
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs border outline-none ${
                  isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.05] border-white/[0.1] text-slate-200'
                }`}
              >
                <option value="">Choose channel...</option>
                {channels?.map((c: any) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleScanChannel}
                disabled={!selectedChannel || extractMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)' }}
              >
                {extractMutation.isPending ? (
                  <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                AI Scan
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search task details, owner, or channel..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none ${
                  isLightMode
                    ? 'bg-white border-slate-200 text-slate-700 shadow-sm focus:border-slate-300'
                    : 'bg-white/[0.03] border-white/[0.07] text-slate-200 focus:bg-white/[0.05]'
                }`}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl mb-6" 
                 style={{ 
                   background: isLightMode ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.08)', 
                   border: isLightMode ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(239,68,68,0.2)' 
                 }}>
              <AlertCircle className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-red-650' : 'text-red-400'}`} style={isLightMode ? { color: '#dc2626' } : {}} />
              <p className={`text-sm font-medium ${isLightMode ? 'text-red-800' : 'text-red-400'}`}>{(error as any)?.message || 'Failed to fetch tasks.'}</p>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-4 animate-pulse">
                  <div className="h-6 w-32 rounded" style={{ background: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />
                  <div className="h-40 rounded-2xl" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                  <div className="h-40 rounded-2xl" style={{ background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.04)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

              {/* PENDING COLUMN */}
              <div>
                <div className={colHeaderStyle}>
                  <div className="flex items-center gap-2">
                    <Circle className="w-4.5 h-4.5 text-slate-400" />
                    <span>Pending</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-400/10 text-slate-400">
                    {pendingItems.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {pendingItems.map(item => (
                    <div key={item.id} className={cardStyle}>
                      {renderTaskCard(item)}
                    </div>
                  ))}
                  {pendingItems.length === 0 && (
                    <div className="text-center py-10 rounded-2xl border border-dashed border-slate-300/30 text-xs text-slate-500">
                      No pending tasks
                    </div>
                  )}
                </div>
              </div>

              {/* IN PROGRESS COLUMN */}
              <div>
                <div className={colHeaderStyle}>
                  <div className="flex items-center gap-2">
                    <Play className="w-4.5 h-4.5 text-amber-500 fill-amber-500/10" />
                    <span>In Progress</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                    {inProgressItems.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {inProgressItems.map(item => (
                    <div key={item.id} className={cardStyle}>
                      {renderTaskCard(item)}
                    </div>
                  ))}
                  {inProgressItems.length === 0 && (
                    <div className="text-center py-10 rounded-2xl border border-dashed border-slate-300/30 text-xs text-slate-500">
                      No tasks in progress
                    </div>
                  )}
                </div>
              </div>

              {/* COMPLETED COLUMN */}
              <div>
                <div className={colHeaderStyle}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                    <span>Completed</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                    {completedItems.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {completedItems.map(item => (
                    <div key={item.id} className={cardStyle}>
                      {renderTaskCard(item)}
                    </div>
                  ))}
                  {completedItems.length === 0 && (
                    <div className="text-center py-10 rounded-2xl border border-dashed border-slate-300/30 text-xs text-slate-500">
                      No completed tasks
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  function renderTaskCard(item: ActionItem) {
    const isEditing = editingItemId === item.id;
    return (
      <div className="space-y-3">
        {/* Title */}
        <p className={`text-sm font-semibold leading-snug ${isLightMode ? 'text-slate-800' : 'text-slate-100'}`}>
          {item.task}
        </p>

        {/* Metadata */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#9ca3af' }}>
            <Hash className="w-3.5 h-3.5" />
            <span className="font-mono">{item.channel_name}</span>
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
                <input
                  type="text"
                  value={editOwner}
                  onChange={e => setEditOwner(e.target.value)}
                  placeholder="Assignee"
                  className={inputStyle}
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
                <input
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs animate-fadeIn" style={{ color: '#9ca3af' }}>
                {getUserAvatar(item.owner) ? (
                  <img src={getUserAvatar(item.owner)} alt="" className="w-4 h-4 rounded-md object-cover shrink-0" />
                ) : (item.owner.startsWith('U') && item.owner.length > 5) ? (
                  <div className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                       style={{ background: avatarColor(item.owner) }}>
                    {getUserInitials(item.owner)}
                  </div>
                ) : (
                  <User className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Assignee: <strong className={isLightMode ? 'text-slate-700' : 'text-slate-200'}>{getUserDisplayName(item.owner)}</strong></span>
              </div>
              {item.due_date && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#9ca3af' }}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Due: <strong className="text-rose-400">{new Date(item.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1">
            {item.status !== 'completed' && (
              <button
                onClick={() => updateMutation.mutate({ id: item.id, status: 'completed', owner: item.owner, dueDate: item.due_date })}
                className="p-1 hover:text-emerald-500 text-slate-500 transition-colors"
                title="Mark Completed"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
            {item.status === 'completed' && (
              <button
                onClick={() => updateMutation.mutate({ id: item.id, status: 'pending', owner: item.owner, dueDate: item.due_date })}
                className="p-1 hover:text-amber-500 text-slate-500 transition-colors"
                title="Reopen Task"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {item.status === 'pending' && (
              <button
                onClick={() => updateMutation.mutate({ id: item.id, status: 'in_progress', owner: item.owner, dueDate: item.due_date })}
                className="p-1 hover:text-amber-500 text-slate-500 transition-colors"
                title="Start Progress"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => deleteMutation.mutate(item.id)}
              className="p-1 hover:text-rose-500 text-slate-500 transition-colors"
              title="Delete Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div>
            {isEditing ? (
              <div className="flex gap-1.5">
                <button
                  onClick={() => saveEdit(item.id, item.status)}
                  className="px-2 py-0.5 rounded bg-emerald-500 text-[10px] font-bold text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingItemId(null)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isLightMode ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-white'
                  }`}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => startEditing(item)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  isLightMode
                    ? 'hover:bg-slate-100 border-slate-200 text-slate-600'
                    : 'hover:bg-white/5 border-white/[0.06] text-slate-400'
                }`}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
