// src/pages/backoffice/TenantNew.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createTenant } from "../../api.backoffice";

export default function TenantNew() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [domains, setDomains] = useState(""); // comma-separated
  const [activeUntil, setActiveUntil] = useState<string>("");

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const t = await createTenant({
        name: name.trim(),
        domains: domains.split(",").map((s) => s.trim()).filter(Boolean),
        active_until: activeUntil.trim() ? activeUntil.trim() : null,
      });
      nav(`/backoffice/tenants/${t.id}`, { replace: true });
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
          <div>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Backoffice
            </div>
            <div className="page-title">Nouvelle entreprise</div>
            <div className="page-subtitle">Créer un tenant, définir les domaines email, et une durée de vie.</div>
          </div>
          <div className="pill-row">
            <Link className="btn secondary" to="/backoffice/tenants">← Retour</Link>
            <button className="btn" onClick={submit} disabled={busy || !name.trim()}>
              {busy ? "Création…" : "Créer"}
            </button>
          </div>
        </div>

        {err ? <div className="toast">❌ {err}</div> : null}

        <div className="card" style={{ marginTop: 0, display: "grid", gap: 14 }}>
          <div>
            <div className="nice-label">Nom entreprise</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Danapay" />
          </div>

          <div>
            <div className="nice-label">Domaines email (séparés par virgule)</div>
            <input
              className="input"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="Ex: danapay.com, danapay.co"
            />
            <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>
              Utilisé pour reconnaître automatiquement l’entreprise à partir de l’email.
            </div>
          </div>

          <div>
            <div className="nice-label">Actif jusqu’au (optionnel)</div>
            <input className="input" type="date" value={activeUntil} onChange={(e) => setActiveUntil(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

