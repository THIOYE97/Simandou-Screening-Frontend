// Composants UI réutilisables du design system.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ShieldAlert, ShieldCheck, ShieldX, ShieldQuestion, X } from "lucide-react";
import { riskOf } from "./labels";

/* ---------- Bouton ---------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export function Button({
  variant = "primary", size, block, icon, children, className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: "sm" | "lg"; block?: boolean; icon?: ReactNode;
}) {
  const cls = [
    "ds-btn",
    variant !== "primary" ? `ds-btn--${variant}` : "",
    size ? `ds-btn--${size}` : "",
    block ? "ds-btn--block" : "",
    className, // ⚠️ fusion (ne pas laisser className écraser les classes ds-btn)
  ].filter(Boolean).join(" ");
  return <button className={cls} {...rest}>{icon}{children}</button>;
}

/* ---------- Carte ---------- */
export function Card({ children, hover, pad0, className = "", ...rest }:
  { children: ReactNode; hover?: boolean; pad0?: boolean; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const cls = ["ds-card", hover ? "ds-card--hover" : "", pad0 ? "ds-card--pad0" : "", className].filter(Boolean).join(" ");
  return <div className={cls} {...rest}>{children}</div>;
}
export function CardTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="ds-card-title">{children}</div>
      {sub && <div className="ds-card-sub">{sub}</div>}
    </div>
  );
}

/* ---------- En-tête de page ---------- */
export function PageHeader({ icon, title, subtitle, actions }:
  { icon?: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="ds-page-head">
      <div>
        <h1 className="ds-page-title">
          {icon && <span className="ds-page-icon">{icon}</span>}
          {title}
        </h1>
        {subtitle && <div className="ds-page-sub">{subtitle}</div>}
      </div>
      {actions && <div className="ds-row ds-wrap">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({ icon, value, label, tone = "var(--brand-600)", tint = "var(--brand-50)", trend }:
  { icon: ReactNode; value: ReactNode; label: string; tone?: string; tint?: string; trend?: ReactNode }) {
  return (
    <div className="ds-stat">
      <div className="ds-stat-ico" style={{ background: tint, color: tone }}>{icon}</div>
      <div className="ds-stat-val" style={{ color: tone }}>{value}</div>
      <div className="ds-stat-label">{label}</div>
      {trend && <div className="ds-stat-trend">{trend}</div>}
    </div>
  );
}

/* ---------- Badge de risque (couleur + icône + mot) ---------- */
export function RiskBadge({ level }: { level?: string | null }) {
  const r = riskOf(level);
  const Icon = r.level >= 3 ? ShieldX : r.level === 2 ? ShieldAlert : r.level === 1 ? ShieldQuestion : r.level === 0 ? ShieldCheck : ShieldQuestion;
  return <span className={`ds-badge ds-badge--${r.cls}`}><Icon /> {r.word}</span>;
}

/* Badge générique */
export function Badge({ tone = "neutral", children }: { tone?: "low" | "medium" | "high" | "critical" | "info" | "neutral"; children: ReactNode }) {
  return <span className={`ds-badge ds-badge--${tone}`}>{children}</span>;
}

/* ---------- Champs ---------- */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="ds-field">
      {label && <label className="ds-label">{label}</label>}
      {children}
      {hint && <span className="ds-hint">{hint}</span>}
    </div>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="ds-input" {...props} />; }
export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className="ds-select" {...props}>{children}</select>; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className="ds-textarea" {...props} />; }

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="ds-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ds-switch-track"><span className="ds-switch-thumb" /></span>
      {label && <span>{label}</span>}
    </label>
  );
}

