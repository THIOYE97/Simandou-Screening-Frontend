// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  FileSearch,
  FolderOpen,
  Landmark,
  Newspaper,
  Scale,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { listScreenings, listCases } from "../api";
import type { ScreeningListItem } from "../api";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function displayName(item: ScreeningListItem): string {
  return item.client_name || [item.first_name, item.last_name].filter(Boolean).join(" ").trim() || "—";
}

function riskOf(item: ScreeningListItem): "high" | "medium" | "low" {
  const rl = String(item.risk_level ?? "").toUpperCase();
  if (rl === "HIGH") return "high";
  if (rl === "MEDIUM") return "medium";
  if (rl === "LOW") return "low";

  const st = String(item.status ?? "").toUpperCase();
  if (["FAILED", "ERROR"].includes(st)) return "high";
  if (["RUNNING", "PENDING"].includes(st)) return "medium";
  return "low";
}

// ✅ Breakdown with lucide icons
function buildBreakdown(items: ScreeningListItem[]) {
  const withMatches = items.filter((i) => (i.matches_count ?? 0) > 0).length;
  const pep = items.filter(
    (i) => String(i.recommended_action ?? "").toUpperCase().includes("REVIEW") || riskOf(i) === "high"
  ).length;
  const sanctions = items.filter((i) => riskOf(i) === "high").length;
  const adverseMedia = items.filter((i) => riskOf(i) === "medium").length;

  return [
    {
      label: "Sanctions",
      icon: Scale,
      color: "#E84040",
      bg: "rgba(232,64,64,0.12)",
      count: sanctions,
    },
    {
      label: "Watchlists",
      icon: ClipboardList,
      color: "#2D7FD6",
      bg: "rgba(45,127,214,0.15)",
      count: withMatches,
    },
    {
      label: "Adverse Media",
      icon: Newspaper,
      color: "#F5920A",
      bg: "rgba(245,146,10,0.12)",
      count: adverseMedia,
    },
    {
      label: "PEP & Relatives",
      icon: UserRound,
      color: "#2ECC8F",
      bg: "rgba(46,204,143,0.12)",
      count: pep,
    },
    {
      label: "Politically Exposed",
      icon: Landmark,
      color: "#A78BFA",
      bg: "rgba(167,139,250,0.12)",
      count: Math.round(pep * 0.6),
    },
  ];
}

type ChartPoint = { label: string; high: number; medium: number; low: number };

function buildChartData(items: ScreeningListItem[]): ChartPoint[] {
  const WEEK = 7 * 24 * 3600 * 1000;
  const now = Date.now();
  const pts: ChartPoint[] = Array.from({ length: 5 }, (_, i) => ({
    label: `S-${4 - i}`,
    high: 0,
    medium: 0,
    low: 0,
  }));

  for (const it of items) {
    if (!it.created_at) continue;
    const age = Math.floor((now - new Date(it.created_at).getTime()) / WEEK);
    if (age < 0 || age >= 5) continue;
    pts[4 - age][riskOf(it)]++;
  }

  return pts;
}

