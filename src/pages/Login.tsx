// Connexion — écran d'accueil (refonte UX).
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, Lock, Mail, ShieldCheck, Radar, Gauge, FileCheck2 } from "lucide-react";
import { login } from "../api";
import { setToken } from "../auth";
import { Button, Field } from "../ui";
import productMarkOnDark from "../assets/product-mark-ondark.svg";

function friendlyError(e: any): string {
  const status = e?.response?.status;
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (status === 401) return "E-mail ou mot de passe incorrect.";
  if (status === 403) return "Compte désactivé ou accès refusé.";
  return "Connexion impossible. Réessayez.";
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = (loc.state as any)?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => !!email.trim() && !!password && !busy, [email, password, busy]);
  useEffect(() => { setErr(null); }, [email, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      setToken(res.access_token);
      nav(redirectTo, { replace: true });
    } catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="ds-login ds-root">
      <div className="ds-login-brand">
        <div className="ds-login-lockup">
          <img src={productMarkOnDark} alt="" className="ds-login-mark" />
          <div>
            <div className="ds-login-badge">Simandou Conformité</div>
            <div className="ds-login-inst">Plateforme de conformité LBC/FT</div>
          </div>
        </div>
        <div>
          <h1 className="ds-login-hero">La conformité LBC/FT,<br />simple et sous contrôle.</h1>
          <p className="ds-login-hero-sub">Vérifiez vos clients, surveillez les opérations et traitez les alertes — le tout dans une seule plateforme claire.</p>
          <div className="ds-login-points">
            <div className="ds-login-point"><Radar size={18} /> Filtrage automatique contre les listes de sanctions</div>
            <div className="ds-login-point"><Gauge size={18} /> Évaluation du risque en temps réel</div>
            <div className="ds-login-point"><FileCheck2 size={18} /> Alertes, signalements et rapports intégrés</div>
          </div>
        </div>
        <div style={{ opacity: .7, fontSize: 13 }}>Plateforme officielle de conformité · LBC/FT</div>
      </div>

      <div className="ds-login-form-wrap">
        <form className="ds-login-form" onSubmit={onSubmit}>
          <h2 className="ds-login-title">Bienvenue</h2>
          <p className="ds-login-sub">Connectez-vous pour accéder à votre espace.</p>

          {err && <div className="ds-login-error"><AlertTriangle size={16} /> {err}</div>}

          <div className="ds-grid" style={{ gap: 16 }}>
            <Field label="Adresse e-mail">
              <div className="ds-input-ico">
                <Mail size={17} />
                <input className="ds-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com" autoComplete="email" />
              </div>
            </Field>
            <Field label="Mot de passe">
              <div className="ds-input-ico">
                <Lock size={17} />
                <input className="ds-input" type={showPwd ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                <button type="button" className="ds-pwd-toggle" onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Cacher" : "Afficher"}>{showPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </Field>
          </div>

          <Button className="ds-mt-24" size="lg" block type="submit" disabled={!canSubmit}>
            {busy ? "Connexion…" : "Se connecter"}
          </Button>

          <div style={{ textAlign: "center", marginTop: 20, color: "var(--text-mute)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ShieldCheck size={14} /> Connexion sécurisée
          </div>
        </form>
      </div>
    </div>
  );
}
