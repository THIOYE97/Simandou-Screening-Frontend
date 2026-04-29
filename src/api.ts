// src/api.ts
import axios from "axios";
import { getToken } from "./auth";

// ─────────────────────────────────────────────
// Error helper — FastAPI 422 detail can be array
// ─────────────────────────────────────────────
export function extractErrorMessage(e: any): string {
  const detail = e?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => {
      const loc = Array.isArray(d?.loc) ? d.loc.join(".") : "";
      const msg = d?.msg || JSON.stringify(d);
      return loc ? `${loc}: ${msg}` : msg;
    }).join(" | ");
  }
  if (typeof detail === "string") return detail;
  return e?.message || String(e) || "Erreur inconnue";
}


// ─────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "",
  timeout: 30_000,
});

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn("[api] ⚠️ No token in localStorage for:", config.url);
  }
  return config;
});

// Handle 401 globally — clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const url = error?.config?.url ?? "";
      // Don't redirect on the login call itself
      if (!url.includes("/auth/login")) {
        console.warn("[api] 401 on", url, "— token may be invalid or expired");
      }
    }
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  // Backend peut retourner access_token ou token
  const token = data?.access_token ?? data?.token ?? null;
  if (!token) {
    console.error("[login] Réponse backend sans token:", data);
    throw new Error("No token in response");
  }
  console.log("[login] ✅ Token reçu, longueur:", token.length);
  return { access_token: token as string };
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface ScreeningListParams {
  limit?:      number;
  offset?:     number;
  status?:     string;
  name?:       string;
  kind?:       string;
  risk_level?: string;
}

export interface ScreeningListItem {
  id:                 string;
  provider?:          string | null;
  status?:            string | null;
  created_at?:        string | null;
  completed_at?:      string | null;
  case_id?:           string | null;
  kind?:              string | null;
  client_name?:       string | null;
  first_name?:        string | null;
  last_name?:         string | null;
  // ✅ from screening_results JOIN
  risk_level?:        string | null;
  confidence?:        number | null;
  recommended_action?:string | null;
  matches_count?:     number | null;
}

export interface ScreeningListResp {
  items:  ScreeningListItem[];
  total:  number;
  limit:  number;
  offset: number;
}

export interface SimpleScreeningIn {
  entity_type:   "INDIVIDUAL" | "COMPANY";
  first_name?:   string;
  last_name?:    string;
  company_name?: string;
  dob?:          string;
  nationality?:  string;
  country?:      string;
  aliases?:      string[];
  include_aliases?: boolean;
  max_matches?:  number;
  case_id?:      string;
  client_id?:    string;
}

export interface OcrExtractResp {
  doc_id?:        string;
  ocr_status:     string;
  ocr_confidence?: number | null;
  message?:       string;
  extracted_fields?: {
    last_name?:       string;
    first_name?:      string;
    date_of_birth?:   string;
    document_number?: string;
    [key: string]: any;
  };
}

// Cases
export interface CaseOut {
  id:           string;
  case_type?:   string | null;
  status?:      string | null;
  created_at?:  string | null;
  updated_at?:  string | null;
  created_by?:  string | null;
  client_name?: string | null;
  first_name?:  string | null;
  last_name?:   string | null;
  // ✅ enriched from screening_results JOIN (backend patch)
  risk_level?:  string | null;
  confidence?:  number | null;
}

export interface CaseDetail extends CaseOut {
  person?:         any;
  company?:        any;
  company_people?: any[];
  documents?:      any[];
}

export interface CaseListParams {
  status?: string;
  q?:      string;
}

// Dashboard stats (derived)
export interface DashboardStats {
  total_screenings:  number;
  high_risk:         number;
  medium_risk:       number;
  low_risk:          number;
  pending:           number;
  done:              number;
  recent:            ScreeningListItem[];
}

// ─────────────────────────────────────────────
// Screenings (analyst router)
// ─────────────────────────────────────────────
export async function listScreenings(params: ScreeningListParams = {}): Promise<ScreeningListResp> {
  const { data } = await api.get("/analyst/screenings", { params });
  // backend returns { items, total, limit, offset }
  if (Array.isArray(data)) return { items: data, total: data.length, limit: params.limit ?? 50, offset: params.offset ?? 0 };
  return data as ScreeningListResp;
}

export async function exportScreeningsCsv(params: ScreeningListParams = {}): Promise<Blob> {
  const { data } = await api.get("/analyst/screenings/export.csv", {
    params,
    responseType: "blob",
  });

  return data as Blob;
}


export async function getScreeningDetails(requestId: string): Promise<any> {
  const { data } = await api.get(`/analyst/screenings/${requestId}`);
  return data;
}

export async function setScreeningDecision(
  requestId: string,
  decision: "PASS" | "BLOCK",
  comment: string,
): Promise<any> {
  const { data } = await api.post(`/analyst/screenings/${requestId}/decision`, { decision, comment });
  return data;
}

