// src/pages/AnalystHome.tsx — High-product screening flow UI
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, {
  launchSimpleScreening,
  uploadDocumentStandalone,
  extractOcr,
  screeningFromDocument,
  downloadScreeningExportPdf,
  setScreeningDecision,
  getScreeningDetails,
  getDocumentStatus
} from "../api";

import type { SimpleScreeningIn } from "../api";

// ─── Types ────────────────────────────────────────────────────────
type Mode = "simple" | "document";
type Step = "form" | "processing" | "result";

interface ScreeningResult {
  request_id: string;
  status:     string;
  risk_level: string | null;
  recommended_action: string | null;
  confidence: number | null;
  matches_count: number;
  decision_latest?: any;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
function riskConfig(r: string | null) {
  const v = String(r||"").toUpperCase();
  if (v==="HIGH")   return { color:"#E84040", bg:"rgba(232,64,64,0.12)",  border:"rgba(232,64,64,0.3)",  label:"Élevé",  icon:"🚨" };
  if (v==="MEDIUM") return { color:"#F5920A", bg:"rgba(245,146,10,0.12)", border:"rgba(245,146,10,0.3)", label:"Moyen",  icon:"⚠️" };
  if (v==="LOW")    return { color:"#2ECC8F", bg:"rgba(46,204,143,0.12)", border:"rgba(46,204,143,0.3)", label:"Faible", icon:"✅" };
  return { color:"#94A3B8", bg:"rgba(148,163,184,0.1)", border:"rgba(148,163,184,0.2)", label:"—", icon:"❓" };
}
function actionConfig(a: string | null) {
  const v = String(a||"").toUpperCase();
  if (v==="PASS")          return { color:"#2ECC8F", label:"Autoriser",       icon:"✅", bg:"rgba(46,204,143,0.12)" };
  if (v==="MANUAL_REVIEW") return { color:"#F5920A", label:"Revue manuelle", icon:"🔍", bg:"rgba(245,146,10,0.12)" };
  if (v==="BLOCK")         return { color:"#E84040", label:"Bloquer",         icon:"⛔", bg:"rgba(232,64,64,0.12)" };
  return { color:"#94A3B8", label:String(a||"—"), icon:"❓", bg:"rgba(148,163,184,0.1)" };
}

// ─── Animated progress bar ────────────────────────────────────────
function ProcessingStep({ label, done, active }: { label:string; done:boolean; active:boolean }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0" }}>
      <div style={{ width:28, height:28, borderRadius:14, flexShrink:0,
        background: done?"#2ECC8F":active?"var(--accent)":"rgba(255,255,255,0.08)",
        border: done?"none":active?"2px solid var(--accent)":"2px solid rgba(255,255,255,0.1)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, transition:"all 0.4s",
        boxShadow: active?"0 0 12px rgba(45,127,214,0.5)":"none" }}>
        {done ? "✓" : active ? <ProcessingDot/> : ""}
      </div>
      <span style={{ fontSize:14, color:done?"var(--text-primary)":active?"var(--text-accent)":"var(--text-muted)",
        fontWeight:done||active?600:400, transition:"color 0.4s" }}>
        {label}
      </span>
    </div>
  );
}

function ProcessingDot() {
  return (
    <div style={{ width:8, height:8, borderRadius:4, background:"var(--accent)",
      animation:"pulse 1s ease-in-out infinite" }} />
  );
}

