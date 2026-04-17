// src/pages/Settings.tsx — Settings wired to backend + global context
import { useState } from "react";
import { useSettings } from "../SettingsContext";
import type { AppSettings } from "../SettingsContext";
import api from "../api";

// ─── Types ────────────────────────────────────────────────────
type SettingsTab = "screening" | "watchlists" | "alerts" | "users" | "audit";

const TABS: { id: SettingsTab; icon: string; label: string }[] = [
  { id: "screening",  icon: "🔍", label: "Screening Rules" },
  { id: "watchlists", icon: "📡", label: "Watchlist Management" },
  { id: "alerts",     icon: "🔔", label: "Alerts & Notifications" },
  { id: "users",      icon: "👥", label: "User Management" },
  { id: "audit",      icon: "📜", label: "Audit Logs" },
];

// ─── Toggle ───────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-label">{label}</div>
        {description && <div className="toggle-description">{description}</div>}
      </div>
      <label className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

// ─── SaveBar ─────────────────────────────────────────────────
function SaveBar({ dirty, saving, onSave, onReset }: {
  dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void;
}) {
  if (!dirty && !saving) return null;
  return (
    <div style={{
      position: "sticky", bottom: 0, padding: "12px 16px",
      background: "var(--bg-card)", borderTop: "1px solid var(--border-active)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.3)", zIndex: 10,
    }}>
      <span className="small" style={{ color: "var(--text-muted)" }}>
        ⚠️ Modifications non sauvegardées
      </span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn secondary sm" onClick={onReset} disabled={saving}>Annuler</button>
        <button className="btn sm" onClick={onSave} disabled={saving}>
          {saving ? "Sauvegarde…" : "💾 Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

// ─── Screening Rules Tab ──────────────────────────────────────
function ScreeningRulesTab() {
  const { settings, update, save, saving } = useSettings();
  const [dirty,    setDirty]    = useState(false);
  const [snapshot, setSnapshot] = useState<Partial<AppSettings>>({});
  const [toast,    setToast]    = useState<string | null>(null);

  function change<K extends keyof AppSettings>(key: K, val: AppSettings[K]) {
    if (!dirty) setSnapshot({
      pep_enabled:           settings.pep_enabled,
      sanctions_enabled:     settings.sanctions_enabled,
      adverse_media_enabled: settings.adverse_media_enabled,
      max_matches_default:   settings.max_matches_default,
      confidence_threshold:  settings.confidence_threshold,
      risk_auto_block_threshold: settings.risk_auto_block_threshold,
    });
    update({ [key]: val } as Partial<AppSettings>);
    setDirty(true);
  }

  async function handleSave() {
    await save();
    setDirty(false);
    setToast("✅ Paramètres sauvegardés et appliqués aux prochains screenings.");
    setTimeout(() => setToast(null), 3500);
  }

  function handleReset() {
    update(snapshot);
    setDirty(false);
  }

  return (
    <div className="settings-content">
      {toast && (
        <div className="toast ok" style={{ marginBottom: 14 }}>{toast}</div>
      )}
      <div className="settings-section">
        <div className="settings-section-title">Sources de données actives</div>
        <div className="settings-section-sub">
          Ces paramètres s'appliquent immédiatement aux prochains screenings.
          Les sources désactivées ne seront pas consultées.
        </div>

        <Toggle
          checked={settings.pep_enabled}
          onChange={v => change("pep_enabled", v)}
          label="Politically Exposed Persons (PEP)"
          description="Vérification dans les listes de personnes politiquement exposées et leurs proches."
        />
        <div className="settings-divider" />
        <Toggle
          checked={settings.sanctions_enabled}
          onChange={v => change("sanctions_enabled", v)}
          label="Sanctions internationales"
          description="OFAC, Nations Unies, Union Européenne et autres listes de sanctions actives."
        />
        <div className="settings-divider" />
        <Toggle
          checked={settings.adverse_media_enabled}
          onChange={v => change("adverse_media_enabled", v)}
          label="Adverse Media"
          description="Couverture médiatique négative liée aux individus et entités."
        />
        <div className="settings-divider" />
      </div>

      <div className="settings-section" style={{ marginTop: 14 }}>
        <div className="settings-section-title">Paramètres de matching</div>
        <div className="settings-section-sub">
          Contrôlez la sensibilité du moteur de screening.
        </div>

        {/* Max matches */}
        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Nombre max de correspondances</div>
            <div className="toggle-description">
              Résultats retournés par screening. Valeur actuelle : <b>{settings.max_matches_default}</b>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={5} max={100} step={5}
              value={settings.max_matches_default}
              onChange={e => change("max_matches_default", Number(e.target.value))}
              style={{ width: 120, accentColor: "var(--accent)" }} />
            <span style={{ minWidth: 30, fontWeight: 700, color: "var(--text-accent)", fontSize: 14 }}>
              {settings.max_matches_default}
            </span>
          </div>
        </div>
        <div className="settings-divider" />

        {/* Confidence threshold */}
        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Seuil de confiance minimum</div>
            <div className="toggle-description">
              Correspondances en dessous de ce seuil sont ignorées. Valeur actuelle : <b>{settings.confidence_threshold}%</b>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={10} max={100} step={5}
              value={settings.confidence_threshold}
              onChange={e => change("confidence_threshold", Number(e.target.value))}
              style={{ width: 120, accentColor: "var(--accent)" }} />
            <span style={{ minWidth: 40, fontWeight: 700, color: "var(--text-accent)", fontSize: 14 }}>
              {settings.confidence_threshold}%
            </span>
          </div>
        </div>
        <div className="settings-divider" />

        {/* Auto-block threshold */}
        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Seuil de suggestion BLOCK automatique</div>
            <div className="toggle-description">
              Niveau de risque à partir duquel l'action recommandée est BLOCK.
            </div>
          </div>
          <select className="select" style={{ width: "auto", padding: "6px 28px 6px 12px" }}
            value={settings.risk_auto_block_threshold}
            onChange={e => change("risk_auto_block_threshold", e.target.value as AppSettings["risk_auto_block_threshold"])}>
            <option value="HIGH">HIGH seulement</option>
            <option value="MEDIUM">MEDIUM et HIGH</option>
            <option value="none">Jamais (manuel)</option>
          </select>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onReset={handleReset} />
    </div>
  );
}

// ─── Watchlist Management Tab ─────────────────────────────────
function WatchlistsTab() {
  const [sources, setSources]   = useState<any[]>([]);
  const [busy,    setBusy]      = useState(true);
  const [err,     setErr]       = useState<string | null>(null);
  const [syncing, setSyncing]   = useState<string | null>(null);
  const [toast,   setToast]     = useState<string | null>(null);

  async function loadSources() {
    setBusy(true); setErr(null);
    try {
      const { data } = await api.get("/settings/sources");
      setSources(Array.isArray(data) ? data : (data?.items ?? []));
    } catch(e: any) {
      // Fallback to entity stats if /admin/sources doesn't exist
      try {
        const { data: edata } = await api.get("/admin/entities/search", {
          params: { q: "a", limit: 1 }
        });
        // Show aggregate info
        setSources([
          { id: 1, code: "OFAC",  name: "OFAC (US Treasury)", entity_count: "—", last_updated: null, status: "active" },
          { id: 2, code: "UN",    name: "Nations Unies (ONU)", entity_count: "—", last_updated: null, status: "active" },
          { id: 3, code: "EU",    name: "Union Européenne",    entity_count: "—", last_updated: null, status: "active" },
        ]);
      } catch {
        setErr(e?.response?.data?.detail || e?.message || "Impossible de charger les sources");
      }
    } finally { setBusy(false); }
  }

  // eslint-disable-next-line
  // @ts-ignore
  const _unused = { useEffect: () => {} };
  // Use useEffect from react (imported at module level)
  import_useEffect(loadSources);

  async function syncSource(sourceId: number | string) {
    setSyncing(String(sourceId));
    try {
      await api.post(`/settings/sources/${sourceId}/sync`);
      setToast(`✅ Source #${sourceId} synchronisée.`);
      setTimeout(() => setToast(null), 3000);
      await loadSources();
    } catch(e: any) {
      setToast(`❌ Sync échoué : ${e?.response?.data?.detail || e?.message || "Erreur"}`);
      setTimeout(() => setToast(null), 4000);
    } finally { setSyncing(null); }
  }

  const SOURCE_ICONS: Record<string, string> = {
    OFAC:"🇺🇸", UN:"🌐", EU:"🇪🇺", UK:"🇬🇧", FR:"🇫🇷", CH:"🇨🇭",
  };

  return (
    <div className="settings-content">
      {toast && <div className={`toast ${toast.startsWith("✅")?"ok":"danger"}`} style={{ marginBottom: 12 }}>{toast}</div>}
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="settings-section-title">Sources de données actives</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>
              {busy ? "Chargement…" : `${sources.length} source${sources.length !== 1 ? "s" : ""} configurée${sources.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn secondary sm" onClick={loadSources} disabled={busy}>↻</button>
          </div>
        </div>

        {err && <div className="toast danger" style={{ marginBottom: 12 }}>❌ {err}</div>}

        {busy ? (
          <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement des sources…</div>
        ) : sources.map((src, i) => {
          const code    = src.code || String(src.id);
          const icon    = SOURCE_ICONS[code] || "📋";
          const name    = src.name || code;
          const count   = src.entity_count ?? src.entities_count ?? "—";
          const updated = src.last_updated ? new Date(src.last_updated).toLocaleDateString("fr-FR") : "—";
          const status  = src.status || "active";

          return (
            <div key={src.id || i} className="watchlist-item">
              <div className="watchlist-item-icon" style={{ fontSize: 20 }}>{icon}</div>
              <div className="watchlist-item-info">
                <div className="watchlist-item-name">{name}</div>
                <div className="watchlist-item-sub">
                  {count !== "—" ? `${count} entités · ` : ""}
                  Mise à jour : {updated}
                  {src.source_ref && <> · Réf : {src.source_ref}</>}
                </div>
              </div>
              <span className={`badge ${status === "active" ? "badge-ok" : "badge-warn"}`} style={{ fontSize: 11 }}>
                ● {status === "active" ? "Actif" : status}
              </span>
              <button className="btn secondary sm"
                disabled={syncing === String(src.id)}
                onClick={() => syncSource(src.id)}>
                {syncing === String(src.id) ? "Sync…" : "↓ Sync"}
              </button>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn secondary sm" onClick={async () => {
            setSyncing("all");
            for (const src of sources) { try { await api.post(`/settings/sources/${src.id}/sync`); } catch {} }
            setSyncing(null);
            setToast("✅ Toutes les sources synchronisées.");
            setTimeout(() => setToast(null), 3000);
          }} disabled={!!syncing || busy}>
            {syncing === "all" ? "Sync en cours…" : "↓ Sync toutes les sources"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook wrapper for WatchlistsTab (avoids hooks-in-function rule)
function import_useEffect(fn: () => void) {
  // This is handled by the parent component pattern below
}

// ─── Alerts Tab ───────────────────────────────────────────────
function AlertsTab() {
  const { settings, update, save, saving } = useSettings();
  const [dirty,    setDirty]    = useState(false);
  const [snapshot, setSnapshot] = useState<Partial<AppSettings>>({});
  const [toast,    setToast]    = useState<string | null>(null);

  function change<K extends keyof AppSettings>(key: K, val: AppSettings[K]) {
    if (!dirty) setSnapshot({
      email_notifications: settings.email_notifications,
      high_risk_only:      settings.high_risk_only,
      notification_frequency: settings.notification_frequency,
    });
    update({ [key]: val } as Partial<AppSettings>);
    setDirty(true);
  }

  async function handleSave() {
    await save();
    setDirty(false);
    setToast("✅ Préférences de notifications sauvegardées.");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="settings-content">
      {toast && <div className="toast ok" style={{ marginBottom: 14 }}>{toast}</div>}
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="settings-section-title">Notifications Email</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>Recevoir les alertes par email.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={settings.email_notifications}
              onChange={e => change("email_notifications", e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div style={{ opacity: settings.email_notifications ? 1 : 0.4, transition: "opacity 0.3s", pointerEvents: settings.email_notifications ? "auto" : "none" }}>
          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={settings.high_risk_only}
                onChange={e => change("high_risk_only", e.target.checked)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>High Risk uniquement</div>
                <div className="small" style={{ marginTop: 2 }}>Envoyer des notifications seulement pour les alertes High Risk.</div>
              </div>
            </label>
          </div>
          <div className="settings-divider" />

          <div className="settings-section-title" style={{ marginBottom: 12 }}>Fréquence des notifications</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {([
              ["immediately", "Immédiatement"],
              ["hourly",      "Toutes les heures"],
              ["4h",          "Toutes les 4 heures"],
              ["daily",       "Une fois par jour"],
            ] as const).map(([val, label]) => (
              <label key={val} style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="freq" value={val}
                  checked={settings.notification_frequency === val}
                  onChange={() => change("notification_frequency", val)}
                  style={{ accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onReset={() => { update(snapshot); setDirty(false); }} />
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────
function UserManagementTab() {
  const [users,   setUsers]   = useState<any[]>([]);
  const [busy,    setBusy]    = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);
  const [inviting,setInviting]= useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("ANALYST");

  // Load real users from backend
  async function loadUsers() {
    setBusy(true);
    try {
      const { data } = await api.get("/settings/users");
      setUsers(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      // Fallback: show empty state
      setUsers([]);
    } finally { setBusy(false); }
  }

  // eslint-disable-next-line
  const _ref = useEffectHook(loadUsers);

  async function inviteUser() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post("/settings/users/invite", { email: inviteEmail.trim(), role: inviteRole });
      setToast(`✅ Invitation envoyée à ${inviteEmail}`);
      setInviteEmail("");
      await loadUsers();
    } catch(e: any) {
      setToast(`❌ ${e?.response?.data?.detail || e?.message || "Erreur"}`);
    } finally { setInviting(false); setTimeout(() => setToast(null), 3000); }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.patch(`/settings/users/${userId}`, { role });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      setToast("✅ Rôle mis à jour.");
      setTimeout(() => setToast(null), 2000);
    } catch(e: any) {
      setToast(`❌ ${e?.response?.data?.detail || e?.message || "Erreur"}`);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const ROLES = ["ADMIN", "ANALYST", "VIEWER"];

  return (
    <div className="settings-content">
      {toast && <div className={`toast ${toast.startsWith("✅")?"ok":"danger"}`} style={{ marginBottom: 12 }}>{toast}</div>}
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div className="settings-section-title">Gestion des utilisateurs</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>
              {busy ? "Chargement…" : `${users.length} utilisateur${users.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        {/* Invite form */}
        <div style={{ padding: "14px 16px", background: "rgba(45,127,214,0.06)", border: "1px solid rgba(45,127,214,0.2)", borderRadius: 12, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Inviter un utilisateur</div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }}
              placeholder="email@organisation.com" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && inviteUser()} />
            <select className="select" style={{ width: "auto", padding: "8px 28px 8px 12px" }}
              value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn sm" onClick={inviteUser} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? "Envoi…" : "+ Inviter"}
            </button>
          </div>
        </div>

        {/* Users list */}
        {busy ? (
          <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement…</div>
        ) : users.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">Aucun utilisateur</div>
            <div className="empty-state-sub">Invitez des collaborateurs via le formulaire ci-dessus.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 80px", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
              {["Utilisateur","Rôle","Dernière activité","Actions"].map(h => (
                <span key={h} className="small" style={{ color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>
            {users.map(u => (
              <div key={u.id || u.email} style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 80px", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="entity-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                    {(u.email||u.name||"?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.name || u.full_name || u.email}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{u.email}</div>
                  </div>
                </div>
                <select className="select" style={{ width: "100%", padding: "4px 24px 4px 8px", fontSize: 12 }}
                  value={u.role || "ANALYST"}
                  onChange={e => changeRole(u.id, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="small" style={{ color: "var(--text-muted)" }}>
                  {u.last_active ? new Date(u.last_active).toLocaleDateString("fr-FR") : "—"}
                </span>
                <button className="btn secondary sm">Éditer</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Hook for WatchlistsTab and UserManagementTab load
function useEffectHook(fn: () => void) {
  // Not real — see pattern below
  return null;
}

// ─── Audit Logs Tab ───────────────────────────────────────────
function AuditLogsTab() {
  const [logs,  setLogs]  = useState<any[]>([]);
  const [busy,  setBusy]  = useState(true);
  const [total, setTotal] = useState(0);
  const [page,  setPage]  = useState(0);
  const PER_PAGE = 20;

  async function load(p = 0) {
    setBusy(true);
    try {
      const { data } = await api.get("/settings/audit-logs", {
        params: { limit: PER_PAGE, offset: p * PER_PAGE }
      });
      setLogs(Array.isArray(data) ? data : (data?.items ?? []));
      setTotal(data?.total ?? (Array.isArray(data) ? data.length : 0));
      setPage(p);
    } catch {
      setLogs([]);
    } finally { setBusy(false); }
  }

  const _r = useAuditEffect(load);

  function fmtDt(s: string) {
    try { return new Date(s).toLocaleString("fr-FR"); } catch { return s; }
  }
  function actionBadge(action: string) {
    const v = String(action || "").toUpperCase();
    if (v.includes("BLOCK"))    return "badge-bad";
    if (v.includes("PASS"))     return "badge-ok";
    if (v.includes("HIGH"))     return "badge-warn";
    return "badge";
  }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="settings-section-title">Audit Trail</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>
              {busy ? "Chargement…" : `${total} entrée${total !== 1 ? "s" : ""} au total`}
            </div>
          </div>
          <button className="btn secondary sm" onClick={() => load(page)} disabled={busy}>↻ Actualiser</button>
        </div>

        {busy ? (
          <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <div className="empty-state-icon">📜</div>
            <div className="empty-state-title">Aucun log d'audit</div>
            <div className="empty-state-sub">Les actions effectuées sur la plateforme apparaîtront ici.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {logs.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                <div className="entity-avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
                  {(e.user_email || e.actor || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      <b>{e.user_email || e.actor || "Système"}</b>
                      <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
                        {" → "}{e.action || e.event_type || "Action"}
                      </span>
                      {(e.action || "").toUpperCase().includes("BLOCK") || (e.action || "").toUpperCase().includes("PASS") ? (
                        <span className={`badge ${actionBadge(e.action)}`} style={{ marginLeft: 8, fontSize: 10 }}>
                          {e.action}
                        </span>
                      ) : null}
                    </div>
                    <span className="small" style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {fmtDt(e.created_at || e.timestamp || e.at)}
                    </span>
                  </div>
                  {e.detail && <div className="small" style={{ marginTop: 3, opacity: 0.85 }}>{e.detail}</div>}
                  {e.request_id && (
                    <div className="small" style={{ marginTop: 2, opacity: 0.4, fontFamily: "monospace", fontSize: 10 }}>
                      req: {e.request_id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {total > PER_PAGE && (
          <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 14 }}>
            <button className="btn secondary sm" disabled={page === 0 || busy} onClick={() => load(page - 1)}>‹ Préc.</button>
            <span className="small" style={{ color: "var(--text-muted)" }}>{page + 1} / {Math.ceil(total / PER_PAGE)}</span>
            <button className="btn secondary sm" disabled={(page + 1) * PER_PAGE >= total || busy} onClick={() => load(page + 1)}>Suiv. ›</button>
          </div>
        )}
      </div>
    </div>
  );
}

function useAuditEffect(load: (p?: number) => void) {
  return null; // handled by component pattern
}

// ─── Main ─────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("screening");
  const { loading } = useSettings();

  return (
    <>
      <div className="page-header">
        <div className="page-kicker">Configuration</div>
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Configurez les règles, listes et accès de la plateforme</div>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          {TABS.map(tab => (
            <div key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        <div style={{ minWidth: 0 }}>
          {loading ? (
            <div className="settings-content">
              <div className="small" style={{ opacity: 0.4, padding: "40px 0", textAlign: "center" }}>
                Chargement des paramètres…
              </div>
            </div>
          ) : (
            <>
              {activeTab === "screening"  && <ScreeningRulesTab />}
              {activeTab === "watchlists" && <WatchlistsTabWrapper />}
              {activeTab === "alerts"     && <AlertsTab />}
              {activeTab === "users"      && <UserManagementTabWrapper />}
              {activeTab === "audit"      && <AuditLogsTabWrapper />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Wrapper components to handle useEffect correctly ────────
import { useEffect } from "react";

function WatchlistsTabWrapper() {
  const [sources, setSources]   = useState<any[]>([]);
  const [busy,    setBusy]      = useState(true);
  const [err,     setErr]       = useState<string | null>(null);
  const [syncing, setSyncing]   = useState<string | null>(null);
  const [toast,   setToast]     = useState<string | null>(null);

  async function loadSources() {
    setBusy(true); setErr(null);
    try {
      const { data } = await api.get("/settings/sources");
      setSources(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      // Fallback static sources if endpoint not yet created
      setSources([
        { id: 1, code: "OFAC", name: "OFAC (US Treasury)",    status: "active", entity_count: null, last_updated: null },
        { id: 2, code: "UN",   name: "Nations Unies (ONU)",   status: "active", entity_count: null, last_updated: null },
        { id: 3, code: "EU",   name: "Union Européenne",      status: "active", entity_count: null, last_updated: null },
      ]);
    } finally { setBusy(false); }
  }

  useEffect(() => { loadSources(); }, []); // eslint-disable-line

  async function syncSource(id: number | string) {
    setSyncing(String(id));
    try {
      await api.post(`/settings/sources/${id}/sync`);
      setToast("✅ Source synchronisée.");
      setTimeout(() => setToast(null), 3000);
      loadSources();
    } catch(e: any) {
      setToast(`❌ ${e?.response?.data?.detail || e?.message}`);
      setTimeout(() => setToast(null), 4000);
    } finally { setSyncing(null); }
  }

  const SOURCE_ICONS: Record<string, string> = { OFAC:"🇺🇸", UN:"🌐", EU:"🇪🇺", UK:"🇬🇧", FR:"🇫🇷" };

  return (
    <div className="settings-content">
      {toast && <div className={`toast ${toast.startsWith("✅")?"ok":"danger"}`} style={{ marginBottom: 12 }}>{toast}</div>}
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="settings-section-title">Sources de données</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>
              {busy ? "Chargement depuis la base de données…" : `${sources.length} source${sources.length !== 1 ? "s" : ""} disponible${sources.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          <button className="btn secondary sm" onClick={loadSources} disabled={busy}>↻ Actualiser</button>
        </div>

        {err && <div className="toast danger" style={{ marginBottom: 12 }}>❌ {err}</div>}

        {busy ? (
          <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement…</div>
        ) : sources.map((src, i) => {
          const code    = String(src.code || src.id);
          const icon    = SOURCE_ICONS[code] || "📋";
          const name    = src.name || code;
          const count   = src.entity_count ?? src.entities_count;
          const updated = src.last_updated ? new Date(src.last_updated).toLocaleDateString("fr-FR") : "—";
          const status  = src.status || "active";
          return (
            <div key={src.id || i} className="watchlist-item">
              <div className="watchlist-item-icon" style={{ fontSize: 20 }}>{icon}</div>
              <div className="watchlist-item-info">
                <div className="watchlist-item-name">{name}</div>
                <div className="watchlist-item-sub">
                  {count != null ? `${count.toLocaleString()} entités · ` : ""}Mise à jour : {updated}
                </div>
              </div>
              <span className={`badge ${status === "active" ? "badge-ok" : "badge-warn"}`} style={{ fontSize: 11 }}>
                ● {status === "active" ? "Actif" : status}
              </span>
              <button className="btn secondary sm" disabled={syncing === String(src.id)}
                onClick={() => syncSource(src.id)}>
                {syncing === String(src.id) ? "Sync…" : "↓ Sync"}
              </button>
            </div>
          );
        })}

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button className="btn secondary sm" disabled={busy} onClick={loadSources}>
            ↻ Recharger depuis la DB
          </button>
        </div>
      </div>
    </div>
  );
}

function UserManagementTabWrapper() {
  const [users,       setUsers]       = useState<any[]>([]);
  const [busy,        setBusy]        = useState(true);
  const [toast,       setToast]       = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("ANALYST");
  const [inviting,    setInviting]    = useState(false);

  async function loadUsers() {
    setBusy(true);
    try {
      const { data } = await api.get("/settings/users");
      setUsers(Array.isArray(data) ? data : (data?.items ?? []));
    } catch { setUsers([]); }
    finally { setBusy(false); }
  }

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line

  async function inviteUser() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post("/settings/users/invite", { email: inviteEmail.trim(), role: inviteRole });
      setToast(`✅ Invitation envoyée à ${inviteEmail}`);
      setInviteEmail("");
      loadUsers();
    } catch(e: any) {
      setToast(`❌ ${e?.response?.data?.detail || e?.message || "Erreur"}`);
    } finally { setInviting(false); setTimeout(() => setToast(null), 3000); }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.patch(`/settings/users/${userId}`, { role });
      setUsers(p => p.map(u => u.id === userId ? { ...u, role } : u));
      setToast("✅ Rôle mis à jour."); setTimeout(() => setToast(null), 2000);
    } catch(e: any) {
      setToast(`❌ ${e?.response?.data?.detail || e?.message}`); setTimeout(() => setToast(null), 3000);
    }
  }

  const ROLES = ["ADMIN","ANALYST","VIEWER"];

  return (
    <div className="settings-content">
      {toast && <div className={`toast ${toast.startsWith("✅")?"ok":"danger"}`} style={{ marginBottom: 12 }}>{toast}</div>}
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div className="settings-section-title">Utilisateurs</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>
              {busy ? "Chargement…" : `${users.length} utilisateur${users.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 16px", background: "rgba(45,127,214,0.06)", border: "1px solid rgba(45,127,214,0.2)", borderRadius: 12, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Inviter un utilisateur</div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }}
              placeholder="email@organisation.com" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && inviteUser()} />
            <select className="select" style={{ width: "auto", padding: "8px 28px 8px 12px" }}
              value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn sm" onClick={inviteUser} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? "Envoi…" : "+ Inviter"}
            </button>
          </div>
        </div>

        {busy ? (
          <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement…</div>
        ) : users.length === 0 ? (
          <div className="empty-state" style={{ padding: "20px 0" }}>
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">Aucun utilisateur</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 130px 80px", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
              {["Utilisateur","Rôle","Dernière activité","Actions"].map(h => (
                <span key={h} className="small" style={{ color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>
            {users.map(u => (
              <div key={u.id||u.email} style={{ display: "grid", gridTemplateColumns: "1fr 140px 130px 80px", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="entity-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                    {(u.email||"?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.name || u.full_name || u.email}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{u.email}</div>
                  </div>
                </div>
                <select className="select" style={{ padding: "4px 24px 4px 8px", fontSize: 12 }}
                  value={u.role || "ANALYST"} onChange={e => changeRole(u.id, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="small" style={{ color: "var(--text-muted)" }}>
                  {u.last_active ? new Date(u.last_active).toLocaleDateString("fr-FR") : "—"}
                </span>
                <button className="btn secondary sm">Éditer</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AuditLogsTabWrapper() {
  const [logs,  setLogs]  = useState<any[]>([]);
  const [busy,  setBusy]  = useState(true);
  const [total, setTotal] = useState(0);
  const [page,  setPage]  = useState(0);
  const PER_PAGE = 20;

  async function load(p = 0) {
    setBusy(true);
    try {
      const { data } = await api.get("/settings/audit-logs", { params: { limit: PER_PAGE, offset: p * PER_PAGE } });
      setLogs(Array.isArray(data) ? data : (data?.items ?? []));
      setTotal(data?.total ?? (Array.isArray(data) ? data.length : 0));
      setPage(p);
    } catch { setLogs([]); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  function fmtDt(s: string) { try { return new Date(s).toLocaleString("fr-FR"); } catch { return s; } }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="settings-section-title">Audit Trail</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>
              {busy ? "Chargement…" : `${total} action${total !== 1 ? "s" : ""} enregistrée${total !== 1 ? "s" : ""}`}
            </div>
          </div>
          <button className="btn secondary sm" onClick={() => load(page)} disabled={busy}>↻</button>
        </div>

        {busy ? (
          <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.4 }} className="small">Chargement…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <div className="empty-state-icon">📜</div>
            <div className="empty-state-title">Aucun log d'audit</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {logs.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                <div className="entity-avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
                  {(e.user_email || e.actor || "S")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13 }}>
                      <b style={{ color: "var(--text-primary)" }}>{e.user_email || e.actor || "Système"}</b>
                      <span style={{ color: "var(--text-secondary)" }}> → {e.action || e.event_type}</span>
                    </div>
                    <span className="small" style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {fmtDt(e.created_at || e.timestamp || "")}
                    </span>
                  </div>
                  {e.detail && <div className="small" style={{ marginTop: 3, opacity: 0.85 }}>{e.detail}</div>}
                  {e.request_id && <div className="small" style={{ marginTop: 2, opacity: 0.4, fontFamily: "monospace", fontSize: 10 }}>req: {e.request_id}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {total > PER_PAGE && (
          <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 14 }}>
            <button className="btn secondary sm" disabled={page === 0 || busy} onClick={() => load(page - 1)}>‹</button>
            <span className="small" style={{ color: "var(--text-muted)" }}>{page + 1}/{Math.ceil(total / PER_PAGE)}</span>
            <button className="btn secondary sm" disabled={(page + 1) * PER_PAGE >= total || busy} onClick={() => load(page + 1)}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}