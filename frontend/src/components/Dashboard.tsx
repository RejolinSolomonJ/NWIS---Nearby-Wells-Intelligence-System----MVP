import React, { useState } from 'react';
import { Well, DashboardKPIs, RiskAssessment, Alert, getRiskBriefPdfUrl } from '../api/client';
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
  onSelectAlert?: (alert: Alert) => void;
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
  onAcknowledgeAlert,
  onSelectAlert,
}) => {
  const [currentDepth, setCurrentDepth] = useState<number>(2740);
  // Phase 15 Feature 3: Confidence Threshold Calibration Slider (0.3 - 0.8)
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.50);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Filter alerts dynamically according to the calibration slider
  const filteredAlerts = alerts.filter((alert) => {
    const score = alert.similarity_score ?? (alert.severity === 'critical' ? 0.88 : 0.65);
    return score >= similarityThreshold;
  });

  const handleExportRiskBrief = () => {
    if (!selectedWell) return;
    const wellId = selectedWell.well_id || (selectedWell as any).id;
    setIsExportingPdf(true);
    const pdfUrl = getRiskBriefPdfUrl(wellId);
    window.open(pdfUrl, '_blank');
    setTimeout(() => setIsExportingPdf(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Master KPI Row (Phase 15 Feature 5) */}
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
            onDownloadReport={() => handleExportRiskBrief()}
          />
        </div>

        <div className="space-y-6">
          {/* Depth Slider */}
          <DepthSlider
            currentDepth={currentDepth}
            maxDepth={selectedWell?.total_depth_m || 3200}
            onDepthChange={setCurrentDepth}
            events={kpis.recent_events}
          />

          {/* Quick Active Well Card & Risk Brief PDF Export (Phase 15 Feature 2) */}
          {selectedWell && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-cyan-400 uppercase font-semibold">
                  Active Well Selection
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {selectedWell.field_name || 'Kharagpur Basin'}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{selectedWell.well_name || selectedWell.name}</h4>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {selectedWell.well_id_code || selectedWell.code || selectedWell.well_id}
              </div>

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

              {/* Action Buttons: Copilot + One-Click PDF Export */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => onOpenCopilot(selectedWell)}
                  className="flex-1 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 rounded-lg text-xs font-mono transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <span>🤖</span>
                  <span>Ask Copilot</span>
                </button>
                <button
                  onClick={handleExportRiskBrief}
                  disabled={isExportingPdf}
                  className="flex-1 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 rounded-lg text-xs font-mono transition-all text-center flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                  title="Generate certified Offset Well Risk Brief PDF via ReportLab"
                >
                  <span>📄</span>
                  <span>{isExportingPdf ? 'Exporting…' : 'Export Brief (PDF)'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Deterministic Risk Radar & Evidence Trail */}
      <RiskRadar well={selectedWell} assessment={assessment} />

      {/* 4. Early Warning Alert Feed with Confidence Threshold Slider (Phase 15 Feature 3) */}
      <div className="space-y-4">
        {/* Confidence Threshold Calibration Slider Banner */}
        <div className="bg-slate-900/90 border border-cyan-900/50 rounded-xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎛️</span>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  Confidence Threshold Calibration Slider
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Transparancy Calibration
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Adjust similarity cutoff (0.30–0.80) to inspect how weights filter offset alerts dynamically in real-time.
              </p>
            </div>

            {/* Slider Control */}
            <div className="flex items-center gap-4 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
              <span className="text-xs font-mono text-slate-400">0.30</span>
              <input
                type="range"
                min="0.30"
                max="0.80"
                step="0.05"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="w-40 sm:w-56 accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <span className="text-xs font-mono text-slate-400">0.80</span>
              <div className="border-l border-slate-800 pl-3">
                <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-1 rounded border border-cyan-800">
                  {(similarityThreshold * 100).toFixed(0)}% Min Sim
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <h3 className="text-base font-bold text-slate-100">
              Live Early Warning Alerts ({filteredAlerts.length})
            </h3>
            <span className="text-xs text-slate-500">
              [Filtered from {alerts.length} total events at ≥{(similarityThreshold * 100).toFixed(0)}% threshold]
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400 hidden sm:block">
            Mandatory: WHY, WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE, SIMILARITY, CONFIDENCE
          </span>
        </div>

        {/* Alert Cards Feed */}
        {filteredAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id || alert.alert_id}
                alert={alert}
                onAcknowledge={onAcknowledgeAlert}
                onSelect={onSelectAlert}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-xl font-mono text-slate-400 text-sm">
            No alerts meet the strict {(similarityThreshold * 100).toFixed(0)}% similarity threshold. Lower the calibration slider above to expand sensitivity.
          </div>
        )}
      </div>
    </div>
  );
};
