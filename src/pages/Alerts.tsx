// Alertes à traiter — file + dossier complet par alerte (Module 6).
import { useEffect, useState } from "react";
import {
  AlertTriangle, RefreshCw, Wand2, CheckCircle2, ArrowRight, Eye, ShieldX,
  User, ArrowLeftRight, ListChecks, Scale, UserCheck, Network,
} from "lucide-react";
import {
  listAlerts, updateAlertStatus, seedAlertRules, getAlertDetail,
  type Alert, type AlertStatus, type AlertDetail,
} from "../api";
import {
  Button, Card, PageHeader, Badge, RiskBadge, EmptyState, SkeletonRows, Select, PartyScreeningRow,
  Drawer, KV, DecisionBadge, AuditTimeline, Pagination, PAGE_SIZE, useUI,
  ALERT_STATUS, SOURCE_LABEL, CHANNEL_LABEL, fmtDate, fmtMoney, AssessmentContext,
} from "../ui";

const SEV_TONE: Record<string, "low" | "medium" | "high" | "critical"> = { LOW: "low", MEDIUM: "medium", HIGH: "high", CRITICAL: "critical" };
const SEV_WORD: Record<string, string> = { LOW: "Mineure", MEDIUM: "Moyenne", HIGH: "Importante", CRITICAL: "Critique" };
const A = {
  review: { to: "IN_REVIEW" as AlertStatus, label: "Prendre en charge", icon: <Eye size={14} />, variant: "secondary" as const },
  escalate: { to: "ESCALATED" as AlertStatus, label: "Escalader", icon: <ArrowRight size={14} />, variant: "secondary" as const },
  confirm: { to: "CLOSED_TRUE_POSITIVE" as AlertStatus, label: "Confirmer le soupçon", icon: <CheckCircle2 size={14} />, variant: "danger" as const },
  dismiss: { to: "CLOSED_FALSE_POSITIVE" as AlertStatus, label: "Lever l'alerte", icon: <ShieldX size={14} />, variant: "success" as const },
};
const NEXT: Record<AlertStatus, { to: AlertStatus; label: string; icon: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "success" }[]> = {
  OPEN: [A.review, A.escalate, A.confirm, A.dismiss],
  IN_REVIEW: [A.escalate, A.confirm, A.dismiss],
  ESCALATED: [A.confirm, A.dismiss],
  CLOSED_TRUE_POSITIVE: [], CLOSED_FALSE_POSITIVE: [],
};

// Type d'alerte : vérification d'un client/fournisseur ou opération atypique.
// SCORING = alertes historiques, antérieures à la qualification des origines.
function kindOf(source?: string | null) {
  const s = String(source || "").toUpperCase();
  if (s === "KYT") return { label: "Opération atypique", icon: <ArrowLeftRight size={13} />, tone: "medium" as const };
  if (s === "SCREENING") return { label: "Vérification client", icon: <User size={13} />, tone: "info" as const };
  if (s === "UBO") return { label: "Bénéficiaire effectif", icon: <Network size={13} />, tone: "high" as const };
  return { label: "Évaluation", icon: <Scale size={13} />, tone: "neutral" as const };
}

