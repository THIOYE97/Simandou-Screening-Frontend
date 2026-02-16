// src/pages/ScreeningsList.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listScreenings } from "../api";

export type ScreeningListItem = {
  id: string;
  provider?: string | null;
  status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  case_id?: string | null;
  kind?: string | null;
  client_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

const PAGE_SIZE = 20;
const SERVER_MAX = 200; // ton backend limite à 200

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s);
  }
}

function displayName(r: ScreeningListItem) {
  return (
    r.client_name ||
    r.full_name ||
    [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Traduction statuts */
function frStatus(raw?: string | null) {
  const v = String(raw || "").toUpperCase();
  if (!v) return "—";
  const map: Record<string, string> = {
    DONE: "Terminé",
    APPROVED: "Approuvé",
    RUNNING: "En cours",
    PENDING: "En attente",
    PENDING_REVIEW: "À revoir",
    FAILED: "Échec",
    REJECTED: "Rejeté",
    ERROR: "Erreur",
    UNKNOWN: "Inconnu",
  };
  return map[v] || v;
}

function statusBadgeClass(status?: string | null) {
  const v = String(status || "").toUpperCase();
  if (v === "DONE" || v === "APPROVED") return "badge badge-ok";
  if (v === "RUNNING" || v === "PENDING" || v === "PENDING_REVIEW") return "badge badge-warn";
  if (v === "FAILED" || v === "REJECTED" || v === "ERROR") return "badge badge-bad";
  return "badge";
}

function frError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("unauthorized") || m.includes("not authenticated")) return "Non autorisé. Veuillez vous reconnecter.";
  if (m.includes("forbidden")) return "Accès refusé.";
  if (m.includes("timeout")) return "Le serveur a mis trop de temps à répondre (timeout).";
  if (m.includes("network error")) return "Erreur réseau. Vérifiez votre connexion.";
  if (m.includes("unprocessable entity") || m.includes("422")) return "Requête invalide (paramètres).";
  return msg;
}

export default function ScreeningsList() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ filtres demandés
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");

  // offset = pagination UI (toujours par 20)
  const [offset, setOffset] = useState(0);

  // données venant du backend
  const [serverItems, setServerItems] = useState<ScreeningListItem[]>([]);

  // mode: si name est rempli => on fait une pagination locale sur un gros fetch
  const nameMode = useMemo(() => !!name.trim(), [name]);

  const filteredAll = useMemo(() => {
    const n = norm(name);
    if (!n) return serverItems;
    return serverItems.filter((r) => norm(displayName(r)).includes(n));
  }, [serverItems, name]);

  const pageItems = useMemo(() => {
    return filteredAll.slice(offset, offset + PAGE_SIZE);
  }, [filteredAll, offset]);

  const total = filteredAll.length;
  const pageFrom = total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, total);

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  async function load(nextOffset: number = 0) {
    setBusy(true);
    setErr(null);

    try {
      // ✅ Si on filtre par NOM => on récupère un "gros paquet" (200 max) puis pagination locale
      const serverLimit = nameMode ? SERVER_MAX : PAGE_SIZE;
      const serverOffset = nameMode ? 0 : nextOffset;

      const res = await listScreenings({
        limit: serverLimit,
        offset: serverOffset, // ✅ toujours number
        status: status.trim() || undefined, // ✅ backend supporte
        // ⚠️ NE PAS envoyer "name": le backend analyst.py ne le gère pas
      });

      const items = Array.isArray(res) ? res : (res.items || []);
      setServerItems(items as ScreeningListItem[]);

      // pagination UI
      setOffset(nameMode ? nextOffset : serverOffset);
    } catch (e: any) {
      const raw = e?.response?.data?.detail || e?.message || String(e);
      setErr(frError(String(raw)));
    } finally {
      setBusy(false);
    }
  }

  function applyFilters() {
    // retour page 1
    setOffset(0);
    // reload côté serveur (status) + local (name)
    setTimeout(() => load(0), 0);
  }

  function resetFilters() {
    setStatus("");
    setName("");
    setOffset(0);
    setTimeout(() => load(0), 0);
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // si l’utilisateur tape un nom, on repasse en pagination locale
  useEffect(() => {
    // quand on passe en nameMode, on recharge en mode "gros fetch"
    setOffset(0);
    setTimeout(() => load(0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameMode]);

  const subtitle = useMemo(() => {
    if (busy) return "Chargement…";
    if (total === 0) return "Aucun résultat.";
    return `Affichage ${pageFrom}-${pageTo} sur ${total}.`;
  }, [busy, total, pageFrom, pageTo]);

  return (
    <div className="page">
      <div className="page-inner">
        {/* Header */}
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Console Screening
            </div>
            <div className="page-title">Screenings</div>
            <div className="page-subtitle">Liste des screenings et accès rapide aux détails.</div>
          </div>

          <div className="pill-row">
            <Link className="btn secondary" to="/analyst">
              ← Retour Analyst
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="screen" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div className="h2" style={{ margin: 0 }}>Filtres</div>
              <div className="small">
                Statut filtré côté serveur. Nom/Prénoms filtré côté interface (pagination locale).
              </div>
            </div>

            <div className="pill-row" style={{ alignItems: "center" }}>
              <span className="badge">{subtitle}</span>
              <span className="badge" title="Pagination">
                page={Math.floor(offset / PAGE_SIZE) + 1} · {PAGE_SIZE}/page
              </span>
              {busy ? <span className="badge">Chargement…</span> : null}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div className="form-grid">
            <div className="field">
              <label className="small">Nom / Prénoms</label>
              <input
                className="input"
                placeholder="Ex : Mamadou Diallo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>

            <div className="field">
              <label className="small">Statut</label>
              <input
                className="input"
                placeholder="Ex : DONE, RUNNING, FAILED…"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
              <div className="small" style={{ marginTop: 6 }}>
                Affichage traduit : DONE → Terminé.
              </div>
            </div>

            <div className="field span-2">
              <label className="small">Actions</label>
              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn" onClick={applyFilters} disabled={busy}>
                  {busy ? "Chargement…" : "Appliquer"}
                </button>

                <button className="btn secondary" onClick={() => load(offset)} disabled={busy}>
                  Actualiser
                </button>

                <button className="btn secondary" onClick={resetFilters} disabled={busy}>
                  Réinitialiser
                </button>

                <div style={{ flex: 1 }} />

                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    setStatus("DONE");
                    setTimeout(() => applyFilters(), 0);
                  }}
                >
                  Terminé
                </button>

                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    setStatus("RUNNING");
                    setTimeout(() => applyFilters(), 0);
                  }}
                >
                  En cours
                </button>
              </div>
            </div>
          </div>

          {err ? (
            <div className="toast danger" style={{ marginTop: 12 }}>
              ❌ {err}
            </div>
          ) : null}
        </div>

        {/* Table */}
        <div className="screen">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div className="h2" style={{ margin: 0 }}>Résultats</div>
              <div className="small">Cliquez sur “Ouvrir” pour accéder aux détails.</div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn secondary"
                disabled={busy || !hasPrev}
                onClick={() => {
                  const next = Math.max(0, offset - PAGE_SIZE);
                  setOffset(next);
                  // ✅ si nameMode => pagination locale: pas besoin de reload
                  if (!nameMode) load(next);
                }}
              >
                ← Précédent
              </button>

              <button
                className="btn secondary"
                disabled={busy || !hasNext}
                onClick={() => {
                  const next = offset + PAGE_SIZE;
                  setOffset(next);
                  if (!nameMode) load(next);
                }}
              >
                Suivant →
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 320 }}>Client</th>
                  <th style={{ width: 170 }}>Statut</th>
                  <th style={{ width: 240 }}>Dossier</th>
                  <th style={{ width: 200 }}>Créé le</th>
                  <th style={{ width: 200 }}>Terminé le</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>

              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800 }}>{displayName(r)}</td>

                    <td>
                      <span className={statusBadgeClass(r.status)}>{frStatus(r.status)}</span>
                    </td>

                    <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                      {r.case_id || "—"}
                    </td>

                    <td className="small">{fmtDate(r.created_at)}</td>
                    <td className="small">{fmtDate(r.completed_at)}</td>

                    <td>
                      <Link className="btn secondary sm" to={`/screenings/${encodeURIComponent(r.id)}`}>
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}

                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="small">
                      Aucun résultat.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 12, gap: 10, alignItems: "center" }}>
            <span className="small">{subtitle}</span>
            <div style={{ flex: 1 }} />
            <button className="btn secondary" onClick={() => load(offset)} disabled={busy}>
              Actualiser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

