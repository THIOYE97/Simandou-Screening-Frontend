// Glossaire central — noms naturels et explicites (fin du jargon).
// Un seul endroit pour parler "humain" dans toute l'app.

export const NAV = {
  home: "Accueil",
  verify: "Vérifier une personne",
  verifyTxn: "Vérifier une transaction",
  verifications: "Vérifications",
  cases: "Dossiers clients",
  watchlists: "Listes de surveillance",
  reports: "Rapports",
  settings: "Réglages",
  // Conformité LBC/FT
  compliance: "Tableau de bord Conformité",
  alerts: "Alertes à traiter",
  risk: "Niveau de risque & Règles",
  monitoring: "Surveillance des opérations",
  beneficialOwners: "Bénéficiaires effectifs",
  offshore: "Fuites offshore",
  adverseMedia: "Médias défavorables",
};

// Niveaux de risque : mot simple + couleur + intensité (0..3)
export type RiskKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const RISK: Record<RiskKey, { word: string; cls: string; level: number }> = {
  LOW:      { word: "Risque faible",     cls: "low",      level: 0 },
  MEDIUM:   { word: "Risque moyen",      cls: "medium",   level: 1 },
  HIGH:     { word: "Risque élevé",      cls: "high",     level: 2 },
  CRITICAL: { word: "Risque très élevé", cls: "critical", level: 3 },
};

export function riskOf(key?: string | null) {
  const k = String(key || "").toUpperCase() as RiskKey;
  return RISK[k] || { word: key || "—", cls: "neutral", level: -1 };
}

// Statuts d'alerte en langage clair
export const ALERT_STATUS: Record<string, string> = {
  OPEN: "À traiter",
  IN_REVIEW: "Prise en charge",
  ESCALATED: "Escaladée",
  CLOSED_TRUE_POSITIVE: "Soupçon confirmé",
  CLOSED_FALSE_POSITIVE: "Alerte levée",
};

// Statuts de déclaration de soupçon
export const SAR_STATUS: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Transmise à la Conformité",
  UNDER_REVIEW: "En cours d'examen",
  DECIDED: "Décision rendue",
};
export const SAR_DECISION: Record<string, string> = {
  PENDING: "En attente",
  FILED_TO_CENTIF: "Déclarée à l'autorité",
  DISMISSED: "Classée sans suite",
};

// Sources d'opérations
export const SOURCE_LABEL: Record<string, string> = {
  T24: "Core Banking (T24)",
  SWIFT: "Virement international (SWIFT)",
  ACH: "Compensation (ACP/ACH)",
  RTGS: "Virement temps réel (RTGS)",
  MANUAL: "Saisie manuelle",
};

export const CHANNEL_LABEL: Record<string, string> = {
  CASH: "Espèces",
  WIRE: "Virement",
  CHECK: "Chèque",
  CARD: "Carte",
  OTHER: "Autre",
};

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export function fmtMoney(amount: string | number, currency = ""): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return `${amount} ${currency}`.trim();
  return `${n.toLocaleString("fr-FR")} ${currency}`.trim();
}
