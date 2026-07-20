// Vérifier une transaction (KYT) — flow opérationnel, calqué sur « Vérifier une personne ».
import { useEffect, useRef, useState } from "react";
import {
  Banknote, Send, Sparkles, ListChecks, CheckCircle2, RefreshCw, ShieldAlert, ArrowRight, Search,
  Download, UserCheck, Loader2,
} from "lucide-react";
import {
  ingestTransaction, getCurrencies, downloadTransactionExportPdf,
  type Currency, type IngestResult,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, RiskBadge, PartyScreeningRow, Field, Input, Select, useUI,
  SOURCE_LABEL, CHANNEL_LABEL, fmtMoney,
} from "../ui";

const STEPS = [
  { icon: <Send size={16} />, label: "Renseignez l'opération", desc: "Montant, provenance, bénéficiaire." },
  { icon: <Sparkles size={16} />, label: "Lancez l'analyse", desc: "Filtrage des parties et détection des comportements atypiques." },
  { icon: <ListChecks size={16} />, label: "Consultez le résultat", desc: "Niveau de risque, correspondances et motifs." },
  { icon: <ShieldAlert size={16} />, label: "En cas d'alerte", desc: "Le dossier part vers la Conformité." },
];

type Step = "form" | "processing" | "result";

export default function VerifyTransaction() {
  const { toast } = useUI();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<IngestResult | null>(null);

  const [source, setSource] = useState("T24");
  const [channel, setChannel] = useState("WIRE");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GNF");
  const [customer, setCustomer] = useState("");
  const [cpName, setCpName] = useState("");
  const [cpCountry, setCpCountry] = useState("");

  // Étapes réellement exécutées par le moteur, annoncées pendant l'attente.
  const [procSteps, setProcSteps] = useState<string[]>([]);
  const [procIdx, setProcIdx] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    getCurrencies(true).then((c) => { setCurrencies(c); if (c.find((x) => x.code === "GNF")) setCurrency("GNF"); else if (c[0]) setCurrency(c[0].code); }).catch(() => {});
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, []);

  function buildSteps() {
    const s = ["Enregistrement de l'opération"];
    if (customer.trim()) s.push("Filtrage de l'émetteur contre les listes de sanctions et PPE");
    if (cpName.trim()) s.push("Filtrage du bénéficiaire contre les listes de sanctions et PPE");
    s.push("Analyse du comportement (montant, pays, fractionnement)");
    s.push("Calcul du niveau de risque");
    return s;
  }

  async function analyze() {
    if (!amount) { toast("Indiquez un montant", "error"); return; }
    const steps = buildSteps();
    setProcSteps(steps); setProcIdx(0); setResult(null); setStep("processing");
    // La progression s'arrête à l'avant-dernière étape tant que la réponse
    // n'est pas là : on n'annonce jamais une fin qui n'a pas eu lieu.
    timer.current = window.setInterval(() => {
      setProcIdx((i) => (i < steps.length - 1 ? i + 1 : i));
    }, 750);

    try {
      const res = await ingestTransaction({
        source_system: source, channel, amount: Number(amount), currency,
        customer_ref: customer || undefined, counterparty_name: cpName || undefined,
        counterparty_country: cpCountry || undefined,
      });
      setResult(res); setStep("result");
      toast(res.alerts_created > 0
        ? `Opération analysée · ${res.alerts_created} alerte(s) transmise(s) à la Conformité`
        : "Opération analysée · aucune alerte");
    } catch (e: any) {
      setStep("form");
      toast(e?.response?.data?.detail || "Analyse impossible", "error");
    } finally {
      if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
    }
  }

  function reset() {
    setResult(null); setStep("form");
    setAmount(""); setCustomer(""); setCpName(""); setCpCountry("");
  }

  const parties: any[] = (result as any)?.parties ?? [];
  const pct = procSteps.length ? Math.round(((procIdx + 1) / procSteps.length) * 100) : 0;

  return (
    <div>
      <PageHeader icon={<Banknote size={22} />} title="Vérifier une transaction"
        subtitle="Analysez une opération : filtrage des parties contre les listes et détection des comportements atypiques." />

      <div className="ds-grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          {/* ─── Analyse en cours ─────────────────────────────────────── */}
          {step === "processing" && (
            <Card>
              <div style={{ textAlign: "center", padding: "14px 0 18px" }}>
                <div className="ds-stat-ico" style={{ width: 56, height: 56, background: "var(--brand-50)", color: "var(--brand-600)", margin: "0 auto 12px" }}>
                  <Loader2 size={26} style={{ animation: "ds-spin 1.2s linear infinite" }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>Vérification en cours…</div>
                <div className="ds-small ds-muted">Les parties sont confrontées aux listes officielles.</div>
              </div>

              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "var(--brand-600)", borderRadius: 3, transition: "width .5s ease" }} />
              </div>

              <div className="ds-grid" style={{ gap: 8, marginTop: 16 }}>
                {procSteps.map((label, i) => {
                  const done = i < procIdx, active = i === procIdx;
                  return (
                    <div key={i} className="ds-row" style={{ gap: 10, opacity: done || active ? 1 : 0.45 }}>
                      {done
                        ? <CheckCircle2 size={16} style={{ color: "var(--ok)", flexShrink: 0 }} />
                        : active
                          ? <Loader2 size={16} style={{ color: "var(--brand-600)", flexShrink: 0, animation: "ds-spin 1.2s linear infinite" }} />
                          : <div style={{ width: 16, height: 16, borderRadius: 8, border: "2px solid var(--border-2)", flexShrink: 0 }} />}
                      <span style={{ fontSize: 13.5, fontWeight: active ? 650 : 400 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ─── Résultat ─────────────────────────────────────────────── */}
          {step === "result" && result && (
            <Card>
              <CardTitle sub="Résultat de l'analyse de l'opération.">
                <CheckCircle2 size={18} style={{ color: "var(--ok)" }} /> Résultat
              </CardTitle>

              <div className="ds-row" style={{ gap: 16, margin: "8px 0 4px" }}>
                <RiskBadge level={result.risk_class} />
                <span style={{ fontSize: 26, fontWeight: 800 }}>{result.total_score}<span className="ds-muted" style={{ fontSize: 14 }}>/100</span></span>
                <span className="ds-muted ds-small" style={{ marginLeft: "auto" }}>
                  {fmtMoney(result.transaction.amount, result.transaction.currency)}
                </span>
              </div>

              {parties.length > 0 && (
                <>
                  <div className="ds-section-label"><UserCheck size={13} style={{ verticalAlign: -2 }} /> Parties vérifiées</div>
                  {parties.map((p, i) => <PartyScreeningRow key={i} party={p} />)}
                </>
              )}

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

              <div className="ds-row ds-wrap ds-mt-16" style={{ gap: 10 }}>
                <Button icon={<Download size={16} />}
                  onClick={() => downloadTransactionExportPdf(result.transaction.id)}>
                  Exporter le rapport (PDF)
                </Button>
                <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reset}>
                  Analyser une autre opération
                </Button>
              </div>
            </Card>
          )}

          {/* ─── Formulaire ───────────────────────────────────────────── */}
          {step === "form" && (
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
                <Field label="Client concerné (réf. ou nom)" hint="Un nom complet permet de le filtrer contre les listes">
                  <Input placeholder="ex. Moussa Camara" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                </Field>
                <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
                  <Field label="Bénéficiaire" hint="Filtré contre les listes"><Input placeholder="ex. Adama Diarra" value={cpName} onChange={(e) => setCpName(e.target.value)} /></Field>
                  <Field label="Pays bénéficiaire" hint="Code ou nom du pays"><Input placeholder="ex. ML, GN, RCI, SEN" value={cpCountry} onChange={(e) => setCpCountry(e.target.value)} /></Field>
                </div>
              </div>
              <Button className="ds-mt-16" size="lg" icon={<Search size={17} />} onClick={analyze} disabled={!amount}>
                Analyser l'opération
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
