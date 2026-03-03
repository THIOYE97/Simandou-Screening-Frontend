// src/pages/ScreeningDetails.tsx
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadScreeningExportPdf, getScreeningDetails } from "../api";

/**
 * ✅ OBJECTIF
 * - Page "details" 100% READ-ONLY pour la décision analyst :
 *   - on affiche seulement decision_latest + decision_history renvoyés par l’API
 *   - on NE va PLUS chercher dans data.case.*
 *
 * ✅ Hypothèse de payload API (aligné analyst.py récent) :
 * {
 *   request: {..., request_payload: {...}},
 *   result: {...},
 *   matches: [...],
 *   decision_latest: { decision, comment, decided_by_email, decided_at } | null,
 *   decision_history: [{...}, ...]
 * }
 */

type AnyObj = Record<string, any>;

type ScreeningDetailsResp = {
  request: AnyObj;
  result?: AnyObj | null;
  matches: any[];
  decision_latest?: AnyObj | null;
  decision_history?: AnyObj[];
};

type Identity = {
  lastName: string;
  firstName: string;
  dob: string;
  docNo: string;
  nationality: string;
  country: string;
  countryFocus: string;
};

type BadgeProps = {
  children: ReactNode;
  className?: string;
  title?: string;
};

type FormState = {
  lastName: string;
  firstName: string;
  dob: string;
  docNo: string;
};

function confidenceLabel(c: any) {
  if (typeof c !== "number") return { label: "—", tone: "badge" };
  if (c >= 0.85) return { label: "Très fiable", tone: "badge badge-ok" };
  if (c >= 0.7) return { label: "Correct", tone: "badge badge-warn" };
  return { label: "Faible", tone: "badge badge-bad" };
}

function pct(c: any) {
  if (typeof c !== "number") return "—";
  return `${Math.round(c * 100)}%`;
}

function Badge({ children, className, title }: BadgeProps) {
  return (
    <span className={className || "badge"} title={title}>
      {children}
    </span>
  );
}

function statusBadgeClass(status: any) {
  const v = String(status || "").toUpperCase();
  if (["DONE", "APPROVED", "PASS"].includes(v)) return "badge badge-ok";
  if (["RUNNING", "PENDING", "PENDING_REVIEW", "MANUAL_REVIEW"].includes(v)) return "badge badge-warn";
  if (["FAILED", "REJECTED", "ERROR", "BLOCK"].includes(v)) return "badge badge-bad";
  return "badge";
}

function humanDecision(d: any) {
  const v = String(d || "").toUpperCase();
  if (v === "PASS") return "✅ PASS";
  if (v === "BLOCK") return "⛔ BLOCK";
  return v || "—";
}

function fmtDate(s: any) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s);
  }
}

function toPct(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const p = x <= 1 ? x * 100 : x;
  return `${Math.round(p)}%`;
}

function humanProvider(p: any) {
  const v = String(p || "").toUpperCase();
  if (!v) return "-";
  if (v === "INTERNAL") return "Interne";
  if (v === "SUMSUB") return "Sumsub";
  return v;
}

function humanAction(a: any) {
  const v = String(a || "").toUpperCase();
  if (!v) return "-";
  if (v === "PASS") return "✅ Autoriser (Pass)";
  if (v === "MANUAL_REVIEW") return "🟠 Revue manuelle";
  if (v === "BLOCK") return "⛔ Bloquer";
  return v;
}

function humanRisk(r: any) {
  const v = String(r || "").toUpperCase();
  if (!v) return "-";
  if (v === "LOW") return "Faible";
  if (v === "MEDIUM") return "Moyen";
  if (v === "HIGH") return "Élevé";
  return v;
}

function safeStr(x: any) {
  const v = x == null ? "" : String(x);
  return v.trim();
}

function isIsoDateLike(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function splitName(full: any) {
  const s = safeStr(full);
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1)[0] };
}

// ------------------------------------------------------------
// ✅ Identity & documents : NE DEPEND PAS DE data.case
// ------------------------------------------------------------
function pickBestDocExtractedFieldsFromPayload(payload: any) {
  const payloadDocs = Array.isArray(payload?.documents) ? payload.documents : [];
  const withFields = payloadDocs.filter((d: any) => d?.extracted_fields || d?.extractedFields);
  if (withFields.length === 0) return null;
  return withFields[0].extracted_fields ?? withFields[0].extractedFields ?? null;
}

