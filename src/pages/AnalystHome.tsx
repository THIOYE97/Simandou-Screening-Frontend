// src/pages/AnalystHome.tsx — lucide-react refactor
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  BellRing,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FileText,
  Fingerprint,
  FolderOpen,
  Globe2,
  Loader2,
  Newspaper,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  UserRoundSearch,
  XCircle,
  Camera,
  Pencil,
  ScanText,
} from "lucide-react";

import api, {
  launchSimpleScreening,
  uploadDocumentStandalone,
  extractOcr,
  screeningFromDocument,
  downloadScreeningExportPdf,
  getScreeningDetails,
} from "../api";

import type { SimpleScreeningIn } from "../api";

// ─── Types ────────────────────────────────────────────────────────
type Mode = "simple" | "document";
type Step = "form" | "processing" | "result";

interface ScreeningResult {
  request_id: string;
  status: string;
  risk_level: string | null;
  recommended_action: string | null;
  confidence: number | null;
  matches_count: number;
  decision_latest?: any;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
function riskConfig(r: string | null) {
  const v = String(r || "").toUpperCase();
  if (v === "HIGH")
    return {
      color: "var(--danger)",
      bg: "rgba(232,64,64,0.12)",
      border: "rgba(232,64,64,0.3)",
      label: "Élevé",
      icon: ShieldAlert,
    };
  if (v === "MEDIUM")
    return {
      color: "var(--warn)",
      bg: "rgba(245,146,10,0.12)",
      border: "rgba(245,146,10,0.3)",
      label: "Moyen",
      icon: AlertTriangle,
    };
  if (v === "LOW")
    return {
      color: "var(--ok)",
      bg: "rgba(46,204,143,0.12)",
      border: "rgba(46,204,143,0.3)",
      label: "Faible",
      icon: ShieldCheck,
    };
  return {
    color: "var(--text-mute)",
    bg: "rgba(148,163,184,0.1)",
    border: "rgba(148,163,184,0.2)",
    label: "—",
    icon: XCircle,
  };
}

function actionConfig(a: string | null) {
  const v = String(a || "").toUpperCase();
  if (v === "PASS")
    return {
      color: "var(--ok)",
      label: "Autoriser",
      icon: CheckCircle2,
      bg: "rgba(46,204,143,0.12)",
    };
  if (v === "MANUAL_REVIEW")
    return {
      color: "var(--warn)",
      label: "Revue manuelle",
      icon: Search,
      bg: "rgba(245,146,10,0.12)",
    };
  if (v === "BLOCK")
    return {
      color: "var(--danger)",
      label: "Bloquer",
      icon: Ban,
      bg: "rgba(232,64,64,0.12)",
    };
  return {
    color: "var(--text-mute)",
    label: String(a || "—"),
    icon: XCircle,
    bg: "rgba(148,163,184,0.1)",
  };
}

// ─── Animated progress bar ────────────────────────────────────────
function ProcessingStep({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          flexShrink: 0,
          background: done ? "var(--ok)" : active ? "var(--accent)" : "rgba(20,30,60,0.05)",
          border: done
            ? "none"
            : active
            ? "2px solid var(--accent)"
            : "2px solid rgba(20,30,60,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.4s",
          boxShadow: active ? "0 0 12px rgba(31,85,64,0.5)" : "none",
        }}
      >
        {done ? <Check size={14} strokeWidth={3} color="white" /> : active ? <ProcessingDot /> : null}
      </div>
      <span
        style={{
          fontSize: 14,
          color: done
            ? "var(--text-primary)"
            : active
            ? "var(--text-accent)"
            : "var(--text-muted)",
          fontWeight: done || active ? 600 : 400,
          transition: "color 0.4s",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ProcessingDot() {
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        background: "var(--accent)",
        animation: "pulse 1s ease-in-out infinite",
      }}
    />
  );
}

