'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '../../components/Sidebar';
import { apiFetch } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import { Network, Hash, AlertCircle, Info, Zap } from 'lucide-react';
import AIErrorAlert from '../../components/AIErrorAlert';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

const NODE_COLORS: Record<string, string> = {
  Person: '#7c6af7',
  Topic: '#0ea5e9',
  Task: '#f59e0b',
  Decision: '#10b981',
  Project: '#ec4899',
};

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export default function KnowledgeGraphPage() {
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const { slackUsers } = useAuth();

  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch channels list
  const { data: channels } = useQuery<any[]>({
    queryKey: ['channelsList'],
    queryFn: () => apiFetch('/api/channels'),
  });

  // Fetch knowledge graph for selected channel
  const { data: graphData, isLoading, error, refetch } = useQuery<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    queryKey: ['knowledgeGraph', selectedChannel],
    queryFn: () => apiFetch(`/api/knowledge/graph/${selectedChannel}`),
    enabled: !!selectedChannel,
  });

  // Re-compute layout when graph data changes
  useEffect(() => {
    if (!graphData?.nodes) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rawNodes = graphData.nodes;
    const rawEdges = graphData.edges;

    const centerX = 350;
    const centerY = 280;
    const radius = 200;

    // Calculate node coordinates in a circular arrangement
    const formattedNodes = rawNodes.map((n, idx) => {
      const angle = (idx / rawNodes.length) * 2 * Math.PI;
      const x = rawNodes.length === 1 ? centerX : centerX + radius * Math.cos(angle);
      const y = rawNodes.length === 1 ? centerY : centerY + radius * Math.sin(angle);

      const color = NODE_COLORS[n.type] || '#6b7280';
      const displayName = n.type === 'Person' ? (slackUsers[n.label]?.realName || n.label) : n.label;

      return {
        id: n.id,
        data: { label: displayName, type: n.type },
        position: { x, y },
        style: {
          background: isLightMode ? '#ffffff' : '#111322',
          color: isLightMode ? '#1e293b' : '#f8fafc',
          border: `2px solid ${color}`,
          borderRadius: '12px',
          padding: '10px 14px',
          fontSize: '11px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px',
          textAlign: 'center' as const,
        },
      };
    });

    const formattedEdges = rawEdges.map((e, idx) => {
      const sourceNode = rawNodes.find(n => n.id === e.source);
      const color = sourceNode ? (NODE_COLORS[sourceNode.type] || '#7c6af7') : '#7c6af7';

      return {
        id: `e-${idx}`,
        source: e.source,
        target: e.target,
        label: e.label,
        type: 'smoothstep',
        animated: true,
        labelStyle: {
          fill: isLightMode ? '#64748b' : '#94a3b8',
          fontSize: '8px',
          fontWeight: 'bold'
        },
        labelBgStyle: {
          fill: isLightMode ? '#f8fafc' : '#0a0b12',
          fillOpacity: 0.85
        },
        style: {
          stroke: color,
          strokeWidth: 2,
          opacity: 0.8,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 14,
          height: 14,
        },
      };
    });

    setNodes(formattedNodes);
    setEdges(formattedEdges);
    setSelectedNode(null);
  }, [graphData, isLightMode]);

  const handleNodeClick = (_: any, node: any) => {
    const originalNode = graphData?.nodes.find(n => n.id === node.id);
    if (!originalNode) return;

    // Find related edges
    const related = graphData?.edges.filter(
      e => e.source === node.id || e.target === node.id
    ) || [];

    const nodeLabel = originalNode.type === 'Person' ? (slackUsers[originalNode.label]?.realName || originalNode.label) : originalNode.label;
    setSelectedNode({
      ...originalNode,
      label: nodeLabel,
      connections: related.map(e => {
        const otherId = e.source === node.id ? e.target : e.source;
        const otherNode = graphData?.nodes.find(n => n.id === otherId);
        const otherName = otherNode?.type === 'Person' ? (slackUsers[otherNode.label]?.realName || otherNode.label) : (otherNode?.label || otherId);
        return {
          label: e.label,
          otherName,
          otherType: otherNode?.type || 'Unknown'
        };
      })
    });
  };

  const cardStyle = `rounded-2xl border transition-all ${
    isLightMode ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'
  }`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: isLightMode ? '#f8fafc' : '#06070d' }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col h-full">

          {/* Header */}
          <div className="mb-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)', boxShadow: '0 4px 16px rgba(124,106,247,0.35)' }}>
                <Network className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>AI Knowledge Graph</h1>
                <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Visual mapping of topics, decisions, tasks, and people</p>
              </div>
            </div>
          </div>

          {/* Controls & Legend */}
          <div className={`flex flex-wrap items-center justify-between gap-4 p-4 mb-6 rounded-2xl border shrink-0 ${
            isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.07]'
          }`}>
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <Hash className="w-4 h-4" style={{ color: '#9ca3af' }} />
              <select
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm border outline-none ${
                  isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.05] border-white/[0.1] text-slate-200'
                }`}
              >
                <option value="">Select a channel to map knowledge...</option>
                {channels?.map((c: any) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
              {selectedChannel && (
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c6af7, #6366f1)' }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Map Graph
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span style={{ color: isLightMode ? '#64748b' : '#94a3b8' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main workspace (split screen) */}
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 relative mb-4">
            
            {/* Graph area */}
            <div className={`flex-1 relative min-h-[400px] lg:h-full ${cardStyle} overflow-hidden`}>
              {!selectedChannel ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <Network className="w-12 h-12 mb-4" style={{ color: '#374151' }} />
                  <p className={`text-base font-semibold mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Select a Channel</p>
                  <p className="text-sm" style={{ color: '#6b7280' }}>Map entities and their connections visually using AI</p>
                </div>
              ) : isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                  <div className="w-8 h-8 rounded-full border-4 border-[#7c6af7]/30 border-t-[#7c6af7] animate-spin mb-4" />
                  <p className="text-xs font-semibold animate-pulse" style={{ color: '#7c6af7' }}>Analyzing conversations & mapping entities...</p>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                  <AIErrorAlert
                    error={error as any}
                    onRetry={refetch}
                    className="w-full"
                  />
                </div>
              ) : nodes.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <Info className="w-10 h-10 mb-2" style={{ color: '#6b7280' }} />
                  <p className="text-sm" style={{ color: '#6b7280' }}>No entities identified in this channel history</p>
                </div>
              ) : (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={handleNodeClick}
                  fitView
                  minZoom={0.5}
                  maxZoom={1.5}
                >
                  <Background color={isLightMode ? '#cbd5e1' : '#334155'} gap={16} size={1} />
                  <Controls />
                  <MiniMap
                    nodeStrokeColor={n => NODE_COLORS[n.data?.type] || '#6b7280'}
                    nodeColor={n => NODE_COLORS[n.data?.type] || '#6b7280'}
                    maskColor={isLightMode ? 'rgba(241,245,249,0.7)' : 'rgba(15,23,42,0.7)'}
                    className="border border-white/[0.08] rounded-xl overflow-hidden"
                    style={{ background: isLightMode ? '#f8fafc' : '#111322' }}
                  />
                </ReactFlow>
              )}
            </div>

            {/* Side Details Inspector */}
            <div className={`w-full lg:w-80 shrink-0 ${cardStyle} p-6 flex flex-col h-full lg:overflow-y-auto`}>
              <h2 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                <Info className="w-4 h-4" style={{ color: '#7c6af7' }} />
                <span>Node Inspector</span>
              </h2>

              {selectedNode ? (
                <div className="space-y-5">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5"
                          style={{
                            background: `${NODE_COLORS[selectedNode.type]}15`,
                            color: NODE_COLORS[selectedNode.type]
                          }}>
                      {selectedNode.type}
                    </span>
                    <h3 className={`text-base font-bold leading-tight ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                      {selectedNode.label}
                    </h3>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
                      Relationships
                    </h4>
                    {selectedNode.connections.length === 0 ? (
                      <p className="text-xs italic" style={{ color: '#6b7280' }}>No direct connections found</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedNode.connections.map((conn: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-xl border flex flex-col gap-1 text-xs"
                               style={{
                                 background: isLightMode ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                                 borderColor: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.06)'
                               }}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: '#7c6af7' }}>
                                {conn.label}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      background: `${NODE_COLORS[conn.otherType]}15`,
                                      color: NODE_COLORS[conn.otherType]
                                    }}>
                                {conn.otherType}
                              </span>
                            </div>
                            <span className={`font-bold ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                              {conn.otherName}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <Network className="w-8 h-8 mb-2" style={{ color: '#374151' }} />
                  <p className="text-xs" style={{ color: '#6b7280' }}>Click a node in the graph to inspect details and connections</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