function pickIdentity(data: ScreeningDetailsResp | null): Identity {
  const req = data?.request ?? null;
  const payload = req?.request_payload ?? null;

  const docExtracted = pickBestDocExtractedFieldsFromPayload(payload);
  const ocrFields =
    payload?.document_fields ||
    payload?.documentFields ||
    payload?.extracted_fields ||
    payload?.extractedFields ||
    payload?.ocr ||
    docExtracted ||
    null;

  const clientName = safeStr(req?.client_name || req?.clientName || payload?.name || payload?.full_name || "");
  const split = clientName ? splitName(clientName) : { firstName: "", lastName: "" };

  const lastName =
    split.lastName ??
    ocrFields?.last_name ??
    ocrFields?.lastName ??
    payload?.last_name ??
    payload?.lastName ??
    "";

  const firstName =
    split.firstName ??
    ocrFields?.first_name ??
    ocrFields?.firstName ??
    payload?.first_name ??
    payload?.firstName ??
    "";

  const dob =
    ocrFields?.date_of_birth ??
    ocrFields?.dob ??
    payload?.dob ??
    payload?.date_of_birth ??
    payload?.dateOfBirth ??
    "";

  const docNo =
    ocrFields?.document_number ??
    ocrFields?.documentNumber ??
    payload?.document_number ??
    payload?.documentNumber ??
    "";

  const nationality = payload?.nationality ?? "";
  const country = payload?.country ?? "";
  const countryFocus = payload?.country_focus ?? payload?.countryFocus ?? "";

  return {
    lastName: safeStr(lastName),
    firstName: safeStr(firstName),
    dob: safeStr(dob),
    docNo: safeStr(docNo),
    nationality: safeStr(nationality),
    country: safeStr(country),
    countryFocus: safeStr(countryFocus),
  };
}

function getDisplayNameFromIdentity(i: Identity, payload: any) {
  const override = payload?.override_name;
  if (override && String(override).trim()) return String(override).trim();

  const n = [i.firstName, i.lastName].filter(Boolean).join(" ").trim();
  if (n) return n;

  const company = payload?.company_name || payload?.companyName;
  if (company) return String(company).trim();

  const payloadName = payload?.name;
  if (payloadName) return String(payloadName).trim();

  return "-";
}

function pickDocuments(data: ScreeningDetailsResp | null) {
  const payload = data?.request?.request_payload ?? null;
  const payloadDocs = Array.isArray(payload?.documents) ? payload.documents : [];
  if (!Array.isArray(payloadDocs)) return [];

  return payloadDocs.map((d: any) => ({
    id: d?.id ?? d?.document_id ?? d?.doc_id,
    name: d?.name,
    original_filename: d?.original_filename ?? d?.originalFilename ?? d?.filename,
    mime: d?.mime ?? d?.mime_type ?? d?.contentType,
    preview_url: d?.preview_url ?? d?.previewUrl,
    download_url: d?.download_url ?? d?.downloadUrl,
    ocr_status: d?.ocr_status ?? d?.ocrStatus,
    ocr_confidence: (() => {
      const v = d?.ocr_confidence ?? d?.ocrConfidence;
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
      return null;
    })(),
    extracted_fields: d?.extracted_fields ?? d?.extractedFields,
    doc_type: d?.doc_type ?? d?.docType,
    uploaded_at: d?.uploaded_at ?? d?.uploadedAt,
  }));
}

function pickMainOcrMeta(data: ScreeningDetailsResp | null) {
  const payload = data?.request?.request_payload ?? null;
  const docs = pickDocuments(data);

  const withOcr = docs
    .filter((d: any) => d?.ocr_status || typeof d?.ocr_confidence === "number")
    .sort((a: any, b: any) => Number(b.ocr_confidence ?? 0) - Number(a.ocr_confidence ?? 0));

  if (withOcr.length > 0) {
    return {
      status: withOcr[0].ocr_status ?? null,
      confidence: typeof withOcr[0].ocr_confidence === "number" ? withOcr[0].ocr_confidence : null,
    };
  }

  const st = payload?.ocr_status ?? payload?.ocrStatus ?? null;
  const cf = payload?.ocr_confidence ?? payload?.ocrConfidence ?? null;
  return {
    status: st ? String(st) : null,
    confidence: typeof cf === "number" ? cf : cf == null ? null : Number(cf),
  };
}

