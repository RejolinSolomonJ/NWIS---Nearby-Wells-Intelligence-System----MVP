
/**
 * WellMap.tsx — NWIS-X Phase 9
 * react-leaflet map with Nearest vs Most Relevant toggle.
 * Key differentiation: F3-cluster wells highlighted as "relevant" even if not nearest.
 * WARNING: SIMULATED DATA — NOT OIL INDIA DATA
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  color: string; borderColor: string; label: string;
  pulse?: boolean; active?: boolean; size?: number;
  selected?: boolean; rank?: number;
}): L.DivIcon {
  const sz = opts.size ?? 26;
  const ring = opts.selected ? 'outline:3px solid rgba(6,182,212,0.8);outline-offset:2px;' : '';
  const pulse = opts.pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${opts.color};opacity:0.35;animation:nwis-ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    : '';
  const star = opts.active
    ? `<span style="position:absolute;top:-8px;right:-8px;font-size:11px;">&#11088;</span>`
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
  <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${opts.color};border:2.5px solid ${opts.borderColor};display:flex;align-items:center;justify-content:center;font-size:${Math.round(sz*0.38)}px;font-family:monospace;font-weight:900;color:#0f172a;box-shadow:0 2px 12px rgba(0,0,0,0.55);${ring}">${opts.label}</div>
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
  wells, selectedWell, currentRiskLevel,
  onSelectWell, onOpenCopilot, onOpenCompare,
}) => {
  const [mode, setMode] = useState<MapMode>('nearest');
  const [nearbyData, setNearbyData] = useState<{ nearby: WellRank[]; similar: WellRank[] } | null>(null);
  const [loadingRanks, setLoadingRanks] = useState(false);
  const [orderingDiffers, setOrderingDiffers] = useState(false);
  const [insight, setInsight] = useState('');
  const [popupFmts, setPopupFmts] = useState<Record<string, Formation[]>>({});
  const [popupEvts, setPopupEvts] = useState<Record<string, DrillingEvent[]>>({});
  const [recenterTarget, setRecenterTarget] = useState<[number, number] | null>(null);
  const wellById = useRef<Record<string, Well>>({});

  useEffect(() => {
    wellById.current = Object.fromEntries(wells.map((w) => [w.well_id, w]));
  }, [wells]);

  const mapCenter: [number, number] = wells.length
    ? [wells.reduce((s, w) => s + w.latitude, 0) / wells.length, wells.reduce((s, w) => s + w.longitude, 0) / wells.length]
    : [26.9, 94.7];

  useEffect(() => {
    if (!selectedWell) { setNearbyData(null); setInsight(''); return; }
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

  const loadPopupData = useCallback(async (well: Well) => {
    const wid = well.well_id;
    if (popupFmts[wid]) return;
    const [fmts, evts] = await Promise.all([
      getFormations(wid).catch(() => [] as Formation[]),
      getEvents({ well_id: wid }).catch(() => [] as DrillingEvent[]),
    ]);
    setPopupFmts((p) => ({ ...p, [wid]: fmts }));
    setPopupEvts((p) => ({ ...p, [wid]: evts }));
  }, [popupFmts]);

  const activeRanks: WellRank[] = nearbyData ? (mode === 'nearest' ? nearbyData.nearby : nearbyData.similar) : [];
  const rankMap: Record<string, WellRank & { rank: number }> = {};
  activeRanks.forEach((r, i) => { rankMap[r.well_id] = { ...r, rank: i + 1 }; });

  const showRiskZone = !!selectedWell && !!currentRiskLevel && currentRiskLevel !== 'NORMAL';
  const riskZoneColor = currentRiskLevel === 'HIGH_EVIDENCE_RISK' ? '#f43f5e' : currentRiskLevel === 'CAUTION' ? '#f59e0b' : '#facc15';

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl" style={{ height: 700 }}>

      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Assam-Arakan Geospatial Intelligence Map
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            PostGIS georeferenced · <span className="text-amber-400 font-semibold">⚠️ SIMULATED DATA</span>
            {orderingDiffers && !loadingRanks && (
              <span className="ml-2 text-rose-400 font-semibold animate-pulse">⚡ Nearest ≠ Most Relevant — toggle!</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs font-mono shadow-lg">
            <button
              onClick={() => setMode('nearest')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-all border-r border-slate-700 ${mode === 'nearest' ? 'bg-cyan-500/25 text-cyan-300 font-bold' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'}`}
            >
              📍 Nearest Wells
            </button>
            <button
              onClick={() => setMode('relevant')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-all ${mode === 'relevant' ? 'bg-rose-500/25 text-rose-300 font-bold' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'}`}
            >
              🧠 Most Relevant
              {orderingDiffers && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-1" />}
            </button>
          </div>
          {loadingRanks && <span className="text-[11px] font-mono text-slate-400 animate-pulse">Computing…</span>}
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            {mode === 'nearest' ? (
              <>
                <span className="text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" />Low</span>
                <span className="text-amber-400 flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block" />Med</span>
                <span className="text-rose-400 flex items-center gap-1"><span className="w-2 h-2 bg-rose-500 rounded-full inline-block" />High</span>
              </>
            ) : (
              <>
                <span className="text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" />Low sim</span>
                <span className="text-amber-400 flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block" />Med sim</span>
                <span className="text-rose-400 flex items-center gap-1"><span className="w-2 h-2 bg-rose-500 rounded-full inline-block" />High sim</span>
                <span className="text-cyan-400">· ⭐ Active</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Geological insight banner */}
      {mode === 'relevant' && insight && (
        <div className="shrink-0 px-4 py-2 bg-rose-950/40 border-b border-rose-800/40 text-[11px] font-mono text-rose-200 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">🔬</span>
          <span className="leading-relaxed">{insight}</span>
        </div>
      )}

      {/* Rank strip */}
      {nearbyData && selectedWell && activeRanks.length > 0 && (
        <div className="shrink-0 px-4 py-2 bg-slate-950/70 border-b border-slate-800/50 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono text-slate-500 shrink-0 uppercase tracking-wider">
            {mode === 'nearest' ? '📍 Dist rank:' : '🧠 Sim rank:'}
          </span>
          {activeRanks.slice(0, 9).map((r, i) => {
            const w = wellById.current[r.well_id];
            const sim = r.overall_similarity ?? r.similarity_score ?? 0;
            const color = mode === 'relevant' ? simScoreToRgb(sim) : simScoreToRgb(Math.min(1, r.distance_km / 50) * 0.65);
            return (
              <button key={r.well_id} onClick={() => { if (w) onSelectWell(w); }}
                className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 transition-all">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-slate-950 shrink-0" style={{ background: color }}>{i + 1}</span>
                <span className="text-[10px] font-mono text-slate-300">{w?.code || r.well_id.slice(0, 8)}</span>
                <span className="text-[10px] font-mono text-slate-500">{mode === 'nearest' ? `${r.distance_km.toFixed(1)}km` : `${(sim * 100).toFixed(0)}%`}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            maxZoom={19}
          />
          <MapRecenter center={recenterTarget} />

          {/* Risk zone circles */}
          {showRiskZone && selectedWell && (
            <>
              <Circle center={[selectedWell.latitude, selectedWell.longitude]} radius={5000} pathOptions={{ color: riskZoneColor, fillColor: riskZoneColor, fillOpacity: 0.07, weight: 2, dashArray: '8 5' }} />
              <Circle center={[selectedWell.latitude, selectedWell.longitude]} radius={2000} pathOptions={{ color: riskZoneColor, fillColor: riskZoneColor, fillOpacity: 0.04, weight: 1.5, dashArray: '4 4' }} />
            </>
          )}

          {/* Markers */}
          {wells.map((well) => {
            const wid = well.well_id;
            const isSelected = selectedWell?.well_id === wid;
            const rankInfo = rankMap[wid];
            const sim = rankInfo?.overall_similarity ?? rankInfo?.similarity_score;
            const isDrilling = well.status === 'drilling' || well.status === 'active';

            let markerColor: string;
            let borderColor: string;

            if (isSelected) {
              markerColor = '#06b6d4'; borderColor = '#22d3ee';
            } else if (mode === 'relevant' && rankInfo && sim != null) {
              markerColor = simScoreToRgb(sim); borderColor = markerColor;
            } else if (mode === 'nearest' && rankInfo) {
              const frac = Math.min(1, rankInfo.distance_km / 50) * 0.65;
              markerColor = simScoreToRgb(frac); borderColor = markerColor;
            } else {
              // Unranked: small, grey-green
              markerColor = simScoreToRgb((well.risk_score ?? 0.3) * 0.5);
              borderColor = '#334155';
            }

            const sz = isSelected ? 40 : rankInfo ? 30 : 22;
            const label = (well.code || well.name || 'W').charAt(0).toUpperCase();
            const icon = makeIcon({ color: markerColor, borderColor, label, pulse: isDrilling && isSelected, active: isSelected, size: sz, selected: isSelected, rank: !isSelected && rankInfo ? rankInfo.rank : undefined });
            const fmts = popupFmts[wid] ?? [];
            const evts = popupEvts[wid] ?? [];

            return (
              <Marker key={wid} position={[well.latitude, well.longitude]} icon={icon}
                zIndexOffset={isSelected ? 1000 : rankInfo ? 400 : 0}
                eventHandlers={{ click: () => { onSelectWell(well); loadPopupData(well); } }}>

                <Tooltip direction="top" offset={[0, -sz / 2]} opacity={1}>
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0', minWidth: 170 }}>
                    <div style={{ fontWeight: 700, color: markerColor, marginBottom: 2 }}>{well.code || well.name}</div>
                    <div style={{ color: '#94a3b8' }}>{well.field_name || 'Assam'} · {well.status}</div>
                    <div style={{ color: '#64748b' }}>Depth: {well.total_depth_m}m</div>
                    {rankInfo && mode === 'nearest' && <div style={{ color: '#6ee7b7', marginTop: 2 }}>📍 #{rankInfo.rank} · {rankInfo.distance_km.toFixed(2)}km</div>}
                    {rankInfo && mode === 'relevant' && sim != null && <div style={{ color: '#fca5a5', marginTop: 2 }}>🧠 #{rankInfo.rank} · {(sim * 100).toFixed(0)}% sim</div>}
                  </div>
                </Tooltip>

                <Popup minWidth={300} maxWidth={380}>
                  <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, fontFamily: 'sans-serif', color: '#e2e8f0', fontSize: 12 }}>
                    {/* Title */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: markerColor, fontFamily: 'monospace' }}>{well.code || well.name}</div>
                        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 1 }}>{well.well_id_code || well.well_id.slice(0, 18)}</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: isDrilling ? '#064e3b' : '#1e293b', color: isDrilling ? '#6ee7b7' : '#94a3b8', border: `1px solid ${isDrilling ? '#065f46' : '#334155'}` }}>
                        {(well.status || 'unknown').toUpperCase()}
                      </span>
                    </div>
                    {/* Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>Total Depth</div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>{well.total_depth_m}m</div>
                      </div>
                      <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>Coordinates</div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace', fontSize: 10 }}>{well.latitude.toFixed(4)}°N {well.longitude.toFixed(4)}°E</div>
                      </div>
                      {rankInfo && <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>Distance</div>
                        <div style={{ fontWeight: 700, color: '#6ee7b7', fontFamily: 'monospace' }}>{rankInfo.distance_km.toFixed(2)} km</div>
                      </div>}
                      {rankInfo && sim != null && <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px' }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>Similarity</div>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace', color: markerColor }}>{(sim * 100).toFixed(0)}%</div>
                      </div>}
                    </div>

                    {/* Shared formations in relevant mode */}
                    {mode === 'relevant' && (rankInfo?.shared_formations ?? []).length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>🏔 Shared Formations</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(rankInfo!.shared_formations!).slice(0, 3).map((f: string, i: number) => (
                            <span key={i} style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1e40af', fontFamily: 'monospace' }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {mode === 'relevant' && (rankInfo?.common_events ?? []).length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>⚠️ Shared Incidents</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(rankInfo!.common_events!).slice(0, 3).map((e: string, i: number) => (
                            <span key={i} style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, background: '#3d1a1a', color: '#fca5a5', border: '1px solid #7f1d1d', fontFamily: 'monospace' }}>{e.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formation stack from API */}
                    {fmts.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 3 }}>📋 Formation Stack ({fmts.length})</div>
                        {fmts.slice(0, 4).map((f) => (
                          <div key={f.formation_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace', color: '#cbd5e1', borderBottom: '1px solid #1e293b', padding: '2px 0' }}>
                            <span>{f.name || f.formation_name}</span>
                            <span style={{ color: '#64748b' }}>{f.top_depth_m}–{f.base_depth_m ?? f.bottom_depth_m}m</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Incidents */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 3 }}>🚨 Incidents ({evts.length})</div>
                      {evts.length === 0
                        ? <div style={{ color: '#6ee7b7', fontSize: 10, fontFamily: 'monospace' }}>None on record</div>
                        : evts.slice(0, 3).map((ev) => <div key={ev.event_id} style={{ fontSize: 10, fontFamily: 'monospace', color: '#fca5a5', borderLeft: '2px solid #7f1d1d', paddingLeft: 6, marginBottom: 3 }}>{ev.event_type.replace(/_/g, ' ')} @ {ev.depth_m}m</div>)
                      }
                    </div>

                    {/* Actions */}
                    {(onOpenCopilot || onOpenCompare) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {onOpenCopilot && <button onClick={() => onOpenCopilot(well)} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.35)', color: '#67e8f9' }}>🤖 Ask Copilot</button>}
                        {onOpenCompare && <button onClick={() => onOpenCompare(well)} style={{ padding: '5px 0', borderRadius: 7, fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd' }}>⚖️ Compare</button>}
                      </div>
                    )}
                    <div style={{ marginTop: 8, textAlign: 'center', fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>⚠️ SIMULATED DATA — NOT OIL INDIA DATA</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Mode badge */}
        <div className="absolute top-3 left-3 z-[400] pointer-events-none">
          {mode === 'nearest'
            ? <div className="bg-cyan-950/90 border border-cyan-700/50 text-cyan-300 text-[10px] font-mono px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-sm">📍 NEAREST — ranked by distance</div>
            : <div className="bg-rose-950/90 border border-rose-700/50 text-rose-200 text-[10px] font-mono px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-sm">🧠 MOST RELEVANT — 5-factor similarity · F3-cluster prioritised</div>
          }
        </div>

        {!selectedWell && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] pointer-events-none whitespace-nowrap">
            <div className="bg-slate-900/90 border border-slate-700 text-slate-400 text-xs font-mono px-4 py-2 rounded-full shadow-lg backdrop-blur-sm">
              Click any well marker ▸ then toggle Nearest ↔ Relevant to see the difference
            </div>
          </div>
        )}
      </div>

      <style>{`
        .leaflet-popup-content-wrapper { background:#0f172a!important; border:1px solid #334155!important; border-radius:12px!important; box-shadow:0 20px 50px rgba(0,0,0,0.7)!important; padding:0!important; }
        .leaflet-popup-content { margin:0!important; width:auto!important; }
        .leaflet-popup-tip-container { display:none; }
        .leaflet-tooltip { background:transparent!important; border:none!important; box-shadow:none!important; padding:0!important; }
        .leaflet-tile-pane { filter: brightness(0.9) saturate(0.75); }
      `}</style>
    </div>
  );
};

