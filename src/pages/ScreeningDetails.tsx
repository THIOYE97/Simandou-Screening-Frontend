// src/pages/ScreeningDetails.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadScreeningExportPdf, getScreeningDetails } from "../api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type AnyObj = Record<string, any>;

interface DecisionEntry {
  decision?: string | null;
  comment?: string | null;
  decided_by_email?: string | null;
  decided_at?: string | null;
}

interface ScreeningDetailsResp {
  request: AnyObj;
  result?: AnyObj | null;
  matches: AnyObj[];
  decision_latest?: DecisionEntry | null;
  decision_history?: DecisionEntry[];
}

interface Identity {
  lastName: string;
  firstName: string;
  dob: string;
  docNo: string;
  nationality: string;
  country: string;
  countryFocus: string;
}

interface DocItem {
  id?: unknown;
  name?: string;
  original_filename?: string;
  mime?: string;
  preview_url?: string;
  download_url?: string;
  ocr_status?: string;
  ocr_confidence: number | null;
  extracted_fields?: AnyObj;
  doc_type?: string;
  uploaded_at?: string;
}

interface NormalizedMatch {
  name: string;
  score: number | null;
  band: string | null;
  sourceBlock: AnyObj | null;
  sanctionBullets: string[];
  sanctionRaw: unknown;
  matchBullets: string[];
  matchRaw: unknown;
  reasonsHuman: string | null;
  raw: AnyObj;
}

interface FormState {
  lastName: string;
  firstName: string;
  dob: string;
  docNo: string;
}

// ─────────────────────────────────────────────
// Formatters & helpers
// ─────────────────────────────────────────────

function safeStr(x: unknown): string {
  return x == null ? "" : String(x).trim();
}

function fmtDate(s: unknown): string {
  if (!s) return "-";
  try { return new Date(String(s)).toLocaleString(); }
  catch { return String(s); }
}

function toPct(n: unknown): string | null {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `${Math.round(x <= 1 ? x * 100 : x)}%`;
}

function pct(c: number | null | undefined): string {
  return typeof c === "number" ? `${Math.round(c * 100)}%` : "—";
}

function isIsoDateLike(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function looksLikeUrl(s: unknown): boolean {
  return /^https?:\/\/\S+$/i.test(String(s ?? "").trim());
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function splitName(full: unknown): { firstName: string; lastName: string } {
  const s = safeStr(full);
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1)[0] };
}

// ─────────────────────────────────────────────
// Badge class helpers
// ─────────────────────────────────────────────

function statusBadgeClass(status: unknown): string {
  const v = String(status ?? "").toUpperCase();
  if (["DONE", "APPROVED", "PASS"].includes(v)) return "badge badge-ok";
  if (["RUNNING", "PENDING", "PENDING_REVIEW", "MANUAL_REVIEW"].includes(v)) return "badge badge-warn";
  if (["FAILED", "REJECTED", "ERROR", "BLOCK"].includes(v)) return "badge badge-bad";
  return "badge";
}

function decisionBadgeClass(decision: unknown): string {
  const v = String(decision ?? "").toUpperCase();
  if (v === "PASS") return "badge badge-ok";
  if (v === "BLOCK") return "badge badge-bad";
  return "badge";
}

function confidenceLabel(c: number | null | undefined): { label: string; tone: string } {
  if (typeof c !== "number") return { label: "—", tone: "badge" };
  if (c >= 0.85) return { label: "Très fiable", tone: "badge badge-ok" };
  if (c >= 0.7)  return { label: "Correct",    tone: "badge badge-warn" };
  return { label: "Faible", tone: "badge badge-bad" };
}

// ─────────────────────────────────────────────
// Human-readable labels
// ─────────────────────────────────────────────

function humanDecision(d: unknown): string {
  const v = String(d ?? "").toUpperCase();
  if (v === "PASS")  return "✅ PASS";
  if (v === "BLOCK") return "⛔ BLOCK";
  return v || "—";
}

function humanProvider(p: unknown): string {
  const v = String(p ?? "").toUpperCase();
  if (v === "INTERNAL") return "Interne";
  if (v === "SUMSUB")   return "Sumsub";
  return v || "-";
}

