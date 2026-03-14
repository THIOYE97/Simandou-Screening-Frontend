// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { isAuthed } from "./auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout      from "./components/AppLayout";

import Login            from "./pages/Login";
import Dashboard        from "./pages/Dashboard";
import AnalystHome      from "./pages/AnalystHome";
import ScreeningsList   from "./pages/ScreeningsList";
import ScreeningDetails from "./pages/ScreeningDetails";
import CaseManagement   from "./pages/CaseManagement";
import Settings         from "./pages/Settings";
import Watchlists       from "./pages/Watchlists";
import Reports          from "./pages/Reports";


export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/"               element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/analyst"        element={<AnalystHome />} />
          <Route path="/screenings"     element={<ScreeningsList />} />
          <Route path="/screenings/:id" element={<ScreeningDetails />} />
          <Route path="/cases"          element={<CaseManagement />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="/watchlists"     element={<Watchlists />} />
          <Route path="/reports"        element={<Reports />} />

        </Route>
      </Route>

      <Route path="*" element={<Navigate to={isAuthed()?"/dashboard":"/login"} replace />} />
    </Routes>
  );
}