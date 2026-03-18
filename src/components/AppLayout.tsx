// src/components/AppLayout.tsx
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getToken, clearToken } from "../auth";
import { getDashboardStats, listCases } from "../api";
import logo from "../assets/simandou_screening_logo1.png";

function getPayload(): any | null {
  const t = getToken();
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

type NavItem = {
  to: string;
  label: string;
  icon: string;
  badge?: number;
  exact?: boolean;
};

function isActive(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to;
  return pathname.startsWith(to);
}

function getInitials(name?: string): string {
  if (!name) return "A";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPageMeta(pathname: string) {

  if (pathname === "/dashboard")
    return { kicker: "Vue globale", title: "Tableau de bord" };

  if (pathname === "/analyst")
    return { kicker: "AML / PEP", title: "Nouveau screening" };

  if (pathname.startsWith("/screenings"))
    return { kicker: "AML / PEP", title: "Historique des screenings" };

  if (pathname.startsWith("/cases"))
    return { kicker: "Investigation", title: "Gestion des dossiers" };

  if (pathname === "/watchlists")
    return { kicker: "Surveillance", title: "Listes de surveillance" };

  if (pathname === "/reports")
    return { kicker: "Analyse", title: "Rapports" };

  if (pathname === "/settings")
    return { kicker: "Configuration", title: "Paramètres" };

  return { kicker: "", title: "Console" };
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const payload = getPayload();
  const userEmail = getUserEmail(payload);
  const userName = userEmail.split("@")[0];

  const { kicker, title } = getPageMeta(location.pathname);

  const [pendingScreenings, setPendingScreenings] = useState(0);
  const [openCases, setOpenCases] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const [theme, setTheme] = useState(
  localStorage.getItem("theme") || "dark"
);
useEffect(() => {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);

function toggleTheme(){
  setTheme(theme === "dark" ? "light" : "dark");
}

function getUserEmail(payload:any):string{
  if(!payload) return "admin@local";

  return (
    payload.email ||
    payload.preferred_username ||
    payload.username ||
    payload.sub ||
    "admin@local"
  );
}
  // Load dynamic stats
  useEffect(() => {
    async function load() {
      try {
        const stats = await getDashboardStats();
        const cases = await listCases();
        setAlerts(stats.pending + stats.high_risk + stats.medium_risk);
        setPendingScreenings(stats.pending);
        setOpenCases(
          cases.filter((c) => c.status !== "CLOSED").length
        );
      } catch (err) {
        console.warn("Failed loading layout stats", err);
      }
    }

    load();
  }, [location.pathname]);

  const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: "🏠", exact: true },
  { to: "/analyst", label: "Nouveau Screening", icon: "🔍" },

  {
    to: "/screenings",
    label: "Screenings",
    icon: "📋",
    badge: pendingScreenings || undefined,
  },

  {
    to: "/cases",
    label: "Dossiers",
    icon: "📁",
    badge: openCases || undefined,
  },

  { to: "/watchlists", label: "Listes de surveillance", icon: "📡" },

  { to: "/reports", label: "Rapports", icon: "📊" },
];

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <Link to="/dashboard" className="sidebar-logo">
          <div className="sidebar-logo-icon">
  <img src={logo} alt="Simandou Screening" />
</div>
          <div className="sidebar-logo-text">
            Simandou Screening
            <span>Compliance Platform</span>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-nav-item ${
                isActive(location.pathname, item.to, item.exact)
                  ? "active"
                  : ""
              }`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>

              {item.badge ? (
                <span className="nav-badge">{item.badge}</span>
              ) : null}
            </Link>
          ))}

          <div style={{ flex: 1 }} />

          <div className="sidebar-section-label">Configuration</div>

          <Link
            to="/settings"
            className={`sidebar-nav-item ${
              isActive(location.pathname, "/settings") ? "active" : ""
            }`}
          >
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">{getInitials(userName)}</div>

          <div className="sidebar-user-info">
            <div
              className="sidebar-user-name"
              style={{ textTransform: "capitalize" }}
            >
              {userName}
            </div>
            
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main">
        {/* TopNav */}
        <header className="app-topnav">
          <div className="topnav-breadcrumb">
            {kicker && (
              <>
                <span className="topnav-breadcrumb-item">{kicker}</span>
                <span className="topnav-breadcrumb-sep">›</span>
              </>
            )}

            <div className="topnav-pill">
              <span>⭐</span>
              <span>{title}</span>
            </div>
          </div>

          

          <div className="topnav-spacer" />

          <div className="topnav-actions">
            

            <div className="topnav-user">
              <div className="">
              
              </div>

         
            </div>
            <button
  onClick={toggleTheme}
  className="topnav-icon-btn"
  title="Mode clair / sombre"
>
  {theme === "dark" ? "🌙" : "☀️"}
</button>

            <Link
              to="/settings"
              className="topnav-icon-btn"
              title="Settings"
            >
              ⚙️
            </Link>

            {/* Logout */}
            <button
  onClick={logout}
  className="topnav-logout-btn"
>
  ⎋ Déconnexion
</button>
          </div>
        </header>

        {/* Routed pages */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
