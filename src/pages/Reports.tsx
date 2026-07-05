// Rapports — synthèse analytique de l'activité de conformité.
import { useEffect, useMemo, useState } from "react";
import { FileBarChart, RefreshCw, ClipboardList, FolderOpen, ShieldCheck, AlertTriangle } from "lucide-react";
import { listScreenings, listCases, type ScreeningListItem, type CaseOut } from "../api";
import { Button, Card, CardTitle, PageHeader, StatCard, RiskBadge, EmptyState, SkeletonRows, fmtDate } from "../ui";

const RISK_COLOR: Record<string, string> = { LOW: "var(--risk-low)", MEDIUM: "var(--risk-medium)", HIGH: "var(--risk-high)", CRITICAL: "var(--risk-critical)" };

export default function Reports() {
  const [screenings, setScreenings] = useState<ScreeningListItem[]>([]);
  const [cases, setCases] = useState<CaseOut[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [s, c] = await Promise.allSettled([listScreenings({ limit: 200, offset: 0 }), listCases({})]);
    setScreenings(s.status === "fulfilled" ? s.value.items : []);
    setCases(c.status === "fulfilled" ? c.value : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dist = useMemo(() => {
    const acc: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    cases.forEach((c) => { const r = String(c.risk_level || "").toUpperCase(); if (acc[r] !== undefined) acc[r]++; });
    return acc;
  }, [cases]);
  const totalRisk = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const done = screenings.filter((s) => String(s.status || "").toUpperCase() === "DONE").length;

  return (
    <div>
      <PageHeader icon={<FileBarChart size={22} />} title="Rapports"
        subtitle="Synthèse de l'activité de conformité : volumes, niveaux de risque et suivi."
        actions={<Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>} />

      <div className="ds-grid ds-grid-4">
        {loading ? <SkeletonRows rows={2} /> : <>
          <StatCard icon={<ClipboardList size={20} />} value={screenings.length} label="Vérifications" />
          <StatCard icon={<ShieldCheck size={20} />} value={done} label="Terminées" tone="var(--risk-low)" tint="var(--risk-low-bg)" />
          <StatCard icon={<FolderOpen size={20} />} value={cases.length} label="Dossiers ouverts" />
          <StatCard icon={<AlertTriangle size={20} />} value={dist.HIGH + dist.CRITICAL} label="Dossiers à risque élevé" tone="var(--risk-high)" tint="var(--risk-high-bg)" />
        </>}
      </div>

      <div className="ds-grid ds-grid-2 ds-mt-24" style={{ alignItems: "start" }}>
        <Card>
          <CardTitle sub="Répartition des dossiers par niveau de risque.">Niveaux de risque</CardTitle>
          {loading ? <SkeletonRows rows={4} /> : totalRisk === 1 && dist.LOW === 0 ? (
            <EmptyState icon={<FolderOpen size={22} />} title="Pas encore de données" subtitle="Les dossiers évalués apparaîtront ici." />
          ) : (
            <div className="ds-grid" style={{ gap: 14, marginTop: 8 }}>
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((k) => {
                const pct = Math.round((dist[k] / totalRisk) * 100);
                return (
                  <div key={k}>
                    <div className="ds-between" style={{ marginBottom: 5 }}>
                      <RiskBadge level={k} /><span className="ds-small ds-muted">{dist[k]} · {pct}%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: RISK_COLOR[k], borderRadius: 999, transition: "width .5s var(--ease)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card pad0>
          <div style={{ padding: "20px 22px 0" }}><CardTitle sub="Dernières vérifications enregistrées.">Activité récente</CardTitle></div>
          {loading ? <SkeletonRows /> : screenings.length === 0 ? (
            <EmptyState icon={<ClipboardList size={22} />} title="Aucune activité" />
          ) : (
            <div className="ds-table-wrap" style={{ border: "none" }}>
              <table className="ds-table">
                <thead><tr><th>Personne</th><th>Niveau</th><th>Date</th></tr></thead>
                <tbody>
                  {screenings.slice(0, 8).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.client_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                      <td>{r.risk_level ? <RiskBadge level={r.risk_level} /> : <span className="ds-small ds-muted">—</span>}</td>
                      <td className="ds-small ds-muted">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
