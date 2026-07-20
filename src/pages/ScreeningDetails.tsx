// Détail d'une vérification — correspondances, profil de risque et décision.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ClipboardCheck, RefreshCw, Download, ArrowLeft, CheckCircle2,
  ListChecks, Users, Landmark, ShieldAlert, ChevronRight, Eye, ExternalLink, Scale,
  Network, AlertTriangle, Plus,
} from "lucide-react";
import { downloadScreeningExportPdf, getScreeningDetails, getComplianceEvents, lookupUboDeclaration,
  type ComplianceEvent, type UboLookup } from "../api";
import {
  Button, Card, CardTitle, PageHeader, RiskBadge, Badge,
  Drawer, KV, AuditTimeline, EmptyState, SkeletonRows, StatCard, useUI, fmtDate,
} from "../ui";

type AnyObj = Record<string, any>;

function displayName(d: AnyObj | null): string {
  const p = d?.request?.request_payload ?? {};
  if (p.override_name) return String(p.override_name).trim();
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.company_name || p.name || d?.request?.client_id || "—";
}
function scoreTone(s: number): "low" | "medium" | "high" | "critical" {
  if (s >= 85) return "critical"; if (s >= 65) return "high"; if (s >= 40) return "medium"; return "low";
}
function scoreWord(s: number): string {
  if (s >= 85) return "Correspondance forte"; if (s >= 65) return "Correspondance probable";
  if (s >= 40) return "Correspondance possible"; return "Faible";
}
// source_block peut être un objet (enregistrement de source) → on en extrait une chaîne sûre
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") return String(v.name || v.label || v.source_name || v.code || v.program || "");
  return "";
}
function matchSource(m: AnyObj): string {
  return asText(m.source_block) || asText(m.source) || asText(m.source_name) || "—";
}
function matchName(m: AnyObj): string {
  return asText(m.name) || asText(m.entity_name) || asText(m.entity?.name) || "—";
}

