// src/pages/ScreeningsList.tsx
// Redesigned to match the AML & PEP Screening screenshot
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Download,
  FolderOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { exportScreeningsCsv, listScreenings } from "../api";
import type { ScreeningListItem } from "../api";

const PAGE_SIZE = 20;
const FETCH_MAX = 200;

// ─── Helpers ──────────────────────────────────────────────
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(s);
  }
}

function displayName(r: ScreeningListItem) {
  return r.client_name || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "—";
}

function norm(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function deriveCategory(item: ScreeningListItem): string {
  const rl = String(item.risk_level || "").toUpperCase();
  const ra = String(item.recommended_action || "").toUpperCase();
  if (ra.includes("BLOCK")) return "Sanctions List";
  if (rl === "HIGH") return "Politically Exposed Person (PEP)";
  if (rl === "MEDIUM") return "Watchlist";
  if ((item.matches_count || 0) > 0) return "Adverse Media";
  return "PEP & Relatives";
}

function statusBadgeClass(status?: string | null) {
  const v = String(status || "").toUpperCase();
  if (["DONE", "APPROVED"].includes(v)) return "badge badge-ok";
  if (["RUNNING", "PENDING", "PENDING_REVIEW"].includes(v)) return "badge badge-warn";
  if (["FAILED", "REJECTED", "ERROR"].includes(v)) return "badge badge-bad";
  return "badge";
}

function frStatus(raw?: string | null) {
  const v = String(raw || "").toUpperCase();
  const map: Record<string, string> = {
    DONE: "Terminé",
    APPROVED: "Approuvé",
    RUNNING: "En cours",
    PENDING: "Pending",
    FAILED: "Échec",
    REJECTED: "Rejeté",
  };
  return map[v] || v || "—";
}

// ─── Pagination ────────────────────────────────────────────
function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div className="pagination">
      <button className="pagination-btn" disabled={current <= 1} onClick={() => onChange(current - 1)}>
        ‹
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={i} className="pagination-dots">
            …
          </span>
        ) : (
          <button
            key={i}
            className={`pagination-btn ${p === current ? "active" : ""}`}
            onClick={() => onChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button className="pagination-btn" disabled={current >= total} onClick={() => onChange(current + 1)}>
        ›
      </button>
    </div>
  );
}

