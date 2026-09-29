/**
 * AdminReview.tsx — NWIS-X Phase 14 & Phase 15
 * 1. Human-in-the-Loop OCR Review Queue (GET /events/needs-review + PATCH /events/{id}/review)
 * 2. Security & Operational Audit Log Viewer (GET /audit-logs)
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileText,
  ScrollText,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Edit3,
  Check,
  Save,
} from 'lucide-react';
import {
  DrillingEvent,
  AuditLogEntry,
  getNeedsReviewEvents,
  reviewDrillingEvent,
  getAuditLogs,
} from '../api/client';

export const AdminReview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ocr_queue' | 'audit_logs'>('ocr_queue');

  // Review Queue state
  const [reviewEvents, setReviewEvents] = useState<DrillingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDepth, setEditDepth] = useState<string>('');
  const [editFormation, setEditFormation] = useState<string>('');
  const [editEventType, setEditEventType] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  const fetchReviewQueue = async () => {
    setLoadingEvents(true);
    try {
      const data = await getNeedsReviewEvents();
      setReviewEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchReviewQueue();
    fetchLogs();
  }, []);

  const handleStartEdit = (ev: DrillingEvent) => {
    setEditingId(ev.event_id || (ev as any).id);
    setEditDepth(String(ev.depth_m || 2750));
    setEditFormation(ev.formation_name || 'Barail Coal-Shale Formation (F3)');
    setEditEventType(ev.event_type || 'mud_loss');
  };

  const handleSaveCorrection = async (eventId: string, approveOnly = false) => {
    try {
      const updates = approveOnly
        ? { approve: true }
        : {
            depth_m: parseFloat(editDepth),
            formation_name: editFormation,
            event_type: editEventType,
            approve: true,
          };

      await reviewDrillingEvent(eventId, updates);

      setSaveSuccessMsg(`Event ${eventId.slice(0, 8)} successfully approved and persisted!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);

      // Remove from pending queue or mark reviewed
      setReviewEvents((prev) => prev.filter((e) => (e.event_id || (e as any).id) !== eventId));
      setEditingId(null);

      // Refresh audit logs to show approval entry
      fetchLogs();
    } catch (err: any) {
      alert(`Error approving event: ${err.message}`);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-6 font-sans">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>ADMINISTRATIVE GOVERNANCE &amp; AUDIT TRAIL</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold">
              ROLE: ADMIN
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Human-in-the-loop OCR verification, inline correction, and immutable compliance logs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-sans">
          <button
            onClick={() => setActiveTab('ocr_queue')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 font-bold ${
              activeTab === 'ocr_queue'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>OCR Review Queue</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-cyan-400">
              {reviewEvents.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('audit_logs');
              fetchLogs();
            }}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 font-bold ${
              activeTab === 'audit_logs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Security Audit Logs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-purple-400">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between font-sans">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-bold uppercase">PERSISTED TO DB</span>
        </div>
      )}

      {/* ─── TAB 1: Human-in-the-Loop OCR Review Queue (Phase 15 Feature 1) ─── */}
      {activeTab === 'ocr_queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Low-Confidence Extracted Incidents Requiring Subject Matter Expert (SME) Verification</span>
            </span>
            <button
              onClick={fetchReviewQueue}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              <span>Refresh Queue</span>
            </button>
          </div>

          {loadingEvents ? (
            <div className="py-12 text-center text-xs text-cyan-400 font-sans">Loading review queue…</div>
          ) : reviewEvents.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800 font-sans flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
              <span>All extracted incidents verified! Zero pending low-confidence items in queue.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewEvents.map((ev) => {
                const id = ev.event_id || (ev as any).id;
                const isEditing = editingId === id;

                return (
                  <div
                    key={id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-3 transition-colors hover:border-slate-700 font-sans"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Needs SME Review</span>
                        </span>
                        <span className="text-cyan-400 font-bold">
                          Well ID: {ev.well_id?.slice(0, 8)}…
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-300">
                          Source: Daily Drilling Report (Page {ev.page_number || 3})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEditing ? (
                          <>
                            <button
                              onClick={() => handleStartEdit(ev)}
                              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Values</span>
                            </button>
                            <button
                              onClick={() => handleSaveCorrection(id, true)}
                              className="px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve Direct</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSaveCorrection(id, false)}
                              className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save &amp; Persist</span>
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Raw Text Snippet */}
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 text-slate-300 text-[11px] leading-relaxed">
                      <span className="text-slate-500 block uppercase text-[10px] mb-1 font-bold">
                        RAW OCR EXTRACTED TEXT:
                      </span>
                      &ldquo;{ev.raw_text_snippet || ev.description}&rdquo;
                    </div>

                    {/* Editable / Verified Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Depth */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                        <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                          Depth (m)
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editDepth}
                            onChange={(e) => setEditDepth(e.target.value)}
                            className="w-full bg-slate-950 border border-cyan-500/50 rounded px-2 py-1 text-amber-400 font-bold text-xs"
                          />
                        ) : (
                          <span className="text-amber-400 font-bold text-sm">{ev.depth_m} m</span>
                        )}
                      </div>

                      {/* Formation */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                        <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                          Formation
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFormation}
                            onChange={(e) => setEditFormation(e.target.value)}
                            className="w-full bg-slate-950 border border-cyan-500/50 rounded px-2 py-1 text-slate-200 text-xs"
                          />
                        ) : (
                          <span className="text-slate-200 text-xs font-semibold truncate block">
                            {ev.formation_name || 'Barail Formation'}
                          </span>
                        )}
                      </div>

                      {/* Event Type */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                        <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                          Event Type
                        </label>
                        {isEditing ? (
                          <select
                            value={editEventType}
                            onChange={(e) => setEditEventType(e.target.value)}
                            className="w-full bg-slate-950 border border-cyan-500/50 rounded px-2 py-1 text-rose-300 font-bold text-xs"
                          >
                            <option value="mud_loss">mud_loss</option>
                            <option value="stuck_pipe">stuck_pipe</option>
                            <option value="gas_kick">gas_kick</option>
                            <option value="tight_hole">tight_hole</option>
                            <option value="pack_off">pack_off</option>
                          </select>
                        ) : (
                          <span className="text-rose-400 font-bold uppercase text-xs">
                            {ev.event_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: Security & Operational Audit Log Viewer (Phase 14) ─── */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Immutable security &amp; access logging for all uploads, alert reviews, and RAG copilot queries.</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
              Total Recorded: {auditLogs.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-500 font-mono uppercase text-[10px]">
                  <th className="py-2.5 px-4">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-4">Operational Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((log) => {
                  const roleBadge =
                    log.role === 'admin'
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
                      : log.role === 'engineer'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <tr key={log.log_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()} · {new Date(log.timestamp).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-200">{log.username}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${roleBadge}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-cyan-400">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{log.entity}</td>
                      <td className="py-2.5 px-4 text-slate-300 text-[11px] max-w-md truncate">
                        {log.details || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
