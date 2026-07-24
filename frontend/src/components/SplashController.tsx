'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import AnimatedLogoSplash from './AnimatedLogoSplash';

const SESSION_KEY = 'saia_splash_shown';

export default function SplashController({ children }: { children: React.ReactNode }) {
  // null = not yet determined (server/hydration phase)
  // true = show splash
  // false = splash done / skip
  const [showSplash, setShowSplash] = useState<boolean | null>(null);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    const alreadyShown = sessionStorage.getItem(SESSION_KEY) === '1';

    if (isMobile && !alreadyShown) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setShowSplash(true);
    } else {
      setShowSplash(false);
    }
  }, []);

  const handleComplete = () => setShowSplash(false);

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash === true && (
          <AnimatedLogoSplash key="splash" onComplete={handleComplete} />
        )}
      </AnimatePresence>

      {/*
        Content is invisible while splash is showing (null or true state).
        Fades in smoothly when splash completes.
        On desktop: null → false in one useEffect tick → fade in.
      */}
      <div
        style={{
          opacity: showSplash === false ? 1 : 0,
          transition: showSplash === false ? 'opacity 0.45s ease' : 'none',
          minHeight: '100%',
        }}
      >
        {children}
      </div>
    </>
  );
}
