// src/components/AppLayout.tsx
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getToken, clearToken } from "../auth";
import { getDashboardStats, listCases } from "../api";

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

function getPageMeta(pathname: string): { kicker: string; title: string } {
  if (pathname === "/dashboard")
    return { kicker: "Overview", title: "Dashboard" };

  if (pathname === "/analyst")
    return { kicker: "AML / PEP", title: "New Screening" };

  if (pathname.startsWith("/screenings"))
    return { kicker: "AML / PEP", title: "Screenings History" };

  if (pathname.startsWith("/cases"))
    return { kicker: "Investigation", title: "Case Management" };

  if (pathname === "/watchlists")
    return { kicker: "Surveillance", title: "Watchlists" };

  if (pathname === "/reports")
    return { kicker: "Analytics", title: "Reports" };

  if (pathname === "/settings")
    return { kicker: "Configuration", title: "Settings" };

  return { kicker: "", title: "Console" };
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const payload = getPayload();

  const userEmail: string = payload?.sub ?? payload?.email ?? "admin";
  const role: string = payload?.role ?? "ANALYST";

  const userName = userEmail.split("@")[0].replace(/[._-]/g, " ");

  const { kicker, title } = getPageMeta(location.pathname);

  const [pendingScreenings, setPendingScreenings] = useState(0);
  const [openCases, setOpenCases] = useState(0);

  // Load dynamic stats
  useEffect(() => {
    async function load() {
      try {
        const stats = await getDashboardStats();
        const cases = await listCases();

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
    { to: "/dashboard", label: "Dashboard", icon: "🏠", exact: true },

    { to: "/analyst", label: "New Screening", icon: "🔍" },

    {
      to: "/screenings",
      label: "Screenings",
      icon: "📋",
      badge: pendingScreenings || undefined,
    },

    {
      to: "/cases",
      label: "Cases",
      icon: "📁",
      badge: openCases || undefined,
    },

    { to: "/watchlists", label: "Watchlists", icon: "📡" },

    { to: "/reports", label: "Reports", icon: "📊" },
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
          <div className="sidebar-logo-icon">🛡️</div>
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

            <div className="sidebar-user-role">{role}</div>
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

          <div className="topnav-search">
            <span className="topnav-search-icon">🔍</span>
            <input placeholder="Search case, screening or client..." />
          </div>

          <div className="topnav-spacer" />

          <div className="topnav-actions">
            {/* notifications */}
            <button className="topnav-icon-btn" title="Pending screenings">
              🔔
              {pendingScreenings > 0 && (
                <span className="topnav-notif-badge">
                  {pendingScreenings}
                </span>
              )}
            </button>

            <div className="topnav-user">
              <div className="topnav-user-avatar">
                {getInitials(userName)}
              </div>

              <span
                className="topnav-user-name"
                style={{ textTransform: "capitalize" }}
              >
                {userName}
              </span>
            </div>

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
              className="topnav-icon-btn"
              title="Logout"
            >
              🚪
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