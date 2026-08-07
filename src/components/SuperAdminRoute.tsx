// src/components/SuperAdminRoute.tsx
// Garde de route pour la console de sécurité. Le contrôle qui fait foi est
// côté API (403) ; celui-ci évite seulement d'afficher un écran vide à qui
// n'a pas les droits.
import { Navigate, Outlet } from "react-router-dom";
import { isAuthed } from "../auth";
import { isSuperAdmin } from "../authz";

export default function SuperAdminRoute() {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  if (!isSuperAdmin()) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
