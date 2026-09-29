/**
 * App.tsx — BlockLens / OIL eRTMAC-NWIS Operations Console
 * Faithfully mirrors the reference dark-violet/neon-mint BlockLens design.
 */
import React, { useState, useEffect } from 'react';
import {
  Well,
  Alert,
  DrillingEvent,
  CurrentRiskResponse,
  HealthStatus,
  checkHealth,
  getWells,
  getAlerts,
  getEvents,
  getCurrentRisk,
  getRiskBriefPdfUrl,
} from './api/client';
import {
  Settings,
  Bell,
  Hexagon,
  LogOut,
  ChevronDown,
  Download,
} from 'lucide-react';

import { Dashboard } from './components/Dashboard';
import { WellMap } from './components/WellMap';
import { AdminReview } from './components/AdminReview';
import { EvidenceViewer } from './components/EvidenceViewer';
import { DepthCorrelationView } from './components/DepthCorrelationView';
import { AlertDetailModal } from './components/AlertDetailModal';
import { CopilotChat } from './components/CopilotChat';
import { LoginModal, UserProfile } from './components/LoginModal';
import { LoginPage } from './components/LoginPage';
import { LookaheadRadar } from './components/LookaheadRadar';
import { InstitutionalMemory, CompareWells } from './pages';

