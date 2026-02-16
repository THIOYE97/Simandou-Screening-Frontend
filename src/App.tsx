// src/App.tsx
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import { useEffect, useState } from "react";

import AnalystHome from "./pages/AnalystHome";
import ScreeningsList from "./pages/ScreeningsList";
import ScreeningDetails from "./pages/ScreeningDetails";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import { clearToken, isAuthed } from "./auth";
import { isAdmin } from "./authz";

import TenantsList from "./pages/backoffice/TenantsList";
import TenantNew from "./pages/backoffice/TenantNew";
import TenantDetails from "./pages/backoffice/TenantDetails";

import logo from "./assets/simandou_screening_logo1.png";

function NavItem({
  to,
  label,
  icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      <span className="nav-ico" aria-hidden>
        {icon}
      </span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const onLoginPage = loc.pathname === "/login";

  // drawer
  const [navOpen, setNavOpen] = useState(false);

  // ferme le drawer quand on change de page
  useEffect(() => {
    setNavOpen(false);
  }, [loc.pathname]);

  function logout() {
    clearToken();
    nav("/login", { replace: true });
  }

  return (
    <>
      {!onLoginPage && (
        <>
          {/* Topbar */}
          <header className="topbar">
            <button
              className="icon-btn"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Fermer le menu" : "Ouvrir le menu"}
              title={navOpen ? "Fermer" : "Menu"}
            >
              {navOpen ? "✕" : "☰"}
            </button>

            <Link to="/analyst" className="brand">
              <img className="brand-logo" src={logo} alt="Simandou Screening" />
              <div className="brand-text">
                <div className="brand-title">Simandou Screening</div>
                <div className="brand-sub">KYC · Sanctions · PEP · Media</div>
              </div>
            </Link>

            <div className="topbar-right">
              {isAuthed() ? (
                <button
                  className="btn secondary sm"
                  onClick={logout}
                  style={{ width: "auto" }}
                >
                  Logout
                </button>
              ) : (
                <Link className="btn sm" to="/login" style={{ width: "auto" }}>
                  Login
                </Link>
              )}
            </div>
          </header>

          {/* Overlay */}
          <div
            className={`drawer-overlay ${navOpen ? "open" : ""}`}
            onClick={() => setNavOpen(false)}
          />

          {/* Drawer */}
          <aside className={`drawer ${navOpen ? "open" : ""}`}>
            <div className="drawer-head">
              <div className="drawer-title">Navigation</div>
              <div className="drawer-hint">Accès rapide</div>
            </div>

            <nav className="drawer-nav">
              <NavItem
                to="/analyst"
                label="Analyst Console"
                icon="📊"
                onClick={() => setNavOpen(false)}
              />
              <NavItem
                to="/screenings"
                label="Screenings"
                icon="🧾"
                onClick={() => setNavOpen(false)}
              />

              {isAdmin() ? (
                <NavItem
                  to="/backoffice/tenants"
                  label="Backoffice"
                  icon="🏢"
                  onClick={() => setNavOpen(false)}
                />
              ) : null}
            </nav>

            <div className="drawer-footer">
              <div className="small">© Simandou Screening</div>
            </div>
          </aside>
        </>
      )}

      {/* pousse le contenu en dessous du topbar */}
      <main className={!onLoginPage ? "app-main" : undefined}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Auth required */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/analyst" replace />} />
            <Route path="/analyst" element={<AnalystHome />} />
            <Route path="/screenings" element={<ScreeningsList />} />
            <Route path="/screenings/:id" element={<ScreeningDetails />} />

            {/* Admin-only backoffice */}
            <Route element={<AdminRoute />}>
              <Route path="/backoffice/tenants" element={<TenantsList />} />
              <Route path="/backoffice/tenants/new" element={<TenantNew />} />
              <Route
                path="/backoffice/tenants/:tenantId"
                element={<TenantDetails />}
              />
            </Route>
          </Route>

          <Route
            path="*"
            element={<Navigate to={isAuthed() ? "/analyst" : "/login"} replace />}
          />
        </Routes>
      </main>
    </>
  );
}

