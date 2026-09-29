import React, { useState } from 'react';
import { Network, X } from 'lucide-react';
import { Alert } from '../api/client';

interface Node {
  id: string;
  label: string;
  type: 'well' | 'formation' | 'event' | 'mitigation' | 'report';
  color: string;
  x: number;
  y: number;
  detail: string;
  icon: string;
}

interface Link {
  source: string;
  target: string;
  label: string;
}

interface Props {
  alert: Alert;
}

export const ExplainabilityGraph: React.FC<Props> = ({ alert }) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Derive graph entities from alert
  const primaryWell = (alert.which_wells && alert.which_wells[0]) || alert.well_id || 'DEMO-WELL-101';
  const formation = alert.formation_name || 'Barail Coal-Shale (F3)';
  const eventType = (alert.alert_type || 'MUD_LOSS').replace(/_/g, ' ');
  const reportDoc = alert.source_doc || `Daily Drilling Report — ${primaryWell}`;
  const mitigation =
    (alert as any).mitigation ||
    (eventType.includes('LOSS')
      ? 'Increase LCM pill to 35 ppb & reduce pump rate to 450 gpm'
      : eventType.includes('KICK')
      ? 'Weight up mud by +0.3 ppg & perform flow check'
      : eventType.includes('COLLAPSE')
      ? 'Increase mud weight to 10.8 ppg to stabilize shale'
      : 'Enforce wiper trip every 120m & circulate hole clean');

  // Node coordinates structured in an organic graph flow
  // Layout: Well -> Formation -> Event -> Mitigation -> Report
  const nodes: Node[] = [
    {
      id: 'well',
      label: primaryWell,
      type: 'well',
      color: '#38bdf8', // sky-400
      x: 70,
      y: 110,
      detail: `Offset Well Reference (Corroborating cluster member at ${(alert.depth_m || 2750)}m)`,
      icon: 'WELL',
    },
    {
      id: 'formation',
      label: formation,
      type: 'formation',
      color: '#a855f7', // purple-500
      x: 210,
      y: 60,
      detail: `Geological Formation Horizon (Target Interval ±15m)`,
      icon: 'GEO',
    },
    {
      id: 'event',
      label: eventType,
      type: 'event',
      color: '#f43f5e', // rose-500
      x: 350,
      y: 110,
      detail: `Historical Incident Recorded: ${eventType} at ${(alert.depth_m || 2750)}m`,
      icon: 'RISK',
    },
    {
      id: 'mitigation',
      label: 'Recommended SOP',
      type: 'mitigation',
      color: '#10b981', // emerald-500
      x: 480,
      y: 60,
      detail: mitigation,
      icon: 'SOP',
    },
    {
      id: 'report',
      label: `Doc p.${alert.source_page || 3}`,
      type: 'report',
      color: '#eab308', // amber-500
      x: 420,
      y: 170,
      detail: `${reportDoc} (Page ${alert.source_page || 3})`,
      icon: 'DOC',
    },
  ];

  const links: Link[] = [
    { source: 'well', target: 'formation', label: 'penetrates' },
    { source: 'formation', target: 'event', label: 'hosts risk' },
    { source: 'event', target: 'mitigation', label: 'prescribes' },
    { source: 'event', target: 'report', label: 'documented in' },
    { source: 'well', target: 'report', label: 'source archive' },
  ];

  const getNode = (id: string) => nodes.find((n) => n.id === id);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-sans">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-bold uppercase text-[11px] tracking-wider font-sans">
            Explainability Knowledge Graph (Relational View)
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-sans">
          Click any entity node for contextual traversal
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[220px] bg-slate-900/60 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 560 210"
          className="w-full h-full select-none"
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
        >
          {/* Background Grid Accent */}
          <defs>
            <pattern id="graph-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(51, 65, 85, 0.15)" strokeWidth="1" />
            </pattern>
            {/* Arrow marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>
          <rect width="560" height="210" fill="url(#graph-grid)" />

          {/* Links / Edges */}
          {links.map((link, idx) => {
            const s = getNode(link.source);
            const t = getNode(link.target);
            if (!s || !t) return null;

            const isHighlighted =
              selectedNode && (selectedNode.id === s.id || selectedNode.id === t.id);

            return (
              <g key={idx}>
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={isHighlighted ? '#38bdf8' : '#475569'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isHighlighted ? 'none' : '4 2'}
                  markerEnd="url(#arrow)"
                  className="transition-all duration-300"
                />
                {/* Edge Label */}
                <text
                  x={(s.x + t.x) / 2}
                  y={(s.y + t.y) / 2 - 4}
                  fill="#94a3b8"
                  fontSize="8"
                  textAnchor="middle"
                  className="bg-slate-950 px-1 font-mono pointer-events-none"
                >
                  {link.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-transform duration-200 hover:scale-110"
                onClick={() => setSelectedNode(node)}
              >
                {/* Node Outer Ring on Select */}
                {isSelected && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={node.color}
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    className="animate-spin"
                    style={{ animationDuration: '6s' }}
                  />
                )}
                {/* Node Body */}
                <circle
                  r="18"
                  fill="#0f172a"
                  stroke={node.color}
                  strokeWidth={isSelected ? 3 : 2}
                  className="shadow-lg"
                />
                {/* Icon */}
                <text
                  textAnchor="middle"
                  dy="5"
                  fontSize="12"
                  className="pointer-events-none select-none"
                >
                  {node.icon}
                </text>
                {/* Label */}
                <text
                  textAnchor="middle"
                  dy="30"
                  fill="#e2e8f0"
                  fontSize="9"
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {node.label.length > 16 ? `${node.label.slice(0, 14)}…` : node.label}
                </text>
                <text
                  textAnchor="middle"
                  dy="40"
                  fill="#64748b"
                  fontSize="7"
                  className="pointer-events-none uppercase tracking-wider"
                >
                  {node.type}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip / Inspect Details */}
        {selectedNode && (
          <div className="absolute bottom-2 left-3 right-3 bg-slate-950/95 border border-cyan-800/80 rounded-lg p-2.5 shadow-2xl flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedNode.icon}</span>
              <div>
                <span className="text-cyan-400 font-bold uppercase text-[10px] block">
                  {selectedNode.type} :: {selectedNode.label}
                </span>
                <span className="text-slate-200 text-xs font-mono">{selectedNode.detail}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(null);
              }}
              className="text-slate-400 hover:text-slate-200 p-1 rounded bg-slate-800 ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
        <span>Path: Well → Formation → Event → Mitigation → Report</span>
        <span className="text-cyan-400">Zero Graph-DB overhead · Dynamic view over relational entities</span>
      </div>
    </div>
  );
};
