// src/auth.ts
const KEY = "dp_access_token";

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export function isAuthed(): boolean {
  return !!getToken();
}