function humanAction(a: unknown): string {
  const v = String(a ?? "").toUpperCase();
  if (v === "PASS")          return "✅ Autoriser (Pass)";
  if (v === "MANUAL_REVIEW") return "🟠 Revue manuelle";
  if (v === "BLOCK")         return "⛔ Bloquer";
  return v || "-";
}

function humanRisk(r: unknown): string {
  const v = String(r ?? "").toUpperCase();
  if (v === "LOW")    return "Faible";
  if (v === "MEDIUM") return "Moyen";
  if (v === "HIGH")   return "Élevé";
  return v || "-";
}

// ─────────────────────────────────────────────
// Data pickers (read from API payload)
// ─────────────────────────────────────────────

function pickDecisionLatest(data: ScreeningDetailsResp | null): DecisionEntry | null {
  return data?.decision_latest ?? (data as any)?.decisionLatest ?? (data as any)?.analyst_decision_latest ?? null;
}

function pickDecisionHistory(data: ScreeningDetailsResp | null): DecisionEntry[] {
  const h = data?.decision_history
    ?? (data as any)?.decisionHistory
    ?? (data as any)?.analyst_decision_history
    ?? [];
  return Array.isArray(h) ? h : [];
}

function pickIdentity(data: ScreeningDetailsResp | null): Identity {
  const req     = data?.request ?? {};
  const payload = req.request_payload ?? {};

  const payloadDocs: AnyObj[] = Array.isArray(payload.documents) ? payload.documents : [];
  const docWithFields = payloadDocs.find((d) => d.extracted_fields || d.extractedFields);
  const docExtracted  = docWithFields?.extracted_fields ?? docWithFields?.extractedFields ?? null;

  const ocrFields = payload.document_fields ?? payload.documentFields
    ?? payload.extracted_fields ?? payload.extractedFields
    ?? payload.ocr ?? docExtracted ?? {};

  const split = splitName(req.client_name ?? req.clientName ?? payload.name ?? payload.full_name ?? "");

  return {
    lastName:     safeStr(split.lastName     ?? ocrFields.last_name  ?? ocrFields.lastName  ?? payload.last_name  ?? payload.lastName  ?? ""),
    firstName:    safeStr(split.firstName    ?? ocrFields.first_name ?? ocrFields.firstName ?? payload.first_name ?? payload.firstName ?? ""),
    dob:          safeStr(ocrFields.date_of_birth ?? ocrFields.dob ?? payload.dob ?? payload.date_of_birth ?? payload.dateOfBirth ?? ""),
    docNo:        safeStr(ocrFields.document_number ?? ocrFields.documentNumber ?? payload.document_number ?? payload.documentNumber ?? ""),
    nationality:  safeStr(payload.nationality  ?? ""),
    country:      safeStr(payload.country      ?? ""),
    countryFocus: safeStr(payload.country_focus ?? payload.countryFocus ?? ""),
  };
}