function asText(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function looksLikeUrl(s: any) {
  return /^https?:\/\/\S+$/i.test(String(s || "").trim());
}

/**
 * ✅ Normalisation alignée backend:
 * - sanction_explain.bullets / raw
 * - match_explain.bullets / raw
 * - source_block (label, ref, program, record_type, listed_on, unlisted_on, summary, links)
 */
function normalizeMatches(raw: any[]) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 80).map((m: any) => {
    const name = m?.entity_name || m?.entity_primary_name || m?.name || "-";
    const score = m?.match_score ?? m?.matchScore ?? m?.score ?? null;
    const band = m?.match_band_label || m?.match_band || m?.category || null;

    const sb = m?.source_block || null;

    const sanctionBullets = Array.isArray(m?.sanction_explain?.bullets) ? m.sanction_explain.bullets : [];
    const sanctionRaw = m?.sanction_explain?.raw ?? null;

    const matchBullets = Array.isArray(m?.match_explain?.bullets) ? m.match_explain.bullets : [];
    const matchRaw = m?.match_explain?.raw ?? null;

    const reasonsHuman = m?.reasons_human || null;

    return {
      name: String(name),
      score: score == null ? null : Number(score),
      band: band ? String(band) : null,

      sourceBlock: sb,

      sanctionBullets,
      sanctionRaw,

      matchBullets,
      matchRaw,

      reasonsHuman,
      raw: m,
    };
  });
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
      <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
        <div className="nice-label">{label}</div>
      </div>

      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint ? (
        <div className="small" style={{ opacity: 0.85 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function renderBulletsOrFallback(bullets: any, fallback: any) {
  if (Array.isArray(bullets) && bullets.length > 0) {
    return (
      <ul className="match-ul">
        {bullets.slice(0, 12).map((b: any, i: number) => (
          <li key={i}>{String(b)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="small" style={{ opacity: 0.9 }}>
      {fallback}
    </div>
  );
}

function renderRawDetails(raw: any, title = "Voir détails bruts") {
  if (raw == null) return null;
  return (
    <details className="match-details">
      <summary className="badge" style={{ cursor: "pointer" }}>
        {title}
      </summary>
      <div style={{ height: 10 }} />
      <pre className="match-pre">{JSON.stringify(raw, null, 2)}</pre>
    </details>
  );
}

function decisionBadgeClass(decision: any) {
  const v = String(decision || "").toUpperCase();
  if (v === "PASS") return "badge badge-ok";
  if (v === "BLOCK") return "badge badge-bad";
  return "badge";
}

// ✅ prend la décision UNIQUEMENT depuis data.decision_latest / data.decision_history
function pickDecisionLatest(data: ScreeningDetailsResp | null) {
  return (data as any)?.decision_latest ?? (data as any)?.decisionLatest ?? (data as any)?.analyst_decision_latest ?? null;
}

function pickDecisionHistory(data: ScreeningDetailsResp | null) {
  const h =
    (data as any)?.decision_history ??
    (data as any)?.decisionHistory ??
    (data as any)?.analyst_decision_history ??
    (data as any)?.analystDecisionHistory ??
    [];
  return Array.isArray(h) ? h : [];
}

export default function ScreeningDetails() {
  const { id } = useParams<{ id: string }>();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ScreeningDetailsResp | null>(null);
  const [showTech, setShowTech] = useState(false);

  const request = data?.request ?? null;
  const result = data?.result ?? null;
  const matchesRaw = Array.isArray(data?.matches) ? data.matches : [];

  const requestPayload = useMemo(() => request?.request_payload ?? null, [request]);

  const identity = useMemo(() => pickIdentity(data), [data]);
  const displayName = useMemo(() => getDisplayNameFromIdentity(identity, requestPayload), [identity, requestPayload]);

  const docs = useMemo(() => pickDocuments(data), [data]);
  const mainOcr = useMemo(() => pickMainOcrMeta(data), [data]);
  const matches = useMemo(() => normalizeMatches(matchesRaw), [matchesRaw]);

  const createdAt = request?.created_at || request?.createdAt || null;
  const completedAt = request?.completed_at || request?.completedAt || null;

  // ✅ Décisions (read-only) : ne plus dépendre de data.case.*
  const decisionLatest = useMemo(() => pickDecisionLatest(data), [data]);
  const decisionHistory = useMemo(() => pickDecisionHistory(data), [data]);

  const summary = useMemo(() => {
    const risk = result?.risk_level ?? result?.riskLevel ?? null;
    const confidence = result?.confidence ?? null;
    const action = result?.recommended_action ?? result?.recommendedAction ?? null;
    return { risk, confidence, action };
  }, [result]);

  const dossierLabel = displayName && displayName !== "-" ? displayName : request?.client_id || "-";

  async function load() {
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const d: any = await getScreeningDetails(id);
      setData(d as ScreeningDetailsResp);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || String(e));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ----------------------------
  // (Optionnel) Formulaire analyst - reste local tant que l’API save n’est pas branchée
  // ----------------------------
  const didInitRef = useRef(false);
  const baselineRef = useRef<FormState | null>(null);
  const ocrRef = useRef<FormState | null>(null);

  const [form, setForm] = useState<FormState>({ lastName: "", firstName: "", dob: "", docNo: "" });

  const computedBaseline = useMemo<FormState>(() => {
    const ln = safeStr(identity?.lastName);
    const fn = safeStr(identity?.firstName);
    const dob = safeStr(identity?.dob);
    const docNo = safeStr(identity?.docNo);
    return { lastName: ln, firstName: fn, dob, docNo };
  }, [identity]);

  const computedOcr = useMemo<FormState>(() => {
    const best = docs.find((d: any) => d?.extracted_fields) || null;
    const f = best?.extracted_fields || requestPayload?.extracted_fields || requestPayload?.document_fields || null;

    const ln = safeStr(f?.last_name ?? f?.lastName ?? identity?.lastName);
    const fn = safeStr(f?.first_name ?? f?.firstName ?? identity?.firstName);
    const dob = safeStr(f?.date_of_birth ?? f?.dob ?? identity?.dob);
    const docNo = safeStr(f?.document_number ?? f?.documentNumber ?? identity?.docNo);

    return { lastName: ln, firstName: fn, dob, docNo };
  }, [docs, requestPayload, identity]);

  useEffect(() => {
    const base = computedBaseline;
    const ocr = computedOcr;

    if (!didInitRef.current) {
      didInitRef.current = true;
      baselineRef.current = base;
      ocrRef.current = ocr;
      setForm(base);
      return;
    }

    const cur = form;
    const wasModified = baselineRef.current
      ? cur.lastName !== baselineRef.current.lastName ||
        cur.firstName !== baselineRef.current.firstName ||
        cur.dob !== baselineRef.current.dob ||
        cur.docNo !== baselineRef.current.docNo
      : false;

    baselineRef.current = base;
    ocrRef.current = ocr;

    if (!wasModified) setForm(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedBaseline.lastName, computedBaseline.firstName, computedBaseline.dob, computedBaseline.docNo]);

  const isModified = useMemo(() => {
    const base = baselineRef.current;
    if (!base) return false;
    return (
      form.lastName !== base.lastName || form.firstName !== base.firstName || form.dob !== base.dob || form.docNo !== base.docNo
    );
  }, [form]);

  function setField(k: keyof FormState, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function applyOcrToForm() {
    const o = ocrRef.current || computedOcr;
    setForm(o);
  }

  function resetForm() {
    const base = baselineRef.current || computedBaseline;
    setForm(base);
  }

  const formErrors = useMemo(() => {
    const errs: string[] = [];
    if (form.dob && !isIsoDateLike(form.dob)) errs.push("La date de naissance doit être au format YYYY-MM-DD.");
    return errs;
  }, [form.dob]);

  async function save() {
    alert("TODO: brancher un endpoint de save si tu veux persister ces champs (pas lié à la décision PASS/BLOCK).");
  }

  return (
    <div className="page">
      <div className="page-inner">
        {/* Header */}
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Screening Console
            </div>
            <div className="page-title">Détails du screening</div>
            <div className="page-subtitle">Vue lisible : résumé, données collectées, résultats, décisions et export PDF.</div>
          </div>

          <div className="pill-row">
            <Link className="btn secondary" to="/screenings">
              ← Retour
            </Link>
            <button className="btn secondary" onClick={load} disabled={busy}>
              {busy ? "Actualisation..." : "Refresh"}
            </button>
          </div>
        </div>

        {err ? <div className="toast">❌ {err}</div> : null}

        {!data ? (
          <div className="screen">
            <div className="small">{busy ? "Chargement..." : "Pas de données."}</div>
          </div>
        ) : (
          <div className="grid-2">
            {/* LEFT */}
            <div className="screen">
              {/* Top summary */}
              <div className="card" style={{ marginTop: 0 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="h2" style={{ marginTop: 0, marginBottom: 6 }}>
                      Résumé
                    </div>
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
                    <button className="btn secondary" onClick={() => setShowTech((v) => !v)}>
                      {showTech ? "Masquer détails techniques" : "Afficher détails techniques"}
                    </button>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <Badge className={statusBadgeClass(request?.status)} title="État actuel du screening">
                    Statut: {request?.status || "-"}
                  </Badge>

                  <Badge title="Nom du client screené">
                    Dossier: <b>{dossierLabel}</b>
                  </Badge>

                  <Badge title="Action recommandée (interne)">
                    Décision recommandée: <b>{humanAction(summary.action)}</b>
                  </Badge>

                  <Badge title="Niveau de risque détecté">
                    Risque: <b>{humanRisk(summary.risk)}</b>
                  </Badge>

                  <Badge title="Indice de confiance du moteur">
                    Confiance: <b>{toPct(summary.confidence) ?? "-"}</b>
                  </Badge>

                  <Badge title="Nombre de correspondances trouvées">
                    Correspondances: <b>{matches.length}</b>
                  </Badge>
                </div>

                {/* ✅ Décision analyst (read-only) */}
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="h2" style={{ marginTop: 0 }}>
                        Décision analyst
                      </div>
                      <div className="small" style={{ opacity: 0.9 }}>
                        Décision prise dans le popup (audit trail) — affichage en lecture seule.
                      </div>
                    </div>

                    <span className="badge">
                      Dernière: <b>{decisionLatest ? humanDecision((decisionLatest as any).decision) : "—"}</b>
                    </span>
                  </div>

                  <div style={{ height: 10 }} />

                  {!decisionLatest ? (
                    <div className="small" style={{ opacity: 0.85 }}>
                      Aucune décision enregistrée pour l’instant.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                        <span className={decisionBadgeClass((decisionLatest as any).decision)}>
                          Décision: <b>{humanDecision((decisionLatest as any).decision)}</b>
                        </span>
                        {(decisionLatest as any).decided_by_email ? (
                          <span className="badge">
                            par: <b>{(decisionLatest as any).decided_by_email}</b>
                          </span>
                        ) : null}
                        {(decisionLatest as any).decided_at ? (
                          <span className="badge">
                            le: <b>{fmtDate((decisionLatest as any).decided_at)}</b>
                          </span>
                        ) : null}
                      </div>

                      {(decisionLatest as any).comment ? (
                        <div style={{ opacity: 0.95, lineHeight: 1.6 }}>
                          <b>Raison :</b> {String((decisionLatest as any).comment)}
                        </div>
                      ) : (
                        <div className="small" style={{ opacity: 0.85 }}>
                          <b>Raison :</b> —
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {decisionHistory.length > 0 ? (
                  <details style={{ marginTop: 12 }}>
                    <summary className="badge" style={{ cursor: "pointer" }}>
                      Voir historique ({decisionHistory.length})
                    </summary>
                    <div style={{ height: 10 }} />
                    <div style={{ display: "grid", gap: 10 }}>
                      {decisionHistory.slice(0, 50).map((d: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            padding: 10,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <span className={decisionBadgeClass(d?.decision)}>
                              <b>{humanDecision(d?.decision)}</b>
                            </span>
                            <span className="small" style={{ opacity: 0.85 }}>
                              {fmtDate(d?.decided_at)} · {d?.decided_by_email || "—"}
                            </span>
                          </div>
                          <div className="small" style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.6 }}>
                            {d?.comment || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              {/* ✅ Profil client / Données collectées */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                  <div>
                    <div className="h2" style={{ marginTop: 0 }}>
                      Profil client
                    </div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      Identité, données utilisées, et documents soumis (incl. photo ID).
                    </div>
                  </div>

                  <div className="pill-row">
                    <span className="badge">
                      ocr_status: <b style={{ marginLeft: 6 }}>{mainOcr.status || "—"}</b>
                    </span>
                    <span className="badge">
                      conf globale: <b style={{ marginLeft: 6 }}>{pct(mainOcr.confidence)}</b>
                    </span>
                    <span className={confidenceLabel(mainOcr.confidence).tone}>{confidenceLabel(mainOcr.confidence).label}</span>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="profile-grid">
                  <div className="profile-field">
                    <div className="profile-label">Nom</div>
                    <div className="profile-value">{identity.lastName || "—"}</div>
                  </div>
                  <div className="profile-field">
                    <div className="profile-label">Prénoms</div>
                    <div className="profile-value">{identity.firstName || "—"}</div>
                  </div>
                  <div className="profile-field">
                    <div className="profile-label">Date de naissance</div>
                    <div className="profile-value">{identity.dob || "—"}</div>
                  </div>
                  <div className="profile-field">
                    <div className="profile-label">N° document</div>
                    <div className="profile-value">{identity.docNo || "—"}</div>
                  </div>
                  <div className="profile-field">
                    <div className="profile-label">Nationalité</div>
                    <div className="profile-value">{identity.nationality || "—"}</div>
                  </div>
                  <div className="profile-field">
                    <div className="profile-label">Pays</div>
                    <div className="profile-value">{identity.country || "—"}</div>
                  </div>
                </div>

                <div style={{ height: 14 }} />
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Documents soumis</div>

                {docs.length > 0 ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {docs.map((d: any, idx: number) => {
                      const preview = d.preview_url;
                      const download = d.download_url;

                      const mime = d.mime || "";
                      const isImage = mime.startsWith("image/");
                      const isPdf = mime === "application/pdf" || String(d.original_filename || "").toLowerCase().endsWith(".pdf");

                      const title = d.original_filename || d.name || `Document ${idx + 1}`;

                      return (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 14,
                            padding: 12,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800 }}>{title}</div>
                              <div className="small" style={{ opacity: 0.85, marginTop: 4 }}>
                                {d.doc_type ? (
                                  <>
                                    Type: <b>{d.doc_type}</b> ·{" "}
                                  </>
                                ) : null}
                                {mime ? (
                                  <>
                                    MIME: <b>{mime}</b> ·{" "}
                                  </>
                                ) : null}
                                {d.ocr_status ? (
                                  <>
                                    OCR: <b>{d.ocr_status}</b> ·{" "}
                                  </>
                                ) : null}
                                {typeof d.ocr_confidence === "number" ? (
                                  <>
                                    Conf: <b>{Math.round(d.ocr_confidence * 100)}%</b>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {download ? (
                                <a className="btn secondary" href={download} target="_blank" rel="noreferrer">
                                  ⬇️ Télécharger
                                </a>
                              ) : null}
                              {preview && !isImage ? (
                                <a className="btn secondary" href={preview} target="_blank" rel="noreferrer">
                                  {isPdf ? "📄 Ouvrir PDF" : "👁️ Ouvrir"}
                                </a>
                              ) : null}
                            </div>
                          </div>

                          {preview && isImage ? (
                            <>
                              <div style={{ height: 10 }} />
                              <img
                                src={preview}
                                alt={title}
                                style={{
                                  width: "100%",
                                  maxHeight: 320,
                                  objectFit: "contain",
                                  borderRadius: 12,
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  background: "rgba(0,0,0,0.2)",
                                }}
                              />
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="small" style={{ opacity: 0.85 }}>
                    Aucun document disponible pour ce screening.
                  </div>
                )}
              </div>

              {/* (Optionnel) Formulaire analyst - pas la décision PASS/BLOCK */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                  <div>
                    <div className="h2" style={{ marginTop: 0 }}>
                      Formulaire analyst
                    </div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      Ajuste les champs si besoin (baseline payload &gt; OCR). (Le save API reste à brancher.)
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn secondary" onClick={applyOcrToForm} title="Revenir aux valeurs OCR">
                      ↺ Appliquer OCR
                    </button>
                    <button className="btn secondary" onClick={resetForm} title="Annuler les modifications">
                      🧹 Réinitialiser
                    </button>
                    <button className="btn" onClick={save} disabled={!isModified || formErrors.length > 0}>
                      ✅ Valider
                    </button>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                {formErrors.length > 0 ? (
                  <div className="toast" style={{ margin: 0 }}>
                    ❌ {formErrors.join(" ")}
                  </div>
                ) : null}

                {!isModified ? (
                  <div className="small" style={{ opacity: 0.8, marginTop: 8 }}>
                    Aucune modification détectée — le bouton <b>Valider</b> reste désactivé.
                  </div>
                ) : null}

                <div style={{ height: 10 }} />

                <div style={{ display: "grid", gap: 14 }}>
                  <InputField label="Nom" value={form.lastName} onChange={(v) => setField("lastName", v)} placeholder="Ex: TRAORÉ" />
                  <InputField label="Prénoms" value={form.firstName} onChange={(v) => setField("firstName", v)} placeholder="Ex: Awa Mariam" />
                  <InputField
                    label="Date de naissance"
                    value={form.dob}
                    onChange={(v) => setField("dob", v)}
                    placeholder="YYYY-MM-DD"
                    hint="Format recommandé: YYYY-MM-DD"
                  />
                  <InputField label="N° Document" value={form.docNo} onChange={(v) => setField("docNo", v)} placeholder="Ex: AB1234567" />
                </div>
              </div>

              {/* ✅ Matches */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                  <div>
                    <div className="h2" style={{ marginTop: 0 }}>
                      Correspondances trouvées
                    </div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      Lis d’abord “Motifs / raisons”, puis “Source officielle”, puis “Pourquoi ce match”.
                    </div>
                  </div>
                  <Badge className={matches.length === 0 ? "badge badge-ok" : "badge badge-warn"}>
                    {matches.length === 0 ? "Aucune correspondance" : `${matches.length} résultat(s)`}
                  </Badge>
                </div>

                <div style={{ height: 12 }} />

                {matches.length === 0 ? (
                  <div className="small" style={{ opacity: 0.9 }}>
                    Rien à signaler pour l’instant.
                  </div>
                ) : (
                  <div className="match-list">
                    {matches.map((m: any, idx: number) => {
                      const scorePct = toPct(m.score);
                      const scoreN = typeof m.score === "number" ? m.score : null;

                      const tone = scoreN != null && scoreN >= 90 ? "badge badge-bad" : scoreN != null && scoreN >= 75 ? "badge badge-warn" : "badge";
                      const sb = m.sourceBlock;

                      return (
                        <div className="match-card" key={idx}>
                          <div className="match-top">
                            <div style={{ minWidth: 0 }}>
                              <div className="match-name">{m.name}</div>
                              <div className="match-meta">
                                {m.band ? (
                                  <>
                                    Catégorie : <b>{m.band}</b>
                                  </>
                                ) : null}
                                {sb?.label ? (
                                  <>
                                    {" "}
                                    · Source : <b>{sb.label}</b>
                                  </>
                                ) : null}
                                {sb?.ref ? (
                                  <>
                                    {" "}
                                    · Réf : <b>{sb.ref}</b>
                                  </>
                                ) : null}
                                {sb?.program ? (
                                  <>
                                    {" "}
                                    · Programme : <b>{sb.program}</b>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <span className={tone}>
                              Score : <b>{scorePct ?? "—"}</b>
                            </span>
                          </div>

                          {/* Motifs sanction / décision */}
                          <div className="match-section">
                            <div className="match-section-title">Motifs / raisons (sanction / décision)</div>
                            {renderBulletsOrFallback(m.sanctionBullets, sb?.summary || "Aucun motif détaillé dans la source (summary/raw_payload).")}
                            {renderRawDetails(m.sanctionRaw, "Voir détails bruts (source / sanction)")}
                          </div>

                          {/* Source officielle + liens */}
                          {sb ? (
                            <div className="match-section">
                              <div className="match-section-title">Source officielle</div>

                              <div className="match-par" style={{ display: "grid", gap: 6 }}>
                                {sb.record_type ? (
                                  <div>
                                    <b>Type :</b> {sb.record_type}
                                  </div>
                                ) : null}
                                {sb.listed_on ? (
                                  <div>
                                    <b>Inscrit le :</b> {sb.listed_on}
                                  </div>
                                ) : null}
                                {sb.unlisted_on ? (
                                  <div>
                                    <b>Retiré le :</b> {sb.unlisted_on}
                                  </div>
                                ) : null}
                                {sb.summary ? (
                                  <div>
                                    <b>Résumé :</b> {sb.summary}
                                  </div>
                                ) : null}
                              </div>

                              {Array.isArray(sb.links) && sb.links.length > 0 ? (
                                <div className="match-par" style={{ marginTop: 8 }}>
                                  <b>Liens (preuves) :</b>
                                  <ul className="match-ul">
                                    {sb.links
                                      .map(asText)
                                      .filter(looksLikeUrl)
                                      .slice(0, 8)
                                      .map((u: string, i: number) => (
                                        <li key={i}>
                                          <a href={u} target="_blank" rel="noreferrer">
                                            {u}
                                          </a>
                                        </li>
                                      ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Pourquoi le match (technique) */}
                          <details className="match-details">
                            <summary className="badge" style={{ cursor: "pointer" }}>
                              Pourquoi ce match (technique)
                            </summary>
                            <div style={{ height: 10 }} />
                            {renderBulletsOrFallback(m.matchBullets, m.reasonsHuman || "Correspondance détectée par le moteur (détails techniques disponibles).")}
                            {renderRawDetails(m.matchRaw ?? m.raw?.reasons ?? m.raw, "Voir raisons brutes (matching)")}
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="card" style={{ marginTop: 12 }}>
                <div className="h2" style={{ marginTop: 0 }}>
                  Chronologie
                </div>

                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <Badge title="Création du screening">
                    Créé: <b>{fmtDate(createdAt)}</b>
                  </Badge>
                  <Badge title="Fin du screening (si terminé)">
                    Terminé: <b>{fmtDate(completedAt)}</b>
                  </Badge>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="screen">
              <div className="h2" style={{ marginTop: 0 }}>
                Aide & Explications
              </div>

              <div className="card" style={{ marginTop: 8 }}>
                <div className="small" style={{ lineHeight: 1.7, opacity: 0.95 }}>
                  <b>Comment lire cette page ?</b>
                  <ul style={{ marginTop: 8 }}>
                    <li>
                      <b>Motifs sanction</b> : la partie la plus importante (source officielle).
                    </li>
                    <li>
                      <b>Source officielle</b> : type, programme, dates, liens.
                    </li>
                    <li>
                      <b>Pourquoi ce match</b> : explications techniques.
                    </li>
                    <li>
                      <b>Décision analyst</b> : affichée en lecture seule (prise dans le popup).
                    </li>
                  </ul>
                </div>

                <div style={{ height: 10 }} />

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <Link className="btn secondary" to="/screenings">
                    📋 Retour à la liste
                  </Link>
                  <button
                    className="btn secondary"
                    onClick={() => downloadScreeningExportPdf(String(request?.id ?? id))}
                    disabled={!request?.id && !id}
                  >
                    ⬇️ Export PDF
                  </button>
                </div>
              </div>

              {showTech ? (
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="h2" style={{ marginTop: 0 }}>
                    Détails techniques (optionnel)
                  </div>
                  <div className="small" style={{ opacity: 0.9, marginBottom: 8 }}>
                    À utiliser uniquement si tu fais du debug.
                  </div>

                  <details>
                    <summary className="badge" style={{ cursor: "pointer" }}>
                      Voir l’objet request (raw)
                    </summary>
                    <div style={{ height: 10 }} />
                    <textarea readOnly value={JSON.stringify(request ?? null, null, 2)} />
                  </details>

                  <div style={{ height: 10 }} />

                  <details>
                    <summary className="badge" style={{ cursor: "pointer" }}>
                      Voir l’objet result (raw)
                    </summary>
                    <div style={{ height: 10 }} />
                    <textarea readOnly value={JSON.stringify(result ?? null, null, 2)} />
                  </details>

                  <div style={{ height: 10 }} />

                  <details>
                    <summary className="badge" style={{ cursor: "pointer" }}>
                      Voir matches (raw)
                    </summary>
                    <div style={{ height: 10 }} />
                    <textarea readOnly value={JSON.stringify(matchesRaw ?? [], null, 2)} />
                  </details>

                  <div style={{ height: 10 }} />

                  <details>
                    <summary className="badge" style={{ cursor: "pointer" }}>
                      Voir data (raw)
                    </summary>
                    <div style={{ height: 10 }} />
                    <textarea readOnly value={JSON.stringify(data ?? null, null, 2)} />
                  </details>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}