// src/pages/backoffice/TenantDetails.tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTenant, updateTenant } from "../../api.backoffice";
import type { Tenant } from "../../api.backoffice";

export default function TenantDetails() {
  const { tenantId } = useParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Tenant | null>(null);

  async function load() {
    if (!tenantId) return;
    setBusy(true);
    setErr(null);
    try {
      setT(await getTenant(tenantId));
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || String(e));
      setT(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [tenantId]);

  async function toggleSuspend() {
    if (!tenantId || !t) return;
    const next = String(t.status).toUpperCase() === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setBusy(true);
    setErr(null);
    try {
      const upd = await updateTenant(tenantId, { status: next });
      setT(upd);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-inner">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Backoffice
            </div>
            <div className="page-title">Entreprise</div>
            <div className="page-subtitle">{busy ? "Chargement…" : (t?.name || "—")}</div>
          </div>

          <div className="pill-row">
            <Link className="btn secondary" to="/backoffice/tenants">← Entreprises</Link>
            <button className="btn secondary" onClick={load} disabled={busy}>Refresh</button>
            <button className="btn" onClick={toggleSuspend} disabled={busy || !t}>
              {String(t?.status).toUpperCase() === "ACTIVE" ? "Suspendre" : "Réactiver"}
            </button>
          </div>
        </div>

        {err ? <div className="toast">❌ {err}</div> : null}

        {!t ? (
          <div className="card" style={{ marginTop: 0 }}>
            <div className="small" style={{ opacity: 0.85 }}>{busy ? "Chargement…" : "Introuvable."}</div>
          </div>
        ) : (
          <div className="grid-2">
            <div className="screen">
              <div className="card" style={{ marginTop: 0 }}>
                <div style={{ fontWeight: 900 }}>{t.name}</div>
                <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>
                  Statut: <b>{t.status}</b><br />
                  Actif jusqu’au: <b>{t.active_until || "illimité"}</b><br />
                  Domaines: <b>{t.domains?.length ? t.domains.join(", ") : "—"}</b>
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Gestion</div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <Link className="btn secondary" to={`/backoffice/tenants/${t.id}/users`}>👤 Utilisateurs</Link>
                  <Link className="btn secondary" to={`/backoffice/tenants/${t.id}/invitations`}>✉️ Invitations</Link>
                </div>
              </div>
            </div>

            <div className="screen">
              <div className="card" style={{ marginTop: 0 }}>
                <div style={{ fontWeight: 900 }}>Notes</div>
                <div className="small" style={{ opacity: 0.85, lineHeight: 1.6, marginTop: 8 }}>
                  MVP backoffice : on gère la société, ses domaines email, son statut et sa durée de vie,
                  puis les utilisateurs + invitations sur les écrans dédiés.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