// ─── Result Card ──────────────────────────────────────────────────
function ResultCard({ result, onReset, onDecision }: {
  result: ScreeningResult;
  onReset: () => void;
  onDecision: (d:"PASS"|"BLOCK", comment:string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const rc  = riskConfig(result.risk_level);
  const ac  = actionConfig(result.recommended_action);
  const [comment, setComment] = useState("");
  const [decBusy, setDecBusy] = useState(false);
  const [decDone, setDecDone] = useState<string|null>(null);

  async function decide(d:"PASS"|"BLOCK") {
    if(comment.trim().length<4) return;
    setDecBusy(true);
    await onDecision(d, comment.trim());
    setDecDone(d);
    setDecBusy(false);
  }

  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      {/* Result header */}
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:48, marginBottom:8 }}>{rc.icon}</div>
        <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)", marginBottom:4 }}>
          {result.name}
        </div>
        <div className="small" style={{ opacity:0.6 }}>Screening complété avec succès</div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        {/* Risk */}
        <div style={{ padding:"16px 12px", borderRadius:14, textAlign:"center",
          background:rc.bg, border:`1px solid ${rc.border}` }}>
          <div style={{ fontSize:20, marginBottom:4 }}>{rc.icon}</div>
          <div style={{ fontSize:11, color:rc.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>Risque</div>
          <div style={{ fontSize:18, fontWeight:800, color:rc.color }}>{rc.label}</div>
        </div>
        {/* Action */}
        <div style={{ padding:"16px 12px", borderRadius:14, textAlign:"center",
          background:ac.bg, border:`1px solid ${ac.color}40` }}>
          <div style={{ fontSize:20, marginBottom:4 }}>{ac.icon}</div>
          <div style={{ fontSize:11, color:ac.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>Action</div>
          <div style={{ fontSize:14, fontWeight:800, color:ac.color }}>{ac.label}</div>
        </div>
        {/* Matches */}
        <div style={{ padding:"16px 12px", borderRadius:14, textAlign:"center",
          background: result.matches_count>0?"rgba(232,64,64,0.08)":"rgba(46,204,143,0.08)",
          border: `1px solid ${result.matches_count>0?"rgba(232,64,64,0.2)":"rgba(46,204,143,0.2)"}` }}>
          <div style={{ fontSize:20, marginBottom:4 }}>{result.matches_count>0?"⚡":"✓"}</div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2,
            color:result.matches_count>0?"#E84040":"#2ECC8F" }}>Matchs</div>
          <div style={{ fontSize:18, fontWeight:800,
            color:result.matches_count>0?"#E84040":"#2ECC8F" }}>{result.matches_count}</div>
        </div>
      </div>

      {/* Decision section */}
      {!decDone ? (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)",
          borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:6, color:"var(--text-primary)" }}>
            Prendre une décision
          </div>
          <div className="small" style={{ opacity:0.6, marginBottom:12 }}>
            Commentaire obligatoire (min 4 caractères)
          </div>
          <textarea value={comment} onChange={e=>setComment(e.target.value)}
            placeholder="Justification de la décision PASS ou BLOCK…"
            style={{ width:"100%", marginBottom:12, minHeight:70 }} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <button onClick={()=>decide("PASS")} disabled={decBusy||comment.trim().length<4}
              style={{ padding:"12px", borderRadius:10, border:"1.5px solid #2ECC8F",
                background:comment.trim().length>=4?"rgba(46,204,143,0.12)":"rgba(255,255,255,0.04)",
                color:"#2ECC8F", fontWeight:700, fontSize:14, cursor:"pointer",
                opacity:comment.trim().length<4?0.4:1, transition:"all 0.2s" }}>
              ✅ PASS
            </button>
            <button onClick={()=>decide("BLOCK")} disabled={decBusy||comment.trim().length<4}
              style={{ padding:"12px", borderRadius:10, border:"1.5px solid #E84040",
                background:comment.trim().length>=4?"rgba(232,64,64,0.12)":"rgba(255,255,255,0.04)",
                color:"#E84040", fontWeight:700, fontSize:14, cursor:"pointer",
                opacity:comment.trim().length<4?0.4:1, transition:"all 0.2s" }}>
              ⛔ BLOCK
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding:"14px 16px", borderRadius:14, marginBottom:16, textAlign:"center",
          background:decDone==="PASS"?"rgba(46,204,143,0.12)":"rgba(232,64,64,0.12)",
          border:`1px solid ${decDone==="PASS"?"rgba(46,204,143,0.3)":"rgba(232,64,64,0.3)"}` }}>
          <div style={{ fontSize:22, marginBottom:4 }}>{decDone==="PASS"?"✅":"⛔"}</div>
          <div style={{ fontWeight:700, color:decDone==="PASS"?"#2ECC8F":"#E84040" }}>
            Décision {decDone} enregistrée
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"grid", gap:8 }}>
        <button className="btn" onClick={()=>navigate(`/screenings/${result.request_id}`)}
          style={{ width:"100%", justifyContent:"center" }}>
          📋 Voir les détails complets
        </button>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <button className="btn secondary" onClick={()=>downloadScreeningExportPdf(result.request_id)}
            style={{ justifyContent:"center" }}>
            ⬇️ Export PDF
          </button>
          <button className="btn secondary" onClick={onReset} style={{ justifyContent:"center" }}>
            🔍 Nouveau screening
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AnalystHome() {
  const [mode,    setMode]    = useState<Mode>("simple");
  const [step,    setStep]    = useState<Step>("form");
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState<string|null>(null);
  const [result,  setResult]  = useState<ScreeningResult|null>(null);

  // Processing steps state
  const [procStep, setProcStep] = useState(0);
  const PROC_STEPS_SIMPLE   = ["Création du dossier","Analyse des correspondances","Vérification sanctions","Calcul du niveau de risque","Finalisation"];
  const PROC_STEPS_DOCUMENT = ["Upload du document","Extraction OCR","Vérification des données","Analyse des correspondances","Calcul du niveau de risque","Finalisation"];

  // Simple form state
  const [entityType,  setEntityType]  = useState<"INDIVIDUAL"|"COMPANY">("INDIVIDUAL");
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [companyName, setCompanyName] = useState("");
  const [maxMatches,  setMaxMatches]  = useState(20);
  const [dob,         setDob]         = useState("");
  const [nationality, setNationality] = useState("");

  // Document form state
  const [docFile,      setDocFile]      = useState<File|null>(null);
  const [docType,      setDocType]      = useState("ID_CARD");
  const [docPreview,   setDocPreview]   = useState<string|null>(null);
  const [documentId,   setDocumentId]   = useState<string|null>(null);
  const [ocrFields,    setOcrFields]    = useState<any>(null);
  const [overrideName, setOverrideName] = useState("");
  const [clientId,     setClientId]     = useState("");
  const [docStep,      setDocStep]      = useState<"upload"|"ocr"|"confirm">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const canLaunchSimple = useMemo(()=>{
    if(entityType==="INDIVIDUAL") return !!firstName.trim() && !!lastName.trim();
    return !!companyName.trim();
  },[entityType,firstName,lastName,companyName]);


  
  // Cleanup preview URL
  useEffect(()=>{
    return ()=>{ if(docPreview) URL.revokeObjectURL(docPreview); };
  },[docPreview]);

  function pickFile(f: File|null) {
    setDocFile(f);
    setDocumentId(null); setOcrFields(null); setOverrideName("");
    if(docPreview) URL.revokeObjectURL(docPreview);
    setDocPreview(f ? URL.createObjectURL(f) : null);
    setDocStep("upload");
  }

  function reset() {
    setStep("form"); setResult(null); setErr(null); setBusy(false); setProcStep(0);
    setFirstName(""); setLastName(""); setCompanyName(""); setDob(""); setNationality("");
    pickFile(null); setDocStep("upload"); setOverrideName(""); setClientId("");
  }

  // Simulate progress during processing
  async function animateProgress(totalSteps: number, durationMs: number) {
    const interval = durationMs / totalSteps;
    for (let i=0; i<totalSteps; i++) {
      await new Promise(r=>setTimeout(r, interval + Math.random()*300));
      setProcStep(i+1);
    }
  }

  // ── Launch simple screening ──────────────────────────────────────
  async function launchSimple() {
    if(!canLaunchSimple) return;
    setBusy(true); setErr(null); setStep("processing"); setProcStep(0);

    const name = entityType==="INDIVIDUAL"
      ? `${firstName.trim()} ${lastName.trim()}`.trim()
      : companyName.trim();

    // Start animation concurrently
    const anim = animateProgress(PROC_STEPS_SIMPLE.length, 3000);

    try {
      const payload: SimpleScreeningIn = {
        entity_type: entityType,
        first_name: entityType==="INDIVIDUAL"?firstName.trim():undefined,
        last_name:  entityType==="INDIVIDUAL"?lastName.trim():undefined,
        company_name: entityType==="COMPANY"?companyName.trim():undefined,
        dob: dob.trim()||undefined,
        nationality: nationality.trim()||undefined,
        max_matches: maxMatches,
        aliases:[], include_aliases:false,
      };
      const res: any = await launchSimpleScreening(payload);
      await anim;

      // Load full details
      let details: any = {};
      try { details = await getScreeningDetails(res.request_id); } catch {}

      setResult({
        request_id:         res.request_id,
        status:             res.status ?? "DONE",
        risk_level:         details?.result?.risk_level ?? res.risk_level ?? null,
        recommended_action: details?.result?.recommended_action ?? res.recommended_action ?? null,
        confidence:         details?.result?.confidence ?? res.confidence ?? null,
        matches_count:      Array.isArray(details?.matches)?details.matches.length:(res.matches_count??0),
        decision_latest:    details?.decision_latest ?? null,
        name,
      });
      setStep("result");
    } catch(e:any) {
      await anim;
      const d = e?.response?.data?.detail;
      const msg = Array.isArray(d)?d.map((x:any)=>x?.msg||JSON.stringify(x)).join(", "):(typeof d==="string"?d:e?.message||"Erreur");
      setErr(msg);
      setStep("form");
    } finally { setBusy(false); }
  }

  // ── Document flow ────────────────────────────────────────────────
  async function uploadDoc() {
    if(!docFile) return;
    setBusy(true); setErr(null);
    try {
      const res: any = await uploadDocumentStandalone(docType, docFile);
      setDocumentId(res.document_id);
      setDocStep("ocr");
    } catch(e:any) {
      setErr(e?.response?.data?.detail||e?.message||"Upload échoué");
    } finally { setBusy(false); }
  }

  async function runOcr() {
  if (!documentId) return;
  setBusy(true); setErr(null);
  try {
    // 1) Lance l'extraction (répond immédiatement PENDING)
    await extractOcr(documentId);

    // 2) Polling — interroge GET /documents/cases/{case_id}
    // Mais on n'a pas le case_id ici → on utilise getScreeningDetails non,
    // on appelle directement GET /documents/{doc_id}/status via api
    const MAX_ATTEMPTS = 20;
    const INTERVAL_MS  = 1500;
    let extracted: any = null;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, INTERVAL_MS));

      try {
        // GET /documents/{doc_id}/extract-status — ou on reuse l'endpoint existant
        const { data } = await api.get(`/documents/${documentId}/status`);
        const status = data?.ocr_status as string;

        if (status === "DONE" || status === "LOW_CONFIDENCE") {
          extracted = data?.extracted_fields || {};
          break;
        }
        if (status === "FAILED") {
          throw new Error("OCR échoué côté serveur");
        }
        // PENDING → on continue
      } catch (pollErr: any) {
        // Si l'endpoint /status n'existe pas, fallback sur les détails du doc
        break;
      }
    }

    if (!extracted) {
      throw new Error("OCR timeout — réessayez dans quelques secondes");
    }

    setOcrFields(extracted);
    const fn = (extracted.first_name || "").trim();
    const ln = (extracted.last_name  || "").trim();
    setOverrideName([fn, ln].filter(Boolean).join(" ").trim());
    setDocStep("confirm");

  } catch (e: any) {
    setErr(e?.response?.data?.detail || e?.message || "OCR échoué");
  } finally {
    setBusy(false);
  }
}

  async function launchFromDoc() {
    if(!documentId || !overrideName.trim()) return;
    setBusy(true); setErr(null); setStep("processing"); setProcStep(0);
    const anim = animateProgress(PROC_STEPS_DOCUMENT.length, 4000);
    try {
      const res: any = await screeningFromDocument({ document_id:documentId, client_id:clientId.trim()||undefined, override_name:overrideName.trim() });
      await anim;

      let details: any = {};
      try { details = await getScreeningDetails(res.request_id); } catch {}

      setResult({
        request_id:         res.request_id,
        status:             res.status ?? "DONE",
        risk_level:         details?.result?.risk_level ?? res.risk_level ?? null,
        recommended_action: details?.result?.recommended_action ?? res.recommended_action ?? null,
        confidence:         details?.result?.confidence ?? res.confidence ?? null,
        matches_count:      Array.isArray(details?.matches)?details.matches.length:(res.matches_count??0),
        decision_latest:    details?.decision_latest ?? null,
        name:               overrideName.trim(),
      });
      setStep("result");
    } catch(e:any) {
      await anim;
      const d = e?.response?.data?.detail;
      setErr(Array.isArray(d)?d.map((x:any)=>x?.msg||JSON.stringify(x)).join(", "):(typeof d==="string"?d:e?.message||"Erreur"));
      setStep("form");
    } finally { setBusy(false); }
  }

  async function handleDecision(decision:"PASS"|"BLOCK", comment:string) {
    if(!result) return;
    await setScreeningDecision(result.request_id, decision, comment);
    // Refresh result
    try {
      const d: any = await getScreeningDetails(result.request_id);
      setResult(prev=>prev?({...prev, decision_latest:d?.decision_latest??null}):prev);
    } catch {}
  }

  const procSteps = mode==="simple" ? PROC_STEPS_SIMPLE : PROC_STEPS_DOCUMENT;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.3); opacity:0.7; } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:24, alignItems:"start" }}>

        {/* ── LEFT: Main panel ── */}
        <div>
          {/* Header */}
          <div className="page-header">
            <div className="page-kicker">AML / PEP</div>
            <div className="page-title">Nouveau Screening</div>
            <div className="page-subtitle">Lancez un screening AML/PEP en quelques secondes</div>
          </div>

          {/* Mode selector — only visible on form step */}
          {step==="form" && (
            <div style={{ display:"flex", gap:0, background:"rgba(0,0,0,0.3)", border:"1px solid var(--border)",
              borderRadius:14, padding:4, marginBottom:20, width:"fit-content" }}>
              {([["simple","🔍 Mode simple"],["document","📄 Extraction OCR"]] as const).map(([m,label])=>(
                <button key={m} onClick={()=>{setMode(m);setErr(null);}}
                  style={{ padding:"10px 20px", borderRadius:11, border:"none",
                    background:mode===m?"var(--accent)":"transparent",
                    color:mode===m?"white":"var(--text-muted)",
                    fontWeight:mode===m?700:500, fontSize:13.5, cursor:"pointer",
                    transition:"all 0.2s" }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── FORM STEP ── */}
          {step==="form" && (
            <div className="screen" style={{ animation:"fadeIn 0.3s ease" }}>
              {err && <div className="toast danger" style={{marginBottom:16}}>❌ {err}</div>}

              {/* SIMPLE MODE */}
              {mode==="simple" && (
                <div>
                  <div className="h2" style={{ marginBottom:16 }}>Informations du sujet</div>

                  {/* Entity type */}
                  <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                    {(["INDIVIDUAL","COMPANY"] as const).map(t=>(
                      <button key={t} onClick={()=>setEntityType(t)}
                        style={{ flex:1, padding:"10px", borderRadius:10,
                          border:`1.5px solid ${entityType===t?"var(--accent)":"var(--border)"}`,
                          background:entityType===t?"var(--accent-light)":"transparent",
                          color:entityType===t?"var(--text-accent)":"var(--text-muted)",
                          fontWeight:600, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>
                        {t==="INDIVIDUAL"?"👤 Personne":"🏢 Entreprise"}
                      </button>
                    ))}
                  </div>

                  <div className="form-grid">
                    {entityType==="INDIVIDUAL" ? (
                      <>
                        <div className="field">
                          <label className="small">Prénoms <span style={{color:"#E84040"}}>*</span></label>
                          <input className="input" value={firstName} onChange={e=>setFirstName(e.target.value)}
                            placeholder="Ex: Moussa" autoFocus onKeyDown={e=>e.key==="Enter"&&canLaunchSimple&&launchSimple()} />
                        </div>
                        <div className="field">
                          <label className="small">Nom <span style={{color:"#E84040"}}>*</span></label>
                          <input className="input" value={lastName} onChange={e=>setLastName(e.target.value)}
                            placeholder="Ex: Diane" onKeyDown={e=>e.key==="Enter"&&canLaunchSimple&&launchSimple()} />
                        </div>
                        <div className="field">
                          <label className="small">Date de naissance</label>
                          <input className="input" value={dob} onChange={e=>setDob(e.target.value)}
                            placeholder="YYYY-MM-DD" />
                        </div>
                        <div className="field">
                          <label className="small">Nationalité</label>
                          <input className="input" value={nationality} onChange={e=>setNationality(e.target.value)}
                            placeholder="Ex: ML, GN, RCI" />
                        </div>
                      </>
                    ) : (
                      <div className="field span-2">
                        <label className="small">Nom de l'entreprise <span style={{color:"#E84040"}}>*</span></label>
                        <input className="input" value={companyName} onChange={e=>setCompanyName(e.target.value)}
                          placeholder="Ex: SONATEL" autoFocus onKeyDown={e=>e.key==="Enter"&&canLaunchSimple&&launchSimple()} />
                      </div>
                    )}
                    <div className="field">
                      <label className="small">Max correspondances</label>
                      <input className="input" type="number" value={maxMatches}
                        onChange={e=>setMaxMatches(Math.max(1,Math.min(200,Number(e.target.value))))}
                        min={1} max={200} />
                    </div>
                  </div>

                  <div style={{ marginTop:20, display:"flex", gap:10 }}>
                    <button className="btn" disabled={!canLaunchSimple||busy}
                      onClick={launchSimple}
                      style={{ flex:1, justifyContent:"center", padding:"13px",
                        fontSize:15, fontWeight:700, opacity:canLaunchSimple?1:0.45 }}>
                      🔍 Lancer le screening
                    </button>
                    <button className="btn secondary" onClick={reset} disabled={busy}>Reset</button>
                  </div>

                  {!canLaunchSimple && (
                    <div className="small" style={{ marginTop:8, opacity:0.5, textAlign:"center" }}>
                      {entityType==="INDIVIDUAL"?"Prénom + Nom requis":"Nom d'entreprise requis"}
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENT MODE */}
              {mode==="document" && (
                <div>
                  {/* Progress steps */}
                  <div style={{ display:"flex", gap:0, marginBottom:20, background:"rgba(0,0,0,0.2)",
                    border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
                    {(["upload","ocr","confirm"] as const).map((s,i)=>{
                      const done  = (docStep==="ocr"&&i===0)||(docStep==="confirm"&&i<=1);
                      const active= docStep===s;
                      return (
                        <div key={s} style={{ flex:1, padding:"10px 8px", textAlign:"center",
                          background:active?"rgba(45,127,214,0.12)":done?"rgba(46,204,143,0.07)":"transparent",
                          borderRight:i<2?"1px solid var(--border)":"none" }}>
                          <div style={{ fontSize:16, marginBottom:2 }}>
                            {done?"✅":active?"🔵":"⚪"}
                          </div>
                          <div style={{ fontSize:11, fontWeight:600,
                            color:active?"var(--text-accent)":done?"#2ECC8F":"var(--text-muted)" }}>
                            {["1. Upload","2. OCR","3. Confirmation"][i]}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {err && <div className="toast danger" style={{marginBottom:14}}>❌ {err}</div>}

                  {/* Step 1: Upload */}
                  {docStep==="upload" && (
                    <div>
                      <div className="h2" style={{ marginBottom:4 }}>Upload du document</div>
                      <div className="small" style={{ opacity:0.6, marginBottom:16 }}>
                        Recto de la pièce d'identité (CNI, Passeport)
                      </div>

                      {/* Drop zone */}
                      <div onClick={()=>fileRef.current?.click()}
                        style={{ border:`2px dashed ${docFile?"var(--border-active)":"var(--border)"}`,
                          borderRadius:16, padding:"32px 20px", textAlign:"center", cursor:"pointer",
                          background:docFile?"var(--accent-light)":"rgba(255,255,255,0.02)",
                          transition:"all 0.2s", marginBottom:14 }}>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment"
                          style={{display:"none"}} onChange={e=>pickFile(e.target.files?.[0]||null)} />
                        {docFile ? (
                          <>
                            <div style={{ fontSize:28, marginBottom:4 }}>📎</div>
                            <div style={{ fontWeight:700, color:"var(--text-accent)", fontSize:14 }}>{docFile.name}</div>
                            <div className="small" style={{ marginTop:4, opacity:0.6 }}>
                              {(docFile.size/1024).toFixed(1)} KB · Cliquer pour changer
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize:36, marginBottom:8, opacity:0.4 }}>📸</div>
                            <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>
                              Glisser-déposer ou cliquer pour uploader
                            </div>
                            <div className="small" style={{ opacity:0.5 }}>JPG, PNG, WEBP · Max 10MB</div>
                          </>
                        )}
                      </div>

                      {/* Preview */}
                      {docPreview && (
                        <div style={{ marginBottom:14, borderRadius:12, overflow:"hidden",
                          border:"1px solid var(--border)", background:"rgba(0,0,0,0.2)" }}>
                          <img src={docPreview} alt="preview"
                            style={{ width:"100%", maxHeight:200, objectFit:"contain", display:"block" }} />
                        </div>
                      )}

                      <div className="form-grid" style={{ marginBottom:16 }}>
                        <div className="field">
                          <label className="small">Type de document</label>
                          <select className="select" value={docType} onChange={e=>setDocType(e.target.value)}>
                            <option value="ID_CARD">Carte d'identité</option>
                            <option value="PASSPORT">Passeport</option>
                          </select>
                        </div>
                        <div className="field">
                          <label className="small">Client ID (optionnel)</label>
                          <input className="input" value={clientId} onChange={e=>setClientId(e.target.value)}
                            placeholder="Ex: CLI-001" />
                        </div>
                      </div>

                      <button className="btn" disabled={!docFile||busy} onClick={uploadDoc}
                        style={{ width:"100%", justifyContent:"center", padding:"13px", fontSize:15, fontWeight:700 }}>
                        {busy?"Uploading…":"⬆️ Uploader le document"}
                      </button>
                    </div>
                  )}

                  {/* Step 2: OCR */}
                  {docStep==="ocr" && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
                      <div className="h2" style={{ marginBottom:8 }}>Document uploadé ✅</div>
                      <div className="small" style={{ opacity:0.6, marginBottom:24 }}>
                        document_id: <code style={{fontSize:10}}>{documentId}</code>
                      </div>
                      <div style={{ padding:"20px", background:"rgba(255,255,255,0.03)",
                        border:"1px solid var(--border)", borderRadius:14, marginBottom:20 }}>
                        <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>Extraction OCR</div>
                        <div className="small" style={{ opacity:0.7 }}>
                          Cliquez pour extraire automatiquement les données du document (nom, prénom, date de naissance, numéro).
                        </div>
                      </div>
                      <button className="btn" disabled={busy} onClick={runOcr}
                        style={{ width:"100%", justifyContent:"center", padding:"13px", fontSize:15, fontWeight:700 }}>
                        {busy?"Extraction en cours…":"🤖 Lancer l'extraction OCR"}
                      </button>
                      <button className="btn secondary" onClick={()=>setDocStep("upload")} style={{ width:"100%", marginTop:8 }}>
                        ← Rechoisir un document
                      </button>
                    </div>
                  )}

                  {/* Step 3: Confirm */}
                  {docStep==="confirm" && (
                    <div>
                      <div className="h2" style={{ marginBottom:4 }}>Données extraites ✅</div>
                      <div className="small" style={{ opacity:0.6, marginBottom:16 }}>
                        Vérifiez et corrigez si nécessaire avant de lancer le screening.
                      </div>

                      <div style={{ padding:"14px 16px", background:"rgba(46,204,143,0.07)",
                        border:"1px solid rgba(46,204,143,0.2)", borderRadius:12, marginBottom:16 }}>
                        <div className="form-grid">
                          {[
                            ["Prénom",            ocrFields?.first_name||""],
                            ["Nom",               ocrFields?.last_name||""],
                            ["Date de naissance", ocrFields?.date_of_birth||""],
                            ["N° Document",       ocrFields?.document_number||""],
                          ].map(([label,val])=>(
                            <div key={label}>
                              <div className="profile-label">{label}</div>
                              <div className="profile-value" style={{ fontSize:13 }}>{val||"—"}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="field" style={{ marginBottom:16 }}>
                        <label className="small">Nom de screening (modifiable)</label>
                        <input className="input" value={overrideName} onChange={e=>setOverrideName(e.target.value)}
                          placeholder="Prénom Nom" />
                        <div className="small" style={{ marginTop:4, opacity:0.5 }}>
                          Le screening sera lancé sur : <b>{overrideName||"(vide)"}</b>
                        </div>
                      </div>

                      <button className="btn" disabled={!overrideName.trim()||busy} onClick={launchFromDoc}
                        style={{ width:"100%", justifyContent:"center", padding:"13px", fontSize:15, fontWeight:700,
                          opacity:overrideName.trim()?1:0.4 }}>
                        🔍 Lancer le screening
                      </button>
                      <button className="btn secondary" onClick={()=>setDocStep("ocr")} style={{ width:"100%", marginTop:8 }}>
                        ← Relancer l'OCR
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PROCESSING STEP ── */}
          {step==="processing" && (
            <div className="screen" style={{ animation:"fadeIn 0.3s ease" }}>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ width:64,height:64,borderRadius:32,background:"var(--accent-light)",
                  border:"2px solid var(--border-active)",display:"inline-flex",alignItems:"center",
                  justifyContent:"center",fontSize:28,animation:"spin 2s linear infinite",marginBottom:12 }}>
                  ⚙️
                </div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Analyse en cours…</div>
                <div className="small" style={{ opacity:0.6 }}>
                  {mode==="simple" ? "Vérification des sanctions et listes PEP" : "OCR → Matching → Analyse de risque"}
                </div>
              </div>

              {/* Progress bar global */}
              <div style={{ marginBottom:20 }}>
                <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3, marginBottom:8 }}>
                  <div style={{ height:"100%", borderRadius:3, background:"var(--accent)",
                    width:`${Math.round((procStep/procSteps.length)*100)}%`,
                    transition:"width 0.5s ease", boxShadow:"0 0 8px rgba(45,127,214,0.5)" }} />
                </div>
                <div className="small" style={{ textAlign:"right", opacity:0.5 }}>
                  {Math.round((procStep/procSteps.length)*100)}%
                </div>
              </div>

              {/* Steps list */}
              <div style={{ borderLeft:"2px solid var(--border)", paddingLeft:16, marginLeft:8 }}>
                {procSteps.map((s,i)=>(
                  <ProcessingStep key={i} label={s} done={i<procStep} active={i===procStep} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULT STEP ── */}
          {step==="result" && result && (
            <div className="screen" style={{ animation:"fadeIn 0.4s ease" }}>
              <ResultCard result={result} onReset={reset} onDecision={handleDecision} />
            </div>
          )}
        </div>

        {/* ── RIGHT: Info panel ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:14, position:"sticky", top:"calc(var(--topnav-height) + 16px)" }}>

          {/* Guide */}
          {step==="form" && (
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom:12 }}>
                {mode==="simple" ? "Comment ça marche ?" : "Mode Extraction OCR"}
              </div>
              {mode==="simple" ? (
                <div style={{ display:"grid", gap:10 }}>
                  {[
                    ["1️⃣","Renseignez le nom","Entrez le prénom et nom du sujet à screener."],
                    ["2️⃣","Lancez l'analyse","Le moteur analyse les listes de sanctions, PEP et media défavorables."],
                    ["3️⃣","Consultez le résultat","Risque, correspondances et action recommandée."],
                    ["4️⃣","Prenez une décision","PASS ou BLOCK avec commentaire obligatoire."],
                  ].map(([icon,title,desc])=>(
                    <div key={title} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontSize:18, flexShrink:0, lineHeight:1.3 }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                        <div className="small" style={{ opacity:0.6 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display:"grid", gap:10 }}>
                  {[
                    ["📸","Uploadez le document","Recto de la CNI ou passeport."],
                    ["🤖","Extraction automatique","L'IA extrait le nom, prénom, date de naissance."],
                    ["✏️","Vérifiez les données","Corrigez si l'OCR a fait des erreurs."],
                    ["🔍","Screening lancé","Analyse complète sur les données extraites."],
                  ].map(([icon,title,desc])=>(
                    <div key={title} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                        <div className="small" style={{ opacity:0.6 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sources */}
          <div className="chart-card">
            <div className="chart-title" style={{ marginBottom:12 }}>Sources de données</div>
            {[
              { icon:"⚖️", label:"Sanctions OFAC",      color:"#E84040" },
              { icon:"🏛️", label:"Nations Unies (ONU)",  color:"#2D7FD6" },
              { icon:"🇪🇺", label:"EU Sanctions List",   color:"#2D7FD6" },
              { icon:"👤", label:"PEP (Politiquement Exposés)", color:"#A78BFA" },
              { icon:"📰", label:"Adverse Media",        color:"#F5920A" },
            ].map((s,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",
                borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:16 }}>{s.icon}</span>
                <span className="small" style={{ flex:1 }}>{s.label}</span>
                <span style={{ width:8,height:8,borderRadius:4,background:"#2ECC8F",
                  boxShadow:"0 0 6px #2ECC8F44" }}/>
              </div>
            ))}
          </div>

          {/* Recent */}
          <div className="chart-card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div className="chart-title">Accès rapide</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Link to="/screenings" className="btn secondary" style={{ justifyContent:"center" }}>
                📋 Historique des screenings
              </Link>
              <Link to="/cases"      className="btn secondary" style={{ justifyContent:"center" }}>
                📁 Case Management
              </Link>
              <Link to="/watchlists" className="btn secondary" style={{ justifyContent:"center" }}>
                📡 Rechercher dans les watchlists
              </Link>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}