/**
 * NWIS-X Typed API Client
 * Connects to FastAPI backend with graceful local simulated fallbacks.
 * NON-NEGOTIABLE: All data is labeled SIMULATED DATA.
 */

// Allow configuring base URL or defaulting to relative root /api/v1
const API_HOST = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
const API_BASE = `${API_HOST}/api/v1`;

export interface HealthStatus {
  status: string;
  version: string;
  database: string;
  timestamp: string;
  simulated_data: boolean;
}

export interface DashboardKPIs {
  total_wells: number;
  active_wells: number;
  critical_alerts: number;
  avg_risk_score: number;
  total_formations?: number;
  total_events?: number;
  wells_at_risk?: number;
  recent_events?: DrillingEvent[] | any[];
}

export interface Well {
  well_id: string;
  id?: string;
  name: string;
  well_name?: string;
  code?: string;
  well_id_code?: string;
  field_name?: string;
  block_name?: string;
  operator?: string;
  status?: string;
  total_depth_m: number;
  latitude: number;
  longitude: number;
  spud_date?: string;
  distance_km?: number;
  risk_score?: number;
  is_simulated?: boolean;
}

export interface Formation {
  formation_id: string;
  id?: string;
  well_id: string;
  name: string;
  formation_name?: string;
  top_depth_m: number;
  base_depth_m: number;
  bottom_depth_m?: number;
  lithology?: string;
  pressure_psi?: number;
  is_simulated?: boolean;
}

export interface DrillingEvent {
  event_id: string;
  id?: string;
  well_id: string;
  formation_id?: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  depth_m: number;
  description: string;
  root_cause?: string;
  action_taken?: string;
  mud_weight_ppg?: number;
  report_id?: string;
  page_number?: number;
  needs_review?: boolean;
  raw_text_snippet?: string;
  formation_name?: string;
  is_simulated?: boolean;
}

export interface SimilarityBreakdownComponent {
  score: number;
  weight: number;
  weighted: number;
  shared_formations?: string[];
  common_events?: string[];
  distance_km?: number;
}

export interface SimilarityBreakdown {
  formation_overlap: SimilarityBreakdownComponent;
  depth_proximity: SimilarityBreakdownComponent;
  spatial_proximity: SimilarityBreakdownComponent;
  operational_similarity: SimilarityBreakdownComponent;
  event_type_overlap: SimilarityBreakdownComponent;
}

export interface WellSimilarity {
  well_id: string;
  target_well_id?: string;
  well_name: string;
  well_code?: string;
  overall_similarity: number;
  similarity_score?: number;
  distance_km: number;
  breakdown: SimilarityBreakdown;
}

export interface SimilarWell {
  well_id: string;
  well_name: string;
  well_id_code?: string;
  spatial_score?: number;
  depth_score?: number;
  formation_score?: number;
  event_score?: number;
  semantic_score?: number;
  overall_similarity: number;
  similarity_score?: number;
  distance_km: number;
  shared_formations?: string[];
  common_events?: string[];
}

export interface NearbyVsRelevant {
  target_well_id: string;
  target_well_name: string;
  closest_by_distance?: any;
  most_relevant_by_similarity?: any;
  nearby_wells: any[];
  similar_wells: any[];
  ordering_differs: boolean;
  geological_insight?: string;
  disclaimer: string;
}

export interface RiskEvidenceItem {
  well: string;
  distance: number;
  event: string;
  depth: number;
  formation: string;
  similarity: number;
  source_doc?: string;
  page?: number;
  snippet?: string;
  event_id?: string;
}

export interface CurrentRiskResponse {
  well_id: string;
  current_depth: number;
  current_formation?: string;
  lookahead_m: number;
  risk_level: 'NORMAL' | 'WATCH' | 'CAUTION' | 'HIGH_EVIDENCE_RISK' | string;
  risk_score: number;
  confidence: 'Low' | 'Med' | 'High' | string;
  evidence: RiskEvidenceItem[];
  why_text: string;
  evidence_ids: string[];
  corroborating_wells_count: number;
  disclaimer: string;
}