function getDisplayName(identity: Identity, payload: AnyObj | null): string {
  const override = payload?.override_name;
  if (override) return String(override).trim();
  const full = [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  const company = payload?.company_name ?? payload?.companyName;
  if (company) return String(company).trim();
  return payload?.name ? String(payload.name).trim() : "-";
}

function pickDocuments(data: ScreeningDetailsResp | null): DocItem[] {
  const payload  = data?.request?.request_payload ?? {};
  const rawDocs: AnyObj[] = Array.isArray(payload.documents) ? payload.documents : [];

  return rawDocs.map((d) => ({
    id:                d.id ?? d.document_id ?? d.doc_id,
    name:              d.name,
    original_filename: d.original_filename ?? d.originalFilename ?? d.filename,
    mime:              d.mime ?? d.mime_type ?? d.contentType,
    preview_url:       d.preview_url  ?? d.previewUrl,
    download_url:      d.download_url ?? d.downloadUrl,
    ocr_status:        d.ocr_status   ?? d.ocrStatus,
    ocr_confidence: (() => {
      const v = d.ocr_confidence ?? d.ocrConfidence;
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
      return null;
    })(),
    extracted_fields: d.extracted_fields ?? d.extractedFields,
    doc_type:         d.doc_type ?? d.docType,
    uploaded_at:      d.uploaded_at ?? d.uploadedAt,
  }));
}

function pickMainOcrMeta(data: ScreeningDetailsResp | null) {
  const payload = data?.request?.request_payload ?? {};
  const docs    = pickDocuments(data);

  const withOcr = docs
    .filter((d) => d.ocr_status || typeof d.ocr_confidence === "number")
    .sort((a, b) => Number(b.ocr_confidence ?? 0) - Number(a.ocr_confidence ?? 0));

  if (withOcr.length > 0) {
    return {
      status:     withOcr[0].ocr_status ?? null,
      confidence: typeof withOcr[0].ocr_confidence === "number" ? withOcr[0].ocr_confidence : null,
    };
  }

  const cf = payload.ocr_confidence ?? payload.ocrConfidence ?? null;
  return {
    status:     payload.ocr_status ? String(payload.ocr_status) : null,
    confidence: typeof cf === "number" ? cf : cf == null ? null : Number(cf),
  };
}

function normalizeMatches(raw: AnyObj[]): NormalizedMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 80).map((m) => ({
    name:           String(m.entity_name ?? m.entity_primary_name ?? m.name ?? "-"),
    score:          m.match_score != null ? Number(m.match_score) : m.matchScore != null ? Number(m.matchScore) : m.score != null ? Number(m.score) : null,
    band:           m.match_band_label ?? m.match_band ?? m.category ?? null,
    sourceBlock:    m.source_block ?? null,
    sanctionBullets: Array.isArray(m.sanction_explain?.bullets) ? m.sanction_explain.bullets : [],
    sanctionRaw:    m.sanction_explain?.raw ?? null,
    matchBullets:   Array.isArray(m.match_explain?.bullets) ? m.match_explain.bullets : [],
    matchRaw:       m.match_explain?.raw ?? null,
    reasonsHuman:   m.reasons_human ?? null,
    raw:            m,
  }));
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function Badge({
  children,
  className = "badge",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return <span className={className} title={title}>{children}</span>;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="nice-label">{label}</div>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="small" style={{ opacity: 0.85 }}>{hint}</div>}
    </div>
  );
}

function BulletList({ bullets, fallback }: { bullets: unknown[]; fallback: string }) {
  if (bullets.length > 0) {
    return (
      <ul className="match-ul">
        {bullets.slice(0, 12).map((b, i) => <li key={i}>{String(b)}</li>)}
      </ul>
    );
  }
  return <div className="small" style={{ opacity: 0.9 }}>{fallback}</div>;
}