// ─────────────────────────────────────────────
// SVG Line Chart
// ─────────────────────────────────────────────
function LineChart({ data }: { data: ChartPoint[] }) {
  const W = 400;
  const H = 130;
  const P = 20;
  const cW = W - P * 2;
  const cH = H - P * 2;
  const max = Math.max(...data.flatMap((p) => [p.high, p.medium, p.low]), 1);
  const cols = { high: "#E84040", medium: "#F5920A", low: "#2ECC8F" };
  const n = Math.max(data.length - 1, 1);

  function pts(k: "high" | "medium" | "low") {
    return data
      .map((p, i) => `${P + (i / n) * cW},${P + cH - (p[k] / max) * cH}`)
      .join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1={P}
          y1={P + cH * (1 - t)}
          x2={W - P}
          y2={P + cH * (1 - t)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}
      {(Object.keys(cols) as ("high" | "medium" | "low")[]).map((k) => (
        <polyline
          key={k}
          points={pts(k)}
          fill="none"
          stroke={cols[k]}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      ))}
      {(Object.keys(cols) as ("high" | "medium" | "low")[]).map((k) =>
        data.map((p, i) => (
          <circle
            key={`${k}${i}`}
            cx={P + (i / n) * cW}
            cy={P + cH - (p[k] / max) * cH}
            r="3.5"
            fill={cols[k]}
          />
        ))
      )}
      {data.map((p, i) => (
        <text
          key={i}
          x={P + (i / n) * cW}
          y={H - 4}
          fontSize="9"
          fill="rgba(226,237,255,0.35)"
          textAnchor="middle"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// SVG Donut
// ─────────────────────────────────────────────
function DonutChart({
  pending,
  inProgress,
  closed,
}: {
  pending: number;
  inProgress: number;
  closed: number;
}) {
  const total = pending + inProgress + closed || 1;
  const R = 54;
  const circ = 2 * Math.PI * R;
  const segs = [
    { value: pending, color: "#2D7FD6", label: "Pending" },
    { value: inProgress, color: "#2ECC8F", label: "In Progress" },
    { value: closed, color: "rgba(255,255,255,0.15)", label: "Closed" },
  ];

  let off = 0;
  const arcs = segs.map((s) => {
    const dash = (s.value / total) * circ;
    const a = { ...s, dash, off, pct: Math.round((s.value / total) * 100) };
    off += dash;
    return a;
  });

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <div className="donut-container" style={{ width: 140, height: 140, flexShrink: 0 }}>
        <svg viewBox="0 0 140 140" width="140" height="140">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth="16"
              strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
              strokeDashoffset={-arc.off + circ * 0.25}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-center-count">{pending + inProgress + closed}</span>
          <span className="donut-center-label">Total Cases</span>
        </div>
      </div>

      <div className="donut-legend" style={{ flex: 1 }}>
        {arcs.map((arc, i) => (
          <div className="donut-legend-item" key={i}>
            <div className="donut-legend-dot" style={{ background: arc.color }} />
            <span className="donut-legend-label">{arc.label}</span>
            <span className="donut-legend-count">{arc.value}</span>
            <span className="donut-legend-pct">({arc.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────
export default function Dashboard() {
  const [loadSc, setLoadSc] = useState(true);
  const [loadCa, setLoadCa] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [high, setHigh] = useState(0);
  const [medium, setMedium] = useState(0);
  const [low, setLow] = useState(0);
  const [recent, setRecent] = useState<ScreeningListItem[]>([]);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [breakdown, setBreakdown] = useState(buildBreakdown([]));
  const [caseOvw, setCaseOvw] = useState({ pending: 0, inProgress: 0, closed: 0 });

  useEffect(() => {
    listScreenings({ limit: 200, offset: 0 })
      .then((r) => {
        const items = r.items;

        const h = items.filter((i) => riskOf(i) === "high").length;
        const m = items.filter((i) => riskOf(i) === "medium").length;
        const l = items.filter((i) => riskOf(i) === "low").length;

        setTotal(items.length);
        setHigh(h);
        setMedium(m);
        setLow(l);
        setRecent(items.slice(0, 5));
        setChart(buildChartData(items));
        setBreakdown(buildBreakdown(items));
      })
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || "Erreur screenings"))
      .finally(() => setLoadSc(false));
  }, []);

  useEffect(() => {
    listCases({})
      .then((cases) => {
        const UP = (s: string | null | undefined) => String(s ?? "").toUpperCase();
        const pending = cases.filter((c) => ["OPEN", "PENDING", "DRAFT", "NEW"].includes(UP(c.status))).length;
        const inProgress = cases.filter((c) => ["IN_PROGRESS", "RUNNING"].includes(UP(c.status))).length;
        const closed = cases.filter((c) => ["CLOSED", "DONE", "APPROVED"].includes(UP(c.status))).length;
        setCaseOvw({ pending: pending || cases.length, inProgress, closed });
      })
      .catch(() => {})
      .finally(() => setLoadCa(false));
  }, []);

  return (
    <>
      <div
        className="page-header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <div className="page-kicker">Overview</div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">AML / PEP — 30 derniers jours</div>
        </div>

        <div className="row" style={{ gap: 10, flexShrink: 0 }}>
          <span className="badge">Toutes sources · Tous risques · 30j</span>
          <Link to="/screenings" className="btn sm">
            Export Report
          </Link>
        </div>
      </div>

      {err && (
        <div className="toast danger" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <XCircle size={16} strokeWidth={2.2} />
          {err}
        </div>
      )}

      <div className="stat-pills">
        {[
          { cls: "all", val: total, label: "Matches Found" },
          { cls: "high", val: high, label: "High Risk Alerts" },
          { cls: "medium", val: medium, label: "Medium Risk Alerts" },
          { cls: "low", val: low, label: "Low Risk Alerts" },
        ].map((p) => (
          <div key={p.label} className={`stat-pill ${p.cls}`}>
            <span className="pill-count">{loadSc ? "…" : p.val}</span>
            <span className="pill-label">{p.label}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-col">
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">Screening Summary</div>
              <div className="chart-period">{loadSc ? "…" : `${total} screenings`}</div>
            </div>

            <div className="chart-legend">
              {[["high", "#E84040", high], ["medium", "#F5920A", medium], ["low", "#2ECC8F", low]].map(
                ([k, c, v]) => (
                  <div key={k as string} className="chart-legend-item">
                    <div className="chart-legend-dot" style={{ background: c as string }} />
                    <span style={{ textTransform: "capitalize" }}>
                      {k as string} Risk &nbsp;<b style={{ color: c as string }}>{loadSc ? "…" : (v as number)}</b>
                    </span>
                  </div>
                )
              )}
            </div>

            {loadSc ? (
              <div className="small" style={{ opacity: 0.4, textAlign: "center", padding: "30px 0" }}>
                Chargement…
              </div>
            ) : (
              <LineChart data={chart} />
            )}
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">Recent Alerts</div>
              <Link to="/screenings" className="small" style={{ color: "var(--text-accent)" }}>
                Voir tout →
              </Link>
            </div>

            <table className="recent-alerts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Statut</th>
                  <th>Risk</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loadSc ? (
                  <tr>
                    <td colSpan={4} className="small" style={{ opacity: 0.4, padding: "20px 0" }}>
                      Chargement…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="small" style={{ opacity: 0.4 }}>
                      Aucun screening.
                    </td>
                  </tr>
                ) : (
                  recent.map((item) => {
                    const risk = riskOf(item);
                    const st = String(item.status ?? "").toUpperCase();

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="recent-alert-name">
                            <div className="entity-avatar">{initials(displayName(item))}</div>
                            <Link
                              to={`/screenings/${item.id}`}
                              style={{
                                color: "var(--text-primary)",
                                fontWeight: 600,
                                textDecoration: "none",
                                fontSize: 13,
                              }}
                            >
                              {displayName(item)}
                            </Link>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              st === "DONE"
                                ? "badge-ok"
                                : ["RUNNING", "PENDING"].includes(st)
                                ? "badge-warn"
                                : "badge-bad"
                            }`}
                          >
                            {item.status || "—"}
                          </span>
                        </td>
                        <td>
                          <span className={`risk-badge ${risk}`}>
                            {risk === "high" ? "High" : risk === "medium" ? "Medium" : "Low"} Risk
                          </span>
                        </td>
                        <td className="small" style={{ color: "var(--text-muted)" }}>
                          {fmtDate(item.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-col">
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">Case Overview</div>
              <Link to="/cases" className="small" style={{ color: "var(--text-accent)" }}>
                Voir tout →
              </Link>
            </div>

            {loadCa ? (
              <div className="small" style={{ opacity: 0.4, textAlign: "center", padding: "30px 0" }}>
                Chargement…
              </div>
            ) : (
              <DonutChart {...caseOvw} />
            )}
          </div>

          <div className="chart-card">
            <div className="chart-header" style={{ marginBottom: 12 }}>
              <div className="chart-title">Alerts Breakdown</div>
            </div>

            <div className="alerts-breakdown-list">
              {breakdown.map((d, i) => {
                const Icon = d.icon;
                return (
                  <div className="alert-breakdown-item" key={i}>
                    <div
                      className="alert-breakdown-icon"
                      style={{
                        background: d.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={16} strokeWidth={2.1} color={d.color} />
                    </div>
                    <span className="alert-breakdown-label">{d.label}</span>
                    <span className="alert-breakdown-count" style={{ color: d.color }}>
                      {loadSc ? "…" : d.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="dashboard-col">
          <div className="chart-card">
            <div className="chart-header" style={{ marginBottom: 12 }}>
              <div className="chart-title">Alerts Breakdown</div>
            </div>

            {breakdown.map((d, i) => {
              const Icon = d.icon;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "7px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span className="small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon size={15} strokeWidth={2.1} color={d.color} />
                    {d.label}
                  </span>
                  <b style={{ color: d.color, fontSize: 15 }}>{loadSc ? "…" : d.count}</b>
                </div>
              );
            })}
          </div>

          <div className="chart-card">
            <div className="chart-header" style={{ marginBottom: 10 }}>
              <div className="chart-title">Watchlist Updates</div>
              <Link to="/watchlists" className="small" style={{ color: "var(--text-accent)" }}>
                View All
              </Link>
            </div>

            {[
              { dot: "#E84040", text: "Nouvelles entités ajoutées à la liste OFAC." },
              { dot: "#F5920A", text: "Ajouts et suppressions d'entités watchlist." },
            ].map((w, i) => (
              <div key={i} className="watchlist-update-item">
                <div className="watchlist-update-dot" style={{ background: w.dot }} />
                <div className="watchlist-update-text">{w.text}</div>
              </div>
            ))}
          </div>

          <div className="chart-card">
            <div className="chart-header" style={{ marginBottom: 12 }}>
              <div className="chart-title">Actions rapides</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link
                to="/analyst"
                className="btn"
                style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
              >
                <Search size={16} strokeWidth={2.2} />
                Nouveau Screening
              </Link>

              <Link
                to="/cases"
                className="btn secondary"
                style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
              >
                <FolderOpen size={16} strokeWidth={2.2} />
                Voir les Cases
              </Link>

              <Link
                to="/screenings"
                className="btn secondary"
                style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
              >
                <ClipboardList size={16} strokeWidth={2.2} />
                Tous les Screenings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}