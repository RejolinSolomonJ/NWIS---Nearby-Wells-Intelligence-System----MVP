/**
 * LookaheadRadar.tsx — Novel Innovation for SIH / Oil India Limited (eRTMAC-NWIS)
 * 4D Ahead-of-the-Bit Virtual Lookahead Radar & Automated Mitigation SOP Playbook.
 * Intersects live eRTMAC drilling telemetry with historical offset well institutional memory.
 */
import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Compass,
  Cpu,
  Download,
  Flame,
  Gauge,
  Layers,
  Play,
  RotateCcw,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { Well } from '../api/client';

interface Props {
  selectedWell: Well | null;
  currentDepth: number;
  onDepthChange: (depth: number) => void;
  onOpenCopilot?: (well: Well) => void;
}

type ScenarioType = 'nominal' | 'influx_warning' | 'loss_warning';

export const LookaheadRadar: React.FC<Props> = ({
  selectedWell,
  currentDepth,
  onDepthChange,
  onOpenCopilot,
}) => {
  const [scenario, setScenario] = useState<ScenarioType>('influx_warning');
  const [isSimulating, setIsSimulating] = useState(true);

  // Live telemetry state
  const [telemetry, setTelemetry] = useState({
    rop: 14.5,
    wob: 11.2,
    rpm: 105,
    torque: 17.8,
    spp: 2840,
    flowIn: 1850,
    flowOut: 1855,
    gasUnits: 42,
    mudWeightIn: 1.28,
    mudWeightOut: 1.29,
  });

  // Oscillate telemetry values smoothly to simulate live eRTMAC feed
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const jitter = (Math.random() - 0.5) * 0.4;
        if (scenario === 'influx_warning') {
          return {
            ...prev,
            rop: Number(Math.max(10, Math.min(22, prev.rop + (Math.random() - 0.4) * 0.8)).toFixed(1)),
            torque: Number(Math.max(16, Math.min(25, prev.torque + jitter * 1.5)).toFixed(1)),
            gasUnits: Math.round(Math.max(35, Math.min(180, prev.gasUnits + Math.random() * 3.5))),
            flowOut: Number(Math.max(1850, Math.min(1920, prev.flowOut + Math.random() * 2)).toFixed(1)),
            spp: Math.round(Math.max(2750, Math.min(2900, prev.spp + (Math.random() - 0.5) * 15))),
          };
        } else if (scenario === 'loss_warning') {
          return {
            ...prev,
            rop: Number(Math.max(8, Math.min(16, prev.rop + jitter)).toFixed(1)),
            flowOut: Number(Math.max(1500, Math.min(1850, prev.flowOut - Math.random() * 4)).toFixed(1)),
            spp: Math.round(Math.max(2600, Math.min(2850, prev.spp - Math.random() * 8))),
            torque: Number(Math.max(14, Math.min(20, prev.torque + jitter)).toFixed(1)),
            gasUnits: Math.round(Math.max(20, Math.min(50, prev.gasUnits + jitter))),
          };
        }
        return {
          ...prev,
          rop: Number(Math.max(12, Math.min(16, 14.5 + jitter)).toFixed(1)),
          wob: Number(Math.max(10, Math.min(13, 11.5 + jitter * 0.5)).toFixed(1)),
          rpm: Math.round(Math.max(100, Math.min(115, 108 + jitter * 2))),
          torque: Number(Math.max(16, Math.min(19, 17.5 + jitter)).toFixed(1)),
          spp: Math.round(Math.max(2800, Math.min(2880, 2840 + jitter * 20))),
          flowIn: 1850,
          flowOut: Number((1852 + jitter * 4).toFixed(1)),
          gasUnits: Math.round(Math.max(30, Math.min(48, 38 + jitter * 5))),
        };
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isSimulating, scenario]);

  const bitDepth = currentDepth;
  const horizonDepth = bitDepth + 150;

  // Ahead-of-the-bit critical markers (projected next 150m)
  const lookaheadHazards = [
    {
      distance_m: 38,
      depth_m: bitDepth + 38,
      type: 'Gas Kick / Pore Pressure Spike',
      severity: 'critical',
      formation: 'Barail Coal-Shale (F3 Zone)',
      historicalSource: 'WCR-Nahorkatiya DEMO-103 (2,778m)',
      offsetEvidence: '1.62 SG gas influx detected with 18 bbl pit gain.',
      sopAction: 'Pre-weight mud to 1.34 SG before penetrating 2,770m.',
    },
    {
      distance_m: 74,
      depth_m: bitDepth + 74,
      type: 'Lithological Boundary Transition',
      severity: 'caution',
      formation: 'Tipam Sandstone → Barail Unconformity',
      historicalSource: 'DDR-Moran DEMO-104 (2,814m)',
      offsetEvidence: 'Permeability contrast causing differential sticking risk.',
      sopAction: 'Maintain string rotation (90+ RPM) while circulating clean.',
    },
    {
      distance_m: 118,
      depth_m: bitDepth + 118,
      type: 'Fractured Loss Zone / Micro-Fault',
      severity: 'warning',
      formation: 'Lower Barail Fractured Sand',
      historicalSource: 'DDR-Nahorkatiya DEMO-105 (2,858m)',
      offsetEvidence: 'Sudden loss of 14 m³/hr mud to fractured thief zone.',
      sopAction: 'Stage 30 ppb medium nutplug / Mica pill in pill tank.',
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-sans tracking-tight">
                <span>eRTMAC Ahead-of-the-Bit 4D Virtual Radar</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase font-bold tracking-wider">
                  Novel Innovation
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Live eRTMAC WITSML channel ingestion correlated against 40-year offset well institutional memory (next 150m scan).
            </p>
          </div>

          {/* Scenario Selector & Controls */}
          <div className="flex items-center gap-2 flex-wrap font-sans text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Scenario Simulator:</span>
            <button
              onClick={() => setScenario('nominal')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                scenario === 'nominal'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Normal Drilling
            </button>
            <button
              onClick={() => setScenario('influx_warning')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                scenario === 'influx_warning'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Gas Influx Horizon
            </button>
            <button
              onClick={() => setScenario('loss_warning')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                scenario === 'loss_warning'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Mud Loss Zone
            </button>
          </div>
        </div>
      </div>

      {/* 2. Real-Time eRTMAC Sensor Channel Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-sans">
        {/* ROP */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">ROP (m/hr)</div>
          <div className="text-lg font-bold text-cyan-400 mt-1 tabular-nums truncate">{telemetry.rop.toFixed(1)}</div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">Penetration Rate</div>
        </div>

        {/* WOB */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">WOB (tonne)</div>
          <div className="text-lg font-bold text-slate-200 mt-1 tabular-nums truncate">{telemetry.wob.toFixed(1)}</div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">Weight on Bit</div>
        </div>

        {/* RPM */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">RPM</div>
          <div className="text-lg font-bold text-slate-200 mt-1 tabular-nums truncate">{Math.round(telemetry.rpm)}</div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">String Rotation</div>
        </div>

        {/* Torque */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Torque (kNm)</div>
          <div className={`text-lg font-bold mt-1 tabular-nums truncate ${telemetry.torque > 21 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
            {telemetry.torque.toFixed(1)}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">Surface Torque</div>
        </div>

        {/* Standpipe Pressure */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">SPP (psi)</div>
          <div className="text-lg font-bold text-amber-400 mt-1 tabular-nums truncate">{Math.round(telemetry.spp)}</div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">Standpipe Pressure</div>
        </div>

        {/* Flow Out vs Flow In */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Flow Diff</div>
          {(() => {
            const diff = telemetry.flowOut - telemetry.flowIn;
            const isGain = diff > 20;
            const isLoss = diff < -20;
            const colorClass = isGain ? 'text-rose-400' : isLoss ? 'text-amber-400' : 'text-emerald-400';
            const sign = diff > 0 ? '+' : '';
            return (
              <div className={`text-lg font-bold mt-1 tabular-nums truncate ${colorClass}`}>
                {sign}{diff.toFixed(1)} <span className="text-[11px] font-normal text-slate-400">lpm</span>
              </div>
            );
          })()}
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">Gain / Loss</div>
        </div>

        {/* Mud Weight */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">MW In / Out</div>
          <div className="text-base font-bold text-purple-400 mt-1 tabular-nums truncate">
            {Number(telemetry.mudWeightIn).toFixed(2)} / {Number(telemetry.mudWeightOut).toFixed(2)}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">SG (Specific Gravity)</div>
        </div>

        {/* Total Gas */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Total Gas</div>
          <div className={`text-lg font-bold mt-1 tabular-nums truncate ${telemetry.gasUnits > 75 ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`}>
            {Math.round(telemetry.gasUnits)} <span className="text-[11px] font-normal text-slate-400">u</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">Mud Gas Units</div>
        </div>
      </div>

      {/* 3. Main Ahead-of-the-Bit Virtual Horizon Canvas & Cross Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual 150m Lookahead Trajectory Strip */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 font-sans">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-slate-200">150m Ahead-of-the-Bit Trajectory Projection</span>
            </div>
            <div className="text-xs text-slate-400">
              Bit: <span className="text-cyan-400 font-bold tabular-nums">{bitDepth.toFixed(1)} m</span> → Horizon: <span className="text-amber-400 font-bold tabular-nums">{horizonDepth.toFixed(1)} m</span>
            </div>
          </div>

          {/* Interactive Depth Slider Controls */}
          <div className="py-4 font-sans">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
              <span>Adjust Current Bit Depth (eRTMAC Position):</span>
              <span className="text-cyan-400 font-bold tabular-nums">{bitDepth.toFixed(0)} meters</span>
            </div>
            <input
              type="range"
              min="2000"
              max="3800"
              step="5"
              value={bitDepth}
              onChange={(e) => onDepthChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Visual Vertical Wellbore & Formation Projection */}
          <div className="space-y-4 my-2 font-sans">
            {/* Current Bit Marker */}
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  <Activity className="w-3.5 h-3.5 text-slate-950" />
                </div>
                <div>
                  <div className="font-bold text-cyan-300">ACTIVE DRILL BIT AT CURRENT POSITION</div>
                  <div className="text-[10px] text-slate-400">Well: {selectedWell?.code || 'DEMO-WELL-101'} · Tipam Upper Sand</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-cyan-400 tabular-nums">{bitDepth.toFixed(1)} m</div>
                <div className="text-[10px] text-emerald-400 tabular-nums">ROP: {telemetry.rop.toFixed(1)} m/hr</div>
              </div>
            </div>

            {/* Downward Lookahead Hazard Intercepts */}
            <div className="pl-6 border-l-2 border-dashed border-slate-700 space-y-3">
              {lookaheadHazards.map((h, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    h.severity === 'critical'
                      ? 'bg-rose-950/30 border-rose-600/50 hover:border-rose-500'
                      : h.severity === 'caution'
                      ? 'bg-amber-950/30 border-amber-600/50 hover:border-amber-500'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-slate-900 border border-slate-700 text-slate-300">
                        +{h.distance_m}m Ahead
                      </span>
                      <span className="font-bold text-xs text-slate-100">{h.type}</span>
                    </div>
                    <span className="text-xs font-bold text-cyan-400 tabular-nums">{h.depth_m.toFixed(0)}m</span>
                  </div>

                  <div className="text-[11px] text-slate-300 mt-2">
                    <span className="text-slate-400 font-medium">Formation:</span> {h.formation}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    <span className="text-slate-500">Historical Precedent:</span> <span className="text-cyan-300 font-semibold">{h.historicalSource}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 italic">
                    &quot;{h.offsetEvidence}&quot;
                  </div>

                  {/* SOP Recommendation Pill */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Action: {h.sopAction}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 150m Horizon Boundary */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-sans text-slate-400">
              <span>Lookahead Radar Limit (+150m)</span>
              <span className="font-semibold text-slate-300 tabular-nums">{horizonDepth.toFixed(1)} m</span>
            </div>
          </div>
        </div>

        {/* Right Column: Automated Mitigation SOP Action Playbook */}
        <div className="lg:col-span-5 space-y-4 font-sans">
          {/* Driller's Real-Time SOP Checklist Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">OIL Operational SOP Playbook</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase tracking-wider">
                Auto-Generated
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Prescriptive engineering guidelines dynamically tailored to the approaching Barail formation risk.
            </p>

            <div className="space-y-3 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="font-bold text-slate-200">Pre-Treat Active Mud System</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Increase active pit density from 1.28 SG to 1.34 SG at depth 2,765m prior to entering the high-pressure gas zone.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="font-bold text-slate-200">Controlled Drilling Parameters</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Cap WOB at 10.5 tonnes and rotary speed at 90 RPM to prevent thermal fracturing and differential pack-off.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="font-bold text-slate-200">Lost Circulation Material (LCM) Standby</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Prepare 30 m³ of 25 ppb medium nutplug + Mica pill in reserve tank #2 ready for immediate displacement.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <div className="font-bold text-slate-200">Flow Check Protocol</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Perform a mandatory 15-minute static flow check at 2,775m before continuing penetration.
                  </div>
                </div>
              </div>
            </div>

            {/* Copilot Handshake Button */}
            {selectedWell && onOpenCopilot && (
              <div className="mt-5 pt-3 border-t border-slate-800">
                <button
                  onClick={() => onOpenCopilot(selectedWell)}
                  className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Ask Gemini Copilot About Offset Well Mitigation Tactics</span>
                </button>
              </div>
            )}
          </div>

          {/* 9 OIL Data Sources Interoperability Chip */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 font-sans text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-bold mb-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>OIL 9-Data Source Cross-Correlation Engine</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every lookahead alert is mathematically grounded in verified historical records across Well Completion Reports (WCRs), Daily Drilling Reports (DDRs), Mud Logging Streams, and Post-Drilling NPT audits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
