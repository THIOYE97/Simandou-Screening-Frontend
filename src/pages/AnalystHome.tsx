// src/pages/AnalystHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  launchSimpleScreening,
  uploadDocumentStandalone,
  extractOcr,
  screeningFromDocument,
  downloadScreeningExportPdf,
  setScreeningDecision,
  getScreeningDetails,
} from "../api";
import type { SimpleScreeningIn, OcrExtractResp } from "../api";

type Tab = "simple" | "ocr";

type FlowEvent = {
  at: string; // ISO
  title: string;
  detail?: string;
};

type StepModal =
  | { kind: "UPLOAD_DONE"; document_id: string; ocr_status?: string | null }
  | {
      kind: "OCR_DONE";
      document_id: string;
      ocr_status?: string | null;
      ocr_confidence?: number | null;
      fields: {
        last_name: string;
        first_name: string;
        date_of_birth: string;
        document_number: string;
      };
    };

type ScreeningPopupData = {
  request_id: string;
  status?: string | null;

  recommended_action?: string | null;
  risk_level?: string | null;
  confidence?: number | string | null;
  matches_count?: number | null;

  // decisions
  decision_latest?: any | null;
  decision_history?: any[];

  mode: "OCR" | "SIMPLE";
  name?: string;
};

function nowIso() {
  return new Date().toISOString();
}
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

const actionLabel = (a?: string | null) => {
  const v = String(a || "").toUpperCase();
  if (!v) return "—";
  if (v.includes("APPROVE") || v.includes("CLEAR") || v === "PASS") return "✅ Action recommandée : APPROUVER / PASS";
  if (v.includes("REVIEW")) return "⚠️ Action recommandée : REVIEW (revue manuelle)";
  if (v.includes("REJECT") || v.includes("BLOCK")) return "⛔ Action recommandée : REVOIR / BLOCK";
  return `🔎 Action recommandée : ${v}`;
};
const humanRisk = (r?: string | null) => {
  const v = String(r || "").toUpperCase();
  if (!v) return "—";
  if (v === "LOW") return "Faible";
  if (v === "MEDIUM") return "Moyen";
  if (v === "HIGH") return "Élevé";
  return v;
};
const fmtConfidence = (c: any) => {
  if (c == null || c === "") return "—";
  const n = Number(c);
  if (!Number.isFinite(n)) return String(c);
  const p = n <= 1 ? n * 100 : n;
  return `${Math.round(p)}%`;
};

function decisionHuman(v?: string | null) {
  const x = String(v || "").toUpperCase();
  if (!x) return "—";
  if (x === "PASS") return "✅ PASS";
  if (x === "BLOCK") return "⛔ BLOCK";
  return x;
}

