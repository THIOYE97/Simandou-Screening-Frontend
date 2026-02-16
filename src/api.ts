// src/api.ts
import axios from "axios";
import { getToken, clearToken } from "./auth";

export const api = axios.create({
  baseURL: "/api",
  timeout: 500000,
});

// attach Bearer token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 => drop token
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) clearToken();
    return Promise.reject(err);
  }
);

// --------------------
// AUTH
// --------------------
export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data as { access_token: string; token_type: string };
}

// --------------------
// SIMPLE SCREENING (existing)
// --------------------
export type SimpleScreeningIn = {
  entity_type: "INDIVIDUAL" | "COMPANY";
  first_name?: string;
  last_name?: string;
  dob?: string;
  nationality?: string;
  country?: string;
  company_name?: string;
  registration_number?: string;
  incorporation_country?: string;
  aliases: string[];
  include_aliases: boolean;
  max_matches: number;
};

export async function launchSimpleScreening(payload: SimpleScreeningIn) {
  const { data } = await api.post("/screening/simple", payload); // ✅ ici
  return data as { request_id: string; status: string };
}


export async function listScreenings(params: {
  status?: string;
  provider?: string;
  name?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get("/analyst/screenings", { params });
  return data as {
    items: Array<{
      id: string;
      provider?: string | null;
      status?: string | null;
      created_at?: string | null;
      completed_at?: string | null;
      case_id?: string | null;
      kind?: string | null;
    }>;
    limit: number;
    offset: number;
    total: number;
  };
}

export async function getScreeningDetails(request_id: string) {
  const { data } = await api.get(`/analyst/screenings/${request_id}`);
  return data as {
    request: Record<string, any>;
    result?: Record<string, any> | null;
    matches: Array<Record<string, any>>;
    case?: Record<string, any> | null;
  };
}

// --------------------
// OCR + SCREENING FROM DOCUMENT (NEW)
// --------------------
export type UploadDocResp = {
  document_id: string;
  case_id?: string | null;
  ocr_status: string;
  object_key: string;
  preview_url: string;
  download_url: string;
};


export type OcrExtractResp = {
  doc_id: string;
  case_id?: string | null;
  ocr_status: string; // plus safe que union stricte
  ocr_confidence: number;
  extracted_fields: {
    last_name?: string;
    first_name?: string;
    date_of_birth?: string;
    document_number?: string;
  } | null;
  prefill?: any;
  preview_url: string;
  download_url: string;
};


export type ScreeningFromDocIn = {
  document_id: string;
  client_id?: string;
  country_focus?: string;
  override_name?: string; // ex: "MYRIANE INGRID NDONGUE"
};

export type ScreeningOut = {
  request_id: string;
  risk_level: string;
  confidence: number;
  recommended_action: string;
  top_matches: Array<any>;
};

// 1) upload document (recto)
export async function uploadCaseDocument(
  caseId: string,
  docType: string,
  file: File
): Promise<UploadDocResp> {
  const form = new FormData();
  form.append("doc_type", docType); // ex: "ID_CARD"
  form.append("file", file);

  const { data } = await api.post(`/documents/cases/${caseId}/upload`, form);
  return data as UploadDocResp;
}

// 2) OCR extract
export async function extractOcr(documentId: string): Promise<OcrExtractResp> {
  const { data } = await api.post(`/documents/${documentId}/extract`, {});
  return data as OcrExtractResp;
}

// 3) screening from document
export async function screeningFromDocument(payload: ScreeningFromDocIn): Promise<ScreeningOut> {
  const { data } = await api.post(`/screening/from-document`, payload);
  return data as ScreeningOut;
}
  //Upload document standalone (no case)
export async function uploadDocumentStandalone(docType: string, file: File): Promise<UploadDocResp> {
  const form = new FormData();
  form.append("doc_type", docType);
  form.append("file", file);
  const { data } = await api.post(`/documents/upload`, form);
  return data as UploadDocResp;
}


// 4) download export (PDF)

export async function downloadScreeningExportPdf(requestId: string) {
  const res = await api.get(`/screening/${requestId}/export.pdf`, {
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `screening_${requestId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
export async function setScreeningDecision(requestId: string, decision: "PASS" | "BLOCK", comment: string) {
  const { data } = await api.post(`/analyst/screenings/${requestId}/decision`, { decision, comment });
  return data as { ok: boolean; case_id: string; request_id: string; decision: string; decided_by: string };
}


// --------------------
// (OPTIONAL) If you still have SUMSUB code somewhere,
// keep it in another file (api.sumsub.ts) to avoid clutter.
// For now, removing Sumsub from AnalystHome is enough.
// --------------------
