/**
 * Dashboard.tsx — eRTMAC-NWIS Executive Operations Dashboard
 * Pure enterprise styling without emojis, perfect pixel alignment, and clean SVG icons.
 * Follows the dark-violet & neon-mint layout with real OIL subsurface intelligence.
 */
import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import {
  ChevronDown,
  Filter,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Compass,
  Zap,
  Droplets,
  AlertTriangle,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { Well, DashboardKPIs, Alert, getRiskBriefPdfUrl } from '../api/client';

interface Props {
  kpis: DashboardKPIs;
  wells: Well[];
  selectedWell: Well | null;
  alerts: Alert[];
  onSelectWell: (well: Well) => void;
  onOpenCopilot: (well: Well) => void;
  onOpenCompare: (well: Well) => void;
  onDownloadReport?: (well: Well) => void;
  onAcknowledgeAlert?: (alertId: string) => void;
  onSelectAlert?: (alert: Alert) => void;
  onOpenDepthCorrelation?: () => void;
}

// Depth & Pressure Gradient Trajectory Data (Real Subsurface Trajectory)
const DEPTH_TRAJECTORY_DATA = [
  { depth: '450m', pressure: 1.05, rop: 18, risk: 10, label: 'Dihing' },
  { depth: '800m', pressure: 1.10, rop: 22, risk: 15, label: 'Alluvium' },
  { depth: '1100m', pressure: 1.15, rop: 16, risk: 24, label: 'Girujan Clay' },
  { depth: '1500m', pressure: 1.18, rop: 19, risk: 28, label: 'Girujan Mid' },
  { depth: '1850m', pressure: 1.22, rop: 14, risk: 36, label: 'Tipam Sand' },
  { depth: '2200m', pressure: 1.24, rop: 15, risk: 42, label: 'Tipam Lower' },
  { depth: '2500m', pressure: 1.28, rop: 12, risk: 58, label: 'Bokabil' },
  { depth: '2740m', pressure: 1.34, rop: 24, risk: 88, label: 'Barail Top' }, // Active bit depth
  { depth: '2950m', pressure: 1.38, rop: 15, risk: 78, label: 'Barail Coal' },
  { depth: '3150m', pressure: 1.45, rop: 11, risk: 85, label: 'Barail Main' },
  { depth: '3350m', pressure: 1.52, rop: 9, risk: 92, label: 'Barail Base' },
  { depth: '3500m', pressure: 1.58, rop: 8, risk: 95, label: 'Kopili Shale' },
  { depth: '3600m', pressure: 1.62, rop: 7, risk: 80, label: 'Sylhet Lime' },
];

// Stratigraphic Thickness Distribution (Donut Chart)
const FORMATION_DONUT_DATA = [
  { name: 'Barail Coal-Shale', value: 1450, color: '#00E599' }, // Neon mint
  { name: 'Tipam Sandstone', value: 1100, color: '#FCD34D' },   // Yellow
  { name: 'Girujan Clay', value: 850, color: '#A78BFA' },       // Purple
  { name: 'Kopili & Sylhet', value: 734, color: '#38BDF8' },    // Cyan
];

// Formation NPT & Loss Rate Data (Bar Chart)
const FORMATION_NPT_DATA = [
  { formation: 'Tipam', nptHours: '300 hrs', value: 300, isPeak: false },
  { formation: 'Bokabil', nptHours: '300 hrs', value: 300, isPeak: false },
  { formation: 'Girujan', nptHours: '400 hrs', value: 400, isPeak: false },
  { formation: 'Kopili', nptHours: '400 hrs', value: 400, isPeak: false },
  { formation: 'Barail', nptHours: '500 hrs', value: 500, isPeak: true },
  { formation: 'Sylhet', nptHours: '400 hrs', value: 400, isPeak: false },
];

export const Dashboard: React.FC<Props> = ({
  wells,
  selectedWell,
  alerts,
  onSelectWell,
  onOpenCopilot,
  onOpenDepthCorrelation,
  onSelectAlert,
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'tipam' | 'barail' | 'kopili'>('barail');
  const [activeTableRange, setActiveTableRange] = useState<'all' | 'critical' | 'caution' | 'advisory'>('all');
  const [selectedField, setSelectedField] = useState<string>('Nahorkatiya PML');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [streamMode, setStreamMode] = useState<string>('live');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Active target well parameters
  const currentWell = selectedWell || wells[0];
  const bitDepth = 2740;
  const targetDepth = currentWell?.total_depth_m || 3600;

  // Filter alerts for the history table
  const filteredAlerts = alerts.filter((a) => {
    if (activeTableRange === 'critical' || selectedSeverityFilter === 'critical') return a.severity === 'critical';
    if (activeTableRange === 'caution' || selectedSeverityFilter === 'caution') return a.severity === 'warning' || a.severity === 'caution';
    return true;
  });

  const handleExportBrief = () => {
    if (!currentWell) return;
    const wellId = currentWell.well_id || (currentWell as any).id;
    setIsExportingPdf(true);
    const pdfUrl = getRiskBriefPdfUrl(wellId);
    window.open(pdfUrl, '_blank');
    setTimeout(() => setIsExportingPdf(false), 1500);
  };

  // 4 Top Mini Offset Wells (matching 2x2 grid in reference image)
  const offsetWellsList = [
    {
      code: 'DEMO-101',
      name: 'Nahorkatiya Exploration',
      field: 'Nahorkatiya PML',
      depth: '3,478 m',
      status: 'Active Rig',
      change: '+1.94%',
      isPositive: true,
      bars: [4, 6, 3, 7, 5, 8, 9],
      iconBg: 'bg-emerald-500/15 text-[#00E599] border border-emerald-500/30',
      icon: Activity,
      wellObj: wells.find((w) => w.code?.includes('101')) || wells[0],
    },
    {
      code: 'DEMO-102',
      name: 'Moran Field Deep',
      field: 'Moran PML',
      depth: '3,739 m',
      status: '92% Sim',
      change: '-1.94%',
      isPositive: false,
      bars: [8, 7, 6, 5, 4, 3, 2],
      iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      icon: Compass,
      wellObj: wells.find((w) => w.code?.includes('102')) || wells[1],
    },
    {
      code: 'DEMO-103',
      name: 'Barail Gas Kick Analogue',
      field: 'South Nahorkatiya',
      depth: '3,574 m',
      status: '1.62 SG Influx',
      change: '+4.26%',
      isPositive: true,
      bars: [3, 5, 6, 7, 8, 9, 10],
      iconBg: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
      icon: Zap,
      wellObj: wells.find((w) => w.code?.includes('103')) || wells[2],
    },
    {
      code: 'DEMO-105',
      name: 'Tipam Severe Loss Analogue',
      field: 'East Tinsukia',
      depth: '3,628 m',
      status: '14 m3/hr Loss',
      change: '-1.94%',
      isPositive: false,
      bars: [9, 7, 8, 6, 5, 4, 5],
      iconBg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
      icon: Droplets,
      wellObj: wells.find((w) => w.code?.includes('105')) || wells[3],
    },
  ];

  return (
    <div className="space-y-6 text-slate-100 font-sans selection:bg-[#00E599] selection:text-slate-950 pb-8">
      {/* 1. Sub-Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5 font-display">
            <span>Real-Time Subsurface Insights</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E599] animate-pulse" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-sans font-normal">
            Stay ahead of operational drilling hazards with eRTMAC-NWIS institutional memory
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 font-sans text-xs">
            {/* Field Filter */}
            <div className="relative">
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="appearance-none pl-3.5 pr-7 py-1.5 rounded-full bg-[#1A1528] hover:bg-[#231D36] border border-white/10 text-slate-200 font-medium transition-colors shadow-sm focus:outline-none focus:border-[#00E599] cursor-pointer text-xs"
              >
                <option value="Nahorkatiya PML" className="bg-[#161224] text-white">Nahorkatiya PML</option>
                <option value="Moran PML" className="bg-[#161224] text-white">Moran PML</option>
                <option value="Dikom PML" className="bg-[#161224] text-white">Dikom PML</option>
                <option value="All PML Blocks" className="bg-[#161224] text-white">All PML Blocks</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Severity Filter */}
            <div className="relative">
              <select
                value={selectedSeverityFilter}
                onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-7 py-1.5 rounded-full bg-[#1A1528] hover:bg-[#231D36] border border-white/10 text-slate-200 font-medium transition-colors shadow-sm focus:outline-none focus:border-[#00E599] cursor-pointer text-xs"
              >
                <option value="all" className="bg-[#161224] text-white">All Severities</option>
                <option value="critical" className="bg-[#161224] text-white">Critical Offsets</option>
                <option value="caution" className="bg-[#161224] text-white">Caution Offsets</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Stream Mode */}
            <div className="relative">
              <select
                value={streamMode}
                onChange={(e) => setStreamMode(e.target.value)}
                className="appearance-none pl-3.5 pr-7 py-1.5 rounded-full bg-[#1A1528] hover:bg-[#231D36] border border-white/10 text-slate-200 font-medium transition-colors shadow-sm focus:outline-none focus:border-[#00E599] cursor-pointer text-xs"
              >
                <option value="live" className="bg-[#161224] text-white">Live WITSML</option>
                <option value="playback" className="bg-[#161224] text-white">10x Playback</option>
                <option value="buffer" className="bg-[#161224] text-white">Simulated Buffer</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={handleExportBrief}
            disabled={isExportingPdf}
            className="text-xs text-[#00E599] hover:underline transition-colors flex items-center gap-1 ml-2 font-sans font-semibold tracking-wide"
          >
            <span>{isExportingPdf ? 'Exporting...' : 'Export Brief'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main 2x2 Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ======================================================== */}
        {/* CARD 1: TOP-LEFT HERO AREA CHART (7 COLUMNS)             */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-[#161224]/95 border border-white/5 rounded-3xl p-6 shadow-2xl relative flex flex-col justify-between backdrop-blur-xl h-[420px]">
          {/* Header of Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display tabular-nums">
                  {bitDepth} m
                </span>
                <span className="text-xs text-slate-400 font-sans font-medium">TD: {targetDepth.toFixed(0)}m</span>
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[#00E599] font-sans mt-0.5 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-ping" />
                <span>Active Drill Bit Depth &middot; {currentWell?.code || 'DEMO-WELL-101'}</span>
              </div>
            </div>

            {/* Timeframe / Depth Horizon Pill Bar */}
            <div className="flex items-center bg-[#1A1528] border border-white/5 rounded-full p-1 text-xs font-sans">
              {(['all', 'tipam', 'barail', 'kopili'] as const).map((sec) => {
                const label = sec === 'all' ? '0-3.6km' : sec === 'tipam' ? 'Tipam' : sec === 'barail' ? 'Barail' : 'Kopili';
                const isActive = activeSection === sec;
                return (
                  <button
                    key={sec}
                    onClick={() => setActiveSection(sec)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#31284A] text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ROP & Torque Secondary Metrics */}
          <div className="flex items-center justify-center gap-8 text-xs font-sans my-2 py-2 bg-[#120E1E]/60 border border-white/5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">ROP:</span>
              <span className="text-white font-bold text-sm tabular-nums">14.5 m/hr</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Torque:</span>
              <span className="text-[#00E599] font-bold text-sm tabular-nums">17.8 kNm</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Pore Pressure:</span>
              <span className="text-amber-400 font-bold text-sm tabular-nums">1.34 SG</span>
            </div>
          </div>

          {/* Area Chart with Floating Tooltip */}
          <div className="h-60 w-full relative">
            {/* Embedded Floating White Tooltip Pill */}
            <div className="absolute top-12 left-1/2 -translate-x-10 z-20 pointer-events-none">
              <div className="bg-white text-slate-950 px-3.5 py-1.5 rounded-xl shadow-2xl text-[11px] font-sans border border-slate-200 flex flex-col items-center">
                <span className="font-bold text-slate-900">Bit Depth: 2,740 m</span>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 font-sans">
                  <span>Pore Pressure: 1.34 SG</span>
                  <TrendingUp className="w-2.5 h-2.5" />
                </span>
                {/* Pointer beak */}
                <div className="w-2.5 h-2.5 bg-white transform rotate-45 -mb-2 mt-1 shadow-sm" />
              </div>
              {/* Glowing anchor pulse */}
              <div className="w-3.5 h-3.5 rounded-full bg-[#00E599] border-2 border-white shadow-lg shadow-[#00E599] mx-auto mt-2 animate-pulse" />
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DEPTH_TRAJECTORY_DATA} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="emeraldSubsurfaceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E599" stopOpacity={0.45} />
                    <stop offset="70%" stopColor="#00E599" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#00E599" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="depth"
                  stroke="#5A5474"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#2A233C', strokeWidth: 1 }}
                />
                <YAxis
                  stroke="#5A5474"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <Area
                  type="monotone"
                  dataKey="risk"
                  stroke="#00E599"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#emeraldSubsurfaceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 2: TOP-RIGHT ASSET DONUT + 2x2 MINI GRID (5 COLS)   */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-[#161224]/95 border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row gap-4 backdrop-blur-xl h-[420px]">
          {/* Left Donut Overview Section */}
          <div className="sm:w-1/2 flex flex-col justify-between p-2">
            <div>
              <h3 className="text-sm font-bold text-white mb-0.5 font-display">Formation Overview</h3>
              <p className="text-[11px] text-slate-400 font-sans">Assam-Arakan Lithology</p>
            </div>

            {/* Circular Donut Canvas */}
            <div className="relative h-44 w-full flex items-center justify-center my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={FORMATION_DONUT_DATA}
                    innerRadius={50}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {FORMATION_DONUT_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-white tracking-tight font-display tabular-nums">4,134</span>
                <span className="text-[10px] text-slate-400 font-medium font-sans">Of 4,377 m Logged</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 mt-2 font-sans">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00E599]" />
                <span className="text-slate-300 font-medium truncate">Barail</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FCD34D]" />
                <span className="text-slate-300 font-medium truncate">Tipam</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
                <span className="text-slate-300 font-medium truncate">Girujan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                <span className="text-slate-300 font-medium truncate">Kopili</span>
              </div>
            </div>
          </div>

          {/* Right 2x2 Mini Offset Well Grid */}
          <div className="sm:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:border-l sm:border-white/5 sm:pl-3">
            {offsetWellsList.map((asset, i) => {
              const IconComp = asset.icon;
              return (
                <div
                  key={i}
                  onClick={() => asset.wellObj && onSelectWell(asset.wellObj)}
                  className="bg-[#1C172E] border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:border-[#00E599]/40 cursor-pointer transition-all hover:scale-[1.02] shadow-sm font-sans"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${asset.iconBg}`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white leading-tight truncate">{asset.code}</div>
                      <div className="text-[10px] text-slate-400 truncate">{asset.field}</div>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="text-sm font-extrabold text-white tracking-tight font-display tabular-nums">{asset.depth}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span
                        className={`text-[10px] font-semibold flex items-center gap-1 ${
                          asset.isPositive ? 'text-[#00E599]' : 'text-amber-400'
                        }`}
                      >
                        {asset.isPositive ? (
                          <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        <span>{asset.status}</span>
                      </span>

                      {/* Mini SVG Sparkline Bars */}
                      <div className="flex items-end gap-0.5 h-3">
                        {asset.bars.map((b, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${b * 10}%` }}
                            className={`w-0.5 rounded-full ${asset.isPositive ? 'bg-[#00E599]' : 'bg-amber-400'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 3: BOTTOM-LEFT MARKETS HISTORY TABLE (7 COLS)       */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-[#161224]/95 border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-xl h-[440px] flex flex-col justify-between">
          {/* Header of Table */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-base font-bold text-white font-display">Offset Incidents &amp; Early Warnings</h3>
              <p className="text-[11px] text-[#00E599] font-medium flex items-center gap-1.5 mt-0.5 font-sans">
                <TrendingUp className="w-3 h-3 text-[#00E599]" />
                <span className="font-semibold">+6.14%</span>
                <span className="text-slate-400 font-normal">Multi-Vector Corroboration Index</span>
              </p>
            </div>

            {/* Severity pill tabs */}
            <div className="flex items-center bg-[#1A1528] border border-white/5 rounded-full p-1 text-xs font-sans">
              {(['all', 'critical', 'caution', 'advisory'] as const).map((r) => {
                const isActive = activeTableRange === r;
                return (
                  <button
                    key={r}
                    onClick={() => setActiveTableRange(r)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                      isActive
                        ? 'bg-[#31284A] text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-white/5 text-[11px] text-slate-400 font-medium tracking-wide">
                  <th className="pb-2.5 font-medium w-8">#</th>
                  <th className="pb-2.5 font-medium">Hazard &amp; Offset Well</th>
                  <th className="pb-2.5 font-medium w-36">Formation</th>
                  <th className="pb-2.5 font-medium w-28">Severity</th>
                  <th className="pb-2.5 font-medium w-20 text-right">Similarity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAlerts.slice(0, 5).map((alt, idx) => {
                  const isCrit = alt.severity === 'critical';
                  const simPct = Math.round((alt.similarity_score ?? 0.88) * 100);
                  const IconComp = isCrit ? Zap : alt.severity === 'warning' ? Droplets : Layers;
                  const iconBg = isCrit
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30';

                  return (
                    <tr
                      key={alt.id || alt.alert_id}
                      onClick={() => onSelectAlert?.(alt)}
                      className="hover:bg-white/[0.04] cursor-pointer transition-colors group"
                      title="Click to view full Risk Explainability & Source Evidence"
                    >
                      <td className="py-3 text-slate-400 font-mono text-[11px]">0{idx + 1}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${iconBg}`}>
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white text-xs truncate max-w-[210px]">{alt.title}</div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              <span className="font-medium text-slate-300">{alt.related_well_ids?.[0] || 'DEMO-WELL-103'}</span> &middot; {alt.depth_m || 2780}m
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-300 font-sans text-xs font-medium">
                        {alt.formation_name || 'Barail Coal-Shale'}
                      </td>
                      <td className="py-3">
                        <span
                          className={`font-semibold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full ${
                            isCrit
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isCrit ? 'CRITICAL' : 'CAUTION'}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[#00E599] font-sans font-bold tabular-nums">
                        {simPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 4: BOTTOM-RIGHT TOP REVENUE BAR CHART (5 COLS)      */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-[#161224]/95 border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col justify-between backdrop-blur-xl h-[440px]">
          {/* Header of Bar Chart Card */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">
                Historical NPT &amp; Loss Density
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-white tracking-tight font-display tabular-nums">3,200 hrs</span>
                <span className="text-[10px] font-semibold text-[#00E599] flex items-center gap-1 bg-[#00E599]/10 px-2 py-0.5 rounded-full font-sans border border-[#00E599]/20">
                  <TrendingUp className="w-2.5 h-2.5" />
                  <span>+1.52%</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-sans text-xs">
              <div className="relative">
                <select
                  value={currentWell?.id || (currentWell as any)?.well_id || ''}
                  onChange={(e) => {
                    const found = wells.find((w) => (w.id || w.well_id) === e.target.value);
                    if (found) onSelectWell(found);
                  }}
                  className="appearance-none pl-3 pr-6 py-1.5 rounded-full bg-[#1A1528] border border-white/10 text-slate-300 font-medium hover:bg-[#231D36] transition-colors cursor-pointer text-xs focus:outline-none focus:border-[#00E599]"
                >
                  <option value="" className="bg-[#161224] text-white">All Wells</option>
                  {wells.map((w) => {
                    const wid = w.id || w.well_id;
                    return (
                      <option key={wid} value={wid} className="bg-[#161224] text-white">
                        {w.code || w.name}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button
                onClick={() => onOpenDepthCorrelation?.()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1A1528] border border-white/5 text-slate-300 font-medium hover:bg-[#231D36] transition-colors"
                title="Open Depth Stratigraphy Correlation"
              >
                <span>Filter</span>
                <Filter className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Glowing Green Bar Chart */}
          <div className="h-64 w-full relative mt-auto">
            {/* Floating Top Peak Badge */}
            <div className="absolute top-0 right-1/4 translate-x-2 z-10 pointer-events-none">
              <div className="bg-[#00E599] text-slate-950 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full shadow-lg shadow-[#00E599]/40 font-sans tracking-wide">
                500 hrs
              </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FORMATION_NPT_DATA} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwisBarGreenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E599" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0F382A" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="nwisBarPeakGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FFB2" stopOpacity={1} />
                    <stop offset="100%" stopColor="#125940" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="formation"
                  stroke="#5A5474"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  barSize={38}
                  fill="url(#nwisBarGreenGradient)"
                >
                  {FORMATION_NPT_DATA.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.isPeak ? 'url(#nwisBarPeakGradient)' : 'url(#nwisBarGreenGradient)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
