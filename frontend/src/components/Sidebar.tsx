'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { menuItems } from '../lib/navigation';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

const Sidebar = React.memo(function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isLightMode = false;
  const queryClient = useQueryClient();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

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

  const navLinkClass = (isActive: boolean, collapsed = false) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative touch-manipulation min-h-[44px] ${
      isActive
        ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm'
        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent'
    } ${collapsed ? 'justify-center px-0' : ''}`;

  const renderNavLinks = (collapsed = false, onNavigate?: () => void) =>
    menuItems.map((item) => {
      const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path));
      const Icon = item.icon;

      return (
        <Link
          key={item.path}
          href={item.path}
          onMouseEnter={() => handlePrefetch(item.path)}
          onClick={onNavigate}
          title={collapsed ? item.name : undefined}
          className={navLinkClass(isActive, collapsed)}
        >
          {isActive && !collapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
          )}
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="leading-none text-xs font-medium">{item.name}</div>
              <div className="text-[10px] mt-1 leading-none text-muted-foreground/80 font-normal truncate">
                {item.desc}
              </div>
            </div>
          )}
        </Link>
      );
    });

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 pt-safe border-b border-border/60 backdrop-blur-xl"
        style={{
          background: 'rgba(8,9,16,0.92)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9d8fff] via-[#7c6af7] to-[#4f46e5] p-[1.5px]">
              <div className="w-full h-full rounded-[9px] bg-[#1a1730] flex items-center justify-center overflow-hidden">
                <img src="/slack-app-icon.png" alt="Slack AI" className="w-5 h-5 object-contain" />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-none truncate text-white">
              Slack AI
            </p>
            <p className="text-[10px] font-semibold text-primary truncate">Workspace Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors touch-manipulation"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
              aria-label="Close navigation menu"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="md:hidden fixed top-0 right-0 bottom-0 z-[70] w-[min(88vw,320px)] flex flex-col border-l border-border/60 shadow-2xl"
              style={{
                background: isLightMode ? 'rgba(255,255,255,0.98)' : 'rgba(8,9,16,0.98)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-border/60 shrink-0">
                <span className={`text-sm font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Navigation</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors touch-manipulation"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1 text-muted-foreground/70">
                  Platform
                </p>
                {renderNavLinks(false, () => setIsMobileMenuOpen(false))}
              </nav>

              <div className="p-3 border-t border-border/60 space-y-2 shrink-0">
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/60 transition-all touch-manipulation min-h-[44px]"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate leading-none">
                      {user?.fullName || user?.email || 'User'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                      {user?.email}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer touch-manipulation min-h-[44px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full shrink-0 relative z-20 transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-[230px]'
        }`}
        style={{
          background: isLightMode ? 'rgba(255,255,255,0.98)' : 'rgba(8,9,16,0.98)',
          borderRight: isLightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 z-30 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md transition-all cursor-pointer"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

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

        <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1 text-muted-foreground/70">
              Platform
            </p>
          )}
          {renderNavLinks(isCollapsed)}
        </nav>

        <div className="p-3 border-t border-border/60 space-y-2">

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