/* ---------- État vide / chargement ---------- */
export function EmptyState({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="ds-empty">
      {icon && <div className="ds-empty-ico">{icon}</div>}
      <div className="ds-empty-title">{title}</div>
      {subtitle && <div className="ds-empty-sub">{subtitle}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}
/* ---------- Panneau latéral (détails) ---------- */
export function Drawer({ open, onClose, title, subtitle, children, footer }:
  { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="ds-drawer-ov" onClick={onClose} />
      <aside className="ds-drawer ds-root" role="dialog" aria-modal="true">
        <div className="ds-drawer-head">
          <div>
            <div className="ds-card-title">{title}</div>
            {subtitle && <div className="ds-card-sub" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="ds-icon-btn" onClick={onClose} aria-label="Fermer" style={{ width: 36, height: 36 }}><X size={18} /></button>
        </div>
        <div className="ds-drawer-body">{children}</div>
        {footer && <div className="ds-drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}
export function KV({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="ds-kv">
      {items.map(([k, v], i) => <div key={i} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/* ---------- Pagination (20/page) ---------- */
export const PAGE_SIZE = 20;
export function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <div className="ds-between" style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
      <span className="ds-small ds-muted">Page {page} sur {pageCount} · {total} au total</span>
      <div className="ds-row" style={{ gap: 6 }}>
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</Button>
        <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Suivant</Button>
      </div>
    </div>
  );
}

/* ---------- Décision sur le sujet ---------- */
export function DecisionBadge({ decision }: { decision?: string | null }) {
  if (!decision || decision === "PENDING") return null;
  return decision === "BLOCKED"
    ? <span className="ds-badge ds-badge--critical"><ShieldX /> Bloqué</span>
    : <span className="ds-badge ds-badge--low"><ShieldCheck /> Autorisé</span>;
}

/* ---------- Piste d'audit (décisions de Conformité) ---------- */
type AuditEvent = { action_label?: string; action?: string; decision?: string | null; justification?: string | null; created_at?: string | null };
export function AuditTimeline({ events }: { events?: AuditEvent[] }) {
  if (!events || events.length === 0) return <div className="ds-small ds-muted">Aucune décision enregistrée.</div>;
  return (
    <div className="ds-audit">
      {events.map((e, i) => (
        <div key={i} className="ds-audit-item">
          <div className="ds-audit-dot" />
          <div style={{ flex: 1 }}>
            <div className="ds-row ds-between">
              <b style={{ fontSize: 13.5 }}>{e.action_label || e.action}</b>
              <span className="ds-small ds-muted">{e.created_at ? new Date(e.created_at).toLocaleString("fr-FR") : ""}</span>
            </div>
            {e.decision && <div className="ds-small" style={{ color: e.decision === "BLOCKED" ? "var(--danger)" : "var(--ok)", fontWeight: 600 }}>
              {e.decision === "BLOCKED" ? "Sujet bloqué" : "Sujet autorisé"}
            </div>}
            {e.justification && <div className="ds-small ds-muted" style={{ marginTop: 2 }}>« {e.justification} »</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Partie filtrée contre les listes (émetteur / bénéficiaire) ----------
   Affiche aussi les parties SAINES : pouvoir démontrer qu'un contrôle a eu lieu
   et n'a rien donné est une information de conformité, distincte de l'absence
   de contrôle. */
export type ScreenedParty = {
  role: string; name: string; screened?: boolean; score?: number;
  is_pep?: boolean; match_count?: number; top_match?: string | null; list?: string | null;
};

export function PartyScreeningRow({ party }: { party: ScreenedParty }) {
  const hasMatch = (party.match_count ?? 0) > 0;
  const notScreened = party.screened === false;
  return (
    <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", marginBottom: 8 }}>
      <div className="ds-between" style={{ gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="ds-small ds-muted">{party.role}</div>
          <div style={{ fontWeight: 650, fontSize: 14 }}>{party.name}</div>
        </div>
        {notScreened
          ? <Badge tone="neutral"><ShieldQuestion size={13} /> Non vérifié</Badge>
          : hasMatch
            ? <Badge tone="critical"><ShieldAlert size={13} /> {party.match_count} correspondance(s)</Badge>
            : <Badge tone="low"><ShieldCheck size={13} /> Aucune correspondance</Badge>}
      </div>
      {hasMatch && (
        <div className="ds-small ds-muted" style={{ marginTop: 6 }}>
          Rapproché de <b style={{ color: "var(--text)" }}>{party.top_match}</b>
          {party.list ? <> · {party.list}</> : null}
          {party.score ? <> · similarité {party.score}%</> : null}
          {party.is_pep ? <> · <b>personne politiquement exposée</b></> : null}
        </div>
      )}
    </div>
  );
}

export function Spinner() { return <span className="ds-spinner" role="status" aria-label="Chargement" />; }
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gap: 10, padding: 8 }}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="ds-skel" style={{ height: 44 }} />)}
    </div>
  );
}