export default function AnalystHome() {
  // ✅ Mettre le mode Simple en avant dès la connexion
  const [tab, setTab] = useState<Tab>("simple");
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState<{ tone?: "ok" | "warn" | "danger"; text: string } | null>(null);

  // Flow events (audit UI in final modal)
  const [flow, setFlow] = useState<FlowEvent[]>([]);
  const pushFlow = (e: Omit<FlowEvent, "at"> & { at?: string }) =>
    setFlow((prev) => [{ at: e.at || nowIso(), title: e.title, detail: e.detail }, ...prev].slice(0, 30));

  // Step modals
  const [stepModal, setStepModal] = useState<StepModal | null>(null);

  // Final popup (screening result)
  const [popup, setPopup] = useState<ScreeningPopupData | null>(null);

  // -----------------------------------
  // SIMPLE screening (simplifié)
  // -----------------------------------
  const [entityType, setEntityType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [maxMatches, setMaxMatches] = useState(20);

  const canLaunchSimple = useMemo(() => {
    if (entityType === "INDIVIDUAL") return !!firstName.trim() && !!lastName.trim();
    return !!companyName.trim();
  }, [entityType, firstName, lastName, companyName]);

  async function onLaunchSimple() {
    setToast(null);
    setBusy(true);
    try {
      // ✅ Payload simplifié: plus de DOB/country/nationality/aliases/includeAliases
      const payload: SimpleScreeningIn = {
        entity_type: entityType,
        first_name: entityType === "INDIVIDUAL" ? firstName.trim() : undefined,
        last_name: entityType === "INDIVIDUAL" ? lastName.trim() : undefined,
        company_name: entityType === "COMPANY" ? companyName.trim() : undefined,
        max_matches: maxMatches,
      };

      const res: any = await launchSimpleScreening(payload);

      const name =
        entityType === "INDIVIDUAL"
          ? `${firstName.trim()} ${lastName.trim()}`.trim()
          : companyName.trim();

      pushFlow({
        title: "Screening lancé",
        detail: `request_id=${res.request_id} (mode=SIMPLE)`,
      });

      setPopup({
        request_id: res.request_id,
        status: res.status,
        mode: "SIMPLE",
        name,
        recommended_action: res.recommended_action ?? res.recommendedAction ?? null,
        risk_level: res.risk_level ?? res.riskLevel ?? null,
        confidence: res.confidence ?? null,
        matches_count: res.matches_count ?? res.matchesCount ?? null,
      });

      await refreshPopupDetails(res.request_id, "SIMPLE", name);

      setToast({ tone: "ok", text: `✅ Screening lancé: ${res.request_id}` });
    } catch (e: any) {
      setToast({ tone: "danger", text: `❌ Erreur: ${e?.response?.data?.detail || e?.message || String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  function resetSimple() {
    setEntityType("INDIVIDUAL");
    setFirstName("");
    setLastName("");
    setCompanyName("");
    setMaxMatches(20);
    setToast(null);
  }

  // -----------------------------------
  // OCR flow (upload + OCR + confirmation en popup)
  // -----------------------------------
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);

  const [docType, setDocType] = useState("ID_CARD");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [ocrResp, setOcrResp] = useState<OcrExtractResp | null>(null);

  // (on garde ces states pour cohérence, mais la confirmation se fait désormais dans le popup)
  const [ocrLastName, setOcrLastName] = useState("");
  const [ocrFirstName, setOcrFirstName] = useState("");
  const [ocrDob, setOcrDob] = useState("");
  const [ocrDocNo, setOcrDocNo] = useState("");

  const [clientId, setClientId] = useState("");
  const [countryFocus, setCountryFocus] = useState("");

  const overrideName = useMemo(() => {
    const fn = ocrFirstName.trim();
    const ln = ocrLastName.trim();
    return [fn, ln].filter(Boolean).join(" ").trim();
  }, [ocrFirstName, ocrLastName]);

  useEffect(() => {
    return () => {
      if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFile(f: File | null) {
    setToast(null);
    setOcrFile(f);
    setDocumentId(null);
    setOcrResp(null);
    setPopup(null);
    setStepModal(null);

    setOcrLastName("");
    setOcrFirstName("");
    setOcrDob("");
    setOcrDocNo("");

    if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl);
    if (f) setOcrPreviewUrl(URL.createObjectURL(f));
    else setOcrPreviewUrl(null);

    setFlow([]);
  }

  async function onUploadStandalone() {
    if (!ocrFile) {
      setToast({ tone: "danger", text: "❌ Choisis une image recto d'abord." });
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const up: any = await uploadDocumentStandalone(docType, ocrFile);
      setDocumentId(up.document_id);

      pushFlow({
        title: "Upload document",
        detail: `document_id=${up.document_id} ocr_status=${up.ocr_status ?? "-"}`,
      });

      // ✅ popup upload OK (comme avant)
      setStepModal({
        kind: "UPLOAD_DONE",
        document_id: up.document_id,
        ocr_status: up.ocr_status ?? null,
      });

      setToast({ tone: "ok", text: `✅ Upload OK: document_id=${up.document_id}` });
    } catch (e: any) {
      setToast({ tone: "danger", text: `❌ Upload error: ${e?.response?.data?.detail || e?.message || String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  async function onExtractOcr() {
    if (!documentId) {
      setToast({ tone: "danger", text: "❌ Upload d'abord (document_id manquant)." });
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const r: any = await extractOcr(documentId);
      setOcrResp(r);

      const fields = {
        last_name: (r.extracted_fields?.last_name || "").trim(),
        first_name: (r.extracted_fields?.first_name || "").trim(),
        date_of_birth: (r.extracted_fields?.date_of_birth || "").trim(),
        document_number: (r.extracted_fields?.document_number || "").trim(),
      };

      // sync states (optionnel mais pratique)
      setOcrLastName(fields.last_name);
      setOcrFirstName(fields.first_name);
      setOcrDob(fields.date_of_birth);
      setOcrDocNo(fields.document_number);

      pushFlow({
        title: "OCR terminé",
        detail: `status=${r.ocr_status} conf=${r.ocr_confidence ?? "-"}`,
      });

      // ✅ popup OCR_DONE avec champs modifiables + actions
      setStepModal({
        kind: "OCR_DONE",
        document_id: documentId,
        ocr_status: r.ocr_status ?? null,
        ocr_confidence: typeof r.ocr_confidence === "number" ? r.ocr_confidence : null,
        fields,
      });

      setToast({ tone: "ok", text: `✅ Extraction OK: status=${r.ocr_status}` });
    } catch (e: any) {
      setToast({ tone: "danger", text: `❌ Erreur extraction: ${e?.response?.data?.detail || e?.message || String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  async function startScreeningFromDoc(overrideNameStr: string) {
    if (!documentId) return;
    const name = (overrideNameStr || "").trim();
    if (name.length < 3) {
      setToast({ tone: "danger", text: "❌ Mets au moins Prénoms + Nom." });
      return;
    }

    const res: any = await screeningFromDocument({
      document_id: documentId,
      client_id: clientId.trim() || undefined,
      country_focus: countryFocus.trim() || undefined,
      override_name: name,
    });

    pushFlow({
      title: "Screening lancé",
      detail: `request_id=${res.request_id} (mode=OCR)`,
    });

    // close step modal, open final popup
    setStepModal(null);

    setPopup({
      request_id: res.request_id,
      status: res.status ?? null,
      mode: "OCR",
      name,
      recommended_action: res.recommended_action ?? res.recommendedAction ?? null,
      risk_level: res.risk_level ?? res.riskLevel ?? null,
      confidence: res.confidence ?? null,
      matches_count: res.matches_count ?? res.matchesCount ?? null,
    });

    await refreshPopupDetails(res.request_id, "OCR", name);
    setToast({ tone: "ok", text: `✅ Screening lancé: request_id=${res.request_id}` });
  }

  async function onStartScreeningFromDoc() {
    setBusy(true);
    setToast(null);
    try {
      await startScreeningFromDoc(overrideName);
    } catch (e: any) {
      setToast({ tone: "danger", text: `❌ Screening error: ${e?.response?.data?.detail || e?.message || String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  function resetOcr() {
    setToast(null);
    onPickFile(null);
    setDocType("ID_CARD");
    setClientId("local-demo");
    setCountryFocus("SN");
  }

  // -----------------------------------
  // Final popup: refresh details + decision
  // -----------------------------------
  const [bypassComment, setBypassComment] = useState("");
  const [bypassBusy, setBypassBusy] = useState(false);

  async function refreshPopupDetails(requestId: string, mode: "OCR" | "SIMPLE", name?: string) {
    try {
      const d: any = await getScreeningDetails(requestId);

      const matchesRaw = Array.isArray(d?.matches) ? d.matches : [];

      setPopup((prev) => ({
        ...(prev || { request_id: requestId, mode, name }),
        request_id: requestId,
        mode,
        name: name ?? prev?.name,
        status: d?.request?.status ?? prev?.status ?? null,

        recommended_action: d?.result?.recommended_action ?? prev?.recommended_action ?? null,
        risk_level: d?.result?.risk_level ?? prev?.risk_level ?? null,
        confidence: d?.result?.confidence ?? prev?.confidence ?? null,
        matches_count: typeof matchesRaw.length === "number" ? matchesRaw.length : prev?.matches_count ?? null,

        decision_latest: d?.decision_latest ?? null,
        decision_history: Array.isArray(d?.decision_history) ? d.decision_history : [],
      }));
    } catch (e: any) {
      setToast({ tone: "warn", text: `⚠️ Refresh détails impossible: ${e?.response?.data?.detail || e?.message || String(e)}` });
    }
  }

  async function doBypass(decision: "PASS" | "BLOCK") {
    if (!popup) return;
    const c = bypassComment.trim();
    if (c.length < 4) {
      setToast({ tone: "danger", text: "❌ Commentaire obligatoire (min 4 caractères)." });
      return;
    }

    setBypassBusy(true);
    setToast(null);
    try {
      await setScreeningDecision(popup.request_id, decision, c);

      pushFlow({
        title: "Décision enregistrée",
        detail: `${decision} — ${c}`,
      });

      setToast({ tone: "ok", text: `✅ Décision enregistrée: ${decision}` });
      setBypassComment("");

      await refreshPopupDetails(popup.request_id, popup.mode, popup.name);
    } catch (e: any) {
      setToast({ tone: "danger", text: `❌ Erreur décision: ${e?.response?.data?.detail || e?.message || String(e)}` });
    } finally {
      setBypassBusy(false);
    }
  }

  const latestDecision = popup?.decision_latest ?? null;

  // Helpers for popup OCR edit
  const ocrPopupName = useMemo(() => {
    if (!stepModal || stepModal.kind !== "OCR_DONE") return "";
    const fn = stepModal.fields.first_name.trim();
    const ln = stepModal.fields.last_name.trim();
    return [fn, ln].filter(Boolean).join(" ").trim();
  }, [stepModal]);

  const canStartFromPopup = useMemo(() => {
    if (!documentId) return false;
    if (!stepModal || stepModal.kind !== "OCR_DONE") return false;
    return ocrPopupName.length >= 3;
  }, [documentId, stepModal, ocrPopupName]);

  return (
    <div className="page">
      <div className="page-inner">
        {/* Header */}
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Analyst Console
            </div>
            <div className="page-title">Analyst</div>
            <div className="page-subtitle">Simple → (optionnel) Upload → OCR → Screening → Décision → Export PDF.</div>
          </div>

          <div className="pill-row">
            <Link to="/screenings" className="btn secondary">
              📋 Screenings
            </Link>
          </div>
        </div>

        {/* Toast */}
        {toast ? (
          <div className={`toast ${toast.tone || ""}`} style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>{toast.text}</div>
              <Link to="/screenings" className="badge">
                Voir la liste →
              </Link>
            </div>
          </div>
        ) : null}

        <div className="grid-2">
          {/* LEFT */}
          <div className="screen">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="h2" style={{ margin: 0 }}>
                  Lancer un screening
                </div>
                <div className="small">Mode Simple recommandé. Mode Extraction reste disponible.</div>
              </div>

              <div className="tabbar">
                <div className={`tab ${tab === "simple" ? "active" : ""}`} onClick={() => setTab("simple")}>
                  Mode Simple
                </div>
                <div className={`tab ${tab === "ocr" ? "active" : ""}`} onClick={() => setTab("ocr")}>
                  Mode Extraction
                </div>
              </div>
            </div>

            {tab === "simple" ? (
              <>
                {/* SIMPLE (simplifié) */}
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="h2" style={{ marginTop: 0 }}>
                    Mode Simple
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label className="small">Type</label>
                      <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value as any)}>
                        <option value="INDIVIDUAL">INDIVIDUAL</option>
                        <option value="COMPANY">COMPANY</option>
                      </select>
                    </div>

                    <div className="field">
                      <label className="small">Max matches</label>
                      <input
                        className="input"
                        type="number"
                        value={maxMatches}
                        onChange={(e) => setMaxMatches(Number(e.target.value))}
                        min={1}
                        max={200}
                      />
                    </div>

                    {entityType === "INDIVIDUAL" ? (
                      <>
                        <div className="field">
                          <label className="small">First name</label>
                          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="field">
                          <label className="small">Last name</label>
                          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <div className="field span-2">
                        <label className="small">Company name</label>
                        <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                      </div>
                    )}

                    <div className="field span-2">
                      <label className="small">Actions</label>
                      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <button className="btn" disabled={busy || !canLaunchSimple} onClick={onLaunchSimple}>
                          {busy ? "En cours..." : "Lancer"}
                        </button>
                        <button className="btn secondary" disabled={busy} onClick={resetSimple}>
                          Reset
                        </button>
                      </div>

                      {!canLaunchSimple ? (
                        <div className="small" style={{ marginTop: 8 }}>
                          {entityType === "INDIVIDUAL" ? "First name + Last name requis." : "Company name requis."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* OCR: 1) Upload */}
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="h2" style={{ marginTop: 0 }}>
                    1) Upload recto (sans case)
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label className="small">Doc type</label>
                      <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                        <option value="ID_CARD">ID_CARD</option>
                        <option value="PASSPORT">PASSPORT</option>
                      </select>
                    </div>

                    <div className="field span-2">
                      <label className="small">Image recto</label>
                      <input
                        className="input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                      />
                      <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>
                        Astuce: sur mobile, ça ouvre la caméra (capture=environment).
                      </div>
                    </div>

                    <div className="field">
                      <label className="small">Action</label>
                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <button className="btn" disabled={busy || !ocrFile} onClick={onUploadStandalone}>
                          {busy ? "..." : "Uploader"}
                        </button>
                        <button className="btn secondary" disabled={busy} onClick={resetOcr}>
                          Reset
                        </button>
                      </div>
                      <div className="small" style={{ marginTop: 8 }}>
                        document_id: <b>{documentId || "-"}</b>
                      </div>
                    </div>
                  </div>

                  {ocrPreviewUrl ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="small" style={{ marginBottom: 8 }}>
                        Preview
                      </div>
                      <img
                        src={ocrPreviewUrl}
                        alt="recto"
                        style={{
                          width: "100%",
                          maxHeight: 320,
                          objectFit: "contain",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,.08)",
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {/* OCR: 2) Extraction (confirmation dans popup) */}
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="h2" style={{ marginTop: 0 }}>
                    2) Extraction + Confirmation (popup)
                  </div>

                  <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                    <button className="btn secondary" disabled={busy || !documentId} onClick={onExtractOcr}>
                      {busy ? "..." : "Lancer Extraction"}
                    </button>

                    {ocrResp ? (
                      <>
                        <span className="badge">ocr_status: {ocrResp.ocr_status}</span>
                        <span className="badge">conf: {ocrResp.ocr_confidence ?? "-"}</span>
                      </>
                    ) : (
                      <span className="small">Clique “Lancer extraction” après upload.</span>
                    )}
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label className="small">client_id</label>
                      <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="small">country_focus</label>
                      <input className="input" value={countryFocus} onChange={(e) => setCountryFocus(e.target.value)} placeholder="SN" />
                    </div>

                    <div className="field span-2">
                      <div className="small" style={{ opacity: 0.85 }}>
                        Après extraction, un popup s’ouvre avec les données extraites (modifiable) + bouton “Lancer Screening”.
                      </div>
                    </div>
                  </div>

                  {ocrResp ? (
                    <details style={{ marginTop: 12 }}>
                      <summary className="badge" style={{ cursor: "pointer" }}>
                        Voir Extraction response (debug)
                      </summary>
                      <div style={{ height: 10 }} />
                      <textarea readOnly value={JSON.stringify(ocrResp, null, 2)} />
                    </details>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* RIGHT */}
          <div className="screen">
            <div className="h2" style={{ marginTop: 0 }}>
              Raccourcis
            </div>

            <div className="card" style={{ marginTop: 10 }}>
              <div className="small" style={{ marginBottom: 10 }}>
                Navigation rapide
              </div>

              <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
                <Link className="btn secondary" to="/screenings">
                  📋 Voir tous les screenings
                </Link>
              </div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div className="small" style={{ marginBottom: 8 }}>
                Status
              </div>
              <div className="small">
                Busy: <b>{busy ? "yes" : "no"}</b>
              </div>
              <div className="small">
                Mode: <b>{tab}</b>
              </div>
              <div className="small">
                document_id: <b>{documentId || "-"}</b>
              </div>
              <div className="small">
                pop-up: <b>{popup?.request_id || "-"}</b>
              </div>
            </div>
          </div>
        </div>

        {/* STEP MODALS */}
        {stepModal ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setStepModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-kicker">Notification</div>
                  <div className="modal-action">
                    {stepModal.kind === "UPLOAD_DONE" ? "✅ Upload terminé" : "✅ Extraction OCR terminée"}
                  </div>
                  <div className="modal-sub">
                    <span className="badge">document_id: {stepModal.document_id}</span>
                    {"ocr_status" in stepModal && stepModal.ocr_status ? <span className="badge">ocr_status: {stepModal.ocr_status}</span> : null}
                    {"ocr_confidence" in stepModal && typeof (stepModal as any).ocr_confidence === "number" ? (
                      <span className="badge">conf: {fmtConfidence((stepModal as any).ocr_confidence)}</span>
                    ) : null}
                  </div>
                </div>

                <button className="icon-btn" onClick={() => setStepModal(null)} aria-label="Fermer">
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="card" style={{ marginTop: 8 }}>
                  {stepModal.kind === "UPLOAD_DONE" ? (
                    <>
                      <div style={{ fontWeight: 900 }}>Prochaine étape</div>
                      <div className="small" style={{ marginTop: 6 }}>
                        
                      </div>
                      <div className="row" style={{ gap: 10, marginTop: 12 }}>
                        <button
                          className="btn"
                          onClick={() => {
                            setStepModal(null);
                            onExtractOcr();
                          }}
                          disabled={busy}
                        >
                          ▶ Lancer OCR
                        </button>
                        <button className="btn secondary" onClick={() => setStepModal(null)}>
                          Fermer
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ✅ OCR popup = confirmation + édition + lancement screening */}
                      <div style={{ fontWeight: 900 }}>Données extraites (modifiable)</div>
                      <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
                        Modifie si besoin puis lance le screening.
                      </div>

                      <div className="form-grid" style={{ marginTop: 12 }}>
                        <div className="field">
                          <label className="small">Nom</label>
                          <input
                            className="input"
                            value={stepModal.fields.last_name}
                            onChange={(e) =>
                              setStepModal((prev) =>
                                prev && prev.kind === "OCR_DONE"
                                  ? { ...prev, fields: { ...prev.fields, last_name: e.target.value } }
                                  : prev
                              )
                            }
                          />
                        </div>

                        <div className="field">
                          <label className="small">Prénoms</label>
                          <input
                            className="input"
                            value={stepModal.fields.first_name}
                            onChange={(e) =>
                              setStepModal((prev) =>
                                prev && prev.kind === "OCR_DONE"
                                  ? { ...prev, fields: { ...prev.fields, first_name: e.target.value } }
                                  : prev
                              )
                            }
                          />
                        </div>

                        <div className="field">
                          <label className="small">DOB</label>
                          <input
                            className="input"
                            placeholder="YYYY-MM-DD"
                            value={stepModal.fields.date_of_birth}
                            onChange={(e) =>
                              setStepModal((prev) =>
                                prev && prev.kind === "OCR_DONE"
                                  ? { ...prev, fields: { ...prev.fields, date_of_birth: e.target.value } }
                                  : prev
                              )
                            }
                          />
                        </div>

                        <div className="field">
                          <label className="small">Doc number</label>
                          <input
                            className="input"
                            value={stepModal.fields.document_number}
                            onChange={(e) =>
                              setStepModal((prev) =>
                                prev && prev.kind === "OCR_DONE"
                                  ? { ...prev, fields: { ...prev.fields, document_number: e.target.value } }
                                  : prev
                              )
                            }
                          />
                        </div>

                        <div className="field span-2">
                          <label className="small">Nom complet (screening)</label>
                          <input className="input" value={ocrPopupName} readOnly />
                          <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>
                            On lance le screening sur: <b>{ocrPopupName || "(vide)"}</b>
                          </div>
                        </div>
                      </div>

                      <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="btn"
                          disabled={busy || !canStartFromPopup}
                          onClick={async () => {
                            // sync states (optionnel)
                            setOcrLastName(stepModal.fields.last_name);
                            setOcrFirstName(stepModal.fields.first_name);
                            setOcrDob(stepModal.fields.date_of_birth);
                            setOcrDocNo(stepModal.fields.document_number);

                            setBusy(true);
                            setToast(null);
                            try {
                              await startScreeningFromDoc(ocrPopupName);
                            } catch (e: any) {
                              setToast({
                                tone: "danger",
                                text: `❌ Screening error: ${e?.response?.data?.detail || e?.message || String(e)}`,
                              });
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          ▶ Lancer Screening
                        </button>

                        {!canStartFromPopup ? <span className="small">Requis: upload + nom/prénoms.</span> : null}

                        <button className="btn secondary" onClick={() => setStepModal(null)}>
                          Fermer
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn secondary" onClick={() => setStepModal(null)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* FINAL POPUP */}
        {popup ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setPopup(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div style={{ minWidth: 0 }}>
                  <div className="modal-kicker">Résultat du screening</div>
                  <div className="modal-action">{actionLabel(popup.recommended_action)}</div>

                  <div className="modal-sub" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {popup.name ? <span className="badge">👤 {popup.name}</span> : null}
                    <span className="badge">mode: {popup.mode}</span>
                    {popup.status ? <span className="badge">status: {popup.status}</span> : null}
                    <span className="badge">
                      Risque: <b>{humanRisk(popup.risk_level)}</b>
                    </span>
                    <span className="badge">
                      Confiance: <b>{fmtConfidence(popup.confidence)}</b>
                    </span>
                    {typeof popup.matches_count === "number" ? (
                      <span className="badge">
                        Matchs: <b>{popup.matches_count}</b>
                      </span>
                    ) : null}
                  </div>
                </div>

                <button className="icon-btn" onClick={() => setPopup(null)} aria-label="Fermer">
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="info-grid">
                  <div className="info-card">
                    <div className="info-key">request_id</div>
                    <div className="info-val mono">{popup.request_id}</div>
                  </div>

                  <div className="info-card">
                    <div className="info-key">Actions rapides</div>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                      <Link className="btn secondary" to={`/screenings/${popup.request_id}`}>
                        Ouvrir détails
                      </Link>
                      <button className="btn secondary" onClick={() => refreshPopupDetails(popup.request_id, popup.mode, popup.name)}>
                        Refresh détails
                      </button>
                      <button className="btn" onClick={() => downloadScreeningExportPdf(popup.request_id)}>
                        ⬇️ Export PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Flow history */}
                <div className="card" style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 950 }}>Historique des actions (Flow)</div>
                  <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>
                    Upload → OCR → Screening → Décision (audit UI).
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {flow.length === 0 ? (
                      <div className="small">Aucune action enregistrée dans cette session.</div>
                    ) : (
                      flow.map((e, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid rgba(255,255,255,.10)",
                            borderRadius: 16,
                            padding: 10,
                            background: "rgba(0,0,0,.18)",
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                            <span className="badge">{fmtDate(e.at)}</span>
                            <div style={{ fontWeight: 900 }}>{e.title}</div>
                          </div>
                          {e.detail ? (
                            <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
                              {e.detail}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ✅ On enlève les tableaux résultats (tout se fait en popup / détails) */}
                <div className="card" style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 950 }}>Résumé</div>
                  <div className="small" style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.6 }}>
                    Pour analyser les matchs (sanctions/PEP/media) : clique <b>“Ouvrir détails”</b>.
                    <br />
                    Export disponible via <b>“Export PDF”</b>.
                  </div>
                </div>

                {/* Decision */}
                <div className="card" style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950 }}>Décision (Bypass)</div>
                      <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>
                        Choisis PASS ou BLOCK. Commentaire obligatoire (min 4 caractères).
                      </div>
                    </div>

                    <span className="badge">
                      Dernière: <b>{latestDecision ? decisionHuman(latestDecision.decision) : "—"}</b>
                    </span>
                  </div>

                  {latestDecision ? (
                    <div className="small" style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.6 }}>
                      <b>{decisionHuman(latestDecision.decision)}</b> · {latestDecision.decided_by_email || "—"} ·{" "}
                      {latestDecision.decided_at ? fmtDate(latestDecision.decided_at) : "—"}
                      {latestDecision.comment ? (
                        <>
                          <br />
                          <b>Raison :</b> {String(latestDecision.comment)}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <textarea
                    value={bypassComment}
                    onChange={(e) => setBypassComment(e.target.value)}
                    placeholder="Pourquoi PASS/BLOCK ? (obligatoire)"
                    style={{ marginTop: 12 }}
                  />

                  <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button className="btn" disabled={bypassBusy} onClick={() => doBypass("PASS")}>
                      ✅ PASS
                    </button>
                    <button className="btn danger" disabled={bypassBusy} onClick={() => doBypass("BLOCK")}>
                      ⛔ BLOCK
                    </button>
                  </div>

                  {Array.isArray(popup.decision_history) && popup.decision_history.length > 0 ? (
                    <details style={{ marginTop: 12 }}>
                      <summary className="badge" style={{ cursor: "pointer" }}>
                        Voir historique ({popup.decision_history.length})
                      </summary>
                      <div style={{ height: 10 }} />
                      <div style={{ display: "grid", gap: 10 }}>
                        {popup.decision_history.slice(0, 50).map((d: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              border: "1px solid rgba(255,255,255,.10)",
                              borderRadius: 16,
                              padding: 10,
                              background: "rgba(255,255,255,.03)",
                            }}
                          >
                            <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <span className="badge">
                                <b>{decisionHuman(d?.decision)}</b>
                              </span>
                              <span className="small" style={{ opacity: 0.85 }}>
                                {d?.decided_at ? fmtDate(d.decided_at) : "—"} · {d?.decided_by_email || "—"}
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
              </div>

              <div className="modal-footer">
                <button className="btn secondary" onClick={() => setPopup(null)} style={{ width: "auto" }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