// ─── Alerts Overview sidebar ───────────────────────────────
function AlertsOverview({ items }: { items: ScreeningListItem[] }) {
  const high = items.filter((i) => String(i.risk_level || "").toUpperCase() === "HIGH").length;
  const sanctions = items.filter((i) =>
    String(i.recommended_action || "").toUpperCase().includes("BLOCK")
  ).length;
  const watchlist = items.filter((i) => String(i.risk_level || "").toUpperCase() === "MEDIUM").length;
  const pep = items.filter((i) => (i.matches_count || 0) > 0).length;

  return (
    <div className="chart-card" style={{ minWidth: 220 }}>
      <div className="chart-title" style={{ marginBottom: 14 }}>
        Alerts Overview
      </div>

      {[
        { label: "High Risk Alerts:", color: "#E84040", val: high },
        { label: "Sanctions Matches:", color: "#E84040", val: sanctions },
        { label: "Watchlist Hits:", color: "#2D7FD6", val: watchlist },
        { label: "PEP Matches:", color: "#2ECC8F", val: pep },
      ].map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: row.color, flexShrink: 0 }} />
            <span className="small" style={{ color: "var(--text-secondary)" }}>
              {row.label}
            </span>
          </div>
          <b style={{ color: row.color, fontSize: 15 }}>{row.val}</b>
        </div>
      ))}

      <div style={{ marginTop: 14 }}>
        <Link
          to="/analyst"
          className="btn"
          style={{ width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Search size={16} strokeWidth={2.2} />
          New Screening
        </Link>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────
export default function ScreeningsList() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [all, setAll] = useState<ScreeningListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // ── Export modal (date range picker) ──
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const params = {
  limit: FETCH_MAX,
  offset: 0,
  status: filterStatus.trim() || undefined,
  risk_level: filterRisk.trim() || undefined,
  name: searchName.trim() || undefined,
};
      const first = await listScreenings(params);
      const items = Array.isArray(first) ? first : (first?.items ?? []);
      const svtotal = typeof (first as any)?.total === "number" ? (first as any).total : items.length;
      setTotal(svtotal);

      let collected = [...items];
      if (svtotal > FETCH_MAX) {
        const pages = Math.ceil(svtotal / FETCH_MAX);
        const rest = await Promise.allSettled(
          Array.from({ length: pages - 1 }, (_, i) => listScreenings({ ...params, offset: (i + 1) * FETCH_MAX }))
        );
        for (const r of rest) {
          if (r.status === "fulfilled") {
            const it = Array.isArray(r.value) ? r.value : (r.value?.items ?? []);
            collected = collected.concat(it);
          }
        }
      }

      setAll(collected);
      setPage(1);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(
        Array.isArray(d)
          ? d.map((x: any) => x?.msg || JSON.stringify(x)).join(", ")
          : typeof d === "string"
          ? d
          : e?.message || "Erreur"
      );
      setAll([]);
    } finally {
      setBusy(false);
    }
  }

 useEffect(() => {
  load();
}, [filterStatus, filterRisk]);

  const filtered = useMemo(() => {
    const n = norm(searchName);
    const r = filterRisk.toUpperCase();
    return all.filter((item) => {
      if (n && !norm(displayName(item)).includes(n)) return false;
      if (r && String(item.risk_level || "").toUpperCase() !== r) return false;
      return true;
    });
  }, [all, searchName, filterRisk]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      high: filtered.filter((i) => String(i.risk_level || "").toUpperCase() === "HIGH").length,
      medium: filtered.filter((i) => String(i.risk_level || "").toUpperCase() === "MEDIUM").length,
      low: filtered.filter((i) => String(i.risk_level || "").toUpperCase() === "LOW").length,
    }),
    [filtered]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  
function openExportModal() {
  setExportError(null);
  setExportFrom("");
  setExportTo("");
  setShowExportModal(true);
}

function closeExportModal() {
  if (exporting) return;
  setShowExportModal(false);
  setExportError(null);
}

