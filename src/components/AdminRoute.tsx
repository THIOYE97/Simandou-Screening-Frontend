// src/components/AdminRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { isAuthed } from "../auth";
import { isAdmin } from "../authz";

export default function AdminRoute() {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/analyst" replace />;
  return <Outlet />;
}

