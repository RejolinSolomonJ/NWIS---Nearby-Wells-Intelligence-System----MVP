/**
 * NWIS-X Typed API Client
 * Interacts with FastAPI backend with graceful local simulated fallbacks.
 * NON-NEGOTIABLE: All data is labeled SIMULATED DATA.
 */

const API_BASE = '/api/v1';

export interface Well {
  id: string;
  well_name: string;
  well_id_code: string;
  field_name: string;
  block_name?: string;
  operator: string;
  well_type?: string;
  status: string;
  total_depth_m: number;
  latitude: number;
  longitude: number;
  elevation_m?: number;
  spud_date?: string;
  completion_date?: string;
  is_simulated: boolean;
  formation_count?: number;
  event_count?: number;
  risk_score?: number;
}

export interface Formation {
  id: string;
  well_id: string;
  formation_name: string;
  top_depth_m: number;
  bottom_depth_m: number;
  lithology?: string;
  age?: string;
  porosity_pct?: number;
  permeability_md?: number;
  pressure_psi?: number;
  temperature_c?: number;
  fluid_type?: string;
  remarks?: string;
  is_simulated: boolean;
}

export interface DrillingEvent {
  id: string;
  well_id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  depth_m: number;
  depth_end_m?: number;
  formation_name?: string;
  event_date?: string;
  duration_hours?: number;
  description: string;
  root_cause?: string;
  action_taken?: string;
  mud_weight_ppg?: number;
  mud_type?: string;
  npt_hours?: number;
  cost_usd?: number;
  source_document_id?: string;
  source_page?: number;
  is_simulated: boolean;
}

export interface RiskFactor {
  factor: string;
  score: number;
  evidence: string;
  source: string;
}

export interface RiskAssessment {
  id: string;
  well_id: string;
  assessment_type: string;
  overall_risk_score: number;
  confidence: number;
  depth_m?: number;
  formation_name?: string;
  geological_risk: number;
  mechanical_risk: number;
  pressure_risk: number;
  historical_risk: number;
  risk_factors: RiskFactor[];
  similar_well_ids: string[];
  evidence_summary?: string;
  source_documents: any[];
  is_simulated: boolean;
}

export interface Alert {
  id: string;
  well_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  why: string;
  related_well_ids: string[];
  depth_m?: number;
  formation_name?: string;
  evidence: Array<{
    type: string;
    description: string;
    source_doc?: string;
    page?: number;
  }>;
  source_document_id?: string;
  source_page?: number;
  similarity_score?: number;
  confidence?: number;
  is_read: boolean;
  is_acknowledged: boolean;
  is_simulated: boolean;
  created_at: string;
}

export interface SimilarWell {
  well_id: string;
  well_name: string;
  well_id_code: string;
  spatial_score: number;
  depth_score: number;
  formation_score: number;
  event_score: number;
  semantic_score: number;
  overall_similarity: number;
  distance_km: number;
  shared_formations: string[];
  common_events: string[];
}

export interface DashboardKPIs {
  total_wells: number;
  active_wells: number;
  total_events: number;
  critical_alerts: number;
  avg_risk_score: number;
  wells_at_risk: number;
  total_documents: number;
  recent_events: DrillingEvent[];
}

export interface Citation {
  well_id?: string;
  well_name?: string;
  document_id?: string;
  document_title?: string;
  page?: number;
  excerpt?: string;
  relevance: number;
}

export interface CopilotResponse {
  query: string;
  response: string;
  citations: Citation[];
  well_context?: any;
  disclaimer: string;
}

// ─── API Methods with Simulated Fallback ───

