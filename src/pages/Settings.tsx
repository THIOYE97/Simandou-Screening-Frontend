// Réglages — paramétrage de la plateforme (devises, règles).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings2, Coins, RefreshCw, Plus, Search, Gauge, ShieldCheck, Globe2,
} from "lucide-react";
import {
  getCurrencies, createCurrency, updateCurrency, seedReferentiel, type Currency,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, Badge, Switch, Field, Input, Select,
  EmptyState, SkeletonRows, useUI,
} from "../ui";

function CurrencySettings() {
  const { toast } = useUI();
  const [items, setItems] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ code: "", name: "", symbol: "", region: "Afrique" });

  async function load() {
    setLoading(true);
    try { setItems(await getCurrencies(false)); }
    catch { toast("Impossible de charger les devises", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const regions = useMemo(() => Array.from(new Set(items.map((c) => c.region).filter(Boolean))) as string[], [items]);
  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return items.filter((c) =>
      (!region || c.region === region) &&
      (!nq || c.code.toLowerCase().includes(nq) || c.name.toLowerCase().includes(nq)));
  }, [items, q, region]);

  async function toggle(c: Currency) {
    try { await updateCurrency(c.id, { active: !c.active }); toast(c.active ? `${c.code} désactivée` : `${c.code} activée`); await load(); }
    catch { toast("Modification réservée aux administrateurs", "error"); }
  }
  async function add() {
    if (!nc.code || !nc.name) { toast("Code et nom requis", "error"); return; }
    try {
      await createCurrency({ code: nc.code.toUpperCase(), name: nc.name, symbol: nc.symbol || undefined, region: nc.region || undefined });
      toast(`Devise ${nc.code.toUpperCase()} ajoutée`); setNc({ code: "", name: "", symbol: "", region: "Afrique" }); setAdding(false); await load();
    } catch { toast("Ajout impossible (code déjà présent ?)", "error"); }
  }
  async function loadDefaults() {
    try { await seedReferentiel(); toast("Devises standard chargées"); await load(); }
    catch { toast("Action réservée aux administrateurs", "error"); }
  }

  const activeCount = items.filter((c) => c.active).length;

  return (
    <Card pad0>
      <div style={{ padding: "20px 22px" }}>
        <div className="ds-between">
          <CardTitle sub={`${activeCount} devise(s) active(s) sur ${items.length}. Le franc guinéen (GNF) et le FCFA sont inclus.`}>
            <Coins size={18} /> Devises acceptées
          </CardTitle>
          <div className="ds-row ds-wrap" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" icon={<Globe2 size={15} />} onClick={loadDefaults}>Charger les standards</Button>
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setAdding((v) => !v)}>Ajouter</Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>Actualiser</Button>
          </div>
        </div>

        {adding && (
          <div className="ds-grid ds-grid-4 ds-mt-16" style={{ gap: 10, alignItems: "end", padding: 14, background: "var(--surface-2)", borderRadius: "var(--r-md)" }}>
            <Field label="Code (3 lettres)"><Input maxLength={3} placeholder="GNF" value={nc.code} onChange={(e) => setNc({ ...nc, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Nom"><Input placeholder="Franc guinéen" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Field>
            <Field label="Symbole"><Input placeholder="FG" value={nc.symbol} onChange={(e) => setNc({ ...nc, symbol: e.target.value })} /></Field>
            <Button icon={<Plus size={15} />} onClick={add}>Enregistrer</Button>
          </div>
        )}

        <div className="ds-row ds-wrap ds-mt-16" style={{ gap: 10 }}>
          <div className="ds-input-ico" style={{ flex: 1, minWidth: 220 }}>
            <Search size={16} />
            <input className="ds-input" placeholder="Rechercher une devise…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: 220 }}>
            <option value="">Toutes les régions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
      </div>

      {loading ? <SkeletonRows rows={6} /> : filtered.length === 0 ? (
        <EmptyState icon={<Coins size={24} />} title="Aucune devise" subtitle="Cliquez sur « Charger les standards » pour partir d'une base complète." />
      ) : (
        <div className="ds-table-wrap" style={{ border: "none" }}>
          <table className="ds-table">
            <thead><tr><th>Code</th><th>Nom</th><th>Symbole</th><th>Région</th><th>Acceptée ?</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.code}</td>
                  <td>{c.name}</td>
                  <td className="ds-muted">{c.symbol || "—"}</td>
                  <td><Badge tone="neutral">{c.region || "—"}</Badge></td>
                  <td><Switch checked={c.active} onChange={() => toggle(c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function Settings() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader icon={<Settings2 size={22} />} title="Réglages"
        subtitle="Paramétrez la plateforme : devises acceptées, règles de risque et listes." />

      <div className="ds-grid ds-grid-3" style={{ marginBottom: 22 }}>
        <Card hover style={{ cursor: "pointer" }} onClick={() => nav("/risk-scoring")}>
          <div className="ds-stat-ico" style={{ background: "var(--brand-50)", color: "var(--brand-600)", marginBottom: 12 }}><Gauge size={20} /></div>
          <div style={{ fontWeight: 700 }}>Règles de risque</div>
          <div className="ds-small ds-muted" style={{ marginTop: 4 }}>Scénarios qui déclenchent les alertes.</div>
        </Card>
        <Card hover style={{ cursor: "pointer" }} onClick={() => nav("/watchlists")}>
          <div className="ds-stat-ico" style={{ background: "#e6f7f5", color: "var(--accent-500)", marginBottom: 12 }}><ShieldCheck size={20} /></div>
          <div style={{ fontWeight: 700 }}>Listes de surveillance</div>
          <div className="ds-small ds-muted" style={{ marginTop: 4 }}>Sanctions, PEP, listes nationales.</div>
        </Card>
        <Card hover style={{ cursor: "pointer" }} onClick={() => nav("/alerts")}>
          <div className="ds-stat-ico" style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)", marginBottom: 12 }}><Settings2 size={20} /></div>
          <div style={{ fontWeight: 700 }}>Règles d'alerte</div>
          <div className="ds-small ds-muted" style={{ marginTop: 4 }}>Gérées depuis l'écran Alertes.</div>
        </Card>
      </div>

      <CurrencySettings />
    </div>
  );
}
