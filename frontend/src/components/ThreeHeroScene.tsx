'use client';

import React, { useRef, useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import {
  Sparkles,
  MessageSquare,
  Zap,
  CheckCircle2,
  Search,
  Check,
  TrendingUp,
  ArrowRight,
  Shield,
  User,
  ListTodo,
  FileCode,
  Activity,
  Hash
} from 'lucide-react';

// Workflows Data
const WORKFLOWS = [
  {
    id: 'search',
    name: 'SEARCH EVERYTHING',
    category: 'WORKSPACE SEARCH',
    color: '#38bdf8',
    badgeIcon: Search,
    queryText: 'Find discussions about Q2 Launch',
    inputChannel: 'Global Workspace',
    inputAuthor: '@Gowtham',
    outputTitle: 'Workspace Search Results',
    outputBadge: '23 MATCHES',
    outputItems: [
      { label: '23 Messages found across 4 Channels', detail: '#engineering, #product', icon: MessageSquare, color: '#38bdf8' },
      { label: 'Key Decision Identified', detail: 'Q2 Launch approved for Thursday 2 PM', icon: CheckCircle2, color: '#34d399' },
      { label: 'Related Files Attached', detail: 'q2_launch_architecture.pdf, load_test.json', icon: FileCode, color: '#a78bfa' }
    ],
    metricLabel: 'Search Latency',
    metricValue: '18ms'
  },
  {
    id: 'chat',
    name: 'AI WORKSPACE CHAT',
    category: 'INTELLIGENT SUMMARY',
    color: '#7c6af7',
    badgeIcon: Sparkles,
    queryText: 'Summarize today’s engineering discussion.',
    inputChannel: '#db-migration',
    inputAuthor: '@Priya',
    outputTitle: 'AI Copilot Summary Response',
    outputBadge: 'STREAMING AI',
    outputItems: [
      { label: 'MySQL 8.0 production migration complete', detail: 'All 10k records verified', icon: Check, color: '#34d399' },
      { label: 'DB replica load-test passed at 12ms', detail: 'Zero query bottlenecks', icon: Zap, color: '#38bdf8' },
      { label: 'Next Step: Audit OAuth rate limit intervals', detail: 'Assigned to @David', icon: ListTodo, color: '#fbbf24' }
    ],
    metricLabel: 'Channels Synced',
    metricValue: '100%'
  },
  {
    id: 'decisions',
    name: 'DECISION DETECTION',
    category: 'AUTOMATED DECISION LOG',
    color: '#34d399',
    badgeIcon: Shield,
    queryText: '“Engineering consensus reached: Proceed with Q2 production launch.”',
    inputChannel: '#eng-architecture',
    inputAuthor: '@Priya & Team',
    outputTitle: 'Decision Extracted & Audited',
    outputBadge: 'CONSENSUS 100%',
    outputItems: [
      { label: '🟢 Q2 Production Launch Approved', detail: 'Target: Thursday 2:00 PM EST', icon: CheckCircle2, color: '#34d399' },
      { label: 'Owner & Lead', detail: '@Engineering Operations', icon: User, color: '#a78bfa' },
      { label: 'Consensus Verification', detail: '8 Team Approvals Recorded', icon: Shield, color: '#fbbf24' }
    ],
    metricLabel: 'Audit Status',
    metricValue: 'Verified'
  },
  {
    id: 'actions',
    name: 'ACTION ITEM EXTRACTION',
    category: 'TASK MANAGEMENT',
    color: '#fbbf24',
    badgeIcon: ListTodo,
    queryText: '“Priya will test DB replica; Gowtham to update API docs; David to audit tokens.”',
    inputChannel: '#standup-notes',
    inputAuthor: '@David',
    outputTitle: 'Action Items Extracted',
    outputBadge: '3 TASKS CREATED',
    outputItems: [
      { label: 'Load-test DB replica with 10k dataset', detail: 'Owner: @Priya | Due Today', icon: ListTodo, color: '#38bdf8' },
      { label: 'Document Slack MCP credentials guide', detail: 'Owner: @Gowtham | In Progress', icon: ListTodo, color: '#fbbf24' },
      { label: 'Audit OAuth token refresh expiration', detail: 'Owner: @David | Completed', icon: CheckCircle2, color: '#34d399' }
    ],
    metricLabel: 'Tasks Assigned',
    metricValue: '3 Items'
  },
  {
    id: 'analytics',
    name: 'WORKSPACE ANALYTICS',
    category: 'HEALTH & METRICS',
    color: '#f43f5e',
    badgeIcon: Activity,
    queryText: 'Analyze workspace activity & team engagement.',
    inputChannel: 'All 18 Channels',
    inputAuthor: 'Telemetry Engine',
    outputTitle: 'Workspace Velocity Metrics',
    outputBadge: 'HEALTH: 92%',
    outputItems: [
      { label: 'Team Collaboration Score', detail: '92% Healthy Engagement', icon: TrendingUp, color: '#34d399' },
      { label: 'Top Active Channel', detail: '#engineering (142 messages/day)', icon: Hash, color: '#7c6af7' },
      { label: 'Trending Topics', detail: 'MySQL Migration, OAuth Refresh', icon: Activity, color: '#0ea5e9' }
    ],
    metricLabel: 'Team Velocity',
    metricValue: '+34%'
  }
];

// Pre-allocated static buffers for instant WebGL performance
const PARTICLE_COUNT = 25;
const STATIC_PARTICLES = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  STATIC_PARTICLES[i * 3] = (Math.random() - 0.5) * 5.0;
  STATIC_PARTICLES[i * 3 + 1] = (Math.random() - 0.5) * 2.8;
  STATIC_PARTICLES[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
}

// Error Boundary for WebGL Context Loss
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    console.warn('WebGL Error caught by boundary.', error);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Fully Animated 3D Scene Component
const FastHeroScene = ({
  workflowIndex,
  onEmblemClick,
  setWorkflowIndex
}: {
  workflowIndex: number;
  onEmblemClick: () => void;
  setWorkflowIndex: (idx: number) => void;
}) => {
  const workflow = WORKFLOWS[workflowIndex % WORKFLOWS.length] || WORKFLOWS[0];
  const BadgeIcon = workflow.badgeIcon;

  return (
    <div className="w-full h-full relative flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Dynamic Background Ambient Glow Layer */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.2, 0.35, 0.2]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="absolute inset-0 m-auto w-96 h-96 rounded-full bg-[#7c6af7]/30 blur-[130px] pointer-events-none"
      />

      {/* Floating Background Sparkle Dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: `${(i * 8.5) % 100}%`,
              y: '100%',
              opacity: 0.1
            }}
            animate={{
              y: ['100%', '-10%'],
              opacity: [0.1, 0.6, 0.1],
              scale: [0.8, 1.4, 0.8]
            }}
            transition={{
              duration: 6 + (i % 5) * 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'linear'
            }}
            className="absolute w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]"
          />
        ))}
      </div>

      {/* Active Workflow Header Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#090a14]/90 backdrop-blur-xl border border-white/10 text-[11px] font-mono font-bold text-slate-200 shadow-2xl">
        <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] animate-ping" />
        <span style={{ color: workflow.color }}>{workflow.name}</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400 font-normal">
          Workflow {workflowIndex + 1}/{WORKFLOWS.length}
        </span>
      </div>

      {/* Neural Stream Energy SVG Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 hidden lg:block opacity-60">
        <defs>
          <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#7c6af7" stopOpacity="1" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <path d="M 220 240 Q 380 200 500 240" fill="none" stroke="url(#neuralGrad)" strokeWidth="2" strokeDasharray="6 6" />
        <path d="M 500 240 Q 620 280 780 240" fill="none" stroke="url(#neuralGrad)" strokeWidth="2" strokeDasharray="6 6" />

        <motion.circle
          cx="220"
          cy="240"
          r="4"
          fill="#38bdf8"
          animate={{
            cx: [220, 500],
            cy: [240, 240],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
        <motion.circle
          cx="500"
          cy="240"
          r="4"
          fill="#34d399"
          animate={{
            cx: [500, 780],
            cy: [240, 240],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            delay: 1.1,
            ease: 'easeInOut'
          }}
        />
      </svg>

      {/* Main 3D Composition Grid */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center z-10">
        {/* Left Input Card */}
        <motion.div
          key={`input-${workflow.id}`}
          initial={{ opacity: 0, x: -25, scale: 0.95 }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
            y: [0, -6, 0]
          }}
          transition={{
            opacity: { duration: 0.4 },
            scale: { duration: 0.4 },
            x: { duration: 0.4 },
            y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          }}
          className="lg:col-span-4 bg-[#090a14]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl relative group hover:border-[#38bdf8]/40 transition-colors"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <BadgeIcon className="w-3.5 h-3.5" style={{ color: workflow.color }} />
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                {workflow.category}
              </span>
            </div>
            <span className="text-[9px] font-mono text-[#38bdf8] bg-[#0ea5e9]/10 px-2 py-0.5 rounded border border-[#0ea5e9]/20 font-bold">
              {workflow.inputChannel}
            </span>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 mb-3">
            <p className="text-[11.5px] text-slate-100 font-medium leading-relaxed italic">
              {workflow.queryText}
            </p>
          </div>

          <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 border-t border-white/5 pt-2">
            <span className="text-slate-400 font-bold">{workflow.inputAuthor}</span>
            <span className="flex items-center gap-1 text-[#38bdf8] font-bold">
              <span>Streaming to AI</span>
              <ArrowRight className="w-3 h-3 animate-pulse" />
            </span>
          </div>
        </motion.div>
        <div className="lg:col-span-4 flex flex-col items-center justify-center my-4 lg:my-0 relative">
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotateZ: [0, 1, -1, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEmblemClick}
            className="relative cursor-pointer group"
          >
            {/* Pulsing Aura Rings */}
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.3, 0.7, 0.3]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className="absolute -inset-4 rounded-full border border-[#0ea5e9]/40 pointer-events-none"
            />
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#7c6af7] via-[#0ea5e9] to-[#34d399] blur-xl opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse" />

            <div className="relative w-32 h-32 rounded-[24px] bg-[#0c0d19]/90 backdrop-blur-2xl border border-white/20 flex flex-col items-center justify-center p-4 shadow-2xl overflow-hidden">
              <img
                src="/slack-app-icon.png"
                alt="Slack AI Brain Logo"
                className="w-18 h-18 object-contain filter drop-shadow-[0_0_15px_rgba(124,106,247,0.7)] group-hover:scale-110 transition-transform duration-300"
              />
              <div className="mt-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#7c6af7]/20 border border-[#7c6af7]/40 text-[#a78bfa] text-[9.5px] font-mono font-bold tracking-widest uppercase">
                <Sparkles className="w-2.5 h-2.5 text-[#0ea5e9] animate-pulse" />
                <span>AI BRAIN</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Output Card */}
        <motion.div
          key={`output-${workflow.id}`}
          initial={{ opacity: 0, x: 25, scale: 0.95 }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
            y: [0, 6, 0]
          }}
          transition={{
            opacity: { duration: 0.4 },
            scale: { duration: 0.4 },
            x: { duration: 0.4 },
            y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
          }}
          className="lg:col-span-4 bg-[#0c0d19]/95 backdrop-blur-2xl border border-[#7c6af7]/40 rounded-2xl p-4 shadow-2xl relative group hover:border-[#7c6af7]/70 transition-colors"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#0ea5e9] animate-pulse" />
              <span className="text-[11px] font-bold text-white tracking-wide">
                {workflow.outputTitle}
              </span>
            </div>
            <span
              className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border"
              style={{
                backgroundColor: `${workflow.color}15`,
                color: workflow.color,
                borderColor: `${workflow.color}30`
              }}
            >
              {workflow.outputBadge}
            </span>
          </div>

          <div className="space-y-2 mb-3">
            {workflow.outputItems.map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 + 0.15 }}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-200"
                >
                  <ItemIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: item.color }} />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-100 leading-snug">{item.label}</span>
                    <span className="text-[9.5px] font-mono text-slate-400">{item.detail}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-white/5 pt-2">
            <span className="flex items-center gap-1 text-[#34d399] font-bold">
              <Check className="w-3 h-3" /> Live Intelligence
            </span>
            <span className="text-[#a78bfa] font-bold">
              {workflow.metricLabel}: {workflow.metricValue}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scenario Progress Selector Pills */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#080913]/85 backdrop-blur-xl border border-white/10 shadow-2xl">
        {WORKFLOWS.map((wf, idx) => (
          <button
            key={wf.id}
            onClick={() => setWorkflowIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === workflowIndex % WORKFLOWS.length
                ? 'w-6 bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]'
                : 'bg-white/20 hover:bg-white/40'
            }`}
            title={wf.name}
          />
        ))}
      </div>
    </div>
  );
};

// Optional WebGL Layer for High-End Devices
const SimpleParticles = () => {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      const posArr = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const xIdx = i * 3;
        posArr[xIdx] += delta * 1.2;
        if (posArr[xIdx] > 2.8) {
          posArr[xIdx] = -2.8;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[STATIC_PARTICLES, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#38bdf8" size={0.05} transparent opacity={0.7} depthWrite={false} />
    </points>
  );
};

export default function ThreeHeroScene() {
  const [workflowIndex, setWorkflowIndex] = useState(0);
  const [useWebGL, setUseWebGL] = useState(false);

  // Lazy enable light WebGL after initial fast render
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (gl) setUseWebGL(true);
      } catch (e) {
        setUseWebGL(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  // Continuous 6-second workflow loop
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkflowIndex((prev) => (prev + 1) % WORKFLOWS.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const handleEmblemClick = () => {
    setWorkflowIndex((prev) => (prev + 1) % WORKFLOWS.length);
  };

  const fastScene = (
    <FastHeroScene
      workflowIndex={workflowIndex}
      onEmblemClick={handleEmblemClick}
      setWorkflowIndex={setWorkflowIndex}
    />
  );

  if (!useWebGL) {
    return fastScene;
  }

  return (
    <WebGLErrorBoundary fallback={fastScene}>
      <div className="w-full h-full relative">
        {fastScene}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ powerPreference: 'high-performance', antialias: false }}>
            <SimpleParticles />
          </Canvas>
        </div>
      </div>
    </WebGLErrorBoundary>
  );
}
