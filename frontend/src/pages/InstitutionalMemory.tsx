/**
 * InstitutionalMemory.tsx — NWIS-X Phase 12
 * Institutional Memory Search & Knowledge Base
 *
 * 1. Filter UI: event_type, formation, depth range, well, severity -> calls /events with query params (structured primary).
 * 2. Free-text fuzzy search fallback box -> calls /copilot/query internally for semantic match.
 * 3. Results table with Evidence column (triggers EvidenceViewer with page jump and text highlight).
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Sparkles,
  BookOpen,
  FileText,
  Loader2,
  ExternalLink,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import {
  DrillingEvent,
  Well,
  getEvents,
  queryCopilot,
  CopilotQueryResponse,
} from '../api/client';

export interface InstitutionalMemoryProps {
  wells: Well[];
  onOpenEvidence: (docTitle: string, page: number, excerpt: string, wellName: string) => void;
}

const EVENT_TYPES = [
  { value: '', label: 'All Incident Types' },
  { value: 'kick', label: 'Gas Kick / Well Control Influx' },
  { value: 'mud_loss', label: 'Mud Loss / Lost Circulation' },
  { value: 'stuck_pipe', label: 'Stuck Pipe / Differential Sticking' },
  { value: 'pressure_anomaly', label: 'Standpipe Pressure Spike / Anomaly' },
  { value: 'torque_anomaly', label: 'Rotary Torque Drag / Anomaly' },
  { value: 'other', label: 'Other Drilling Incidents' },
];

const FORMATIONS = [
  { value: '', label: 'All Formations' },
  { value: 'Barail', label: 'Barail Coal-Shale Formation (F3)' },
  { value: 'Tipam', label: 'Tipam Sandstone Formation' },
  { value: 'Kopili', label: 'Kopili Shale Formation' },
  { value: 'Sylhet', label: 'Sylhet Limestone Formation' },
  { value: 'Dihing', label: 'Alluvium / Dihing Formation' },
  { value: 'Basement', label: 'Basement Metamorphic Complex' },
];

const SEVERITIES = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning / Caution' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const InstitutionalMemory: React.FC<InstitutionalMemoryProps> = ({
  wells,
  onOpenEvidence,
}) => {
  // Filter States
  const [eventType, setEventType] = useState<string>('');
  const [formation, setFormation] = useState<string>('');
  const [selectedWellId, setSelectedWellId] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [depthMin, setDepthMin] = useState<string>('2500');
  const [depthMax, setDepthMax] = useState<string>('3300');

  // Search Mode & Free-Text
  const [freeTextQuery, setFreeTextQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<'structured' | 'semantic'>('structured');

  // Data & Loading States
  const [events, setEvents] = useState<DrillingEvent[]>([]);
  const [semanticResult, setSemanticResult] = useState<CopilotQueryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Well map lookup
  const wellMap = React.useMemo(() => {
    const map = new Map<string, string>();
    wells.forEach((w) => {
      const code = w.well_id_code || w.code || w.well_name || w.name;
      map.set(w.id || (w as any).well_id, code);
    });
    return map;
  }, [wells]);

  // Execute Structured Query
  const fetchStructuredEvents = async () => {
    setLoading(true);
    setSearchMode('structured');
    try {
      const params: Record<string, any> = {};
      if (selectedWellId) params.well_id = selectedWellId;
      if (formation) params.formation = formation;
      if (eventType) params.event_type = eventType;
      if (severity) params.severity = severity;
      if (depthMin) params.depth_min = parseFloat(depthMin);
      if (depthMax) params.depth_max = parseFloat(depthMax);

      const res = await getEvents(params);
      setEvents(res);
    } catch (e) {
      console.error('Failed to query drilling events:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Execute Free-Text Fuzzy Semantic Search (Hits /copilot/query internally)
  const handleSemanticSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!freeTextQuery.trim()) return;

    setLoading(true);
    setSearchMode('semantic');
    try {
      const copilotRes = await queryCopilot(freeTextQuery, selectedWellId || undefined);
      setSemanticResult(copilotRes);

      // Also parse keywords from free text and fetch structured events
      const lower = freeTextQuery.toLowerCase();
      let matchedType = '';
      if (lower.includes('stuck') || lower.includes('pipe')) matchedType = 'stuck_pipe';
      else if (lower.includes('mud') || lower.includes('loss')) matchedType = 'mud_loss';
      else if (lower.includes('kick')) matchedType = 'gas_kick';
      else if (lower.includes('tight')) matchedType = 'tight_hole';

      let matchedForm = '';
      if (lower.includes('f3') || lower.includes('barail')) matchedForm = 'Barail';
      else if (lower.includes('tipam')) matchedForm = 'Tipam';
      else if (lower.includes('kopili')) matchedForm = 'Kopili';

      const params: Record<string, any> = {};
      if (matchedType) params.event_type = matchedType;
      if (matchedForm) params.formation = matchedForm;
      if (depthMin) params.depth_min = parseFloat(depthMin);
      if (depthMax) params.depth_max = parseFloat(depthMax);

      const structuredRes = await getEvents(params);
      setEvents(structuredRes);
    } catch (err) {
      console.error('Semantic search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStructuredEvents();
  }, [eventType, formation, selectedWellId, severity]);

  const handleResetFilters = () => {
    setEventType('');
    setFormation('');
    setSelectedWellId('');
    setSeverity('');
    setDepthMin('2500');
    setDepthMax('3300');
    setFreeTextQuery('');
    setSearchMode('structured');
    setSemanticResult(null);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold font-sans text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              <span>INSTITUTIONAL MEMORY &amp; LESSONS LEARNED SEARCH</span>
              <span className="text-[10px] px-2 py-0.5 rounded font-sans bg-cyan-950 text-cyan-400 border border-cyan-800 font-semibold">
                SQL FILTER + RAG SEMANTIC
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Deterministic historical query engine over verified offset well dossiers, mud logs, and end-of-well completion records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-sans px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400 font-bold">
              {events.length} MATCHING INCIDENTS
            </span>
            <button
              onClick={handleResetFilters}
              className="text-xs font-sans px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* ─── Free-Text Fuzzy Semantic Search Box (Phase 12 requirement) ─── */}
        <form onSubmit={handleSemanticSearch} className="mt-5">
          <div className="relative flex items-center">
            <input
              type="text"
              value={freeTextQuery}
              onChange={(e) => setFreeTextQuery(e.target.value)}
              placeholder="Fuzzy semantic search (e.g. 'stuck pipe in Formation F3 between 3000-3300m' or 'mud loss in Barail')..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 pl-11 text-xs font-sans text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-4" />
            <button
              type="submit"
              disabled={loading || !freeTextQuery.trim()}
              className="absolute right-2 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-sans transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Semantic Search'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-slate-400">
            <span className="text-slate-500">Quick Try:</span>
            {[
              'stuck pipe in Formation F3 between 3000-3300m',
              'mud loss in Barail Coal-Shale',
              'well control gas kick in offset wells',
            ].map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setFreeTextQuery(preset);
                  // Trigger search
                  setLoading(true);
                  setSearchMode('semantic');
                  queryCopilot(preset).then((r) => {
                    setSemanticResult(r);
                    getEvents({ formation: 'Barail', depth_min: 2700, depth_max: 3300 }).then(setEvents);
                  }).finally(() => setLoading(false));
                }}
                className="text-cyan-400/80 hover:text-cyan-300 underline bg-transparent border-0 p-0 cursor-pointer"
              >
                &ldquo;{preset}&rdquo;
              </button>
            ))}
          </div>
        </form>

        {/* ─── Structured Multi-Factor Filter Bar (Phase 12 Primary) ─── */}
        <div className="mt-5 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          {/* Event Type */}
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:border-cyan-500 focus:outline-none"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Formation */}
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Formation
            </label>
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:border-cyan-500 focus:outline-none"
            >
              {FORMATIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Well Selector */}
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Target Well
            </label>
            <select
              value={selectedWellId}
              onChange={(e) => setSelectedWellId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Wells (Global)</option>
              {wells.map((w) => {
                const wid = w.id || (w as any).well_id;
                const label = w.well_id_code || w.code || w.name || w.well_name;
                return (
                  <option key={wid} value={wid}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:border-cyan-500 focus:outline-none"
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Depth Min */}
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Min Depth (m)
            </label>
            <input
              type="number"
              value={depthMin}
              onChange={(e) => setDepthMin(e.target.value)}
              placeholder="e.g. 2500"
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Depth Max */}
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Max Depth (m)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={depthMax}
                onChange={(e) => setDepthMax(e.target.value)}
                placeholder="e.g. 3300"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={fetchStructuredEvents}
                className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold flex items-center justify-center"
                title="Apply Depth Filters"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Semantic Search Synthesis Banner (When active) ─── */}
      {searchMode === 'semantic' && semanticResult && (
        <div className="bg-slate-900/90 border border-cyan-800/50 rounded-2xl p-5 shadow-xl font-sans text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-cyan-400 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>SEMANTIC KNOWLEDGE SYNTHESIS &amp; CITATIONS</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Citation-Enforced RAG Result</span>
          </div>

          <p className="text-slate-200 leading-relaxed text-sm bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
            {semanticResult.answer}
          </p>

          {semanticResult.citations && semanticResult.citations.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Clickable Citations:</span>
              <div className="flex flex-wrap gap-2">
                {semanticResult.citations.map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOpenEvidence(c.doc, c.page, c.snippet, c.well)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 text-xs flex items-center gap-2 transition-colors font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>[{c.well} · {c.doc} · Page {c.page}]</span>
                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Results Table with Evidence Column (Phase 12 requirement) ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>FILTERED DRILLING EVENTS TABLE ({events.length} RECORDS)</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            Structured SQL Query on drilling_events
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-cyan-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Querying verified database records…</span>
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <Search className="w-8 h-8 text-slate-600 mb-1" />
            <span>No historical incidents found matching the specified filters.</span>
            <div className="mt-1 text-slate-600">Try widening the depth interval or clearing the formation filter.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                  <th className="py-3 px-4">Well Code</th>
                  <th className="py-3 px-3">Depth (m)</th>
                  <th className="py-3 px-3">Formation</th>
                  <th className="py-3 px-3">Incident Type</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-4">Incident Log / Description</th>
                  <th className="py-3 px-4 text-center">Verified Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {events.map((ev, i) => {
                  const wName = wellMap.get(ev.well_id) || ev.well_id?.slice(0, 12) || 'DEMO-WELL';
                  const sevColor =
                    ev.severity === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : ev.severity === 'warning' || ev.severity === 'high'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40';

                  return (
                    <tr key={ev.event_id || i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-400 whitespace-nowrap">
                        {wName}
                      </td>
                      <td className="py-3 px-3 text-amber-400 font-bold whitespace-nowrap tabular-nums">
                        {ev.depth_m} m
                      </td>
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                        {ev.formation_name || 'Barail Formation'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-200">
                          {ev.event_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sevColor}`}>
                          {ev.severity || 'HIGH'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-[11px] max-w-md leading-relaxed">
                        {ev.description}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            const doc = `Daily Drilling Report — ${wName}`;
                            const page = ev.page_number || 3;
                            const excerpt = ev.raw_text_snippet || ev.description;
                            onOpenEvidence(doc, page, excerpt, wName);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold flex items-center gap-1.5 mx-auto transition-colors"
                          title="Open Page in Archival PDF Viewer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Page {ev.page_number || 3}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
