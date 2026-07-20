// Bénéficiaires effectifs — registre interne, chaîne de détention et filtrage.
import { useEffect, useState } from "react";
import {
  Network, Plus, RefreshCw, Search, Trash2, ShieldAlert, ShieldCheck, Building2,
  User, ChevronRight, CornerDownRight, Loader2, CheckCircle2,
} from "lucide-react";
import {
  listUboDeclarations, createUboDeclaration, deleteUboDeclaration,
  addUboMember, deleteUboMember, screenUboDeclaration,
  type UboDeclaration, type UboMember, type UboScreenResult,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, RiskBadge, Badge, Field, Input, Select,
  EmptyState, SkeletonRows, useUI, fmtDate,
} from "../ui";

const CONTROL_LABEL: Record<string, string> = {
  CAPITAL: "Détention du capital",
  VOTING_RIGHTS: "Droits de vote",
  EFFECTIVE_CONTROL: "Contrôle par autre moyen",
  LEGAL_REPRESENTATIVE: "Représentant légal",
};

/** Un maillon de la chaîne, indenté selon sa profondeur. */
function MemberRow({ m, depth, onDelete }: { m: UboMember; depth: number; onDelete: () => void }) {
  const matched = (m.matches?.length ?? 0) > 0;
  return (
    <div style={{
      padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
      marginBottom: 8, marginLeft: depth * 26,
      borderLeftWidth: m.is_beneficial_owner ? 3 : 1,
      borderLeftColor: m.is_beneficial_owner ? "var(--brand-600)" : "var(--border)",
    }}>
      <div className="ds-between" style={{ gap: 10 }}>
        <div className="ds-row" style={{ gap: 8, minWidth: 0 }}>
          {depth > 0 && <CornerDownRight size={14} className="ds-muted" />}
          {m.kind === "ENTITY" ? <Building2 size={15} /> : <User size={15} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 14 }}>{m.full_name}</div>
            <div className="ds-small ds-muted">
              {CONTROL_LABEL[m.control_nature] || m.control_nature}
              {m.ownership_percent != null && <> · {m.ownership_percent}% déclarés</>}
              {m.nationality && <> · {m.nationality}</>}
            </div>
          </div>
        </div>
        <div className="ds-row" style={{ gap: 8, flexShrink: 0 }}>
          {m.is_beneficial_owner && <Badge tone="info">Bénéficiaire effectif</Badge>}
          {m.screened_at && (matched
            ? <Badge tone="critical"><ShieldAlert size={13} /> {m.matches.length} correspondance(s)</Badge>
            : <Badge tone="low"><ShieldCheck size={13} /> Aucune correspondance</Badge>)}
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={onDelete} />
        </div>
      </div>

      {/* Détention réelle : ce que la chaîne donne une fois aplatie. */}
      {depth > 0 && m.ownership_percent != null && (
        <div className="ds-small ds-muted" style={{ marginTop: 6 }}>
          Détention effective sur la société : <b style={{ color: "var(--text)" }}>{m.effective_percent}%</b>
          {m.is_beneficial_owner ? " — au-dessus du seuil de 25%" : " — sous le seuil de 25%"}
        </div>
      )}
      {matched && (
        <div className="ds-small ds-muted" style={{ marginTop: 6 }}>
          Rapproché de <b style={{ color: "var(--text)" }}>{m.matches[0].name}</b>
          {m.matches[0].source ? <> · {m.matches[0].source}</> : null}
          {m.match_score ? <> · similarité {m.match_score}%</> : null}
          {m.is_pep ? <> · <b>personne politiquement exposée</b></> : null}
        </div>
      )}
    </div>
  );
}

/** Rend la chaîne de détention en arbre (parent → enfants). */
function Chain({ members, onDelete }: { members: UboMember[]; onDelete: (id: string) => void }) {
  const rows: Array<{ m: UboMember; depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    members.filter((m) => (m.parent_id ?? null) === parent).forEach((m) => {
      rows.push({ m, depth });
      walk(m.id, depth + 1);
    });
  };
  walk(null, 0);
  return <>{rows.map(({ m, depth }) => (
    <MemberRow key={m.id} m={m} depth={depth} onDelete={() => onDelete(m.id)} />
  ))}</>;
}

