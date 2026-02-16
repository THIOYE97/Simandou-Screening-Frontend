// src/pages/backoffice/TenantsList.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listTenants } from "../../api.backoffice";
import type { Tenant } from "../../api.backoffice";

function Badge({ children, className }: { children: any; className?: string }) {
  return <span className={className || "badge"}>{children}</span>;
}

function statusTone(status?: string) {
  const v = String(status || "").toUpperCase();
  if (v === "ACTIVE") return "badge badge-ok";
  if (v === "SUSPENDED") return "badge badge-warn";
  if (v === "EXPIRED") return "badge badge-bad";
  return "badge";
}

export default function TenantsList() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Tenant[]>([]);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await listTenants({ q: q || undefined, limit, offset });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || String(e));
      setItems([]);
      setTotal(0);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const subtitle = useMemo(() => {
    if (busy) return "Chargement…";
    return `${total} entreprise(s)`;
  }, [busy, total]);

  return (
    <div className="page">
      <div className="page-inner">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Backoffice
            </div>
            <div className="page-title">Entreprises</div>
            <div className="page-subtitle">{subtitle}</div>
          </div>

          <div className="pill-row">
            <Link className="btn secondary" to="/backoffice/tenants/new">+ Nouvelle entreprise</Link>
            <button className="btn secondary" onClick={load} disabled={busy}>
              {busy ? "Actualisation…" : "Refresh"}
            </button>
          </div>
        </div>

        {err ? <div className="toast">❌ {err}</div> : null}

        <div className="card" style={{ marginTop: 0 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (nom, domaine)…"
              style={{ maxWidth: 360 }}
            />
            <button className="btn" onClick={() => { setOffset(0); load(); }} disabled={busy}>
              🔎 Rechercher
            </button>
          </div>

          <div style={{ height: 12 }} />

          {items.length === 0 ? (
            <div className="small" style={{ opacity: 0.85 }}>{busy ? "Chargement…" : "Aucune entreprise."}</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((t) => (
                <Link
                  key={t.id}
                  to={`/backoffice/tenants/${t.id}`}
                  className="card"
                  style={{ textDecoration: "none" }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>{t.name}</div>
                      <div className="small" style={{ opacity: 0.85, marginTop: 4 }}>
                        {t.domains?.length ? <>Domaines: <b>{t.domains.join(", ")}</b> · </> : null}
                        {t.active_until ? <>Actif jusqu’au: <b>{t.active_until}</b></> : <span>Actif: <b>illimité</b></span>}
                      </div>
                    </div>
                    <Badge className={statusTone(t.status)}>Statut: <b style={{ marginLeft: 6 }}>{t.status}</b></Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div style={{ height: 12 }} />

          <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
            <button className="btn secondary" disabled={!canPrev || busy} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
              ← Précédent
            </button>
            <div className="small" style={{ opacity: 0.85 }}>
              {total ? `Page ${Math.floor(offset / limit) + 1}` : "—"}
            </div>
            <button className="btn secondary" disabled={!canNext || busy} onClick={() => setOffset((o) => o + limit)}>
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

