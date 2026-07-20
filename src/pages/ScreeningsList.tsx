// Vérifications — historique unifié : vérifications de personnes ET d'opérations.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, RefreshCw, Search, UserPlus, Banknote, User, ArrowLeftRight, Eye, ListChecks, Download,
} from "lucide-react";
import {
  listScreenings, listTransactions, getTransactionDetail, downloadTransactionExportPdf,
  type ScreeningListItem, type Transaction, type TransactionDetail,
} from "../api";
import {
  Button, Card, PageHeader, RiskBadge, Badge, EmptyState, SkeletonRows, Input, Select,
  Drawer, KV, DecisionBadge, AuditTimeline, Pagination, PAGE_SIZE, useUI, fmtDate, fmtMoney, SOURCE_LABEL, CHANNEL_LABEL,
} from "../ui";

type Row = {
  kind: "person" | "operation";
  id: string;
  label: string;
  typeLabel: string;
  risk?: string | null;
  date?: string | null;
  raw: any;
};

// Une société se reconnaît au type d'entité renvoyé par l'API ; on garde la
// détection par libellé en repli pour les demandes anciennes.
function isCompany(r: ScreeningListItem) {
  const et = String((r as any).entity_type || "").toUpperCase();
  if (et) return et === "COMPANY";
  return /KYS|KYB|COMPANY/.test(String(r.kind || "").toUpperCase());
}

function personName(r: ScreeningListItem) {
  return r.client_name || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "—";
}

export default function ScreeningsList() {
  const nav = useNavigate();
  const { toast } = useUI();
  const [screenings, setScreenings] = useState<ScreeningListItem[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "person" | "operation">("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([listScreenings({ limit: 200 }), listTransactions()]);
      setScreenings(s.items); setTxns(t);
    } catch { toast("Impossible de charger les vérifications", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = useMemo(() => {
    const p: Row[] = screenings.map((r) => ({
      kind: "person", id: r.id, label: personName(r),
      typeLabel: isCompany(r) ? "Personne morale" : "Personne physique",
      risk: r.risk_level, date: r.created_at, raw: r,
    }));
    const o: Row[] = txns.map((t) => ({
      kind: "operation", id: t.id,
      label: `${t.customer_ref || t.external_ref || t.id.slice(0, 8)} · ${fmtMoney(t.amount, t.currency)}`,
      typeLabel: "Opération", risk: t.risk_class, date: t.created_at, raw: t,
    }));
    return [...p, ...o].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [screenings, txns]);

  const filtered = useMemo(() => {
    const nq = q.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    return rows.filter((r) => {
      if (type && r.kind !== type) return false;
      if (!nq) return true;
      return r.label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(nq);
    });
  }, [rows, q, type]);

  useEffect(() => { setPage(1); }, [q, type]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function openRow(r: Row) {
    if (r.kind === "person") { nav(`/screenings/${r.id}`); return; }
    setDetail({ ...(r.raw as any) });
    try { setDetail(await getTransactionDetail(r.id)); } catch { toast("Détail indisponible", "error"); }
  }

  return (
    <div>
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="Vérifications"
        subtitle="L'historique de toutes les vérifications réalisées : personnes et opérations."
        actions={<>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>
          <Button icon={<UserPlus size={16} />} onClick={() => nav("/analyst")}>Vérifier une personne</Button>
        </>}
      />

      <div className="ds-row ds-wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="ds-input-ico" style={{ flex: 1, minWidth: 240 }}>
          <Search size={17} />
          <input className="ds-input" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as any)} style={{ width: 220 }}>
          <option value="">Tous les types</option>
          <option value="person">Personnes</option>
          <option value="operation">Opérations</option>
        </Select>
      </div>

      <Card pad0>
        {loading ? <SkeletonRows rows={7} /> : filtered.length === 0 ? (
          <EmptyState icon={<Search size={26} />} title="Aucune vérification"
            subtitle={q || type ? "Essayez d'élargir votre recherche." : "Lancez une vérification de personne ou d'opération."}
            action={!q && !type ? <div className="ds-row" style={{ gap: 8 }}>
              <Button icon={<UserPlus size={16} />} onClick={() => nav("/analyst")}>Une personne</Button>
              <Button variant="secondary" icon={<Banknote size={16} />} onClick={() => nav("/verify-transaction")}>Une opération</Button>
            </div> : undefined} />
        ) : (
          <><div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr><th>Type</th><th>Objet</th><th>Niveau de risque</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} style={{ cursor: "pointer" }} onClick={() => openRow(r)}>
                    <td>
                      <Badge tone={r.kind === "operation" ? "info" : "neutral"}>
                        {r.kind === "operation" ? <ArrowLeftRight size={13} /> : <User size={13} />} {r.typeLabel}
                      </Badge>
                    </td>
                    <td style={{ fontWeight: 650 }}>{r.label}</td>
                    <td>{r.risk ? <RiskBadge level={r.risk} /> : <span className="ds-small ds-muted">—</span>}</td>
                    <td className="ds-small ds-muted">{fmtDate(r.date)}</td>
                    <td><Button size="sm" variant="ghost" icon={<Eye size={14} />}>Détails</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} onPage={setPage} /></>
        )}
      </Card>

      {/* Détail d'une opération (les personnes ouvrent la page dédiée) */}
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
              ["Client", detail.customer_ref || "—"],
              ["Bénéficiaire", detail.counterparty_name || "—"],
              ["Pays", detail.counterparty_country || "—"],
              ["Date", fmtDate(detail.created_at)],
            ]} />
            <div className="ds-section-label">Évaluation du risque</div>
            {detail.assessment ? (
              <>
                <div className="ds-row" style={{ gap: 14, marginBottom: 10 }}>
                  <RiskBadge level={detail.assessment.risk_class} /><b>{detail.assessment.total_score}/100</b>
                </div>
                <div className="ds-section-label"><ListChecks size={13} style={{ verticalAlign: -2 }} /> Motifs</div>
                {detail.assessment.triggered.length
                  ? detail.assessment.triggered.map((t) => (
                    <div key={t.code} className="ds-reason">{t.name}<span className="ds-muted ds-small" style={{ marginLeft: "auto" }}>+{t.weight}</span></div>
                  ))
                  : <div className="ds-small ds-muted">Aucun comportement atypique détecté.</div>}
              </>
            ) : <div className="ds-small ds-muted">Pas encore évaluée.</div>}

            {detail.decision && detail.decision !== "PENDING" && (
              <>
                <div className="ds-section-label">Décision de la Conformité</div>
                <DecisionBadge decision={detail.decision} />
              </>
            )}
            <div className="ds-section-label">Historique de décision</div>
            <AuditTimeline events={detail.events} />
          </>
        )}
      </Drawer>
    </div>
  );
}
