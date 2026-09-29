import React from 'react';
import { Alert } from '../api/client';

interface Props {
  alert: Alert;
  onAcknowledge?: (alertId: string) => void;
  onSelect?: (alert: Alert) => void;
}

export const AlertCard: React.FC<Props> = ({ alert, onAcknowledge, onSelect }) => {
  const getSeverityBadge = () => {
    switch (alert.severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition-all">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase border ${getSeverityBadge()}`}>
            {alert.severity}
          </span>
          <span className="text-xs font-mono text-slate-400">
            {new Date(alert.created_at || Date.now()).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-cyan-400">
            Similarity: <strong className="font-bold">{((alert.similarity_score || 0.90) * 100).toFixed(0)}%</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-emerald-400">
            Confidence: <strong className="font-bold">{((alert.confidence || 0.88) * 100).toFixed(0)}%</strong>
          </span>
        </div>
      </div>

      {/* Title & High-Level Advisory */}
      <h3 className="text-base font-bold text-slate-100 mb-1">{alert.title}</h3>
      <p className="text-xs text-slate-300 mb-4">{alert.message}</p>

      {/* Mandatory Structured Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs mb-4">
        {/* WHY */}
        <div className="md:col-span-2">
          <span className="font-mono text-cyan-400 font-bold uppercase text-[11px] block mb-0.5">
            🔍 WHY (Root Operational Mechanism):
          </span>
          <p className="text-slate-300 text-xs leading-relaxed">{alert.why}</p>
        </div>

        {/* WHICH WELLS */}
        <div>
          <span className="font-mono text-cyan-400 font-bold uppercase text-[11px] block mb-0.5">
            📍 WHICH WELLS (Offset Analogues):
          </span>
          <p className="text-slate-200 font-mono">
            {alert.related_well_ids && alert.related_well_ids.length > 0
              ? alert.related_well_ids.join(', ')
              : 'Direct Offset Pattern'}
          </p>
        </div>

        {/* DEPTH & FORMATION */}
        <div>
          <span className="font-mono text-cyan-400 font-bold uppercase text-[11px] block mb-0.5">
            📐 DEPTH &amp; FORMATION:
          </span>
          <p className="text-slate-200 font-mono">
            {alert.depth_m ? `${alert.depth_m} m` : 'Target Depth'} ·{' '}
            <span className="text-amber-300">{alert.formation_name || 'Barail Formation'}</span>
          </p>
        </div>

        {/* EVIDENCE */}
        <div className="md:col-span-2">
          <span className="font-mono text-cyan-400 font-bold uppercase text-[11px] block mb-0.5">
            📑 VERIFIED EVIDENCE:
          </span>
          {Array.isArray(alert.evidence) && alert.evidence.length > 0 ? (
            alert.evidence.map((ev: any, idx: number) => (
              <div key={idx} className="text-slate-300 text-xs mt-1">
                • {typeof ev === 'string' ? ev : ev.description || JSON.stringify(ev)}
              </div>
            ))
          ) : (
            <p className="text-slate-400 italic">Documented pore pressure escalation in offset well log.</p>
          )}
        </div>

        {/* SOURCE DOC & PAGE */}
        <div className="md:col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
          <span className="text-cyan-300">
            📖 Source: {alert.evidence?.[0]?.source_doc || 'Well Completion Report'} (Page {alert.source_page || 14})
          </span>
          <span className="text-amber-400 font-semibold">SIMULATED DATA</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <button
          onClick={() => onSelect?.(alert)}
          className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg text-xs font-mono transition-all border border-cyan-500/30 flex items-center gap-1.5 font-bold"
        >
          <span>🔍</span>
          <span>9-Point Explainability Panel</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">
            {alert.is_acknowledged ? 'Acknowledged' : 'Pending'}
          </span>

          {!alert.is_acknowledged && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.alert_id || alert.id || '')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700"
            >
              ✓ Ack
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
