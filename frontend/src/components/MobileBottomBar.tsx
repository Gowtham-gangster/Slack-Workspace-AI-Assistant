'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  CheckSquare,
  FileText,
  User,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { menuItems } from '../lib/navigation';

const primaryNav = [
  { label: 'Workspace', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Insights', href: '/intelligence', icon: Brain },
  { label: 'Actions', href: '/actions', icon: CheckSquare },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Profile', href: '/profile', icon: User },
];

const moreNav = menuItems.filter(
  (item) => !primaryNav.some((nav) => nav.href === item.path) && item.path !== '/profile'
);

const MobileBottomBar = React.memo(function MobileBottomBar() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href));

  return (
    <>
      <AnimatePresence>
        {showMore && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              aria-label="Close more menu"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="md:hidden fixed left-3 right-3 z-50 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-3"
              style={{ bottom: 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
            >
              <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-border/60">
                <span className="text-xs font-bold text-foreground">More</span>
                <button
                  onClick={() => setShowMore(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors touch-manipulation"
                  aria-label="Close more menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {moreNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setShowMore(false)}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-medium transition-colors touch-manipulation min-h-[44px] ${
                        active
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch justify-around px-1 h-[var(--mobile-nav-height)] max-w-lg mx-auto">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors touch-manipulation min-h-[44px] ${
                  active ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-1 bg-primary/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 mb-0.5 z-10 ${active ? 'scale-110 text-primary' : ''} transition-transform`} />
                <span className="text-[10px] tracking-tight z-10 leading-none">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            className={`relative flex flex-1 flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors touch-manipulation min-h-[44px] ${
              showMore || moreNav.some((item) => isActive(item.path))
                ? 'text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="More navigation options"
            aria-expanded={showMore}
          >
            {(showMore || moreNav.some((item) => isActive(item.path))) && (
              <motion.div
                layoutId="mobileActiveTab"
                className="absolute inset-1 bg-primary/10 rounded-xl"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <MoreHorizontal className="w-5 h-5 mb-0.5 z-10" />
            <span className="text-[10px] tracking-tight z-10 leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
});

export default MobileBottomBar;
