// src/pages/Watchlists.tsx
// Watchlist management with entity search (using /admin/entities/search)
import { useEffect, useState, useMemo } from "react";
import api from "../api";

interface EntityHit {
  entity_id:   string;
  entity_type: string;
  primary_name:string;
  risk_level:  string;
  best_norm:   string;
  similarity:  number;
  source_count:number;
  names_count: number;
}

interface EntityDetail {
  id:           string;
  entity_type:  string;
  primary_name: string;
  risk_level:   string;
  country_focus?: string;
  names: { id:number; name_raw:string; is_primary:boolean; name_type:string }[];
  sources: {
    id:string; source_id:number; record_type:string;
    program?:string; listed_on?:string; unlisted_on?:string;
    summary?:string; evidence_urls?:string[];
  }[];
}

function RiskBadge({risk}:{risk:string}) {
  const v = String(risk||"").toUpperCase();
  if(v==="HIGH")   return <span className="risk-badge high">High Risk</span>;
  if(v==="MEDIUM") return <span className="risk-badge medium">Medium Risk</span>;
  if(v==="LOW")    return <span className="risk-badge low">Low Risk</span>;
  return <span className="badge">{risk||"—"}</span>;
}

function RecordTypeBadge({type}:{type:string}) {
  const colors: Record<string,string> = {
    SANCTION:"#E84040",PEP:"#A78BFA",ADVERSE_MEDIA:"#F5920A",BAN:"#E84040",
  };
  const color = colors[type]||"#94A3B8";
  return (
    <span className="badge" style={{color,background:`${color}18`,borderColor:`${color}40`}}>
      {type.replace("_"," ")}
    </span>
  );
}

