import React, { useState, useEffect } from 'react';
import {
  Well,
  Alert,
  HealthStatus,
  checkHealth,
  getWells,
  getAlerts,
  getCurrentRisk,
  CurrentRiskResponse,
  getEvents,
  DrillingEvent,
} from './api/client';

import en from './i18n/en.json';
import hi from './i18n/hi.json';

import { Dashboard } from './components/Dashboard';
import { Map } from './components/Map';
import { RiskRadar } from './components/RiskRadar';
import { CompareWells } from './components/CompareWells';
import { AlertCard } from './components/AlertCard';
import { Copilot } from './components/Copilot';
import { AdminReview } from './components/AdminReview';
import { EvidenceViewer } from './components/EvidenceViewer';
import { DepthSlider } from './components/DepthSlider';

type NavTab =
  | 'dashboard'
  | 'map'
  | 'depth_radar'
  | 'institutional_memory'
  | 'copilot'
  | 'compare'
  | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const t = lang === 'en' ? en : hi;

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wells, setWells] = useState<Well[]>([]);
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentRisk, setCurrentRisk] = useState<CurrentRiskResponse | null>(null);
  const [events, setEvents] = useState<DrillingEvent[]>([]);
  const [currentDepth, setCurrentDepth] = useState<number>(2740.0);

  // Evidence modal state
  const [evidenceModal, setEvidenceModal] = useState<{
    isOpen: boolean;
    title?: string;
    page?: number;
    excerpt?: string;
    wellName?: string;
  }>({ isOpen: false });

  // Initial load: health check, wells, alerts, events
  useEffect(() => {
    checkHealth().then(setHealth);
    getWells().then((data) => {
      setWells(data);
      if (data.length > 0) {
        setSelectedWell(data[0]);
      }
    });
    getAlerts().then(setAlerts);
    getEvents().then(setEvents);

    // Periodic health polling every 30s
    const timer = setInterval(() => {
      checkHealth().then(setHealth);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Update current lookahead risk whenever selectedWell or depth changes
  useEffect(() => {
    if (selectedWell) {
      const wellId = selectedWell.well_id || (selectedWell as any).id;
      getCurrentRisk(wellId, currentDepth).then(setCurrentRisk);
    }
  }, [selectedWell, currentDepth]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.alert_id === alertId || (a as any).id === alertId
          ? { ...a, is_acknowledged: true, is_read: true }
          : a
      )
    );
  };

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: '📊' },
    { id: 'map', label: t.nav.map, icon: '🗺️' },
    { id: 'depth_radar', label: t.nav.depth_radar, icon: '🎯' },
    { id: 'institutional_memory', label: t.nav.institutional_memory, icon: '🏛️' },
    { id: 'copilot', label: t.nav.copilot, icon: '🤖' },
    { id: 'compare', label: t.nav.compare, icon: '⚖️' },
    { id: 'admin', label: t.nav.admin, icon: '🛡️' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* 1. Mandatory Simulated Data Banner (SIH26121 Non-Negotiable) */}
      <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 py-1.5 px-4 text-center text-xs font-mono font-semibold flex items-center justify-center gap-2 tracking-wider sticky top-0 z-50 backdrop-blur-md">
        <span>⚠️</span>
        <span>
          {t.simulated_data_disclaimer} — ALL ATTRIBUTES & GEOLOGY ARE SYNTHETIC. NO OIL INDIA PROPRIETARY DATA.
        </span>
      </div>

      {/* 2. Ops-Room Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xl sticky top-7 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center font-mono font-black text-slate-950 text-base shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
              NX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-mono tracking-tight text-slate-100">
                  {t.app_name}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/80">
                  SIH26121 · OIL INDIA LTD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {t.tagline}
              </p>
            </div>
          </div>

          {/* Quick Active Well Selector & Metrics */}
          {selectedWell && (
            <div className="hidden lg:flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono">
              <span className="text-slate-500">ACTIVE:</span>
              <span className="text-cyan-400 font-semibold">{selectedWell.code || selectedWell.name}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">DEPTH:</span>
              <span className="text-amber-400 font-bold">{currentDepth.toFixed(1)}m</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">STATE:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  currentRisk?.risk_level === 'HIGH_EVIDENCE_RISK'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : currentRisk?.risk_level === 'CAUTION'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {currentRisk?.risk_level || 'NORMAL'}
              </span>
            </div>
          )}

          {/* Right Controls: i18n & Health Beacon */}
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 transition-colors flex items-center gap-1.5"
              title="Toggle Language"
            >
              <span>🌐</span>
              <span className="font-bold">{lang === 'en' ? 'हिन्दी (HI)' : 'ENGLISH (EN)'}</span>
            </button>

            {/* Health Status Indicator (Acceptance Check Requirement) */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                health?.status === 'healthy' || health?.status === 'degraded'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === 'healthy' || health?.status === 'degraded'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-rose-400'
                }`}
              ></span>
              <span className="font-semibold">
                {health?.status === 'healthy' || health?.status === 'degraded'
                  ? t.status_connected
                  : t.status_offline}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 3. App Shell: Sidebar Navigation + Main Content Area */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 gap-6">
        {/* Sidebar Nav */}
        <aside className="w-60 shrink-0 hidden md:block">
          <nav className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-1 backdrop-blur-md sticky top-24">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              OPERATIONS NAVIGATION
            </div>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-mono transition-all ${
                  activeTab === item.id
                    ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.id === 'institutional_memory' && alerts.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {alerts.length}
                  </span>
                )}
              </button>
            ))}

            {/* Well Quick-Switch in Sidebar */}
            <div className="pt-4 mt-4 border-t border-slate-800/80 px-2">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                SELECT TARGET WELL
              </label>
              <select
                value={selectedWell?.well_id || (selectedWell as any)?.id || ''}
                onChange={(e) => {
                  const found = wells.find(
                    (w) => w.well_id === e.target.value || (w as any).id === e.target.value
                  );
                  if (found) setSelectedWell(found);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
              >
                {wells.map((w) => (
                  <option key={w.well_id || (w as any).id} value={w.well_id || (w as any).id}>
                    {w.code || w.name}
                  </option>
                ))}
              </select>
            </div>
          </nav>
        </aside>

        {/* Mobile Horizontal Bar */}
        <div className="md:hidden w-full flex overflow-x-auto gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 mb-4 text-xs font-mono">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as NavTab)}
              className={`px-3 py-1.5 rounded-lg shrink-0 ${
                activeTab === item.id ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              kpis={{
                total_wells: wells.length,
                active_wells: wells.filter((w) => w.status === 'active').length,
                critical_alerts: alerts.filter((a) => a.severity === 'critical').length,
                avg_risk_score: 72.4,
              } as any}
              wells={wells}
              selectedWell={selectedWell}
              assessment={null}
              alerts={alerts}
              onSelectWell={setSelectedWell}
              onOpenCopilot={(w) => {
                setSelectedWell(w);
                setActiveTab('copilot');
              }}
              onOpenCompare={(w) => {
                setSelectedWell(w);
                setActiveTab('compare');
              }}
              onDownloadReport={() => {}}
              onAcknowledgeAlert={handleAcknowledgeAlert}
            />
          )}

          {activeTab === 'map' && (
            <Map
              wells={wells}
              selectedWell={selectedWell}
              onSelectWell={setSelectedWell}
              onOpenCopilot={(w) => {
                setSelectedWell(w);
                setActiveTab('copilot');
              }}
              onOpenCompare={(w) => {
                setSelectedWell(w);
                setActiveTab('compare');
              }}
              onDownloadReport={() => {}}
            />
          )}

          {activeTab === 'depth_radar' && (
            <div className="space-y-6">
              {/* Depth Lookahead Control Bar */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold font-mono text-cyan-400 flex items-center gap-2">
                      <span>🎯</span>
                      <span>DEPTH-AWARE LOOKAHEAD RISK RADAR</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deterministic state machine: NORMAL ➔ WATCH ➔ CAUTION ➔ HIGH_EVIDENCE_RISK
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">SIMULATE BIT DEPTH:</span>
                    <input
                      type="number"
                      step="5"
                      min="100"
                      max="4000"
                      value={currentDepth}
                      onChange={(e) => setCurrentDepth(parseFloat(e.target.value) || 2700)}
                      className="w-24 bg-slate-950 border border-slate-700 text-amber-400 px-3 py-1 rounded-lg text-sm font-mono font-bold text-center"
                    />
                    <span className="text-xs font-mono text-slate-500">meters</span>
                  </div>
                </div>

                <DepthSlider
                  currentDepth={currentDepth}
                  maxDepth={selectedWell?.total_depth_m || 3500}
                  onDepthChange={setCurrentDepth}
                />

                {/* Real-time State Machine Readout */}
                {currentRisk && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">STATE MACHINE STATUS</div>
                      <div
                        className={`text-base font-bold font-mono mt-1 ${
                          currentRisk.risk_level === 'HIGH_EVIDENCE_RISK'
                            ? 'text-rose-400'
                            : currentRisk.risk_level === 'CAUTION'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {currentRisk.risk_level}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        Score: {currentRisk.risk_score} / 100 · Confidence: {currentRisk.confidence}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 md:col-span-2">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">INSTITUTIONAL WHY SUMMARY</div>
                      <div className="text-xs text-slate-300 font-mono mt-1 leading-relaxed">
                        {currentRisk.why_text}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Trail Card */}
              {currentRisk && currentRisk.evidence.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <h3 className="text-sm font-bold font-mono text-slate-200 mb-3 flex items-center gap-2">
                    <span>📑</span>
                    <span>CORROBORATING OFFSET EVIDENCE ({currentRisk.evidence.length} MATCHES IN ZONE)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentRisk.evidence.map((ev, i) => (
                      <div key={i} className="bg-slate-950/90 border border-slate-800/90 p-3.5 rounded-xl text-xs font-mono space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-cyan-400 font-bold">{ev.well}</span>
                          <span className="text-slate-400 text-[11px]">{ev.distance} km away · Sim {Math.round(ev.similarity * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {ev.event.replace('_', ' ')}
                          </span>
                          <span className="text-amber-400 font-bold">@ {ev.depth}m</span>
                          <span className="text-slate-400 text-[11px] truncate">({ev.formation})</span>
                        </div>
                        <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed bg-slate-900/60 p-2 rounded border border-slate-800/50">
                          "{ev.snippet}"
                        </p>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>{ev.source_doc}</span>
                          <span className="text-cyan-400 font-bold">Page {ev.page}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <RiskRadar well={selectedWell} assessment={null} />
            </div>
          )}

          {activeTab === 'institutional_memory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold font-mono text-slate-100 flex items-center gap-2">
                    <span>🏛️</span>
                    <span>INSTITUTIONAL MEMORY &amp; EARLY WARNING ALERTS</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Non-negotiable 8-point breakdown: WHY, WHICH WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE DOC+PAGE, SIMILARITY, CONFIDENCE
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                  {alerts.length} ALERTS LOGGED
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.alert_id || (alert as any).id}
                    alert={alert}
                    onAcknowledge={handleAcknowledgeAlert}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'copilot' && (
            <Copilot
              wells={wells}
              selectedWell={selectedWell}
              onSelectWell={setSelectedWell}
            />
          )}

          {activeTab === 'compare' && (
            <CompareWells
              wells={wells}
              initialWellA={selectedWell}
              onClose={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'admin' && <AdminReview />}
        </main>
      </div>

      {/* 4. Evidence Modal */}
      {evidenceModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full">
            <EvidenceViewer
              documentTitle={evidenceModal.title}
              pageNumber={evidenceModal.page}
              excerpt={evidenceModal.excerpt}
              wellName={evidenceModal.wellName}
              onClose={() => setEvidenceModal({ isOpen: false })}
            />
          </div>
        </div>
      )}

      {/* 5. Footer */}
      <footer className="border-t border-slate-800/80 py-3.5 px-6 text-center text-xs font-mono text-slate-500 bg-slate-950">
        NWIS-X © 2026 SIH26121 — Oil India Ltd · Verified PostGIS + pgvector · ⚠️ SIMULATED DATA ONLY
      </footer>
    </div>
  );
}
