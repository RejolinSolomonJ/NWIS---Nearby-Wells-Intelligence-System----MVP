import React, { useState } from 'react';
import { Well, DashboardKPIs, RiskAssessment, Alert } from '../api/client';
import { KPICards } from './KPICards';
import { Map } from './Map';
import { RiskRadar } from './RiskRadar';
import { DepthSlider } from './DepthSlider';
import { AlertCard } from './AlertCard';

interface Props {
  kpis: DashboardKPIs;
  wells: Well[];
  selectedWell: Well | null;
  assessment: RiskAssessment | null;
  alerts: Alert[];
  onSelectWell: (well: Well) => void;
  onOpenCopilot: (well: Well) => void;
  onOpenCompare: (well: Well) => void;
  onDownloadReport: (well: Well) => void;
  onAcknowledgeAlert: (alertId: string) => void;
}

export const Dashboard: React.FC<Props> = ({
  kpis,
  wells,
  selectedWell,
  assessment,
  alerts,
  onSelectWell,
  onOpenCopilot,
  onOpenCompare,
  onDownloadReport,
  onAcknowledgeAlert,
}) => {
  const [currentDepth, setCurrentDepth] = useState<number>(2950);

  return (
    <div className="space-y-6">
      {/* 1. Master KPI Row */}
      <KPICards kpis={kpis} />

      {/* 2. Primary Workspace: Interactive Map & Depth Slider */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Map
            wells={wells}
            selectedWell={selectedWell}
            onSelectWell={onSelectWell}
            onOpenCopilot={onOpenCopilot}
            onOpenCompare={onOpenCompare}
            onDownloadReport={onDownloadReport}
          />
        </div>

        <div className="space-y-6">
          {/* Depth Slider */}
          <DepthSlider
            currentDepth={currentDepth}
            maxDepth={selectedWell?.total_depth_m || 4200}
            onDepthChange={setCurrentDepth}
            events={kpis.recent_events}
          />

          {/* Quick Active Well Card */}
          {selectedWell && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-cyan-400 uppercase font-semibold">
                  Active Well Selection
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {selectedWell.field_name}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{selectedWell.well_name}</h4>
              <div className="text-xs font-mono text-slate-400 mt-0.5">{selectedWell.well_id_code}</div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">Total Depth:</span>{' '}
                  <span className="font-mono text-slate-200 font-bold">{selectedWell.total_depth_m}m</span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>{' '}
                  <span className="font-mono text-emerald-400 uppercase font-bold">{selectedWell.status}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => onOpenCopilot(selectedWell)}
                  className="flex-1 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 rounded-lg text-xs font-mono transition-all text-center"
                >
                  🤖 Ask Copilot
                </button>
                <button
                  onClick={() => onDownloadReport(selectedWell)}
                  className="flex-1 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 rounded-lg text-xs font-mono transition-all text-center"
                >
                  📄 Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Deterministic Risk Radar & Evidence Trail */}
      <RiskRadar well={selectedWell} assessment={assessment} />

      {/* 4. Early Warning Alert Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <h3 className="text-base font-bold font-mono text-slate-100">
              Live Early Warning Alerts ({alerts.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Mandatory: WHY, WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE, SIMILARITY, CONFIDENCE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={onAcknowledgeAlert}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
