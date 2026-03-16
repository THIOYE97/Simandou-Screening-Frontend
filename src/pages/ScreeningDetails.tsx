// src/pages/ScreeningDetails.tsx — Redesigned professional UI
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadScreeningExportPdf, getScreeningDetails, setScreeningDecision } from "../api";

type AnyObj = Record<string, any>;
type Tab = "overview" | "details" | "entities" | "audit";

// ─── Helpers ──────────────────────────────────────────────────────
function fmtDate(s: unknown): string {
  if (!s) return "—";
  try { return new Date(String(s)).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return String(s); }
}
function fmtDateTime(s: unknown): string {
  if (!s) return "—";
  try { return new Date(String(s)).toLocaleString("fr-FR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return String(s); }
}
function toPct(n: unknown): string | null {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `${Math.round(x <= 1 ? x * 100 : x)}%`;
}
function safeStr(x: unknown): string { return x == null ? "" : String(x).trim(); }
function initials(name: string): string {
  return (name||"?").split(" ").filter(Boolean).map(n=>n[0]).join("").toUpperCase().slice(0,2);
}
function splitName(full: unknown) {
  const s = safeStr(full);
  if (!s) return { firstName:"", lastName:"" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName:"", lastName:parts[0] };
  return { firstName:parts.slice(0,-1).join(" "), lastName:parts.slice(-1)[0] };
}

// ─── Risk/Status helpers ──────────────────────────────────────────
function riskColor(r: unknown) {
  const v = String(r||"").toUpperCase();
  if (v==="HIGH")   return { bg:"#E84040",  text:"white",   label:"High Risk" };
  if (v==="MEDIUM") return { bg:"#F5920A",  text:"white",   label:"Medium Risk" };
  if (v==="LOW")    return { bg:"#2ECC8F",  text:"white",   label:"Low Risk" };
  return { bg:"#475569", text:"white", label:String(r||"—") };
}
function actionStyle(a: unknown) {
  const v = String(a||"").toUpperCase();
  if (v==="PASS")          return { color:"#2ECC8F", label:"✓ APPROUVER" };
  if (v==="MANUAL_REVIEW") return { color:"#F5920A", label:"◆ REVUE MANUELLE" };
  if (v==="BLOCK")         return { color:"#E84040", label:"✗ BLOQUER" };
  return { color:"#94A3B8", label:String(a||"—") };
}
function statusStyle(s: unknown) {
  const v = String(s||"").toUpperCase();
  if (["DONE","APPROVED"].includes(v))      return { bg:"#2ECC8F", label:"Terminé" };
  if (["RUNNING","PENDING"].includes(v))    return { bg:"#F5920A", label:"Pending" };
  if (["FAILED","ERROR"].includes(v))       return { bg:"#E84040", label:"Échec" };
  return { bg:"#475569", label:String(s||"—") };
}

// ─── Data pickers ─────────────────────────────────────────────────
function pickIdentity(data: AnyObj | null) {
  const req     = data?.request ?? {};
  const payload = req.request_payload ?? {};
  const docs: AnyObj[] = Array.isArray(payload.documents) ? payload.documents : [];
  const docFields = docs.find(d=>d.extracted_fields)?.extracted_fields ?? {};
  const ocrFields = payload.document_fields ?? payload.extracted_fields ?? docFields ?? {};
  const split = splitName(req.client_name ?? payload.name ?? payload.full_name ?? "");
  return {
    lastName:    safeStr(split.lastName  || ocrFields.last_name  || payload.last_name  || ""),
    firstName:   safeStr(split.firstName || ocrFields.first_name || payload.first_name || ""),
    dob:         safeStr(ocrFields.date_of_birth ?? ocrFields.dob ?? payload.dob ?? ""),
    docNo:       safeStr(ocrFields.document_number ?? payload.document_number ?? ""),
    nationality: safeStr(payload.nationality ?? ""),
    country:     safeStr(payload.country ?? ""),
  };
}
function getDisplayName(data: AnyObj | null): string {
  const req     = data?.request ?? {};
  const payload = req.request_payload ?? {};
  if (payload?.override_name) return String(payload.override_name).trim();
  const id = pickIdentity(data);
  const full = [id.firstName, id.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  return payload?.company_name ?? payload?.name ?? req.client_id ?? "—";
}
function deriveCategory(matches: AnyObj[], result: AnyObj | null): string {
  const action = String(result?.recommended_action || "").toUpperCase();
  if (action === "BLOCK") return "Sanctions List";
  if ((matches || []).some(m => String(m.match_band||"").toUpperCase()==="STRONG")) return "Politically Exposed Person (PEP)";
  if ((matches || []).length > 0) return "Watchlist";
  return "AML Screening";
}
function pickDocuments(data: AnyObj | null) {
  const payload = data?.request?.request_payload ?? {};
  const rawDocs: AnyObj[] = Array.isArray(payload.documents) ? payload.documents : [];
  return rawDocs.map(d => ({
    id:               d.id ?? d.document_id,
    original_filename:d.original_filename ?? d.filename,
    mime:             d.mime ?? d.mime_type,
    preview_url:      d.preview_url  ?? d.previewUrl,
    download_url:     d.download_url ?? d.downloadUrl,
    ocr_status:       d.ocr_status   ?? d.ocrStatus,
    ocr_confidence:   typeof (d.ocr_confidence ?? d.ocrConfidence) === "number" ? Number(d.ocr_confidence ?? d.ocrConfidence) : null,
    doc_type:         d.doc_type ?? d.docType,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────

// Status dropdown (inline)
function CaseStatusSelect({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const [cur,  setCur]  = useState(value);
  const cfg = statusStyle(cur);
  const opts = ["PENDING","IN_PROGRESS","DONE"];
  const labels: Record<string,string> = { PENDING:"Pending", IN_PROGRESS:"In Progress", DONE:"Terminé" };

  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,
          background:cfg.bg,color:"white",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>
        {labels[cur]||cur} <span style={{fontSize:9,opacity:0.8}}>▾</span>
      </button>
      {open && (
        <>
          <div style={{position:"fixed",inset:0,zIndex:50}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:51,
            background:"var(--bg-card)",border:"1px solid var(--border-light)",
            borderRadius:10,padding:4,minWidth:140,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>
            {opts.map(o=>{
              const c=statusStyle(o);
              return (
                <button key={o} onClick={()=>{setCur(o);setOpen(false);}}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 12px",
                    borderRadius:7,border:"none",background:cur===o?`${c.bg}22`:"transparent",
                    color:cur===o?c.bg:"var(--text-secondary)",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left"}}>
                  <span style={{width:8,height:8,borderRadius:4,background:c.bg,flexShrink:0}}/>
                  {labels[o]||o}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Match card
function MatchCard({ match, idx }: { match: AnyObj; idx: number }) {
  const [exp, setExp] = useState(false);
  const name    = match.entity_name ?? match.name ?? "—";
  const score   = match.match_score ?? match.score ?? null;
  const band    = match.match_band_label ?? match.match_band ?? null;
  const sb      = match.source_block as any;
  const bullets = Array.isArray(match.sanction_explain?.bullets) ? match.sanction_explain.bullets : [];
  const matchBullets = Array.isArray(match.match_explain?.bullets) ? match.match_explain.bullets : [];
  const isConfirmed = score != null && Number(score) >= 85;
  const risk   = Number(score||0) >= 85 ? "HIGH" : Number(score||0) >= 70 ? "MEDIUM" : "LOW";
  const rc     = riskColor(risk);
  const srcCount = sb?.links?.length || 1;

  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", marginBottom:10,
      background: isConfirmed ? "rgba(232,64,64,0.04)" : "rgba(255,255,255,0.02)" }}>
      {/* Match header */}
      <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
        onClick={()=>setExp(v=>!v)}>
        {/* Avatar */}
        <div style={{ width:42,height:42,borderRadius:21,background:"rgba(255,255,255,0.08)",
          border:"2px solid var(--border-light)", display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:15,fontWeight:700,color:"var(--text-secondary)",flexShrink:0 }}>
          {initials(name)}
        </div>
        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:14, color:"var(--text-primary)" }}>{name}</span>
            {isConfirmed && (
              <span style={{ padding:"2px 8px",borderRadius:20,background:"rgba(46,204,143,0.15)",
                color:"#2ECC8F",border:"1px solid rgba(46,204,143,0.3)",fontSize:10,fontWeight:700 }}>
                ✓ Confirmed Match
              </span>
            )}
          </div>
          <div className="small" style={{ opacity:0.55, marginTop:2 }}>
            {sb?.label ?? (band ? `Catégorie: ${band}` : "Source inconnue")}
            {sb?.program && ` · ${sb.program}`}
          </div>
        </div>
        {/* Right info */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
          <span style={{ padding:"4px 12px",borderRadius:20,background:rc.bg,color:rc.text,
            fontWeight:700,fontSize:12 }}>{rc.label}</span>
          <div className="small" style={{ opacity:0.5 }}>
            📄 {srcCount} Source{srcCount>1?"s":""}&nbsp;·&nbsp;{fmtDate(match.created_at)}
          </div>
          {sb?.record_type && (
            <div className="small" style={{ opacity:0.5 }}>🏷 {srcCount} Source{srcCount>1?"s":""}</div>
          )}
        </div>
        <span style={{ color:"var(--text-muted)", fontSize:11, marginLeft:6 }}>{exp?"▲":"▼"}</span>
      </div>

      {/* Expanded details */}
      {exp && (
        <div style={{ borderTop:"1px solid var(--border)", padding:"12px 16px",
          background:"rgba(0,0,0,0.15)", display:"grid", gap:10 }}>
          {/* Score */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div className="small" style={{ marginBottom:4, fontWeight:700 }}>Score de correspondance</div>
              <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
                <div style={{ height:"100%", borderRadius:3, width:`${score??0}%`,
                  background:rc.bg, transition:"width 0.4s ease" }} />
              </div>
            </div>
            <b style={{ fontSize:18, color:rc.bg }}>{score ?? "—"}%</b>
          </div>

          {/* Sanction motifs */}
          {bullets.length > 0 && (
            <div>
              <div className="small" style={{ fontWeight:700, marginBottom:4, color:"var(--text-muted)",
                letterSpacing:"0.05em", textTransform:"uppercase", fontSize:10 }}>Motifs</div>
              {bullets.slice(0,5).map((b:any,i:number)=>(
                <div key={i} style={{ display:"flex",gap:8,padding:"3px 0" }}>
                  <span style={{ color:"var(--risk-high)", fontSize:12, flexShrink:0 }}>•</span>
                  <span className="small">{String(b)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Source info */}
          {sb && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {sb.record_type  && <div className="small"><b>Type :</b> {sb.record_type}</div>}
              {sb.listed_on   && <div className="small"><b>Inscrit le :</b> {sb.listed_on}</div>}
              {sb.unlisted_on && <div className="small"><b>Retiré le :</b> {sb.unlisted_on}</div>}
              {sb.summary     && <div className="small" style={{ gridColumn:"1/-1" }}><b>Résumé :</b> {sb.summary}</div>}
            </div>
          )}

          {/* Tech match */}
          {matchBullets.length > 0 && (
            <details>
              <summary className="badge" style={{ cursor:"pointer", fontSize:11 }}>Pourquoi ce match (technique)</summary>
              <div style={{ marginTop:8, display:"grid", gap:4 }}>
                {matchBullets.slice(0,6).map((b:any,i:number)=>(
                  <div key={i} className="small" style={{ opacity:0.8 }}>• {String(b)}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function ScreeningDetails() {
  const { id } = useParams<{ id: string }>();
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState<string|null>(null);
  const [data,    setData]    = useState<AnyObj|null>(null);
  const [tab,     setTab]     = useState<Tab>("overview");
  const [comment, setComment] = useState("");
  const [decBusy, setDecBusy] = useState(false);
  const [decToast,setDecToast]= useState<string|null>(null);
  const [noteText,setNoteText]= useState("");
  const [notes,   setNotes]   = useState<{text:string;time:string;user:string}[]>([]);

  async function load() {
    if (!id) return;
    setBusy(true); setErr(null);
    try {
      const d = await getScreeningDetails(id);
      setData(d);
    } catch(e:any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? String(e));
    } finally { setBusy(false); }
  }

  useEffect(()=>{ load(); },[id]); // eslint-disable-line

  async function doDecision(decision: "PASS"|"BLOCK") {
    const c = comment.trim();
    if (c.length < 4) { setDecToast("❌ Commentaire obligatoire (min 4 car.)."); return; }
    if (!id) return;
    setDecBusy(true); setDecToast(null);
    try {
      await setScreeningDecision(id, decision, c);
      setComment("");
      setDecToast(`✅ Décision ${decision} enregistrée.`);
      await load();
    } catch(e:any) {
      setDecToast(`❌ ${e?.response?.data?.detail || e?.message || "Erreur"}`);
    } finally { setDecBusy(false); }
  }

  function addNote() {
    if (!noteText.trim()) return;
    setNotes(prev=>[...prev, { text:noteText.trim(), time:new Date().toLocaleString("fr-FR"), user:"Moi" }]);
    setNoteText("");
  }

  // Derived data
  const request       = data?.request ?? null;
  const result        = data?.result  ?? null;
  const matchesRaw: AnyObj[] = Array.isArray(data?.matches) ? data.matches : [];
  const decisionLatest= data?.decision_latest ?? null;
  const decisionHistory: AnyObj[] = Array.isArray(data?.decision_history) ? data.decision_history : [];

  const payload     = request?.request_payload ?? {};
  const displayName = useMemo(()=>getDisplayName(data),[data]);
  const identity    = useMemo(()=>pickIdentity(data),[data]);
  const docs        = useMemo(()=>pickDocuments(data),[data]);
  const category    = useMemo(()=>deriveCategory(matchesRaw, result),[matchesRaw, result]);
  const risk        = result?.risk_level ?? null;
  const rc          = riskColor(risk);
  const ac          = actionStyle(result?.recommended_action);
  const ss          = statusStyle(request?.status);
  const confidence  = result?.confidence ?? null;
  const createdAt   = request?.created_at ?? null;
  const caseId      = request?.case_id ?? payload?.case_id ?? null;

  // Sorted matches by score
  const sortedMatches = useMemo(()=>
    [...matchesRaw].sort((a,b)=>Number(b.match_score??0)-Number(a.match_score??0))
  ,[matchesRaw]);

  // Alerts overview stats
  const highRiskMatches = sortedMatches.filter(m=>Number(m.match_score??0)>=85).length;
  const assocEntities   = new Set(sortedMatches.map(m=>m.entity_id)).size;
  const pepMatches      = sortedMatches.filter(m=>String(m.match_band||"").toUpperCase()==="STRONG").length;

  const TABS: { id:Tab; label:string }[] = [
    { id:"overview", label:"Overview" },
    { id:"details",  label:"Details" },
    { id:"entities", label:"Related Entities" },
    { id:"audit",    label:"Audit Trail" },
  ];

  if (!data && !busy && !err) return (
    <div className="screen">
      <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">Chargement…</div></div>
    </div>
  );

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, fontSize:12, color:"var(--text-muted)" }}>
        <Link to="/screenings" style={{ color:"var(--text-muted)", textDecoration:"none" }}>Screening Results</Link>
        <span>›</span>
        <span style={{ color:"var(--text-primary)", fontWeight:600 }}>{displayName}</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button className="btn secondary sm" onClick={load} disabled={busy}>{busy?"…":"↻ Refresh"}</button>
          <button className="btn sm" onClick={()=>downloadScreeningExportPdf(String(request?.id??id))} disabled={!request?.id&&!id}>
            ⬇️ Export PDF
          </button>
        </div>
      </div>

      {err && <div className="toast danger" style={{marginBottom:14}}>❌ {err}</div>}

      {!data ? (
        <div className="screen">
          <div className="small" style={{textAlign:"center",padding:"40px 0",opacity:0.4}}>{busy?"Chargement…":"Aucune donnée."}</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, alignItems:"start" }}>

          {/* ── MAIN CONTENT ── */}
          <div>
            {/* Profile card */}
            <div className="screen" style={{ marginBottom:16 }}>
              <div style={{ display:"flex", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
                {/* Avatar */}
                <div style={{ width:80, height:80, borderRadius:40,
                  background:"linear-gradient(135deg,rgba(45,127,214,0.3),rgba(45,127,214,0.1))",
                  border:"2px solid var(--border-active)", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:28, fontWeight:800, color:"var(--text-accent)",
                  flexShrink:0, letterSpacing:-1 }}>
                  {initials(displayName)}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:4 }}>
                    <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"var(--text-primary)", letterSpacing:-0.5 }}>
                      {displayName}
                    </h1>
                    {payload?.nationality && <span style={{ fontSize:18 }}>🏳️</span>}
                    <span style={{ opacity:0.4, fontSize:16 }}>☆</span>
                  </div>
                  <div className="small" style={{ marginBottom:10, opacity:0.7 }}>{category}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {risk && (
                      <span style={{ padding:"5px 14px", borderRadius:20, background:rc.bg,
                        color:rc.text, fontWeight:700, fontSize:12 }}>
                        {rc.label}
                      </span>
                    )}
                    <button className="btn secondary sm">+ More…</button>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end", flexShrink:0 }}>
                  <button className="btn secondary sm" onClick={()=>doDecision("PASS")} disabled={decBusy} title="Marquer comme faux positif">
                    False Positive
                  </button>
                  <button className="btn secondary sm" title="Rejeter la correspondance">Dismiss Match</button>
                  <button className="btn secondary sm">Create Case</button>
                  <button className="btn sm">Assign ▾</button>
                </div>
              </div>

              {decToast && (
                <div className={`toast ${decToast.startsWith("✅")?"ok":"danger"}`} style={{marginTop:12}}>
                  {decToast}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:16 }}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{ padding:"10px 18px", background:"none", border:"none",
                    borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,
                    color:tab===t.id?"var(--text-accent)":"var(--text-muted)",
                    fontWeight:tab===t.id?700:500, fontSize:13.5, cursor:"pointer",
                    transition:"all 0.15s", marginBottom:-1 }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {tab==="overview" && (
              <div>
                {/* Possible Matches */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>Possible Matches</h2>
                    <span className={`badge ${sortedMatches.length===0?"badge-ok":"badge-warn"}`}>
                      {sortedMatches.length===0?"Aucune correspondance":`${sortedMatches.length} résultat(s)`}
                    </span>
                  </div>
                  {sortedMatches.length===0 ? (
                    <div className="screen">
                      <div className="empty-state" style={{padding:"24px 0"}}>
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">Aucune correspondance</div>
                        <div className="empty-state-sub">Aucune entité sanctionnée trouvée.</div>
                      </div>
                    </div>
                  ) : sortedMatches.map((m,i)=>(
                    <MatchCard key={i} match={m} idx={i}/>
                  ))}
                </div>

                {/* Risk Profile */}
                {sortedMatches.length > 0 && (
                  <div className="screen" style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>Risk Profile</h2>
                      <button style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:18 }}>▼</button>
                    </div>
                    <div style={{ display:"grid", gap:10 }}>
                      {sortedMatches.slice(0,3).map((m,i)=>{
                        const name  = m.entity_name ?? m.name ?? "—";
                        const score = m.match_score ?? 0;
                        const risk2 = score>=85?"HIGH":score>=70?"MEDIUM":"LOW";
                        const rc2   = riskColor(risk2);
                        const sb    = m.source_block as any;
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                            padding:"10px 14px", background:"rgba(255,255,255,0.03)",
                            border:"1px solid var(--border)", borderRadius:12 }}>
                            <div style={{ width:36,height:36,borderRadius:18,background:`${rc2.bg}22`,
                              border:`1px solid ${rc2.bg}44`,display:"flex",alignItems:"center",
                              justifyContent:"center",fontSize:13,fontWeight:700,color:rc2.bg,flexShrink:0 }}>
                              {initials(name)}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:13, color:"var(--text-primary)" }}>{name}</div>
                              <div className="small" style={{ opacity:0.55, marginTop:1 }}>
                                {sb?.label ?? "Source"} &nbsp;·&nbsp; Matchs: {score}% · {fmtDate(m.created_at)}
                              </div>
                              {sb?.program && (
                                <div className="small" style={{ marginTop:2 }}>
                                  <span style={{ padding:"1px 7px", borderRadius:20, background:"rgba(45,127,214,0.12)",
                                    color:"var(--text-accent)", fontSize:10, fontWeight:600 }}>
                                    {sb.program}
                                  </span>
                                </div>
                              )}
                            </div>
                            <span style={{ padding:"4px 10px", borderRadius:20, background:rc2.bg,
                              color:rc2.text, fontWeight:700, fontSize:11, flexShrink:0 }}>
                              {rc2.label}
                            </span>
                            {payload?.nationality && <span style={{ fontSize:16, flexShrink:0 }}>🏳️</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                {(identity.dob || identity.docNo || identity.nationality) && (
                  <div className="screen" style={{ marginBottom:20 }}>
                    <h2 style={{ margin:"0 0 12px", fontSize:16, fontWeight:700 }}>Additional Details</h2>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      {identity.dob        && <div><div className="profile-label">Date de naissance</div><div className="profile-value">{identity.dob}</div></div>}
                      {identity.docNo      && <div><div className="profile-label">N° Document</div><div className="profile-value">{identity.docNo}</div></div>}
                      {identity.nationality&& <div><div className="profile-label">Nationalité</div><div className="profile-value">{identity.nationality}</div></div>}
                      {identity.country    && <div><div className="profile-label">Pays</div><div className="profile-value">{identity.country}</div></div>}
                    </div>
                  </div>
                )}

                {/* Comments / Decision */}
                <div className="screen">
                  <h2 style={{ margin:"0 0 12px", fontSize:16, fontWeight:700 }}>Comments & Decision</h2>

                  {/* Decision history */}
                  {decisionHistory.length > 0 && (
                    <div style={{ marginBottom:14, display:"grid", gap:8 }}>
                      {decisionHistory.slice(0,3).map((d,i)=>(
                        <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start",
                          padding:"10px 14px", background:"rgba(255,255,255,0.03)",
                          border:"1px solid var(--border)", borderRadius:10 }}>
                          <div style={{ width:32,height:32,borderRadius:16,background:"var(--accent)",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:12,fontWeight:700,color:"white",flexShrink:0 }}>
                            {(d.decided_by_email||"A")[0].toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                              <span style={{ fontWeight:600, fontSize:13 }}>{d.decided_by_email||"Analyst"}</span>
                              <span className="badge" style={{ fontSize:10 }}>{fmtDateTime(d.decided_at)}</span>
                              <span className={`badge ${d.decision==="PASS"?"badge-ok":"badge-bad"}`}>
                                {d.decision==="PASS"?"✅ PASS":"⛔ BLOCK"}
                              </span>
                            </div>
                            <div className="small">{d.comment || "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Decision input */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)", borderRadius:12, padding:12 }}>
                    <div className="small" style={{ marginBottom:8, fontWeight:600, opacity:0.7 }}>
                      PASS ou BLOCK — commentaire obligatoire (min 4 caractères)
                    </div>
                    <textarea value={comment} onChange={e=>setComment(e.target.value)}
                      placeholder="Justification de la décision…"
                      style={{ width:"100%", marginBottom:10, minHeight:70, resize:"vertical" }} />
                    <div className="row" style={{ gap:8 }}>
                      <button className="btn" style={{ background:"#2ECC8F", borderColor:"#2ECC8F" }}
                        disabled={decBusy||comment.trim().length<4} onClick={()=>doDecision("PASS")}>
                        ✅ PASS
                      </button>
                      <button className="btn danger" disabled={decBusy||comment.trim().length<4}
                        onClick={()=>doDecision("BLOCK")}>⛔ BLOCK</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DETAILS TAB ── */}
            {tab==="details" && (
              <div className="screen">
                <h2 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Informations du dossier</h2>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  {[
                    ["Request ID",  String(request?.id||"—")],
                    ["Statut",      String(request?.status||"—")],
                    ["Provider",    String(request?.provider||"INTERNAL")],
                    ["Case ID",     caseId||"—"],
                    ["Créé le",     fmtDateTime(createdAt)],
                    ["Terminé le",  fmtDateTime(request?.completed_at)],
                    ["Risque",      risk||"—"],
                    ["Confiance",   confidence!=null?`${confidence}%`:"—"],
                    ["Action",      String(result?.recommended_action||"—")],
                    ["Nom",         displayName],
                    ["Prénoms",     identity.firstName||"—"],
                    ["DOB",         identity.dob||"—"],
                    ["N° Doc",      identity.docNo||"—"],
                    ["Nationalité", identity.nationality||"—"],
                  ].map(([label,value])=>(
                    <div key={label} style={{ padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                      <div className="profile-label">{label}</div>
                      <div className="profile-value" style={{ fontFamily:label==="Request ID"||label==="Case ID"?"monospace":"inherit", fontSize:label==="Request ID"?11:undefined }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Documents */}
                {docs.length > 0 && (
                  <div style={{ marginTop:20 }}>
                    <h2 style={{ margin:"0 0 12px", fontSize:15, fontWeight:700 }}>Documents soumis</h2>
                    {docs.map((d,i)=>(
                      <div key={i} style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)",
                        border:"1px solid var(--border)", borderRadius:10, marginBottom:8,
                        display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:20 }}>📄</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13 }}>{d.original_filename||`Document ${i+1}`}</div>
                          <div className="small" style={{ opacity:0.5 }}>
                            {d.doc_type} {d.ocr_status&&`· OCR: ${d.ocr_status}`}
                            {d.ocr_confidence!=null&&` · Conf: ${Math.round(d.ocr_confidence*100)}%`}
                          </div>
                        </div>
                        {d.download_url && <a className="btn secondary sm" href={d.download_url} target="_blank" rel="noreferrer">⬇️</a>}
                        {d.preview_url  && <a className="btn secondary sm" href={d.preview_url}  target="_blank" rel="noreferrer">👁️</a>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Debug */}
                <details style={{ marginTop:16 }}>
                  <summary className="badge" style={{ cursor:"pointer" }}>🔧 Debug (raw data)</summary>
                  <textarea readOnly style={{ marginTop:8, minHeight:200, fontFamily:"monospace", fontSize:11 }}
                    value={JSON.stringify(data, null, 2)} />
                </details>
              </div>
            )}

            {/* ── RELATED ENTITIES TAB ── */}
            {tab==="entities" && (
              <div className="screen">
                <h2 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>
                  Entités liées ({sortedMatches.length})
                </h2>
                {sortedMatches.length===0 ? (
                  <div className="empty-state"><div className="empty-state-title">Aucune entité liée.</div></div>
                ) : sortedMatches.map((m,i)=>{
                  const name  = m.entity_name ?? m.name ?? "—";
                  const score = m.match_score ?? 0;
                  const risk2 = score>=85?"HIGH":score>=70?"MEDIUM":"LOW";
                  const rc2   = riskColor(risk2);
                  const sb    = m.source_block as any;
                  return (
                    <div key={i} style={{ marginBottom:10, padding:"12px 16px",
                      background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)", borderRadius:12 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                        <div style={{ width:40,height:40,borderRadius:20,background:`${rc2.bg}22`,
                          border:`1.5px solid ${rc2.bg}55`,display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:14,fontWeight:700,color:rc2.bg }}>
                          {initials(name)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:13 }}>{name}</div>
                          <div className="small" style={{ opacity:0.5 }}>{sb?.label||"Source"} · {sb?.record_type||"—"}</div>
                        </div>
                        <span style={{ padding:"3px 10px",borderRadius:20,background:rc2.bg,color:"white",fontSize:11,fontWeight:700 }}>{rc2.label}</span>
                      </div>
                      {sb?.links && Array.isArray(sb.links) && sb.links.slice(0,2).map((url:string,j:number)=>(
                        <a key={j} href={url} target="_blank" rel="noreferrer"
                          className="small" style={{ display:"block",marginTop:4,color:"var(--text-accent)" }}>
                          🔗 {url.slice(0,70)}{url.length>70?"…":""}
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── AUDIT TRAIL TAB ── */}
            {tab==="audit" && (
              <div className="screen">
                <h2 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Audit Trail</h2>
                <div style={{ position:"relative", paddingLeft:24 }}>
                  {/* Timeline line */}
                  <div style={{ position:"absolute", left:7, top:0, bottom:0, width:2,
                    background:"var(--border)", borderRadius:2 }} />
                  {[
                    { icon:"🔍", title:"Screening lancé",   time:fmtDateTime(createdAt), detail:`Provider: ${request?.provider||"INTERNAL"}` },
                    { icon:"⚙️", title:"Analyse en cours",  time:fmtDateTime(createdAt), detail:"Moteur de matching actif" },
                    ...(matchesRaw.length>0?[{ icon:"⚠️", title:`${matchesRaw.length} correspondance(s) trouvée(s)`, time:fmtDateTime(request?.completed_at||createdAt), detail:`Risk: ${risk||"—"}` }]:[]),
                    ...(request?.completed_at?[{ icon:"✅", title:"Screening terminé", time:fmtDateTime(request.completed_at), detail:`Statut: ${request.status||"DONE"}` }]:[]),
                    ...decisionHistory.map(d=>({ icon:d.decision==="PASS"?"✅":"⛔",
                      title:`Décision: ${d.decision}`, time:fmtDateTime(d.decided_at),
                      detail:`Par ${d.decided_by_email||"analyst"} — ${d.comment||""}` })),
                  ].map((ev,i)=>(
                    <div key={i} style={{ display:"flex", gap:16, marginBottom:16, position:"relative" }}>
                      <div style={{ width:16,height:16,borderRadius:8,background:"var(--bg-card)",
                        border:"2px solid var(--accent)",display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:10,flexShrink:0,marginTop:2,zIndex:1 }}>
                        {ev.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:"var(--text-primary)" }}>{ev.title}</div>
                        <div className="small" style={{ opacity:0.55, marginTop:2 }}>{ev.time}</div>
                        {ev.detail && <div className="small" style={{ marginTop:3, opacity:0.8 }}>{ev.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:14, position:"sticky", top:"calc(var(--topnav-height) + 16px)" }}>

            {/* Case Status */}
            <div className="chart-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div className="chart-title">Case Status</div>
                <CaseStatusSelect value={request?.status||"PENDING"} />
              </div>
              {caseId && (
                <div className="small" style={{ marginBottom:4 }}>
                  Case # <b style={{ fontFamily:"monospace", fontSize:10 }}>
                    {String(caseId).slice(0,8).toUpperCase()}-KYC
                  </b>
                </div>
              )}
              <div className="small" style={{ opacity:0.6, marginBottom:8 }}>
                Assigned: <b>Mode Testeur</b><br/>
                Last Updated: {fmtDateTime(createdAt)}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {decisionLatest ? (
                  <span className={`badge ${decisionLatest.decision==="PASS"?"badge-ok":"badge-bad"}`}>
                    {decisionLatest.decision==="PASS"?"✅ PASS":"⛔ BLOCK"}
                  </span>
                ) : (
                  <span className="badge badge-warn">⏳ En attente</span>
                )}
                {risk && (
                  <span style={{ padding:"3px 10px",borderRadius:20,background:rc.bg,color:rc.text,fontSize:11,fontWeight:700 }}>
                    {rc.label}
                  </span>
                )}
              </div>
              {confidence != null && (
                <div style={{ marginTop:10 }}>
                  <div className="small" style={{ marginBottom:4, opacity:0.6 }}>Confiance : {confidence}%</div>
                  <div style={{ height:5, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
                    <div style={{ height:"100%", borderRadius:3, width:`${Math.min(Number(confidence),100)}%`,
                      background:Number(confidence)>=70?"#2ECC8F":"#F5920A" }} />
                  </div>
                </div>
              )}
              <div style={{ marginTop:12, display:"grid", gap:6 }}>
                <Link to={`/screenings/${id}`} className="btn secondary sm" style={{ justifyContent:"center", textAlign:"center" }}>
                  Voir dans l'historique
                </Link>
                <button className="btn sm" onClick={()=>downloadScreeningExportPdf(String(request?.id??id))}
                  disabled={!request?.id&&!id} style={{ justifyContent:"center" }}>
                  ⬇️ Export PDF
                </button>
              </div>
            </div>

            {/* Alerts Overview */}
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom:12 }}>Alerts Overview</div>
              {[
                { label:"High Risk Alerts:", color:"#E84040", val:highRiskMatches },
                { label:"Associated Entities:", color:"#E84040", val:assocEntities },
                { label:"PEP Matches:", color:"#2ECC8F", val:pepMatches },
              ].map((row,i)=>(
                <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:10,height:10,borderRadius:2,background:row.color,flexShrink:0 }}/>
                    <span className="small" style={{ color:"var(--text-secondary)" }}>{row.label}</span>
                  </div>
                  <b style={{ color:row.color,fontSize:16 }}>{row.val}</b>
                </div>
              ))}
            </div>

            {/* Case Notes */}
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom:12 }}>Case Notes</div>
              <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                <input className="input" style={{ flex:1,fontSize:12,padding:"6px 10px" }}
                  placeholder="Add a note…" value={noteText}
                  onChange={e=>setNoteText(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addNote()} />
                <button className="btn sm" onClick={addNote} disabled={!noteText.trim()} style={{padding:"6px 12px"}}>+</button>
              </div>
              {notes.length===0 ? (
                <div className="small" style={{ opacity:0.4 }}>Aucune note. Ajoutez la première.</div>
              ) : notes.map((n,i)=>(
                <div key={i} style={{ padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:2 }}>
                    <b style={{ fontSize:12 }}>{n.user}</b>
                    <span className="small" style={{ opacity:0.5 }}>{n.time}</span>
                  </div>
                  <div className="small">{n.text}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </>
  );
}