type NavTab =
  | 'dashboard'
  | 'analytics'
  | 'map'
  | 'stratigraphy'
  | 'memory'
  | 'copilot'
  | 'compare'
  | 'compliance';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('nwis_user');
  });

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wells, setWells] = useState<Well[]>([]);
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentRisk, setCurrentRisk] = useState<CurrentRiskResponse | null>(null);
  const [events, setEvents] = useState<DrillingEvent[]>([]);
  const [currentDepth, setCurrentDepth] = useState<number>(2740.0);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // User Profile
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('nwis_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      username: 'Olivia Brooks',
      role: 'admin',
      full_name: 'Olivia Brooks',
    };
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Evidence modal state
  const [evidenceModal, setEvidenceModal] = useState<{
    isOpen: boolean;
    title?: string;
    page?: number;
    excerpt?: string;
    wellName?: string;
  }>({ isOpen: false });

  const handleOpenEvidence = (title: string, page: number, excerpt: string, wellName: string) => {
    setEvidenceModal({
      isOpen: true,
      title,
      page,
      excerpt,
      wellName,
    });
  };

  // Initial load
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

    const timer = setInterval(() => {
      checkHealth().then(setHealth);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedWell) {
      const wellId = selectedWell.well_id || (selectedWell as any).id;
      getCurrentRisk(wellId, currentDepth).then(setCurrentRisk);
    }
  }, [selectedWell, currentDepth]);

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analytics', label: 'eRTMAC Lookahead' },
    { id: 'map', label: 'CARTO GIS Map' },
    { id: 'stratigraphy', label: 'Depth Stratigraphy' },
    { id: 'memory', label: 'Institutional Memory' },
    { id: 'copilot', label: 'AI Copilot' },
    { id: 'compare', label: 'Compare Offsets' },
  ];

  // If not authenticated, render dedicated enterprise login
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-[#00E599] selection:text-slate-950">
      {/* 1. Top Navbar (Faithful BlockLens Styling) */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
        {/* Left: Neon Mint Diamond Logo + Brand Title */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#00E599]/15 border border-[#00E599]/40 flex items-center justify-center text-[#00E599] shadow-lg shadow-[#00E599]/20 group-hover:scale-105 transition-transform">
            <div className="w-4 h-4 rounded-sm border-2 border-[#00E599] rotate-45 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00E599]" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
              <span>OIL eRTMAC-NWIS</span>
            </span>
          </div>
        </div>

        {/* Center: Floating Dark Capsule Navigation Bar */}
        <nav className="hidden md:flex items-center bg-[#1A1528] border border-white/5 rounded-full p-1 shadow-2xl backdrop-blur-md">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-md scale-100'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Settings, Notifications, and Profile Pill */}
        <div className="flex items-center gap-3">
          {/* Settings Circle Button */}
          <button
            onClick={() => setActiveTab('compliance')}
            className="w-9 h-9 rounded-full bg-[#1A1528] hover:bg-[#251E38] border border-white/5 flex items-center justify-center text-slate-300 transition-colors shadow-sm"
            title="Settings / Compliance"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Notifications Bubble Button */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className="w-9 h-9 rounded-full bg-[#1A1528] hover:bg-[#251E38] border border-white/5 flex items-center justify-center text-slate-300 transition-colors relative shadow-sm"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#00E599] ring-2 ring-[#1A1528]" />
          </button>

          {/* User Profile Pill */}
          <div
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-[#1A1528] hover:bg-[#251E38] border border-white/5 cursor-pointer transition-colors shadow-sm select-none"
            title="Click to Switch User / Role"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
              alt="Avatar"
              className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
            />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white leading-tight font-sans">
                {currentUser.username || 'Executive Engineer'}
              </div>
              <div className="text-[10px] text-slate-400 font-sans font-medium leading-tight">
                OIL India · Admin
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </div>

          {/* Sign Out Shortcut */}
          <button
            onClick={() => {
              localStorage.removeItem('nwis_user');
              setIsAuthenticated(false);
            }}
            className="w-8 h-8 rounded-full bg-[#1A1528] hover:bg-rose-950/60 hover:text-rose-300 border border-white/5 flex items-center justify-center text-slate-400 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Real-Time eRTMAC Operational Context Ribbon */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 mb-3">
        <div className="bg-[#161224]/85 border border-white/5 rounded-2xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-xl text-xs font-sans">
          {/* Active Borehole Context Picker */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Borehole:</span>
            <select
              value={selectedWell?.id || (selectedWell as any)?.well_id || ''}
              onChange={(e) => {
                const found = wells.find((w) => (w.id || w.well_id) === e.target.value);
                if (found) setSelectedWell(found);
              }}
              className="bg-[#1A1528] border border-white/10 text-white font-semibold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#00E599] transition-colors cursor-pointer"
            >
              {wells.map((w) => {
                const wid = w.id || w.well_id;
                return (
                  <option key={wid} value={wid} className="bg-[#161224] text-white">
                    {w.well_name || w.name || w.code} ({w.total_depth_m?.toFixed(0)}m · {w.field_name || 'Assam'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Real-time Telemetry and Risk Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Feed Status */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 text-[#00E599] font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
              <span>eRTMAC WITSML: LIVE (12ms)</span>
            </div>

            {/* Depth & Risk Badge */}
            <div className="hidden sm:flex items-center gap-2 text-slate-300 text-[11px]">
              <span className="text-slate-400">Bit Depth:</span>
              <span className="font-bold text-white tabular-nums">{currentDepth.toFixed(0)} m</span>
              <span className="text-slate-500">·</span>
              <span className="text-cyan-400 font-semibold">Barail Formation (F3)</span>
            </div>

            {/* Quick PDF Export */}
            <button
              onClick={() => {
                if (selectedWell) {
                  const wid = selectedWell.well_id || (selectedWell as any).id;
                  window.open(getRiskBriefPdfUrl(wid), '_blank');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 transition-colors shadow-sm"
              title="Download Offset Well Risk Brief PDF"
            >
              <Download className="w-3 h-3 text-[#00E599]" />
              <span className="font-semibold text-[11px]">Risk Brief PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Navigation Pills */}
      <div className="md:hidden px-4 pb-2">
        <div className="flex overflow-x-auto gap-1 bg-[#1A1528] border border-white/5 p-1 rounded-full text-xs">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1 rounded-full shrink-0 font-medium ${
                  isActive ? 'bg-white text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main View Workspace (Full Width) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
            onSelectAlert={(a) => setSelectedAlert(a)}
            onOpenDepthCorrelation={() => setActiveTab('stratigraphy')}
          />
        )}

        {activeTab === 'analytics' && (
          <LookaheadRadar
            selectedWell={selectedWell}
            currentDepth={currentDepth}
            onDepthChange={(d) => setCurrentDepth(d)}
            onOpenCopilot={(w) => {
              setSelectedWell(w);
              setActiveTab('copilot');
            }}
          />
        )}

        {activeTab === 'map' && (
          <WellMap
            wells={wells}
            selectedWell={selectedWell}
            currentRiskLevel={currentRisk?.risk_level}
            onSelectWell={setSelectedWell}
            onOpenCopilot={(w) => {
              setSelectedWell(w);
              setActiveTab('copilot');
            }}
            onOpenCompare={(w) => {
              setSelectedWell(w);
              setActiveTab('compare');
            }}
          />
        )}

        {activeTab === 'stratigraphy' && (
          <DepthCorrelationView
            well={selectedWell}
            wells={wells}
            initialDepth={currentDepth}
            onDepthChange={(d) => setCurrentDepth(d)}
            onRiskChange={(r) => setCurrentRisk(r)}
            onOpenEvidence={handleOpenEvidence}
          />
        )}

        {activeTab === 'memory' && (
          <InstitutionalMemory
            wells={wells}
            onOpenEvidence={handleOpenEvidence}
          />
        )}

        {activeTab === 'copilot' && (
          <CopilotChat
            wells={wells}
            selectedWell={selectedWell}
            onSelectWell={setSelectedWell}
            onOpenEvidence={handleOpenEvidence}
          />
        )}

        {activeTab === 'compare' && (
          <CompareWells
            wells={wells}
            initialWellA={selectedWell}
            onOpenEvidence={handleOpenEvidence}
            onClose={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'compliance' && <AdminReview />}
      </main>

      {/* 3. Evidence Document Modal */}
      {evidenceModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full">
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

      {/* 4. User Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        currentUser={currentUser}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          localStorage.setItem('nwis_user', JSON.stringify(u));
        }}
        onLogout={() => {
          localStorage.removeItem('nwis_user');
          setIsAuthenticated(false);
          setIsLoginModalOpen(false);
        }}
      />

      {/* 5. Explainability & Risk Alert Detail Modal */}
      <AlertDetailModal
        alert={selectedAlert}
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onOpenEvidence={handleOpenEvidence}
      />
    </div>
  );
}
