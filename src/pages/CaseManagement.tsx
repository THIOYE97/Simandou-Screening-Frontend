// src/pages/CaseManagement.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCases, listScreenings, updateCaseStatus } from "../api";
import type { CaseOut, ScreeningListItem, CaseWorkflowStatus } from "../api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type RiskLevel  = "high" | "medium" | "low" | "unknown";
type CaseStatus = "pending" | "in_progress" | "closed";

interface EnrichedCase {
  id:               string;
  caseRef:          string;
  name:             string;
  initials:         string;
  risk:             RiskLevel;
  status:           CaseStatus;
  rawDbStatus:      string;
  caseType:         string;
  assignedTo:       string;
  assigneeInitials: string;
  date:             string | null;
  screeningId:      string | null;
  matchesCount:     number;
}

const PAGE_SIZE = 10;
const ANALYSTS  = ["Alice Martin", "Michel Dubois", "Amira Lefevre", "Louis Morel", "Sarah Bernard"];

// ─────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────
// DB enum → workflow status
function mapDbStatus(s: string | null | undefined): CaseStatus {
  const v = String(s ?? "").toUpperCase();
  if (["CLOSED","DONE","APPROVED","COMPLETED"].includes(v)) return "closed";
  if (["IN_PROGRESS","RUNNING","ACTIVE"].includes(v))        return "in_progress";
  // DRAFT, OPEN, PENDING, NEW → pending
  return "pending";
}

// Workflow status → display
const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:     { label: "Pending",     color: "#F5920A", bg: "rgba(245,146,10,0.12)",  border: "rgba(245,146,10,0.3)",  icon: "⏳" },
  in_progress: { label: "In Progress", color: "#2D7FD6", bg: "rgba(45,127,214,0.12)",  border: "rgba(45,127,214,0.3)",  icon: "🔄" },
  closed:      { label: "Closed",      color: "#2ECC8F", bg: "rgba(46,204,143,0.12)",  border: "rgba(46,204,143,0.3)",  icon: "✅" },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

