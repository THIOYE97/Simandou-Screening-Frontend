// src/SettingsContext.tsx
// Global settings context — loaded from backend, shared across all pages
import { createContext, useContext, useEffect, useState,  } from "react";
import api from "./api";

// ─── Types ────────────────────────────────────────────────────
export interface AppSettings {
  // Screening rules
  pep_enabled:           boolean;
  sanctions_enabled:     boolean;
  adverse_media_enabled: boolean;
  max_matches_default:   number;
  confidence_threshold:  number;   // 0–100

  // Alerts
  email_notifications:   boolean;
  high_risk_only:        boolean;
  notification_frequency: "immediately" | "hourly" | "4h" | "daily";

  // Display
  date_locale: "fr-FR" | "en-US";
  risk_auto_block_threshold: "HIGH" | "MEDIUM" | "none";  // auto-suggest BLOCK
}

export const DEFAULT_SETTINGS: AppSettings = {
  pep_enabled:               true,
  sanctions_enabled:         true,
  adverse_media_enabled:     true,
  max_matches_default:       20,
  confidence_threshold:      70,
  email_notifications:       true,
  high_risk_only:            true,
  notification_frequency:    "immediately",
  date_locale:               "fr-FR",
  risk_auto_block_threshold: "HIGH",
};

// ─── Context ─────────────────────────────────────────────────
interface SettingsContextValue {
  settings:  AppSettings;
  loading:   boolean;
  saving:    boolean;
  update:    (patch: Partial<AppSettings>) => void;
  save:      () => Promise<void>;
  reload:    () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings:  DEFAULT_SETTINGS,
  loading:   false,
  saving:    false,
  update:    () => {},
  save:      async () => {},
  reload:    async () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

// ─── Provider ────────────────────────────────────────────────
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const { data } = await api.get("/settings");
      // Merge with defaults to handle missing keys gracefully
      setSettings(s => ({ ...s, ...data }));
    } catch {
      // If settings endpoint doesn't exist yet, use defaults silently
      // Load from localStorage as fallback
      try {
        const local = localStorage.getItem("app_settings");
        if (local) setSettings(s => ({ ...s, ...JSON.parse(local) }));
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []); // eslint-disable-line

  function update(patch: Partial<AppSettings>) {
    setSettings(s => {
      const next = { ...s, ...patch };
      // Persist locally immediately for UX
      try { localStorage.setItem("app_settings", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch("/settings", settings);
      try { localStorage.setItem("app_settings", JSON.stringify(settings)); } catch {}
    } catch {
      // Fallback: localStorage only
      try { localStorage.setItem("app_settings", JSON.stringify(settings)); } catch {}
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, saving, update, save, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}