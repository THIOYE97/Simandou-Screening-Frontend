// Journal de connexions — console de sécurité (super-administrateur).
//
// Trois lectures d'une même question, volontairement séparées :
//   · Journal          — qui a TENTÉ d'accéder, réussite comme échec ;
//   · Sessions ouvertes — qui est connecté MAINTENANT ;
//   · Comptes           — qui ne s'est JAMAIS connecté (le plus révélateur
//                         quand on vient de remettre des accès).
import { useEffect, useState } from "react";
import {
  ShieldAlert, LogIn, XCircle, Users, MapPin, RefreshCw, Monitor,
} from "lucide-react";
import {
  getLoginEvents, getLoginSummary, getActiveSessions, getAccounts,
  type LoginEvent, type LoginSummary, type ActiveSession, type AccountRow,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, Badge, Input, Select,
  EmptyState, SkeletonRows, StatCard, Pagination, PAGE_SIZE, useUI, fmtDate,
} from "../ui";

type Onglet = "journal" | "sessions" | "comptes";

/** Rend un user-agent lisible : on ne garde que ce qui identifie l'appareil. */
function appareil(ua?: string | null): string {
  if (!ua) return "—";
  const nav =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    /python-requests|curl|httpx/i.test(ua) ? "Script" : "Navigateur";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${nav} · ${os}` : nav;
}

function TonEvenement({ e }: { e: LoginEvent }) {
  if (e.event === "LOGIN_FAILED") return <Badge tone="critical">{e.event_label}</Badge>;
  if (e.event === "LOGIN_OK") return <Badge tone="low">{e.event_label}</Badge>;
  return <Badge tone="neutral">{e.event_label}</Badge>;
}

export default function SecurityLog() {
  const { toast } = useUI();
  const [onglet, setOnglet] = useState<Onglet>("journal");

  const [resume, setResume] = useState<LoginSummary | null>(null);
  const [events, setEvents] = useState<LoginEvent[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtre, setFiltre] = useState("");
  const [recherche, setRecherche] = useState("");
  const [inconnusSeuls, setInconnusSeuls] = useState(false);

  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [comptes, setComptes] = useState<AccountRow[] | null>(null);

  async function chargerJournal() {
    setEvents(null);
    try {
      const r = await getLoginEvents({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        event: filtre || undefined,
        email: recherche.trim() || undefined,
        only_new_context: inconnusSeuls || undefined,
      });
      setEvents(r.items);
      setTotal(r.total);
    } catch {
      toast("Journal indisponible", "error");
      setEvents([]);
    }
  }

  async function chargerResume() {
    try { setResume(await getLoginSummary()); } catch { /* les tuiles restent vides */ }
  }

  useEffect(() => { chargerResume(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (onglet === "journal") chargerJournal();
  }, [onglet, page, filtre, inconnusSeuls]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onglet === "sessions" && sessions === null) {
      getActiveSessions().then(setSessions).catch(() => { setSessions([]); toast("Sessions indisponibles", "error"); });
    }
    if (onglet === "comptes" && comptes === null) {
      getAccounts().then(setComptes).catch(() => { setComptes([]); toast("Comptes indisponibles", "error"); });
    }
  }, [onglet]); // eslint-disable-line react-hooks/exhaustive-deps

  function rafraichir() {
    chargerResume();
    if (onglet === "journal") chargerJournal();
    if (onglet === "sessions") { setSessions(null); getActiveSessions().then(setSessions).catch(() => setSessions([])); }
    if (onglet === "comptes") { setComptes(null); getAccounts().then(setComptes).catch(() => setComptes([])); }
  }

  return (
    <div>
      <PageHeader
        icon={<ShieldAlert size={22} />}
        title="Journal de connexions"
        subtitle="Accès à la plateforme : tentatives, sessions ouvertes et comptes"
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={rafraichir}>
            Actualiser
          </Button>
        }
      />

      <div className="ds-grid ds-grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={<LogIn size={20} />} value={String(resume?.logins_24h ?? "—")}
          label="Connexions (24 h)" />
        <StatCard icon={<Users size={20} />} value={String(resume?.users_7d ?? "—")}
          label="Comptes actifs (7 j)" />
        <StatCard icon={<XCircle size={20} />} value={String(resume?.failures_24h ?? "—")}
          label="Échecs (24 h)" tone="var(--risk-high)" />
        <StatCard icon={<MapPin size={20} />} value={String(resume?.new_contexts_7d ?? "—")}
          label="Contextes inconnus (7 j)" tone="var(--risk-high)" />
      </div>

      {resume?.last_login && (
        <div className="ds-small ds-muted" style={{ marginBottom: 16 }}>
          Dernière connexion : <strong>{resume.last_login.email || "—"}</strong>
          {" · "}{fmtDate(resume.last_login.created_at)}
          {resume.last_login.ip ? ` · ${resume.last_login.ip}` : ""}
        </div>
      )}

      <div className="ds-row" style={{ gap: 8, marginBottom: 16 }}>
        {([
          ["journal", "Journal"],
          ["sessions", "Sessions ouvertes"],
          ["comptes", "Comptes"],
        ] as Array<[Onglet, string]>).map(([cle, libelle]) => (
          <Button key={cle} variant={onglet === cle ? "primary" : "secondary"}
            onClick={() => setOnglet(cle)}>{libelle}</Button>
        ))}
      </div>

      {onglet === "journal" && (
        <Card pad0>
          <div style={{ padding: "18px 22px 0" }}>
            <CardTitle sub="Réussites et échecs, du plus récent au plus ancien">
              Tentatives d'accès
            </CardTitle>
            <div className="ds-row ds-wrap" style={{ gap: 10, marginBottom: 14 }}>
              <div style={{ maxWidth: 260, flex: 1 }}>
                <Input value={recherche} placeholder="Adresse électronique…"
                  onChange={(e) => setRecherche(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); chargerJournal(); } }} />
              </div>
              <div style={{ maxWidth: 220 }}>
                <Select value={filtre} onChange={(e) => { setPage(1); setFiltre(e.target.value); }}>
                  <option value="">Tous les événements</option>
                  <option value="LOGIN_OK">Connexions réussies</option>
                  <option value="LOGIN_FAILED">Échecs de connexion</option>
                  <option value="LOGOUT">Déconnexions</option>
                  <option value="REFRESH">Sessions prolongées</option>
                </Select>
              </div>
              <Button variant={inconnusSeuls ? "primary" : "secondary"}
                onClick={() => { setPage(1); setInconnusSeuls((v) => !v); }}>
                Contextes inconnus
              </Button>
            </div>
          </div>

          {events === null ? <SkeletonRows rows={6} /> : events.length === 0 ? (
            <div style={{ padding: "0 22px 22px" }}>
              <EmptyState icon={<ShieldAlert size={26} />} title="Aucune tentative enregistrée"
                subtitle="Le journal se remplit à la première connexion suivant la mise en service." />
            </div>
          ) : (
            <>
              <div className="ds-table-wrap" style={{ border: "none" }}>
                <table className="ds-table">
                  <thead><tr>
                    <th>Date</th><th>Compte</th><th>Événement</th>
                    <th>Adresse IP</th><th>Appareil</th>
                  </tr></thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id}>
                        <td className="ds-small">{fmtDate(e.created_at)}</td>
                        <td>
                          <div style={{ fontWeight: 650 }}>{e.full_name || e.email || "—"}</div>
                          {e.full_name && (
                            <div className="ds-small ds-muted" style={{ marginTop: 2 }}>{e.email}</div>
                          )}
                          {e.tenant_name && (
                            <div className="ds-small ds-muted">{e.tenant_name}</div>
                          )}
                        </td>
                        <td>
                          <TonEvenement e={e} />
                          {e.reason_label && (
                            <div className="ds-small ds-muted" style={{ marginTop: 3 }}>
                              {e.reason_label}
                            </div>
                          )}
                        </td>
                        <td className="ds-small">
                          {e.ip || "—"}
                          {e.is_new_context && (
                            <div style={{ marginTop: 3 }}>
                              <Badge tone="high">Contexte inconnu</Badge>
                            </div>
                          )}
                        </td>
                        <td className="ds-small ds-muted" title={e.user_agent || ""}>
                          {appareil(e.user_agent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "0 22px 18px" }}>
                <Pagination page={page} total={total} onPage={setPage} />
              </div>
            </>
          )}
        </Card>
      )}

      {onglet === "sessions" && (
        <Card pad0>
          <div style={{ padding: "18px 22px 0" }}>
            <CardTitle sub="Jetons de session encore valides — révoqués à la déconnexion">
              Sessions ouvertes
            </CardTitle>
          </div>
          {sessions === null ? <SkeletonRows rows={4} /> : sessions.length === 0 ? (
            <div style={{ padding: "0 22px 22px" }}>
              <EmptyState icon={<Monitor size={26} />} title="Aucune session ouverte"
                subtitle="Personne n'est connecté en ce moment." />
            </div>
          ) : (
            <div className="ds-table-wrap" style={{ border: "none" }}>
              <table className="ds-table">
                <thead><tr>
                  <th>Compte</th><th>Ouverte le</th><th>Expire le</th>
                  <th>Adresse IP</th><th>Appareil</th>
                </tr></thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 650 }}>{s.full_name || s.email || "—"}</div>
                        <div className="ds-small ds-muted" style={{ marginTop: 2 }}>{s.email}</div>
                      </td>
                      <td className="ds-small">{fmtDate(s.issued_at)}</td>
                      <td className="ds-small ds-muted">{fmtDate(s.expires_at)}</td>
                      <td className="ds-small">{s.ip || "—"}</td>
                      <td className="ds-small ds-muted" title={s.user_agent || ""}>
                        {appareil(s.user_agent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {onglet === "comptes" && (
        <Card pad0>
          <div style={{ padding: "18px 22px 0" }}>
            <CardTitle sub="Un compte sans dernière connexion n'a jamais servi">
              Comptes et dernière connexion
            </CardTitle>
          </div>
          {comptes === null ? <SkeletonRows rows={5} /> : comptes.length === 0 ? (
            <div style={{ padding: "0 22px 22px" }}>
              <EmptyState icon={<Users size={26} />} title="Aucun compte" />
            </div>
          ) : (
            <div className="ds-table-wrap" style={{ border: "none" }}>
              <table className="ds-table">
                <thead><tr>
                  <th>Compte</th><th>Organisation</th><th>État</th>
                  <th>Dernière connexion</th><th>Depuis</th>
                </tr></thead>
                <tbody>
                  {comptes.map((c) => (
                    <tr key={c.id} style={{ opacity: c.is_active === false ? 0.55 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 650 }}>{c.full_name || c.email}</div>
                        <div className="ds-small ds-muted" style={{ marginTop: 2 }}>{c.email}</div>
                      </td>
                      <td className="ds-small ds-muted">{c.tenant_name || "—"}</td>
                      <td>
                        {c.is_active === false || c.status !== "ACTIVE"
                          ? <Badge tone="neutral">{c.status || "Désactivé"}</Badge>
                          : <Badge tone="low">Actif</Badge>}
                      </td>
                      <td className="ds-small">
                        {c.last_login_at
                          ? fmtDate(c.last_login_at)
                          : <Badge tone="high">Jamais connecté</Badge>}
                      </td>
                      <td className="ds-small ds-muted">{c.last_login_ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