export default function ScreeningDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { toast } = useUI();
  const [data, setData] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnyObj | null>(null);
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [ubo, setUbo] = useState<UboLookup | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setData(await getScreeningDetails(id));
      getComplianceEvents(id).then(setEvents).catch(() => setEvents([]));
    }
    catch { toast("Impossible de charger la vérification", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = data?.result ?? null;
  const request = data?.request ?? null;
  // Personne morale : le type d'entité est désormais à la racine du payload ;
  // on garde le repli sur la dénomination pour les demandes antérieures.
  const payload: AnyObj = request?.request_payload ?? {};
  const isCompany =
    String(payload.entity_type || payload.meta?.entity_type || "").toUpperCase() === "COMPANY"
    || !!(payload.company_name || payload.meta?.company_name);

  useEffect(() => {
    if (!isCompany) { setUbo(null); return; }
    const company_name = payload.company_name || payload.meta?.company_name || payload.name;
    if (!company_name) return;
    lookupUboDeclaration({ company_name, company_ref: payload.registration_number || undefined })
      .then(setUbo)
      .catch(() => setUbo({ found: false, declaration: null }));
  }, [isCompany, request?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches: AnyObj[] = Array.isArray(data?.matches) ? data.matches : [];
  const decisionLatest = data?.decision_latest ?? null;

  const sorted = useMemo(() => [...matches].sort((a, b) => Number(b.match_score ?? 0) - Number(a.match_score ?? 0)), [matches]);
  const strong = sorted.filter((m) => Number(m.match_score ?? 0) >= 85).length;
  const entities = new Set(sorted.map((m) => m.entity_id)).size;
  const name = displayName(data);

  return (
    <div>
      <div className="ds-row ds-small ds-muted" style={{ marginBottom: 12, gap: 6 }}>
        <Link to="/screenings" className="ds-row" style={{ color: "var(--text-soft)", textDecoration: "none", gap: 4 }}>
          <ArrowLeft size={14} /> Vérifications
        </Link>
        <ChevronRight size={13} /> <span style={{ color: "var(--text)", fontWeight: 600 }}>{name}</span>
      </div>

      <PageHeader
        icon={<ClipboardCheck size={22} />}
        title={name}
        subtitle={request?.created_at ? `Vérifiée le ${fmtDate(request.created_at)}` : "Détail de la vérification"}
        actions={<>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Actualiser</Button>
          <Button icon={<Download size={16} />} onClick={() => downloadScreeningExportPdf(String(request?.id ?? id))}>Export PDF</Button>
        </>}
      />

      {loading ? <SkeletonRows rows={5} /> : (
        <>
          {/* Résumé */}
          <div className="ds-grid ds-grid-4">
            <StatCard icon={<ListChecks size={20} />} value={matches.length} label="Correspondances" />
            <StatCard icon={<ShieldAlert size={20} />} value={strong} label="Correspondances fortes"
              tone="var(--risk-critical)" tint="var(--risk-critical-bg)" />
            <StatCard icon={<Users size={20} />} value={entities} label="Entités liées" />
            <div className="ds-stat">
              <div className="ds-stat-ico" style={{ background: "var(--surface-2)", color: "var(--text-soft)" }}><Landmark size={20} /></div>
              <div style={{ marginTop: 2 }}>{result?.risk_level ? <RiskBadge level={result.risk_level} /> : <span className="ds-muted">Non déterminé</span>}</div>
              <div className="ds-stat-label">Niveau de risque global</div>
            </div>
          </div>

          <div className="ds-grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start", marginTop: 24 }}>
            {/* Correspondances */}
            <Card pad0>
              <div style={{ padding: "20px 22px 0" }}>
                <CardTitle sub="Les personnes/entités des listes qui ressemblent au sujet.">Correspondances trouvées</CardTitle>
              </div>
              {sorted.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={26} />} title="Aucune correspondance"
                  subtitle="Aucune personne ou entité des listes ne correspond au sujet." />
              ) : (
                <div className="ds-table-wrap" style={{ border: "none" }}>
                  <table className="ds-table">
                    <thead><tr><th>Nom</th><th>Source</th><th>Correspondance</th><th>Score</th><th></th></tr></thead>
                    <tbody>
                      {sorted.map((m, i) => {
                        const s = Number(m.match_score ?? 0);
                        return (
                          <tr key={m.entity_id || i} style={{ cursor: "pointer" }} onClick={() => setSelected(m)}>
                            <td style={{ fontWeight: 650 }}>{matchName(m)}</td>
                            <td className="ds-small ds-muted">{matchSource(m)}</td>
                            <td><Badge tone={scoreTone(s)}>{scoreWord(s)}</Badge></td>
                            <td style={{ fontWeight: 700 }}>{s}%</td>
                            <td><Button size="sm" variant="ghost" icon={<Eye size={14} />}>Détails</Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Décision */}
            <div className="ds-grid" style={{ gap: 16 }}>
              <Card>
                <CardTitle>Décision</CardTitle>
                {decisionLatest ? (
                  <div className="ds-reason" style={{ borderLeftColor: String(decisionLatest.decision).toUpperCase() === "BLOCK" ? "var(--danger)" : "var(--ok)" }}>
                    Décision de la Conformité : <b style={{ marginLeft: 4 }}>{String(decisionLatest.decision).toUpperCase() === "BLOCK" ? "Bloquée" : "Validée"}</b>
                  </div>
                ) : strong > 0 ? (
                  <div className="ds-reason" style={{ borderLeftColor: "var(--risk-high)" }}>
                    <ShieldAlert size={15} style={{ color: "var(--risk-high)" }} /> Correspondance détectée — un dossier a été transmis à la <b>Conformité</b> (Alertes) pour décision.
                  </div>
                ) : (
                  <div className="ds-reason" style={{ borderLeftColor: "var(--ok)" }}>
                    <CheckCircle2 size={15} style={{ color: "var(--ok)" }} /> Aucune correspondance — aucune action requise.
                  </div>
                )}
                <p className="ds-small ds-muted ds-mt-16" style={{ lineHeight: 1.5 }}>
                  La décision (valider / bloquer) relève de la <b>Cellule de Conformité</b> et se prend depuis les <b>Alertes</b>.
                </p>
              </Card>

              <Card>
                <CardTitle>Synthèse</CardTitle>
                <dl className="ds-kv">
                  <dt>Sujet</dt><dd>{name}</dd>
                  <dt>Nationalité</dt><dd>{request?.request_payload?.nationality || "—"}</dd>
                  <dt>Confiance</dt><dd>{result?.confidence != null ? `${result.confidence}%` : "—"}</dd>
                  <dt>Action conseillée</dt><dd>{result?.recommended_action || "—"}</dd>
                </dl>
              </Card>

              {isCompany && (
                <Card>
                  <CardTitle sub="Obligation LBC/FT : les bénéficiaires effectifs d'une personne morale doivent être identifiés.">
                    <Network size={18} /> Bénéficiaires effectifs
                  </CardTitle>
                  {ubo === null ? (
                    <div className="ds-small ds-muted">Recherche…</div>
                  ) : ubo.found && ubo.declaration ? (
                    <>
                      <dl className="ds-kv">
                        <dt>Déclarés</dt><dd>{ubo.owners_count} bénéficiaire(s) effectif(s)</dd>
                        <dt>Sur une liste</dt>
                        <dd>{(ubo.flagged_count ?? 0) > 0
                          ? <b style={{ color: "var(--risk-high)" }}>{ubo.flagged_count} rapproché(s)</b>
                          : "Aucun"}</dd>
                        <dt>Dernier filtrage</dt>
                        <dd>{ubo.last_screened_at ? fmtDate(ubo.last_screened_at) : "Jamais filtré"}</dd>
                      </dl>
                      <Button className="ds-mt-16" variant="secondary" size="sm"
                        icon={<ExternalLink size={14} />}
                        onClick={() => nav("/beneficial-owners")}>
                        Ouvrir la chaîne de détention
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* L'absence de bénéficiaire effectif déclaré n'est pas neutre :
                          elle rend la vérification incomplète au regard des obligations. */}
                      <div className="ds-reason" style={{ borderLeftColor: "var(--risk-high)" }}>
                        <AlertTriangle size={15} style={{ color: "var(--risk-high)" }} />
                        Vérification incomplète — aucun bénéficiaire effectif déclaré pour cette personne morale.
                      </div>
                      <Button className="ds-mt-16" size="sm" icon={<Plus size={14} />}
                        onClick={() => nav("/beneficial-owners")}>
                        Déclarer les bénéficiaires effectifs
                      </Button>
                    </>
                  )}
                </Card>
              )}

              <Card>
                <CardTitle sub="Traçabilité et audit des décisions de la Conformité sur ce dossier.">Historique de décision</CardTitle>
                <AuditTimeline events={events} />
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Détail d'une correspondance */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={<span className="ds-row" style={{ gap: 8 }}><Scale size={18} /> {selected ? matchName(selected) : ""}</span>}
        subtitle={selected ? `${selected.match_band_label || scoreWord(Number(selected.match_score ?? 0))} · ${Number(selected.match_score ?? 0)}%` : ""}
      >
        {selected && (
          <>
            <div className="ds-row" style={{ gap: 12, marginBottom: 8 }}>
              <Badge tone={scoreTone(Number(selected.match_score ?? 0))}>{scoreWord(Number(selected.match_score ?? 0))}</Badge>
              <b>{Number(selected.match_score ?? 0)}%</b>
            </div>

            <div className="ds-section-label"><ListChecks size={13} style={{ verticalAlign: -2 }} /> Pourquoi cette correspondance ?</div>
            {Array.isArray(selected.match_explain?.bullets) && selected.match_explain.bullets.length
              ? selected.match_explain.bullets.map((b: string, i: number) => (
                  <div key={i} className="ds-reason" style={{ borderLeftColor: "var(--brand-500)" }}>{asText(b)}</div>
                ))
              : <div className="ds-small ds-muted">Rapprochement de nom avec une entité des listes.</div>}

            <div className="ds-section-label"><ShieldAlert size={13} style={{ verticalAlign: -2 }} /> Détails de la sanction</div>
            <KV items={[
              ["Nom sur la liste", matchName(selected)],
              ["Source", asText(selected.source_name) || matchSource(selected)],
              ["Programme", asText(selected.program) || "—"],
              ["Type", asText(selected.record_type) || "—"],
              ["Référence", asText(selected.source_ref) || "—"],
              ["Inscrit le", selected.listed_on ? fmtDate(selected.listed_on) : "—"],
              ["Retiré le", selected.unlisted_on ? fmtDate(selected.unlisted_on) : "—"],
            ]} />

            {asText(selected.summary) && (
              <>
                <div className="ds-section-label">Résumé</div>
                <p className="ds-small" style={{ lineHeight: 1.55 }}>{asText(selected.summary)}</p>
              </>
            )}

            {(() => {
              const links = collectLinks(selected);
              return links.length ? (
                <>
                  <div className="ds-section-label"><ExternalLink size={13} style={{ verticalAlign: -2 }} /> Sources & preuves</div>
                  <div className="ds-grid" style={{ gap: 6 }}>
                    {links.map((l, i) => (
                      <a key={i} href={l} target="_blank" rel="noreferrer" className="ds-row ds-small" style={{ gap: 6, color: "var(--brand-600)", wordBreak: "break-all" }}>
                        <ExternalLink size={13} /> {l}
                      </a>
                    ))}
                  </div>
                </>
              ) : null;
            })()}
          </>
        )}
      </Drawer>
    </div>
  );
}

function collectLinks(m: AnyObj): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (!v) return;
    if (typeof v === "string") { if (v.startsWith("http")) out.push(v); }
    else if (typeof v === "object") { const u = v.url || v.href || v.link; if (typeof u === "string") out.push(u); }
  };
  if (Array.isArray(m.evidence_urls)) m.evidence_urls.forEach(push);
  const sb = m.source_block;
  if (sb && Array.isArray(sb.links)) sb.links.forEach(push);
  return Array.from(new Set(out));
}
