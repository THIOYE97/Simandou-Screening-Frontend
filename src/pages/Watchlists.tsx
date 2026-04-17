// src/pages/Watchlists.tsx
import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Download,
  Eye,
  Globe,
  Landmark,
  Newspaper,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import api from "../api";

// ─── Types ────────────────────────────────────────────────────
interface WatchlistSource {
  id: number;
  code: string;
  name: string;
  type: string; // SANCTION, PEP, ADVERSE_MEDIA, PEP_RELATIVES
  status: "active" | "inactive" | "syncing";
  hits: number;
  entity_count: number;
  last_updated: string | null;
  flag: string;
}

interface EntityHit {
  entity_id: string;
  entity_type: string;
  primary_name: string;
  risk_level: string;
  best_norm: string;
  similarity: number;
  source_count: number;
  names_count: number;
}

interface EntityDetail {
  id: string;
  entity_type: string;
  primary_name: string;
  risk_level: string;
  country_focus?: string;
  names: { id: number; name_raw: string; is_primary: boolean; name_type: string }[];
  sources: {
    id: string;
    source_id: number;
    record_type: string;
    program?: string;
    listed_on?: string;
    unlisted_on?: string;
    summary?: string;
    evidence_urls?: string[];
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  }
> = {
  SANCTION: {
    label: "Sanctions",
    color: "#E84040",
    bg: "rgba(232,64,64,0.15)",
    icon: ShieldAlert,
  },
  PEP: {
    label: "PEP",
    color: "#A78BFA",
    bg: "rgba(167,139,250,0.15)",
    icon: Landmark,
  },
  ADVERSE_MEDIA: {
    label: "Adverse Media",
    color: "#F5920A",
    bg: "rgba(245,146,10,0.15)",
    icon: Newspaper,
  },
  PEP_RELATIVES: {
    label: "PEP & Relatives",
    color: "#2ECC8F",
    bg: "rgba(46,204,143,0.15)",
    icon: Users,
  },
};

const SOURCE_FLAGS: Record<string, string> = {
  OFAC: "🇺🇸",
  UN: "🌐",
  EU: "🇪🇺",
  UK: "🇬🇧",
  FR: "🇫🇷",
  CH: "🇨🇭",
};

const SOURCE_NAMES: Record<number, string> = {
  1: "Nations Unies (ONU)",
  2: "OFAC (US)",
  3: "Union Européenne",
};

const SOURCE_TYPES: Record<number, string> = {
  1: "SANCTION",
  2: "SANCTION",
  3: "SANCTION",
};

function fmtAgo(s: string | null): string {
  if (!s) return "—";
  try {
    const diff = Date.now() - new Date(s).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Il y a moins d'1h";
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Hier";
    return `Il y a ${d} jours`;
  } catch {
    return s;
  }
}

function RiskBadge({ risk }: { risk: string }) {
  const v = String(risk || "").toUpperCase();
  if (v === "HIGH") return <span className="risk-badge high">High Risk</span>;
  if (v === "MEDIUM") return <span className="risk-badge medium">Medium Risk</span>;
  if (v === "LOW") return <span className="risk-badge low">Low Risk</span>;
  return <span className="badge">{risk || "—"}</span>;
}

function RecordTypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] || {
    color: "#94A3B8",
    label: type,
    bg: "rgba(148,163,184,0.1)",
    icon: ClipboardList,
  };
  const Icon = cfg.icon;

  return (
    <span
      className="badge"
      style={{
        color: cfg.color,
        background: cfg.bg,
        borderColor: `${cfg.color}40`,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Icon size={14} strokeWidth={2.1} />
      {cfg.label}
    </span>
  );
}

// ─── Summary pill cards ───────────────────────────────────────
function SummaryCard({ label, hits, date, color, bg, icon: Icon, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: active ? bg : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? color + "60" : "var(--border)"}`,
        cursor: "pointer",
        transition: "all 0.2s",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon size={20} strokeWidth={2.1} color={active ? color : "currentColor"} />
        <span style={{ fontWeight: 700, fontSize: 13, color: active ? color : "var(--text-primary)" }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: active ? color : "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {hits.toLocaleString()}
      </div>
      <div className="small" style={{ marginTop: 4, opacity: 0.6 }}>
        Updated {date}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function Watchlists() {
  const [sources, setSources] = useState<WatchlistSource[]>([]);
  const [sourcesBusy, setSourcesBusy] = useState(true);
  const [syncing, setSyncing] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");

  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [results, setResults] = useState<EntityHit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<EntityDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const PAGE = 20;

  const [activeTab, setActiveTab] = useState<"lists" | "search">("lists");

  async function loadSources() {
    setSourcesBusy(true);
    try {
      const { data } = await api.get("/settings/sources");
      const raw: any[] = Array.isArray(data) ? data : data?.items ?? [];
      const enriched: WatchlistSource[] = raw.map((r, i) => {
        const sid = Number(r.id);
        const type =
          SOURCE_TYPES[sid] || (i % 4 === 1 ? "PEP" : i % 4 === 2 ? "ADVERSE_MEDIA" : "SANCTION");
        return {
          id: sid,
          code: r.code || String(sid),
          name: r.name || SOURCE_NAMES[sid] || `Source ${sid}`,
          type,
          status: r.status || "active",
          hits: r.entity_count || 0,
          entity_count: r.entity_count || 0,
          last_updated: r.last_updated,
          flag: SOURCE_FLAGS[r.code] || "📋",
        };
      });
      setSources(enriched);
    } catch {
      setSources([
        {
          id: 2,
          code: "OFAC",
          name: "OFAC (US)",
          type: "SANCTION",
          status: "active",
          hits: 526,
          entity_count: 526,
          last_updated: new Date().toISOString(),
          flag: "🇺🇸",
        },
        {
          id: 3,
          code: "EU",
          name: "EU Sanctions List",
          type: "SANCTION",
          status: "active",
          hits: 998,
          entity_count: 998,
          last_updated: new Date(Date.now() - 2 * 86400000).toISOString(),
          flag: "🇪🇺",
        },
        {
          id: 1,
          code: "UN",
          name: "Politically Exposed Persons",
          type: "PEP",
          status: "active",
          hits: 800,
          entity_count: 800,
          last_updated: new Date(Date.now() - 2 * 86400000).toISOString(),
          flag: "🌐",
        },
        {
          id: 4,
          code: "PEP2",
          name: "Internal Custom PEP List",
          type: "PEP",
          status: "active",
          hits: 92,
          entity_count: 92,
          last_updated: new Date().toISOString(),
          flag: "🏢",
        },
        {
          id: 5,
          code: "ADV",
          name: "Adverse Media Monitoring",
          type: "ADVERSE_MEDIA",
          status: "active",
          hits: 350,
          entity_count: 350,
          last_updated: new Date().toISOString(),
          flag: "📰",
        },
        {
          id: 6,
          code: "FAM",
          name: "Family Connections",
          type: "PEP_RELATIVES",
          status: "active",
          hits: 108,
          entity_count: 108,
          last_updated: new Date().toISOString(),
          flag: "👥",
        },
      ]);
    } finally {
      setSourcesBusy(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function syncSource(id: number) {
    setSyncing((prev) => new Set(prev).add(id));
    try {
      await api.post(`/settings/sources/${id}/sync`);
      setToast("Source synchronisée.");
      setTimeout(() => setToast(null), 3000);
      loadSources();
    } catch (e: any) {
      setToast(`Sync échoué: ${e?.response?.data?.detail || e?.message}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSyncing((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  async function doSearch(off = 0) {
    if (query.trim().length < 2) {
      setSearchErr("Minimum 2 caractères.");
      return;
    }
    setSearching(true);
    setSearchErr(null);
    setHasSearched(true);
    try {
      const params: any = { q: query.trim(), limit: PAGE, offset: off };
      if (entityType) params.entity_type = entityType;
      if (riskFilter) params.risk_level = riskFilter;
      const { data } = await api.get("/admin/entities/search", { params });
      setResults(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setOffset(off);
    } catch (e: any) {
      setSearchErr(e?.response?.data?.detail || e?.message || "Erreur recherche");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function loadDetail(entityId: string) {
    setDetailBusy(true);
    try {
      const { data } = await api.get(`/admin/entities/by-id/${entityId}`);
      setDetailItem(data);
    } catch (e: any) {
      setToast(e?.response?.data?.detail || e?.message);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDetailBusy(false);
    }
  }

  const summaryByType = useMemo(() => {
    const map: Record<string, { hits: number; date: string | null }> = {};
    for (const s of sources) {
      if (!map[s.type]) map[s.type] = { hits: 0, date: null };
      map[s.type].hits += s.hits;
      if (!map[s.type].date || (s.last_updated && s.last_updated > map[s.type].date!)) {
        map[s.type].date = s.last_updated;
      }
    }
    return map;
  }, [sources]);

  const filteredSources = useMemo(() => {
    const q = searchQ.toLowerCase();
    return sources.filter((s) => {
      if (filterType !== "all" && s.type !== filterType) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sources, filterType, filterStatus, searchQ]);

  const totalHits = sources.reduce((a, s) => a + s.hits, 0);
  const activeSrcs = sources.filter((s) => s.status === "active").length;
  const allSelected = selected.length === filteredSources.length && filteredSources.length > 0;

  function toggleSelect(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : filteredSources.map((s) => s.id));
  }

  const SOURCE_LABELS: Record<number, string> = { 1: "UN", 2: "OFAC", 3: "EU" };

  return (
    <>
      <div
        className="page-header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <div className="page-kicker">Surveillance</div>
          <div className="page-title">Watchlists</div>
          <div className="page-subtitle">
            {sourcesBusy
              ? "Chargement…"
              : `${activeSrcs} source${activeSrcs !== 1 ? "s" : ""} actives · ${totalHits.toLocaleString()} entités surveillées`}
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn secondary sm"
            onClick={loadSources}
            disabled={sourcesBusy}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <RefreshCw size={14} strokeWidth={2.2} />
            Actualiser
          </button>
          <button className="btn sm">+ Add Watchlist</button>
        </div>
      </div>

      {toast && (
        <div
          className={`toast ${toast.includes("échoué") ? "danger" : "ok"}`}
          style={{ marginBottom: 14 }}
        >
          {toast}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {(
          [
            ["lists", "Watchlists", ClipboardList],
            ["search", "Entity Search", Search],
          ] as const
        ).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
              color: activeTab === tab ? "var(--text-accent)" : "var(--text-muted)",
              fontWeight: activeTab === tab ? 700 : 500,
              fontSize: 13.5,
              cursor: "pointer",
              marginBottom: -1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon size={15} strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "lists" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
              const info = summaryByType[type] || { hits: 0, date: null };
              return (
                <SummaryCard
                  key={type}
                  label={cfg.label}
                  hits={info.hits}
                  date={fmtAgo(info.date)}
                  color={cfg.color}
                  bg={cfg.bg}
                  icon={cfg.icon}
                  active={filterType === type}
                  onClick={() => setFilterType((f) => (f === type ? "all" : type))}
                />
              );
            })}
          </div>

          <div className="filters-bar" style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div className="filter-chips">
                <span className="filter-label">Filter:</span>
                {(
                  [
                    ["all", "All Lists"],
                    ["SANCTION", "Sanctions"],
                    ["PEP", "PEP"],
                    ["ADVERSE_MEDIA", "Adverse Media"],
                    ["PEP_RELATIVES", "PEP & Relatives"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilterType(val)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${filterType === val ? "var(--border-active)" : "var(--border)"}`,
                      background: filterType === val ? "var(--accent-light)" : "transparent",
                      color: filterType === val ? "var(--text-accent)" : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
                <span style={{ opacity: 0.3, margin: "0 4px" }}>|</span>
                {(
                  [
                    ["all", "Active Hits"],
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilterStatus(val)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${filterStatus === val ? "var(--border-active)" : "var(--border)"}`,
                      background: filterStatus === val ? "var(--accent-light)" : "transparent",
                      color: filterStatus === val ? "var(--text-accent)" : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setFilterType("all");
                    setFilterStatus("all");
                    setSearchQ("");
                  }}
                  className="btn secondary sm"
                >
                  Clear Filters
                </button>
              </div>

              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
                  placeholder="Search lists…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                <button className="btn sm">+ Add Watchlist</button>
                <button
                  className="btn secondary sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <Download size={14} strokeWidth={2.2} />
                  Export Hits
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>
            <div className="screen" style={{ padding: 0, overflow: "hidden" }}>
              {selected.length > 0 && (
                <div
                  style={{
                    padding: "10px 16px",
                    background: "rgba(45,127,214,0.1)",
                    borderBottom: "1px solid rgba(45,127,214,0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span className="small">{selected.length} sélectionné(s)</span>
                  <button
                    className="btn secondary sm"
                    onClick={async () => {
                      for (const id of selected) await syncSource(id);
                      setSelected([]);
                    }}
                  >
                    Sync sélection
                  </button>
                  <button className="btn secondary sm" onClick={() => setSelected([])}>
                    Annuler
                  </button>
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table className="cases-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      </th>
                      <th>Name ↑</th>
                      <th>Type ↑</th>
                      <th>Status ↑</th>
                      <th style={{ textAlign: "right" }}>Hits ↑</th>
                      <th>Updated ↑</th>
                      <th style={{ width: 130 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesBusy ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", opacity: 0.4 }} className="small">
                          Chargement…
                        </td>
                      </tr>
                    ) : filteredSources.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">
                            <div className="empty-state-icon">
                              <ClipboardList size={28} />
                            </div>
                            <div className="empty-state-title">Aucune source</div>
                            <div className="empty-state-sub">Modifiez vos filtres.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSources.map((src) => {
                        const cfg = TYPE_CONFIG[src.type] || TYPE_CONFIG.SANCTION;
                        const Icon = cfg.icon;
                        const isSyncing = syncing.has(src.id);

                        return (
                          <tr key={src.id} className={selected.includes(src.id) ? "selected" : ""}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selected.includes(src.id)}
                                onChange={() => toggleSelect(src.id)}
                              />
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{src.flag}</span>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                                    {src.name}
                                  </div>
                                  <div className="small" style={{ opacity: 0.5, marginTop: 1 }}>
                                    {src.code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  color: cfg.color,
                                  background: cfg.bg,
                                  borderColor: `${cfg.color}40`,
                                  fontSize: 11,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Icon size={14} strokeWidth={2.1} />
                                {cfg.label}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${src.status === "active" ? "badge-ok" : "badge-warn"}`}>
                                ● {src.status === "active" ? "Active" : isSyncing ? "Syncing…" : src.status}
                              </span>
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: 700,
                                fontSize: 14,
                                color: "var(--text-accent)",
                              }}
                            >
                              {src.hits.toLocaleString()}
                            </td>
                            <td className="small" style={{ color: "var(--text-muted)" }}>
                              {fmtAgo(src.last_updated)}
                            </td>
                            <td>
                              <div className="row" style={{ gap: 6 }}>
                                <button className="btn secondary sm">Manage</button>
                                <button
                                  className="btn secondary sm"
                                  disabled={isSyncing}
                                  onClick={() => syncSource(src.id)}
                                >
                                  {isSyncing ? "…" : "Sync"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {selected.length > 0 && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                  <button
                    className="btn secondary sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <ClipboardList size={14} strokeWidth={2.2} />
                    Batch Review ({selected.length})
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: 14 }}>
                  Recent Updates
                </div>
                {sources
                  .filter((s) => s.last_updated)
                  .sort((a, b) => (b.last_updated || "").localeCompare(a.last_updated || ""))
                  .slice(0, 5)
                  .map((s, i) => {
                    const cfg = TYPE_CONFIG[s.type] || TYPE_CONFIG.SANCTION;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>
                            {s.name}
                          </span>
                          <span className="badge" style={{ fontSize: 10, color: cfg.color, background: cfg.bg }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="small" style={{ color: "var(--text-muted)" }}>
                            {s.hits.toLocaleString()} entités · {fmtAgo(s.last_updated)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                <button
                  className="btn secondary sm"
                  style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
                  onClick={() => {
                    sources.forEach((s) => syncSource(s.id));
                  }}
                >
                  Sync All Sources
                </button>
              </div>

              <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: 12 }}>
                  Vue d'ensemble
                </div>
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
                  const info = summaryByType[type] || { hits: 0 };
                  const pct = totalHits > 0 ? Math.round((info.hits / totalHits) * 100) : 0;
                  const Icon = cfg.icon;
                  return (
                    <div key={type} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span
                          className="small"
                          style={{
                            color: cfg.color,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Icon size={14} strokeWidth={2.1} />
                          {cfg.label}
                        </span>
                        <span className="small" style={{ color: "var(--text-muted)" }}>
                          {info.hits.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 2,
                            width: `${pct}%`,
                            background: cfg.color,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "search" && (
        <>
          <div className="filters-bar" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 240 }}
                placeholder="Rechercher une entité, personne ou organisation…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch(0)}
              />
              <select
                className="select"
                style={{ width: "auto", padding: "8px 28px 8px 12px" }}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                <option value="">Tous types</option>
                <option value="person">Personne</option>
                <option value="company">Entreprise</option>
              </select>
              <select
                className="select"
                style={{ width: "auto", padding: "8px 28px 8px 12px" }}
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="">Tous risques</option>
                <option value="HIGH">High Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="LOW">Low Risk</option>
              </select>
              <button
                className="btn"
                onClick={() => doSearch(0)}
                disabled={searching || query.trim().length < 2}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Search size={15} strokeWidth={2.2} />
                {searching ? "Recherche…" : "Rechercher"}
              </button>
              {hasSearched && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setHasSearched(false);
                    setDetailItem(null);
                  }}
                >
                  Effacer
                </button>
              )}
            </div>
            {searchErr && (
              <div
                className="toast danger"
                style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}
              >
                <AlertTriangle size={16} strokeWidth={2.2} />
                {searchErr}
              </div>
            )}
          </div>

          {!hasSearched ? (
            <div className="screen">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Search size={28} />
                </div>
                <div className="empty-state-title">Recherchez dans les entités sanctionnées</div>
                <div className="empty-state-sub">
                  Saisissez un nom (min. 2 car.) pour rechercher parmi{" "}
                  {sources.reduce((a, s) => a + s.hits, 0).toLocaleString()} entités.
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: detailItem ? "1fr 360px" : "1fr",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div>
                {results.length > 0 && (
                  <div className="stat-pills" style={{ marginBottom: 14 }}>
                    <div className="stat-pill all">
                      <span className="pill-count">{total}</span>
                      <span className="pill-label">Total</span>
                    </div>
                    <div className="stat-pill high">
                      <span className="pill-count">{results.filter((r) => r.risk_level === "HIGH").length}</span>
                      <span className="pill-label">High</span>
                    </div>
                    <div className="stat-pill medium">
                      <span className="pill-count">{results.filter((r) => r.risk_level === "MEDIUM").length}</span>
                      <span className="pill-label">Medium</span>
                    </div>
                    <div className="stat-pill low">
                      <span className="pill-count">{results.filter((r) => r.risk_level === "LOW").length}</span>
                      <span className="pill-label">Low</span>
                    </div>
                  </div>
                )}

                <div className="screen" style={{ padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span className="h2" style={{ margin: 0 }}>
                      {searching ? "Recherche…" : `${total} résultat${total !== 1 ? "s" : ""} pour « ${query} »`}
                    </span>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="pagination-btn"
                        disabled={offset <= 0 || searching}
                        onClick={() => doSearch(offset - PAGE)}
                      >
                        ‹
                      </button>
                      <span className="small" style={{ color: "var(--text-muted)" }}>
                        {offset + 1}–{Math.min(offset + PAGE, total)}/{total}
                      </span>
                      <button
                        className="pagination-btn"
                        disabled={offset + PAGE >= total || searching}
                        onClick={() => doSearch(offset + PAGE)}
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  {results.length === 0 && !searching ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Search size={28} />
                      </div>
                      <div className="empty-state-title">Aucun résultat</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="cases-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Entité</th>
                            <th>Type</th>
                            <th>Risk Level</th>
                            <th style={{ textAlign: "right" }}>Sources</th>
                            <th style={{ textAlign: "right" }}>Score</th>
                            <th style={{ width: 90 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r) => (
                            <tr key={r.entity_id} className={detailItem?.id === r.entity_id ? "selected" : ""}>
                              <td>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.primary_name}</div>
                                {r.best_norm !== r.primary_name.toLowerCase() && (
                                  <div
                                    className="small"
                                    style={{ opacity: 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                                  >
                                    <Search size={12} />
                                    {r.best_norm}
                                  </div>
                                )}
                              </td>
                              <td className="small" style={{ textTransform: "capitalize", color: "var(--text-secondary)" }}>
                                {r.entity_type}
                              </td>
                              <td>
                                <RiskBadge risk={r.risk_level} />
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-accent)" }}>
                                {r.source_count}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 13,
                                    color:
                                      r.similarity >= 0.8
                                        ? "#E84040"
                                        : r.similarity >= 0.6
                                        ? "#F5920A"
                                        : "var(--text-muted)",
                                  }}
                                >
                                  {Math.round(r.similarity * 100)}%
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn secondary sm"
                                  disabled={detailBusy}
                                  onClick={() => loadDetail(r.entity_id)}
                                >
                                  Détails
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {detailItem && (
                <div className="screen" style={{ position: "sticky", top: "calc(var(--topnav-height) + 16px)" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div className="h2" style={{ margin: 0 }}>
                        {detailItem.primary_name}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        <RiskBadge risk={detailItem.risk_level} />
                        <span className="badge" style={{ textTransform: "capitalize" }}>
                          {detailItem.entity_type}
                        </span>
                        {detailItem.country_focus && (
                          <span
                            className="badge"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <Globe size={13} />
                            {detailItem.country_focus}
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => setDetailItem(null)}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                      Sources ({detailItem.sources.length})
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {detailItem.sources.slice(0, 5).map((s, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 12px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <RecordTypeBadge type={s.record_type} />
                              <span className="badge">{SOURCE_LABELS[s.source_id] || `Src ${s.source_id}`}</span>
                            </div>
                            {s.listed_on && (
                              <span className="small" style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {s.listed_on}
                              </span>
                            )}
                          </div>
                          {s.program && (
                            <div className="small" style={{ marginTop: 5 }}>
                              <b>Programme :</b> {s.program}
                            </div>
                          )}
                          {s.summary && (
                            <div className="small" style={{ marginTop: 4, opacity: 0.85 }}>
                              {s.summary.slice(0, 150)}
                              {s.summary.length > 150 ? "…" : ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {detailItem.names.length > 1 && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                        Alias ({detailItem.names.length})
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {detailItem.names.slice(0, 12).map((n, i) => (
                          <span key={i} className="badge" style={{ fontSize: 11 }}>
                            {n.is_primary && "★ "}
                            {n.name_raw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}