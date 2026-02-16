// src/pages/Login.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../api";
import { setToken } from "../auth";
import logo from "../assets/simandou_screening_logo1.png";

type LocationState = {
  from?: { pathname: string };
};

function friendlyError(e: any): string {
  const status = e?.response?.status;
  const detail = e?.response?.data?.detail;

  if (detail) return String(detail);

  if (status === 401) return "Email ou mot de passe incorrect.";
  if (status === 403) return "Compte désactivé ou accès refusé.";
  return e?.message || "Connexion impossible.";
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const state = (loc.state as LocationState) || {};
  const redirectTo = state.from?.pathname || "/analyst";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmit = useMemo(() => !!emailNorm && !!password && !busy, [emailNorm, password, busy]);

  useEffect(() => {
    setErr(null);
  }, [email, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailNorm || !password || busy) return;

    setErr(null);
    setBusy(true);
    try {
      const res = await login(emailNorm, password);
      setToken(res.access_token);
      nav(redirectTo, { replace: true });
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Simandou Screening" />
        </div>

        <h1 className="login-title">Simandou Screening</h1>
        <div className="login-subtitle">Saisissez votre email et votre mot de passe</div>

        {err ? <div className="toast danger">❌ {err}</div> : null}
        <div style={{ height: 12 }} />

        <form onSubmit={onSubmit}>
          <label className="small">Adresse e-mail</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            autoComplete="email"
            inputMode="email"
          />

          <div style={{ height: 12 }} />

          <label className="small">Mot de passe</label>
          <div className="password-field">
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock((e as any).getModifierState?.("CapsLock") ?? false)}
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Cacher le mot de passe" : "Afficher le mot de passe"}
              title={showPwd ? "Cacher" : "Afficher"}
            >
              {showPwd ? "🙈" : "👁️"}
            </button>
          </div>

          {capsLock ? (
            <div className="toast warn" style={{ marginTop: 10 }}>
              ⚠️ Majuscule activée (Caps Lock)
            </div>
          ) : null}

          <div style={{ height: 18 }} />

          <div className="login-actions">
            <button className="btn" type="submit" disabled={!canSubmit}>
              {busy ? "Connexion..." : "Se connecter"}
            </button>
          </div>

          <div style={{ height: 12 }} />

          <div className="small" style={{ opacity: 0.8, textAlign: "center" }}>
            Vous avez une invitation ?{" "}
            <Link to="/accept-invitation" className="link">
              Accepter une invitation
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