async function handleExportReport() {
  setExportError(null);

  const from = exportFrom.trim();
  const to = exportTo.trim();

  if (from && to && from > to) {
    setExportError("La date de début doit être antérieure ou égale à la date de fin.");
    return;
  }

  setExporting(true);
  setErr(null);

  try {
    const params = {
      status: filterStatus.trim() || undefined,
      risk_level: filterRisk.trim() || undefined,
      name: searchName.trim() || undefined,
      date_from: from || undefined,
      date_to: to || undefined,
    };

    const blob = await exportScreeningsCsv(params);

    const downloadUrl = window.URL.createObjectURL(blob);

    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const riskPart = filterRisk ? filterRisk.toLowerCase() : "all";
    const statusPart = filterStatus ? filterStatus.toLowerCase() : "all";
    const rangePart = from || to ? `_${from || "any"}_to_${to || "any"}` : "";

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `screenings_${riskPart}_${statusPart}${rangePart}_${now}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(downloadUrl);

    setShowExportModal(false);
  } catch (e: any) {
    const detail = e?.response?.data?.detail;

    const msg =
      typeof detail === "string"
        ? detail
        : e?.message || "Erreur pendant l’export du rapport.";

    setExportError(msg);
    setErr(msg);
  } finally {
    setExporting(false);
  }
}
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelectedIds(
      selectedIds.size === pageItems.length && pageItems.length > 0
        ? new Set()
        : new Set(pageItems.map((r) => r.id))
    );
  }

  return (
    <>
      <div
        className="page-header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <div className="page-kicker">AML / PEP</div>
          <div className="page-title">Screening Results</div>
          <div className="page-subtitle">
            {busy ? "Chargement…" : `${total} screening${total !== 1 ? "s" : ""} au total`}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn secondary sm"
            onClick={load}
            disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <RefreshCw size={14} strokeWidth={2.2} />
            Actualiser
          </button>
          <Link
            to="/analyst"
            className="btn sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Search size={14} strokeWidth={2.2} />
            New Screening
          </Link>
        </div>
      </div>

      {err && (
        <div className="toast danger" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} strokeWidth={2.2} />
          {err}
        </div>
      )}

      <div className="stat-pills">
        <div
          className="stat-pill all"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setFilterRisk("");
            setPage(1);
          }}
        >
          <span className="pill-count">{busy ? "…" : stats.total}</span>
          <span className="pill-label">Matches Found</span>
        </div>

        <div
          className="stat-pill high"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setFilterRisk("HIGH");
            setPage(1);
          }}
        >
          <span className="pill-count">{busy ? "…" : stats.high}</span>
          <span className="pill-label">High Risk</span>
        </div>

        <div
          className="stat-pill medium"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setFilterRisk("MEDIUM");
            setPage(1);
          }}
        >
          <span className="pill-count">{busy ? "…" : stats.medium}</span>
          <span className="pill-label">Medium Risk</span>
        </div>

        <div
          className="stat-pill low"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setFilterRisk("LOW");
            setPage(1);
          }}
        >
          <span className="pill-count">{busy ? "…" : stats.low}</span>
          <span className="pill-label">Low Risk</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, alignItems: "start" }}>
        <div>
          <div className="filters-bar" style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div className="filter-chips">
                <span className="filter-label">Filter:</span>

                {(["", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
                  <button
                    key={r || "all"}
                    onClick={() => {
                      setFilterRisk(r);
                      setPage(1);
                    }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${filterRisk === r ? "var(--border-active)" : "var(--border)"}`,
                      background: filterRisk === r ? "var(--accent-light)" : "transparent",
                      color: filterRisk === r ? "var(--text-accent)" : "var(--text-muted)",
                    }}
                  >
                    {r === "" ? "All Matches" : r === "HIGH" ? "High Risk" : r === "MEDIUM" ? "Medium Risk" : "Low Risk"}
                  </button>
                ))}

                <span className="filter-label" style={{ marginLeft: 8 }}>
                  |
                </span>
                <span className="filter-label">Status:</span>

                {["", "PENDING", "DONE", "RUNNING"].map((s) => (
                  <button
                    key={s || "all"}
                    onClick={() => {
  setFilterStatus(s);
  setPage(1);
}}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${filterStatus === s ? "var(--border-active)" : "var(--border)"}`,
                      background: filterStatus === s ? "var(--accent-light)" : "transparent",
                      color: filterStatus === s ? "var(--text-accent)" : "var(--text-muted)",
                    }}
                  >
                    {s === "" ? "All" : s === "PENDING" ? "Pending" : s === "DONE" ? "Done" : "Running"}
                  </button>
                ))}
              </div>

              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
                  placeholder="Rechercher un nom…"
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setPage(1);
                  }}
                />
                <button
                  className="btn secondary sm"
                  onClick={() => {
                    setFilterRisk("");
                    setFilterStatus("");
                    setSearchName("");
                    load();
                  }}
                >
                  Clear Filters
                </button>
                <button
  className="btn sm"
  onClick={openExportModal}
  disabled={exporting || busy}
  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
>
  <Download size={14} strokeWidth={2.2} />
  {exporting ? "Exporting..." : "Export Report"}
</button>
              </div>
            </div>
          </div>

          <div className="screen" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 16px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="row" style={{ gap: 10 }}>
                {selectedIds.size > 0 && (
                  <>
                    <button
                      className="btn secondary sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <ClipboardList size={14} strokeWidth={2.2} />
                      Batch Review
                    </button>
                    <button
                      className="btn secondary sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <FolderOpen size={14} strokeWidth={2.2} />
                      Assign Cases
                    </button>
                  </>
                )}
                <span className="small" style={{ color: "var(--text-muted)" }}>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </span>
              </div>
              <Pagination current={page} total={pageCount} onChange={setPage} />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="cases-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === pageItems.length && pageItems.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Name ↑</th>
                    <th>Category</th>
                    <th>Risk Level ↑</th>
                    <th>Status ↑</th>
                    <th style={{ width: 100 }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {busy && all.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", opacity: 0.4 }} className="small">
                        Chargement…
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-state-icon">
                            <Search size={28} />
                          </div>
                          <div className="empty-state-title">Aucun résultat</div>
                          <div className="empty-state-sub">
                            Modifiez vos filtres ou lancez un nouveau screening.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((r) => {
                      const risk = String(r.risk_level || "").toUpperCase();
                      const cat = deriveCategory(r);
                      const name = displayName(r);

                      return (
                        <tr key={r.id} className={selectedIds.has(r.id) ? "selected" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                            />
                          </td>

                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="entity-avatar">{initials(name)}</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                                  {name}
                                </div>
                                <div className="small" style={{ opacity: 0.55, marginTop: 1 }}>
                                  {fmtDate(r.created_at)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="small" style={{ color: "var(--text-secondary)" }}>
                            {cat}
                          </td>

                          <td>
                            {risk === "HIGH" ? (
                              <span className="risk-badge high">High Risk</span>
                            ) : risk === "MEDIUM" ? (
                              <span className="risk-badge medium">Medium Risk</span>
                            ) : risk === "LOW" ? (
                              <span className="risk-badge low">Low Risk</span>
                            ) : (
                              <span className="badge" style={{ opacity: 0.4 }}>
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <span className={statusBadgeClass(r.status)}>{frStatus(r.status)}</span>
                          </td>

                          <td>
                            <button
                              className="btn secondary sm"
                              onClick={() => navigate(`/screenings/${encodeURIComponent(r.id)}`)}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="small" style={{ color: "var(--text-muted)" }}>
                {PAGE_SIZE} par page
              </span>
              <Pagination current={page} total={pageCount} onChange={setPage} />
            </div>
          </div>
        </div>

        <AlertsOverview items={filtered} />
      </div>

      {showExportModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeExportModal();
          }}
        >
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div>
                <div className="modal-kicker">Export CSV</div>
                <div
                  className="modal-action"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <CalendarRange size={18} strokeWidth={2.2} />
                  Choisir l'intervalle des dates
                </div>
                <div
                  className="small"
                  style={{ color: "var(--text-muted)", marginTop: 6 }}
                >
                  Les filtres actifs (statut, risque, recherche) seront aussi appliqués.
                  Laissez vide pour ne pas borner.
                </div>
              </div>
              <button
                className="btn secondary sm"
                onClick={closeExportModal}
                disabled={exporting}
                aria-label="Fermer"
                style={{ padding: 6 }}
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div
                    className="small"
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Du
                  </div>
                  <input
                    type="date"
                    className="input"
                    value={exportFrom}
                    max={exportTo || undefined}
                    onChange={(e) => setExportFrom(e.target.value)}
                    disabled={exporting}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <div
                    className="small"
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Au
                  </div>
                  <input
                    type="date"
                    className="input"
                    value={exportTo}
                    min={exportFrom || undefined}
                    onChange={(e) => setExportTo(e.target.value)}
                    disabled={exporting}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {exportError && (
                <div
                  className="toast danger"
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={14} strokeWidth={2.2} />
                  {exportError}
                </div>
              )}
            </div>

            <div
              className="modal-footer"
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                className="btn secondary sm"
                onClick={closeExportModal}
                disabled={exporting}
              >
                Annuler
              </button>
              <button
                className="btn sm"
                onClick={handleExportReport}
                disabled={exporting}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Download size={14} strokeWidth={2.2} />
                {exporting ? "Export en cours..." : "Exporter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