export async function fetchKPIs(): Promise<DashboardKPIs> {
  try {
    const res = await fetch(`${API_BASE}/wells/dashboard/kpis`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend unavailable, using simulated KPIs', e);
  }
  return {
    total_wells: 55,
    active_wells: 7,
    total_events: 237,
    critical_alerts: 14,
    avg_risk_score: 0.44,
    wells_at_risk: 18,
    total_documents: 55,
    recent_events: [
      {
        id: 'mock-1',
        well_id: 'w-1',
        event_type: 'kick',
        severity: 'critical',
        depth_m: 2940.5,
        formation_name: 'Barail Coal-Shale',
        description: 'Gas influx with 28 bbl pit volume gain; SIDPP 420 psi.',
        root_cause: 'Encountered high-pressure lens requiring mud density increase.',
        action_taken: 'Shut in on annular BOP, circulated out kick via wait and weight.',
        mud_weight_ppg: 11.4,
        is_simulated: true,
      },
      {
        id: 'mock-2',
        well_id: 'w-2',
        event_type: 'lost_circulation',
        severity: 'high',
        depth_m: 2480.0,
        formation_name: 'Tipam Sandstone',
        description: 'Dynamic mud losses reached 95 bbl/hr in porous fractured interval.',
        root_cause: 'Exceeded fracture gradient of depleted sand body.',
        action_taken: 'Spotted coarse fiber and mica LCM pill.',
        mud_weight_ppg: 10.2,
        is_simulated: true,
      },
    ],
  };
}

export async function fetchWells(page = 1, pageSize = 50, field?: string, search?: string): Promise<{ wells: Well[]; total: number }> {
  try {
    let url = `${API_BASE}/wells?page=${page}&page_size=${pageSize}`;
    if (field) url += `&field_name=${encodeURIComponent(field)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend unavailable, using fallback wells');
  }

  // Realistic fallback wells across Assam fields
  const mockWells: Well[] = [
    { id: 'w-nhk-101', well_name: 'Nahorkatiya Well NHK-101', well_id_code: 'NHK-101', field_name: 'Nahorkatiya', block_name: 'Block NHK-A', operator: 'Oil India Ltd (Simulated)', status: 'drilling', total_depth_m: 3850, latitude: 27.284, longitude: 95.342, is_simulated: true, risk_score: 0.68 },
    { id: 'w-nhk-102', well_name: 'Nahorkatiya Well NHK-102', well_id_code: 'NHK-102', field_name: 'Nahorkatiya', block_name: 'Block NHK-A', operator: 'Oil India Ltd (Simulated)', status: 'completed', total_depth_m: 3620, latitude: 27.291, longitude: 95.351, is_simulated: true, risk_score: 0.35 },
    { id: 'w-mrn-103', well_name: 'Moran Well MRN-103', well_id_code: 'MRN-103', field_name: 'Moran', block_name: 'Block MRN-B', operator: 'Oil India Ltd (Simulated)', status: 'drilling', total_depth_m: 4120, latitude: 27.185, longitude: 94.925, is_simulated: true, risk_score: 0.72 },
    { id: 'w-mrn-104', well_name: 'Moran Well MRN-104', well_id_code: 'MRN-104', field_name: 'Moran', block_name: 'Block MRN-B', operator: 'Oil India Ltd (Simulated)', status: 'completed', total_depth_m: 3950, latitude: 27.178, longitude: 94.938, is_simulated: true, risk_score: 0.42 },
    { id: 'w-dgb-105', well_name: 'Digboi Well DGB-105', well_id_code: 'DGB-105', field_name: 'Digboi', block_name: 'Block DGB-C', operator: 'Oil India Ltd (Simulated)', status: 'completed', total_depth_m: 2980, latitude: 27.382, longitude: 95.631, is_simulated: true, risk_score: 0.28 },
    { id: 'w-bgj-106', well_name: 'Baghjan Well BGJ-106', well_id_code: 'BGJ-106', field_name: 'Baghjan', block_name: 'Block BGJ-A', operator: 'Oil India Ltd (Simulated)', status: 'drilling', total_depth_m: 4350, latitude: 27.592, longitude: 95.378, is_simulated: true, risk_score: 0.79 },
    { id: 'w-brk-107', well_name: 'Barekuri Well BRK-107', well_id_code: 'BRK-107', field_name: 'Barekuri', block_name: 'Block BRK-B', operator: 'Oil India Ltd (Simulated)', status: 'completed', total_depth_m: 3820, latitude: 27.524, longitude: 95.421, is_simulated: true, risk_score: 0.51 },
    { id: 'w-jrt-108', well_name: 'Jorhat Well JRT-108', well_id_code: 'JRT-108', field_name: 'Jorhat', block_name: 'Block JRT-A', operator: 'Oil India Ltd (Simulated)', status: 'completed', total_depth_m: 3410, latitude: 26.752, longitude: 94.225, is_simulated: true, risk_score: 0.31 },
  ];
  return { wells: mockWells, total: mockWells.length };
}

export async function fetchRiskAssessment(wellId: string, depthM?: number): Promise<RiskAssessment> {
  try {
    let url = `${API_BASE}/risk/assess/${wellId}`;
    if (depthM) url += `?depth_m=${depthM}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend unavailable, using simulated risk assessment');
  }

  return {
    id: `risk-${wellId}`,
    well_id: wellId,
    assessment_type: 'while_drilling',
    overall_risk_score: 0.68,
    confidence: 0.88,
    depth_m: depthM || 2950,
    formation_name: 'Barail Coal-Shale',
    geological_risk: 0.65,
    mechanical_risk: 0.52,
    pressure_risk: 0.78,
    historical_risk: 0.72,
    risk_factors: [
      {
        factor: 'Abnormal Pore Pressure Gradient',
        score: 0.78,
        evidence: '2 kicks recorded in offset wells NHK-101 and NHK-102 at 2850m-3100m.',
        source: 'NHK-101 Geological End of Well Report p. 14',
      },
      {
        factor: 'Reactive Smectite Shale Hydration',
        score: 0.65,
        evidence: 'Severe sloughing and tight hole reaming documented during bit trips.',
        source: 'Drillers Daily Log Book p. 9',
      },
      {
        factor: 'Differential Sticking Risk in Tipam',
        score: 0.52,
        evidence: 'Thick filter cake with >1100 psi overbalance on permeable sand.',
        source: 'Mud Logging Engineering Analysis p. 22',
      },
      {
        factor: 'Offset High Severity Incidents',
        score: 0.72,
        evidence: '3 critical events logged within 4.2 km radius.',
        source: 'Nearby Wells Intelligence Archive',
      },
    ],
    similar_well_ids: ['w-nhk-102', 'w-bgj-106'],
    evidence_summary: 'Deterministic rule engine identifies acute kick danger in Barail Coal-Shale interval between 2800m and 3200m. Pressure risk dominates overall profile.',
    source_documents: [{ doc_id: 'doc-1', page: 14, excerpt: 'Kick event requiring 1.2 ppg kill weight increase.' }],
    is_simulated: true,
  };
}

export async function fetchAlerts(severity?: string): Promise<Alert[]> {
  try {
    let url = `${API_BASE}/risk/alerts`;
    if (severity) url += `?severity=${severity}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend unavailable, using simulated alerts');
  }

  return [
    {
      id: 'alert-1',
      well_id: 'w-nhk-101',
      alert_type: 'risk_threshold',
      severity: 'critical',
      title: 'EARLY WARNING: High Kick Vulnerability in Barail Coal-Shale',
      message: 'Pore pressure influx projected at 2850m - 3100m. Offset wells experienced sudden gas influx.',
      why: 'Offset well NHK-102 encountered 420 psi SIDPP kick at 2940m in identical carbonaceous facies.',
      related_well_ids: ['NHK-102', 'NHK-105'],
      depth_m: 2940,
      formation_name: 'Barail Coal-Shale',
      evidence: [
        {
          type: 'offset_drilling_incident',
          description: 'Gas influx with 28 bbl pit gain requiring shut-in on annular BOP.',
          source_doc: 'NHK-102 End of Well Geological Report',
          page: 14,
        },
      ],
      source_page: 14,
      similarity_score: 0.94,
      confidence: 0.89,
      is_read: false,
      is_acknowledged: false,
      is_simulated: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'alert-2',
      well_id: 'w-mrn-103',
      alert_type: 'risk_threshold',
      severity: 'warning',
      title: 'Lost Circulation Alert: Tipam Sandstone Transition',
      message: 'Severe loss zone anticipated entering coarse sandstone interval with 90 bbl/hr loss rate in offset wells.',
      why: 'Lower fracture gradient of 11.1 ppg EMW encountered in adjacent fault block.',
      related_well_ids: ['MRN-104'],
      depth_m: 2480,
      formation_name: 'Tipam Sandstone',
      evidence: [
        {
          type: 'mud_loss_record',
          description: 'Total losses of 340 bbls cured with fiber LCM pill.',
          source_doc: 'MRN-104 Mud Loss Log',
          page: 21,
        },
      ],
      source_page: 21,
      similarity_score: 0.88,
      confidence: 0.85,
      is_read: false,
      is_acknowledged: false,
      is_simulated: true,
      created_at: new Date().toISOString(),
    },
  ];
}

export async function findSimilarWells(wellId: string, limit = 5): Promise<SimilarWell[]> {
  try {
    const res = await fetch(`${API_BASE}/similarity/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ well_id: wellId, limit }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.similar_wells;
    }
  } catch (e) {
    console.warn('Backend unavailable, using simulated similar wells');
  }

  return [
    {
      well_id: 'w-nhk-102',
      well_name: 'Nahorkatiya Well NHK-102',
      well_id_code: 'NHK-102',
      spatial_score: 0.96,
      depth_score: 0.94,
      formation_score: 0.92,
      event_score: 0.88,
      semantic_score: 0.95,
      overall_similarity: 0.93,
      distance_km: 1.4,
      shared_formations: ['Tipam Sandstone', 'Barail Coal-Shale', 'Kopili Formation'],
      common_events: ['kick', 'wellbore_instability'],
    },
    {
      well_id: 'w-mrn-104',
      well_name: 'Moran Well MRN-104',
      well_id_code: 'MRN-104',
      spatial_score: 0.72,
      depth_score: 0.85,
      formation_score: 0.89,
      event_score: 0.80,
      semantic_score: 0.75,
      overall_similarity: 0.81,
      distance_km: 18.2,
      shared_formations: ['Tipam Sandstone', 'Barail Coal-Shale'],
      common_events: ['lost_circulation'],
    },
  ];
}

