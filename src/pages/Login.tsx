// src/pages/Login.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, Lock, Mail, ShieldCheck, XCircle } from "lucide-react";
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
  const redirectTo = state.from?.pathname || "/dashboard";

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

        <h1 className="login-title">AML &amp; PEP Screening</h1>
        <div className="login-subtitle">Saisissez votre email et votre mot de passe</div>

        {err ? (
          <div
            className="toast danger"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <XCircle size={16} strokeWidth={2.2} />
            {err}
          </div>
        ) : null}

        <div style={{ height: 12 }} />

        <form onSubmit={onSubmit}>
          <label className="small" style={{ fontWeight: 600, marginBottom: 6, display: "block" }}>
            Adresse e-mail
          </label>

          <div style={{ position: "relative" }}>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              autoComplete="email"
              inputMode="email"
              style={{ paddingLeft: 38 }}
            />
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.55,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Mail size={16} strokeWidth={2.1} />
            </span>
          </div>

          <div style={{ height: 14 }} />

          <label className="small" style={{ fontWeight: 600, marginBottom: 6, display: "block" }}>
            Mot de passe
          </label>

          <div className="password-field" style={{ position: "relative" }}>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock((e as any).getModifierState?.("CapsLock") ?? false)}
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ paddingLeft: 38 }}
            />

            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.55,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Lock size={16} strokeWidth={2.1} />
            </span>

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Cacher le mot de passe" : "Afficher le mot de passe"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {showPwd ? <EyeOff size={17} strokeWidth={2.1} /> : <Eye size={17} strokeWidth={2.1} />}
            </button>
          </div>

          {capsLock && (
            <div
              className="toast warn"
              style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}
            >
              <AlertTriangle size={16} strokeWidth={2.2} />
              Majuscule activée (Caps Lock)
            </div>
          )}

          <div style={{ height: 20 }} />

          <div className="login-actions">
            <button className="btn" type="submit" disabled={!canSubmit}>
              {busy ? "Connexion..." : "Se connecter"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <span
            className="small"
            style={{ opacity: 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ShieldCheck size={14} strokeWidth={2.2} />
            Connexion sécurisée · Compliance Platform
          </span>
        </div>
      </div>
    </div>
  );
}