export default function Alerts() {
  const { toast, confirm, prompt } = useUI();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState("");
  const [sev, setSev] = useState("");
  const [kind, setKind] = useState("");     // SCREENING = client/fournisseur, KYT = opération
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAlerts(await listAlerts({
        status: status || undefined, severity: sev || undefined, source: kind || undefined,
      }));
    }
    catch { toast("Impossible de charger les alertes", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); setPage(1); }, [status, sev, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = alerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function open(a: Alert) {
    setLoadingDetail(true); setDetail({ ...a } as AlertDetail);
    try { setDetail(await getAlertDetail(a.id)); }
    catch { toast("Détail indisponible", "error"); }
    finally { setLoadingDetail(false); }
  }

  async function act(a: Alert, to: AlertStatus, label: string) {
    const closing = to.startsWith("CLOSED");
    let reason: string | undefined;
    if (closing) {
      const r = await prompt({
        title: `${label} ?`,
        message: to === "CLOSED_TRUE_POSITIVE"
          ? "Le sujet sera BLOQUÉ et un signalement de soupçon sera créé. Indiquez le motif."
          : "Le sujet sera AUTORISÉ et l'alerte levée. Indiquez le motif.",
        label: "Justification (obligatoire)",
        confirmLabel: label, danger: to === "CLOSED_TRUE_POSITIVE",
      });
      if (r == null) return;
      reason = r;
    } else {
      const ok = await confirm({ title: `${label} ?`, message: "L'alerte changera de statut.", confirmLabel: label });
      if (!ok) return;
    }
    try {
      await updateAlertStatus(a.id, to, reason);
      toast(`Décision enregistrée : ${ALERT_STATUS[to]}`); setDetail(null); await load();
    } catch (e: any) { toast(e?.response?.data?.detail || "Action impossible", "error"); }
  }

  async function initRules() {
    try { await seedAlertRules(); toast("Règles par défaut chargées"); await load(); }
    catch { toast("Action réservée aux administrateurs", "error"); }
  }

  const a = detail;
  const ass = a?.assessment;
  const tx = a?.transaction;

  return (
    <div>
      <PageHeader
        icon={<AlertTriangle size={22} />}
        title="Alertes à traiter"
        actions={<>
          <Button variant="secondary" icon={<Wand2 size={16} />} onClick={initRules}>Règles par défaut</Button>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>
        </>}
      />

      <div className="ds-row ds-wrap" style={{ marginBottom: 16 }}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 220 }}>
          <option value="">Tous les statuts</option>
          {Object.keys(ALERT_STATUS).map((s) => <option key={s} value={s}>{ALERT_STATUS[s]}</option>)}
        </Select>
        <Select value={sev} onChange={(e) => setSev(e.target.value)} style={{ width: 200 }}>
          <option value="">Toutes les gravités</option>
          {Object.keys(SEV_WORD).map((s) => <option key={s} value={s}>{SEV_WORD[s]}</option>)}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 240 }}>
          <option value="">Tous les types d'alerte</option>
          <option value="SCREENING">Vérification client</option>
          <option value="KYT">Opération atypique</option>
          <option value="UBO">Bénéficiaire effectif</option>
        </Select>
      </div>

      <Card pad0>
        {loading ? <SkeletonRows rows={6} /> : alerts.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={28} />} title="Aucune alerte à traiter"
            subtitle="Tout est calme. Les alertes apparaissent dès qu'une situation à risque est détectée." />
        ) : (
          <><div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr><th>Type</th><th>Gravité</th><th>Motif</th><th>Concerné</th><th>Statut</th><th>Détectée le</th><th></th></tr></thead>
              <tbody>
                {paged.map((al) => {
                  const k = kindOf(al.source);
                  return (
                  <tr key={al.id} style={{ cursor: "pointer" }} onClick={() => open(al)}>
                    <td><Badge tone={k.tone}>{k.icon} {k.label}</Badge></td>
                    <td><Badge tone={SEV_TONE[al.severity] || "neutral"}>{SEV_WORD[al.severity] || al.severity}</Badge></td>
                    <td style={{ fontWeight: 600 }}>{al.title}</td>
                    <td className="ds-small">{al.subject_label || al.subject_ref || "—"}</td>
                    <td className="ds-small">{ALERT_STATUS[al.status] || al.status}</td>
                    <td className="ds-small ds-muted">{fmtDate(al.created_at)}</td>
                    <td><Button size="sm" variant="ghost" icon={<Eye size={14} />}>Ouvrir</Button></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={alerts.length} onPage={setPage} /></>
        )}
      </Card>

      {/* Dossier complet de l'alerte */}
      <Drawer
        open={!!a}
        onClose={() => setDetail(null)}
        title={<span className="ds-row" style={{ gap: 8 }}><AlertTriangle size={18} /> {a?.title}</span>}
        subtitle={a ? `${SEV_WORD[a.severity] || a.severity} · ${ALERT_STATUS[a.status] || a.status}` : ""}
        footer={a && NEXT[a.status]?.length ? NEXT[a.status].map((n) => (
          <Button key={n.to} variant={n.variant} icon={n.icon} onClick={() => act(a, n.to, n.label)}>{n.label}</Button>
        )) : <span className="ds-small ds-muted">Alerte clôturée — aucune action possible.</span>}
      >
        {loadingDetail && !ass ? <SkeletonRows rows={4} /> : a && (
          <>
            <div className="ds-section-label"><User size={13} style={{ verticalAlign: -2 }} /> Personne concernée</div>
            <KV items={[
              ["Nom / libellé", a.subject_label || "—"],
              ["Référence", a.subject_ref || "—"],
              ["Niveau de risque", ass ? <RiskBadge level={ass.risk_class} /> : "—"],
              ["Score", ass ? <b>{ass.total_score}/100</b> : "—"],
            ]} />

            <div className="ds-section-label"><ListChecks size={13} style={{ verticalAlign: -2 }} /> Pourquoi cette alerte ?</div>
            {ass?.triggered?.length ? ass.triggered.map((t) => (
              <div key={t.code} className="ds-reason"><AlertTriangle size={15} style={{ color: "var(--risk-high)" }} /> {t.name} <span className="ds-muted ds-small" style={{ marginLeft: "auto" }}>+{t.weight}</span></div>
            )) : <div className="ds-small ds-muted">Motif : {a.rule_code || "règle déclenchée"}.</div>}

            {ass?.context && Object.keys(ass.context).length > 0 && (
              <>
                <AssessmentContext context={ass.context} />
              </>
            )}

            {Array.isArray(a.detail?.screening?.matches) && a.detail.screening.matches.length > 0 && (
              <>
                <div className="ds-section-label"><Scale size={13} style={{ verticalAlign: -2 }} /> Correspondances (listes)</div>
                {a.detail.screening.matches.map((m: any, i: number) => (
                  <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", marginBottom: 8 }}>
                    <div className="ds-between">
                      <b style={{ fontSize: 13.5 }}>{m.name || "—"}</b>
                      <Badge tone={m.score >= 85 ? "critical" : m.score >= 65 ? "high" : "medium"}>{m.score}%</Badge>
                    </div>
                    <div className="ds-small ds-muted" style={{ marginTop: 2 }}>
                      {[m.source, m.program].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {Array.isArray(m.reasons) && m.reasons.map((r: string, j: number) => (
                      <div key={j} className="ds-small" style={{ marginTop: 4 }}>• {r}</div>
                    ))}
                  </div>
                ))}
              </>
            )}

            {tx && (
              <>
                <div className="ds-section-label"><ArrowLeftRight size={13} style={{ verticalAlign: -2 }} /> Opération liée</div>
                <KV items={[
                  ["Montant", <b>{fmtMoney(tx.amount, tx.currency)}</b>],
                  ["Provenance", SOURCE_LABEL[tx.source_system] || tx.source_system],
                  ["Moyen", CHANNEL_LABEL[tx.channel] || tx.channel],
                  ["Bénéficiaire", tx.counterparty_name || "—"],
                  ["Pays", tx.counterparty_country || "—"],
                  ["Date", fmtDate(tx.created_at)],
                ]} />
              </>
            )}

            {a.subject_decision && a.subject_decision !== "PENDING" && (
              <>
                <div className="ds-section-label">Décision sur le sujet</div>
                <DecisionBadge decision={a.subject_decision} />
              </>
            )}

            <div className="ds-section-label">Historique de décision</div>
            <AuditTimeline events={a.events} />
          </>
        )}
      </Drawer>
    </div>
  );
}
