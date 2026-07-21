'use client';

import React from 'react';
import Sidebar from './Sidebar';
import MobileBottomBar from './MobileBottomBar';

interface AppLayoutProps {
  children: React.ReactNode;
  mainClassName?: string;
  showMobileNav?: boolean;
}

export default function AppLayout({
  children,
  mainClassName = '',
  showMobileNav = true,
}: AppLayoutProps) {
  return (
    <div className="flex h-full min-h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main
        className={`app-main flex-1 flex flex-col min-h-0 overflow-y-auto relative z-10 ${mainClassName}`}
      >
        {children}
      </main>
      {showMobileNav && <MobileBottomBar />}
    </div>
  );
}
