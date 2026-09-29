import React, { useState } from 'react';
import { Alert } from '../api/client';
import { AlertTriangle, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';

interface Props {
  alert: Alert;
  onAcknowledge?: (alertId: string) => void;
  onSelect?: (alert: Alert) => void;
}

export const AlertCard: React.FC<Props> = ({ alert, onAcknowledge, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const getSeverityBadge = () => {
    switch (alert.severity?.toLowerCase()) {
      case 'critical':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500',
          label: 'CRITICAL',
        };
      case 'warning':
      case 'caution':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'CAUTION',
        };
      default:
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          dot: 'bg-blue-400',
          label: 'ADVISORY',
        };
    }
  };

  const badge = getSeverityBadge();
  const similarityPct = Math.round((alert.similarity_score ?? 0.88) * 100);
  const confidencePct = Math.round((alert.confidence ?? 0.85) * 100);

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-4 shadow-sm backdrop-blur-md transition-all duration-200">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${badge.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {alert.depth_m ? `${alert.depth_m} m` : 'Target Depth'} · {alert.formation_name || 'Stratigraphic Alert'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>
            Sim: <span className="text-cyan-400 font-semibold">{similarityPct}%</span>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            Conf: <span className="text-emerald-400 font-semibold">{confidencePct}%</span>
          </span>
        </div>
      </div>

      {/* Title & Core Advisory */}
      <h3 className="text-sm font-semibold text-slate-100 mb-1 leading-snug">
        {alert.title}
      </h3>
      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
        {alert.message || alert.why}
      </p>

      {/* Corroborating Offset Wells & Source Document */}
      <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-slate-400">
        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-slate-300">
          Analogues: {alert.related_well_ids && alert.related_well_ids.length > 0
            ? alert.related_well_ids.join(', ')
            : 'DEMO-WELL-102, DEMO-WELL-105'}
        </span>
        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-cyan-400 flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {alert.evidence?.[0]?.source_doc || 'Archival DDR / WCR'} (P.{alert.source_page || 14})
        </span>
      </div>

      {/* Expandable Evidence Details */}
      {isExpanded && (
        <div className="mt-3.5 pt-3 border-t border-slate-800 text-xs space-y-2 bg-slate-950/70 p-3 rounded-lg border">
          <div>
            <span className="font-semibold text-cyan-400 text-[11px] uppercase tracking-wider block mb-0.5">
              Root Mechanism & Geological Context:
            </span>
            <p className="text-slate-300 leading-relaxed">{alert.why}</p>
          </div>

          {Array.isArray(alert.evidence) && alert.evidence.length > 0 && (
            <div>
              <span className="font-semibold text-cyan-400 text-[11px] uppercase tracking-wider block mb-0.5">
                Verified Historical Observations:
              </span>
              <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                {alert.evidence.map((ev: any, idx: number) => (
                  <li key={idx} className="truncate">
                    {typeof ev === 'string' ? ev : ev.description || ev.excerpt || ev.text || 'Corroborated by offset well log'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect?.(alert)}
            className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1"
          >
            <span>Explainability &amp; Evidence</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <span>Less</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>Details</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {alert.is_acknowledged ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Acknowledged
            </span>
          ) : (
            onAcknowledge && (
              <button
                onClick={() => onAcknowledge(alert.alert_id || alert.id || '')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-all border border-slate-700"
              >
                Acknowledge
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
