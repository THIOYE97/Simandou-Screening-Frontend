// src/pages/Reports.tsx
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { listScreenings, listCases } from "../api";
import type { ScreeningListItem } from "../api";

function fmtDate(s?:string|null){
  if(!s)return"—";
  try{return new Date(s).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});}
  catch{return s;}
}

// Bar chart using SVG
function BarChart({data,color="#2D7FD6"}:{data:{label:string;value:number}[];color?:string}){
  if(!data.length) return null;
  const max = Math.max(...data.map(d=>d.value),1);
  const W=400,H=120,PAD=20,barW=Math.max(8,Math.floor((W-PAD*2)/data.length)-4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{overflow:"visible"}}>
      {data.map((d,i)=>{
        const h=Math.max(2,(d.value/max)*(H-PAD-16));
        const x=PAD+(i/data.length)*(W-PAD*2)+(W-PAD*2)/data.length/2-barW/2;
        const y=H-PAD-h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={color} opacity={0.85}/>
            <text x={x+barW/2} y={H-4} fontSize="9" fill="rgba(226,237,255,0.4)" textAnchor="middle">{d.label}</text>
            {d.value>0&&<text x={x+barW/2} y={y-3} fontSize="9" fill="rgba(226,237,255,0.6)" textAnchor="middle">{d.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Pie chart SVG
function PieChart({segments}:{segments:{label:string;value:number;color:string}[]}){
  const total=segments.reduce((s,x)=>s+x.value,0)||1;
  const R=50,CX=60,CY=60;
  let angle=-Math.PI/2;
  const arcs=segments.map(s=>{
    const start=angle;
    const sweep=(s.value/total)*2*Math.PI;
    angle+=sweep;
    return {...s,start,sweep};
  });
  return (
    <svg viewBox="0 0 120 120" width="120" height="120">
      {arcs.map((arc,i)=>{
        const x1=CX+R*Math.cos(arc.start);
        const y1=CY+R*Math.sin(arc.start);
        const x2=CX+R*Math.cos(arc.start+arc.sweep);
        const y2=CY+R*Math.sin(arc.start+arc.sweep);
        const large=arc.sweep>Math.PI?1:0;
        const d=`M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`;
        return <path key={i} d={d} fill={arc.color} opacity={0.9}/>;
      })}
    </svg>
  );
}

export default function Reports() {
  const [busy,       setBusy]       = useState(true);
  const [screenings, setScreenings] = useState<ScreeningListItem[]>([]);
  const [totalCases, setTotalCases] = useState(0);

  useEffect(()=>{
    Promise.allSettled([
      listScreenings({limit:200,offset:0}),
      listCases({}),
    ]).then(([sr,cr])=>{
      if(sr.status==="fulfilled") setScreenings(sr.value.items||[]);
      if(cr.status==="fulfilled") setTotalCases(cr.value.length||0);
    }).finally(()=>setBusy(false));
  },[]);

  // ── Computed stats ──────────────────────────────────────
  const stats = useMemo(()=>{
    const total   = screenings.length;
    const done    = screenings.filter(s=>["DONE","APPROVED"].includes(String(s.status||"").toUpperCase())).length;
    const running = screenings.filter(s=>["RUNNING","PENDING"].includes(String(s.status||"").toUpperCase())).length;
    const failed  = screenings.filter(s=>["FAILED","ERROR"].includes(String(s.status||"").toUpperCase())).length;
    const high    = screenings.filter(s=>String(s.risk_level||"").toUpperCase()==="HIGH").length;
    const medium  = screenings.filter(s=>String(s.risk_level||"").toUpperCase()==="MEDIUM").length;
    const low     = screenings.filter(s=>String(s.risk_level||"").toUpperCase()==="LOW").length;
    const withMatches = screenings.filter(s=>(s.matches_count||0)>0).length;
    const passRate    = done>0 ? Math.round((done/total)*100) : 0;
    const matchRate   = total>0 ? Math.round((withMatches/total)*100) : 0;
    return {total,done,running,failed,high,medium,low,withMatches,passRate,matchRate};
  },[screenings]);

  // By week (last 8 weeks)
  const weeklyData = useMemo(()=>{
    const WEEK=7*24*3600*1000;
    const now=Date.now();
    const buckets=Array.from({length:8},(_,i)=>({label:`S-${7-i}`,value:0}));
    for(const s of screenings){
      if(!s.created_at) continue;
      const age=Math.floor((now-new Date(s.created_at).getTime())/WEEK);
      if(age>=0&&age<8) buckets[7-age].value++;
    }
    return buckets;
  },[screenings]);

  // By risk
  const riskData = useMemo(()=>[
    {label:"High",   value:stats.high,   color:"#E84040"},
    {label:"Medium", value:stats.medium, color:"#F5920A"},
    {label:"Low",    value:stats.low,    color:"#2ECC8F"},
  ],[stats]);

  // Top clients (by screening count)
  const topClients = useMemo(()=>{
    const counts=new Map<string,{name:string;count:number;risk:string}>();
    for(const s of screenings){
      const name=s.client_name||[s.first_name,s.last_name].filter(Boolean).join(" ")||"—";
      if(name==="—") continue;
      const existing=counts.get(name);
      if(existing) existing.count++;
      else counts.set(name,{name,count:1,risk:s.risk_level||""});
    }
    return [...counts.values()].sort((a,b)=>b.count-a.count).slice(0,8);
  },[screenings]);

  // Recent high risk
  const recentHighRisk = useMemo(()=>
    screenings.filter(s=>String(s.risk_level||"").toUpperCase()==="HIGH").slice(0,5)
  ,[screenings]);

  if(busy) return (
    <>
      <div className="page-header"><div className="page-kicker">Analytics</div><div className="page-title">Reports</div></div>
      <div className="screen"><div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">Chargement…</div></div></div>
    </>
  );

  return (
    <>
      <div className="page-header" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
        <div>
          <div className="page-kicker">Analytics</div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Vue d'ensemble des activités de screening et de conformité</div>
        </div>
        <div className="row" style={{gap:10}}>
          <Link to="/screenings" className="btn secondary sm">Voir tous les screenings</Link>
          <Link to="/analyst"    className="btn sm">+ New Screening</Link>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
        {[
          {label:"Total Screenings", value:stats.total,      color:"#2D7FD6",  icon:"🔍"},
          {label:"Terminés",         value:stats.done,       color:"#2ECC8F",  icon:"✅"},
          {label:"High Risk",        value:stats.high,       color:"#E84040",  icon:"🚨"},
          {label:"Avec Matchs",      value:stats.withMatches,color:"#F5920A",  icon:"⚠️"},
          {label:"Cases Total",      value:totalCases,       color:"#A78BFA",  icon:"📁"},
        ].map((kpi,i)=>(
          <div key={i} className="chart-card" style={{textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:4}}>{kpi.icon}</div>
            <div style={{fontSize:28,fontWeight:800,color:kpi.color,lineHeight:1}}>{kpi.value}</div>
            <div className="small" style={{marginTop:4,color:"var(--text-secondary)"}}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 300px",gap:16,marginBottom:16}}>
        {/* Weekly activity */}
        <div className="chart-card">
          <div className="chart-header" style={{marginBottom:12}}>
            <div className="chart-title">Activité hebdomadaire</div>
            <span className="badge">{stats.total} total</span>
          </div>
          <BarChart data={weeklyData} color="#2D7FD6"/>
        </div>

        {/* Risk distribution bar */}
        <div className="chart-card">
          <div className="chart-header" style={{marginBottom:12}}>
            <div className="chart-title">Distribution des risques</div>
          </div>
          <BarChart data={riskData.map(d=>({label:d.label,value:d.value}))} color="#5BA8F5"/>
          <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
            {riskData.map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                <div style={{width:10,height:10,borderRadius:3,background:d.color}}/>
                <span style={{color:"var(--text-secondary)"}}>{d.label}</span>
                <b style={{color:d.color}}>{d.value}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Pie + rates */}
        <div className="chart-card">
          <div className="chart-title" style={{marginBottom:12}}>Taux de complétion</div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <PieChart segments={[
              {label:"Done",    value:stats.done,    color:"#2ECC8F"},
              {label:"Running", value:stats.running, color:"#F5920A"},
              {label:"Failed",  value:stats.failed,  color:"#E84040"},
            ]}/>
            <div style={{display:"grid",gap:8}}>
              {[
                {label:"Terminés",  value:stats.done,    color:"#2ECC8F"},
                {label:"En cours",  value:stats.running, color:"#F5920A"},
                {label:"Échoués",   value:stats.failed,  color:"#E84040"},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:8,height:8,borderRadius:3,background:s.color,flexShrink:0}}/>
                  <span className="small" style={{color:"var(--text-secondary)"}}>{s.label}</span>
                  <b style={{color:s.color,fontSize:14,marginLeft:"auto"}}>{s.value}</b>
                </div>
              ))}
            </div>
          </div>
          <div style={{marginTop:10,display:"grid",gap:6}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:"var(--text-muted)"}}>Taux succès</span>
              <b style={{color:"#2ECC8F"}}>{stats.passRate}%</b>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:"var(--text-muted)"}}>Taux matchs</span>
              <b style={{color:"#F5920A"}}>{stats.matchRate}%</b>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Top clients */}
        <div className="screen">
          <div className="h2" style={{marginBottom:12}}>Top clients screenés</div>
          {topClients.length===0 ? (
            <div className="small" style={{opacity:0.5}}>Aucune donnée.</div>
          ) : (
            <table className="cases-table" style={{width:"100%"}}>
              <thead><tr><th>Client</th><th style={{textAlign:"right"}}>Screenings</th><th>Dernier risque</th></tr></thead>
              <tbody>
                {topClients.map((c,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:600,fontSize:13}}>{c.name}</td>
                    <td style={{textAlign:"right",fontWeight:700,color:"var(--text-accent)"}}>{c.count}</td>
                    <td>
                      {c.risk==="HIGH"?<span className="risk-badge high">High</span>:
                       c.risk==="MEDIUM"?<span className="risk-badge medium">Medium</span>:
                       c.risk==="LOW"?<span className="risk-badge low">Low</span>:
                       <span className="badge" style={{opacity:0.4}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent high risk */}
        <div className="screen">
          <div className="h2" style={{marginBottom:12}}>Alertes High Risk récentes</div>
          {recentHighRisk.length===0 ? (
            <div className="small" style={{opacity:0.5}}>Aucune alerte High Risk.</div>
          ) : (
            <div style={{display:"grid",gap:8}}>
              {recentHighRisk.map((s,i)=>{
                const name=s.client_name||[s.first_name,s.last_name].filter(Boolean).join(" ")||"—";
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                    <div className="entity-avatar" style={{background:"rgba(232,64,64,0.15)",color:"#E84040"}}>
                      {name.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:"var(--text-primary)"}}>{name}</div>
                      <div className="small" style={{opacity:0.5}}>{fmtDate(s.created_at)}</div>
                    </div>
                    <span className="risk-badge high" style={{fontSize:11}}>High Risk</span>
                    <Link to={`/screenings/${s.id}`} className="btn secondary sm">Voir</Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}