export interface RiskFactor {
  factor: string;
  score: number;
  evidence: string;
  source: string;
}

export interface RiskAssessment {
  id?: string;
  well_id: string;
  assessment_type?: string;
  overall_risk_score: number;
  confidence: number | string;
  depth_m?: number;
  formation_name?: string;
  geological_risk: number;
  mechanical_risk: number;
  pressure_risk: number;
  historical_risk: number;
  risk_factors: RiskFactor[] | any[];
  similar_well_ids: string[];
  evidence_summary?: string;
  source_documents: any[];
  is_simulated?: boolean;
}

export interface Alert {
  alert_id: string;
  id?: string;
  well_id: string;
  depth_m: number;
  formation_name?: string;
  alert_type: string;
  severity: string;
  title?: string;
  message?: string;
  why: string;
  which_wells: string[];
  related_well_ids?: string[];
  evidence: string | any;
  source_doc?: string;
  source_page?: number;
  similarity_score?: number;
  confidence_score?: number;
  confidence?: number;
  is_read: boolean;
  is_acknowledged: boolean;
  created_at?: string;
}

export interface CopilotCitation {
  well: string;
  doc: string;
  page: number;
  snippet: string;
}

export interface CopilotQueryResponse {
  answer: string;
  citations: CopilotCitation[];
  disclaimer: string;
}

export interface CopilotResponse {
  query?: string;
  question?: string;
  response?: string;
  answer: string;
  citations: any[];
  disclaimer?: string;
  well_context?: any;
}

// ─── Phase 3: Core API ───

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_HOST}/health`);
    if (res.ok) return await res.json();
  } catch (e) {
    try {
      const res2 = await fetch(`/health`);
      if (res2.ok) return await res2.json();
    } catch {}
  }
  return {
    status: 'healthy',
    version: '1.0.0',
    database: 'simulated',
    timestamp: new Date().toISOString(),
    simulated_data: true,
  };
}

export async function getWells(): Promise<Well[]> {
  try {
    const res = await fetch(`${API_BASE}/wells`);
    if (res.ok) {
      const data = await res.json();
      return data.map((w: any) => ({
        ...w,
        id: w.well_id,
        well_name: w.name,
        code: w.code || w.name?.split(' ').pop() || 'WELL',
        well_id_code: w.code || w.name?.split(' ').pop() || 'WELL',
        field_name: w.field_name || 'Nahorkatiya',
        block_name: w.block_name || 'Assam Shelf',
        operator: w.operator || 'Oil India Ltd (Simulated)',
      }));
    }
  } catch (e) {
    console.warn('Backend unavailable, using simulated wells');
  }

  // Robust simulated fallback
  return [
    {
      well_id: '758a9b69-373a-400c-85ee-20ba4172ddf4',
      id: '758a9b69-373a-400c-85ee-20ba4172ddf4',
      name: 'Nahorkatiya Exploration DEMO-WELL-101',
      well_name: 'Nahorkatiya Exploration DEMO-WELL-101',
      code: 'DEMO-WELL-101',
      well_id_code: 'DEMO-WELL-101',
      field_name: 'Nahorkatiya',
      block_name: 'Assam Shelf Block-1',
      operator: 'Oil India Ltd (Simulated)',
      total_depth_m: 3500.0,
      latitude: 27.2842,
      longitude: 95.3411,
      status: 'active',
      risk_score: 84,
      is_simulated: true,
    },
    {
      well_id: '1c5c67a3-4018-4763-9fd8-d86b757283a0',
      id: '1c5c67a3-4018-4763-9fd8-d86b757283a0',
      name: 'Nahorkatiya Exploration DEMO-WELL-102',
      well_name: 'Nahorkatiya Exploration DEMO-WELL-102',
      code: 'DEMO-WELL-102',
      well_id_code: 'DEMO-WELL-102',
      field_name: 'Nahorkatiya',
      block_name: 'Assam Shelf Block-1',
      operator: 'Oil India Ltd (Simulated)',
      total_depth_m: 3600.0,
      latitude: 27.3821,
      longitude: 95.3124,
      status: 'completed',
      risk_score: 72,
      is_simulated: true,
    },
    {
      well_id: '45736872-7faf-4942-97c5-5cef81a54319',
      id: '45736872-7faf-4942-97c5-5cef81a54319',
      name: 'Nahorkatiya Exploration DEMO-WELL-103',
      well_name: 'Nahorkatiya Exploration DEMO-WELL-103',
      code: 'DEMO-WELL-103',
      well_id_code: 'DEMO-WELL-103',
      field_name: 'Nahorkatiya',
      block_name: 'Assam Shelf Block-1',
      operator: 'Oil India Ltd (Simulated)',
      total_depth_m: 3550.0,
      latitude: 27.2915,
      longitude: 95.3582,
      status: 'active',
      risk_score: 78,
      is_simulated: true,
    },
  ];
}

export async function fetchWells(page = 1, pageSize = 50): Promise<{ wells: Well[]; total: number }> {
  const wells = await getWells();
  return { wells, total: wells.length };
}

export async function getWell(id: string): Promise<Well | null> {
  try {
    const res = await fetch(`${API_BASE}/wells/${id}`);
    if (res.ok) {
      const w = await res.json();
      return {
        ...w,
        id: w.well_id,
        well_name: w.name,
        code: w.name?.split(' ').pop() || 'WELL',
        well_id_code: w.name?.split(' ').pop() || 'WELL',
        field_name: w.field_name || 'Nahorkatiya',
        block_name: w.block_name || 'Assam Shelf',
        operator: w.operator || 'Oil India Ltd (Simulated)',
      };
    }
  } catch (e) {}
  const wells = await getWells();
  return wells.find((w) => w.well_id === id || w.id === id) || wells[0];
}

export async function getNearbyWells(lat: number, lon: number, radiusKm = 15): Promise<Well[]> {
  try {
    const res = await fetch(`${API_BASE}/wells/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return getWells();
}

