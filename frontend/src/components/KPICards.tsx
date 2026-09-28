import React from 'react';
import { DashboardKPIs } from '../api/client';

interface Props {
  kpis: DashboardKPIs;
}

export const KPICards: React.FC<Props> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {/* 1. Total Wells */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Total Wells</span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{kpis.total_wells}</div>
        <div className="mt-1 text-xs text-slate-400">Assam-Arakan Basin</div>
      </div>

      {/* 2. Active Drilling */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Active Rigs</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">{kpis.active_wells}</div>
        <div className="mt-1 text-xs text-slate-400">Currently On-Bottom</div>
      </div>

      {/* 3. Drilling Events */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-amber-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Events Logged</span>
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-amber-300">{kpis.total_events}</div>
        <div className="mt-1 text-xs text-slate-400">Institutional Memory</div>
      </div>

      {/* 4. Critical Alerts */}
      <div className="bg-slate-900/80 border border-rose-900/40 rounded-xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-rose-500/60 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono text-rose-300 tracking-wider">Critical Alerts</span>
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-bounce"></span>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-rose-400">{kpis.critical_alerts}</div>
        <div className="mt-1 text-xs text-rose-300/80">Immediate Action Req</div>
      </div>

      {/* 5. Avg Risk Score */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-blue-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Mean Risk Index</span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">DET</span>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-blue-300">{(kpis.avg_risk_score * 100).toFixed(0)}%</div>
        <div className="mt-1 text-xs text-slate-400">Deterministic Score</div>
      </div>

      {/* 6. Wells at Risk */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-purple-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Wells at Risk</span>
          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-purple-300">{kpis.wells_at_risk}</div>
        <div className="mt-1 text-xs text-slate-400">Score &gt; 50% Threshold</div>
      </div>
    </div>
  );
};
