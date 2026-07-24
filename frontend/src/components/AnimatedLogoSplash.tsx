'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// ─── SVG Path for the chat bubble (clockwise, with bottom-center tail) ────────
const BUBBLE_PATH =
  'M 45 15 H 155 Q 182 15 182 42 V 163 Q 182 190 155 190 H 117 L 100 212 L 83 190 H 45 Q 18 190 18 163 V 42 Q 18 15 45 15 Z';

// Approximate perimeter of the bubble path (for dashoffset animation)
const BUBBLE_PERIMETER = 596;

// ─── Slack blocks in compass layout ──────────────────────────────────────────
const SLACK_BLOCKS = [
  { id: 'top',    x: 91,  y: 44,  color: '#E01E5A', delay: 0.75 }, // Red
  { id: 'left',   x: 63,  y: 68,  color: '#36C5F0', delay: 0.87 }, // Blue
  { id: 'bottom', x: 91,  y: 92,  color: '#2EB67D', delay: 0.99 }, // Green
  { id: 'right',  x: 119, y: 68,  color: '#ECB22E', delay: 1.11 }, // Yellow
];

// ─── Typing dots ──────────────────────────────────────────────────────────────
const DOTS = [82, 100, 118];

interface AnimatedLogoSplashProps {
  onComplete: () => void;
}

