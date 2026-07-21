// Coquille applicative — refonte UX (menu groupé, noms naturels, header clair).
import { useEffect, useState, type ComponentType } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home, UserPlus, ClipboardList, Radio, FileBarChart, Settings2, Banknote,
  LayoutDashboard, AlertTriangle, Gauge, ArrowLeftRight, Building2, Network, Waves,
  LogOut, Moon, Sun, Menu, ShieldCheck,
} from "lucide-react";
import { getToken, clearToken } from "../auth";
import { listAlerts, getMyPermissions } from "../api";
import { NAV } from "../ui";

type Item = { to: string; label: string; icon: ComponentType<{ size?: number }>; badge?: number; exact?: boolean };

function payload(): any | null {
  const t = getToken(); if (!t) return null;
  try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
}
function active(path: string, to: string, exact?: boolean) {
  return exact ? path === to : path === to || path.startsWith(to + "/");
}

const TITLES: Record<string, string> = {
  "/dashboard": NAV.home, "/analyst": NAV.verify, "/verify-transaction": NAV.verifyTxn,
  "/screenings": NAV.verifications, "/watchlists": NAV.watchlists, "/reports": NAV.reports, "/settings": NAV.settings,
  "/compliance": NAV.compliance, "/alerts": NAV.alerts, "/risk-scoring": NAV.risk, "/transactions": NAV.monitoring,
  "/beneficial-owners": NAV.beneficialOwners, "/offshore": NAV.offshore,
};

export default function AppLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const p = payload();
  const isAdmin = p?.is_super_admin || p?.role === "ADMIN";

  const [theme, setTheme] = useState(() => localStorage.getItem("ds-theme") || "light");
  const [open, setOpen] = useState(false);
  const [openAlerts, setOpenAlerts] = useState(0);
  // Accès complet (Conformité) : super-admin, ou permission de gestion des alertes.
  const [fullAccess, setFullAccess] = useState<boolean>(!!(p?.is_super_admin));

  useEffect(() => {
    document.documentElement.setAttribute("data-ds-theme", theme);
    // synchronise aussi l'ancien attribut (pages legacy comme « Vérifier une personne »)
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("ds-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    getMyPermissions()
      .then((r) => setFullAccess(!!r.is_super_admin || r.permissions.includes("*") || r.permissions.includes("alerts:manage")))
      .catch(() => { /* garde la valeur par défaut */ });
  }, []);
  useEffect(() => {
    if (!fullAccess) { setOpenAlerts(0); return; }
    listAlerts({ status: "OPEN" })
      .then((a) => setOpenAlerts(Array.isArray(a) ? a.length : 0))
      .catch(() => { /* silencieux */ });
  }, [loc.pathname, fullAccess]);

  // Principal = travail opérationnel : lancer les vérifications KYC / KYS / KYT.
  const main: Item[] = [
    { to: "/dashboard", label: NAV.home, icon: Home, exact: true },
    { to: "/analyst", label: NAV.verify, icon: UserPlus },
    { to: "/verify-transaction", label: NAV.verifyTxn, icon: Banknote },
    { to: "/screenings", label: NAV.verifications, icon: ClipboardList },
    { to: "/reports", label: NAV.reports, icon: FileBarChart },
  ];
  // Conformité = supervision, surveillance, listes & décisions (accès complet uniquement).
  const compliance: Item[] = [
    { to: "/compliance", label: NAV.compliance, icon: LayoutDashboard },
    { to: "/alerts", label: NAV.alerts, icon: AlertTriangle, badge: openAlerts || undefined },
    { to: "/transactions", label: NAV.monitoring, icon: ArrowLeftRight },
    { to: "/beneficial-owners", label: NAV.beneficialOwners, icon: Network },
    { to: "/offshore", label: NAV.offshore, icon: Waves },
    { to: "/watchlists", label: NAV.watchlists, icon: Radio },
    { to: "/risk-scoring", label: NAV.risk, icon: Gauge },
  ];

  function NavLink({ item }: { item: Item }) {
    const Icon = item.icon;
    return (
      <Link to={item.to} className={`ds-nav-item ${active(loc.pathname, item.to, item.exact) ? "active" : ""}`}>
        <Icon size={19} /><span>{item.label}</span>
        {item.badge ? <span className="ds-nav-badge">{item.badge}</span> : null}
      </Link>
    );
  }

  return (
    <div className="ds-shell ds-root">
      <aside className={`ds-side ${open ? "open" : ""}`}>
        <Link to="/dashboard" className="ds-brand">
          <div>
            <div className="ds-brand-name">Simandou Conformité</div>
            <div className="ds-brand-sub">Lutte anti-blanchiment · BCRG</div>
          </div>
        </Link>

        <nav className="ds-nav">
          <div className="ds-nav-group">Principal</div>
          {main.map((i) => <NavLink key={i.to} item={i} />)}
          {fullAccess && (
            <>
              <div className="ds-nav-group">Conformité (LBC/FT)</div>
              {compliance.map((i) => <NavLink key={i.to} item={i} />)}
            </>
          )}
          {isAdmin && (
            <>
              <div className="ds-nav-group">Administration</div>
              <Link to="/settings" className={`ds-nav-item ${active(loc.pathname, "/settings") ? "active" : ""}`}>
                <Settings2 size={19} /><span>{NAV.settings}</span>
              </Link>
              <Link to="/backoffice/tenants" className={`ds-nav-item ${active(loc.pathname, "/backoffice") ? "active" : ""}`}>
                <Building2 size={19} /><span>Espace administrateur</span>
              </Link>
            </>
          )}
        </nav>

        <div className="ds-side-foot">
          <button className="ds-btn ds-btn--ghost ds-btn--block" onClick={() => { clearToken(); nav("/login"); }}
            style={{ justifyContent: "flex-start", color: "var(--danger)" }}>
            <LogOut size={17} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="ds-main">
        <header className="ds-topbar">
          <button className="ds-icon-btn ds-mobile-menu" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <Menu size={18} />
          </button>
          <div>
            <div className="ds-crumb"><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> Plateforme de conformité</div>
            <div className="ds-topbar-title">{TITLES[loc.pathname] || "Console"}</div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="ds-icon-btn" title={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
        <main className="ds-content"><Outlet /></main>
      </div>
    </div>
  );
}
