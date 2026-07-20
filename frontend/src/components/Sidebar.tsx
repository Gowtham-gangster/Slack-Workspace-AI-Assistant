'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import {
  LayoutDashboard,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Zap,
  Sun,
  Moon,
  Brain,
  Clock,
  CheckSquare,
  Network,
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  Hash,
  MessageSquare,
  Sparkles,
  User,
  Command,
  Star,
  HelpCircle
} from 'lucide-react';
import CommandPalette from './CommandPalette';

const menuItems = [
  { name: 'Workspace',      path: '/dashboard',    icon: LayoutDashboard, desc: 'Chat & channels' },
  { name: 'Intelligence',   path: '/intelligence',  icon: Brain,           desc: 'AI Insights' },
  { name: 'Action Center',  path: '/actions',       icon: CheckSquare,     desc: 'Task manager' },
  { name: 'Timeline',       path: '/timeline',      icon: Clock,           desc: 'Activity feed' },
  { name: 'Knowledge',      path: '/knowledge',     icon: Network,         desc: 'Semantic search' },
  { name: 'Memory',         path: '/memory',        icon: BookOpen,        desc: 'Persistent graph' },
  { name: 'Reports',        path: '/reports',       icon: FileText,        desc: 'Analytics' },
  { name: 'Settings',       path: '/settings',      icon: SettingsIcon,    desc: 'Preferences' },
  { name: 'Support',        path: '/support',       icon: HelpCircle,      desc: 'Contact & help' },
];

const Sidebar = React.memo(function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';
  const queryClient = useQueryClient();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePrefetch = React.useCallback((path: string) => {
    router.prefetch(path);
    const prefetchOptions = { staleTime: 5000 };
    if (path === '/dashboard') {
      queryClient.prefetchQuery({ queryKey: ['dashboardStats'], queryFn: () => apiFetch('/api/dashboard/stats'), ...prefetchOptions });
      queryClient.prefetchQuery({ queryKey: ['channelsList'], queryFn: () => apiFetch('/api/channels'), ...prefetchOptions });
    } else if (path === '/intelligence') {
      queryClient.prefetchQuery({ queryKey: ['intelligenceTopics'], queryFn: () => apiFetch('/api/intelligence/topics'), ...prefetchOptions });
    } else if (path === '/reports') {
      queryClient.prefetchQuery({ queryKey: ['reports'], queryFn: () => apiFetch('/api/reports'), ...prefetchOptions });
    }
  }, [router, queryClient]);

  const initials = (user?.fullName || user?.email || 'US').slice(0, 2).toUpperCase();

  return (
    <>
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      <aside
        className={`hidden md:flex flex-col h-full shrink-0 relative z-20 transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-[230px]'
        }`}
        style={{
          background: isLightMode ? 'rgba(255,255,255,0.98)' : 'rgba(8,9,16,0.98)',
          borderRight: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)'
        }}
      >
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 z-30 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md transition-all cursor-pointer"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 gap-3 shrink-0 relative">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#4f46e5] blur-md opacity-50 scale-110" />
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#9d8fff] via-[#7c6af7] to-[#4f46e5] p-[1.5px] shadow-[0_0_14px_rgba(124,106,247,0.5)]">
              <div className="w-full h-full rounded-[9px] bg-[#1a1730] flex items-center justify-center overflow-hidden">
                <img
                  src="/slack-app-icon.png"
                  alt="Slack AI Workspace Assistant Logo"
                  className="w-5 h-5 object-contain"
                />
              </div>
            </div>
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className={`font-bold text-sm leading-none tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Slack AI</h1>
              <span className="text-[10px] font-semibold mt-1 block text-primary">Workspace Assistant</span>
            </div>
          )}
        </div>

        {/* Global Search Trigger */}
        <div className="px-3 mb-2">
          <button
            onClick={() => setIsCommandOpen(true)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-muted-foreground bg-secondary/40 border border-border/60 hover:bg-secondary hover:text-foreground transition-all cursor-pointer ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-primary" />
              {!isCollapsed && <span>Quick Search...</span>}
            </div>
            {!isCollapsed && (
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1 text-muted-foreground/70">
              Platform
            </p>
          )}

          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                onMouseEnter={() => handlePrefetch(item.path)}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="leading-none text-xs font-medium">{item.name}</div>
                    <div className="text-[10px] mt-1 leading-none text-muted-foreground/80 font-normal truncate">
                      {item.desc}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User & Settings Footer */}
        <div className="p-3 border-t border-border/60 space-y-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground bg-secondary/30 border border-border/60 hover:bg-secondary hover:text-foreground transition-all cursor-pointer ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <span className="flex items-center gap-2">
              {isLightMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-primary" />}
              {!isCollapsed && (isLightMode ? 'Light Mode' : 'Dark Mode')}
            </span>
          </button>

          {/* User Profile Quick Card */}
          <Link
            href="/profile"
            className={`flex items-center gap-2.5 p-2 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/60 transition-all ${
              isCollapsed ? 'justify-center p-2' : ''
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate leading-none">
                  {user?.fullName || user?.email || 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                  {user?.email}
                </p>
              </div>
            )}
          </Link>

          {/* Logout */}
          {!isCollapsed && (
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
});

export default Sidebar;

