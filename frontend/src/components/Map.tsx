import React, { useState } from 'react';
import { Well } from '../api/client';

interface Props {
  wells: Well[];
  selectedWell: Well | null;
  onSelectWell: (well: Well) => void;
  onOpenCopilot: (well: Well) => void;
  onOpenCompare: (well: Well) => void;
  onDownloadReport: (well: Well) => void;
}

export const Map: React.FC<Props> = ({
  wells,
  selectedWell,
  onSelectWell,
  onOpenCopilot,
  onOpenCompare,
  onDownloadReport,
}) => {
  const [filterField, setFilterField] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filter wells
  const filteredWells = wells.filter((w) => {
    if (filterField !== 'all' && w.field_name !== filterField) return false;
    if (filterStatus !== 'all' && w.status !== filterStatus) return false;
    return true;
  });

  const fields = Array.from(new Set(wells.map((w) => w.field_name)));

  // Coordinate normalizer for Assam-Arakan Region: Lat [26.5, 27.8], Lon [94.0, 96.2]
  const minLat = 26.5;
  const maxLat = 27.8;
  const minLon = 94.0;
  const maxLon = 96.2;

  const getPos = (lat: number, lon: number) => {
    const xPct = ((lon - minLon) / (maxLon - minLon)) * 100;
    const yPct = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
    return {
      left: `${Math.min(95, Math.max(5, xPct))}%`,
      top: `${Math.min(92, Math.max(8, yPct))}%`,
    };
  };

  const getRiskColor = (score?: number) => {
    if (!score || score < 0.4) return { bg: 'bg-emerald-500', border: 'border-emerald-400', shadow: 'shadow-emerald-500/50', label: 'LOW' };
    if (score < 0.7) return { bg: 'bg-amber-500', border: 'border-amber-400', shadow: 'shadow-amber-500/50', label: 'MODERATE' };
    return { bg: 'bg-rose-500', border: 'border-rose-400', shadow: 'shadow-rose-500/50', label: 'CRITICAL' };
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col h-[650px] relative">
      {/* Top Map Header & Filters */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 z-10">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            Assam-Arakan Spatial Well Intelligence Map
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            PostGIS Georeferenced Coordinates | <span className="text-amber-400 font-mono">SIMULATED DATA</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Field Filter */}
          <select
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Fields ({wells.length})</option>
            {fields.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="drilling">Drilling (Active)</option>
            <option value="completed">Completed</option>
            <option value="suspended">Suspended</option>
          </select>

          {/* Map Legend */}
          <div className="flex items-center gap-3 text-[11px] font-mono bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low (&lt;0.4)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Med (0.4-0.7)
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> High (&ge;0.7)
            </span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden select-none">
        {/* Geo Grid background lines */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Topographic Contours / River Sim Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
          <path
            d="M 50 250 Q 200 180 400 240 T 800 200 T 1200 320"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
          <text x="320" y="210" fill="#38bdf8" fontSize="10" fontFamily="monospace">
            Brahmaputra Structural Corridor (Simulated)
          </text>
        </svg>

        {/* Field Labels */}
        <div className="absolute top-12 left-16 text-xs font-mono text-slate-500 tracking-wider font-semibold pointer-events-none">
          JORHAT FIELD [BLOCK JRT-A]
        </div>
        <div className="absolute top-28 left-[45%] text-xs font-mono text-slate-500 tracking-wider font-semibold pointer-events-none">
          MORAN FIELD [BLOCK MRN-B]
        </div>
        <div className="absolute top-16 right-24 text-xs font-mono text-slate-500 tracking-wider font-semibold pointer-events-none">
          NAHORKATIYA & DIGBOI BASIN
        </div>

        {/* Interactive Well Markers */}
        {filteredWells.map((well) => {
          const pos = getPos(well.latitude, well.longitude);
          const risk = getRiskColor(well.risk_score);
          const isSelected = selectedWell?.id === well.id;

          return (
            <div
              key={well.id}
              onClick={() => onSelectWell(well)}
              style={{ left: pos.left, top: pos.top }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-20 group ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-110'
              }`}
            >
              {/* Outer Pulse for Active Drilling Wells */}
              {well.status === 'drilling' && (
                <span className={`absolute -inset-2 rounded-full opacity-60 animate-ping ${risk.bg}`} />
              )}

              {/* Marker Icon */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform ${
                  risk.bg
                } ${risk.border} ${isSelected ? 'ring-4 ring-cyan-400/80 scale-110' : ''}`}
              >
                <span className="text-[10px] font-bold text-slate-950 font-mono">
                  {well.well_id_code.split('-')[0].charAt(0)}
                </span>
              </div>

              {/* Label Tag on Hover / Selected */}
              <div
                className={`absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-slate-200 pointer-events-none transition-all shadow-md ${
                  isSelected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {well.well_id_code} ({(well.risk_score ? well.risk_score * 100 : 45).toFixed(0)}%)
              </div>
            </div>
          );
        })}

        {/* Selected Well Intelligence Flyout Card */}
        {selectedWell && (
          <div className="absolute bottom-4 right-4 w-96 bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-xl z-30 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  {selectedWell.field_name} Field · {selectedWell.block_name || 'Block A'}
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">{selectedWell.well_name}</h3>
                <div className="text-xs font-mono text-slate-400">{selectedWell.well_id_code}</div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    getRiskColor(selectedWell.risk_score).bg
                  } text-slate-950`}
                >
                  RISK: {((selectedWell.risk_score || 0.45) * 100).toFixed(0)}%
                </span>
                <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                  Status: <span className="text-cyan-400">{selectedWell.status}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Total Depth:</span>{' '}
                <span className="font-mono text-slate-200 font-bold">{selectedWell.total_depth_m} m</span>
              </div>
              <div>
                <span className="text-slate-400">Coordinates:</span>{' '}
                <span className="font-mono text-slate-200">{selectedWell.latitude.toFixed(3)}N, {selectedWell.longitude.toFixed(3)}E</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800">
              <button
                onClick={() => onOpenCopilot(selectedWell)}
                className="px-2.5 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-mono transition-all text-center"
              >
                🤖 Ask Copilot
              </button>
              <button
                onClick={() => onOpenCompare(selectedWell)}
                className="px-2.5 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-mono transition-all text-center"
              >
                ⚖️ Compare
              </button>
              <button
                onClick={() => onDownloadReport(selectedWell)}
                className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-mono transition-all text-center"
              >
                📄 PDF Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
