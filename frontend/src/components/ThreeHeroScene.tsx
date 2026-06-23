'use client';

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from './ThemeContext';
import { Sparkles, MessageSquare, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

// Single message node traveling into the core
interface MessageNode {
  id: string;
  text: string;
  category: 'dev' | 'review' | 'bug' | 'meeting' | 'design';
  position: [number, number, number];
  target: [number, number, number];
  progress: number; // 0 to 1
  speed: number;
  curveOffset: [number, number, number];
}

const FloatingNode = ({ node, onReachCore }: { node: MessageNode; onReachCore: (id: string) => void }) => {
  const ref = useRef<THREE.Group>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useFrame((state, delta) => {
    if (ref.current) {
      // Increment progress
      node.progress += delta * node.speed;
      if (node.progress >= 1) {
        onReachCore(node.id);
        return;
      }

      // Calculate path with a slight Bezier-like curve offset
      const start = node.position;
      const target = node.target;
      const p = node.progress;

      // Linear interpolation + curve arch
      const x = THREE.MathUtils.lerp(start[0], target[0], p) + Math.sin(p * Math.PI) * node.curveOffset[0];
      const y = THREE.MathUtils.lerp(start[1], target[1], p) + Math.sin(p * Math.PI) * node.curveOffset[1];
      const z = THREE.MathUtils.lerp(start[2], target[2], p) + Math.cos(p * Math.PI) * node.curveOffset[2];

      ref.current.position.set(x, y, z);
      
      // Face-towards camera rotation
      ref.current.quaternion.copy(state.camera.quaternion);
    }
  });

  const iconAndColor = useMemo(() => {
    switch (node.category) {
      case 'dev':
        return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, bg: isLight ? 'bg-[#10b981]/15 text-[#047857] border-[#10b981]/30 shadow-[#10b981]/10' : 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' };
      case 'review':
        return { icon: <MessageSquare className="w-3.5 h-3.5" />, bg: isLight ? 'bg-[#7c6af7]/15 text-[#5b21b6] border-[#7c6af7]/30 shadow-[#7c6af7]/10' : 'bg-[#7c6af7]/15 text-[#a78bfa] border-[#7c6af7]/25 shadow-[0_0_15px_rgba(124,106,247,0.15)]' };
      case 'bug':
        return { icon: <AlertCircle className="w-3.5 h-3.5" />, bg: isLight ? 'bg-[#f43f5e]/15 text-[#9f1239] border-[#f43f5e]/30 shadow-[#f43f5e]/10' : 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25 shadow-[0_0_15px_rgba(244,63,94,0.15)]' };
      case 'meeting':
        return { icon: <Sparkles className="w-3.5 h-3.5" />, bg: isLight ? 'bg-[#fbbf24]/15 text-[#78350f] border-[#fbbf24]/30 shadow-[#fbbf24]/10' : 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/25 shadow-[0_0_15px_rgba(251,191,36,0.15)]' };
      default:
        return { icon: <Zap className="w-3.5 h-3.5" />, bg: isLight ? 'bg-[#0ea5e9]/15 text-[#0369a1] border-[#0ea5e9]/30 shadow-[#0ea5e9]/10' : 'bg-[#0ea5e9]/15 text-[#38bdf8] border-[#0ea5e9]/25 shadow-[0_0_15px_rgba(14,165,233,0.15)]' };
    }
  }, [node.category, isLight]);

  return (
    <group ref={ref}>
      <Html distanceFactor={5} center>
        <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full border backdrop-blur-md whitespace-nowrap text-[10.5px] font-bold transition-all duration-300 select-none shadow-md ${iconAndColor.bg}`}>
          {iconAndColor.icon}
          <span>{node.text}</span>
        </div>
      </Html>
    </group>
  );
};

// Swirling Particle field surrounding the core
const SwirlingParticles = ({ theme }: { theme: string }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 350;

  const [positions, speeds, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sp = new Float32Array(count);
    const ph = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random radius from core
      const r = THREE.MathUtils.randFloat(0.8, 3.2);
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = THREE.MathUtils.randFloat(-Math.PI / 2, Math.PI / 2);

      pos[i * 3] = r * Math.cos(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi);

      sp[i] = THREE.MathUtils.randFloat(0.12, 0.45);
      ph[i] = THREE.MathUtils.randFloat(0, Math.PI * 2);
    }

    return [pos, sp, ph];
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      const time = state.clock.getElapsedTime();
      const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < count; i++) {
        // Simple rotation around Y axis
        const xIdx = i * 3;
        const zIdx = i * 3 + 2;
        const x = posArray[xIdx];
        const z = posArray[zIdx];

        // Orbit speed
        const speed = speeds[i] * 0.15;
        const cos = Math.cos(speed);
        const sin = Math.sin(speed);

        // Rotate
        posArray[xIdx] = x * cos - z * sin;
        posArray[zIdx] = x * sin + z * cos;

        // Subtle up-down wave
        posArray[i * 3 + 1] += Math.sin(time * 0.8 + phases[i]) * 0.0015;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const particleColor = useMemo(() => {
    return theme === 'light' ? '#6366f1' : '#a78bfa';
  }, [theme]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={particleColor}
        size={0.035}
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

// Scene lighting, parallax, and core sphere controller
const SceneContent = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  
  // Scenarios database
  const scenariosList = useMemo(() => [
    { text: 'Deployment Complete', category: 'dev' },
    { text: 'Need API Review', category: 'review' },
    { text: 'Bug Fixed', category: 'bug' },
    { text: 'Meeting Scheduled', category: 'meeting' },
    { text: 'Architecture Discussion', category: 'design' },
    { text: 'New OAuth scopes approved', category: 'dev' },
    { text: 'Database latency spike', category: 'bug' },
    { text: 'Client demo ready', category: 'review' }
  ], []);

  const [nodes, setNodes] = useState<MessageNode[]>([]);
  const [coreScale, setCoreScale] = useState(1);
  const [coreColor, setCoreColor] = useState(isLight ? '#7c6af7' : '#a78bfa');

  // Spawn new nodes periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((prev) => {
        if (prev.length >= 6) return prev; // Limit concurrent nodes
        
        // Random start point in 3D outer radius
        const radius = 4.5;
        const angle = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * 2.5;
        
        // Choose random scenario
        const scenario = scenariosList[Math.floor(Math.random() * scenariosList.length)];
        
        const newNode: MessageNode = {
          id: Math.random().toString(),
          text: scenario.text,
          category: scenario.category as any,
          position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
          target: [0, 0, 0],
          progress: 0,
          speed: 0.18 + Math.random() * 0.15,
          curveOffset: [
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5
          ]
        };

        return [...prev, newNode];
      });
    }, 1400);

    return () => clearInterval(interval);
  }, [scenariosList]);

  const handleReachCore = (id: string) => {
    // Remove the node
    setNodes((prev) => prev.filter((n) => n.id !== id));
    
    // Animate core scaling / pulsing impact
    setCoreScale(1.32);
    setCoreColor(isLight ? '#3b82f6' : '#60a5fa');
    setTimeout(() => {
      setCoreScale(1);
      setCoreColor(isLight ? '#7c6af7' : '#a78bfa');
    }, 200);
  };

  // Mouse Parallax movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (groupRef.current) {
        const x = (e.clientX / window.innerWidth - 0.5) * 0.45;
        const y = (e.clientY / window.innerHeight - 0.5) * 0.45;
        
        // Smoothly lerp towards position
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, x, 0.08);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, y, 0.08);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useFrame((state) => {
    if (coreRef.current) {
      const time = state.clock.getElapsedTime();
      // Spin the core
      coreRef.current.rotation.y = time * 0.25;
      coreRef.current.rotation.x = time * 0.15;
      
      // Pulse scale softly
      const targetScale = coreScale + Math.sin(time * 2) * 0.025;
      coreRef.current.scale.set(targetScale, targetScale, targetScale);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Lights */}
      <ambientLight intensity={isLight ? 0.9 : 0.4} />
      <directionalLight position={[5, 5, 5]} intensity={isLight ? 1.5 : 0.8} />
      <pointLight position={[-5, -5, -5]} intensity={isLight ? 0.6 : 0.3} color="#6366f1" />

      {/* Swirling particle stream background */}
      <SwirlingParticles theme={theme} />

      {/* Central Crystal/Glass core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.5, 64, 64]} />
        <MeshDistortMaterial
          color={coreColor}
          distort={0.42}
          speed={2.2}
          roughness={isLight ? 0.1 : 0.2}
          metalness={isLight ? 0.2 : 0.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transmission={0.88}
          thickness={0.8}
        />
      </mesh>

      {/* Spawns message nodes floating towards core */}
      {nodes.map((node) => (
        <FloatingNode
          key={node.id}
          node={node}
          onReachCore={handleReachCore}
        />
      ))}
    </group>
  );
};

export default function ThreeHeroScene() {
  const { theme } = useTheme();

  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      {/* Background glow shadow matching theme */}
      <div className={`absolute inset-0 m-auto w-64 h-64 rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
        theme === 'light' ? 'bg-[#7c6af7]/15' : 'bg-[#7c6af7]/20'
      }`} />
      
      <Canvas
        camera={{ position: [0, 0, 4.8], fov: 60 }}
        style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
        gl={{ antialias: true }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
