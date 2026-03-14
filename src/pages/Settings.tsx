// src/pages/Settings.tsx
import { useState } from "react";

// ─────────────────────────────────────────────
// Types & Tabs
// ─────────────────────────────────────────────
type SettingsTab = "screening" | "watchlists" | "alerts" | "users" | "audit";

const TABS: { id: SettingsTab; icon: string; label: string }[] = [
  { id: "screening",  icon: "🔍", label: "Screening Rules" },
  { id: "watchlists", icon: "📡", label: "Watchlist Management" },
  { id: "alerts",     icon: "🔔", label: "Alerts & Notifications" },
  { id: "users",      icon: "👥", label: "User Management" },
  { id: "audit",      icon: "📜", label: "Audit Logs" },
];

// ─────────────────────────────────────────────
// Toggle component
// ─────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
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

// ─────────────────────────────────────────────
// Screening Rules Tab
// ─────────────────────────────────────────────
function ScreeningRulesTab() {
  const [pepEnabled,    setPepEnabled]    = useState(true);
  const [sanctEnabled,  setSanctEnabled]  = useState(true);
  const [mediaEnabled,  setMediaEnabled]  = useState(true);
  const [saved,         setSaved]         = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Screening Rules</div>
        <div className="settings-section-sub">Configure les règles de screening appliquées à chaque contrôle.</div>

        <Toggle
          checked={pepEnabled}
          onChange={setPepEnabled}
          label="Politically Exposed Persons (PEP) Monitoring"
          description="Enable screening for politically exposed persons (PEPs) and close associates."
        />
        <div className="settings-divider" />

        <Toggle
          checked={sanctEnabled}
          onChange={setSanctEnabled}
          label="Sanctions Screening"
          description="Include global sanctions lists in screenings."
        />
        <div className="settings-divider" />

        <Toggle
          checked={mediaEnabled}
          onChange={setMediaEnabled}
          label="Adverse Media Screening"
          description="Check for negative news media coverage related to individuals and entities."
        />
        <div className="settings-divider" />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {saved && <span className="badge badge-ok">✓ Saved</span>}
          <button className="btn" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Watchlist Management Tab
// ─────────────────────────────────────────────
function WatchlistsTab() {
  const LISTS = [
    { id: "ofac",     icon: "🇺🇸", name: "OFAC (US)",          sub: "Last updated today",       status: "Active" },
    { id: "eu",       icon: "🇪🇺", name: "EU Sanctions List",  sub: "Last updated 2 days ago",  status: "Active" },
    { id: "internal", icon: "🏢", name: "Internal Custom List", sub: "Custom entries",           status: "Active" },
  ];

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Custom Lists</div>
        <div className="settings-section-sub">Gérez vos listes de surveillance personnalisées et sources externes.</div>

        {LISTS.map(list => (
          <div key={list.id} className="watchlist-item">
            <div className="watchlist-item-icon">{list.icon}</div>
            <div className="watchlist-item-info">
              <div className="watchlist-item-name">{list.name}</div>
              <div className="watchlist-item-sub">{list.sub}</div>
            </div>
            <span className="badge badge-ok" style={{ fontSize: 11 }}>● {list.status}</span>
            <button className="btn secondary sm">Sync Lists ↓</button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn secondary sm">Sync Lists</button>
          <button className="btn sm">+ Add Custom List</button>
          <button className="btn secondary sm">Manage Sources</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Alerts & Notifications Tab
// ─────────────────────────────────────────────
function AlertsTab() {
  const [emailEnabled,  setEmailEnabled]  = useState(true);
  const [highRiskOnly,  setHighRiskOnly]  = useState(true);
  const [frequency,     setFrequency]     = useState<"immediately" | "hourly" | "4h" | "daily">("immediately");
  const [saved,         setSaved]         = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="settings-section-title">Enable Email Notifications</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>Recevoir les alertes par email.</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label className="toggle-switch">
              <input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
            {saved && <span className="badge badge-ok">✓ Saved</span>}
            <button className="btn sm" onClick={save}>Save Changes</button>
          </div>
        </div>

        <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", marginBottom: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={highRiskOnly} onChange={e => setHighRiskOnly(e.target.checked)} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>High Risk Matches</div>
              <div className="small" style={{ marginTop: 2 }}>Enable batch notifications related to your case.</div>
            </div>
          </label>
        </div>

        <div className="settings-divider" />

        <div className="settings-section-title" style={{ marginBottom: 12 }}>Notification Frequency</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {([
            ["immediately", "Immediately"],
            ["hourly",      "Every Hour"],
            ["4h",          "Every 4 Hours"],
            ["daily",       "Once a Day"],
          ] as const).map(([val, label]) => (
            <label key={val} style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                name="freq"
                value={val}
                checked={frequency === val}
                onChange={() => setFrequency(val)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// User Management Tab
// ─────────────────────────────────────────────
const USERS = [
  { name: "Alice Martin",   email: "alice@company.com",   role: "Admin",   activity: "1 hour ago" },
  { name: "Michel Dubois",  email: "michel@company.com",  role: "Analyst", activity: "2 hours ago" },
  { name: "Amira Lefevre",  email: "amira@company.com",   role: "Analyst", activity: "30 min ago" },
];

function UserManagementTab() {
  return (
    <div className="settings-content">
      <div className="settings-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div className="settings-section-title">User Roles</div>
            <div className="settings-section-sub" style={{ marginBottom: 0 }}>Gérez les accès et permissions des utilisateurs.</div>
          </div>
          <button className="btn sm">+ Invite User</button>
        </div>

        {/* Roles Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
          <span className="small" style={{ color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Name</span>
          <span className="small" style={{ color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Role</span>
          <span className="small" style={{ color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Last Activity</span>
          <span className="small" style={{ color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Actions</span>
        </div>

        {USERS.map(u => (
          <div key={u.email} style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="sidebar-user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                {u.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{u.email}</div>
              </div>
            </div>
            <span className="badge" style={u.role === "Admin" ? { background: "var(--accent-light)", borderColor: "var(--border-active)", color: "var(--text-accent)" } : {}}>
              {u.role}
            </span>
            <span className="small">{u.activity}</span>
            <button className="btn secondary sm">Edit ›</button>
          </div>
        ))}

        <div className="settings-divider" />
        <div className="settings-section-title" style={{ marginBottom: 12 }}>Users List</div>

        {USERS.map(u => (
          <div key={u.email + "_list"} className="user-row">
            <div className="user-row-avatar">{u.name.split(" ").map(n => n[0]).join("")}</div>
            <div className="user-row-info" style={{ flex: 1 }}>
              <div className="user-row-name">{u.name}</div>
              <div className="user-row-email">{u.email}</div>
            </div>
            <span className="user-row-activity">{u.activity}</span>
            <button className="btn secondary sm">Edit</button>
            <button className="icon-btn" title="More">···</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Audit Logs Tab
// ─────────────────────────────────────────────
const AUDIT_ENTRIES = [
  { at: "2024-05-01 14:32", user: "Alice Martin",  action: "Screening lancé",         detail: "Jean Dupont — High Risk" },
  { at: "2024-05-01 13:15", user: "Michel Dubois", action: "Décision: PASS",           detail: "Maria Ivanova — commentaire: Faux positif vérifié" },
  { at: "2024-05-01 12:02", user: "Amira Lefevre", action: "Screening lancé",          detail: "Ahmed Al-Farsi — Medium Risk" },
  { at: "2024-04-30 16:40", user: "Alice Martin",  action: "Paramètres modifiés",      detail: "PEP Monitoring activé" },
  { at: "2024-04-30 09:11", user: "Michel Dubois", action: "Décision: BLOCK",          detail: "Robert Chen — commentaire: Correspondance confirmée sur liste OFAC" },
  { at: "2024-04-29 17:23", user: "Amira Lefevre", action: "Utilisateur invité",       detail: "louis.morel@company.com — Analyst" },
];

function AuditLogsTab() {
  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Audit Logs</div>
        <div className="settings-section-sub">Historique complet des actions effectuées sur la plateforme.</div>

        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {AUDIT_ENTRIES.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
              <div className="entity-avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
                {e.user.split(" ").map(n => n[0]).join("")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {e.user} &nbsp;
                    <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>→ {e.action}</span>
                  </div>
                  <span className="small" style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{e.at}</span>
                </div>
                <div className="small" style={{ marginTop: 3, opacity: 0.85 }}>{e.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("screening");

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-kicker">Configuration</div>
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Configurez les règles, listes et accès de la plateforme</div>
      </div>

      {/* Layout */}
      <div className="settings-layout">
        {/* Sidebar Tabs */}
        <div className="settings-sidebar">
          {TABS.map(tab => (
            <div
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === "screening"  && <ScreeningRulesTab />}
          {activeTab === "watchlists" && <WatchlistsTab />}
          {activeTab === "alerts"     && <AlertsTab />}
          {activeTab === "users"      && <UserManagementTab />}
          {activeTab === "audit"      && <AuditLogsTab />}
        </div>
      </div>
    </>
  );
}