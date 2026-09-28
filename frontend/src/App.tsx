import React, { useState, useEffect } from 'react';
import {
  Well,
  DashboardKPIs,
  RiskAssessment,
  Alert,
  fetchKPIs,
  fetchWells,
  fetchRiskAssessment,
  fetchAlerts,
  getWellReportUrl,
} from './api/client';
import { Dashboard } from './components/Dashboard';
import { Map } from './components/Map';
import { RiskRadar } from './components/RiskRadar';
import { CompareWells } from './components/CompareWells';
import { AlertCard } from './components/AlertCard';
import { Copilot } from './components/Copilot';
import { AdminReview } from './components/AdminReview';
import { EvidenceViewer } from './components/EvidenceViewer';

type NavTab = 'dashboard' | 'map' | 'risk' | 'compare' | 'alerts' | 'copilot' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [wells, setWells] = useState<Well[]>([]);
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  // Evidence modal state
  const [evidenceModal, setEvidenceModal] = useState<{
    isOpen: boolean;
    title?: string;
    page?: number;
    excerpt?: string;
    wellName?: string;
  }>({ isOpen: false });

  // Initial load
  useEffect(() => {
    fetchKPIs().then(setKpis);
    fetchWells(1, 50).then((data) => {
      setWells(data.wells);
      if (data.wells.length > 0) {
        setSelectedWell(data.wells[0]);
      }
    });
    fetchAlerts().then(setAlerts);
  }, []);

  // Update risk assessment whenever selectedWell changes
  useEffect(() => {
    if (selectedWell) {
      fetchRiskAssessment(selectedWell.id).then(setAssessment);
    }
  }, [selectedWell]);

  const handleDownloadReport = (well: Well) => {
    const url = getWellReportUrl(well.id);
    window.open(url, '_blank');
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_acknowledged: true, is_read: true } : a))
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Mandatory Simulated Data Banner (SIH26121 Non-Negotiable) */}
      <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 py-1.5 px-4 text-center text-xs font-mono font-semibold flex items-center justify-center gap-2 tracking-wider">
        <span>⚠️</span>
        <span>
          SIMULATED DATA PLATFORM — ALL WELL ATTRIBUTES, INCIDENTS, AND GEOLOGY ARE SYNTHETIC. NO OIL INDIA PROPRIETARY DATA.
        </span>
      </div>

      {/* 2. Top Application Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-bold text-slate-950 text-lg shadow-lg shadow-cyan-500/20">
              NX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-mono tracking-tight text-slate-100">
                  NWIS-X
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  SIH26121 · OIL INDIA LTD
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Nearby Wells Intelligence &amp; Risk eXplorer
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'dashboard' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'map' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🗺️ Spatial Map
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'risk' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎯 Risk Radar
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'compare' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚖️ Well Comparison
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 rounded-lg transition-all relative ${
                activeTab === 'alerts' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🚨 Early Warnings
              {alerts.filter((a) => !a.is_acknowledged).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {alerts.filter((a) => !a.is_acknowledged).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'copilot' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🤖 Copilot
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'admin' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛡️ Audit
            </button>
          </nav>

          {/* Controls: Language toggle & DB/API status */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 hover:text-cyan-300"
            >
              🌐 {lang.toUpperCase()}
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE ENGINE
            </div>
          </div>
        </div>
      </header>

      {/* 3. Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && kpis && (
          <Dashboard
            kpis={kpis}
            wells={wells}
            selectedWell={selectedWell}
            assessment={assessment}
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
            onDownloadReport={handleDownloadReport}
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
            onDownloadReport={handleDownloadReport}
          />
        )}

        {activeTab === 'risk' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <label className="text-xs font-mono text-cyan-400 uppercase font-semibold">
                Select Well for Detailed Deterministic Risk Audit:
              </label>
              <select
                value={selectedWell?.id || ''}
                onChange={(e) => {
                  const found = wells.find((w) => w.id === e.target.value);
                  if (found) setSelectedWell(found);
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
              >
                {wells.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.well_name} ({w.well_id_code}) - {w.field_name}
                  </option>
                ))}
              </select>
            </div>
            <RiskRadar well={selectedWell} assessment={assessment} />
          </div>
        )}

        {activeTab === 'compare' && (
          <CompareWells
            wells={wells}
            initialWellA={selectedWell}
            onClose={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold font-mono text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                Active Early Warning Alerts ({alerts.length})
              </h2>
              <span className="text-xs font-mono text-slate-400">
                Non-Negotiable: WHY, WHICH WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE DOC+PAGE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
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

        {activeTab === 'admin' && <AdminReview />}
      </main>

      {/* 4. Optional Evidence Modal */}
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
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs font-mono text-slate-500 bg-slate-950">
        NWIS-X © 2026 SIH26121 — Oil India Ltd · Built with PostgreSQL 15, PostGIS, pgvector, FastAPI, React 18 &amp; TailwindCSS.
      </footer>
    </div>
  );
}