// ─── Result Card ──────────────────────────────────────────────────
function ResultCard({
  result,
  onReset,
}: {
  result: ScreeningResult;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const rc = riskConfig(result.risk_level);
  const ac = actionConfig(result.recommended_action);
  const RiskIcon = rc.icon;
  const ActionIcon = ac.icon;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
          <RiskIcon size={44} strokeWidth={2.1} color={rc.color} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          {result.name}
        </div>
        <div className="small" style={{ opacity: 0.6 }}>
          Screening complété avec succès
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div
          style={{
            padding: "16px 12px",
            borderRadius: 14,
            textAlign: "center",
            background: rc.bg,
            border: `1px solid ${rc.border}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <RiskIcon size={20} strokeWidth={2.2} color={rc.color} />
          </div>
          <div
            style={{
              fontSize: 11,
              color: rc.color,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 2,
            }}
          >
            Risque
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: rc.color }}>{rc.label}</div>
        </div>

        <div
          style={{
            padding: "16px 12px",
            borderRadius: 14,
            textAlign: "center",
            background: ac.bg,
            border: `1px solid ${ac.color}40`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <ActionIcon size={20} strokeWidth={2.2} color={ac.color} />
          </div>
          <div
            style={{
              fontSize: 11,
              color: ac.color,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 2,
            }}
          >
            Action
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: ac.color }}>{ac.label}</div>
        </div>

        <div
          style={{
            padding: "16px 12px",
            borderRadius: 14,
            textAlign: "center",
            background:
              result.matches_count > 0 ? "rgba(232,64,64,0.08)" : "rgba(46,204,143,0.08)",
            border: `1px solid ${
              result.matches_count > 0 ? "rgba(232,64,64,0.2)" : "rgba(46,204,143,0.2)"
            }`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            {result.matches_count > 0 ? (
              <Sparkles size={20} strokeWidth={2.2} color="var(--danger)" />
            ) : (
              <Check size={20} strokeWidth={2.6} color="var(--ok)" />
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 2,
              color: result.matches_count > 0 ? "var(--danger)" : "var(--ok)",
            }}
          >
            Matchs
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: result.matches_count > 0 ? "var(--danger)" : "var(--ok)",
            }}
          >
            {result.matches_count}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(31,85,64,0.08)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div className="small" style={{ opacity: 0.85, lineHeight: 1.5 }}>
          La décision <b>valider / bloquer</b> relève de la <b>Cellule de Conformité</b>.
          En cas de correspondance, un dossier est automatiquement transmis aux <b>Alertes</b> pour décision.
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <button
          className="btn"
          onClick={() => navigate(`/screenings/${result.request_id}`)}
          style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
        >
          <ClipboardList size={16} />
          Voir les détails complets
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            className="btn secondary"
            onClick={() => downloadScreeningExportPdf(result.request_id)}
            style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
          >
            <FileText size={16} />
            Export PDF
          </button>
          <button
            className="btn secondary"
            onClick={onReset}
            style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
          >
            <Search size={16} />
            Nouveau screening
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AnalystHome() {
  const [mode, setMode] = useState<Mode>("simple");
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);

  const [procStep, setProcStep] = useState(0);
  const PROC_STEPS_SIMPLE = [
    "Création du dossier",
    "Analyse des correspondances",
    "Vérification sanctions",
    "Calcul du niveau de risque",
    "Finalisation",
  ];
  const PROC_STEPS_DOCUMENT = [
    "Upload du document",
    "Extraction OCR",
    "Vérification des données",
    "Analyse des correspondances",
    "Calcul du niveau de risque",
    "Finalisation",
  ];

  const [entityType, setEntityType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [maxMatches, setMaxMatches] = useState(20);
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");

  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("ID_CARD");
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [ocrFields, setOcrFields] = useState<any>(null);
  const [overrideName, setOverrideName] = useState("");
  const [clientId, setClientId] = useState("");
  const [docStep, setDocStep] = useState<"upload" | "ocr" | "confirm">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const canLaunchSimple = useMemo(() => {
    if (entityType === "INDIVIDUAL") return !!firstName.trim() && !!lastName.trim();
    return !!companyName.trim();
  }, [entityType, firstName, lastName, companyName]);

  useEffect(() => {
    return () => {
      if (docPreview) URL.revokeObjectURL(docPreview);
    };
  }, [docPreview]);

  function pickFile(f: File | null) {
    setDocFile(f);
    setDocumentId(null);
    setOcrFields(null);
    setOverrideName("");
    if (docPreview) URL.revokeObjectURL(docPreview);
    setDocPreview(f ? URL.createObjectURL(f) : null);
    setDocStep("upload");
  }

  function reset() {
    setStep("form");
    setResult(null);
    setErr(null);
    setBusy(false);
    setProcStep(0);
    setFirstName("");
    setLastName("");
    setCompanyName("");
    setDob("");
    setNationality("");
    pickFile(null);
    setDocStep("upload");
    setOverrideName("");
    setClientId("");
  }

  async function animateProgress(totalSteps: number, durationMs: number) {
    const interval = durationMs / totalSteps;
    for (let i = 0; i < totalSteps; i++) {
      await new Promise((r) => setTimeout(r, interval + Math.random() * 300));
      setProcStep(i + 1);
    }
  }

  async function launchSimple() {
    if (!canLaunchSimple) return;
    setBusy(true);
    setErr(null);
    setStep("processing");
    setProcStep(0);

    const name =
      entityType === "INDIVIDUAL"
        ? `${firstName.trim()} ${lastName.trim()}`.trim()
        : companyName.trim();

    const anim = animateProgress(PROC_STEPS_SIMPLE.length, 3000);

    try {
      const payload: SimpleScreeningIn = {
        entity_type: entityType,
        first_name: entityType === "INDIVIDUAL" ? firstName.trim() : undefined,
        last_name: entityType === "INDIVIDUAL" ? lastName.trim() : undefined,
        company_name: entityType === "COMPANY" ? companyName.trim() : undefined,
        dob: dob.trim() || undefined,
        nationality: nationality.trim() || undefined,
        max_matches: maxMatches,
        aliases: [],
        include_aliases: false,
      };
      const res: any = await launchSimpleScreening(payload);
      await anim;

      let details: any = {};
      try {
        details = await getScreeningDetails(res.request_id);
      } catch {}

      setResult({
        request_id: res.request_id,
        status: res.status ?? "DONE",
        risk_level: details?.result?.risk_level ?? res.risk_level ?? null,
        recommended_action: details?.result?.recommended_action ?? res.recommended_action ?? null,
        confidence: details?.result?.confidence ?? res.confidence ?? null,
        matches_count: Array.isArray(details?.matches) ? details.matches.length : res.matches_count ?? 0,
        decision_latest: details?.decision_latest ?? null,
        name,
      });
      setStep("result");
    } catch (e: any) {
      await anim;
      const d = e?.response?.data?.detail;
      const msg = Array.isArray(d)
        ? d.map((x: any) => x?.msg || JSON.stringify(x)).join(", ")
        : typeof d === "string"
        ? d
        : e?.message || "Erreur";
      setErr(msg);
      setStep("form");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDoc() {
    if (!docFile) return;
    setBusy(true);
    setErr(null);
    try {
      const res: any = await uploadDocumentStandalone(docType, docFile);
      setDocumentId(res.document_id);
      setDocStep("ocr");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Upload échoué");
    } finally {
      setBusy(false);
    }
  }

  async function runOcr() {
    if (!documentId) return;
    setBusy(true);
    setErr(null);
    try {
      await extractOcr(documentId);

      const MAX_ATTEMPTS = 20;
      const INTERVAL_MS = 1500;
      let extracted: any = null;

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));

        try {
          const { data } = await api.get(`/documents/${documentId}/status`);
          const status = data?.ocr_status as string;

          if (status === "DONE" || status === "LOW_CONFIDENCE") {
            extracted = data?.extracted_fields || {};
            break;
          }
          if (status === "FAILED") {
            throw new Error("OCR échoué côté serveur");
          }
        } catch {
          break;
        }
      }

      if (!extracted) {
        throw new Error("OCR timeout — réessayez dans quelques secondes");
      }

      setOcrFields(extracted);
      const fn = (extracted.first_name || "").trim();
      const ln = (extracted.last_name || "").trim();
      setOverrideName([fn, ln].filter(Boolean).join(" ").trim());
      setDocStep("confirm");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "OCR échoué");
    } finally {
      setBusy(false);
    }
  }

  async function launchFromDoc() {
    if (!documentId || !overrideName.trim()) return;
    setBusy(true);
    setErr(null);
    setStep("processing");
    setProcStep(0);
    const anim = animateProgress(PROC_STEPS_DOCUMENT.length, 4000);
    try {
      const res: any = await screeningFromDocument({
        document_id: documentId,
        client_id: clientId.trim() || undefined,
        override_name: overrideName.trim(),
      });
      await anim;

      let details: any = {};
      try {
        details = await getScreeningDetails(res.request_id);
      } catch {}

      setResult({
        request_id: res.request_id,
        status: res.status ?? "DONE",
        risk_level: details?.result?.risk_level ?? res.risk_level ?? null,
        recommended_action: details?.result?.recommended_action ?? res.recommended_action ?? null,
        confidence: details?.result?.confidence ?? res.confidence ?? null,
        matches_count: Array.isArray(details?.matches) ? details.matches.length : res.matches_count ?? 0,
        decision_latest: details?.decision_latest ?? null,
        name: overrideName.trim(),
      });
      setStep("result");
    } catch (e: any) {
      await anim;
      const d = e?.response?.data?.detail;
      setErr(
        Array.isArray(d)
          ? d.map((x: any) => x?.msg || JSON.stringify(x)).join(", ")
          : typeof d === "string"
          ? d
          : e?.message || "Erreur"
      );
      setStep("form");
    } finally {
      setBusy(false);
    }
  }

  const procSteps = mode === "simple" ? PROC_STEPS_SIMPLE : PROC_STEPS_DOCUMENT;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.3); opacity:0.7; } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
        <div>
          <div className="ds-page-head">
            <h1 className="ds-page-title">
              <span className="ds-page-icon"><Search size={22} /></span>
              Vérifier une personne
            </h1>
          </div>

          {step === "form" && (
            <div
              style={{
                display: "flex",
                gap: 0,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 4,
                marginBottom: 20,
                width: "fit-content",
              }}
            >
              {(
                [
                  ["simple", "Mode simple", Search],
                  ["document", "Extraction OCR", ScanText],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setErr(null);
                  }}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 11,
                    border: "none",
                    background: mode === m ? "var(--accent)" : "transparent",
                    color: mode === m ? "white" : "var(--text-muted)",
                    fontWeight: mode === m ? 700 : 500,
                    fontSize: 13.5,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}

          {step === "form" && (
            <div className="screen" style={{ animation: "fadeIn 0.3s ease" }}>
              {err && (
                <div className="toast danger" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <XCircle size={16} />
                  {err}
                </div>
              )}

              {mode === "simple" && (
                <div>
                  <div className="h2" style={{ marginBottom: 16 }}>
                    Informations du sujet
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setEntityType(t)}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 10,
                          border: `1.5px solid ${entityType === t ? "var(--accent)" : "var(--border)"}`,
                          background: entityType === t ? "var(--accent-light)" : "transparent",
                          color: entityType === t ? "var(--text-accent)" : "var(--text-muted)",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {t === "INDIVIDUAL" ? <User size={16} /> : <Building2 size={16} />}
                        {t === "INDIVIDUAL" ? "Personne" : "Entreprise"}
                      </button>
                    ))}
                  </div>

                  <div className="form-grid">
                    {entityType === "INDIVIDUAL" ? (
                      <>
                        <div className="field">
                          <label className="small">
                            Prénoms <span style={{ color: "var(--danger)" }}>*</span>
                          </label>
                          <input
                            className="input"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Ex: Moussa"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && canLaunchSimple && launchSimple()}
                          />
                        </div>
                        <div className="field">
                          <label className="small">
                            Nom <span style={{ color: "var(--danger)" }}>*</span>
                          </label>
                          <input
                            className="input"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Ex: Diane"
                            onKeyDown={(e) => e.key === "Enter" && canLaunchSimple && launchSimple()}
                          />
                        </div>
                        <div className="field">
                          <label className="small">Date de naissance</label>
                          <input className="input" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
                        </div>
                        <div className="field">
                          <label className="small">Nationalité</label>
                          <input
                            className="input"
                            value={nationality}
                            onChange={(e) => setNationality(e.target.value)}
                            placeholder="Ex: ML, GN, RCI"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="field span-2">
                        <label className="small">
                          Nom de l'entreprise <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <input
                          className="input"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Ex: SONATEL"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && canLaunchSimple && launchSimple()}
                        />
                      </div>
                    )}
                    <div className="field">
                      <label className="small">Max correspondances</label>
                      <input
                        className="input"
                        type="number"
                        value={maxMatches}
                        onChange={(e) => setMaxMatches(Math.max(1, Math.min(200, Number(e.target.value))))}
                        min={1}
                        max={200}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                    <button
                      className="btn"
                      disabled={!canLaunchSimple || busy}
                      onClick={launchSimple}
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "13px",
                        fontSize: 15,
                        fontWeight: 700,
                        opacity: canLaunchSimple ? 1 : 0.45,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Search size={16} />
                      Lancer le screening
                    </button>
                    <button className="btn secondary" onClick={reset} disabled={busy}>
                      Reset
                    </button>
                  </div>

                  {!canLaunchSimple && (
                    <div className="small" style={{ marginTop: 8, opacity: 0.5, textAlign: "center" }}>
                      {entityType === "INDIVIDUAL" ? "Prénom + Nom requis" : "Nom d'entreprise requis"}
                    </div>
                  )}
                </div>
              )}

              {mode === "document" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: 0,
                      marginBottom: 20,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    {(["upload", "ocr", "confirm"] as const).map((s, i) => {
                      const done = (docStep === "ocr" && i === 0) || (docStep === "confirm" && i <= 1);
                      const active = docStep === s;
                      return (
                        <div
                          key={s}
                          style={{
                            flex: 1,
                            padding: "10px 8px",
                            textAlign: "center",
                            background: active
                              ? "rgba(31,85,64,0.12)"
                              : done
                              ? "rgba(46,204,143,0.07)"
                              : "transparent",
                            borderRight: i < 2 ? "1px solid var(--border)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                            {done ? (
                              <CheckCircle2 size={16} color="var(--ok)" />
                            ) : active ? (
                              <Loader2 size={16} color="var(--accent)" />
                            ) : (
                              <FileText size={16} color="var(--text-muted)" />
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: active ? "var(--text-accent)" : done ? "var(--ok)" : "var(--text-muted)",
                            }}
                          >
                            {["1. Upload", "2. OCR", "3. Confirmation"][i]}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {err && (
                    <div className="toast danger" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <XCircle size={16} />
                      {err}
                    </div>
                  )}

                  {docStep === "upload" && (
                    <div>
                      <div className="h2" style={{ marginBottom: 4 }}>
                        Upload du document
                      </div>
                      <div className="small" style={{ opacity: 0.6, marginBottom: 16 }}>
                        Recto de la pièce d'identité (CNI, Passeport)
                      </div>

                      <div
                        onClick={() => fileRef.current?.click()}
                        style={{
                          border: `2px dashed ${docFile ? "var(--border-active)" : "var(--border)"}`,
                          borderRadius: 16,
                          padding: "32px 20px",
                          textAlign: "center",
                          cursor: "pointer",
                          background: docFile ? "var(--accent-light)" : "rgba(20,30,60,0.02)",
                          transition: "all 0.2s",
                          marginBottom: 14,
                        }}
                      >
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: "none" }}
                          onChange={(e) => pickFile(e.target.files?.[0] || null)}
                        />
                        {docFile ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                              <FileText size={28} color="var(--text-accent)" />
                            </div>
                            <div style={{ fontWeight: 700, color: "var(--text-accent)", fontSize: 14 }}>{docFile.name}</div>
                            <div className="small" style={{ marginTop: 4, opacity: 0.6 }}>
                              {(docFile.size / 1024).toFixed(1)} KB · Cliquer pour changer
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                              <Camera size={36} style={{ opacity: 0.45 }} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                              Glisser-déposer ou cliquer pour uploader
                            </div>
                            <div className="small" style={{ opacity: 0.5 }}>JPG, PNG, WEBP · Max 10MB</div>
                          </>
                        )}
                      </div>

                      {docPreview && (
                        <div
                          style={{
                            marginBottom: 14,
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "1px solid var(--border)",
                            background: "var(--surface-2)",
                          }}
                        >
                          <img
                            src={docPreview}
                            alt="preview"
                            style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
                          />
                        </div>
                      )}

                      <div className="form-grid" style={{ marginBottom: 16 }}>
                        <div className="field">
                          <label className="small">Type de document</label>
                          <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                            <option value="ID_CARD">Carte d'identité</option>
                            <option value="PASSPORT">Passeport</option>
                          </select>
                        </div>
                        <div className="field">
                          <label className="small">Client ID (optionnel)</label>
                          <input
                            className="input"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="Ex: CLI-001"
                          />
                        </div>
                      </div>

                      <button
                        className="btn"
                        disabled={!docFile || busy}
                        onClick={uploadDoc}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          padding: "13px",
                          fontSize: 15,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Upload size={16} />
                        {busy ? "Uploading…" : "Uploader le document"}
                      </button>
                    </div>
                  )}

                  {docStep === "ocr" && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <ScanText size={48} color="var(--accent)" />
                      </div>
                      <div className="h2" style={{ marginBottom: 8 }}>
                        Document uploadé
                      </div>
                      <div className="small" style={{ opacity: 0.6, marginBottom: 24 }}>
                        document_id: <code style={{ fontSize: 10 }}>{documentId}</code>
                      </div>
                      <div
                        style={{
                          padding: "20px",
                          background: "rgba(20,30,60,0.03)",
                          border: "1px solid var(--border)",
                          borderRadius: 14,
                          marginBottom: 20,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Extraction OCR</div>
                        <div className="small" style={{ opacity: 0.7 }}>
                          Cliquez pour extraire automatiquement les données du document (nom, prénom, date de naissance, numéro).
                        </div>
                      </div>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={runOcr}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          padding: "13px",
                          fontSize: 15,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Bot size={16} />
                        {busy ? "Extraction en cours…" : "Lancer l'extraction OCR"}
                      </button>
                      <button className="btn secondary" onClick={() => setDocStep("upload")} style={{ width: "100%", marginTop: 8 }}>
                        Rechoisir un document
                      </button>
                    </div>
                  )}

                  {docStep === "confirm" && (
                    <div>
                      <div className="h2" style={{ marginBottom: 4 }}>
                        Données extraites
                      </div>
                      <div className="small" style={{ opacity: 0.6, marginBottom: 16 }}>
                        Vérifiez et corrigez si nécessaire avant de lancer le screening.
                      </div>

                      <div
                        style={{
                          padding: "14px 16px",
                          background: "rgba(46,204,143,0.07)",
                          border: "1px solid rgba(46,204,143,0.2)",
                          borderRadius: 12,
                          marginBottom: 16,
                        }}
                      >
                        <div className="form-grid">
                          {[
                            ["Prénom", ocrFields?.first_name || ""],
                            ["Nom", ocrFields?.last_name || ""],
                            ["Date de naissance", ocrFields?.date_of_birth || ""],
                            ["N° Document", ocrFields?.document_number || ""],
                          ].map(([label, val]) => (
                            <div key={label}>
                              <div className="profile-label">{label}</div>
                              <div className="profile-value" style={{ fontSize: 13 }}>
                                {val || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="field" style={{ marginBottom: 16 }}>
                        <label className="small">Nom de screening (modifiable)</label>
                        <input
                          className="input"
                          value={overrideName}
                          onChange={(e) => setOverrideName(e.target.value)}
                          placeholder="Prénom Nom"
                        />
                        <div className="small" style={{ marginTop: 4, opacity: 0.5 }}>
                          Le screening sera lancé sur : <b>{overrideName || "(vide)"}</b>
                        </div>
                      </div>

                      <button
                        className="btn"
                        disabled={!overrideName.trim() || busy}
                        onClick={launchFromDoc}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          padding: "13px",
                          fontSize: 15,
                          fontWeight: 700,
                          opacity: overrideName.trim() ? 1 : 0.4,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Search size={16} />
                        Lancer le screening
                      </button>
                      <button className="btn secondary" onClick={() => setDocStep("ocr")} style={{ width: "100%", marginTop: 8 }}>
                        Relancer l'OCR
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="screen" style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    background: "var(--accent-light)",
                    border: "2px solid var(--border-active)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Loader2 size={28} style={{ animation: "spin 1.5s linear infinite" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Analyse en cours…</div>
                <div className="small" style={{ opacity: 0.6 }}>
                  {mode === "simple" ? "Vérification des sanctions et listes PEP" : "OCR → Matching → Analyse de risque"}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 6, background: "rgba(20,30,60,0.05)", borderRadius: 3, marginBottom: 8 }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      background: "var(--accent)",
                      width: `${Math.round((procStep / procSteps.length) * 100)}%`,
                      transition: "width 0.5s ease",
                      boxShadow: "0 0 8px rgba(31,85,64,0.5)",
                    }}
                  />
                </div>
                <div className="small" style={{ textAlign: "right", opacity: 0.5 }}>
                  {Math.round((procStep / procSteps.length) * 100)}%
                </div>
              </div>

              <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: 16, marginLeft: 8 }}>
                {procSteps.map((s, i) => (
                  <ProcessingStep key={i} label={s} done={i < procStep} active={i === procStep} />
                ))}
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="screen" style={{ animation: "fadeIn 0.4s ease" }}>
              <ResultCard result={result} onReset={reset} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: "calc(var(--topnav-height) + 16px)" }}>
          {step === "form" && (
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom: 12 }}>
                {mode === "simple" ? "Comment ça marche ?" : "Mode Extraction OCR"}
              </div>

              {mode === "simple" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    [UserRoundSearch, "Renseignez le nom", "Entrez le prénom et nom du sujet à screener."],
                    [Search, "Lancez l'analyse", "Le moteur analyse les listes de sanctions, PEP et media défavorables."],
                    [BadgeCheck, "Consultez le résultat", "Risque, correspondances et action recommandée."],
                    [CheckCircle2, "Prenez une décision", "PASS ou BLOCK avec commentaire obligatoire."],
                  ].map(([Icon, title, desc]) => (
                    <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, lineHeight: 1.3, display: "flex", marginTop: 1 }}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{title}</div>
                        <div className="small" style={{ opacity: 0.6 }}>
                          {desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    [Camera, "Uploadez le document", "Recto de la CNI ou passeport."],
                    [Bot, "Extraction automatique", "L'IA extrait le nom, prénom, date de naissance."],
                    [Pencil, "Vérifiez les données", "Corrigez si l'OCR a fait des erreurs."],
                    [Search, "Screening lancé", "Analyse complète sur les données extraites."],
                  ].map(([Icon, title, desc]) => (
                    <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, display: "flex", marginTop: 1 }}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{title}</div>
                        <div className="small" style={{ opacity: 0.6 }}>
                          {desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="chart-card">
            <div className="chart-title" style={{ marginBottom: 12 }}>
              Sources de données
            </div>
            {[
              { icon: ShieldAlert, label: "Sanctions OFAC" },
              { icon: Building2, label: "Nations Unies (ONU)" },
              { icon: Globe2, label: "EU Sanctions List" },
              { icon: User, label: "PEP (Politiquement Exposés)" },
              { icon: Newspaper, label: "Adverse Media" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <Icon size={16} />
                  <span className="small" style={{ flex: 1 }}>
                    {s.label}
                  </span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: "var(--ok)",
                      boxShadow: "0 0 6px var(--ok)44",
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="chart-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="chart-title">Accès rapide</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link to="/screenings" className="btn secondary" style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={16} />
                Historique des screenings
              </Link>
              <Link to="/cases" className="btn secondary" style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                <FolderOpen size={16} />
                Case Management
              </Link>
              <Link to="/watchlists" className="btn secondary" style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                <FileSearch size={16} />
                Rechercher dans les watchlists
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}