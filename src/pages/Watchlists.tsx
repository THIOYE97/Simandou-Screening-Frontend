// Listes de surveillance — sources de sanctions + recherche d'entités.
import { useEffect, useState } from "react";
import { Radio, RefreshCw, Search, Globe, Landmark, Newspaper, ShieldAlert } from "lucide-react";
import api from "../api";
import { Button, Card, CardTitle, PageHeader, Badge, EmptyState, SkeletonRows, useUI } from "../ui";

type Source = { id?: number | string; code?: string; name?: string; entity_count?: number | string; status?: string; last_updated?: string | null };

const SOURCE_ICON: Record<string, React.ReactNode> = {
  OFAC: <Globe size={18} />, UN: <Globe size={18} />, EU: <Globe size={18} />,
  PEP: <Landmark size={18} />, ADVERSE: <Newspaper size={18} />,
};

export default function Watchlists() {
  const { toast } = useUI();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/settings/sources");
      setSources(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      // repli : sources standard connues
      setSources([
        { code: "OFAC", name: "OFAC — Trésor américain", status: "active" },
        { code: "UN", name: "Nations Unies (ONU)", status: "active" },
        { code: "EU", name: "Union Européenne", status: "active" },
        { code: "PEP", name: "Personnes politiquement exposées", status: "active" },
      ]);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get("/admin/entities/search", { params: { q: q.trim(), limit: 25 } });
      setResults(Array.isArray(data) ? data : (data?.items ?? []));
    } catch { toast("Recherche indisponible", "error"); setResults([]); }
    finally { setSearching(false); }
  }

  return (
    <div>
      <PageHeader icon={<Radio size={22} />} title="Listes de surveillance"
        actions={<Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>} />

      <div className="ds-grid ds-grid-4">
        {loading ? <SkeletonRows rows={2} /> : sources.map((s, i) => (
          <Card key={s.code || i} hover>
            <div className="ds-stat-ico" style={{ background: "var(--brand-50)", color: "var(--brand-600)", marginBottom: 12 }}>
              {SOURCE_ICON[String(s.code || "").toUpperCase()] || <ShieldAlert size={18} />}
            </div>
            <div style={{ fontWeight: 700 }}>{s.name || s.code}</div>
            <div className="ds-row" style={{ marginTop: 8, gap: 8 }}>
              <Badge tone={String(s.status).toLowerCase() === "active" ? "low" : "neutral"}>
                {String(s.status).toLowerCase() === "active" ? "Active" : (s.status || "—")}
              </Badge>
              {s.entity_count != null && <span className="ds-small ds-muted">{s.entity_count} entrées</span>}
            </div>
          </Card>
        ))}
      </div>

      <Card className="ds-mt-24" pad0>
        <div style={{ padding: "20px 22px" }}>
          <CardTitle sub="Recherchez un nom pour voir s'il figure sur une liste de surveillance.">
            <Search size={18} /> Rechercher dans les listes
          </CardTitle>
          <div className="ds-row ds-wrap ds-mt-16" style={{ gap: 10 }}>
            <div className="ds-input-ico" style={{ flex: 1, minWidth: 240 }}>
              <Search size={16} />
              <input className="ds-input" placeholder="Nom d'une personne ou entité…" value={q}
                onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            </div>
            <Button icon={<Search size={16} />} onClick={search}>Rechercher</Button>
          </div>
        </div>

        {searching ? <SkeletonRows rows={4} /> : results.length === 0 ? (
          <EmptyState icon={<Search size={22} />} title={q ? "Aucune correspondance" : "Lancez une recherche"}
            subtitle={q ? "Aucune entité trouvée pour ce nom." : "Tapez un nom puis appuyez sur Entrée."} />
        ) : (
          <div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr><th>Nom</th><th>Type</th><th>Source</th><th>Pays</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id || i}>
                    <td style={{ fontWeight: 600 }}>{r.name || r.full_name || r.entity_name || "—"}</td>
                    <td className="ds-small ds-muted">{r.entity_type || r.type || "—"}</td>
                    <td className="ds-small">{r.source || r.source_name || "—"}</td>
                    <td className="ds-small">{r.country || r.nationality || "—"}</td>
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
