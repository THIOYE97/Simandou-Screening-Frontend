// Accueil Conformité — vue LBC/FT consolidée (Module 8 Reportings).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, RefreshCw, Download, AlertTriangle, Flame,
  ArrowLeftRight, FileWarning, Users, ArrowRight, Gauge,
} from "lucide-react";
import {
  getComplianceDashboard, getHighRiskSubjects, downloadHighRiskCsv,
  type ComplianceDashboard as Dash, type HighRiskSubject,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, StatCard, RiskBadge, EmptyState, SkeletonRows, useUI, fmtDate,
} from "../ui";

export default function ComplianceDashboard() {
  const nav = useNavigate();
  const { toast } = useUI();
  const [dash, setDash] = useState<Dash | null>(null);
  const [subjects, setSubjects] = useState<HighRiskSubject[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([getComplianceDashboard(), getHighRiskSubjects()]);
      setDash(d); setSubjects(s);
    } catch { toast("Impossible de charger le tableau de bord", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function exportCsv() {
    try {
      const blob = await downloadHighRiskCsv();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "personnes_a_risque.csv"; a.click();
      URL.revokeObjectURL(a.href);
      toast("Export téléchargé");
    } catch { toast("Échec de l'export", "error"); }
  }

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Tableau de bord Conformité"
        subtitle="Tout ce qui demande votre attention aujourd'hui, en un coup d'œil."
        actions={<Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>}
      />

      <div className="ds-grid ds-grid-4">
        {loading ? (
          <SkeletonRows rows={2} />
        ) : dash && (
          <>
            <StatCard icon={<AlertTriangle size={20} />} value={dash.open_alerts} label="Alertes à traiter"
              tone="var(--risk-high)" tint="var(--risk-high-bg)"
              trend={<button className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => nav("/alerts")}>Ouvrir <ArrowRight size={13} /></button>} />
            <StatCard icon={<Flame size={20} />} value={dash.critical_alerts} label="Alertes critiques"
              tone="var(--risk-critical)" tint="var(--risk-critical-bg)" />
            <StatCard icon={<ArrowLeftRight size={20} />} value={dash.transactions_total} label="Opérations analysées" />
            <StatCard icon={<FileWarning size={20} />} value={dash.sars_pending} label="Signalements en attente"
              tone="var(--risk-medium)" tint="var(--risk-medium-bg)" />
          </>
        )}
      </div>

      <Card className="ds-mt-24">
        <div className="ds-between" style={{ marginBottom: 8 }}>
          <CardTitle sub="Dernière évaluation par personne, classée « élevé » ou « très élevé ».">
            <Users size={18} /> Personnes à surveiller en priorité
          </CardTitle>
          <Button variant="secondary" size="sm" icon={<Download size={15} />} onClick={exportCsv} disabled={!subjects.length}>
            Exporter (CSV)
          </Button>
        </div>

        {loading ? <SkeletonRows /> : subjects.length === 0 ? (
          <EmptyState icon={<Users size={26} />} title="Aucune personne à risque élevé pour l'instant"
            subtitle="Lancez des évaluations depuis « Niveau de risque & Règles »."
            action={<Button icon={<Gauge size={16} />} onClick={() => nav("/risk-scoring")}>Évaluer une personne</Button>} />
        ) : (
          <div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr><th>Personne</th><th>Niveau</th><th>Score</th><th>Motifs</th><th>Évaluée le</th></tr></thead>
              <tbody>
                {subjects.map((s, i) => (
                  <tr key={s.subject_ref || i}>
                    <td style={{ fontWeight: 650 }}>{s.subject_label || s.subject_ref || "—"}</td>
                    <td><RiskBadge level={s.risk_class} /></td>
                    <td style={{ fontWeight: 750 }}>{s.total_score}<span className="ds-muted ds-small">/100</span></td>
                    <td className="ds-small ds-muted">{s.scenarios.join(", ") || "—"}</td>
                    <td className="ds-small ds-muted">{fmtDate(s.assessed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
