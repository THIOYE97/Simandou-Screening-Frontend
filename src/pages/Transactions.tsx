// Surveillance des opérations (KYT) + Signalements de soupçon — Module 5.
import { useEffect, useState } from "react";
import { ArrowLeftRight, RefreshCw, Send, FileWarning, ShieldAlert, Eye, ListChecks, Download } from "lucide-react";
import {
  listTransactions, ingestTransaction, listSars, createSar, updateSar,
  getCurrencies, getTransactionDetail, downloadTransactionExportPdf,
  type Transaction, type SAR, type IngestResult, type Currency, type TransactionDetail,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, RiskBadge, Field, Input, Select, Textarea,
  Drawer, KV, EmptyState, useUI, SOURCE_LABEL, CHANNEL_LABEL, SAR_STATUS, SAR_DECISION, fmtMoney, fmtDate, AssessmentContext,
} from "../ui";

const SAR_NEXT: Record<string, string> = { DRAFT: "SUBMITTED", SUBMITTED: "UNDER_REVIEW", UNDER_REVIEW: "DECIDED" };
const SAR_NEXT_LABEL: Record<string, string> = { SUBMITTED: "Transmettre à la Conformité", UNDER_REVIEW: "Passer en examen", DECIDED: "Rendre la décision" };

export default function Transactions() {
  const { toast } = useUI();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [sars, setSars] = useState<SAR[]>([]);
  const [last, setLast] = useState<IngestResult | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);

  const [source, setSource] = useState("T24");
  const [channel, setChannel] = useState("WIRE");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GNF");
  const [customer, setCustomer] = useState("");
  const [cpName, setCpName] = useState("");
  const [cpCountry, setCpCountry] = useState("");

  const [sarRef, setSarRef] = useState("");
  const [sarReason, setSarReason] = useState("");
  const [sarNarr, setSarNarr] = useState("");

  async function load() {
    try { const [t, s] = await Promise.all([listTransactions(), listSars()]); setTxns(t); setSars(s); }
    catch { toast("Chargement impossible", "error"); }
  }
  useEffect(() => {
    load();
    getCurrencies(true).then((c) => {
      setCurrencies(c);
      if (c.length && !c.find((x) => x.code === "GNF")) setCurrency(c[0].code);
      else setCurrency("GNF");
    }).catch(() => { /* garde la valeur par défaut */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function openTxn(t: Transaction) {
    setDetail({ ...t } as TransactionDetail);
    try { setDetail(await getTransactionDetail(t.id)); } catch { toast("Détail indisponible", "error"); }
  }

  async function analyze() {
    if (!amount) { toast("Indiquez un montant", "error"); return; }
    try {
      const res = await ingestTransaction({
        source_system: source, channel, amount: Number(amount), currency,
        customer_ref: customer || undefined, counterparty_name: cpName || undefined,
        counterparty_country: cpCountry ? cpCountry.toUpperCase() : undefined,
      });
      setLast(res); setAmount("");
      toast(res.alerts_created > 0 ? `Opération analysée · ${res.alerts_created} alerte(s)` : "Opération analysée");
      await load();
    } catch { toast("Analyse impossible", "error"); }
  }

  async function submitSar() {
    if (!sarReason) { toast("Indiquez un motif", "error"); return; }
    try {
      await createSar({ subject_ref: sarRef || undefined, reason: sarReason, narrative: sarNarr || undefined });
      setSarRef(""); setSarReason(""); setSarNarr(""); toast("Signalement créé"); await load();
    } catch { toast("Création impossible", "error"); }
  }

  async function advanceSar(s: SAR) {
    const to = SAR_NEXT[s.status]; if (!to) return;
    try {
      const decision = to === "DECIDED" ? (window.prompt("Décision — 'declaree' (autorité) ou 'classee' (sans suite) :", "declaree") || "") : "";
      const dec = decision.startsWith("class") ? "DISMISSED" : decision ? "FILED_TO_CENTIF" : undefined;
      await updateSar(s.id, { status: to, decision: dec }); toast(`Signalement : ${SAR_STATUS[to]}`); await load();
    } catch { toast("Action impossible", "error"); }
  }

  return (
    <div>
      <PageHeader
        icon={<ArrowLeftRight size={22} />}
        title="Surveillance des opérations"
        actions={<Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>}
      />

      <div className="ds-grid ds-grid-2" style={{ alignItems: "start" }}>
        {/* Analyser une opération */}
        <Card>
          <CardTitle sub="Renseignez une opération : elle sera évaluée immédiatement.">
            <Send size={18} /> Analyser une opération
          </CardTitle>
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
              <Field label="Montant"><Input type="number" placeholder="ex. 15000" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Devise">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {currencies.length === 0 && <option value={currency}>{currency}</option>}
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Client concerné (réf.)"><Input placeholder="ex. CLI-1024" value={customer} onChange={(e) => setCustomer(e.target.value)} /></Field>
            <div className="ds-grid ds-grid-2" style={{ gap: 12 }}>
              <Field label="Bénéficiaire"><Input value={cpName} onChange={(e) => setCpName(e.target.value)} /></Field>
              <Field label="Pays bénéficiaire"><Input placeholder="ex. FR" value={cpCountry} onChange={(e) => setCpCountry(e.target.value)} /></Field>
            </div>
          </div>
          <Button className="ds-mt-16" size="lg" icon={<Send size={16} />} onClick={analyze}>Analyser</Button>
          {last && (
            <div className="ds-row ds-mt-16" style={{ gap: 14 }}>
              <RiskBadge level={last.risk_class} />
              <span style={{ fontWeight: 700 }}>Score {last.total_score}</span>
              <span className="ds-small ds-muted">{last.alerts_created} alerte(s) générée(s)</span>
            </div>
          )}
        </Card>

        {/* Signalement de soupçon */}
        <Card>
          <CardTitle sub="À adresser à la Cellule de Conformité en cas de doute sérieux.">
            <ShieldAlert size={18} /> Nouveau signalement de soupçon
          </CardTitle>
          <div className="ds-grid" style={{ gap: 12 }}>
            <Field label="Personne / client concerné"><Input placeholder="Réf. ou nom" value={sarRef} onChange={(e) => setSarRef(e.target.value)} /></Field>
            <Field label="Motif du soupçon"><Input placeholder="ex. Dépôts d'espèces répétés" value={sarReason} onChange={(e) => setSarReason(e.target.value)} /></Field>
            <Field label="Détails"><Textarea rows={3} placeholder="Décrivez la situation…" value={sarNarr} onChange={(e) => setSarNarr(e.target.value)} /></Field>
          </div>
          <Button className="ds-mt-16" variant="secondary" icon={<FileWarning size={16} />} onClick={submitSar}>Créer le signalement</Button>
        </Card>
      </div>

      {/* Opérations récentes */}
      <Card className="ds-mt-24" pad0>
        <div style={{ padding: "20px 22px 0" }}><CardTitle sub="Les dernières opérations analysées.">Opérations récentes</CardTitle></div>
        {txns.length === 0 ? <EmptyState icon={<ArrowLeftRight size={24} />} title="Aucune opération analysée" subtitle="Analysez une opération ci-dessus pour commencer." />
          : <div className="ds-table-wrap" style={{ border: "none" }}>
              <table className="ds-table">
                <thead><tr><th>Réf.</th><th>Provenance</th><th>Moyen</th><th>Montant</th><th>Client</th><th>Bénéficiaire</th><th>Pays</th><th></th></tr></thead>
                <tbody>{txns.map((t) => (
                  <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => openTxn(t)}>
                    <td className="ds-small">{t.external_ref || t.id.slice(0, 8)}</td>
                    <td className="ds-small">{SOURCE_LABEL[t.source_system] || t.source_system}</td>
                    <td className="ds-small">{CHANNEL_LABEL[t.channel] || t.channel}</td>
                    <td style={{ fontWeight: 650 }}>{fmtMoney(t.amount, t.currency)}</td>
                    <td className="ds-small">{t.customer_ref || "—"}</td>
                    <td className="ds-small">{t.counterparty_name || "—"}</td>
                    <td className="ds-small">{t.counterparty_country || "—"}</td>
                    <td><Button size="sm" variant="ghost" icon={<Eye size={14} />}>Détail</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
      </Card>

      {/* Signalements */}
      <Card className="ds-mt-24" pad0>
        <div style={{ padding: "20px 22px 0" }}><CardTitle sub="Suivi des signalements de soupçon.">Signalements de soupçon</CardTitle></div>
        {sars.length === 0 ? <EmptyState icon={<FileWarning size={24} />} title="Aucun signalement" subtitle="Les signalements que vous créez apparaissent ici." />
          : <div className="ds-table-wrap" style={{ border: "none" }}>
              <table className="ds-table">
                <thead><tr><th>Personne</th><th>Motif</th><th>Statut</th><th>Décision</th><th>Créé le</th><th>Suite</th></tr></thead>
                <tbody>{sars.map((s) => (
                  <tr key={s.id}>
                    <td className="ds-small">{s.subject_label || s.subject_ref || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{s.reason}</td>
                    <td className="ds-small">{SAR_STATUS[s.status] || s.status}</td>
                    <td className="ds-small">{SAR_DECISION[s.decision] || s.decision}</td>
                    <td className="ds-small ds-muted">{fmtDate(s.created_at)}</td>
                    <td>{SAR_NEXT[s.status]
                      ? <Button size="sm" variant="secondary" onClick={() => advanceSar(s)}>{SAR_NEXT_LABEL[SAR_NEXT[s.status]]}</Button>
                      : <span className="ds-small ds-muted">Clôturé</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
      </Card>

      {/* Détail d'une opération */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={<span className="ds-row" style={{ gap: 8 }}><ArrowLeftRight size={18} /> Opération {detail?.external_ref || detail?.id?.slice(0, 8)}</span>}
        subtitle={detail ? fmtMoney(detail.amount, detail.currency) : ""}
        footer={detail && <Button icon={<Download size={16} />} onClick={() => downloadTransactionExportPdf(detail.id)}>Exporter le rapport (PDF)</Button>}
      >
        {detail && (
          <>
            <div className="ds-section-label">Détails de l'opération</div>
            <KV items={[
              ["Montant", <b>{fmtMoney(detail.amount, detail.currency)}</b>],
              ["Provenance", SOURCE_LABEL[detail.source_system] || detail.source_system],
              ["Moyen", CHANNEL_LABEL[detail.channel] || detail.channel],
              ["Sens", detail.direction],
              ["Client", detail.customer_ref || "—"],
              ["Bénéficiaire", detail.counterparty_name || "—"],
              ["Pays bénéficiaire", detail.counterparty_country || "—"],
              ["Date", fmtDate(detail.created_at)],
            ]} />

            <div className="ds-section-label">Évaluation du risque</div>
            {detail.assessment ? (
              <>
                <div className="ds-row" style={{ gap: 14, marginBottom: 10 }}>
                  <RiskBadge level={detail.assessment.risk_class} />
                  <b>{detail.assessment.total_score}/100</b>
                </div>
                <div className="ds-section-label"><ListChecks size={13} style={{ verticalAlign: -2 }} /> Motifs</div>
                {detail.assessment.triggered.length
                  ? detail.assessment.triggered.map((t) => (
                    <div key={t.code} className="ds-reason">{t.name}<span className="ds-muted ds-small" style={{ marginLeft: "auto" }}>+{t.weight}</span></div>
                  ))
                  : <div className="ds-small ds-muted">Aucun comportement atypique détecté.</div>}
                {detail.assessment.context && Object.keys(detail.assessment.context).length > 0 && (
                  <>
                    <AssessmentContext context={detail.assessment.context} />
                  </>
                )}
              </>
            ) : <div className="ds-small ds-muted">Pas encore évaluée.</div>}
          </>
        )}
      </Drawer>
    </div>
  );
}