export default function BeneficialOwners() {
  const { toast, confirm } = useUI();
  const [decls, setDecls] = useState<UboDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UboDeclaration | null>(null);
  const [screening, setScreening] = useState(false);
  const [result, setResult] = useState<UboScreenResult | null>(null);

  // Création d'une déclaration
  const [showNew, setShowNew] = useState(false);
  const [coName, setCoName] = useState("");
  const [coRef, setCoRef] = useState("");
  const [coCountry, setCoCountry] = useState("");

  // Ajout d'un maillon
  const [mName, setMName] = useState("");
  const [mKind, setMKind] = useState("PERSON");
  const [mParent, setMParent] = useState("");
  const [mPercent, setMPercent] = useState("");
  const [mNat, setMNat] = useState("");
  const [mControl, setMControl] = useState("CAPITAL");

  async function load() {
    setLoading(true);
    try { setDecls(await listUboDeclarations()); }
    catch { toast("Impossible de charger les déclarations", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(d: UboDeclaration) { setSelected(d); setResult(null); }

  async function createDecl() {
    if (!coName.trim()) { toast("Indiquez la dénomination", "error"); return; }
    try {
      const d = await createUboDeclaration({
        company_name: coName.trim(), company_ref: coRef || undefined,
        company_country: coCountry || undefined, members: [],
      });
      toast("Déclaration créée");
      setCoName(""); setCoRef(""); setCoCountry(""); setShowNew(false);
      await load(); setSelected(d);
    } catch { toast("Création impossible (droits Conformité requis)", "error"); }
  }

  async function addMember() {
    if (!selected || !mName.trim()) { toast("Indiquez un nom", "error"); return; }
    try {
      await addUboMember(selected.id, {
        full_name: mName.trim(), kind: mKind,
        parent_id: mParent || undefined,
        ownership_percent: mPercent ? Number(mPercent) : undefined,
        nationality: mNat || undefined, control_nature: mControl,
      });
      setMName(""); setMPercent(""); setMNat("");
      const fresh = (await listUboDeclarations()).find((x) => x.id === selected.id);
      if (fresh) setSelected(fresh);
      await load();
      toast("Maillon ajouté");
    } catch { toast("Ajout impossible", "error"); }
  }

  async function removeMember(id: string) {
    if (!selected) return;
    if (!(await confirm({ title: "Retirer ce maillon ?", message: "Les maillons qu'il détient seront également retirés.", confirmLabel: "Retirer" }))) return;
    try {
      await deleteUboMember(id);
      const fresh = (await listUboDeclarations()).find((x) => x.id === selected.id);
      if (fresh) setSelected(fresh);
      await load();
    } catch { toast("Suppression impossible", "error"); }
  }

  async function removeDecl(d: UboDeclaration) {
    if (!(await confirm({ title: `Supprimer « ${d.company_name} » ?`, message: "La déclaration et sa chaîne de détention seront supprimées.", confirmLabel: "Supprimer", danger: true }))) return;
    try { await deleteUboDeclaration(d.id); setSelected(null); await load(); toast("Déclaration supprimée"); }
    catch { toast("Suppression impossible", "error"); }
  }

  async function screen() {
    if (!selected) return;
    setScreening(true); setResult(null);
    try {
      const r = await screenUboDeclaration(selected.id);
      setResult(r);
      const fresh = (await listUboDeclarations()).find((x) => x.id === selected.id);
      if (fresh) setSelected(fresh);
      toast(r.alerts_created > 0
        ? `${r.alerts_created} alerte(s) transmise(s) à la Conformité`
        : "Filtrage terminé · aucune alerte");
    } catch { toast("Filtrage impossible", "error"); }
    finally { setScreening(false); }
  }

  const owners = selected?.members.filter((m) => m.is_beneficial_owner) ?? [];

  return (
    <div>
      <PageHeader
        icon={<Network size={22} />}
        title="Bénéficiaires effectifs"
        subtitle="Déclarez la chaîne de détention d'une personne morale et filtrez chaque bénéficiaire contre les listes."
        actions={<>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>
          <Button icon={<Plus size={16} />} onClick={() => setShowNew((v) => !v)}>Nouvelle déclaration</Button>
        </>}
      />

      {showNew && (
        <Card className="ds-mb-16">
          <CardTitle sub="La personne morale dont on déclare les bénéficiaires effectifs.">Nouvelle déclaration</CardTitle>
          <div className="ds-grid ds-grid-3" style={{ gap: 12 }}>
            <Field label="Dénomination sociale"><Input placeholder="ex. Simandou Mining SA" value={coName} onChange={(e) => setCoName(e.target.value)} /></Field>
            <Field label="Identifiant (RCCM, NIF)"><Input placeholder="ex. RCCM-GN-2026-B-001" value={coRef} onChange={(e) => setCoRef(e.target.value)} /></Field>
            <Field label="Pays" hint="Code ou nom"><Input placeholder="ex. GN" value={coCountry} onChange={(e) => setCoCountry(e.target.value)} /></Field>
          </div>
          <Button className="ds-mt-16" onClick={createDecl}>Créer la déclaration</Button>
        </Card>
      )}

      <div className="ds-grid" style={{ gridTemplateColumns: "1fr 1.7fr", gap: 20, alignItems: "start" }}>
        {/* Liste des déclarations */}
        <Card pad0>
          {loading ? <SkeletonRows rows={5} /> : decls.length === 0 ? (
            <EmptyState icon={<Network size={26} />} title="Aucune déclaration"
              subtitle="Créez une déclaration pour enregistrer la chaîne de détention d'une société." />
          ) : (
            <div>
              {decls.map((d) => (
                <div key={d.id} onClick={() => open(d)}
                  className="ds-between"
                  style={{
                    padding: "12px 14px", cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: selected?.id === d.id ? "var(--surface-2)" : undefined,
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{d.company_name}</div>
                    <div className="ds-small ds-muted">
                      {d.members.filter((m) => m.is_beneficial_owner).length} bénéficiaire(s) effectif(s)
                      {d.last_screened_at ? ` · filtré le ${fmtDate(d.last_screened_at)}` : " · jamais filtré"}
                    </div>
                  </div>
                  <ChevronRight size={16} className="ds-muted" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Détail */}
        {selected ? (
          <div className="ds-grid" style={{ gap: 16 }}>
            <Card>
              <div className="ds-between" style={{ gap: 12, marginBottom: 4 }}>
                <CardTitle sub={[selected.company_ref, selected.company_country].filter(Boolean).join(" · ") || "Chaîne de détention"}>
                  {selected.company_name}
                </CardTitle>
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => removeDecl(selected)} />
              </div>

              {selected.members.length === 0
                ? <EmptyState icon={<Network size={22} />} title="Chaîne vide"
                    subtitle="Ajoutez les détenteurs directs, puis leurs propres détenteurs pour reconstituer la chaîne." />
                : <Chain members={selected.members} onDelete={removeMember} />}

              <div className="ds-row ds-wrap ds-mt-16" style={{ gap: 10 }}>
                <Button icon={screening ? <Loader2 size={16} style={{ animation: "ds-spin 1.2s linear infinite" }} /> : <Search size={16} />}
                  onClick={screen} disabled={screening || selected.members.length === 0}>
                  {screening ? "Filtrage en cours…" : "Filtrer contre les listes"}
                </Button>
                <span className="ds-small ds-muted">
                  {owners.length} bénéficiaire(s) effectif(s) retenu(s) sur {selected.members.length} maillon(s)
                </span>
              </div>
            </Card>

            {/* Résultat du filtrage */}
            {result && (
              <Card>
                <CardTitle sub="Le risque porte sur la personne morale : un bénéficiaire effectif listé rend la société à risque.">
                  <CheckCircle2 size={18} style={{ color: "var(--ok)" }} /> Résultat du filtrage
                </CardTitle>
                <div className="ds-row" style={{ gap: 16, margin: "8px 0 4px" }}>
                  <RiskBadge level={result.risk_class} />
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{result.total_score}<span className="ds-muted" style={{ fontSize: 14 }}>/100</span></span>
                </div>
                {result.triggered.length > 0 && (
                  <>
                    <div className="ds-section-label">Ce qui a été détecté</div>
                    {result.triggered.map((t) => (
                      <div key={t.code} className="ds-reason">{t.name}<span className="ds-muted ds-small" style={{ marginLeft: "auto" }}>+{t.weight}</span></div>
                    ))}
                  </>
                )}
                <div className="ds-reason ds-mt-16" style={{ borderLeftColor: result.alerts_created ? "var(--risk-high)" : "var(--ok)" }}>
                  {result.alerts_created > 0
                    ? <><ShieldAlert size={15} style={{ color: "var(--risk-high)" }} /> {result.alerts_created} alerte(s) transmise(s) à la Conformité.</>
                    : <><ShieldCheck size={15} style={{ color: "var(--ok)" }} /> Aucun bénéficiaire effectif ne figure sur les listes.</>}
                </div>
              </Card>
            )}

            {/* Ajout d'un maillon */}
            <Card>
              <CardTitle sub="Laissez « détenteur direct » pour un actionnaire de la société elle-même.">Ajouter un maillon</CardTitle>
              <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
                <Field label="Nom / dénomination"><Input placeholder="ex. Mamadou Diallo" value={mName} onChange={(e) => setMName(e.target.value)} /></Field>
                <Field label="Nature">
                  <Select value={mKind} onChange={(e) => setMKind(e.target.value)}>
                    <option value="PERSON">Personne physique</option>
                    <option value="ENTITY">Personne morale</option>
                  </Select>
                </Field>
                <Field label="Détient" hint="Le maillon dont il est actionnaire">
                  <Select value={mParent} onChange={(e) => setMParent(e.target.value)}>
                    <option value="">La société déclarée (détenteur direct)</option>
                    {selected.members.filter((m) => m.kind === "ENTITY").map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Pourcentage détenu"><Input type="number" min={0} max={100} placeholder="ex. 60" value={mPercent} onChange={(e) => setMPercent(e.target.value)} /></Field>
                <Field label="Nationalité / pays"><Input placeholder="ex. GN" value={mNat} onChange={(e) => setMNat(e.target.value)} /></Field>
                <Field label="Nature du contrôle">
                  <Select value={mControl} onChange={(e) => setMControl(e.target.value)}>
                    {Object.keys(CONTROL_LABEL).map((k) => <option key={k} value={k}>{CONTROL_LABEL[k]}</option>)}
                  </Select>
                </Field>
              </div>
              <Button className="ds-mt-16" icon={<Plus size={16} />} onClick={addMember}>Ajouter</Button>
            </Card>
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Network size={26} />} title="Sélectionnez une déclaration"
              subtitle="Choisissez une société à gauche pour consulter et compléter sa chaîne de détention." />
          </Card>
        )}
      </div>
    </div>
  );
}
