// Fuites offshore (ICIJ) — consultation à la demande, hors filtrage automatique.
import { useEffect, useState } from "react";
import {
  Waves, Search, Info, Building2, User, Briefcase, AlertTriangle,
} from "lucide-react";
import {
  searchOffshore, getOffshoreStats,
  type OffshoreHit, type OffshoreStats,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, Badge, Field, Input, Select,
  EmptyState, SkeletonRows, StatCard, useUI,
} from "../ui";

const KIND_LABEL: Record<string, string> = {
  OFFICER: "Détenteur / dirigeant",
  ENTITY: "Société offshore",
  INTERMEDIARY: "Intermédiaire",
};
const KIND_ICON: Record<string, JSX.Element> = {
  OFFICER: <User size={13} />,
  ENTITY: <Building2 size={13} />,
  INTERMEDIARY: <Briefcase size={13} />,
};

function scoreTone(s: number): "low" | "medium" | "high" | "critical" {
  if (s >= 85) return "critical"; if (s >= 65) return "high";
  if (s >= 45) return "medium"; return "low";
}

export default function Offshore() {
  const { toast } = useUI();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [hits, setHits] = useState<OffshoreHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<OffshoreStats | null>(null);
  const [caveat, setCaveat] = useState("");
  const [attribution, setAttribution] = useState("");

  useEffect(() => {
    getOffshoreStats().then((s) => { setStats(s); setAttribution(s.attribution); }).catch(() => {});
  }, []);

  async function run() {
    if (q.trim().length < 3) { toast("Saisissez au moins 3 caractères", "error"); return; }
    setBusy(true);
    try {
      const r = await searchOffshore(q.trim(), kind || undefined);
      setHits(r.results); setCaveat(r.caveat); setAttribution(r.attribution);
      if (r.results.length === 0) toast("Aucune correspondance");
    } catch { toast("Recherche impossible", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        icon={<Waves size={22} />}
        title="Fuites offshore"
        subtitle="Recherchez un nom dans les structures offshore révélées par les enquêtes journalistiques."
      />

      {/* L'avertissement précède les résultats : un analyste ne doit jamais
          découvrir une correspondance avant d'en connaître la portée. */}
      <Card className="ds-mb-16" style={{ background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
        <div className="ds-row" style={{ gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={18} style={{ color: "var(--risk-high)", marginTop: 2, flexShrink: 0 }} />
          <div className="ds-small" style={{ lineHeight: 1.55 }}>
            <b>Ces correspondances sont des pistes d'enquête, pas des motifs de blocage.</b>{" "}
            Détenir une société offshore n'est pas illicite. Ces données s'arrêtent en 2020 :
            une correspondance signale une structure ayant <b>existé</b>, jamais une situation actuelle.
            Elles n'interviennent pas dans le filtrage automatique des vérifications.
          </div>
        </div>
      </Card>

      {stats && stats.total > 0 && (
        <div className="ds-grid ds-grid-4" style={{ marginBottom: 20 }}>
          <StatCard icon={<User size={20} />} value={(stats.by_kind.OFFICER ?? 0).toLocaleString("fr-FR")} label="Détenteurs / dirigeants" />
          <StatCard icon={<Building2 size={20} />} value={(stats.by_kind.ENTITY ?? 0).toLocaleString("fr-FR")} label="Sociétés offshore" />
          <StatCard icon={<Briefcase size={20} />} value={(stats.by_kind.INTERMEDIARY ?? 0).toLocaleString("fr-FR")} label="Intermédiaires" />
          <StatCard icon={<Waves size={20} />} value={stats.total.toLocaleString("fr-FR")} label="Enregistrements" />
        </div>
      )}

      <Card className="ds-mb-16">
        <CardTitle sub="La recherche tolère les variantes d'orthographe et de translittération.">
          Rechercher un nom
        </CardTitle>
        <div className="ds-row ds-wrap" style={{ gap: 12, alignItems: "flex-end" }}>
          <Field label="Nom ou dénomination">
            <Input placeholder="ex. Moussa Camara" value={q} style={{ minWidth: 280 }}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") run(); }} />
          </Field>
          <Field label="Nature">
            <Select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 220 }}>
              <option value="">Toutes</option>
              {Object.keys(KIND_LABEL).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Button icon={<Search size={16} />} onClick={run} disabled={busy}>
            {busy ? "Recherche…" : "Rechercher"}
          </Button>
        </div>
      </Card>

      {busy ? <SkeletonRows rows={5} /> : hits === null ? null : hits.length === 0 ? (
        <Card>
          <EmptyState icon={<Search size={26} />} title="Aucune correspondance"
            subtitle="Ce nom n'apparaît dans aucune des structures offshore recensées." />
        </Card>
      ) : (
        <Card pad0>
          <div style={{ padding: "18px 22px 0" }}>
            <CardTitle sub={caveat}>{hits.length} correspondance(s)</CardTitle>
          </div>
          <div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr><th>Nom</th><th>Nature</th><th>Enquête</th><th>Juridiction</th><th>Pays</th><th>Ressemblance</th></tr></thead>
              <tbody>
                {hits.map((h) => (
                  <tr key={`${h.kind}-${h.node_id}`}>
                    <td style={{ fontWeight: 650 }}>{h.name}</td>
                    <td><Badge tone="neutral">{KIND_ICON[h.kind]} {KIND_LABEL[h.kind] || h.kind}</Badge></td>
                    <td className="ds-small ds-muted">{h.investigation || "—"}</td>
                    <td className="ds-small ds-muted">{h.jurisdiction || "—"}</td>
                    <td className="ds-small ds-muted">{h.countries || "—"}</td>
                    <td><Badge tone={scoreTone(h.score)}>{h.score}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Attribution imposée par la licence de la source. */}
      {attribution && (
        <div className="ds-row ds-small ds-muted" style={{ gap: 8, marginTop: 18, lineHeight: 1.5 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{attribution}</span>
        </div>
      )}
    </div>
  );
}
