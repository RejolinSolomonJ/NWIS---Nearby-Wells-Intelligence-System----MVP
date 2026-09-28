import React, { useState } from 'react';

interface ReviewItem {
  id: string;
  query: string;
  response: string;
  citationsCount: number;
  isApproved: boolean | null;
  timestamp: string;
}

export const AdminReview: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([
    {
      id: 'rev-1',
      query: 'What was the kick intensity in NHK-102 at 2940m?',
      response: 'NHK-102 suffered an influx of 28 bbls with 420 psi SIDPP at 2940m in Barail Coal-Shale. Cites NHK-102 Report p. 14.',
      citationsCount: 2,
      isApproved: true,
      timestamp: '2026-09-28 14:22',
    },
    {
      id: 'rev-2',
      query: 'What is the fracture gradient in Moran upper sandstone?',
      response: 'Upper Tipam sandstone showed fracture breakdown at 11.1 ppg EMW, causing 95 bbl/hr losses. Cites MRN-104 Log p. 21.',
      citationsCount: 3,
      isApproved: null,
      timestamp: '2026-09-28 15:45',
    },
    {
      id: 'rev-3',
      query: 'Recommended mud weight program for Baghjan exploratory interval?',
      response: 'Maintain 11.4 to 11.8 ppg mud density through Barail transition to control abnormal gas pressures. Cites BGJ-106 Dossier p. 8.',
      citationsCount: 2,
      isApproved: null,
      timestamp: '2026-09-28 16:10',
    },
  ]);

  const handleApprove = (id: string, status: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isApproved: status } : item))
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h3 className="text-lg font-bold font-mono text-slate-100 flex items-center gap-2">
            <span className="text-cyan-400">🛡️</span> Admin Review &amp; Compliance Audit
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Institutional Memory Verification: Ensures LLM never generates numbers and all citations match DB records.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300">
          Zero Hallucination Protocol Active
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase bg-slate-950/80">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Engineer Query</th>
              <th className="py-3 px-4">Copilot Synthesized Narration</th>
              <th className="py-3 px-4">Citations</th>
              <th className="py-3 px-4">Compliance Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">{item.timestamp}</td>
                <td className="py-3 px-4 font-semibold text-slate-200">{item.query}</td>
                <td className="py-3 px-4 text-slate-300 max-w-xs">{item.response}</td>
                <td className="py-3 px-4 font-mono text-cyan-400">{item.citationsCount} Sources</td>
                <td className="py-3 px-4">
                  {item.isApproved === true && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      ✓ Approved
                    </span>
                  )}
                  {item.isApproved === false && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                      ✕ Rejected
                    </span>
                  )}
                  {item.isApproved === null && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                      ⏳ Pending Audit
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => handleApprove(item.id, true)}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-mono"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApprove(item.id, false)}
                    className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 rounded text-[11px] font-mono"
                  >
                    Flag
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
