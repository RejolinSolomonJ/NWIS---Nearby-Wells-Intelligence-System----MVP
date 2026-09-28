import React from 'react';

interface Props {
  documentTitle?: string;
  pageNumber?: number;
  excerpt?: string;
  wellName?: string;
  ocrConfidence?: number;
  onClose?: () => void;
}

export const EvidenceViewer: React.FC<Props> = ({
  documentTitle = 'End of Well Completion Report',
  pageNumber = 14,
  excerpt = 'Kick influx of 28 bbls recorded while drilling Barail Coal-Shale sequence at 2940.5m. Annular BOP activated.',
  wellName = 'NHK-101',
  ocrConfidence = 0.94,
  onClose,
}) => {
  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div>
          <h3 className="text-base font-bold font-mono text-slate-100 flex items-center gap-2">
            <span className="text-cyan-400">📑</span> Archival Evidence &amp; OCR Citation Viewer
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified Page Excerpt from OIL Archival Record | <span className="text-amber-400 font-mono">SIMULATED DATA</span>
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xs font-mono px-3 py-1 rounded bg-slate-800"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Meta tags */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs font-mono">
        <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300">
          Well: <strong>{wellName}</strong>
        </span>
        <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
          Document: <strong>{documentTitle}</strong>
        </span>
        <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-amber-300">
          Page: <strong>{pageNumber}</strong>
        </span>
        <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400">
          OCR Quality: <strong>{(ocrConfidence * 100).toFixed(0)}%</strong>
        </span>
      </div>

      {/* Simulated Document Preview Page */}
      <div className="bg-amber-50/5 border border-amber-500/20 rounded-xl p-6 font-mono text-xs leading-relaxed text-slate-200 relative overflow-hidden">
        <div className="absolute top-2 right-3 text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">
          SIMULATED OIL ARTIFACT
        </div>
        <div className="border-b border-slate-700/50 pb-2 mb-3 text-slate-400">
          --- OIL INDIA LIMITED (SIMULATED OPERATIONS) --- WELL COMPLETION DOSSIER ---
        </div>
        <p className="mb-3 text-slate-300">
          Depth Interval: 2850.0m - 3100.0m | Formation: Barail Coal-Shale Facies
        </p>
        <div className="bg-cyan-500/10 border-l-4 border-cyan-400 p-3 my-2 text-cyan-100 rounded-r">
          <span className="font-bold uppercase text-[10px] text-cyan-300 block mb-1">
            [CITED EVIDENCE EXCERPT - PAGE {pageNumber}]
          </span>
          &ldquo;{excerpt}&rdquo;
        </div>
        <p className="mt-3 text-slate-400 text-[11px]">
          Mud density increased from 10.4 ppg to 11.6 ppg with barite additive. Flow checked 15 mins. Well confirmed dead.
        </p>
      </div>
    </div>
  );
};
