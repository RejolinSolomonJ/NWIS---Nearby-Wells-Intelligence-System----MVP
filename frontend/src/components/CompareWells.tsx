import React, { useState, useEffect } from 'react';
import { Well, SimilarWell, findSimilarWells } from '../api/client';

interface Props {
  wells: Well[];
  initialWellA?: Well | null;
  onClose?: () => void;
}

export const CompareWells: React.FC<Props> = ({ wells, initialWellA, onClose }) => {
  const [wellAId, setWellAId] = useState<string>(initialWellA?.id || (wells[0]?.id || ''));
  const [wellBId, setWellBId] = useState<string>(wells[1]?.id || '');
  const [similarity, setSimilarity] = useState<SimilarWell | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const wellA = wells.find((w) => w.id === wellAId);
  const wellB = wells.find((w) => w.id === wellBId);

  useEffect(() => {
    if (wellAId && wellBId && wellAId !== wellBId) {
      setLoading(true);
      findSimilarWells(wellAId)
        .then((simList) => {
          const match = simList.find((s) => s.well_id === wellBId) || simList[0] || null;
          setSimilarity(match);
        })
        .finally(() => setLoading(false));
    }
  }, [wellAId, wellBId]);

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h3 className="text-lg font-bold font-mono text-slate-100 flex items-center gap-2">
            <span className="text-cyan-400">⚖️</span> Side-by-Side Offset Well Comparison
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic comparative scoring &amp; lithological correlation |{' '}
            <span className="text-amber-400 font-mono">SIMULATED DATA</span>
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-mono px-3 py-1 rounded bg-slate-800"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Selector Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Well A Selector */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <label className="block text-xs font-mono uppercase text-cyan-400 mb-1 font-semibold">
            Primary Target Well (Well A)
          </label>
          <select
            value={wellAId}
            onChange={(e) => setWellAId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
          >
            {wells.map((w) => (
              <option key={w.id} value={w.id}>
                {w.well_name} ({w.well_id_code}) - {w.field_name}
              </option>
            ))}
          </select>
        </div>

        {/* Well B Selector */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <label className="block text-xs font-mono uppercase text-blue-400 mb-1 font-semibold">
            Offset Reference Well (Well B)
          </label>
          <select
            value={wellBId}
            onChange={(e) => setWellBId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500"
          >
            {wells
              .filter((w) => w.id !== wellAId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.well_name} ({w.well_id_code}) - {w.field_name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Multi-Factor Similarity Gauge Bar */}
      {similarity && (
        <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-cyan-900/40">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <div>
              <span className="text-xs uppercase font-mono text-slate-400 font-semibold">
                Overall Multi-Factor Similarity Index:
              </span>
              <span className="text-xl font-bold font-mono text-cyan-400 ml-2">
                {(similarity.overall_similarity * 100).toFixed(1)}%
              </span>
            </div>
            <div className="text-xs font-mono text-slate-300">
              Spatial Distance: <span className="text-cyan-300 font-bold">{similarity.distance_km} km</span>
            </div>
          </div>

          {/* Sub-factor score pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Spatial</div>
              <div className="text-slate-200 font-bold">{((similarity.spatial_score ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Depth Profile</div>
              <div className="text-slate-200 font-bold">{((similarity.depth_score ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Formations</div>
              <div className="text-slate-200 font-bold">{((similarity.formation_score ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Incident Pattern</div>
              <div className="text-slate-200 font-bold">{((similarity.event_score ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Semantic / Field</div>
              <div className="text-slate-200 font-bold">{((similarity.semantic_score ?? 0) * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Specifications Table */}
      {wellA && wellB && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Well A Specs */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold font-mono text-cyan-400 mb-3 text-sm">{wellA.well_name}</h4>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Field / Block:</span>
                <span className="text-slate-200 font-mono">{wellA.field_name} ({wellA.block_name})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Total Depth:</span>
                <span className="text-slate-200 font-mono font-bold">{wellA.total_depth_m} m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Status:</span>
                <span className="text-cyan-300 font-mono uppercase">{wellA.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Operator:</span>
                <span className="text-slate-300">{wellA.operator}</span>
              </div>
            </div>
          </div>

          {/* Well B Specs */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold font-mono text-blue-400 mb-3 text-sm">{wellB.well_name}</h4>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Field / Block:</span>
                <span className="text-slate-200 font-mono">{wellB.field_name} ({wellB.block_name})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Total Depth:</span>
                <span className="text-slate-200 font-mono font-bold">{wellB.total_depth_m} m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Status:</span>
                <span className="text-blue-300 font-mono uppercase">{wellB.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Operator:</span>
                <span className="text-slate-300">{wellB.operator}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
