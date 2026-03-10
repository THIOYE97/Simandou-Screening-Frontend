// src/api.ts
import axios from "axios";
import { getToken, clearToken } from "./auth";

const rawBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = (rawBase && rawBase.trim().replace(/\/+$/, "")) || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) clearToken();
    return Promise.reject(err);
  }
);

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

export interface ScreeningDecision {
  decision: "PASS" | "BLOCK";
  comment: string;
  decided_at: string;
  decided_by_email: string;
  decided_by_user_id: string | null;
  request_id: string | null;
  case_id: string | null;
}

export interface MatchExplain {
  bullets: string[];
  raw: Record<string, any> | null;
}

export interface SourceBlock {
  label: string | null;
  code: string | null;
  name: string | null;
  ref: string | null;
  record_type: string | null;
  program: string | null;
  listed_on: string | null;
  unlisted_on: string | null;
  summary: string | null;
  links: string[];
}

export interface ScreeningMatch {
  id: string;
  request_id: string;
  entity_id: string | null;
  entity_name: string | null;
  source_record_id: string | null;
  match_score: number;
  match_band: string | null;
  match_band_label: string | null;
  match_explain: MatchExplain;
  sanction_explain: MatchExplain;
  source_id: number | null;
  source_code: string | null;
  source_name: string | null;
  source_ref: string | null;
  record_type: string | null;
  program: string | null;
  listed_on: string | null;
  unlisted_on: string | null;
  summary: string | null;
  evidence_urls: string[] | null;
  source_block: SourceBlock | null;
  created_at: string | null;
}

export interface ScreeningResult {
  id: string;
  request_id: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  recommended_action: "PASS" | "MANUAL_REVIEW" | "BLOCK";
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
}

export interface ScreeningRequest {
  id: string;               // = request_id (clé primaire de screening_requests)
  provider: string | null;
  status: "RUNNING" | "DONE" | "FAILED" | null;
  created_at: string | null;
  completed_at: string | null;
  case_id: string | null;
  client_id: string | null;
  request_payload: Record<string, any>;
  client_name: string | null;
}

export interface CaseDocument {
  id: string;
  case_id: string | null;
  doc_type: string | null;
  uploaded_at: string | null;
  ocr_status: string | null;
  ocr_confidence: number | null;
  original_filename: string | null;
  object_key: string | null;
  mime: string | null;
  extracted_fields: Record<string, any> | null;
}

export interface CaseInfo {
  id: string;
  [key: string]: any;
  documents: CaseDocument[];
  screening_decision: ScreeningDecision | null;
  screening_decision_history: ScreeningDecision[];
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data as { access_token: string; token_type: string };
}

// ─────────────────────────────────────────────
// SCREENINGS LIST  →  GET /analyst/screenings
// ─────────────────────────────────────────────

export interface ScreeningListItem {
  id: string;           // = screening_request_id — TOUJOURS utiliser pour l'export PDF
  provider: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  case_id: string | null;
  kind: string | null;
  client_name: string | null;
}

export interface ScreeningListOut {
  items: ScreeningListItem[];
  limit: number;
  offset: number;
  total: number;
}