function initials(name: string): string {
  return (name || "?").split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function normalizeRisk(s: string | null | undefined): RiskLevel {
  const v = String(s ?? "").toUpperCase();
  if (v === "HIGH")   return "high";
  if (v === "MEDIUM") return "medium";
  if (v === "LOW")    return "low";
  return "unknown";
}

function buildScreeningMap(screenings: ScreeningListItem[]): Map<string, ScreeningListItem> {
  const map = new Map<string, ScreeningListItem>();
  for (const s of screenings) {
    if (s.case_id && !map.has(s.case_id)) map.set(s.case_id, s);
  }
  return map;
}

function enrichCases(cases: CaseOut[], screeningMap: Map<string, ScreeningListItem>): EnrichedCase[] {
  return cases.map((c, idx) => {
    const sc      = screeningMap.get(c.id) ?? null;
    const riskRaw = sc?.risk_level || c.risk_level || null;
    const date    = sc?.created_at || c.updated_at || c.created_at || null;
    const rawName =
      sc?.client_name ||
      [sc?.first_name, sc?.last_name].filter(Boolean).join(" ").trim() ||
      c.client_name ||
      [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "";

    const name    = rawName || `Case #${idx + 1}`;
    const caseRef = `${String(c.id).slice(0, 8).toUpperCase()}-${(c.case_type || "KYC").slice(0, 3).toUpperCase()}`;

    return {
      id:               c.id,
      caseRef,
      name,
      initials:         initials(name),
      risk:             normalizeRisk(riskRaw),
      status:           mapDbStatus(c.status),
      rawDbStatus:      c.status || "DRAFT",
      caseType:         c.case_type || "KYC",
      assignedTo:       ANALYSTS[idx % ANALYSTS.length],
      assigneeInitials: initials(ANALYSTS[idx % ANALYSTS.length]),
      date,
      screeningId:      sc?.id ?? null,
      matchesCount:     sc?.matches_count ?? 0,
    };
  });
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function RiskBadge({ risk }: { risk: RiskLevel }) {
  if (risk === "unknown") return <span className="badge" style={{ opacity: 0.4 }}>—</span>;
  return <span className={`risk-badge ${risk}`}>{risk === "high" ? "High Risk" : risk === "medium" ? "Medium Risk" : "Low Risk"}</span>;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border, fontWeight: 700 }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// Inline status changer — dropdown 3 états
function StatusChanger({
  caseId,
  current,
  onChange,
}: {
  caseId: string;
  current: CaseStatus;
  onChange: (id: string, newStatus: CaseStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function pick(next: CaseStatus) {
    if (next === current || busy) return;
    setOpen(false);
    setBusy(true);
    try {
      const apiStatus: CaseWorkflowStatus =
        next === "pending" ? "PENDING" :
        next === "in_progress" ? "IN_PROGRESS" : "CLOSED";
      await updateCaseStatus(caseId, apiStatus);
      onChange(caseId, next);
    } catch (e: any) {
      console.error("[status]", e?.response?.data?.detail || e?.message);
    } finally { setBusy(false); }
  }

  const cfg = STATUS_CONFIG[current];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={busy}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 20,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          color: cfg.color, fontWeight: 700, fontSize: 12,
          cursor: "pointer", whiteSpace: "nowrap",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "…" : <>{cfg.icon} {cfg.label}</>}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 51,
            background: "var(--bg-card)", border: "1px solid var(--border-light)",
            borderRadius: 12, padding: 6, minWidth: 160,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            {(["pending","in_progress","closed"] as CaseStatus[]).map(s => {
              const c = STATUS_CONFIG[s];
              return (
                <button key={s}
                  onClick={() => pick(s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", borderRadius: 8, border: "none",
                    background: s === current ? c.bg : "transparent",
                    color: s === current ? c.color : "var(--text-secondary)",
                    fontWeight: s === current ? 700 : 500,
                    fontSize: 13, cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (s !== current) (e.target as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { if (s !== current) (e.target as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                  {s === current && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return (
    <div className="pagination">
      <button className="pagination-btn" disabled={current <= 1} onClick={() => onChange(current - 1)}>‹</button>
      {pages.map((p, i) => p === "…"
        ? <span key={i} className="pagination-dots">…</span>
        : <button key={i} className={`pagination-btn ${p === current ? "active" : ""}`} onClick={() => onChange(p as number)}>{p}</button>
      )}
      <button className="pagination-btn" disabled={current >= total} onClick={() => onChange(current + 1)}>›</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
export default function CaseManagement() {
  const [busy,  setBusy]  = useState(true);
  const [err,   setErr]   = useState<string | null>(null);
  const [cases, setCases] = useState<EnrichedCase[]>([]);

  const [filterStatus,   setFilterStatus]   = useState<"all" | CaseStatus>("all");
  const [filterRisk,     setFilterRisk]     = useState<"all" | RiskLevel>("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [searchQ,        setSearchQ]        = useState("");
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [page,           setPage]           = useState(1);

  function load() {
    setBusy(true);
    Promise.allSettled([
      listCases({}),
      listScreenings({ limit: 200, offset: 0 }),
    ]).then(([casesRes, screeningsRes]) => {
      const rawCases: CaseOut[]             = casesRes.status === "fulfilled" ? casesRes.value : [];
      const screenings: ScreeningListItem[] = screeningsRes.status === "fulfilled" ? screeningsRes.value.items : [];
      if (casesRes.status === "rejected") {
        const e = (casesRes as any).reason;
        setErr(e?.response?.data?.detail || e?.message || "Erreur chargement cases");
      }
      setCases(enrichCases(rawCases, buildScreeningMap(screenings)));
    }).finally(() => setBusy(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Inline status update — no full reload
  function handleStatusChange(caseId: string, newStatus: CaseStatus) {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c));
  }

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return cases.filter(c => {
      if (filterStatus   !== "all" && c.status     !== filterStatus)   return false;
      if (filterRisk     !== "all" && c.risk       !== filterRisk)     return false;
      if (filterAssignee !== "all" && c.assignedTo !== filterAssignee) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.caseRef.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cases, filterStatus, filterRisk, filterAssignee, searchQ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total:      cases.length,
    pending:    cases.filter(c => c.status === "pending").length,
    inProgress: cases.filter(c => c.status === "in_progress").length,
    closed:     cases.filter(c => c.status === "closed").length,
    highRisk:   cases.filter(c => c.risk === "high").length,
  }), [cases]);

  const allAnalysts = useMemo(() => [...new Set(cases.map(c => c.assignedTo))], [cases]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === pageItems.length && pageItems.length > 0
      ? new Set() : new Set(pageItems.map(c => c.id)));
  }

  function caseLink(c: EnrichedCase): string {
    return c.screeningId ? `/screenings/${c.screeningId}` : `/screenings?case_id=${c.id}`;
  }

  // Bulk status update
  async function bulkUpdateStatus(status: CaseWorkflowStatus) {
    const ids = [...selectedIds];
    await Promise.allSettled(ids.map(id => updateCaseStatus(id, status)));
    const mapped = status === "PENDING" ? "pending" : status === "IN_PROGRESS" ? "in_progress" : "closed";
    setCases(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, status: mapped as CaseStatus } : c));
    setSelectedIds(new Set());
  }

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div className="page-kicker">Gestion</div>
          <div className="page-title">Case Management</div>
          <div className="page-subtitle">{busy ? "Chargement…" : `${cases.length} case${cases.length !== 1 ? "s" : ""} au total`}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn secondary sm" onClick={load} disabled={busy}>↻ Actualiser</button>
          <Link to="/analyst" className="btn sm">+ New Screening</Link>
        </div>
      </div>

      {err && <div className="toast danger" style={{ marginBottom: 14 }}>❌ {err}</div>}

      {/* Stat Pills — 4 états */}
      <div className="stat-pills">
        <div className="stat-pill all" style={{ cursor: "pointer" }} onClick={() => { setFilterStatus("all"); setPage(1); }}>
          <span className="pill-count">{busy ? "…" : stats.total}</span>
          <span className="pill-label">Total Cases</span>
        </div>
        {/* Pending */}
        <div className="stat-pill" style={{ background: STATUS_CONFIG.pending.bg, borderColor: STATUS_CONFIG.pending.border, color: STATUS_CONFIG.pending.color, cursor: "pointer" }}
          onClick={() => { setFilterStatus("pending"); setPage(1); }}>
          <span className="pill-count">{busy ? "…" : stats.pending}</span>
          <span className="pill-label">⏳ Pending</span>
        </div>
        {/* In Progress */}
        <div className="stat-pill" style={{ background: STATUS_CONFIG.in_progress.bg, borderColor: STATUS_CONFIG.in_progress.border, color: STATUS_CONFIG.in_progress.color, cursor: "pointer" }}
          onClick={() => { setFilterStatus("in_progress"); setPage(1); }}>
          <span className="pill-count">{busy ? "…" : stats.inProgress}</span>
          <span className="pill-label">🔄 In Progress</span>
        </div>
        {/* Closed */}
        <div className="stat-pill" style={{ background: STATUS_CONFIG.closed.bg, borderColor: STATUS_CONFIG.closed.border, color: STATUS_CONFIG.closed.color, cursor: "pointer" }}
          onClick={() => { setFilterStatus("closed"); setPage(1); }}>
          <span className="pill-count">{busy ? "…" : stats.closed}</span>
          <span className="pill-label">✅ Closed</span>
        </div>
        {/* High Risk */}
        <div className="stat-pill high" style={{ cursor: "pointer" }} onClick={() => { setFilterRisk("high"); setPage(1); }}>
          <span className="pill-count">{busy ? "…" : stats.highRisk}</span>
          <span className="pill-label">High Risk</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div className="filter-chips">
            <span className="filter-label">Filtres :</span>
            <input className="input" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
              placeholder="Nom ou référence…" value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setPage(1); }} />

            {/* Status filter */}
            <div className="row" style={{ gap: 6 }}>
              {(["all","pending","in_progress","closed"] as const).map(s => {
                const active = filterStatus === s;
                const cfg    = s !== "all" ? STATUS_CONFIG[s] : null;
                return (
                  <button key={s}
                    onClick={() => { setFilterStatus(s); setPage(1); }}
                    style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${active && cfg ? cfg.border : "var(--border)"}`,
                      background: active && cfg ? cfg.bg : "transparent",
                      color: active && cfg ? cfg.color : active ? "var(--text-accent)" : "var(--text-muted)",
                    }}>
                    {s === "all" ? "Tous" : STATUS_CONFIG[s].icon + " " + STATUS_CONFIG[s].label}
                  </button>
                );
              })}
            </div>

            <select className="select" style={{ width: "auto", padding: "4px 28px 4px 10px", fontSize: 12 }}
              value={filterRisk} onChange={e => { setFilterRisk(e.target.value as any); setPage(1); }}>
              <option value="all">Tous risques</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>

            <select className="select" style={{ width: "auto", padding: "4px 28px 4px 10px", fontSize: 12 }}
              value={filterAssignee} onChange={e => { setFilterAssignee(e.target.value); setPage(1); }}>
              <option value="all">Tous les analystes</option>
              {allAnalysts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="row" style={{ gap: 8 }}>
            {selectedIds.size > 0 && (
              <>
                <span className="small" style={{ color: "var(--text-muted)" }}>{selectedIds.size} sélectionné(s)</span>
                <button className="btn secondary sm" onClick={() => bulkUpdateStatus("IN_PROGRESS")}>🔄 → In Progress</button>
                <button className="btn secondary sm" onClick={() => bulkUpdateStatus("CLOSED")}>✅ → Closed</button>
                <button className="btn secondary sm" onClick={() => bulkUpdateStatus("PENDING")}>⏳ → Pending</button>
              </>
            )}
            <button className="btn secondary sm"
              onClick={() => { setFilterStatus("all"); setFilterRisk("all"); setFilterAssignee("all"); setSearchQ(""); setPage(1); }}>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="screen" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
          <span className="h2" style={{ margin: 0 }}>
            Résultats &nbsp;<span className="badge">{filtered.length} case{filtered.length !== 1 ? "s" : ""}</span>
          </span>
          <Pagination current={page} total={pageCount} onChange={setPage} />
        </div>

        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox"
                    checked={selectedIds.size === pageItems.length && pageItems.length > 0}
                    onChange={toggleAll} />
                </th>
                <th>Case #</th>
                <th>Nom</th>
                <th>Risk</th>
                <th>Matchs</th>
                <th>Statut</th>
                <th>Assigné à</th>
                <th>Date</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {busy ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement…</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <div className="empty-state-title">Aucun résultat</div>
                    <div className="empty-state-sub">Modifiez vos filtres.</div>
                  </div>
                </td></tr>
              ) : pageItems.map(c => (
                <tr key={c.id} className={selectedIds.has(c.id) ? "selected" : ""}>
                  <td><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>

                  <td className="case-id-cell">{c.caseRef}</td>

                  <td>
                    <div className="case-name-cell">
                      <div className="entity-avatar">{c.initials}</div>
                      <Link to={caseLink(c)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 600, fontSize: 13 }}>
                        {c.name}
                      </Link>
                    </div>
                  </td>

                  <td><RiskBadge risk={c.risk} /></td>

                  <td style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                    {c.matchesCount > 0
                      ? <span style={{ color: "var(--risk-high)" }}>{c.matchesCount}</span>
                      : <span style={{ opacity: 0.3 }}>0</span>
                    }
                  </td>

                  {/* ✅ Inline status changer */}
                  <td>
                    <StatusChanger
                      caseId={c.id}
                      current={c.status}
                      onChange={handleStatusChange}
                    />
                  </td>

                  <td>
                    <div className="assignee-cell">
                      <div className="entity-avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{c.assigneeInitials}</div>
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.assignedTo}</span>
                    </div>
                  </td>

                  <td className="due-date-cell">{fmtDate(c.date)}</td>

                  <td>
                    <Link to={caseLink(c)} className="btn secondary sm">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="small" style={{ color: "var(--text-muted)" }}>
            {filtered.length === 0 ? "0" : `${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,filtered.length)}`} sur {filtered.length}
          </div>
          <Pagination current={page} total={pageCount} onChange={setPage} />
        </div>
      </div>
    </>
  );
}