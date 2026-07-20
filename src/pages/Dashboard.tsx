// Accueil — point de départ clair avec actions rapides et indicateurs.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home, UserPlus, AlertTriangle, ArrowLeftRight, Gauge, ClipboardList,
  ShieldCheck, Search, FolderOpen, ArrowRight,
} from "lucide-react";
import { getDashboardStats, listAlerts, type DashboardStats } from "../api";
import { Button, Card, CardTitle, PageHeader, StatCard, RiskBadge, Badge, EmptyState, SkeletonRows, fmtDate } from "../ui";

const QUICK = [
  { to: "/analyst", label: "Vérifier une personne", desc: "Contrôle KYC / listes de sanctions", icon: UserPlus, tone: "var(--brand-600)", tint: "var(--brand-50)" },
  { to: "/alerts", label: "Traiter les alertes", desc: "File de la Cellule de Conformité", icon: AlertTriangle, tone: "var(--risk-high)", tint: "var(--risk-high-bg)" },
  { to: "/transactions", label: "Surveiller les opérations", desc: "Détection des comportements atypiques", icon: ArrowLeftRight, tone: "var(--accent-500)", tint: "#e6f7f5" },
  { to: "/risk-scoring", label: "Évaluer un risque", desc: "Score et règles paramétrables", icon: Gauge, tone: "var(--risk-medium)", tint: "var(--risk-medium-bg)" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([getDashboardStats(), listAlerts({ status: "OPEN" })]);
        setStats(s); setOpenAlerts(Array.isArray(a) ? a.length : 0);
      } catch { /* silencieux */ }
      finally { setLoading(false); }
    })();
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div>
      <PageHeader icon={<Home size={22} />} title={greet}
        subtitle="Voici l'essentiel pour bien démarrer votre journée." />

      {/* Actions rapides */}
      <div className="ds-grid ds-grid-4">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Card key={q.to} hover style={{ cursor: "pointer" }} onClick={() => nav(q.to)}>
              <div className="ds-stat-ico" style={{ background: q.tint, color: q.tone, marginBottom: 12 }}><Icon size={20} /></div>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{q.label}</div>
              <div className="ds-small ds-muted" style={{ marginTop: 4 }}>{q.desc}</div>
              <div className="ds-row" style={{ color: q.tone, fontWeight: 650, fontSize: 13, marginTop: 12 }}>Ouvrir <ArrowRight size={14} /></div>
            </Card>
          );
        })}
      </div>

      {/* Indicateurs */}
      <div className="ds-grid ds-grid-4 ds-mt-24">
        {loading ? <SkeletonRows rows={2} /> : stats && (
          <>
            <StatCard icon={<ClipboardList size={20} />} value={stats.total_screenings} label="Vérifications effectuées" />
            <StatCard icon={<ShieldCheck size={20} />} value={stats.low_risk} label="Faible risque" tone="var(--risk-low)" tint="var(--risk-low-bg)" />
            <StatCard icon={<AlertTriangle size={20} />} value={stats.high_risk} label="Risque élevé" tone="var(--risk-high)" tint="var(--risk-high-bg)" />
            <StatCard icon={<AlertTriangle size={20} />} value={openAlerts} label="Alertes à traiter" tone="var(--risk-critical)" tint="var(--risk-critical-bg)"
              trend={<button className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => nav("/alerts")}>Voir <ArrowRight size={13} /></button>} />
          </>
        )}
      </div>

      {/* Activité récente */}
      <Card className="ds-mt-24" pad0>
        <div style={{ padding: "20px 22px 0" }}>
          <div className="ds-between">
            <CardTitle sub="Vos dernières vérifications.">Activité récente</CardTitle>
            <Button variant="ghost" size="sm" icon={<Search size={15} />} onClick={() => nav("/screenings")}>Tout voir</Button>
          </div>
        </div>
        {loading ? <SkeletonRows /> : !stats?.recent?.length ? (
          <EmptyState icon={<FolderOpen size={26} />} title="Rien à afficher pour l'instant"
            subtitle="Commencez par vérifier une personne."
            action={<Button icon={<UserPlus size={16} />} onClick={() => nav("/analyst")}>Vérifier une personne</Button>} />
        ) : (
          <div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr><th>Personne</th><th>Type</th><th>Niveau</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>
                {stats.recent.map((r) => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => nav(`/screenings/${r.id}`)}>
                    <td style={{ fontWeight: 600 }}>{r.client_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td><Badge tone="neutral">{/(KYS|KYB|COMPANY|ENTREPRISE)/i.test(String(r.kind || "")) ? "Personne morale" : "Personne physique"}</Badge></td>
                    <td>{r.risk_level ? <RiskBadge level={r.risk_level} /> : <span className="ds-small ds-muted">—</span>}</td>
                    <td className="ds-small">{String(r.status || "—")}</td>
                    <td className="ds-small ds-muted">{fmtDate(r.created_at)}</td>
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