function RawDetails({ raw, title = "Voir détails bruts" }: { raw: unknown; title?: string }) {
  if (raw == null) return null;
  return (
    <details className="match-details">
      <summary className="badge" style={{ cursor: "pointer" }}>{title}</summary>
      <div style={{ height: 10 }} />
      <pre className="match-pre">{JSON.stringify(raw, null, 2)}</pre>
    </details>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ScreeningDetails() {
  const { id } = useParams<{ id: string }>();

  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [data,    setData]    = useState<ScreeningDetailsResp | null>(null);
  const [showTech, setShowTech] = useState(false);

  const request    = data?.request   ?? null;
  const result     = data?.result    ?? null;
  const matchesRaw = Array.isArray(data?.matches) ? data.matches : [];

  const requestPayload  = useMemo(() => request?.request_payload ?? null, [request]);
  const identity        = useMemo(() => pickIdentity(data), [data]);
  const displayName     = useMemo(() => getDisplayName(identity, requestPayload), [identity, requestPayload]);
  const docs            = useMemo(() => pickDocuments(data), [data]);
  const mainOcr         = useMemo(() => pickMainOcrMeta(data), [data]);
  const matches         = useMemo(() => normalizeMatches(matchesRaw), [matchesRaw]);
  const decisionLatest  = useMemo(() => pickDecisionLatest(data), [data]);
  const decisionHistory = useMemo(() => pickDecisionHistory(data), [data]);

  const summary = useMemo(() => ({
    risk:       result?.risk_level       ?? result?.riskLevel       ?? null,
    confidence: result?.confidence       ?? null,
    action:     result?.recommended_action ?? result?.recommendedAction ?? null,
  }), [result]);

  const createdAt   = request?.created_at   ?? request?.createdAt   ?? null;
  const completedAt = request?.completed_at ?? request?.completedAt ?? null;
  const dossierLabel = displayName !== "-" ? displayName : request?.client_id ?? "-";

  async function load() {
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await getScreeningDetails(id);
      setData(d as ScreeningDetailsResp);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? String(e));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Analyst form (local state only) ───────
  const didInitRef  = useRef(false);
  const baselineRef = useRef<FormState | null>(null);
  const ocrRef      = useRef<FormState | null>(null);
  const [form, setForm] = useState<FormState>({ lastName: "", firstName: "", dob: "", docNo: "" });

  const computedBaseline = useMemo<FormState>(() => ({
    lastName:  safeStr(identity.lastName),
    firstName: safeStr(identity.firstName),
    dob:       safeStr(identity.dob),
    docNo:     safeStr(identity.docNo),
  }), [identity]);

  const computedOcr = useMemo<FormState>(() => {
    const best = docs.find((d) => d.extracted_fields) ?? null;
    const f    = best?.extracted_fields ?? requestPayload?.extracted_fields ?? requestPayload?.document_fields ?? {};
    return {
      lastName:  safeStr(f.last_name  ?? f.lastName  ?? identity.lastName),
      firstName: safeStr(f.first_name ?? f.firstName ?? identity.firstName),
      dob:       safeStr(f.date_of_birth ?? f.dob    ?? identity.dob),
      docNo:     safeStr(f.document_number ?? f.documentNumber ?? identity.docNo),
    };
  }, [docs, requestPayload, identity]);

  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      baselineRef.current = computedBaseline;
      ocrRef.current = computedOcr;
      setForm(computedBaseline);
      return;
    }
    const prev     = baselineRef.current;
    const modified = prev
      ? form.lastName !== prev.lastName || form.firstName !== prev.firstName
        || form.dob !== prev.dob || form.docNo !== prev.docNo
      : false;

    baselineRef.current = computedBaseline;
    ocrRef.current = computedOcr;
    if (!modified) setForm(computedBaseline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedBaseline.lastName, computedBaseline.firstName, computedBaseline.dob, computedBaseline.docNo]);

  const isModified = useMemo(() => {
    const base = baselineRef.current;
    return base
      ? form.lastName !== base.lastName || form.firstName !== base.firstName
        || form.dob !== base.dob || form.docNo !== base.docNo
      : false;
  }, [form]);

  const formErrors = useMemo(() => {
    const errs: string[] = [];
    if (form.dob && !isIsoDateLike(form.dob)) errs.push("La date de naissance doit être au format YYYY-MM-DD.");
    return errs;
  }, [form.dob]);

  function setField(k: keyof FormState, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-inner">

        {/* ── Header ── */}
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Screening Console
            </div>
            <div className="page-title">Détails du screening</div>
            <div className="page-subtitle"></div>
          </div>
          <div className="pill-row">
            <Link className="btn secondary" to="/screenings">← Retour</Link>
            <button className="btn secondary" onClick={load} disabled={busy}>
              {busy ? "Actualisation..." : "Refresh"}
            </button>
          </div>
        </div>

        {err && <div className="toast">❌ {err}</div>}

        {!data ? (
          <div className="screen">
            <div className="small">{busy ? "Chargement..." : "Pas de données."}</div>
          </div>
        ) : (
          <div className="grid-2">

            {/* ── LEFT COLUMN ── */}
            <div className="screen">

              {/* Résumé */}
              <div className="card" style={{ marginTop: 0 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="h2" style={{ marginTop: 0, marginBottom: 6 }}>Résumé</div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      Screening #{request?.id ?? id} — {humanProvider(request?.provider)} — {fmtDate(createdAt)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      className="btn"
                      onClick={() => downloadScreeningExportPdf(String(request?.id ?? id))}
                      disabled={!request?.id && !id}
                      title="Télécharger un PDF (partageable)"
                    >
                      ⬇️ Export PDF
                    </button>
                    
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <Badge className={statusBadgeClass(request?.status)} title="État actuel">
                    Statut: {request?.status ?? "-"}
                  </Badge>
                  <Badge title="Nom du client screené">Dossier: <b>{dossierLabel}</b></Badge>
                  <Badge title="Action recommandée">Décision recommandée: <b>{humanAction(summary.action)}</b></Badge>
                  <Badge title="Niveau de risque">Risque: <b>{humanRisk(summary.risk)}</b></Badge>
                  <Badge title="Indice de confiance">Confiance: <b>{toPct(summary.confidence) ?? "-"}</b></Badge>
                  <Badge title="Correspondances">Correspondances: <b>{matches.length}</b></Badge>
                </div>

                {/* Décision analyst */}
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="h2" style={{ marginTop: 0 }}>Décision analyst</div>
                      <div className="small" style={{ opacity: 0.9 }}>
                        
                      </div>
                    </div>
                    <span className="badge">
                      Dernière: <b>{decisionLatest ? humanDecision(decisionLatest.decision) : "—"}</b>
                    </span>
                  </div>

                  <div style={{ height: 10 }} />

                  {!decisionLatest ? (
                    <div className="small" style={{ opacity: 0.85 }}>Aucune décision enregistrée pour l'instant.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                        <span className={decisionBadgeClass(decisionLatest.decision)}>
                          Décision: <b>{humanDecision(decisionLatest.decision)}</b>
                        </span>
                        {decisionLatest.decided_by_email && (
                          <span className="badge">par: <b>{decisionLatest.decided_by_email}</b></span>
                        )}
                        {decisionLatest.decided_at && (
                          <span className="badge">le: <b>{fmtDate(decisionLatest.decided_at)}</b></span>
                        )}
                      </div>
                      <div className="small" style={{ opacity: decisionLatest.comment ? 0.95 : 0.85, lineHeight: 1.6 }}>
                        <b>Raison :</b> {decisionLatest.comment ? String(decisionLatest.comment) : "—"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Historique décisions */}
                {decisionHistory.length > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary className="badge" style={{ cursor: "pointer" }}>
                      Voir historique ({decisionHistory.length})
                    </summary>
                    <div style={{ height: 10 }} />
                    <div style={{ display: "grid", gap: 10 }}>
                      {decisionHistory.slice(0, 50).map((d, i) => (
                        <div
                          key={i}
                          style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,0.03)" }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <span className={decisionBadgeClass(d.decision)}>
                              <b>{humanDecision(d.decision)}</b>
                            </span>
                            <span className="small" style={{ opacity: 0.85 }}>
                              {fmtDate(d.decided_at)} · {d.decided_by_email ?? "—"}
                            </span>
                          </div>
                          <div className="small" style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.6 }}>
                            {d.comment ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Profil client */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                  <div>
                    <div className="h2" style={{ marginTop: 0 }}>Profil client</div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      
                    </div>
                  </div>
                  <div className="pill-row">
                    <span className="badge">ocr_status: <b style={{ marginLeft: 6 }}>{mainOcr.status ?? "—"}</b></span>
                    <span className="badge">conf globale: <b style={{ marginLeft: 6 }}>{pct(mainOcr.confidence)}</b></span>
                    <span className={confidenceLabel(mainOcr.confidence).tone}>
                      {confidenceLabel(mainOcr.confidence).label}
                    </span>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="profile-grid">
                  {[
                    ["Nom",               identity.lastName],
                    ["Prénoms",           identity.firstName],
                    ["Date de naissance", identity.dob],
                    ["N° document",       identity.docNo],
                    ["Nationalité",       identity.nationality],
                    ["Pays",              identity.country],
                  ].map(([label, value]) => (
                    <div className="profile-field" key={label}>
                      <div className="profile-label">{label}</div>
                      <div className="profile-value">{value || "—"}</div>
                    </div>
                  ))}
                </div>

                <div style={{ height: 14 }} />
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Documents soumis</div>

                {docs.length === 0 ? (
                  <div className="small" style={{ opacity: 0.85 }}>Aucun document disponible pour ce screening.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {docs.map((d, idx) => {
                      const mime    = d.mime ?? "";
                      const isImage = mime.startsWith("image/");
                      const isPdf   = mime === "application/pdf" || (d.original_filename ?? "").toLowerCase().endsWith(".pdf");
                      const title   = d.original_filename ?? d.name ?? `Document ${idx + 1}`;

                      return (
                        <div
                          key={idx}
                          style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.03)" }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800 }}>{title}</div>
                              <div className="small" style={{ opacity: 0.85, marginTop: 4 }}>
                                {d.doc_type        && <><b>Type:</b> {d.doc_type} · </>}
                                {mime              && <><b>MIME:</b> {mime} · </>}
                                {d.ocr_status      && <><b>OCR:</b> {d.ocr_status} · </>}
                                {typeof d.ocr_confidence === "number" && (
                                  <><b>Conf:</b> {Math.round(d.ocr_confidence * 100)}%</>
                                )}
                              </div>
                            </div>
                            <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {d.download_url && (
                                <a className="btn secondary" href={d.download_url} target="_blank" rel="noreferrer">⬇️ Télécharger</a>
                              )}
                              {d.preview_url && !isImage && (
                                <a className="btn secondary" href={d.preview_url} target="_blank" rel="noreferrer">
                                  {isPdf ? "📄 Ouvrir PDF" : "👁️ Ouvrir"}
                                </a>
                              )}
                            </div>
                          </div>

                          {d.preview_url && isImage && (
                            <>
                              <div style={{ height: 10 }} />
                              <img
                                src={d.preview_url}
                                alt={title}
                                style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 12,
                                         border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Formulaire analyst */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                  <div>
                    <div className="h2" style={{ marginTop: 0 }}>Formulaire analyst</div>
                    <div className="small" style={{ opacity: 0.9 }}>
                     
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                   
                  </div>
                </div>

                <div style={{ height: 12 }} />

                {formErrors.length > 0 && (
                  <div className="toast" style={{ margin: 0 }}>❌ {formErrors.join(" ")}</div>
                )}
                {!isModified && (
                  <div className="small" style={{ opacity: 0.8, marginTop: 8 }}>
                    
                  </div>
                )}

                <div style={{ height: 10 }} />
                <div style={{ display: "grid", gap: 14 }}>
                  <InputField label="Nom"               value={form.lastName}  onChange={(v) => setField("lastName",  v)} placeholder="Ex: TRAORÉ" />
                  <InputField label="Prénoms"            value={form.firstName} onChange={(v) => setField("firstName", v)} placeholder="Ex: Awa Mariam" />
                  <InputField label="Date de naissance"  value={form.dob}       onChange={(v) => setField("dob",       v)} placeholder="YYYY-MM-DD" hint="Format recommandé: YYYY-MM-DD" />
                  <InputField label="N° Document"        value={form.docNo}     onChange={(v) => setField("docNo",     v)} placeholder="Ex: AB1234567" />
                </div>
              </div>

              {/* Correspondances */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                  <div>
                    <div className="h2" style={{ marginTop: 0 }}>Correspondances trouvées</div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      
                    </div>
                  </div>
                  <Badge className={matches.length === 0 ? "badge badge-ok" : "badge badge-warn"}>
                    {matches.length === 0 ? "Aucune correspondance" : `${matches.length} résultat(s)`}
                  </Badge>
                </div>

                <div style={{ height: 12 }} />

                {matches.length === 0 ? (
                  <div className="small" style={{ opacity: 0.9 }}>Rien à signaler pour l'instant.</div>
                ) : (
                  <div className="match-list">
                    {matches.map((m, idx) => {
                      const scorePct = toPct(m.score);
                      const tone     = m.score != null && m.score >= 90 ? "badge badge-bad"
                                     : m.score != null && m.score >= 75 ? "badge badge-warn"
                                     : "badge";
                      const sb = m.sourceBlock as any;

                      return (
                        <div className="match-card" key={idx}>
                          <div className="match-top">
                            <div style={{ minWidth: 0 }}>
                              <div className="match-name">{m.name}</div>
                              <div className="match-meta">
                                {m.band    && <>Catégorie : <b>{m.band}</b></>}
                                {sb?.label && <> · Source : <b>{sb.label}</b></>}
                                {sb?.ref   && <> · Réf : <b>{sb.ref}</b></>}
                                {sb?.program && <> · Programme : <b>{sb.program}</b></>}
                              </div>
                            </div>
                            <span className={tone}>Score : <b>{scorePct ?? "—"}</b></span>
                          </div>

                          <div className="match-section">
                            <div className="match-section-title">Motifs / raisons (sanction / décision)</div>
                            <BulletList bullets={m.sanctionBullets} fallback={sb?.summary ?? "Aucun motif détaillé dans la source."} />
                            <RawDetails raw={m.sanctionRaw} title="Voir détails bruts (source / sanction)" />
                          </div>

                          {sb && (
                            <div className="match-section">
                              <div className="match-section-title">Source officielle</div>
                              <div className="match-par" style={{ display: "grid", gap: 6 }}>
                                {sb.record_type && <div><b>Type :</b> {sb.record_type}</div>}
                                {sb.listed_on   && <div><b>Inscrit le :</b> {sb.listed_on}</div>}
                                {sb.unlisted_on && <div><b>Retiré le :</b> {sb.unlisted_on}</div>}
                                {sb.summary     && <div><b>Résumé :</b> {sb.summary}</div>}
                              </div>
                              {Array.isArray(sb.links) && sb.links.length > 0 && (
                                <div className="match-par" style={{ marginTop: 8 }}>
                                  <b>Liens (preuves) :</b>
                                  <ul className="match-ul">
                                    {sb.links.map(asText).filter(looksLikeUrl).slice(0, 8).map((u: string, i: number) => (
                                      <li key={i}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          <details className="match-details">
                            <summary className="badge" style={{ cursor: "pointer" }}>Pourquoi ce match (technique)</summary>
                            <div style={{ height: 10 }} />
                            <BulletList
                              bullets={m.matchBullets}
                              fallback={m.reasonsHuman ?? "Correspondance détectée par le moteur (détails techniques disponibles)."}
                            />
                            <RawDetails raw={m.matchRaw ?? (m.raw as any)?.reasons ?? m.raw} title="Voir raisons brutes (matching)" />
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chronologie */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="h2" style={{ marginTop: 0 }}>Chronologie</div>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <Badge title="Création">Créé: <b>{fmtDate(createdAt)}</b></Badge>
                  <Badge title="Fin">Terminé: <b>{fmtDate(completedAt)}</b></Badge>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="screen">
              <div className="h2" style={{ marginTop: 0 }}>Aide & Explications</div>

              <div className="card" style={{ marginTop: 8 }}>
                <div className="small" style={{ lineHeight: 1.7, opacity: 0.95 }}>
                  <b>Comment lire cette page ?</b>
                  <ul style={{ marginTop: 8 }}>
                    <li><b>Motifs sanction</b> : la partie la plus importante (source officielle).</li>
                    <li><b>Source officielle</b> : type, programme, dates, liens.</li>
                    <li><b>Pourquoi ce match</b> : explications techniques.</li>
                    <li><b>Décision analyst</b> : affichée en lecture seule (prise dans le popup).</li>
                  </ul>
                </div>
                <div style={{ height: 10 }} />
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <Link className="btn secondary" to="/screenings">📋 Retour à la liste</Link>
                  <button
                    className="btn secondary"
                    onClick={() => downloadScreeningExportPdf(String(request?.id ?? id))}
                    disabled={!request?.id && !id}
                  >
                    ⬇️ Export PDF
                  </button>
                </div>
              </div>

              {/* Détails techniques */}
              {showTech && (
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="h2" style={{ marginTop: 0 }}>Détails techniques</div>
                  <div className="small" style={{ opacity: 0.9, marginBottom: 8 }}>À utiliser uniquement en debug.</div>

                  {[
                    ["request (raw)", request],
                    ["result (raw)",  result],
                    ["matches (raw)", matchesRaw],
                    ["data (raw)",    data],
                  ].map(([label, val]) => (
                    <details key={String(label)} style={{ marginBottom: 10 }}>
                      <summary className="badge" style={{ cursor: "pointer" }}>Voir {label}</summary>
                      <div style={{ height: 10 }} />
                      <textarea readOnly value={JSON.stringify(val ?? null, null, 2)} />
                    </details>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}