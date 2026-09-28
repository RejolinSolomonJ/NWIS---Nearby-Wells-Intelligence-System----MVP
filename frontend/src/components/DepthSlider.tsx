import React, { useState } from 'react';
import { DrillingEvent } from '../api/client';

interface Props {
  currentDepth: number;
  maxDepth: number;
  onDepthChange: (depth: number) => void;
  events?: DrillingEvent[];
}

export const DepthSlider: React.FC<Props> = ({
  currentDepth,
  maxDepth = 4200,
  onDepthChange,
  events = [],
}) => {
  // Stratigraphic sequence reference
  const formations = [
    { name: 'Alluvium / Dihing', top: 0, bottom: 450, color: 'bg-amber-900/40 text-amber-300' },
    { name: 'Girujan Clay', top: 450, bottom: 1100, color: 'bg-emerald-900/40 text-emerald-300' },
    { name: 'Tipam Sandstone', top: 1100, bottom: 2200, color: 'bg-yellow-900/40 text-yellow-300' },
    { name: 'Bokabil Formation', top: 2200, bottom: 2750, color: 'bg-orange-900/40 text-orange-300' },
    { name: 'Barail Coal-Shale', top: 2750, bottom: 3450, color: 'bg-rose-900/40 text-rose-300' },
    { name: 'Kopili Formation', top: 3450, bottom: 3950, color: 'bg-purple-900/40 text-purple-300' },
    { name: 'Sylhet Limestone', top: 3950, bottom: 4500, color: 'bg-blue-900/40 text-blue-300' },
  ];

  const activeFormation =
    formations.find((f) => currentDepth >= f.top && currentDepth <= f.bottom) ||
    formations[formations.length - 1];

  // Incidents within +/- 200m window
  const nearbyEvents = events.filter(
    (e) => Math.abs(e.depth_m - currentDepth) <= 200
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
            <span className="text-cyan-400">📏</span> Depth-Aware Stratigraphic Slider
          </h3>
          <p className="text-xs text-slate-400">
            Real-time depth window filtering incidents &amp; formation transitions |{' '}
            <span className="text-amber-400 font-mono">SIMULATED DATA</span>
          </p>
        </div>

        {/* Current Depth & Formation Pill */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Depth: </span>
            <span className="text-cyan-400 font-bold text-sm">{currentDepth} m</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${activeFormation.color}`}>
            {activeFormation.name} ({activeFormation.top}m - {activeFormation.bottom}m)
          </div>
        </div>
      </div>

      {/* Interactive Slider Input */}
      <div className="relative py-4">
        <input
          type="range"
          min="0"
          max={maxDepth}
          step="25"
          value={currentDepth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
        />

        {/* Stratigraphic Layer Markers below slider */}
        <div className="grid grid-cols-7 gap-1 mt-2 text-[10px] font-mono text-center">
          {formations.map((f, idx) => (
            <div
              key={idx}
              className={`p-1 rounded truncate border border-slate-800/80 ${
                activeFormation.name === f.name ? 'ring-2 ring-cyan-400 bg-slate-800 font-bold' : 'text-slate-500'
              }`}
            >
              {f.name.split(' ')[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Events in Depth Window */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex justify-between items-center text-xs font-mono mb-2">
          <span className="text-slate-300 font-semibold">
            Historical Incidents in ±200m Window ({nearbyEvents.length} detected):
          </span>
          <span className="text-slate-400">Corridor: {Math.max(0, currentDepth - 200)}m - {currentDepth + 200}m</span>
        </div>

        {nearbyEvents.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-2">
            No severe drilling incidents recorded in offset institutional memory across this depth corridor.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {nearbyEvents.map((evt, idx) => (
              <div
                key={idx}
                className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-3 text-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 font-mono">
                    {evt.event_type.replace('_', ' ').toUpperCase()} @ {evt.depth_m}m
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                      evt.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {evt.severity}
                  </span>
                </div>
                <p className="text-slate-400 mt-1 text-[11px] line-clamp-2">{evt.description}</p>
                <div className="mt-2 text-[10px] font-mono text-cyan-300">
                  Mud Density: {evt.mud_weight_ppg || 11.2} ppg · {evt.action_taken ? evt.action_taken.substring(0, 45) + '...' : 'Remediated'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
