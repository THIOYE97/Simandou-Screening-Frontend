// src/pages/Reports.tsx
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderOpen,
  Search,
  ShieldAlert,
} from "lucide-react";
import { listScreenings, listCases } from "../api";
import type { ScreeningListItem } from "../api";

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(s?: string | null) {
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

function BarChart({
  data,
  color = "#2D7FD6",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 380,
    H = 110,
    PAD = 16,
    barW = Math.max(8, Math.floor((W - PAD * 2) / data.length) - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (H - PAD - 14));
        const x =
          PAD +
          (i / data.length) * (W - PAD * 2) +
          (W - PAD * 2) / data.length / 2 -
          barW / 2;
        const y = H - PAD - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={color} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={H - 3}
              fontSize="8"
              fill="rgba(226,237,255,0.35)"
              textAnchor="middle"
            >
              {d.label}
            </text>
            {d.value > 0 && (
              <text
                x={x + barW / 2}
                y={y - 3}
                fontSize="8"
                fill="rgba(226,237,255,0.6)"
                textAnchor="middle"
              >
                {d.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function Reports() {
  const [busy, setBusy] = useState(true);
  const [screenings, setScreenings] = useState<ScreeningListItem[]>([]);
  const [totalCases, setTotalCases] = useState(0);

  useEffect(() => {
    Promise.allSettled([listScreenings({ limit: 200, offset: 0 }), listCases({})])
      .then(([sr, cr]) => {
        if (sr.status === "fulfilled") setScreenings(sr.value.items || []);
        if (cr.status === "fulfilled") setTotalCases(cr.value?.length || 0);
      })
      .finally(() => setBusy(false));
  }, []);

  // ── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = screenings.length;
    const done = screenings.filter((s) =>
      ["DONE", "APPROVED"].includes(String(s.status || "").toUpperCase())
    ).length;
    const high = screenings.filter(
      (s) => String(s.risk_level || "").toUpperCase() === "HIGH"
    ).length;
    const medium = screenings.filter(
      (s) => String(s.risk_level || "").toUpperCase() === "MEDIUM"
    ).length;
    const low = screenings.filter(
      (s) => String(s.risk_level || "").toUpperCase() === "LOW"
    ).length;
    const withMatches = screenings.filter((s) => (s.matches_count || 0) > 0).length;
    const passRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const matchRate = total > 0 ? Math.round((withMatches / total) * 100) : 0;

    return {
      total,
      done,
      high,
      medium,
      low,
      withMatches,
      passRate,
      matchRate,
    };
  }, [screenings]);

  const weeklyData = useMemo(() => {
    const WEEK = 7 * 24 * 3600 * 1000;
    const now = Date.now();
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      label: `S-${7 - i}`,
      value: 0,
    }));

    for (const s of screenings) {
      if (!s.created_at) continue;
      const age = Math.floor((now - new Date(s.created_at).getTime()) / WEEK);
      if (age >= 0 && age < 8) buckets[7 - age].value++;
    }
    return buckets;
  }, [screenings]);

  const topClients = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; risk: string }>();
    for (const s of screenings) {
      const name =
        s.client_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
      if (name === "—") continue;
      const ex = counts.get(name);
      if (ex) ex.count++;
      else counts.set(name, { name, count: 1, risk: s.risk_level || "" });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [screenings]);

  const recentHigh = useMemo(
    () => screenings.filter((s) => String(s.risk_level || "").toUpperCase() === "HIGH").slice(0, 5),
    [screenings]
  );

  return (
    <>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div className="page-kicker">Analytics</div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">
            Générez et consultez les rapports de conformité AML/PEP
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link
            to="/screenings"
            className="btn secondary sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <ClipboardList size={14} strokeWidth={2.2} />
            Voir les screenings
          </Link>
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

      {/* Live KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Total Screenings",
            value: stats.total,
            color: "#2D7FD6",
            icon: Search,
          },
          {
            label: "Terminés",
            value: stats.done,
            color: "#2ECC8F",
            icon: CheckCircle2,
          },
          {
            label: "High Risk",
            value: stats.high,
            color: "#E84040",
            icon: ShieldAlert,
          },
          {
            label: "Avec Matchs",
            value: stats.withMatches,
            color: "#F5920A",
            icon: AlertTriangle,
          },
          {
            label: "Cases Total",
            value: totalCases,
            color: "#A78BFA",
            icon: FolderOpen,
          },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="chart-card" style={{ textAlign: "center" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Icon size={24} strokeWidth={2.1} color={kpi.color} />
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: kpi.color,
                  lineHeight: 1,
                }}
              >
                {busy ? "…" : kpi.value}
              </div>
              <div className="small" style={{ marginTop: 4, color: "var(--text-secondary)" }}>
                {kpi.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 280px",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="chart-card">
          <div className="chart-header" style={{ marginBottom: 12 }}>
            <div className="chart-title">Activité hebdomadaire</div>
            <span className="badge">{stats.total} total</span>
          </div>
          <BarChart data={weeklyData} color="#2D7FD6" />
        </div>

        <div className="chart-card">
          <div className="chart-header" style={{ marginBottom: 12 }}>
            <div className="chart-title">Distribution des risques</div>
          </div>
          <BarChart
            data={[
              { label: "High", value: stats.high },
              { label: "Medium", value: stats.medium },
              { label: "Low", value: stats.low },
            ]}
            color="#5BA8F5"
          />
          <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
            {[
              ["#E84040", "High", stats.high],
              ["#F5920A", "Medium", stats.medium],
              ["#2ECC8F", "Low", stats.low],
            ].map(([c, l, v], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: String(c) }} />
                <span style={{ color: "var(--text-secondary)" }}>{l}</span>
                <b style={{ color: String(c) }}>{v}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 10 }}>
            Performance
          </div>
          {[
            { label: "Taux succès", value: stats.passRate, color: "#2ECC8F" },
            { label: "Taux matchs", value: stats.matchRate, color: "#F5920A" },
            { label: "Cas terminés", value: stats.done, color: "#2D7FD6", raw: true },
            { label: "High Risk", value: stats.high, color: "#E84040", raw: true },
          ].map((row, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span className="small" style={{ color: "var(--text-muted)" }}>
                  {row.label}
                </span>
                <b style={{ color: row.color, fontSize: 13 }}>
                  {(row as any).raw ? row.value : `${row.value}%`}
                </b>
              </div>
              {!(row as any).raw && (
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 2,
                      width: `${row.value}%`,
                      background: row.color,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom tables */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 20,
        }}
      >
        <div className="screen">
          <div className="h2" style={{ marginBottom: 12 }}>
            Top clients screenés
          </div>
          {topClients.length === 0 ? (
            <div className="small" style={{ opacity: 0.5 }}>
              Aucune donnée.
            </div>
          ) : (
            <table className="cases-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th style={{ textAlign: "right" }}>Screenings</th>
                  <th>Risque</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--text-accent)",
                      }}
                    >
                      {c.count}
                    </td>
                    <td>
                      {c.risk === "HIGH" ? (
                        <span className="risk-badge high">High</span>
                      ) : c.risk === "MEDIUM" ? (
                        <span className="risk-badge medium">Medium</span>
                      ) : c.risk === "LOW" ? (
                        <span className="risk-badge low">Low</span>
                      ) : (
                        <span className="badge" style={{ opacity: 0.4 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="screen">
          <div className="h2" style={{ marginBottom: 12 }}>
            Alertes High Risk récentes
          </div>
          {recentHigh.length === 0 ? (
            <div className="small" style={{ opacity: 0.5 }}>
              Aucune alerte High Risk.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recentHigh.map((s, i) => {
                const name =
                  s.client_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="entity-avatar"
                      style={{ background: "rgba(232,64,64,0.15)", color: "#E84040" }}
                    >
                      {name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "var(--text-primary)",
                        }}
                      >
                        {name}
                      </div>
                      <div className="small" style={{ opacity: 0.5 }}>
                        {fmtDate(s.created_at)}
                      </div>
                    </div>
                    <span className="risk-badge high" style={{ fontSize: 11 }}>
                      High Risk
                    </span>
                    <Link
                      to={`/screenings/${s.id}`}
                      className="btn secondary sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <FileText size={14} strokeWidth={2.2} />
                      Voir
                    </Link>
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