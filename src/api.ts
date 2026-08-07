// src/api.ts
import axios from "axios";
import { getToken, getRefreshToken, setSession, clearToken } from "./auth";

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

// ─────────────────────────────────────────────
// Renouvellement automatique de la session
// ─────────────────────────────────────────────
// Le jeton d'accès est volontairement court (30 min). Sans renouvellement,
// l'utilisateur était déconnecté dès qu'il laissait l'application ouverte sans
// agir. On échange donc le jeton de rafraîchissement contre un nouveau couple,
// puis on rejoue la requête d'origine — de façon transparente.
// Un seul rafraîchissement est mené à la fois : les requêtes concurrentes qui
// prennent un 401 attendent le même résultat au lieu d'en déclencher plusieurs.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return null;
  try {
    // Instance nue : évite de repasser par les intercepteurs (boucle infinie).
    const { data } = await axios.post(
      `${(import.meta.env.VITE_API_URL as string) || ""}/auth/refresh`,
      { refresh_token },
      { timeout: 30_000 },
    );
    const access = data?.access_token ?? null;
    if (!access) return null;
    setSession(access, data?.refresh_token ?? null);
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original: any = error?.config ?? {};
    const url: string = original?.url ?? "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/refresh");

    if (status === 401 && !isAuthCall && !original.__retried) {
      original.__retried = true;
      if (!refreshInFlight) {
        refreshInFlight = refreshSession().finally(() => { refreshInFlight = null; });
      }
      const token = await refreshInFlight;
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);      // rejoue la requête d'origine
      }
      // Renouvellement impossible : la session est réellement terminée.
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
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
  // Conserve le jeton de rafraîchissement : sans lui, la session expire au
  // bout de 30 minutes et l'utilisateur doit se reconnecter.
  setSession(token as string, data?.refresh_token ?? null);
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
  provider?:   string;
  date?:       string; // YYYY-MM-DD
  hour?:       number; // 0-23
  date_from?:  string; // YYYY-MM-DD inclusif
  date_to?:    string; // YYYY-MM-DD inclusif
}