export async function listScreenings(params?: {
  status?: string;
  provider?: string;
  name?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<ScreeningListOut> {
  const { data } = await api.get("/analyst/screenings", { params });
  return data;
}

// ─────────────────────────────────────────────
// SCREENING DETAILS  →  GET /analyst/screenings/{request_id}
// ─────────────────────────────────────────────

export interface ScreeningDetailsOut {
  request: ScreeningRequest;
  result: ScreeningResult | null;
  matches: ScreeningMatch[];
  case: CaseInfo | null;
  decision_latest: ScreeningDecision | null;
  decision_history: ScreeningDecision[];
}

export async function getScreeningDetails(
  requestId: string   // toujours screening_request.id, jamais case_id
): Promise<ScreeningDetailsOut> {
  const { data } = await api.get(`/analyst/screenings/${requestId}`);
  return data;
}

// ─────────────────────────────────────────────
// SIMPLE SCREENING  →  POST /screening/simple
// ─────────────────────────────────────────────

export interface SimpleScreeningIn {
  entity_type: "INDIVIDUAL" | "COMPANY";
  case_id?: string;
  client_id?: string;
  // Individual
  first_name?: string;
  last_name?: string;
  dob?: string;
  nationality?: string;
  country?: string;
  // Company
  company_name?: string;
  registration_number?: string;
  incorporation_country?: string;
  // Options
  aliases?: string[];
  include_aliases?: boolean;
  max_matches?: number;
}

export interface SimpleScreeningOut {
  request_id: string;   // = screening_request.id
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  recommended_action: "PASS" | "MANUAL_REVIEW" | "BLOCK";
  top_matches: Array<{
    entity_id: string;
    entity_risk: string | null;
    primary_name: string | null;
    score: number;
    band: string;
  }>;
}

export async function launchSimpleScreening(
  payload: SimpleScreeningIn,
  tenantId?: string   // optionnel, pour les super admins
): Promise<SimpleScreeningOut> {
  const headers = tenantId ? { "X-Tenant-Id": tenantId } : undefined;
  const { data } = await api.post("/screening/simple", payload, { headers });
  return data;
}

// ─────────────────────────────────────────────
// DECISION  →  POST /analyst/screenings/{request_id}/decision
// ─────────────────────────────────────────────

export interface DecisionIn {
  decision: "PASS" | "BLOCK";
  comment: string;
  request_id?: string;
}

export interface DecisionOut {
  ok: boolean;
  case_id: string;
  request_id: string | null;
  decision: "PASS" | "BLOCK";
  decided_by: string;
  decision_latest: ScreeningDecision | null;
  decision_history: ScreeningDecision[];
}

export async function setScreeningDecision(
  requestId: string,
  decision: "PASS" | "BLOCK",
  comment: string
): Promise<DecisionOut> {
  const { data } = await api.post(`/analyst/screenings/${requestId}/decision`, {
    decision,
    comment,
  });
  return data;
}

// ─────────────────────────────────────────────
// DECISION par CASE  →  POST /analyst/cases/{case_id}/screening-decision
// ─────────────────────────────────────────────

export interface CaseDecisionOut {
  ok: boolean;
  case_id: string;
  request_id: string | null;
  decision: "PASS" | "BLOCK";
  decided_by: string;
  decided_at: string;
}

export async function setCaseScreeningDecision(
  caseId: string,
  decision: "PASS" | "BLOCK",
  comment: string,
  requestId?: string
): Promise<CaseDecisionOut> {
  const { data } = await api.post(`/analyst/cases/${caseId}/screening-decision`, {
    decision,
    comment,
    request_id: requestId,
  });
  return data;
}

// ─────────────────────────────────────────────
// OCR & DOCUMENTS
// ─────────────────────────────────────────────

export interface UploadDocResp {
  document_id: string;
  case_id: string | null;
  ocr_status: string;
  object_key: string;
  preview_url: string;
  download_url: string;
}

export interface OcrExtractResp {
  doc_id: string;
  case_id: string | null;
  ocr_status: string;
  ocr_confidence: number;
  extracted_fields: {
    last_name?: string;
    first_name?: string;
    date_of_birth?: string;
    document_number?: string;
    [key: string]: string | undefined;
  } | null;
  prefill: Record<string, any> | null;
  preview_url: string;
  download_url: string;
}

// Upload avec case
export async function uploadCaseDocument(
  caseId: string,
  docType: string,
  file: File
): Promise<UploadDocResp> {
  const form = new FormData();
  form.append("doc_type", docType);
  form.append("file", file);
  const { data } = await api.post(`/documents/cases/${caseId}/upload`, form);
  return data;
}

// Upload standalone (sans case)
export async function uploadDocumentStandalone(
  docType: string,
  file: File
): Promise<UploadDocResp> {
  const form = new FormData();
  form.append("doc_type", docType);
  form.append("file", file);
  const { data } = await api.post(`/documents/upload`, form);
  return data;
}

// OCR extract (async — répond PENDING immédiatement)
export async function extractOcr(documentId: string): Promise<OcrExtractResp> {
  const { data } = await api.post(`/documents/${documentId}/extract`, {});
  return data;
}

// ─────────────────────────────────────────────
// SCREENING FROM DOCUMENT
// ─────────────────────────────────────────────

export interface ScreeningFromDocIn {
  document_id: string;
  client_id?: string;
  country_focus?: string;
  override_name?: string;
}

export async function screeningFromDocument(
  payload: ScreeningFromDocIn
): Promise<SimpleScreeningOut> {
  const { data } = await api.post(`/screening/from-document`, payload);
  return data;
}

// ─────────────────────────────────────────────
// EXPORT PDF  →  GET /screening/{request_id}/export.pdf
//
// ⚠️  requestId = screening_request.id  (PAS le case_id !)
// Le champ correct dans ScreeningListItem est `id`, pas `case_id`
// ─────────────────────────────────────────────

export async function downloadScreeningExportPdf(
  requestId: string  // = ScreeningListItem.id = ScreeningDetailsOut.request.id
): Promise<void> {
  const res = await api.get(`/screening/${requestId}/export.pdf`, {
    responseType: "blob",
    timeout: 120_000,  // PDF peut prendre du temps
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `screening_${requestId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// EXPORT JSON  →  GET /screening/{request_id}/export.json
// ─────────────────────────────────────────────

export async function downloadScreeningExportJson(requestId: string): Promise<void> {
  const res  = await api.get(`/screening/${requestId}/export.json`, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `screening_${requestId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}