export async function askCopilot(query: string, wellId?: string): Promise<CopilotResponse> {
  try {
    const res = await fetch(`${API_BASE}/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, well_id: wellId }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend unavailable, using simulated copilot');
  }

  return {
    query,
    response: `### Institutional Memory Intelligence Analysis\n\n**Verified Analogues & Risk Evaluation:**\n- **Target Interval**: Depth \`2850m - 3200m\` (*Barail Coal-Shale*).\n- **Deterministic Risk Rating**: \`0.68\` (HIGH) | Confidence \`88%\`.\n- **Pore Pressure Window**: Offset wells show sudden overpressured gas transition with pore pressure equivalent of \`12.4 ppg\`.\n\n#### Historical Incidents from Offset Wells:\n1. **NHK-102** (1.4 km offset): Encountered 28 bbl kick at \`2940m\`. SIDPP reached 420 psi.\n2. **MRN-103** (18 km offset): Lost circulation of 95 bbl/hr at \`2480m\` in upper Tipam Sandstone.\n\n#### Operational Recommendations:\n- Stage barite weighting pills on active suction tank prior to drilling below \`2800m\`.\n- Slow trip speeds to minimize swab pressures when pulling through Kopili shales.`,
    citations: [
      {
        well_name: 'Nahorkatiya Well NHK-102',
        document_title: 'NHK-102 Completion Report',
        page: 14,
        excerpt: 'High-pressure kick encountered at 2940m requiring 1.2 ppg mud density increase.',
        relevance: 0.95,
      },
      {
        well_name: 'Moran Well MRN-103',
        document_title: 'MRN-103 Mud Logging Report',
        page: 21,
        excerpt: 'Severe mud loss in porous sandstone matrix.',
        relevance: 0.88,
      },
    ],
    disclaimer: '⚠️ SIMULATED DATA — This response is generated from synthetic data for demonstration only. LLM narration with cited sources.',
  };
}

export function getWellReportUrl(wellId: string): string {
  return `${API_BASE}/reports/well/${wellId}/pdf`;
}
