// src/api.backoffice.ts
import { api } from "./api";

export type Tenant = {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED" | string;
  active_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  domains?: string[] | null;
};

export async function listTenants(params?: { q?: string; status?: string; limit?: number; offset?: number }) {
  const { data } = await api.get("/admin/tenants", { params });
  return data as { items: Tenant[]; limit: number; offset: number; total: number };
}

export async function createTenant(payload: {
  name: string;
  domains?: string[];
  active_until?: string | null; // YYYY-MM-DD
}) {
  const { data } = await api.post("/admin/tenants", payload);
  return data as Tenant;
}

export async function getTenant(id: string) {
  const { data } = await api.get(`/admin/tenants/${id}`);
  return data as Tenant;
}

export async function updateTenant(id: string, patch: Partial<Tenant>) {
  const { data } = await api.patch(`/admin/tenants/${id}`, patch);
  return data as Tenant;
}

export type TenantUser = {
  id: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | string;
  roles?: string[] | null;
  created_at?: string | null;
  last_login_at?: string | null;
};

export async function listTenantUsers(tenantId: string) {
  const { data } = await api.get(`/admin/tenants/${tenantId}/users`);
  return data as { items: TenantUser[] };
}

export async function updateUser(userId: string, patch: { status?: string; roles?: string[] }) {
  const { data } = await api.patch(`/admin/users/${userId}`, patch);
  return data as TenantUser;
}

export type Invitation = {
  id: string;
  email: string;
  role: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" | string;
  expires_at?: string | null;
  created_at?: string | null;
};

export async function listInvitations(tenantId: string) {
  const { data } = await api.get(`/admin/tenants/${tenantId}/invitations`);
  return data as { items: Invitation[] };
}

export async function createInvitation(tenantId: string, payload: { email: string; role: string; expires_in_days?: number }) {
  const { data } = await api.post(`/admin/tenants/${tenantId}/invitations`, payload);
  return data as Invitation;
}

export async function revokeInvitation(invId: string) {
  const { data } = await api.post(`/admin/invitations/${invId}/revoke`, {});
  return data;
}

