// Niveau de risque & Règles — évaluation (M7) + scénarios paramétrables (M1).
import { useEffect, useState } from "react";
import { Gauge, RefreshCw, Database, Play, Sparkles, SlidersHorizontal } from "lucide-react";
import {
  listScenarios, updateScenario, seedReferentiel, evaluateScoring,
  type RiskScenario, type Assessment,
} from "../api";
import { Button, Card, CardTitle, PageHeader, RiskBadge, Field, Input, Switch, EmptyState, useUI } from "../ui";

const CAT_WORD: Record<string, string> = {
  SANCTIONS: "Liste de sanctions", PEP: "Personne exposée", GEOGRAPHY: "Pays à risque",
  TRANSACTION: "Opération", BEHAVIOR: "Comportement", ADVERSE_MEDIA: "Presse négative",
};
const SEV_WORD: Record<string, string> = { LOW: "Mineure", MEDIUM: "Moyenne", HIGH: "Importante", CRITICAL: "Critique" };

export default function RiskScoring() {
  const { toast } = useUI();
  const [scenarios, setScenarios] = useState<RiskScenario[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [result, setResult] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState(false);

  const [label, setLabel] = useState("");
  const [ref, setRef] = useState("");
  const [matchScore, setMatchScore] = useState("");
  const [country, setCountry] = useState("");
  const [amount, setAmount] = useState("");
  const [isPep, setIsPep] = useState(false);
  const [adverse, setAdverse] = useState(false);

  async function loadScenarios() {
    try {
      const list = await listScenarios();
      setScenarios(list);
      setWeights(Object.fromEntries(list.map((s) => [s.id, String(s.risk_weight)])));
    }
    catch { toast("Impossible de charger les scénarios", "error"); }
  }
  useEffect(() => { loadScenarios(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(s: RiskScenario) {
    try { await updateScenario(s.id, { active: !s.active }); toast(s.active ? "Scénario désactivé" : "Scénario activé"); await loadScenarios(); }
    catch { toast("Modification réservée aux administrateurs", "error"); }
  }

  // Édition des points d'un scénario (poids) — sauvegarde à la validation.
  async function saveWeight(s: RiskScenario) {
    const raw = weights[s.id];
    const val = Math.max(0, Math.min(100, Math.round(Number(raw))));
    if (raw === "" || Number.isNaN(Number(raw))) { setWeights((w) => ({ ...w, [s.id]: String(s.risk_weight) })); return; }
    if (val === s.risk_weight) { setWeights((w) => ({ ...w, [s.id]: String(val) })); return; }
    setSavingId(s.id);
    try {
      await updateScenario(s.id, { risk_weight: val });
      toast(`« ${s.name} » : ${val} points`);
      await loadScenarios();
    } catch {
      toast("Modification réservée à la Conformité", "error");
      setWeights((w) => ({ ...w, [s.id]: String(s.risk_weight) }));
    } finally { setSavingId(null); }
  }
  async function seed() {
    try { await seedReferentiel(); toast("Référentiel chargé"); await loadScenarios(); }
    catch { toast("Action réservée aux administrateurs", "error"); }
  }

  async function evaluate() {
    setBusy(true); setResult(null);
    const context: Record<string, any> = {};
    if (matchScore) context.match_score = Number(matchScore);
    if (country) context.country = country.toUpperCase();
    if (amount) context.amount = Number(amount);
    if (isPep) context.is_pep = true;
    if (adverse) context.adverse_media_hit = true;
    try {
      const r = await evaluateScoring({ subject_type: "PERSON", subject_label: label || undefined, subject_ref: ref || undefined, context });
      setResult(r);
      toast(`Évaluation terminée : ${r.risk_class === "CRITICAL" ? "risque très élevé" : "score " + r.total_score}`);
    } catch { toast("Évaluation impossible", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        icon={<Gauge size={22} />}
        title="Niveau de risque & Règles"
        actions={<>
          <Button variant="secondary" icon={<Database size={16} />} onClick={seed}>Charger le référentiel</Button>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={loadScenarios}>Actualiser</Button>
        </>}
      />

      <div className="ds-grid ds-grid-2" style={{ alignItems: "start" }}>
        {/* Évaluateur */}
        <Card>
          <CardTitle sub="Renseignez ce que vous savez. Laissez vide ce que vous ignorez.">
            <Sparkles size={18} /> Évaluer une personne
          </CardTitle>
          <div className="ds-grid" style={{ gap: 12 }}>
            <Field label="Nom de la personne"><Input placeholder="ex. Jean Dupont" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Field label="Référence interne (facultatif)"><Input placeholder="ex. CLI-1024" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
              <Field label="Ressemblance avec une liste (0 à 100)" hint="0 = aucune, 100 = identique">
                <Input type="number" placeholder="0-100" value={matchScore} onChange={(e) => setMatchScore(e.target.value)} />
              </Field>
              <Field label="Pays (code, ex. FR, IR)"><Input placeholder="FR" value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
            </div>
            <Field label="Montant de l'opération (facultatif)"><Input type="number" placeholder="ex. 15000" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Switch checked={isPep} onChange={setIsPep} label="Personne politiquement exposée (élu, dirigeant public…)" />
            <Switch checked={adverse} onChange={setAdverse} label="Citée négativement dans la presse" />
          </div>
          <Button className="ds-mt-16" size="lg" icon={<Play size={17} />} onClick={evaluate} disabled={busy}>
            {busy ? "Analyse en cours…" : "Évaluer le risque"}
          </Button>

          {result && (
            <div className="ds-mt-24" style={{ padding: 18, borderRadius: "var(--r-lg)", background: "var(--surface-2)" }}>
              <div className="ds-row" style={{ gap: 16 }}>
                <RiskBadge level={result.risk_class} />
                <div style={{ fontSize: 30, fontWeight: 800 }}>{result.total_score}<span className="ds-muted" style={{ fontSize: 15 }}>/100</span></div>
              </div>
              <div className="ds-small ds-muted ds-mt-16" style={{ marginBottom: 6 }}>Ce qui a fait monter le risque :</div>
              {result.triggered.length === 0
                ? <div className="ds-small">Aucun facteur de risque particulier.</div>
                : <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {result.triggered.map((t) => <li key={t.code} style={{ fontSize: 13.5, marginBottom: 3 }}>{t.name} <span className="ds-muted">(+{t.weight})</span></li>)}
                  </ul>}
            </div>
          )}
        </Card>

        {/* Scénarios */}
        <Card>
          <CardTitle sub="Ajustez le nombre de points de chaque situation et activez/désactivez les alertes.">
            <SlidersHorizontal size={18} /> Règles de détection
          </CardTitle>
          {scenarios.length === 0 ? (
            <EmptyState icon={<Database size={24} />} title="Aucune règle configurée"
              subtitle="Cliquez sur « Charger le référentiel » pour partir d'une base standard." />
          ) : (
            <div className="ds-grid" style={{ gap: 10 }}>
              {scenarios.map((s) => (
                <div key={s.id} className="ds-between" style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{s.name}</div>
                    <div className="ds-small ds-muted">{CAT_WORD[s.category] || s.category} · gravité {SEV_WORD[s.severity]?.toLowerCase() || s.severity}</div>
                  </div>
                  <div className="ds-row" style={{ gap: 12, flexShrink: 0 }}>
                    <div className="ds-row" style={{ gap: 6 }} title="Points ajoutés au score si la règle se déclenche (0 à 100)">
                      <span className="ds-muted" style={{ fontSize: 15, fontWeight: 700 }}>+</span>
                      <Input
                        type="number" min={0} max={100}
                        style={{ width: 68, textAlign: "center", opacity: s.active ? 1 : 0.5 }}
                        value={weights[s.id] ?? String(s.risk_weight)}
                        disabled={savingId === s.id}
                        onChange={(e) => setWeights((w) => ({ ...w, [s.id]: e.target.value }))}
                        onBlur={() => saveWeight(s)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                      <span className="ds-muted ds-small">pts</span>
                    </div>
                    <Switch checked={s.active} onChange={() => toggle(s)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