export default function AnimatedLogoSplash({ onComplete }: AnimatedLogoSplashProps) {
  const prefersReducedMotion = useReducedMotion();

  React.useEffect(() => {
    const duration = prefersReducedMotion ? 100 : 2700;
    const t = setTimeout(onComplete, duration);
    return () => clearTimeout(t);
  }, [onComplete, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, exit: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } as any}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#03040a] overflow-hidden"
      style={{ willChange: 'opacity' }}
    >

      {/* ── Phase 1: Radial ambient glow ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(124,106,247,0.22) 0%, rgba(56,189,248,0.06) 45%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* ── Secondary inner glow ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.4] }}
        transition={{ delay: 1.6, duration: 0.8, ease: 'easeInOut' }}
        className="absolute w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(124,106,247,0.3) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* ── Phase 1: Logo entrance ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: 'transform, opacity, filter' }}
      >
        <svg
          width="196"
          height="214"
          viewBox="0 0 200 218"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Slack AI Workspace Assistant Logo"
        >
          <defs>
            {/* Bubble dark fill */}
            <radialGradient id="splBubbleFill" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#18192e" />
              <stop offset="100%" stopColor="#07080f" />
            </radialGradient>

            {/* Stroke travelling highlight */}
            <linearGradient id="splStrokeHi" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
              <stop offset="40%" stopColor="#a78bfa" stopOpacity="1" />
              <stop offset="60%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Outer ring energy sweep */}
            <linearGradient id="splRingSwipe" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7c6af7" stopOpacity="0" />
              <stop offset="35%" stopColor="#7c6af7" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Cyan eye glow filter */}
            <filter id="splEyeGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Antenna glow filter */}
            <filter id="splAntennaGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Outer ring subtle glow */}
            <filter id="splRingGlow" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Block glow */}
            <filter id="splBlockGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Outer ring (static, subtle) ── */}
          <motion.circle
            cx="100" cy="112" r="95"
            stroke="rgba(124,106,247,0.12)"
            strokeWidth="1"
            fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          />

          {/* ── Phase 6: Outer ring energy sweep ── */}
          <motion.circle
            cx="100" cy="112" r="95"
            stroke="url(#splRingSwipe)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`70 ${2 * Math.PI * 95 - 70}`}
            initial={{ rotate: -90, strokeDashoffset: 0, opacity: 0 }}
            animate={{
              strokeDashoffset: [0, -(2 * Math.PI * 95)],
              opacity: [0, 1, 1, 0]
            }}
            style={{ transformOrigin: '100px 112px' }}
            transition={{ delay: 1.65, duration: 0.75, ease: 'easeInOut' }}
          />

          {/* ── Phase 6: Ring pulse ── */}
          <motion.circle
            cx="100" cy="112" r="95"
            stroke="rgba(124,106,247,0.35)"
            strokeWidth="1.5"
            fill="none"
            filter="url(#splRingGlow)"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.7, 0], scale: [1, 1.02, 1] }}
            style={{ transformOrigin: '100px 112px' }}
            transition={{ delay: 1.7, duration: 0.5, ease: 'easeInOut' }}
          />

          {/* ── Phase 2: Bubble fill ── */}
          <motion.path
            d={BUBBLE_PATH}
            fill="url(#splBubbleFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          />

          {/* ── Phase 2: Bubble border draw (clockwise stroke) ── */}
          <motion.path
            d={BUBBLE_PATH}
            stroke="rgba(255,255,255,0.88)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.58, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* ── Phase 2: Travelling gradient highlight on border ── */}
          <motion.path
            d={BUBBLE_PATH}
            stroke="url(#splStrokeHi)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`55 ${BUBBLE_PERIMETER}`}
            initial={{ strokeDashoffset: 0, opacity: 0 }}
            animate={{
              strokeDashoffset: [0, -(BUBBLE_PERIMETER + 55)],
              opacity: [0, 1, 1, 0]
            }}
            transition={{ delay: 0.28, duration: 0.58, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* ── Phase 3: Slack blocks (compass pattern, sequential) ── */}
          {SLACK_BLOCKS.map((block) => (
            <motion.rect
              key={block.id}
              x={block.x}
              y={block.y}
              width="18"
              height="18"
              rx="4.5"
              fill={block.color}
              filter="url(#splBlockGlow)"
              initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              style={{ transformOrigin: `${block.x + 9}px ${block.y + 9}px` }}
              transition={{
                delay: block.delay,
                duration: 0.32,
                type: 'spring',
                stiffness: 380,
                damping: 14,
              }}
            />
          ))}

          {/* ── Phase 4: Robot — floating group ── */}
          <motion.g
            animate={{ y: [0, -5, 0] }}
            transition={{
              delay: 1.35,
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Antenna stem */}
            <motion.line
              x1="100" y1="119" x2="100" y2="108"
              stroke="#a78bfa"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              style={{ transformOrigin: '100px 119px' }}
              transition={{ delay: 1.15, duration: 0.22, ease: 'easeOut' }}
            />

            {/* Antenna glow tip */}
            <motion.circle
              cx="100" cy="105" r="4"
              fill="#38bdf8"
              filter="url(#splAntennaGlow)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              style={{ transformOrigin: '100px 105px' }}
              transition={{
                delay: 1.3,
                duration: 0.28,
                type: 'spring',
                stiffness: 500,
                damping: 18,
              }}
            />

            {/* Antenna tip pulse */}
            <motion.circle
              cx="100" cy="105" r="4"
              fill="transparent"
              stroke="#38bdf8"
              strokeWidth="2"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 2.2, 1], opacity: [0, 0.6, 0] }}
              style={{ transformOrigin: '100px 105px' }}
              transition={{ delay: 1.42, duration: 0.6, repeat: 2, ease: 'easeOut' }}
            />

            {/* Robot head */}
            <motion.rect
              x="78" y="119" width="44" height="34" rx="10"
              fill="#0e0f1e"
              stroke="rgba(124,106,247,0.55)"
              strokeWidth="1.5"
              initial={{ scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ transformOrigin: '100px 136px' }}
              transition={{
                delay: 1.12,
                duration: 0.38,
                type: 'spring',
                stiffness: 340,
                damping: 16,
              }}
            />

            {/* Left eye */}
            <motion.circle
              cx="90" cy="135" r="5"
              fill="#38bdf8"
              filter="url(#splEyeGlow)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ transformOrigin: '90px 135px' }}
              transition={{
                delay: 1.32,
                duration: 0.22,
                type: 'spring',
                stiffness: 600,
                damping: 20,
              }}
            />

            {/* Right eye */}
            <motion.circle
              cx="110" cy="135" r="5"
              fill="#38bdf8"
              filter="url(#splEyeGlow)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ transformOrigin: '110px 135px' }}
              transition={{
                delay: 1.38,
                duration: 0.22,
                type: 'spring',
                stiffness: 600,
                damping: 20,
              }}
            />

            {/* Robot mouth (subtle expression) */}
            <motion.rect
              x="88" y="146" width="24" height="3" rx="1.5"
              fill="rgba(167,139,250,0.5)"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              style={{ transformOrigin: '100px 147.5px' }}
              transition={{ delay: 1.45, duration: 0.25, ease: 'easeOut' }}
            />
          </motion.g>

          {/* ── Phase 5: Typing dots (sequential bounce, 2 cycles) ── */}
          {DOTS.map((cx, i) => (
            <motion.circle
              key={cx}
              cx={cx}
              cy="170"
              r="4.5"
              fill="rgba(167,139,250,0.75)"
              initial={{ y: 0, opacity: 0 }}
              animate={{
                y: [0, 0, -7, 0, -7, 0],
                opacity: [0, 1, 1, 1, 1, 0.8],
              }}
              transition={{
                delay: 1.48 + i * 0.13,
                duration: 0.8,
                ease: 'easeInOut',
              }}
            />
          ))}
        </svg>
      </motion.div>

      {/* ── Phase 6: Orbiting particles ─────────────────────────────── */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 360;
        const rad = (angle * Math.PI) / 180;
        const orbitR = 112;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 6 : 4,
              height: i % 3 === 0 ? 6 : 4,
              background: i % 2 === 0 ? '#7c6af7' : '#38bdf8',
              boxShadow: i % 2 === 0
                ? '0 0 8px 2px rgba(124,106,247,0.7)'
                : '0 0 8px 2px rgba(56,189,248,0.7)',
            }}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0],
              x: Math.cos(rad) * orbitR,
              y: Math.sin(rad) * orbitR,
            }}
            transition={{
              delay: 1.65 + i * 0.055,
              duration: 0.55,
              ease: 'easeOut',
            }}
          />
        );
      })}

      {/* ── Brand label (fades in with logo) ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ delay: 0.55, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mt-7 flex flex-col items-center gap-1.5 select-none"
      >
        <span className="text-white font-bold text-[16px] tracking-tight leading-none">
          Slack AI
        </span>
        <span
          className="text-[10px] font-bold tracking-[0.22em] uppercase leading-none"
          style={{ color: '#7c6af7' }}
        >
          Workspace Assistant
        </span>
      </motion.div>

      {/* ── Phase 7: Subtle loading bar at bottom ────────────────────── */}
      <motion.div
        className="absolute bottom-12 w-32 h-0.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #7c6af7, #38bdf8)' }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.5, duration: 2.0, ease: [0.4, 0, 0.2, 1] }}
        />
      </motion.div>

    </motion.div>
  );
}