export default function Watchlists() {
  const [query,      setQuery]      = useState("");
  const [entityType, setEntityType] = useState("");
  const [riskLevel,  setRiskLevel]  = useState("");
  const [results,    setResults]    = useState<EntityHit[]>([]);
  const [total,      setTotal]      = useState(0);
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState<string|null>(null);
  const [selected,   setSelected]   = useState<EntityDetail|null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [hasSearched,setHasSearched]= useState(false);
  const [offset,     setOffset]     = useState(0);
  const PAGE = 20;

  async function search(off=0) {
    if (query.trim().length < 2) { setErr("Minimum 2 caractères."); return; }
    setBusy(true); setErr(null); setHasSearched(true);
    try {
      const params: Record<string,any> = { q:query.trim(), limit:PAGE, offset:off };
      if(entityType) params.entity_type = entityType;
      if(riskLevel)  params.risk_level  = riskLevel;
      const { data } = await api.get("/admin/entities/search", { params });
      setResults(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setOffset(off);
    } catch(e:any) {
      setErr(e?.response?.data?.detail||e?.message||"Erreur recherche");
      setResults([]);
    } finally { setBusy(false); }
  }

  async function loadDetail(entityId: string) {
    setDetailBusy(true);
    try {
      const { data } = await api.get(`/admin/entities/by-id/${entityId}`);
      setSelected(data);
    } catch(e:any) {
      setErr(e?.response?.data?.detail||e?.message||"Erreur détail");
    } finally { setDetailBusy(false); }
  }

  // Summary stats
  const riskCounts = useMemo(()=>({
    high:   results.filter(r=>r.risk_level==="HIGH").length,
    medium: results.filter(r=>r.risk_level==="MEDIUM").length,
    low:    results.filter(r=>r.risk_level==="LOW").length,
  }),[results]);

  const SOURCE_LABELS: Record<number,string> = { 1:"UN",2:"OFAC",3:"EU" };

  return (
    <>
      <div className="page-header" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
        <div>
          <div className="page-kicker">Surveillance</div>
          <div className="page-title">Watchlists</div>
          <div className="page-subtitle">Recherche dans la base d'entités sanctionnées, PEP et médias défavorables</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="filters-bar" style={{marginBottom:16}}>
        <div className="row" style={{gap:10,flexWrap:"wrap"}}>
          <input className="input" style={{flex:1,minWidth:240}}
            placeholder="Rechercher une entité, personne ou organisation…"
            value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&search(0)} />
          <select className="select" style={{width:"auto",padding:"8px 28px 8px 12px"}}
            value={entityType} onChange={e=>setEntityType(e.target.value)}>
            <option value="">Tous types</option>
            <option value="person">Personne</option>
            <option value="company">Entreprise</option>
          </select>
          <select className="select" style={{width:"auto",padding:"8px 28px 8px 12px"}}
            value={riskLevel} onChange={e=>setRiskLevel(e.target.value)}>
            <option value="">Tous risques</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>
          <button className="btn" onClick={()=>search(0)} disabled={busy||query.trim().length<2}>
            {busy?"Recherche…":"🔍 Rechercher"}
          </button>
          {hasSearched && (
            <button className="btn secondary" onClick={()=>{setQuery("");setResults([]);setHasSearched(false);setSelected(null);}}>
              Effacer
            </button>
          )}
        </div>
        {err && <div className="toast danger" style={{marginTop:10}}>❌ {err}</div>}
      </div>

      {!hasSearched ? (
        /* Landing state */
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
          {[
            { icon:"⚖️",title:"Sanctions",sub:"OFAC, Nations Unies, Union Européenne",color:"#E84040",bg:"rgba(232,64,64,0.1)" },
            { icon:"🏛️",title:"PEP",      sub:"Personnes Politiquement Exposées",     color:"#A78BFA",bg:"rgba(167,139,250,0.1)" },
            { icon:"📰",title:"Adverse Media",sub:"Couverture médiatique négative",    color:"#F5920A",bg:"rgba(245,146,10,0.1)" },
          ].map((card,i)=>(
            <div key={i} className="chart-card" style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{width:40,height:40,borderRadius:10,background:card.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {card.icon}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>{card.title}</div>
                <div className="small" style={{marginTop:3}}>{card.sub}</div>
              </div>
            </div>
          ))}
          <div className="screen" style={{gridColumn:"1/-1"}}>
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-title">Recherchez dans la base d'entités</div>
              <div className="empty-state-sub">Saisissez un nom (min. 2 caractères) pour rechercher dans les listes de sanctions, PEP et adverse media.</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:selected?"1fr 380px":"1fr",gap:16,alignItems:"start"}}>
          {/* Results */}
          <div>
            {/* Stats */}
            {results.length > 0 && (
              <div className="stat-pills" style={{marginBottom:14}}>
                <div className="stat-pill all"><span className="pill-count">{total}</span><span className="pill-label">Total</span></div>
                <div className="stat-pill high"><span className="pill-count">{riskCounts.high}</span><span className="pill-label">High Risk</span></div>
                <div className="stat-pill medium"><span className="pill-count">{riskCounts.medium}</span><span className="pill-label">Medium Risk</span></div>
                <div className="stat-pill low"><span className="pill-count">{riskCounts.low}</span><span className="pill-label">Low Risk</span></div>
              </div>
            )}

            <div className="screen" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span className="h2" style={{margin:0}}>
                  {busy?"Recherche…":`${total} résultat${total!==1?"s":""} pour « ${query} »`}
                </span>
                <div className="row" style={{gap:8}}>
                  <button className="pagination-btn" disabled={offset<=0||busy} onClick={()=>search(offset-PAGE)}>‹</button>
                  <span className="small" style={{color:"var(--text-muted)"}}>
                    {offset+1}–{Math.min(offset+PAGE,total)} / {total}
                  </span>
                  <button className="pagination-btn" disabled={offset+PAGE>=total||busy} onClick={()=>search(offset+PAGE)}>›</button>
                </div>
              </div>

              {results.length===0&&!busy ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">Aucun résultat</div>
                  <div className="empty-state-sub">Essayez un autre terme ou modifiez les filtres.</div>
                </div>
              ) : (
                <div style={{overflowX:"auto"}}>
                  <table className="cases-table" style={{width:"100%"}}>
                    <thead>
                      <tr>
                        <th>Entité</th>
                        <th>Type</th>
                        <th>Risk Level</th>
                        <th style={{textAlign:"right"}}>Sources</th>
                        <th style={{textAlign:"right"}}>Noms</th>
                        <th style={{textAlign:"right",width:80}}>Score</th>
                        <th style={{width:90}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r=>(
                        <tr key={r.entity_id} className={selected?.id===r.entity_id?"selected":""}>
                          <td>
                            <div style={{fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{r.primary_name}</div>
                            {r.best_norm!==r.primary_name.toLowerCase() && (
                              <div className="small" style={{opacity:0.5,marginTop:1}}>Correspondance : {r.best_norm}</div>
                            )}
                          </td>
                          <td className="small" style={{color:"var(--text-secondary)",textTransform:"capitalize"}}>{r.entity_type}</td>
                          <td><RiskBadge risk={r.risk_level}/></td>
                          <td style={{textAlign:"right",fontWeight:700,color:"var(--text-accent)"}}>{r.source_count}</td>
                          <td style={{textAlign:"right",color:"var(--text-muted)"}}>{r.names_count}</td>
                          <td style={{textAlign:"right"}}>
                            <span style={{fontWeight:700,color:r.similarity>=0.8?"#E84040":r.similarity>=0.6?"#F5920A":"var(--text-muted)",fontSize:13}}>
                              {Math.round(r.similarity*100)}%
                            </span>
                          </td>
                          <td>
                            <button className="btn secondary sm" onClick={()=>loadDetail(r.entity_id)} disabled={detailBusy}>
                              Détails
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="screen" style={{position:"sticky",top:"calc(var(--topnav-height) + 16px)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div className="h2" style={{margin:0}}>{selected.primary_name}</div>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                    <RiskBadge risk={selected.risk_level}/>
                    <span className="badge" style={{textTransform:"capitalize"}}>{selected.entity_type}</span>
                    {selected.country_focus && <span className="badge">🌍 {selected.country_focus}</span>}
                  </div>
                </div>
                <button className="icon-btn" onClick={()=>setSelected(null)}>✕</button>
              </div>

              {/* Sources */}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"var(--text-primary)"}}>
                  Sources ({selected.sources.length})
                </div>
                <div style={{display:"grid",gap:8}}>
                  {selected.sources.slice(0,5).map((s,i)=>(
                    <div key={i} style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",borderRadius:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <RecordTypeBadge type={s.record_type}/>
                          <span className="badge">{SOURCE_LABELS[s.source_id]||`Source ${s.source_id}`}</span>
                        </div>
                        {s.listed_on && <span className="small" style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{s.listed_on}</span>}
                      </div>
                      {s.program && <div className="small" style={{marginTop:5}}><b>Programme :</b> {s.program}</div>}
                      {s.summary && <div className="small" style={{marginTop:4,opacity:0.85}}>{s.summary.slice(0,150)}{s.summary.length>150?"…":""}</div>}
                      {Array.isArray(s.evidence_urls)&&s.evidence_urls.slice(0,2).map((u,j)=>(
                        <a key={j} href={u} target="_blank" rel="noreferrer"
                          className="small" style={{color:"var(--text-accent)",display:"block",marginTop:3,wordBreak:"break-all"}}>
                          🔗 {u.slice(0,60)}{u.length>60?"…":""}
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Aliases */}
              {selected.names.length > 1 && (
                <div>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"var(--text-primary)"}}>
                    Alias ({selected.names.length})
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {selected.names.slice(0,12).map((n,i)=>(
                      <span key={i} className="badge" style={{fontSize:11}}>
                        {n.is_primary&&"★ "}{n.name_raw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}