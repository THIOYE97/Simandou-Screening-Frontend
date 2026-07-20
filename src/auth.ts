// src/auth.ts
const KEY = "dp_access_token";
const REFRESH_KEY = "dp_refresh_token";

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

/** Enregistre le couple renvoyé par /auth/login ou /auth/refresh. */
export function setSession(accessToken: string, refreshToken?: string | null) {
  setToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
}

export function clearToken() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthed(): boolean {
  return !!getToken();
}
