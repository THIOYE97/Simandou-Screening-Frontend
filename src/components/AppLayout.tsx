// src/components/AppLayout.tsx — Clean rewrite with lucide-react
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Home,
  Search,
  ClipboardList,
  FolderOpen,
  Radio,
  BarChart3,
  Building2,
  LogOut,
  Bell,
  ChevronDown,
  Moon,
  Sun,
  Star,
} from "lucide-react";
import { getToken, clearToken } from "../auth";
import { getDashboardStats, listCases } from "../api";
import logo from "../assets/simandou_screening_logo1.png";

// ─── Helpers ──────────────────────────────────────────────────
function getPayload(): any | null {
  const t = getToken();
  if (!t) return null;
  try {
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
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

function getUserEmail(p: any): string {
  if (!p) return "admin@local";
  return p.email || p.preferred_username || p.username || p.sub || "admin@local";
}

function isActive(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(to + "/");
}

function getPageMeta(pathname: string) {
  if (pathname === "/dashboard") return { kicker: "Vue globale", title: "Tableau de bord" };
  if (pathname === "/analyst") return { kicker: "AML / PEP", title: "Nouveau Screening" };
  if (pathname.startsWith("/screenings")) return { kicker: "AML / PEP", title: "Historique" };
  if (pathname.startsWith("/cases")) return { kicker: "Investigation", title: "Dossiers" };
  if (pathname === "/watchlists") return { kicker: "Surveillance", title: "Watchlists" };
  if (pathname === "/reports") return { kicker: "Analytics", title: "Reports" };
  return { kicker: "", title: "Console" };
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: number;
  exact?: boolean;
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const payload = getPayload();
  const userEmail = getUserEmail(payload);
  const userName = userEmail.split("@")[0];
  const isAdmin = payload?.is_super_admin || payload?.role === "ADMIN";

  const { kicker, title } = getPageMeta(location.pathname);

  const [pendingScreenings, setPendingScreenings] = useState(0);
  const [openCases, setOpenCases] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const [stats, cases] = await Promise.all([getDashboardStats(), listCases({})]);
        setPendingScreenings(stats.pending ?? 0);
        setOpenCases(
          Array.isArray(cases)
            ? cases.filter(
                (c: any) => !["CLOSED", "DONE"].includes(String(c.status || "").toUpperCase())
              ).length
            : 0
        );
        setAlerts((stats.high_risk ?? 0) + (stats.pending ?? 0));
      } catch {}
    })();
  }, [location.pathname]);

  const NAV_MAIN: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: Home, exact: true },
    { to: "/analyst", label: "New Screening", icon: Search },
    {
      to: "/screenings",
      label: "Screenings",
      icon: ClipboardList,
      badge: pendingScreenings || undefined,
    },
    {
      to: "/cases",
      label: "Case Management",
      icon: FolderOpen,
      badge: openCases || undefined,
    },
    { to: "/watchlists", label: "Watchlists", icon: Radio },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ];

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="app-layout">
      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className="app-sidebar">
        <Link to="/dashboard" className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <img
              src={logo}
              alt="Simandou Screening"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div className="sidebar-logo-text">
            Simandou Screening
            <span>Compliance Platform</span>
          </div>
        </Link>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>

          {NAV_MAIN.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-nav-item ${
                  isActive(location.pathname, item.to, item.exact) ? "active" : ""
                }`}
              >
                <span className="nav-icon">
                  <Icon size={17} strokeWidth={2} />
                </span>
                <span>{item.label}</span>
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </Link>
            );
          })}

          <div style={{ flex: 1 }} />

          {isAdmin && (
            <Link
              to="/backoffice/tenants"
              className={`sidebar-nav-item ${isActive(location.pathname, "/backoffice") ? "active" : ""}`}
            >
              <span className="nav-icon">
                <Building2 size={17} strokeWidth={2} />
              </span>
              <span>Backoffice</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">{getInitials(userName)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" style={{ textTransform: "capitalize" }}>
              {userName}
            </div>
            <div className="small" style={{ opacity: 0.5, fontSize: 11, marginTop: 1 }}>
              {isAdmin ? "Admin" : "Analyst"}
            </div>
          </div>
          <button
            onClick={logout}
            title="Déconnexion"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: 0.7,
              padding: 4,
              color: "red",
              marginLeft: "auto",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div className="app-main">
        <header className="app-topnav">
          <div className="topnav-breadcrumb">
            {kicker && (
              <>
                <span className="topnav-breadcrumb-item">{kicker}</span>
                <span className="topnav-breadcrumb-sep">›</span>
              </>
            )}
            <div className="topnav-pill">
              <Star size={14} strokeWidth={2} />
              <span>{title}</span>
            </div>
          </div>

          <div className="topnav-spacer" />

          <div className="topnav-actions">
            <div style={{ position: "relative" }}>
              <input
                className="input"
                placeholder="Search name, ID or keywords…"
                style={{
                  width: 240,
                  paddingLeft: 32,
                  fontSize: 12,
                  padding: "7px 12px 7px 32px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                    navigate(
                      `/screenings?q=${encodeURIComponent(
                        (e.target as HTMLInputElement).value.trim()
                      )}`
                    );
                  }
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.4,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Search size={14} strokeWidth={2} />
              </span>
            </div>

            <div style={{ position: "relative" }}>
              <button className="topnav-icon-btn" title="Notifications">
                <Bell size={17} strokeWidth={2} />
              </button>
              {alerts > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: "#E84040",
                    border: "2px solid var(--bg-card)",
                  }}
                />
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 20,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                cursor: "default",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {getInitials(userName)}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                {userName.length > 12 ? userName.slice(0, 12) + "…" : userName}
              </span>
              <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.5 }} />
            </div>

            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="topnav-icon-btn"
              title="Mode clair / sombre"
            >
              {theme === "dark" ? (
                <Moon size={17} strokeWidth={2} />
              ) : (
                <Sun size={17} strokeWidth={2} />
              )}
            </button>

            
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}