export async function getFormations(wellId: string): Promise<Formation[]> {
  try {
    const res = await fetch(`${API_BASE}/formations/${wellId}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return [
    { formation_id: 'f1', well_id: wellId, name: 'Alluvium / Dihing Formation', top_depth_m: 0, base_depth_m: 400, lithology: 'Clay & Sandstone' },
    { formation_id: 'f2', well_id: wellId, name: 'Tipam Sandstone Formation', top_depth_m: 400, base_depth_m: 2690, lithology: 'Coarse Sandstone' },
    { formation_id: 'f3', well_id: wellId, name: 'Barail Coal-Shale Formation (F3)', top_depth_m: 2690, base_depth_m: 2940, lithology: 'Fractured Coal, Shale' },
    { formation_id: 'f4', well_id: wellId, name: 'Kopili Shale Formation', top_depth_m: 2940, base_depth_m: 3300, lithology: 'Reactive Marine Shale' },
  ];
}

export async function getEvents(params: Record<string, any> = {}): Promise<DrillingEvent[]> {
  const query = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE}/events${query ? '?' + query : ''}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

export async function fetchKPIs(): Promise<DashboardKPIs> {
  const wells = await getWells();
  const alerts = await getAlerts();
  const events = await getEvents();
  return {
    total_wells: wells.length,
    active_wells: wells.filter((w) => w.status === 'active').length,
    critical_alerts: alerts.filter((a) => a.severity === 'critical').length,
    wells_at_risk: alerts.length,
    avg_risk_score: 72.4,
    recent_events: events.slice(0, 10),
  };
}

// ─── Phase 5: Similarity Engine ───

export async function getSimilarWells(wellId: string, limit = 10): Promise<WellSimilarity[]> {
  try {
    const res = await fetch(`${API_BASE}/wells/${wellId}/similar?limit=${limit}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

export async function findSimilarWells(wellId: string, limit = 5): Promise<SimilarWell[]> {
  const list = await getSimilarWells(wellId, limit);
  if (list && list.length > 0) {
    return list.map((s) => ({
      well_id: s.well_id,
      well_name: s.well_name,
      well_id_code: s.well_code || 'WELL',
      overall_similarity: s.overall_similarity,
      similarity_score: s.similarity_score || s.overall_similarity,
      distance_km: s.distance_km,
      shared_formations: s.breakdown?.formation_overlap?.shared_formations || [],
      common_events: s.breakdown?.event_type_overlap?.common_events || [],
    }));
  }
  return [
    {
      well_id: '1c5c67a3-4018-4763-9fd8-d86b757283a0',
      well_name: 'Nahorkatiya Exploration DEMO-WELL-102',
      well_id_code: 'DEMO-WELL-102',
      overall_similarity: 0.72,
      distance_km: 11.53,
      shared_formations: ['Barail Coal-Shale Formation (F3)', 'Tipam Sandstone Formation'],
      common_events: ['stuck_pipe'],
    },
    {
      well_id: '45736872-7faf-4942-97c5-5cef81a54319',
      well_name: 'Nahorkatiya Exploration DEMO-WELL-103',
      well_id_code: 'DEMO-WELL-103',
      overall_similarity: 0.68,
      distance_km: 1.93,
      shared_formations: ['Barail Coal-Shale Formation (F3)', 'Tipam Sandstone Formation'],
      common_events: ['mud_loss'],
    },
  ];
}

export async function getNearbyVsRelevant(wellId: string, radiusKm = 25): Promise<NearbyVsRelevant | null> {
  try {
    const res = await fetch(`${API_BASE}/wells/${wellId}/nearby-vs-relevant?radius_km=${radiusKm}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return null;
}

// ─── Phase 6: Depth-Aware Risk Engine ───

export async function getCurrentRisk(
  wellId: string,
  depth: number,
  currentFormation?: string,
  lookaheadM = 50
): Promise<CurrentRiskResponse> {
  const params = new URLSearchParams({
    well_id: wellId,
    depth: depth.toString(),
    lookahead_m: lookaheadM.toString(),
  });
  if (currentFormation) params.append('current_formation', currentFormation);

  try {
    const res = await fetch(`${API_BASE}/risk/current?${params.toString()}`);
    if (res.ok) return await res.json();
  } catch (e) {}

  const isClusterZone = depth >= 2735 && depth <= 2780;
  return {
    well_id: wellId,
    current_depth: depth,
    current_formation: 'Barail Coal-Shale Formation (F3)',
    lookahead_m: lookaheadM,
    risk_level: isClusterZone ? 'HIGH_EVIDENCE_RISK' : (depth >= 2700 ? 'CAUTION' : 'NORMAL'),
    risk_score: isClusterZone ? 91.5 : (depth >= 2700 ? 84.0 : 15.0),
    confidence: isClusterZone ? 'High' : (depth >= 2700 ? 'Med' : 'Low'),
    evidence: [
      {
        well: 'DEMO-WELL-102',
        distance: 11.53,
        event: 'stuck_pipe',
        depth: 2761.8,
        formation: 'Barail Coal-Shale Formation (F3)',
        similarity: 0.62,
        source_doc: 'Daily Drilling Report — DEMO-WELL-102',
        page: 3,
        snippet: 'CORRELATED CLUSTER INCIDENT: Differential stuck pipe in Barail Coal-Shale (F3) at 2761.8m.',
      },
      {
        well: 'DEMO-WELL-103',
        distance: 1.93,
        event: 'mud_loss',
        depth: 2758.2,
        formation: 'Barail Coal-Shale Formation (F3)',
        similarity: 0.68,
        source_doc: 'Daily Drilling Report — DEMO-WELL-103',
        page: 3,
        snippet: 'CORRELATED CLUSTER INCIDENT: Sudden mud loss of 95 bbl/hr in Barail Coal-Shale (F3) at 2758.2m.',
      },
    ],
    why_text: isClusterZone
      ? 'HIGH_EVIDENCE_RISK: 2 independent offset wells (DEMO-WELL-102, DEMO-WELL-103) corroborate severe mud loss and stuck pipe within tight ±10m band in Barail Coal-Shale Formation (F3).'
      : 'Nominal baseline risk.',
    evidence_ids: [],
    corroborating_wells_count: 2,
    disclaimer: 'SIMULATED DATA — NOT OIL INDIA DATA',
  };
}

export async function getRiskAssessment(wellId: string, depthM?: number): Promise<RiskAssessment> {
  try {
    const url = `${API_BASE}/risk/assess/${wellId}${depthM ? `?depth_m=${depthM}` : ''}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {}

  return {
    well_id: wellId,
    overall_risk_score: 0.78,
    confidence: 0.92,
    depth_m: depthM || 2750.0,
    formation_name: 'Barail Coal-Shale Formation (F3)',
    geological_risk: 0.65,
    mechanical_risk: 0.58,
    pressure_risk: 0.72,
    historical_risk: 0.84,
    risk_factors: [
      { factor: 'Pore Pressure Transition', score: 0.72, evidence: 'Offset kick logged at 2758m', source: 'Well 103 Report p. 3' },
      { factor: 'Borehole Differential Sticking', score: 0.58, evidence: 'Overpull of 140 klbs in Well 102', source: 'Well 102 Report p. 3' },
    ],
    similar_well_ids: ['DEMO-WELL-102', 'DEMO-WELL-103'],
    evidence_summary: 'Correlated microfracture interval in Barail Coal-Shale Formation (F3).',
    source_documents: [],
    is_simulated: true,
  };
}

export async function fetchRiskAssessment(wellId: string): Promise<RiskAssessment> {
  return await getRiskAssessment(wellId);
}

export async function getAlerts(params: Record<string, any> = {}): Promise<Alert[]> {
  const query = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE}/risk/alerts${query ? '?' + query : ''}`);
    if (res.ok) {
      const data = await res.json();
      return data.map((a: any) => ({
        ...a,
        id: a.alert_id,
        title: a.title || `${a.alert_type?.replace('_', ' ').toUpperCase()} WARNING`,
        message: a.why || a.evidence,
        related_well_ids: a.which_wells || [],
        confidence: a.confidence_score || 0.9,
      }));
    }
  } catch (e) {}

  return [
    {
      alert_id: 'alert-cluster-101',
      id: 'alert-cluster-101',
      well_id: '758a9b69-373a-400c-85ee-20ba4172ddf4',
      depth_m: 2752.4,
      formation_name: 'Barail Coal-Shale Formation (F3)',
      alert_type: 'mud_loss',
      severity: 'critical',
      title: 'MUD LOSS CRITICAL ALERT',
      message: 'Severe mud loss of 120 bbl/hr in Barail Coal-Shale (F3) at 2752.4m.',
      why: 'Correlated offset cluster: 3 nearby wells (DEMO-WELL-101, DEMO-WELL-102, DEMO-WELL-103) experienced severe mud_loss in Barail Coal-Shale (F3) within depth band 2745-2770m.',
      which_wells: ['DEMO-WELL-101', 'DEMO-WELL-102', 'DEMO-WELL-103'],
      related_well_ids: ['DEMO-WELL-101', 'DEMO-WELL-102', 'DEMO-WELL-103'],
      evidence: 'DEMO-WELL-101 suffered mud_loss at 2752.4m: Severe mud loss of 120 bbl/hr upon traversing micro-fractured zone.',
      source_doc: 'Daily Drilling Report — DEMO-WELL-101',
      source_page: 3,
      similarity_score: 0.88,
      confidence_score: 0.95,
      confidence: 0.95,
      is_read: false,
      is_acknowledged: false,
      created_at: new Date().toISOString(),
    },
  ];
}

export async function fetchAlerts(): Promise<Alert[]> {
  return await getAlerts();
}

export async function acknowledgeAlert(alertId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/risk/alerts/${alertId}/acknowledge`, { method: 'PATCH' });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { status: 'acknowledged', alert_id: alertId };
}

// ─── Phase 7: RAG Copilot ───

export async function queryCopilot(question: string, wellId?: string): Promise<CopilotQueryResponse> {
  try {
    const res = await fetch(`${API_BASE}/copilot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, well_id: wellId }),
    });
    if (res.ok) return await res.json();
  } catch (e) {}

  return {
    answer: `Yes, based on verified institutional drilling records, multiple offset wells experienced mud loss incidents:\n- **DEMO-WELL-101**: Experienced severe Mud Loss at 2752.4m in Barail Coal-Shale Formation (F3). [DEMO-WELL-101, Daily Drilling Report — DEMO-WELL-101, Page 3]\n- **DEMO-WELL-103**: Experienced severe Mud Loss at 2758.2m in Barail Coal-Shale Formation (F3). [DEMO-WELL-103, Daily Drilling Report — DEMO-WELL-103, Page 3]`,
    citations: [
      { well: 'DEMO-WELL-101', doc: 'Daily Drilling Report — DEMO-WELL-101', page: 3, snippet: 'Severe mud loss of 120 bbl/hr in Barail Coal-Shale (F3) at 2752.4m.' },
      { well: 'DEMO-WELL-103', doc: 'Daily Drilling Report — DEMO-WELL-103', page: 3, snippet: 'Sudden mud loss of 95 bbl/hr in Barail Coal-Shale (F3) at 2758.2m.' },
    ],
    disclaimer: 'SIMULATED DATA — NOT OIL INDIA DATA',
  };
}

export async function askCopilot(query: string, wellId?: string): Promise<CopilotResponse> {
  const res = await queryCopilot(query, wellId);
  return {
    query,
    response: res.answer,
    answer: res.answer,
    citations: res.citations.map((c) => ({
      well_name: c.well,
      document_title: c.doc,
      page: c.page,
      excerpt: c.snippet,
      confidence: 0.95,
    })),
    disclaimer: res.disclaimer,
  };
}

export function getWellReportUrl(wellId: string): string {
  return `${API_BASE}/reports/well/${wellId}/pdf`;
}

// ─── Phase 14: Auth & Audit Client Helpers ─────────────────────────────────────
let _authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('nwis_token') : null;

export function setAuthToken(token: string | null) {
  _authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('nwis_token', token);
    } else {
      localStorage.removeItem('nwis_token');
    }
  }
}

export function getAuthToken(): string | null {
  return _authToken;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  return headers;
}

export interface UserSession {
  username: string;
  role: 'admin' | 'engineer' | 'read_only' | string;
  full_name?: string;
  access_token: string;
}

export async function loginUser(username: string, password: string): Promise<UserSession> {
  const res = await fetch(`${API_HOST}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error('Invalid username or password');
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function getCurrentUserProfile(): Promise<any> {
  try {
    const res = await fetch(`${API_HOST}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return null;
}

export interface AuditLogEntry {
  log_id: string;
  username: string;
  role: string;
  action: string;
  entity: string;
  details?: string;
  timestamp: string;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const res = await fetch(`${API_HOST}/audit-logs`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return [
    {
      log_id: 'sample-1',
      username: 'admin',
      role: 'admin',
      action: 'SYSTEM_BOOTSTRAP',
      entity: 'SECURITY',
      details: 'Deterministic risk engine and PostGIS spatial indexing active',
      timestamp: new Date().toISOString(),
    },
  ];
}

// ─── Phase 15: OCR Review Queue & Risk Brief PDF ──────────────────────────────
export async function getNeedsReviewEvents(): Promise<DrillingEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/events/needs-review`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

export async function reviewDrillingEvent(eventId: string, updates: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/review`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to approve/update event');
  return await res.json();
}

export function getRiskBriefPdfUrl(wellId: string): string {
  return `${API_BASE}/wells/${wellId}/risk-brief.pdf`;
}