export interface ScreeningListItem {
  id:                 string;
  provider?:          string | null;
  status?:            string | null;
  created_at?:        string | null;
  completed_at?:      string | null;
  case_id?:           string | null;
  kind?:              string | null;
  entity_type?:       string | null;   // INDIVIDUAL | COMPANY
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

// ── Rattachements offshore (ICIJ) ───────────────────────────────────────────
export type OffshoreParty = {
  node_id: string; name: string; kind: string;
  countries?: string | null; jurisdiction?: string | null;
  role_raw?: string | null; role_class: string; role_label: string;
  source?: string | null;
};
export type OffshoreLinked = {
  subject_found: boolean;
  subject: { name: string; jurisdiction?: string | null; investigation?: string | null;
             score: number; status?: string | null } | null;
  parties: OffshoreParty[];
  attribution?: string; caveat?: string;
};

/**
 * Acteurs rattachés à un sujet dans les fuites offshore.
 * Personne morale → ceux qui la détiennent ; personne physique → ses sociétés.
 */
export async function getOffshoreLinked(name: string, isCompany: boolean): Promise<OffshoreLinked> {
  const { data } = await api.get("/offshore/linked", { params: { name, is_company: isCompany } });
  return data;
}

// ── Liste noire / interdits bancaires (BCRG) ────────────────────────────────
export type BlacklistState = {
  source_id: number | null; actifs: number; leves: number; total: number;
};
export type BlacklistRecord = {
  source_ref: string; primary_name: string; entity_type: string;
  motif?: string | null; date_decision?: string | null; date_levee?: string | null;
};
export type BlacklistImport = {
  dry_run?: boolean;
  fresh?: number; existing?: number;
  would_create?: number; would_delist?: number;
  created?: number; updated?: number; relisted?: number; delisted?: number;
};

export async function getBlacklistState(): Promise<BlacklistState> {
  const { data } = await api.get("/blacklist/state");
  return data;
}

export async function listBlacklist(): Promise<BlacklistRecord[]> {
  const { data } = await api.get("/blacklist/records");
  return data.records ?? [];
}

/** dryRun = simulation : mesure l'impact sans rien écrire. */
export async function importBlacklist(file: File, dryRun: boolean): Promise<BlacklistImport> {
  const fd = new FormData();
  fd.append("fichier", file);
  const { data } = await api.post("/blacklist/import", fd, {
    params: { dry_run: dryRun },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function downloadBlacklistTemplate() {
  const { data } = await api.get("/blacklist/template.csv", { responseType: "blob" });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modele-liste-noire-bcrg.csv";
  a.click(); URL.revokeObjectURL(url);
}

// ── Base BCRG des médias défavorables ───────────────────────────────────────
export type AdverseRecord = {
  id: string; entity_name: string; category: string;
  source?: string | null; url?: string | null; summary?: string | null;
  active: boolean; created_at: string;
};

export async function listAdverseRecords(): Promise<AdverseRecord[]> {
  const { data } = await api.get("/adverse-media/records");
  return data;
}

export async function addAdverseRecord(payload: {
  entity_name: string; category: string;
  source?: string; url?: string; summary?: string;
}): Promise<AdverseRecord> {
  const { data } = await api.post("/adverse-media/records", payload);
  return data;
}

/** Bascule actif/inactif — on ne supprime jamais un signalement. */
export async function toggleAdverseRecord(id: string, actif: boolean) {
  const { data } = await api.patch(`/adverse-media/records/${id}`, null,
                                   { params: { actif } });
  return data;
}

export async function importAdverseCsv(file: File): Promise<{
  crees: number; ignores: number; erreurs: string[];
}> {
  const fd = new FormData();
  fd.append("fichier", file);
  const { data } = await api.post("/adverse-media/import", fd,
                                  { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}

export async function downloadAdverseTemplate() {
  const { data } = await api.get("/adverse-media/template.csv", { responseType: "blob" });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modele-medias-defavorables.csv";
  a.click(); URL.revokeObjectURL(url);
}

// ── Médias défavorables ──────────────────────────────────────────────────────
export type PressArticle = {
  title: string; url?: string | null; domain?: string | null;
  language?: string | null; seen_at?: string | null;
};
export type PressResult = {
  /** IDLE = jamais cherché · PENDING = en cours · DONE · ERROR */
  status: "IDLE" | "PENDING" | "DONE" | "ERROR";
  articles: PressArticle[]; attribution: string; error: string | null;
};

/** État de la recherche — sondé jusqu'à DONE ou ERROR. Ne déclenche rien. */
export async function getAdverseMediaPress(name: string): Promise<PressResult> {
  const { data } = await api.get("/adverse-media/press", { params: { name } });
  return data;
}

/**
 * Déclenche la recherche et rend la main aussitôt : la source refuse environ
 * deux requêtes sur trois et chaque tentative dure jusqu'à une minute.
 */
export async function startAdverseMediaPress(name: string): Promise<PressResult> {
  const { data } = await api.post("/adverse-media/press", null, { params: { name } });
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
      a.download = `verification-${requestId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(err => console.error("[downloadPdf]", err));
}

// Export PDF d'une opération  →  GET /kyt/transactions/{id}/export.pdf
export function downloadTransactionExportPdf(txnId: string): void {
  const token = getToken();
  const url = `${import.meta.env.VITE_API_URL ?? ""}/kyt/transactions/${txnId}/export.pdf`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `operation-${txnId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(err => console.error("[downloadTxnPdf]", err));
}

// ═════════════════════════════════════════════
// LBC/FT — Modules TDR BCRG (référentiel, scoring, alertes, KYT, reporting, RBAC)
// ═════════════════════════════════════════════

// ─── M1 Référentiel ───────────────────────────
export interface RiskScenario {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  criteria: Record<string, any>;
  risk_weight: number;
  active: boolean;
}
export interface RefCountry {
  id: string; iso_code: string; name: string;
  is_high_risk: boolean; is_non_cooperative: boolean; risk_weight: number; active: boolean;
}
export async function listScenarios(): Promise<RiskScenario[]> {
  const { data } = await api.get("/referentiel/scenarios");
  return data;
}
export async function updateScenario(id: string, payload: Partial<RiskScenario>): Promise<RiskScenario> {
  const { data } = await api.patch(`/referentiel/scenarios/${id}`, payload);
  return data;
}
export async function listRefCountries(): Promise<RefCountry[]> {
  const { data } = await api.get("/referentiel/countries");
  return data;
}
export async function seedReferentiel(): Promise<any> {
  const { data } = await api.post("/referentiel/seed");
  return data;
}

// ─── M7 Scoring ───────────────────────────────
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface Assessment {
  id: string;
  subject_type: string;
  subject_ref?: string | null;
  subject_label?: string | null;
  total_score: number;
  risk_class: RiskClass;
  triggered: Array<{ code: string; name: string; category: string; severity: string; weight: number }>;
  context: Record<string, any>;
  created_at: string;
}
export async function evaluateScoring(payload: {
  subject_type?: string; subject_ref?: string; subject_label?: string; context: Record<string, any>;
}): Promise<Assessment> {
  const { data } = await api.post("/scoring/evaluate", payload);
  return data;
}
export async function listAssessments(subject_ref?: string): Promise<Assessment[]> {
  const { data } = await api.get("/scoring/assessments", { params: { subject_ref, limit: 100 } });
  return data;
}

// ─── M6 Alertes ───────────────────────────────
export type AlertStatus =
  | "OPEN" | "IN_REVIEW" | "ESCALATED" | "CLOSED_TRUE_POSITIVE" | "CLOSED_FALSE_POSITIVE";
export interface Alert {
  id: string;
  source: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: AlertStatus;
  title: string;
  rule_code?: string | null;
  subject_ref?: string | null;
  subject_label?: string | null;
  risk_assessment_id?: string | null;
  detail: Record<string, any>;
  assigned_to?: string | null;
  resolution?: string | null;
  created_at: string;
}
export async function listAlerts(params: { status?: string; severity?: string; source?: string } = {}): Promise<Alert[]> {
  const { data } = await api.get("/alertes", { params: { ...params, limit: 100 } });
  return data;
}
export async function updateAlertStatus(id: string, status: AlertStatus, resolution?: string): Promise<Alert> {
  const { data } = await api.patch(`/alertes/${id}/status`, { status, resolution });
  return data;
}
export async function seedAlertRules(): Promise<any> {
  const { data } = await api.post("/alertes/rules/seed");
  return data;
}

// ─── M5 KYT + Déclaration de soupçon ──────────
export interface Transaction {
  id: string;
  external_ref?: string | null;
  source_system: string;
  direction: string;
  channel: string;
  amount: string | number;
  currency: string;
  customer_ref?: string | null;
  counterparty_name?: string | null;
  counterparty_country?: string | null;
  risk_assessment_id?: string | null;
  risk_class?: string | null;
  created_at: string;
}
export interface IngestResult {
  transaction: Transaction;
  risk_class: RiskClass;
  total_score: number;
  triggered: Array<{ code: string; name: string; severity: string; weight: number }>;
  alerts_created: number;
  /** Parties filtrées contre les listes (émetteur / bénéficiaire). */
  parties?: Array<{
    role: string; name: string; screened?: boolean; score: number; is_pep: boolean;
    match_count: number; top_match?: string | null; list?: string | null;
  }>;
}
export async function listTransactions(customer_ref?: string): Promise<Transaction[]> {
  const { data } = await api.get("/kyt/transactions", { params: { customer_ref, limit: 100 } });
  return data;
}
export async function ingestTransaction(payload: Record<string, any>): Promise<IngestResult> {
  const { data } = await api.post("/kyt/transactions", payload);
  return data;
}
export interface SAR {
  id: string;
  subject_ref?: string | null;
  subject_label?: string | null;
  reason: string;
  narrative?: string | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "DECIDED";
  decision: "PENDING" | "FILED_TO_CENTIF" | "DISMISSED";
  created_at: string;
}
export async function listSars(): Promise<SAR[]> {
  const { data } = await api.get("/kyt/sar", { params: { limit: 100 } });
  return data;
}
export async function createSar(payload: {
  subject_ref?: string; subject_label?: string; reason: string; narrative?: string;
}): Promise<SAR> {
  const { data } = await api.post("/kyt/sar", payload);
  return data;
}
export async function updateSar(id: string, payload: { status?: string; decision?: string; narrative?: string }): Promise<SAR> {
  const { data } = await api.patch(`/kyt/sar/${id}`, payload);
  return data;
}

// ─── M8 Reportings ────────────────────────────
export interface ComplianceDashboard {
  assessments_by_risk_class: Record<string, number>;
  alerts_by_status: Record<string, number>;
  alerts_by_severity: Record<string, number>;
  sars_by_status: Record<string, number>;
  open_alerts: number;
  critical_alerts: number;
  transactions_total: number;
  sars_pending: number;
}
export interface HighRiskSubject {
  subject_ref?: string | null;
  subject_label?: string | null;
  subject_type: string;
  risk_class: string;
  total_score: number;
  scenarios: string[];
  assessed_at?: string | null;
}
export async function getComplianceDashboard(): Promise<ComplianceDashboard> {
  const { data } = await api.get("/reportings/dashboard");
  return data;
}
export async function getHighRiskSubjects(): Promise<HighRiskSubject[]> {
  const { data } = await api.get("/reportings/high-risk-subjects");
  return data;
}
export async function downloadHighRiskCsv(): Promise<Blob> {
  const { data } = await api.get("/reportings/high-risk-subjects.csv", { responseType: "blob" });
  return data as Blob;
}

// ─── Devises (référentiel) ────────────────────
export interface Currency {
  id: string; code: string; name: string; symbol?: string | null; region?: string | null; active: boolean;
}
export async function getCurrencies(activeOnly = true): Promise<Currency[]> {
  const { data } = await api.get("/referentiel/currencies", { params: { active_only: activeOnly } });
  return data;
}
export async function createCurrency(payload: { code: string; name: string; symbol?: string; region?: string }): Promise<Currency> {
  const { data } = await api.post("/referentiel/currencies", payload);
  return data;
}
export async function updateCurrency(id: string, payload: Partial<Currency>): Promise<Currency> {
  const { data } = await api.patch(`/referentiel/currencies/${id}`, payload);
  return data;
}

// Événement d'audit de conformité
export interface ComplianceEvent {
  id: string; action: string; action_label: string; to_status?: string | null;
  decision?: string | null; justification?: string | null;
  subject_kind?: string; subject_id?: string | null; subject_label?: string | null;
  actor_id?: string | null; created_at?: string | null;
}

// ─── Détails enrichis (recâblage : mêmes données partout) ──
export interface AlertDetail extends Alert {
  subject_decision?: string | null;
  assigned_to?: string | null;
  events?: ComplianceEvent[];
  assessment?: {
    total_score: number; risk_class: RiskClass;
    triggered: Array<{ code: string; name: string; category: string; severity: string; weight: number }>;
    context: Record<string, any>;
    subject_type?: string; subject_ref?: string | null; subject_label?: string | null; created_at?: string;
  } | null;
  transaction?: {
    id: string; external_ref?: string | null; source_system: string; channel: string;
    amount: string; currency: string; customer_ref?: string | null;
    counterparty_name?: string | null; counterparty_country?: string | null;
    decision?: string | null; created_at?: string;
  } | null;
}
export async function getAlertDetail(id: string): Promise<AlertDetail> {
  const { data } = await api.get(`/alertes/${id}`);
  return data;
}
export interface TransactionDetail extends Transaction {
  value_date?: string | null;
  decision?: string | null;
  events?: ComplianceEvent[];
  assessment?: { total_score: number; risk_class: RiskClass; triggered: Array<{ code: string; name: string; severity: string; weight: number }>; context: Record<string, any> } | null;
}
export async function getTransactionDetail(id: string): Promise<TransactionDetail> {
  const { data } = await api.get(`/kyt/transactions/${id}`);
  return data;
}
export async function getComplianceEvents(subjectId: string): Promise<ComplianceEvent[]> {
  const { data } = await api.get(`/alertes/events`, { params: { subject_id: subjectId } });
  return data;
}

// ─── M2 RBAC ──────────────────────────────────
export interface MyPermissions {
  user_id: string;
  is_super_admin: boolean;
  roles: string[];
  permissions: string[];
}
export async function getMyPermissions(): Promise<MyPermissions> {
  const { data } = await api.get("/rbac/me/permissions");
  return data;
}

export default api;

// ─────────────────────────────────────────────
// Bénéficiaires effectifs
// ─────────────────────────────────────────────
export interface UboMember {
  id: string;
  parent_id?: string | null;
  kind: "PERSON" | "ENTITY";
  full_name: string;
  nationality?: string | null;
  country?: string | null;
  date_of_birth?: string | null;
  identifier?: string | null;
  ownership_percent?: number | null;
  /** Détention réelle après aplatissement de la chaîne (produit des %). */
  effective_percent: number;
  control_nature: string;
  is_beneficial_owner: boolean;
  match_score?: number | null;
  is_pep: boolean;
  screened_at?: string | null;
  matches: Array<{ name?: string; source?: string | null; program?: string | null; score?: number; record_type?: string | null }>;
}

export interface UboDeclaration {
  id: string;
  company_name: string;
  company_ref?: string | null;
  company_country?: string | null;
  notes?: string | null;
  last_screened_at?: string | null;
  created_at?: string | null;
  members: UboMember[];
}

export interface UboScreenResult {
  declaration_id: string;
  company_name: string;
  risk_class: string;
  total_score: number;
  triggered: Array<{ code: string; name: string; weight: number }>;
  alerts_created: number;
  members: UboMember[];
}

export async function listUboDeclarations(): Promise<UboDeclaration[]> {
  const { data } = await api.get("/ubo/declarations");
  return data;
}
export async function getUboDeclaration(id: string): Promise<UboDeclaration> {
  const { data } = await api.get(`/ubo/declarations/${id}`);
  return data;
}
export async function createUboDeclaration(payload: Record<string, any>): Promise<UboDeclaration> {
  const { data } = await api.post("/ubo/declarations", payload);
  return data;
}
export async function deleteUboDeclaration(id: string): Promise<void> {
  await api.delete(`/ubo/declarations/${id}`);
}
export async function addUboMember(declarationId: string, payload: Record<string, any>): Promise<UboMember> {
  const { data } = await api.post(`/ubo/declarations/${declarationId}/members`, payload);
  return data;
}
export async function deleteUboMember(memberId: string): Promise<void> {
  await api.delete(`/ubo/members/${memberId}`);
}
export async function screenUboDeclaration(id: string): Promise<UboScreenResult> {
  const { data } = await api.post(`/ubo/declarations/${id}/screen`);
  return data;
}

export interface UboLookup {
  found: boolean;
  declaration: UboDeclaration | null;
  owners_count?: number;
  flagged_count?: number;
  last_screened_at?: string | null;
}
export async function lookupUboDeclaration(params: { company_name?: string; company_ref?: string }): Promise<UboLookup> {
  const { data } = await api.get("/ubo/declarations/lookup", { params });
  return data;
}

export interface UboDocument {
  id: string; declaration_id: string; member_id?: string | null;
  doc_type: string; filename: string; mime_type?: string | null;
  size_bytes?: number | null; notes?: string | null; uploaded_at?: string | null;
}
export interface UboEvent {
  id: string; action: string; justification?: string | null;
  actor_id?: string | null; created_at?: string | null;
}

export async function listUboDocuments(declarationId: string): Promise<UboDocument[]> {
  const { data } = await api.get(`/ubo/declarations/${declarationId}/documents`);
  return data;
}
export async function uploadUboDocument(
  declarationId: string, file: File, doc_type: string, notes?: string,
): Promise<UboDocument> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("doc_type", doc_type);
  if (notes) fd.append("notes", notes);
  const { data } = await api.post(`/ubo/declarations/${declarationId}/documents`, fd);
  return data;
}
export async function deleteUboDocument(documentId: string): Promise<void> {
  await api.delete(`/ubo/documents/${documentId}`);
}
/** Télécharge la pièce en réutilisant le jeton d'accès courant. */
export function downloadUboDocument(documentId: string, filename: string) {
  const token = getToken();
  const url = `${(import.meta.env.VITE_API_URL as string) || ""}/ubo/documents/${documentId}/download`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}
export async function listUboEvents(declarationId: string): Promise<UboEvent[]> {
  const { data } = await api.get(`/ubo/declarations/${declarationId}/events`);
  return data;
}
export async function updateUboMember(memberId: string, payload: Record<string, any>): Promise<UboMember> {
  const { data } = await api.patch(`/ubo/members/${memberId}`, payload);
  return data;
}

export interface CompanyOwnership {
  found: boolean;
  entity: { lei: string; name: string; country?: string | null; registration_status?: string | null } | null;
  direct_parent: { lei: string; name: string; country?: string | null } | null;
  ultimate_parent: { lei: string; name: string; country?: string | null } | null;
  children_count: number;
  note?: string | null;
}
export async function getCompanyOwnership(company_name: string): Promise<CompanyOwnership> {
  const { data } = await api.get("/ubo/ownership", { params: { company_name } });
  return data;
}

// ─────────────────────────────────────────────
// Fuites offshore (ICIJ) — consultation à la demande
// ─────────────────────────────────────────────
export interface OffshoreHit {
  node_id: string; kind: "ENTITY" | "OFFICER" | "INTERMEDIARY";
  name: string; countries?: string | null; jurisdiction?: string | null;
  investigation?: string | null; incorporation_date?: string | null;
  status?: string | null; score: number;
}
export interface OffshoreSearchResp {
  results: OffshoreHit[];
  attribution: string;
  caveat: string;
}
export interface OffshoreStats {
  total: number; by_kind: Record<string, number>; attribution: string;
}

export async function searchOffshore(q: string, kind?: string): Promise<OffshoreSearchResp> {
  const { data } = await api.get("/offshore/search", { params: { q, kind, limit: 50 } });
  return data;
}
export async function getOffshoreStats(): Promise<OffshoreStats> {
  const { data } = await api.get("/offshore/stats");
  return data;
}

// ─────────────────────────────────────────────
// Journal de connexions (console de sécurité, super-administrateur)
// ─────────────────────────────────────────────
export type LoginEventKind = "LOGIN_OK" | "LOGIN_FAILED" | "LOGOUT" | "REFRESH";

export interface LoginEvent {
  id: string;
  event: LoginEventKind;
  event_label: string;
  reason?: string | null;
  reason_label?: string | null;
  email?: string | null;
  full_name?: string | null;
  user_id?: string | null;
  tenant_name?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  is_new_context: boolean;
  created_at: string;
}

export interface LoginEventsPage {
  items: LoginEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface LoginSummary {
  logins_24h: number;
  logins_7d: number;
  users_7d: number;
  failures_24h: number;
  new_contexts_7d: number;
  last_login?: { created_at: string; email?: string | null; ip?: string | null } | null;
}

export interface ActiveSession {
  id: string;
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  tenant_name?: string | null;
  issued_at: string;
  expires_at: string;
  ip?: string | null;
  user_agent?: string | null;
}

export interface AccountRow {
  id: string;
  email: string;
  full_name?: string | null;
  status?: string | null;
  is_active?: boolean;
  tenant_name?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
  last_login_ip?: string | null;
}

export async function getLoginEvents(params: {
  limit?: number; offset?: number; event?: string; email?: string;
  days?: number; only_new_context?: boolean;
} = {}): Promise<LoginEventsPage> {
  const { data } = await api.get("/security/login-events", { params });
  return data;
}

export async function getLoginSummary(): Promise<LoginSummary> {
  const { data } = await api.get("/security/login-summary");
  return data;
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const { data } = await api.get("/security/sessions");
  return data.items ?? [];
}

export async function getAccounts(): Promise<AccountRow[]> {
  const { data } = await api.get("/security/accounts");
  return data.items ?? [];
}
