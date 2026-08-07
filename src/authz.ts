// src/authz.ts
import { getToken } from "./auth";

function safeJwtPayload(): any | null {
  const t = getToken();
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getRoles(): string[] {
  const p = safeJwtPayload();
  const r = p?.roles ?? p?.role ?? p?.user_roles ?? [];
  if (Array.isArray(r)) return r.map((x) => String(x).toUpperCase());
  if (typeof r === "string") return [r.toUpperCase()];
  return [];
}

/**
 * Super-administrateur : le seul profil qui voit au-delà d'un tenant.
 * La revendication est portée par le jeton — elle n'est vraie que si le rôle
 * SUPER_ADMIN a été attribué au compte (cf. app/scripts/grant_super_admin.py).
 */
export function isSuperAdmin(): boolean {
  return safeJwtPayload()?.is_super_admin === true;
}

export function isAdmin(): boolean {
  const p = safeJwtPayload();
  if (p?.is_admin === true) return true;
  const roles = getRoles();
  return roles.includes("OWNER") || roles.includes("ADMIN") || roles.includes("SUPERADMIN");
}

