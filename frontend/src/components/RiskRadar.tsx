import React from 'react';
import { FileText, BookOpen } from 'lucide-react';
import { RiskAssessment, Well } from '../api/client';

interface Props {
  well: Well | null;
  assessment: RiskAssessment | null;
  onSelectOffsetWell?: (wellId: string) => void;
}

export const RiskRadar: React.FC<Props> = ({ well, assessment, onSelectOffsetWell }) => {
  if (!assessment) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        Select a well to view deterministic risk breakdown and evidence trail.
      </div>
    );
  }

  const getScoreColor = (val: number) => {
    if (val < 0.4) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (val < 0.7) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
  };

  const getProgressColor = (val: number) => {
    if (val < 0.4) return 'bg-emerald-500';
    if (val < 0.7) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <h3 className="text-lg font-bold text-slate-100 font-mono">
              Deterministic Risk Radar &amp; Evidence Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Zero LLM scoring · Computed via post-drill &amp; while-drilling empirical algorithms |{' '}
            <span className="text-amber-400 font-mono font-semibold">SIMULATED DATA</span>
          </p>
        </div>

        {/* Big Overall Score & Confidence */}
        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Overall Risk Index</div>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {(assessment.overall_risk_score * 100).toFixed(0)}%
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Algorithm Confidence</div>
            <div className="text-2xl font-bold font-mono text-cyan-300">
              {typeof assessment.confidence === 'number'
                ? `${(assessment.confidence * 100).toFixed(0)}%`
                : String(assessment.confidence || 'High')}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Deterministic Component Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        {/* 1. Pressure Risk */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold">Pore Pressure Margin</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreColor(assessment.pressure_risk)}`}>
              {(assessment.pressure_risk * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(assessment.pressure_risk)} transition-all duration-500`}
              style={{ width: `${assessment.pressure_risk * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Kick &amp; Loss Vulnerability</div>
        </div>

        {/* 2. Geological Risk */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold">Geological Hazards</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreColor(assessment.geological_risk)}`}>
              {(assessment.geological_risk * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(assessment.geological_risk)} transition-all duration-500`}
              style={{ width: `${assessment.geological_risk * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Reactive Shales &amp; Sloughing</div>
        </div>

        {/* 3. Mechanical Risk */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold">Mechanical / Sticking</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreColor(assessment.mechanical_risk)}`}>
              {(assessment.mechanical_risk * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(assessment.mechanical_risk)} transition-all duration-500`}
              style={{ width: `${assessment.mechanical_risk * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Differential Pressure &amp; Drag</div>
        </div>

        {/* 4. Historical Offset Risk */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold">Historical Offset Incidents</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreColor(assessment.historical_risk)}`}>
              {(assessment.historical_risk * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(assessment.historical_risk)} transition-all duration-500`}
              style={{ width: `${assessment.historical_risk * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Assam Institutional Memory</div>
        </div>
      </div>

      {/* Deterministic Evidence Trail & Source Documents */}
      <div className="mt-6 font-sans">
        <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>Verifiable Evidence Trail &amp; Document Citations</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-sans uppercase bg-slate-950/80 text-[10px] font-semibold tracking-wider">
                <th className="py-2.5 px-3">Risk Factor</th>
                <th className="py-2.5 px-3">Severity Score</th>
                <th className="py-2.5 px-3">Verified Operational Evidence</th>
                <th className="py-2.5 px-3">Source Citation (Doc &amp; Page)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {assessment.risk_factors.map((factor: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{factor.factor}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded font-sans font-bold tabular-nums ${getScoreColor(factor.score)}`}>
                      {(factor.score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 max-w-md">{factor.evidence}</td>
                  <td className="py-2.5 px-3 text-cyan-300 font-sans text-[11px]">
                    <span className="bg-slate-950 px-2 py-1 rounded border border-cyan-900/60 inline-flex items-center gap-1.5 font-medium">
                      <BookOpen className="w-3 h-3 text-cyan-400" />
                      <span>{factor.source}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Offset Analogue Wells Banner */}
      {assessment.similar_well_ids && assessment.similar_well_ids.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-cyan-300">Offset Analogues Contributing to Model:</span>{' '}
            {assessment.similar_well_ids.join(', ')}
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-400">
            PostGIS Geodesic Corridor: 15 km
          </span>
        </div>
      )}
    </div>
  );
};
