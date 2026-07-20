'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Home, 
  MessageSquare, 
  Brain, 
  BarChart3, 
  User, 
  Sparkles
} from 'lucide-react';

interface MobileBottomBarProps {
  onOpenSearch?: () => void;
  onOpenCopilot?: () => void;
}

export default function MobileBottomBar({ onOpenCopilot }: MobileBottomBarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Workspace', href: '/dashboard', icon: MessageSquare },
    { label: 'Intelligence', href: '/intelligence', icon: Brain },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border px-3 py-1.5 pb-safe shadow-2xl">
      <div className="flex items-center justify-around relative max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors min-w-[56px] min-h-[44px] touch-manipulation ${
                isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileActiveTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={`w-5 h-5 mb-0.5 z-10 ${isActive ? 'scale-110 text-primary' : ''} transition-transform`} />
              <span className="text-[10px] tracking-tight z-10 leading-none">{item.label}</span>
            </Link>
          );
        })}

        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            aria-label="Open AI Assistant"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-accent text-white shadow-lg shadow-primary/25 active:scale-95 transition-transform ml-1"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
