/**
 * DepthCorrelationView.tsx — NWIS-X Phase 10
 * Core Demo Engine: depth slider with auto-play, live risk state machine banner,
 * multi-well Recharts depth-aligned timeline, escalation toasts, evidence table.
 *
 * ⚠️ SIMULATED DEPTH POSITION — NOT LIVE OIL TELEMETRY
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Scatter,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Area,
  Legend,
} from 'recharts';

import {
  Well,
  CurrentRiskResponse,
  RiskEvidenceItem,
  getCurrentRisk,
} from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  well: Well | null;
  wells: Well[];
  initialDepth?: number;
  onDepthChange?: (depth: number) => void;
  onRiskChange?: (risk: CurrentRiskResponse) => void;
  onOpenEvidence?: (docTitle: string, page: number, excerpt: string, wellName: string) => void;
  onSelectAlert?: (alert: any) => void;
}

type RiskLevel = 'NORMAL' | 'WATCH' | 'CAUTION' | 'HIGH_EVIDENCE_RISK';

interface Toast {
  id: number;
  from: RiskLevel;
  to: RiskLevel;
  depth: number;
  ts: number;
}

// ─── Stratigraphic reference (Assam-Arakan) ───────────────────────────────────
const FORMATIONS = [
  { name: 'Alluvium / Dihing',  top: 0,    bottom: 450,  color: '#78350f' },
  { name: 'Girujan Clay',       top: 450,  bottom: 1100, color: '#14532d' },
  { name: 'Tipam Sandstone',    top: 1100, bottom: 2200, color: '#713f12' },
  { name: 'Bokabil Formation',  top: 2200, bottom: 2750, color: '#7c2d12' },
  { name: 'Barail Coal-Shale',  top: 2750, bottom: 3450, color: '#881337' },
  { name: 'Kopili Formation',   top: 3450, bottom: 3950, color: '#4a1d96' },
  { name: 'Sylhet Limestone',   top: 3950, bottom: 4500, color: '#1e3a5f' },
];

function getFormationAt(depth: number) {
  return FORMATIONS.find((f) => depth >= f.top && depth <= f.bottom) ?? FORMATIONS[FORMATIONS.length - 1];
}

// ─── Risk level styling ────────────────────────────────────────────────────────
const RISK_STYLES: Record<RiskLevel, { bg: string; border: string; text: string; label: string; icon: string }> = {
  NORMAL:             { bg: 'bg-emerald-950/60',  border: 'border-emerald-500/40', text: 'text-emerald-400', label: '● NORMAL',             icon: '✅' },
  WATCH:              { bg: 'bg-yellow-950/60',   border: 'border-yellow-500/40',  text: 'text-yellow-400',  label: '◉ WATCH',              icon: '👁️' },
  CAUTION:            { bg: 'bg-amber-950/60',    border: 'border-amber-500/40',   text: 'text-amber-400',   label: '⚠ CAUTION',            icon: '⚠️' },
  HIGH_EVIDENCE_RISK: { bg: 'bg-rose-950/60',     border: 'border-rose-500/40',    text: 'text-rose-400',    label: '🔴 HIGH_EVIDENCE_RISK', icon: '🚨' },
};

const ESCALATION_ORDER: RiskLevel[] = ['NORMAL', 'WATCH', 'CAUTION', 'HIGH_EVIDENCE_RISK'];

function normalizeLevel(s?: string): RiskLevel {
  const map: Record<string, RiskLevel> = {
    NORMAL: 'NORMAL', WATCH: 'WATCH', CAUTION: 'CAUTION', HIGH_EVIDENCE_RISK: 'HIGH_EVIDENCE_RISK',
  };
  return map[s ?? ''] ?? 'NORMAL';
}

function isEscalation(from: RiskLevel, to: RiskLevel): boolean {
  return ESCALATION_ORDER.indexOf(to) > ESCALATION_ORDER.indexOf(from);
}

// ─── Chart helpers ─────────────────────────────────────────────────────────────
function buildEventDots(evidence: RiskEvidenceItem[]): { depth: number; name: string; sim: number; event: string; dot_y: number }[] {
  // Each evidence item -> a dot on the chart at its depth
  return evidence.map((ev) => ({
    depth: ev.depth,
    name: ev.well,
    sim: Math.round(ev.similarity * 100),
    event: ev.event,
    dot_y: 70, // fixed y in the chart just for dot placement
  }));
}

// We'll display a depth range window around current depth
const WINDOW_M = 150; // ±150m from current depth

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0' }}>
      <div style={{ fontWeight: 700, color: '#f43f5e', marginBottom: 3 }}>
        ⚠ {d.event?.replace(/_/g, ' ').toUpperCase()}
      </div>
      <div>Well: <span style={{ color: '#38bdf8' }}>{d.name}</span></div>
      <div>Depth: <span style={{ color: '#fbbf24' }}>{d.depth}m</span></div>
      <div>Similarity: <span style={{ color: '#6ee7b7' }}>{d.sim}%</span></div>
    </div>
  );
};

// ─── Toast notification ────────────────────────────────────────────────────────
const EscalationToast: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const toStyle = RISK_STYLES[toast.to] ?? RISK_STYLES.CAUTION;

  return (
    <div
      className={`fixed top-6 right-6 z-[9999] flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-xl max-w-sm animate-slideIn ${toStyle.bg} ${toStyle.border}`}
      style={{ animation: 'slideInRight 0.35s ease-out' }}
    >
      <span className="text-2xl shrink-0 mt-0.5">{toStyle.icon}</span>
      <div>
        <div className={`font-bold font-mono text-sm ${toStyle.text}`}>
          ESCALATION: {toast.from} → {toast.to}
        </div>
        <div className="text-xs text-slate-300 mt-1 font-mono">
          @ {toast.depth}m — State machine triggered
        </div>
        <div className="text-[10px] text-amber-400 mt-1 font-mono">
          ⚠️ SIMULATED DEPTH POSITION — NOT LIVE TELEMETRY
        </div>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="ml-2 text-slate-400 hover:text-slate-200 text-lg leading-none">×</button>
    </div>
  );
};

// ─── DepthCorrelationView ─────────────────────────────────────────────────────
export const DepthCorrelationView: React.FC<Props> = ({
  well,
  wells,
  initialDepth = 2600,
  onDepthChange,
  onRiskChange,
  onOpenEvidence,
  onSelectAlert,
}) => {
  const minDepth = Math.max(0, (well?.total_depth_m ?? 4000) * 0.6 - 300);
  const maxDepth = well?.total_depth_m ?? 4000;
  const sweepMin = Math.max(minDepth, 2500);
  const sweepMax = Math.min(maxDepth, 2900);

  const [depth, setDepth] = useState(initialDepth);
  const [risk, setRisk] = useState<CurrentRiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(800); // ms per step
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<{ depth: number; level: RiskLevel; score: number }[]>([]);

  const prevLevelRef = useRef<RiskLevel>('NORMAL');
  const autoPlayRef = useRef(false);
  const toastIdRef = useRef(0);

  // Sync autoPlay state to ref for interval closure
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  // Fetch risk on depth change
  useEffect(() => {
    if (!well) return;
    const wid = well.well_id || (well as any).id;
    setLoading(true);
    getCurrentRisk(wid, depth)
      .then((r) => {
        const newLevel = normalizeLevel(r.risk_level);
        const prevLevel = prevLevelRef.current;

        // Toast on escalation
        if (isEscalation(prevLevel, newLevel)) {
          const id = ++toastIdRef.current;
          setToasts((t) => [...t, { id, from: prevLevel, to: newLevel, depth, ts: Date.now() }]);
        }
        prevLevelRef.current = newLevel;

        setRisk(r);
        onRiskChange?.(r);
        setHistory((prev) => {
          const next = [...prev, { depth, level: newLevel, score: r.risk_score }];
          return next.slice(-60); // keep last 60 data points
        });
      })
      .finally(() => setLoading(false));
  }, [depth, well?.well_id]);

  // Propagate depth up
  useEffect(() => { onDepthChange?.(depth); }, [depth]);

  // Auto-play interval
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setDepth((prev) => {
        const next = prev + 5;
        if (next > sweepMax) {
          setAutoPlay(false);
          return sweepMin;
        }
        return next;
      });
    }, playSpeed);
    return () => clearInterval(interval);
  }, [autoPlay, playSpeed, sweepMin, sweepMax]);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const formation = getFormationAt(depth);
  const level = normalizeLevel(risk?.risk_level);
  const rStyle = RISK_STYLES[level];

  // Chart: build background risk area from history
  const historyChartData = history.map((h) => ({
    depth: h.depth,
    score: h.score,
    level: h.level,
  }));

  // Evidence dots for the scatter
  const evidenceDots = buildEventDots(risk?.evidence ?? []);

  // Depth window for x-axis
  const xMin = depth - WINDOW_M;
  const xMax = depth + WINDOW_M;

  // Formation band reference lines for the window
  const formationBandsInWindow = FORMATIONS.filter(
    (f) => f.bottom >= xMin && f.top <= xMax
  );

  const riskLevelColor = (l: RiskLevel) =>
    l === 'HIGH_EVIDENCE_RISK' ? '#f43f5e' : l === 'CAUTION' ? '#f59e0b' : l === 'WATCH' ? '#fde047' : '#10b981';

  return (
    <>
      {/* Escalation Toasts */}
      {toasts.map((t) => (
        <EscalationToast key={t.id} toast={t} onDismiss={dismissToast} />
      ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,0); }
          50%      { box-shadow: 0 0 20px 6px rgba(244,63,94,0.4); }
        }
        .risk-glow-high { animation: pulseGlow 1.8s ease-in-out infinite; }
        input[type=range].depth-track { accent-color: #06b6d4; height: 6px; }
        input[type=range].depth-track::-webkit-slider-thumb { width: 20px; height: 20px; }
      `}</style>

      <div className="space-y-5">

        {/* ── Simulated Data Banner (always visible) ─────────────────── */}
        <div className="flex items-center justify-center gap-2 py-1.5 px-4 bg-amber-950/40 border border-amber-700/40 rounded-lg text-amber-300 text-[11px] font-mono font-semibold tracking-wider">
          <span>⚠️</span>
          <span>SIMULATED DEPTH POSITION — NOT LIVE OIL TELEMETRY | SIH26121 DEMO ONLY</span>
        </div>

        {/* ── State Machine Status Banner ─────────────────────────────── */}
        <div className={`rounded-2xl border p-5 transition-all duration-500 ${rStyle.bg} ${rStyle.border} ${level === 'HIGH_EVIDENCE_RISK' ? 'risk-glow-high' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Big status display */}
            <div className="flex items-center gap-4">
              <div className="text-4xl">{rStyle.icon}</div>
              <div>
                <div className={`text-xl font-black font-mono tracking-widest uppercase ${rStyle.text}`}>
                  {rStyle.label}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Deterministic state machine — Phase 6 engine
                </div>
              </div>
            </div>

            {/* Score + Confidence */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Risk Score</div>
                <div className={`text-2xl font-black font-mono ${rStyle.text}`}>
                  {risk?.risk_score?.toFixed(1) ?? '--'}
                </div>
                <div className="text-[10px] font-mono text-slate-400">/100</div>
              </div>
              <div className="h-10 w-px bg-slate-700" />
              <div className="text-center">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Confidence</div>
                <div className="text-2xl font-black font-mono text-cyan-300">
                  {risk?.confidence ?? '--'}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-700" />
              <div className="text-center">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Corroborating</div>
                <div className="text-2xl font-black font-mono text-rose-300">
                  {risk?.corroborating_wells_count ?? 0}
                </div>
                <div className="text-[10px] font-mono text-slate-400">wells</div>
              </div>
            </div>
          </div>

          {/* WHY text */}
          {risk?.why_text && (
            <div className="mt-4 pt-4 border-t border-slate-700/60 text-xs font-mono text-slate-300 leading-relaxed">
              <span className="text-cyan-400 font-bold">WHY: </span>{risk.why_text}
            </div>
          )}
        </div>

        {/* ── Depth Slider + Controls ─────────────────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
                <span className="text-cyan-400">📏</span>
                Depth-Aware Drilling Simulation Slider
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Drag or auto-play to simulate bit advancing through risk zone · Step = 5m
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Speed selector */}
              <select
                value={playSpeed}
                onChange={(e) => setPlaySpeed(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 font-mono"
              >
                <option value={400}>Fast (400ms)</option>
                <option value={800}>Normal (800ms)</option>
                <option value={1500}>Slow (1500ms)</option>
              </select>

              {/* Auto-play / pause */}
              <button
                onClick={() => setAutoPlay((v) => !v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 ${
                  autoPlay
                    ? 'bg-rose-500/25 border border-rose-500/50 text-rose-300 hover:bg-rose-500/40'
                    : 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30'
                }`}
              >
                {autoPlay ? '⏸ Pause' : '▶ Auto-Play'}
              </button>

              {/* Reset to start of demo zone */}
              <button
                onClick={() => { setDepth(sweepMin); setAutoPlay(false); setHistory([]); prevLevelRef.current = 'NORMAL'; }}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 transition-all"
              >
                ↺ Reset
              </button>
            </div>
          </div>

          {/* Depth readout */}
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 font-mono">
              <span className="text-slate-500 text-xs">BIT DEPTH </span>
              <span className="text-cyan-400 font-black text-lg">{depth.toFixed(0)} m</span>
            </div>
            <div
              className="px-3 py-2 rounded-lg border text-xs font-mono font-semibold"
              style={{ background: formation.color + '33', borderColor: formation.color + '66', color: '#e2e8f0' }}
            >
              {formation.name} · {formation.top}–{formation.bottom}m
            </div>
            {loading && (
              <span className="text-[11px] font-mono text-slate-500 animate-pulse">Querying risk engine…</span>
            )}
          </div>

          {/* Main slider */}
          <div className="relative">
            <input
              type="range"
              min={sweepMin}
              max={sweepMax}
              step={5}
              value={depth}
              onChange={(e) => { setAutoPlay(false); setDepth(Number(e.target.value)); }}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer depth-track"
              style={{ accentColor: riskLevelColor(level) }}
            />
            {/* Min/max labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-0.5">
              <span>{sweepMin}m</span>
              <span className="text-amber-400 font-bold">F3 Risk Band: 2745–2770m</span>
              <span>{sweepMax}m</span>
            </div>

            {/* Formation stripe indicators */}
            <div className="flex gap-1 mt-2">
              {FORMATIONS.filter(f => f.bottom >= sweepMin && f.top <= sweepMax).map((f, i) => {
                const totalRange = sweepMax - sweepMin;
                const start = Math.max(f.top, sweepMin);
                const end = Math.min(f.bottom, sweepMax);
                const widthPct = ((end - start) / totalRange) * 100;
                return (
                  <div
                    key={i}
                    title={f.name}
                    style={{ width: `${widthPct}%`, background: f.color, opacity: 0.6, borderRadius: 3, height: 6 }}
                  />
                );
              })}
            </div>
          </div>

          {/* Progress through sweep */}
          <div className="mt-3 flex items-center gap-3 text-[10px] font-mono text-slate-500">
            <div className="flex-1 bg-slate-800 h-1 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${((depth - sweepMin) / (sweepMax - sweepMin)) * 100}%`,
                  background: riskLevelColor(level),
                }}
              />
            </div>
            <span>{(((depth - sweepMin) / (sweepMax - sweepMin)) * 100).toFixed(0)}% of demo sweep</span>
          </div>
        </div>

        {/* ── Multi-well Depth Timeline Chart ─────────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
              <span className="text-rose-400">📈</span>
              Depth-Aligned Offset Well Event Timeline
              <span className="text-[10px] font-mono text-slate-500 font-normal">±{WINDOW_M}m window</span>
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 bg-cyan-400 inline-block rounded" /> Active bit
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-rose-500 rounded-full inline-block opacity-80" /> Offset event
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 bg-amber-500 inline-block rounded border-dashed" /> F3 risk band
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis
                type="number"
                dataKey="depth"
                domain={[xMin, xMax]}
                tickCount={7}
                tickFormatter={(v) => `${v}m`}
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#64748b' }}
                label={{ value: 'Depth (m)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
              />

              <YAxis
                type="number"
                dataKey="dot_y"
                domain={[0, 100]}
                hide
              />

              {/* Formation band shading */}
              {formationBandsInWindow.map((f, i) => (
                <ReferenceLine
                  key={`fbnd-${i}`}
                  x={Math.max(f.top, xMin)}
                  stroke={f.color}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  label={{ value: f.name.split(' ')[0], position: 'top', fontSize: 8, fill: '#94a3b8', fontFamily: 'monospace' }}
                />
              ))}

              {/* F3 risk band highlight zone */}
              <ReferenceLine x={2745} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3"
                label={{ value: 'F3 band', position: 'top', fontSize: 9, fill: '#fbbf24', fontFamily: 'monospace' }} />
              <ReferenceLine x={2770} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" />

              {/* Current depth marker */}
              <ReferenceLine
                x={depth}
                stroke="#06b6d4"
                strokeWidth={2.5}
                label={{
                  value: `▼ ${depth}m`,
                  position: 'top',
                  fontSize: 10,
                  fill: '#06b6d4',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />

              {/* Evidence event dots */}
              <Scatter
                data={evidenceDots}
                fill="#f43f5e"
                opacity={0.9}
                r={8}
                name="Offset Incidents"
              />

              <RTooltip content={<ChartTooltip />} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend underneath */}
          <div className="mt-2 pt-3 border-t border-slate-800 flex flex-wrap gap-4 text-[10px] font-mono text-slate-400">
            <span>Offset incidents from: {wells.map(w => w.code || w.name).join(', ')}</span>
            <span className="text-amber-400">· F3 band 2745–2770m is where injected cluster events occur</span>
          </div>
        </div>

        {/* ── Risk History Sparkline ───────────────────────────────────── */}
        {history.length > 2 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold font-mono text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <span>📊</span> Risk Score History (current sweep)
            </h3>
            <ResponsiveContainer width="100%" height={80}>
              <ComposedChart data={historyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />
                <XAxis dataKey="depth" tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#475569' }} tickFormatter={(v) => `${v}m`} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#475569' }} />
                <Area dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} dot={false} />
                {/* Escalation threshold lines */}
                <ReferenceLine y={30} stroke="#fde047" strokeDasharray="3 3" strokeWidth={1} />
                <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
                <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-[9px] font-mono text-slate-500 mt-1">
              <span className="text-yellow-400">– 30 WATCH</span>
              <span className="text-amber-400">– 60 CAUTION</span>
              <span className="text-rose-400">– 80 HIGH_EVIDENCE</span>
            </div>
          </div>
        )}

        {/* ── Evidence Table ───────────────────────────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
              <span className="text-cyan-400">📑</span>
              Corroborating Offset Evidence
              <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                {risk?.evidence?.length ?? 0} match{(risk?.evidence?.length ?? 0) !== 1 ? 'es' : ''} in zone
              </span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              Lookahead: {risk?.lookahead_m ?? 50}m
            </span>
          </div>

          {(!risk?.evidence || risk.evidence.length === 0) ? (
            <div className="px-5 py-6 text-center text-xs font-mono text-slate-500">
              <div className="text-2xl mb-2">✅</div>
              No corroborating offset events within lookahead zone. State: {level}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-500 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-4">Well</th>
                    <th className="py-2.5 px-3">Dist (km)</th>
                    <th className="py-2.5 px-3">Incident Type</th>
                    <th className="py-2.5 px-3">Depth (m)</th>
                    <th className="py-2.5 px-3">Formation</th>
                    <th className="py-2.5 px-3">Similarity</th>
                    <th className="py-2.5 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {risk.evidence.map((ev, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors font-mono">
                      <td className="py-2.5 px-4">
                        <span className="text-cyan-400 font-bold">{ev.well}</span>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">{ev.distance?.toFixed(2)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                          {ev.event?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">{ev.depth}m</td>
                      <td className="py-2.5 px-3 text-slate-300 text-[11px] max-w-[160px] truncate">{ev.formation}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(ev.similarity ?? 0) * 100}%`, background: '#06b6d4' }}
                            />
                          </div>
                          <span className="text-cyan-400 font-bold">{Math.round((ev.similarity ?? 0) * 100)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                        {ev.source_doc ? (
                          <button
                            onClick={() =>
                              onOpenEvidence?.(
                                ev.source_doc || '',
                                ev.page || 1,
                                ev.snippet || `Incident recorded in ${ev.well} at ${ev.depth}m`,
                                ev.well
                              )
                            }
                            className="bg-slate-950 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-200 px-2.5 py-1 rounded border border-slate-700 hover:border-cyan-500/50 transition-colors flex items-center gap-1.5"
                            title="Click to open page in Evidence Viewer"
                          >
                            <span>📖</span>
                            <span>{ev.source_doc?.slice(0, 16)}… p.{ev.page}</span>
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── State Machine Transition Diagram ────────────────────────── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-3">State Machine Path</div>
          <div className="flex items-center gap-2 flex-wrap">
            {ESCALATION_ORDER.map((lv, i) => {
              const s = RISK_STYLES[lv];
              const isCurrent = lv === level;
              const isPast = ESCALATION_ORDER.indexOf(lv) < ESCALATION_ORDER.indexOf(level);
              return (
                <React.Fragment key={lv}>
                  <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    isCurrent ? `${s.bg} ${s.border} ${s.text} scale-110 shadow-lg` :
                    isPast ? 'bg-slate-800/60 border-slate-700 text-slate-500' :
                    'bg-slate-950/60 border-slate-800 text-slate-600'
                  }`}>
                    {s.icon} {lv}
                  </div>
                  {i < ESCALATION_ORDER.length - 1 && (
                    <span className={`text-sm font-bold ${isPast || isCurrent ? 'text-slate-300' : 'text-slate-700'}`}>➔</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-600">
            PROTOTYPE ASSUMPTION — thresholds require SME calibration before production use
          </div>
        </div>

      </div>
    </>
  );
};

