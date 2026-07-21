// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { isAuthed } from "./auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout      from "./components/AppLayout";

import Login            from "./pages/Login";
import Dashboard        from "./pages/Dashboard";
import AnalystHome      from "./pages/AnalystHome";
import BeneficialOwners from "./pages/BeneficialOwners";
import Offshore from "./pages/Offshore";
import ScreeningsList   from "./pages/ScreeningsList";
import ScreeningDetails from "./pages/ScreeningDetails";
import Watchlists       from "./pages/Watchlists";
import Reports          from "./pages/Reports";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import Alerts           from "./pages/Alerts";
import RiskScoring      from "./pages/RiskScoring";
import Transactions     from "./pages/Transactions";
import VerifyTransaction from "./pages/VerifyTransaction";


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
          <Route path="/verify-transaction" element={<VerifyTransaction />} />
          <Route path="/screenings"     element={<ScreeningsList />} />
          <Route path="/screenings/:id" element={<ScreeningDetails />} />
          <Route path="/watchlists"     element={<Watchlists />} />
          <Route path="/reports"        element={<Reports />} />
          <Route path="/compliance"     element={<ComplianceDashboard />} />
          <Route path="/alerts"         element={<Alerts />} />
          <Route path="/risk-scoring"   element={<RiskScoring />} />
          <Route path="/beneficial-owners" element={<BeneficialOwners />} />
          <Route path="/offshore" element={<Offshore />} />
          <Route path="/transactions"   element={<Transactions />} />

        </Route>
      </Route>

      <Route path="*" element={<Navigate to={isAuthed()?"/dashboard":"/login"} replace />} />
    </Routes>
  );
}