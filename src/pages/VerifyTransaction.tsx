// Vérifier une transaction (KYT) — flow opérationnel, calqué sur « Vérifier une personne ».
import { useEffect, useState } from "react";
import {
  Banknote, Send, Sparkles, ListChecks, CheckCircle2, RefreshCw, ShieldAlert, ArrowRight, Search,
} from "lucide-react";
import { ingestTransaction, getCurrencies, type Currency, type IngestResult } from "../api";
import {
  Button, Card, CardTitle, PageHeader, RiskBadge, Field, Input, Select, useUI,
  SOURCE_LABEL, CHANNEL_LABEL,
} from "../ui";

const STEPS = [
  { icon: <Send size={16} />, label: "Renseignez l'opération", desc: "Montant, provenance, bénéficiaire." },
  { icon: <Sparkles size={16} />, label: "Lancez l'analyse", desc: "Détection des comportements atypiques." },
  { icon: <ListChecks size={16} />, label: "Consultez le résultat", desc: "Niveau de risque et motifs." },
  { icon: <ShieldAlert size={16} />, label: "En cas d'alerte", desc: "Le dossier part vers la Conformité." },
];

export default function VerifyTransaction() {
  const { toast } = useUI();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const [source, setSource] = useState("T24");
  const [channel, setChannel] = useState("WIRE");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GNF");
  const [customer, setCustomer] = useState("");
  const [cpName, setCpName] = useState("");
  const [cpCountry, setCpCountry] = useState("");

  useEffect(() => {
    getCurrencies(true).then((c) => { setCurrencies(c); if (c.find((x) => x.code === "GNF")) setCurrency("GNF"); else if (c[0]) setCurrency(c[0].code); }).catch(() => {});
  }, []);

  async function analyze() {
    if (!amount) { toast("Indiquez un montant", "error"); return; }
    setBusy(true); setResult(null);
    try {
      const res = await ingestTransaction({
        source_system: source, channel, amount: Number(amount), currency,
        customer_ref: customer || undefined, counterparty_name: cpName || undefined,
        counterparty_country: cpCountry || undefined,
      });
      setResult(res);
      toast(res.alerts_created > 0 ? `Opération analysée · ${res.alerts_created} alerte(s) transmise(s) à la Conformité` : "Opération analysée");
    } catch (e: any) { toast(e?.response?.data?.detail || "Analyse impossible", "error"); }
    finally { setBusy(false); }
  }

  function reset() {
    setResult(null); setAmount(""); setCustomer(""); setCpName(""); setCpCountry("");
  }

  return (
    <div>
      <PageHeader icon={<Banknote size={22} />} title="Vérifier une transaction"
        subtitle="Analysez une opération pour détecter un comportement atypique ou un risque." />

      <div className="ds-grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          {result ? (
            <Card>
              <CardTitle sub="Résultat de l'analyse de l'opération.">
                <CheckCircle2 size={18} style={{ color: "var(--ok)" }} /> Résultat
              </CardTitle>
              <div className="ds-row" style={{ gap: 16, margin: "8px 0 4px" }}>
                <RiskBadge level={result.risk_class} />
                <span style={{ fontSize: 26, fontWeight: 800 }}>{result.total_score}<span className="ds-muted" style={{ fontSize: 14 }}>/100</span></span>
              </div>
              {result.triggered.length > 0 && (
                <>
                  <div className="ds-section-label"><ListChecks size={13} style={{ verticalAlign: -2 }} /> Ce qui a été détecté</div>
                  {result.triggered.map((t) => (
                    <div key={t.code} className="ds-reason">{t.name}<span className="ds-muted ds-small" style={{ marginLeft: "auto" }}>+{t.weight}</span></div>
                  ))}
                </>
              )}
              <div className="ds-reason ds-mt-16" style={{ borderLeftColor: result.alerts_created ? "var(--risk-high)" : "var(--ok)" }}>
                {result.alerts_created > 0
                  ? <><ShieldAlert size={15} style={{ color: "var(--risk-high)" }} /> {result.alerts_created} alerte(s) transmise(s) à la Conformité pour décision.</>
                  : <><CheckCircle2 size={15} style={{ color: "var(--ok)" }} /> Aucune alerte — opération conforme.</>}
              </div>
              <div className="ds-row ds-mt-16" style={{ gap: 10 }}>
                <Button icon={<RefreshCw size={16} />} onClick={reset}>Analyser une autre opération</Button>
              </div>
            </Card>
          ) : (
            <Card>
              <CardTitle sub="Renseignez l'opération à contrôler.">Informations de l'opération</CardTitle>
              <div className="ds-grid" style={{ gap: 12 }}>
                <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
                  <Field label="Provenance"><Select value={source} onChange={(e) => setSource(e.target.value)}>
                    {Object.keys(SOURCE_LABEL).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
                  </Select></Field>
                  <Field label="Moyen"><Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                    {Object.keys(CHANNEL_LABEL).map((s) => <option key={s} value={s}>{CHANNEL_LABEL[s]}</option>)}
                  </Select></Field>
                </div>
                <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
                  <Field label="Montant"><Input type="number" placeholder="ex. 15000000" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                  <Field label="Devise">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {currencies.length === 0 && <option value={currency}>{currency}</option>}
                      {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Client concerné (réf. ou nom)"><Input placeholder="ex. Moussa Camara" value={customer} onChange={(e) => setCustomer(e.target.value)} /></Field>
                <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
                  <Field label="Bénéficiaire"><Input placeholder="ex. Adama Diarra" value={cpName} onChange={(e) => setCpName(e.target.value)} /></Field>
                  <Field label="Pays bénéficiaire" hint="Nom ou code (ex. Mali, ML)"><Input placeholder="ex. Mali" value={cpCountry} onChange={(e) => setCpCountry(e.target.value)} /></Field>
                </div>
              </div>
              <Button className="ds-mt-16" size="lg" icon={<Search size={17} />} onClick={analyze} disabled={busy || !amount}>
                {busy ? "Analyse en cours…" : "Analyser l'opération"}
              </Button>
            </Card>
          )}
        </div>

        <div className="ds-grid" style={{ gap: 16 }}>
          <Card>
            <CardTitle>Comment ça marche</CardTitle>
            <div className="ds-grid" style={{ gap: 14, marginTop: 6 }}>
              {STEPS.map((s, i) => (
                <div key={i} className="ds-row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <div className="ds-stat-ico" style={{ width: 34, height: 34, background: "var(--brand-50)", color: "var(--brand-600)", margin: 0 }}>{s.icon}</div>
                  <div><div style={{ fontWeight: 650, fontSize: 14 }}>{s.label}</div><div className="ds-small ds-muted">{s.desc}</div></div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
            <div className="ds-row" style={{ gap: 10, alignItems: "flex-start" }}>
              <ArrowRight size={18} style={{ color: "var(--brand-600)", marginTop: 2 }} />
              <div className="ds-small">La <b>décision</b> sur une opération à risque appartient à la <b>Conformité</b> : toute alerte générée y est transmise automatiquement.</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
