'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  MessageSquare, 
  Hash, 
  FileText, 
  Brain, 
  Settings, 
  User, 
  BarChart3, 
  Sparkles,
  Command,
  X,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = [
    { id: 'dashboard', title: 'Open Main Workspace', category: 'Navigation', icon: MessageSquare, href: '/dashboard' },
    { id: 'intelligence', title: 'Open AI Intelligence Hub', category: 'Navigation', icon: Brain, href: '/intelligence' },
    { id: 'reports', title: 'View Workspace Analytics & Reports', category: 'Navigation', icon: BarChart3, href: '/reports' },
    { id: 'knowledge', title: 'Search Knowledge Base & Memory', category: 'Navigation', icon: FileText, href: '/knowledge' },
    { id: 'settings', title: 'Configure App Settings', category: 'System', icon: Settings, href: '/settings' },
    { id: 'profile', title: 'View User Profile & Bio', category: 'System', icon: User, href: '/profile' },
    { id: 'support', title: 'Open Developer Support & Contact', category: 'Help', icon: HelpCircle, href: '/support' },
  ];

  const filteredActions = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleExecute = useCallback((item: typeof actions[0]) => {
    onClose();
    if (item.href) {
      router.push(item.href);
    }
  }, [onClose, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          handleExecute(filteredActions[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, handleExecute, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden glass-elevated z-10"
          >
            {/* Header / Input */}
            <div className="flex items-center px-4 py-3.5 border-b border-border/80 bg-secondary/30">
              <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search commands, channels, messages, or AI actions... (Cmd+K)"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
              />
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
              {filteredActions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No matching commands or actions found for &quot;{query}&quot;.
                </div>
              ) : (
                filteredActions.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleExecute(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'text-foreground hover:bg-secondary/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-secondary text-primary'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-xs md:text-sm">{item.title}</div>
                          <div className={`text-[11px] ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {item.category}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'}`} />
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border/60 bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">esc</kbd> close</span>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Slack AI Command Engine</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
