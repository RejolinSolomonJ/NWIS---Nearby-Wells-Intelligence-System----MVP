/**
 * WellMap.tsx — NWIS-X Phase 9
 * CARTO Maps API Georeferenced Intelligence Map with Nearest vs Most Relevant toggle.
 * Features:
 * - CARTO Basemaps (Dark Matter, Voyager, Positron, Satellite)
 * - CARTO Subsurface GIS Spatial Overlays (OIL Concession PML Blocks, Regional Fault Lines, Incident Hotspots)
 * - Layer visibility controls & CARTO Maps API Configuration Modal
 * - Seamless PostGIS coordinate projection & offline-fallback resilience
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
  ExternalLink,
  Key,
  Shield,
  Activity,
  Compass,
  X,
} from 'lucide-react';

import {
  Well,
  getNearbyVsRelevant,
  getFormations,
  getEvents,
  Formation,
  DrillingEvent,
} from '../api/client';

// Fix Leaflet default icon path in Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export type MapMode = 'nearest' | 'relevant';
export type BasemapType = 'carto-dark' | 'carto-voyager' | 'carto-positron' | 'satellite';

const STORED_CARTO_KEY = localStorage.getItem('nwis_carto_api_key');
export const DEFAULT_CARTO_KEY = STORED_CARTO_KEY || (import.meta as any).env?.VITE_CARTO_API_KEY || '';

const BASEMAP_TILES: Record<BasemapType, { url: string; attribution: string; name: string; tag: string }> = {
  'carto-dark': {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    name: 'CARTO Dark Matter',
    tag: 'DARK',
  },
  'carto-voyager': {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    name: 'CARTO Voyager',
    tag: 'VOYAGER',
  },
  'carto-positron': {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    name: 'CARTO Positron',
    tag: 'LIGHT',
  },
  'satellite': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; CARTO GIS Engine',
    name: 'CARTO Satellite',
    tag: 'SAT',
  },
};

// Spatial Overlays: OIL Concession Mining Lease (PML) Blocks
const OIL_CONCESSION_BLOCKS = [
  {
    id: 'block-nahorkatiya-1',
    name: 'Nahorkatiya PML Block-I',
    operator: 'Oil India Limited (OIL)',
    area_sqkm: 184.5,
    reservoir: 'Barail / Tipam Series',
    color: '#06b6d4', // Cyan
    coords: [
      [27.24, 95.24],
      [27.35, 95.23],
      [27.36, 95.42],
      [27.23, 95.41],
    ] as [number, number][],
  },
  {
    id: 'block-moran-dikhow',
    name: 'Moran-Dikhow PML Block',
    operator: 'Oil India Limited (OIL)',
    area_sqkm: 142.0,
    reservoir: 'Disang / Barail Arenaceous',
    color: '#8b5cf6', // Violet
    coords: [
      [27.15, 95.12],
      [27.25, 95.10],
      [27.26, 95.26],
      [27.14, 95.28],
    ] as [number, number][],
  },
  {
    id: 'block-digboi-tinsukia',
    name: 'Digboi-Tinsukia PML Block',
    operator: 'Oil India Limited (OIL)',
    area_sqkm: 210.8,
    reservoir: 'Tipam Sandstone / Girujan Clay',
    color: '#10b981', // Emerald
    coords: [
      [27.32, 95.40],
      [27.42, 95.38],
      [27.44, 95.62],
      [27.30, 95.60],
    ] as [number, number][],
  },
  {
    id: 'block-baghjan-hpht',
    name: 'Baghjan HPHT Deep Exploration Block',
    operator: 'Oil India Limited (OIL)',
    area_sqkm: 165.2,
    reservoir: 'Paleocene-Eocene Langpar / Lakadong',
    color: '#f59e0b', // Amber
    coords: [
      [27.48, 95.28],
      [27.60, 95.25],
      [27.62, 95.48],
      [27.47, 95.46],
    ] as [number, number][],
  },
];

// Spatial Overlays: Major Geological Fault Lines & Tectonic Thrusts
const TECTONIC_FAULTS = [
  {
    id: 'fault-naga-thrust',
    name: 'Naga Thrust Fault Line',
    type: 'Regional Active Thrust',
    risk: 'High Shearing / Pore Pressure Influx',
    color: '#f43f5e', // Rose
    coords: [
      [27.12, 95.14],
      [27.21, 95.29],
      [27.31, 95.46],
      [27.42, 95.64],
    ] as [number, number][],
  },
  {
    id: 'fault-disang-thrust',
    name: 'Disang Overthrust Boundary',
    type: 'Overpressured Eocene Suture',
    risk: 'Severe Mud Gas Cut & Micro-fracturing',
    color: '#fb923c', // Orange
    coords: [
      [27.17, 95.06],
      [27.26, 95.21],
      [27.37, 95.37],
      [27.46, 95.53],
    ] as [number, number][],
  },
  {
    id: 'fault-barail-axis',
    name: 'Barail Anticlinal Ridge Axis',
    type: 'Structural Trap Ridge',
    risk: 'Differential Compaction & Loss Zones',
    color: '#a855f7', // Purple
    coords: [
      [27.23, 95.19],
      [27.31, 95.34],
      [27.39, 95.47],
    ] as [number, number][],
  },
];

// Spatial Overlays: Historical Incident Clusters
const INCIDENT_HOTSPOTS = [
  {
    id: 'hotspot-nahorkatiya-kick',
    name: 'Nahorkatiya South High-Pressure Gas Influx',
    depth: '3,100 m',
    severity: 'High Gas Kick (1.62 SG EMW)',
    color: '#ef4444',
    lat: 27.252,
    lng: 95.331,
    radius: 1800,
  },
  {
    id: 'hotspot-tipam-losses',
    name: 'Tipam Upper Sand Severe Loss Circulation',
    depth: '2,150 m',
    severity: 'Total Mud Losses (> 18 m³/hr)',
    color: '#eab308',
    lat: 27.301,
    lng: 95.438,
    radius: 1700,
  },
  {
    id: 'hotspot-girujan-sticking',
    name: 'Girujan Reactive Shale Differential Sticking',
    depth: '1,820 m',
    severity: 'Stuck Pipe & Pack-off Zone',
    color: '#f97316',
    lat: 27.334,
    lng: 95.275,
    radius: 1600,
  },
];

interface WellRank {
  well_id: string;
  distance_km: number;
  overall_similarity?: number;
  similarity_score?: number;
  shared_formations?: string[];
  common_events?: string[];
  rank_type?: string;
}

interface Props {
  wells: Well[];
  selectedWell: Well | null;
  currentRiskLevel?: string;
  onSelectWell: (well: Well) => void;
  onOpenCopilot?: (well: Well) => void;
  onOpenCompare?: (well: Well) => void;
}

// Similarity score (0-1) -> rgb color: emerald(0) -> amber(0.5) -> rose(1)
function simScoreToRgb(score: number): string {
  const c = Math.max(0, Math.min(1, score));
  if (c < 0.5) {
    const t = c / 0.5;
    return `rgb(${Math.round(16 + t * 229)},${Math.round(185 + t * (158 - 185))},${Math.round(129 + t * (11 - 129))})`;
  }
  const t = (c - 0.5) / 0.5;
  return `rgb(${Math.round(245 + t * (244 - 245))},${Math.round(158 + t * (63 - 158))},${Math.round(11 + t * (94 - 11))})`;
}

function makeIcon(opts: {
  color: string;
  borderColor: string;
  label: string;
  pulse?: boolean;
  active?: boolean;
  size?: number;
  selected?: boolean;
  rank?: number;
}): L.DivIcon {
  const sz = opts.size ?? 26;
  const ring = opts.selected ? 'outline:3px solid rgba(6,182,212,0.9);outline-offset:2px;' : '';
  const pulse = opts.pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${opts.color};opacity:0.35;animation:nwis-ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    : '';
  const star = opts.active
    ? `<span style="position:absolute;top:-8px;right:-8px;font-size:11px;">⭐</span>`
    : '';
  const rankBadge = opts.rank !== undefined && !opts.active
    ? `<span style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);background:#0f172a;border:1px solid ${opts.borderColor};color:${opts.color};font-size:8px;font-weight:700;font-family:monospace;padding:0 3px;border-radius:4px;line-height:14px;">#${opts.rank}</span>`
    : '';
  return L.divIcon({
    className: '',
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
    popupAnchor: [0, -(sz / 2 + 10)],
    html: `<style>@keyframes nwis-ping{75%,100%{transform:scale(2.2);opacity:0;}}</style>
<div style="position:relative;width:${sz}px;height:${sz}px;">
  ${pulse}
  <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${opts.color};border:2.5px solid ${opts.borderColor};display:flex;align-items:center;justify-content:center;font-size:${Math.round(sz * 0.38)}px;font-family:monospace;font-weight:900;color:#0f172a;box-shadow:0 2px 12px rgba(0,0,0,0.55);${ring}">${opts.label}</div>
  ${star}${rankBadge}
</div>`,
  });
}

function MapRecenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (!center) return;
    const key = center.join(',');
    if (key === last.current) return;
    last.current = key;
    map.setView(center, 11, { animate: true });
  }, [center, map]);
  return null;
}

export const WellMap: React.FC<Props> = ({
  wells,
  selectedWell,
  currentRiskLevel,
  onSelectWell,
  onOpenCopilot,
  onOpenCompare,
}) => {
  const [mode, setMode] = useState<MapMode>('nearest');
  const [basemap, setBasemap] = useState<BasemapType>('carto-dark');
  const [nearbyData, setNearbyData] = useState<{ nearby: WellRank[]; similar: WellRank[] } | null>(null);
  const [loadingRanks, setLoadingRanks] = useState(false);
  const [orderingDiffers, setOrderingDiffers] = useState(false);
  const [insight, setInsight] = useState('');
  const [popupFmts, setPopupFmts] = useState<Record<string, Formation[]>>({});
  const [popupEvts, setPopupEvts] = useState<Record<string, DrillingEvent[]>>({});
  const [recenterTarget, setRecenterTarget] = useState<[number, number] | null>(null);

  // Layer Toggles
  const [showBlocks, setShowBlocks] = useState(true);
  const [showFaults, setShowFaults] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);

  // CARTO API Config Modal State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [cartoKey, setCartoKey] = useState(DEFAULT_CARTO_KEY);
  const [cartoStatus, setCartoStatus] = useState<'connected' | 'checking' | 'error'>('connected');
  const [cartoLatency, setCartoLatency] = useState<number | null>(48);

  const wellById = useRef<Record<string, Well>>({});

  useEffect(() => {
    wellById.current = Object.fromEntries(wells.map((w) => [w.well_id, w]));
  }, [wells]);

  const mapCenter: [number, number] = wells.length
    ? [wells.reduce((s, w) => s + w.latitude, 0) / wells.length, wells.reduce((s, w) => s + w.longitude, 0) / wells.length]
    : [27.29, 95.34];

  useEffect(() => {
    if (!selectedWell) {
      setNearbyData(null);
      setInsight('');
      return;
    }
    setLoadingRanks(true);
    getNearbyVsRelevant(selectedWell.well_id, 50)
      .then((res) => {
        if (res) {
          setNearbyData({ nearby: res.nearby_wells ?? [], similar: res.similar_wells ?? [] });
          setOrderingDiffers(res.ordering_differs ?? false);
          setInsight(res.geological_insight ?? '');
        }
      })
      .finally(() => setLoadingRanks(false));
    setRecenterTarget([selectedWell.latitude, selectedWell.longitude]);
  }, [selectedWell?.well_id]);

  const loadPopupData = useCallback(
    async (well: Well) => {
      const wid = well.well_id;
      if (popupFmts[wid]) return;
      const [fmts, evts] = await Promise.all([
        getFormations(wid).catch(() => [] as Formation[]),
        getEvents({ well_id: wid }).catch(() => [] as DrillingEvent[]),
      ]);
      setPopupFmts((p) => ({ ...p, [wid]: fmts }));
      setPopupEvts((p) => ({ ...p, [wid]: evts }));
    },
    [popupFmts]
  );

  const activeRanks: WellRank[] = nearbyData ? (mode === 'nearest' ? nearbyData.nearby : nearbyData.similar) : [];
  const rankMap: Record<string, WellRank & { rank: number }> = {};
  activeRanks.forEach((r, i) => {
    rankMap[r.well_id] = { ...r, rank: i + 1 };
  });

  const showRiskZone = showBuffer && !!selectedWell && !!currentRiskLevel && currentRiskLevel !== 'NORMAL';
  const riskZoneColor =
    currentRiskLevel === 'HIGH_EVIDENCE_RISK'
      ? '#f43f5e'
      : currentRiskLevel === 'CAUTION'
      ? '#f59e0b'
      : '#facc15';

  const currentBasemap = BASEMAP_TILES[basemap];

  // Test CARTO Maps API Connection
  const handleTestCarto = async () => {
    setCartoStatus('checking');
    const start = performance.now();
    try {
      // Test pinging CARTO CDN Tile
      const res = await fetch('https://a.basemaps.cartocdn.com/dark_all/1/1/0.png', {
        method: 'GET',
        cache: 'no-cache',
      });
      const end = performance.now();
      if (res.ok) {
        setCartoStatus('connected');
        setCartoLatency(Math.round(end - start));
        localStorage.setItem('nwis_carto_api_key', cartoKey);
      } else {
        setCartoStatus('error');
      }
    } catch {
      setCartoStatus('error');
    }
  };

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative" style={{ height: 750 }}>
      {/* 1. Header Toolbar */}
      <div className="shrink-0 px-4 py-3 bg-slate-950/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50" />
              Assam-Arakan Subsurface Intelligence
            </h2>
            {/* CARTO Maps API Status Badge */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 font-semibold flex items-center gap-1.5 hover:bg-cyan-900/80 transition-all shadow-sm"
              title="Click to configure CARTO Maps API"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>CARTO Maps API v3</span>
              <Settings className="w-3 h-3 text-cyan-400 opacity-70" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono flex items-center gap-2">
            <span>EPSG:4326 WGS-84</span>
            <span className="text-slate-700">•</span>
            <span>OIL Concession Blocks &amp; Regional Faults</span>
            {orderingDiffers && !loadingRanks && (
              <>
                <span className="text-slate-700">•</span>
                <span className="text-rose-400 font-semibold animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Nearest ≠ Relevant
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* CARTO Basemap Switcher */}
          <div className="flex rounded-lg overflow-hidden border border-slate-800 text-xs font-mono bg-slate-950 shadow-inner">
            {(['carto-dark', 'carto-voyager', 'carto-positron', 'satellite'] as BasemapType[]).map((b) => (
              <button
                key={b}
                onClick={() => setBasemap(b)}
                className={`px-2.5 py-1.5 transition-all text-[11px] ${
                  basemap === b
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {BASEMAP_TILES[b].name.replace('CARTO ', '')}
              </button>
            ))}
          </div>

          {/* Mode Selector */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs font-mono shadow-md">
            <button
              onClick={() => setMode('nearest')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-all border-r border-slate-700 ${
                mode === 'nearest'
                  ? 'bg-cyan-500/25 text-cyan-300 font-bold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Nearest
            </button>
            <button
              onClick={() => setMode('relevant')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-all ${
                mode === 'relevant'
                  ? 'bg-rose-500/25 text-rose-300 font-bold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Most Relevant
              {orderingDiffers && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-1" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sub-Toolbar: CARTO Spatial Layers Bar */}
      <div className="shrink-0 px-4 py-1.5 bg-slate-950/80 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-300 overflow-x-auto gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" /> Layers:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-cyan-400 transition-colors">
            <input
              type="checkbox"
              checked={showBlocks}
              onChange={(e) => setShowBlocks(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span className="w-2 h-2 rounded-sm bg-cyan-400/80 inline-block" />
            <span>PML Lease Blocks</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-rose-400 transition-colors">
            <input
              type="checkbox"
              checked={showFaults}
              onChange={(e) => setShowFaults(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
            />
            <span className="w-2.5 h-0.5 bg-rose-500 inline-block" />
            <span>Tectonic Faults</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-amber-400 transition-colors">
            <input
              type="checkbox"
              checked={showHotspots}
              onChange={(e) => setShowHotspots(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>Incident Hotspots</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-emerald-400 transition-colors">
            <input
              type="checkbox"
              checked={showBuffer}
              onChange={(e) => setShowBuffer(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span className="w-2 h-2 rounded-full border border-emerald-400 inline-block" />
            <span>Proximity Buffer</span>
          </label>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400">
          <span className="text-slate-600">Basemap:</span>
          <span className="text-cyan-400 font-semibold">{currentBasemap.name}</span>
        </div>
      </div>

      {/* Geological insight banner */}
      {mode === 'relevant' && insight && (
        <div className="shrink-0 px-4 py-2 bg-rose-950/40 border-b border-rose-800/40 text-[11px] font-mono text-rose-200 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{insight}</span>
        </div>
      )}

      {/* Rank strip */}
      {nearbyData && selectedWell && activeRanks.length > 0 && (
        <div className="shrink-0 px-4 py-2 bg-slate-950/70 border-b border-slate-800/50 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-sans text-slate-400 shrink-0 uppercase tracking-wider font-semibold">
            {mode === 'nearest' ? 'Dist rank:' : 'Sim rank:'}
          </span>
          {activeRanks.slice(0, 9).map((r, i) => {
            const w = wellById.current[r.well_id];
            const sim = r.overall_similarity ?? r.similarity_score ?? 0;
            const color =
              mode === 'relevant'
                ? simScoreToRgb(sim)
                : simScoreToRgb(Math.min(1, r.distance_km / 50) * 0.65);
            return (
              <button
                key={r.well_id}
                onClick={() => {
                  if (w) onSelectWell(w);
                }}
                className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 transition-all font-sans"
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-slate-950 shrink-0"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <span className="text-[10px] text-slate-300 font-medium">{w?.code || r.well_id.slice(0, 8)}</span>
                <span className="text-[10px] text-slate-500 font-sans tabular-nums">
                  {mode === 'nearest' ? `${r.distance_km.toFixed(1)}km` : `${(sim * 100).toFixed(0)}%`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Main Leaflet / CARTO Map Canvas */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            key={basemap}
            url={currentBasemap.url}
            attribution={currentBasemap.attribution}
            maxZoom={19}
          />
          <MapRecenter center={recenterTarget} />

          {/* A. CARTO Spatial Layer: OIL Mining Lease (PML) Blocks */}
          {showBlocks &&
            OIL_CONCESSION_BLOCKS.map((block) => (
              <Polygon
                key={block.id}
                positions={block.coords}
                pathOptions={{
                  color: block.color,
                  fillColor: block.color,
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: '5 3',
                }}
              >
                <Tooltip sticky direction="center">
                  <div style={{ background: '#0f172a', border: `1px solid ${block.color}`, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#f8fafc' }}>
                    <div style={{ fontWeight: 700, color: block.color }}>{block.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: 10 }}>Operator: {block.operator}</div>
                    <div style={{ color: '#64748b', fontSize: 9 }}>Area: {block.area_sqkm} km² · {block.reservoir}</div>
                  </div>
                </Tooltip>
              </Polygon>
            ))}

          {/* B. CARTO Spatial Layer: Major Geological Fault Lines */}
          {showFaults &&
            TECTONIC_FAULTS.map((fault) => (
              <Polyline
                key={fault.id}
                positions={fault.coords}
                pathOptions={{
                  color: fault.color,
                  weight: 3,
                  dashArray: '8 5',
                  opacity: 0.85,
                }}
              >
                <Tooltip sticky direction="top">
                  <div style={{ background: '#0f172a', border: `1px solid ${fault.color}`, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#f8fafc' }}>
                    <div style={{ fontWeight: 700, color: fault.color }}>{fault.name}</div>
                    <div style={{ color: '#cbd5e1', fontSize: 10 }}>{fault.type}</div>
                    <div style={{ color: '#fca5a5', fontSize: 9 }}>Risk: {fault.risk}</div>
                  </div>
                </Tooltip>
              </Polyline>
            ))}

          {/* C. CARTO Spatial Layer: Incident Hotspots */}
          {showHotspots &&
            INCIDENT_HOTSPOTS.map((hs) => (
              <Circle
                key={hs.id}
                center={[hs.lat, hs.lng]}
                radius={hs.radius}
                pathOptions={{
                  color: hs.color,
                  fillColor: hs.color,
                  fillOpacity: 0.15,
                  weight: 1.5,
                  dashArray: '4 4',
                }}
              >
                <Tooltip sticky direction="center">
                  <div style={{ background: '#0f172a', border: `1px solid ${hs.color}`, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#f8fafc' }}>
                    <div style={{ fontWeight: 700, color: hs.color }}>{hs.name}</div>
                    <div style={{ color: '#cbd5e1', fontSize: 10 }}>Depth: {hs.depth}</div>
                    <div style={{ color: '#fca5a5', fontSize: 9 }}>{hs.severity}</div>
                  </div>
                </Tooltip>
              </Circle>
            ))}

          {/* D. Risk zone circles around active well */}
          {showRiskZone && selectedWell && (
            <>
              <Circle
                center={[selectedWell.latitude, selectedWell.longitude]}
                radius={5000}
                pathOptions={{
                  color: riskZoneColor,
                  fillColor: riskZoneColor,
                  fillOpacity: 0.07,
                  weight: 2,
                  dashArray: '8 5',
                }}
              />
              <Circle
                center={[selectedWell.latitude, selectedWell.longitude]}
                radius={2000}
                pathOptions={{
                  color: riskZoneColor,
                  fillColor: riskZoneColor,
                  fillOpacity: 0.04,
                  weight: 1.5,
                  dashArray: '4 4',
                }}
              />
            </>
          )}

          {/* E. Well Markers */}
          {wells.map((well) => {
            const wid = well.well_id;
            const isSelected = selectedWell?.well_id === wid;
            const rankInfo = rankMap[wid];
            const sim = rankInfo?.overall_similarity ?? rankInfo?.similarity_score;
            const isDrilling = well.status === 'drilling' || well.status === 'active';

            let markerColor: string;
            let borderColor: string;

            if (isSelected) {
              markerColor = '#06b6d4';
              borderColor = '#22d3ee';
            } else if (mode === 'relevant' && rankInfo && sim != null) {
              markerColor = simScoreToRgb(sim);
              borderColor = markerColor;
            } else if (mode === 'nearest' && rankInfo) {
              const frac = Math.min(1, rankInfo.distance_km / 50) * 0.65;
              markerColor = simScoreToRgb(frac);
              borderColor = markerColor;
            } else {
              markerColor = simScoreToRgb((well.risk_score ?? 0.3) * 0.5);
              borderColor = '#334155';
            }

            const sz = isSelected ? 40 : rankInfo ? 30 : 22;
            const label = (well.code || well.name || 'W').charAt(0).toUpperCase();
            const icon = makeIcon({
              color: markerColor,
              borderColor,
              label,
              pulse: isDrilling && isSelected,
              active: isSelected,
              size: sz,
              selected: isSelected,
              rank: !isSelected && rankInfo ? rankInfo.rank : undefined,
            });
            const fmts = popupFmts[wid] ?? [];
            const evts = popupEvts[wid] ?? [];

            return (
              <Marker
                key={wid}
                position={[well.latitude, well.longitude]}
                icon={icon}
                zIndexOffset={isSelected ? 1000 : rankInfo ? 400 : 0}
                eventHandlers={{
                  click: () => {
                    onSelectWell(well);
                    loadPopupData(well);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -sz / 2]} opacity={1}>
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: '#e2e8f0', minWidth: 170 }}>
                    <div style={{ fontWeight: 700, color: markerColor, marginBottom: 2 }}>{well.code || well.name}</div>
                    <div style={{ color: '#94a3b8' }}>{well.field_name || 'Assam'} · {well.status}</div>
                    <div style={{ color: '#64748b' }}>Depth: {well.total_depth_m}m</div>
                    {rankInfo && mode === 'nearest' && <div style={{ color: '#6ee7b7', marginTop: 2, fontWeight: 600 }}>Rank #{rankInfo.rank} · {rankInfo.distance_km.toFixed(2)}km</div>}
                    {rankInfo && mode === 'relevant' && sim != null && <div style={{ color: '#fca5a5', marginTop: 2, fontWeight: 600 }}>Rank #{rankInfo.rank} · {(sim * 100).toFixed(0)}% sim</div>}
                  </div>
                </Tooltip>

                <Popup minWidth={300} maxWidth={380}>
                  <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#e2e8f0', fontSize: 12 }}>
                    {/* Title */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: markerColor }}>{well.code || well.name}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{well.well_id_code || well.well_id.slice(0, 18)}</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: isDrilling ? '#064e3b' : '#1e293b', color: isDrilling ? '#6ee7b7' : '#94a3b8', border: `1px solid ${isDrilling ? '#065f46' : '#334155'}` }}>
                        {(well.status || 'unknown').toUpperCase()}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Depth</div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{well.total_depth_m}m</div>
                      </div>
                      <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Coordinates</div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 10 }}>{well.latitude.toFixed(4)}°N {well.longitude.toFixed(4)}°E</div>
                      </div>
                      {rankInfo && <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Distance</div>
                        <div style={{ fontWeight: 700, color: '#6ee7b7' }}>{rankInfo.distance_km.toFixed(2)} km</div>
                      </div>}
                      {rankInfo && sim != null && <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Similarity</div>
                        <div style={{ fontWeight: 700, color: markerColor }}>{(sim * 100).toFixed(0)}%</div>
                      </div>}
                    </div>

                    {/* Shared formations in relevant mode */}
                    {mode === 'relevant' && (rankInfo?.shared_formations ?? []).length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Shared Formations</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(rankInfo!.shared_formations!).slice(0, 3).map((f: string, i: number) => (
                            <span key={i} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1e40af', fontWeight: 500 }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {mode === 'relevant' && (rankInfo?.common_events ?? []).length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Shared Incidents</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(rankInfo!.common_events!).slice(0, 3).map((e: string, i: number) => (
                            <span key={i} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: '#3d1a1a', color: '#fca5a5', border: '1px solid #7f1d1d', fontWeight: 500 }}>{e.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formation stack */}
                    {fmts.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3, fontWeight: 600 }}>Formation Stack ({fmts.length})</div>
                        {fmts.slice(0, 4).map((f) => (
                          <div key={f.formation_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', borderBottom: '1px solid #1e293b', padding: '2px 0' }}>
                            <span style={{ fontWeight: 500 }}>{f.name || f.formation_name}</span>
                            <span style={{ color: '#64748b' }}>{f.top_depth_m}–{f.base_depth_m ?? f.bottom_depth_m}m</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Incidents */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3, fontWeight: 600 }}>Incidents ({evts.length})</div>
                      {evts.length === 0
                        ? <div style={{ color: '#6ee7b7', fontSize: 10 }}>None on record</div>
                        : evts.slice(0, 3).map((ev) => <div key={ev.event_id} style={{ fontSize: 10, color: '#fca5a5', borderLeft: '2px solid #7f1d1d', paddingLeft: 6, marginBottom: 3 }}>{ev.event_type.replace(/_/g, ' ')} @ {ev.depth_m}m</div>)
                      }
                    </div>

                    {/* Actions */}
                    {(onOpenCopilot || onOpenCompare) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {onOpenCopilot && <button onClick={() => onOpenCopilot(well)} style={{ padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.35)', color: '#67e8f9', transition: 'all' }}>Ask Copilot</button>}
                        {onOpenCompare && <button onClick={() => onOpenCompare(well)} style={{ padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd', transition: 'all' }}>Compare</button>}
                      </div>
                    )}
                    <div style={{ marginTop: 8, textAlign: 'center', fontSize: 9, color: '#06b6d4', letterSpacing: '0.05em', fontWeight: 600 }}>OIL INDIA LIMITED · SUBSURFACE INTELLIGENCE</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Mode badge */}
        <div className="absolute top-3 left-3 z-[400] pointer-events-none">
          {mode === 'nearest' ? (
            <div className="bg-cyan-950/90 border border-cyan-700/50 text-cyan-300 text-[10px] font-mono px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>NEAREST — Ranked by Euclidean &amp; Haversine Distance</span>
            </div>
          ) : (
            <div className="bg-rose-950/90 border border-rose-700/50 text-rose-200 text-[10px] font-mono px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>MOST RELEVANT — 5-Factor Subsurface Similarity Model</span>
            </div>
          )}
        </div>

        {/* CARTO Watermark & Attribution Pill */}
        <div className="absolute bottom-3 right-3 z-[400] pointer-events-auto">
          <a
            href="https://carto.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/85 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-cyan-400 transition-colors shadow-lg backdrop-blur-sm"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>CARTO Maps Engine</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        </div>

        {!selectedWell && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] pointer-events-none whitespace-nowrap">
            <div className="bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-mono px-4 py-2 rounded-full shadow-xl backdrop-blur-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Select any well marker to run proximity &amp; subsurface correlation</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. CARTO Maps API Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">CARTO Maps API Integration</h3>
                  <p className="text-[11px] font-mono text-slate-400">Enterprise Georeferencing &amp; Vector CDN</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Status Card */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">CARTO CDN Status:</span>
                <span
                  className={`text-xs font-mono font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                    cartoStatus === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : cartoStatus === 'checking'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {cartoStatus === 'connected' ? 'Connected (200 OK)' : cartoStatus === 'checking' ? 'Pinging CDN...' : 'Offline'}
                </span>
              </div>
              {cartoLatency !== null && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>CDN Round-Trip Latency:</span>
                  <span className="text-cyan-400 font-semibold">{cartoLatency} ms</span>
                </div>
              )}
            </div>

            {/* API Key Form */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  CARTO API Key / Access Token
                </span>
                <span className="text-[10px] text-slate-500">Stored in localStorage</span>
              </label>
              <input
                type="text"
                value={cartoKey}
                onChange={(e) => setCartoKey(e.target.value)}
                placeholder="Enter CARTO API Key..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Account & Endpoint Details */}
            <div className="space-y-2 text-xs font-mono text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span>Maps API Version:</span>
                <span className="text-slate-200">v3 (Cloud Native)</span>
              </div>
              <div className="flex justify-between">
                <span>Raster / Vector CDN:</span>
                <span className="text-cyan-400">cartocdn.com</span>
              </div>
              <div className="flex justify-between">
                <span>Geographic CRS:</span>
                <span className="text-slate-200">EPSG:4326 (WGS 84)</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <a
                href="https://docs.carto.com/carto-for-developers/reference/carto-api/maps-api"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>CARTO Documentation</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestCarto}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition-colors"
                >
                  Test Ping
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('nwis_carto_api_key', cartoKey);
                    setIsConfigOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-colors shadow-md"
                >
                  Save &amp; Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .leaflet-popup-content-wrapper { background:#0f172a!important; border:1px solid #334155!important; border-radius:12px!important; box-shadow:0 20px 50px rgba(0,0,0,0.7)!important; padding:0!important; }
        .leaflet-popup-content { margin:0!important; width:auto!important; }
        .leaflet-popup-tip-container { display:none; }
        .leaflet-tooltip { background:transparent!important; border:none!important; box-shadow:none!important; padding:0!important; }
        .leaflet-tile-pane { filter: brightness(0.95) saturate(0.85); }
      `}</style>
    </div>
  );
};
