'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
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
  BarChart3,
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard',    path: '/dashboard',   icon: LayoutDashboard, desc: 'Overview & command center' },
  { name: 'Intelligence', path: '/intelligence', icon: Brain,           desc: 'Topics, sentiment, health' },
  { name: 'Action Center',path: '/actions',      icon: CheckSquare,     desc: 'Tasks & action items' },
  { name: 'Timeline',     path: '/timeline',     icon: Clock,           desc: 'Activity timeline' },
  { name: 'Knowledge',    path: '/knowledge',    icon: Network,         desc: 'AI knowledge graph' },
  { name: 'Memory',       path: '/memory',       icon: BookOpen,        desc: 'Workspace memory' },
  { name: 'Reports',      path: '/reports',      icon: FileText,        desc: 'Analytics & exports' },
  { name: 'Settings',     path: '/settings',     icon: SettingsIcon,    desc: 'Keys & config' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';

  const initials = (user?.fullName || user?.username || 'US').slice(0, 2).toUpperCase();

  return (
    <aside className="w-[220px] flex flex-col h-full shrink-0 relative z-10 transition-colors duration-300"
           style={{
             background: isLightMode ? 'rgba(255,255,255,0.97)' : 'rgba(8,9,16,0.97)',
             borderRight: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)'
           }}>

      {/* Ambient top glow */}
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.15) 0%, transparent 70%)' }} />

      {/* Brand */}
      <div className="h-14 flex items-center px-4 gap-3 shrink-0 relative">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', boxShadow: '0 4px 16px rgba(124,106,247,0.4)' }}>
          <Zap className="w-3.5 h-3.5 text-white" fill="white" />
        </div>
        <div className="min-w-0">
          <h1 className={`font-bold text-[12px] leading-none tracking-tight ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Slack AI</h1>
          <span className="text-[9px] font-semibold mt-0.5 block" style={{ color: '#7c6af7' }}>Intelligence Platform</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t" style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }} />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[9px] font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: isLightMode ? '#94a3b8' : '#374151' }}>Navigation</p>
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 group relative overflow-hidden"
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(124,106,247,0.18), rgba(99,102,241,0.10))',
                color: isLightMode ? '#6366f1' : '#a78bfa',
                border: isLightMode ? '1px solid rgba(124,106,247,0.25)' : '1px solid rgba(124,106,247,0.2)',
              } : {
                color: isLightMode ? '#4b5563' : '#6b7280',
                border: '1px solid transparent',
              }}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                     style={{ background: 'linear-gradient(to bottom, #a78bfa, #7c6af7)' }} />
              )}
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                   style={isActive
                     ? { background: 'rgba(124,106,247,0.25)' }
                     : { background: isLightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}>
                <Icon className="w-3 h-3" style={isActive ? { color: isLightMode ? '#6366f1' : '#a78bfa' } : { color: isLightMode ? '#64748b' : '#6b7280' }} />
              </div>
              <div className="min-w-0">
                <div className="leading-none text-[12px]">{item.name}</div>
                <div className="text-[9px] mt-0.5 leading-none font-normal" style={{ color: isActive ? (isLightMode ? 'rgba(99,102,241,0.7)' : 'rgba(167,139,250,0.5)') : (isLightMode ? '#94a3b8' : '#374151') }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t" style={{ borderColor: isLightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }} />

      {/* User section */}
      <div className="p-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[11px] font-medium transition-all duration-200 border mb-2.5 outline-none cursor-pointer"
          style={{
            color: isLightMode ? '#4b5563' : '#9ca3af',
            borderColor: isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
            background: isLightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
          }}
        >
          <span className="flex items-center gap-2">
            {isLightMode ? (
              <><Sun className="w-3 h-3 text-[#7c6af7]" />Light Mode</>
            ) : (
              <><Moon className="w-3 h-3 text-[#7c6af7]" />Dark Mode</>
            )}
          </span>
          <div className={`relative w-7 h-4 rounded-full transition-colors duration-200 shrink-0 ${isLightMode ? 'bg-slate-200' : 'bg-[#7c6af7]'}`}>
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${isLightMode ? 'translate-x-0' : 'translate-x-3'}`} />
          </div>
        </button>

        {/* User card */}
        <Link
          href="/profile"
          className={`flex items-center gap-2.5 p-2.5 rounded-xl mb-2 cursor-pointer border transition-all block ${
            isLightMode ? 'hover:bg-slate-100/80 border-slate-200/80' : 'hover:bg-white/[0.05] border-white/[0.06]'
          }`}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
               style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', color: '#fff' }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-bold truncate leading-none ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
              {user?.fullName || user?.username || 'User'}
            </p>
            {user?.fullName && (
              <p className={`text-[9px] truncate mt-1 leading-none ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {user.username}
              </p>
            )}
          </div>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#10b981' }} />
        </Link>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-all duration-200"
          style={{
            color: isLightMode ? '#4b5563' : '#6b7280',
            border: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)'
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.25)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = isLightMode ? '#4b5563' : '#6b7280';
            (e.currentTarget as HTMLButtonElement).style.borderColor = isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