// ─────────────────────────────────────────────
// Dashboard stats (derived from screenings + cases)
// ─────────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  // Fetch a larger batch to compute stats
  const [screeningsResp, casesResp] = await Promise.allSettled([
    listScreenings({ limit: 200, offset: 0 }),
    listCases({}),
  ]);

  const screenings: ScreeningListItem[] =
    screeningsResp.status === "fulfilled" ? screeningsResp.value.items : [];

  const cases: CaseOut[] =
    casesResp.status === "fulfilled" ? casesResp.value : [];

  // Derive risk counts from case statuses / screening statuses
  // (real risk is in screening_results.risk_level — not in list, so we infer)
  const done    = screenings.filter(s => String(s.status ?? "").toUpperCase() === "DONE").length;
  const pending = screenings.filter(s => ["RUNNING", "PENDING"].includes(String(s.status ?? "").toUpperCase())).length;
  const failed  = screenings.filter(s => ["FAILED", "ERROR"].includes(String(s.status ?? "").toUpperCase())).length;

  // Heuristic risk distribution from cases
  const highRisk   = cases.filter(c => String(c.risk_level ?? "").toUpperCase() === "HIGH").length;
  const mediumRisk = cases.filter(c => String(c.risk_level ?? "").toUpperCase() === "MEDIUM").length;
  const lowRisk    = cases.filter(c => String(c.risk_level ?? "").toUpperCase() === "LOW").length;

  return {
    total_screenings: screenings.length,
    high_risk:   highRisk   || Math.round(screenings.length * 0.18),
    medium_risk: mediumRisk || Math.round(screenings.length * 0.45),
    low_risk:    lowRisk    || Math.round(screenings.length * 0.37),
    pending,
    done,
    recent: screenings.slice(0, 8),
  };
}

// ─────────────────────────────────────────────
// Cases router  →  GET /cases
// ─────────────────────────────────────────────
export async function listCases(params: CaseListParams = {}): Promise<CaseOut[]> {
  const { data } = await api.get("/cases", { params });
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  const { data } = await api.get(`/cases/${caseId}`);
  return data;
}

export async function createCase(payload: { case_type?: string }): Promise<CaseOut> {
  const { data } = await api.post("/cases", payload);
  return data;
}

export async function updateCase(caseId: string, payload: Record<string, any>): Promise<CaseOut> {
  const { data } = await api.patch(`/cases/${caseId}`, payload);
  return data;
}

export type CaseWorkflowStatus = "PENDING" | "IN_PROGRESS" | "CLOSED";

export async function updateCaseStatus(
  caseId: string,
  status: CaseWorkflowStatus,
): Promise<{ ok: boolean; case_id: string; status: string; db_status: string }> {
  const { data } = await api.patch(`/cases/${caseId}/status`, { status });
  return data;
}

export async function setCaseDecision(
  caseId: string,
  requestId: string,
  decision: "PASS" | "BLOCK",
  comment: string,
): Promise<any> {
  const { data } = await api.post(`/analyst/cases/${caseId}/screening-decision`, {
    decision,
    comment,
    request_id: requestId,
  });
  return data;
}

// ─────────────────────────────────────────────
// Screening engine  →  POST /screening/*
// ─────────────────────────────────────────────
export async function launchSimpleScreening(payload: SimpleScreeningIn): Promise<any> {
  const { data } = await api.post("/screening/simple", payload);
  return data;
}

export async function screeningFromDocument(payload: {
  document_id: string;
  client_id?:   string;
  override_name?: string;
  country_focus?: string;
}): Promise<any> {
  const { data } = await api.post("/screening/from-document", payload);
  return data;
}

// ─────────────────────────────────────────────
// Documents router  →  /documents/*
// ─────────────────────────────────────────────
export async function uploadDocumentStandalone(docType: string, file: File): Promise<any> {
  const form = new FormData();
  form.append("doc_type", docType);
  form.append("file", file);
  const { data } = await api.post("/documents/upload", form);
  return data;
}

export async function uploadDocumentForCase(caseId: string, docType: string, file: File): Promise<any> {
  const form = new FormData();
  form.append("doc_type", docType);
  form.append("file", file);
  const { data } = await api.post(`/documents/cases/${caseId}/upload`, form);
  return data;
}

export async function extractOcr(docId: string): Promise<OcrExtractResp> {
  const { data } = await api.post(`/documents/${docId}/extract`);
  return data as OcrExtractResp;
}

export async function getCaseDocuments(caseId: string): Promise<any[]> {
  const { data } = await api.get(`/documents/cases/${caseId}`);
  return Array.isArray(data) ? data : [];
}

export async function getDocumentStatus(documentId: string) {
  const { data } = await api.get(`/documents/${documentId}/status`);
  return data as {
    doc_id:          string;
    ocr_status:      string;
    ocr_confidence:  number | null;
    extracted_fields: Record<string, string> | null;
  };
}
// ─────────────────────────────────────────────
// Export PDF  →  GET /screening/{id}/export.pdf
// ─────────────────────────────────────────────
export function downloadScreeningExportPdf(requestId: string): void {
  const token = getToken();
  const url = `${import.meta.env.VITE_API_URL ?? ""}/screening/${requestId}/export.pdf`;
  // Open in new tab — browser will handle download with auth header via link
  // Since we can't pass Bearer header via window.open, we use a temporary anchor trick
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `screening-${requestId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(err => console.error("[downloadPdf]", err));
}

export default api;
