// Liste noire et interdits bancaires de la BCRG.
//
// Le fichier reversé fait autorité : une référence absente vaut LEVÉE
// d'interdiction. Plutôt que d'en avertir par écrit, l'écran impose le
// passage par une simulation dont le résultat est chiffré et lisible — c'est
// le flux lui-même qui empêche le reversement à l'aveugle.
import { useEffect, useRef, useState } from "react";
import {
  Ban, Upload, Download, CheckCircle2, RotateCcw, ArrowRight, X,
} from "lucide-react";
import {
  getBlacklistState, listBlacklist, importBlacklist, downloadBlacklistTemplate,
  type BlacklistState, type BlacklistRecord, type BlacklistImport,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, Badge, Input,
  EmptyState, SkeletonRows, StatCard, useUI, fmtDate,
} from "../ui";

export default function Blacklist() {
  const { toast } = useUI();
  const [etat, setEtat] = useState<BlacklistState | null>(null);
  const [rows, setRows] = useState<BlacklistRecord[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  // Fichier retenu + impact mesuré : tant que l'impact n'est pas affiché,
  // le reversement n'est pas proposé.
  const [fichier, setFichier] = useState<File | null>(null);
  const [impact, setImpact] = useState<BlacklistImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [e, r] = await Promise.all([getBlacklistState(), listBlacklist()]);
      setEtat(e); setRows(r);
    } catch { toast("Chargement impossible", "error"); setRows([]); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function simuler(f: File) {
    setBusy(true); setFichier(f); setImpact(null);
    try {
      setImpact(await importBlacklist(f, true));
    } catch (e: any) {
      setFichier(null);
      toast(e?.response?.data?.detail || "Fichier illisible", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function appliquer() {
    if (!fichier) return;
    setBusy(true);
    try {
      const r = await importBlacklist(fichier, false);
      toast(`${r.created ?? 0} inscrite(s), ${r.delisted ?? 0} levée(s)`);
      setFichier(null); setImpact(null);
      load();
    } catch { toast("Reversement impossible", "error"); }
    finally { setBusy(false); }
  }

  const filtres = (rows ?? []).filter((r) =>
    !q.trim() || r.primary_name.toLowerCase().includes(q.trim().toLowerCase())
    || (r.source_ref || "").toLowerCase().includes(q.trim().toLowerCase()));

  const leveesEnJeu = (impact?.would_delist ?? 0) > 0;

  return (
    <div>
      <PageHeader
        icon={<Ban size={22} />}
        title="Liste noire — interdits bancaires"
        actions={<>
          <Button variant="secondary" icon={<Download size={16} />}
            onClick={() => downloadBlacklistTemplate()}>Modèle</Button>
          <Button icon={<Upload size={16} />} disabled={busy}
            onClick={() => fileRef.current?.click()}>Reverser un fichier</Button>
        </>}
      />
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) simuler(f); }} />

      <div className="ds-grid ds-grid-3" style={{ marginBottom: 20 }}>
        <StatCard icon={<Ban size={20} />} value={String(etat?.actifs ?? "—")}
          label="Interdictions en vigueur" />
        <StatCard icon={<RotateCcw size={20} />} value={String(etat?.leves ?? "—")}
          label="Interdictions levées" />
        <StatCard icon={<CheckCircle2 size={20} />} value={String(etat?.total ?? "—")}
          label="Décisions enregistrées" />
      </div>

      {/* Impact mesuré : c'est lui qui autorise — ou retient — le reversement. */}
      {impact && (
        <Card className="ds-mb-16"
          style={{ borderColor: leveesEnJeu ? "var(--risk-high)" : "var(--brand-100)" }}>
          <div className="ds-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <CardTitle sub={fichier?.name}>Effet de ce fichier</CardTitle>
            <Button variant="secondary" icon={<X size={15} />}
              onClick={() => { setFichier(null); setImpact(null); }}>Annuler</Button>
          </div>

          <div className="ds-row ds-wrap" style={{ gap: 28, margin: "8px 0 18px" }}>
            <div>
              <div className="ds-small ds-muted">Nouvelles interdictions</div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>{impact.would_create ?? 0}</div>
            </div>
            <div style={{ alignSelf: "center", color: "var(--text-soft)" }}>
              <ArrowRight size={20} />
            </div>
            <div>
              <div className="ds-small ds-muted">Interdictions levées</div>
              <div style={{
                fontSize: 30, fontWeight: 700,
                color: leveesEnJeu ? "var(--risk-high)" : undefined,
              }}>{impact.would_delist ?? 0}</div>
            </div>
            <div style={{ alignSelf: "center", flex: 1, minWidth: 220 }}>
              <div className="ds-small ds-muted">
                {impact.fresh ?? 0} ligne(s) reçue(s) · {impact.existing ?? 0} en base
              </div>
            </div>
          </div>

          <Button icon={<Upload size={16} />} disabled={busy} onClick={appliquer}
            variant={leveesEnJeu ? "danger" : "primary"}>
            {busy ? "Reversement…"
                  : leveesEnJeu
                    ? `Reverser et lever ${impact.would_delist} interdiction(s)`
                    : "Reverser ce fichier"}
          </Button>
        </Card>
      )}

      <Card pad0>
        <div style={{ padding: "18px 22px 0" }}>
          <CardTitle>Décisions</CardTitle>
          <div style={{ maxWidth: 320, marginBottom: 14 }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Nom ou référence de décision…" />
          </div>
        </div>

        {rows === null ? <SkeletonRows rows={5} /> : filtres.length === 0 ? (
          <div style={{ padding: "0 22px 22px" }}>
            <EmptyState icon={<Ban size={26} />}
              title={rows.length === 0 ? "Aucune décision enregistrée" : "Aucun résultat"}
              subtitle={rows.length === 0
                ? "Téléchargez le modèle, puis importez le fichier des interdits bancaires."
                : "Aucune décision ne correspond à cette recherche."} />
          </div>
        ) : (
          <div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr>
                <th>Personne / entité</th><th>Référence</th><th>Motif</th>
                <th>Décision</th><th>État</th>
              </tr></thead>
              <tbody>
                {filtres.map((r) => (
                  <tr key={r.source_ref} style={{ opacity: r.date_levee ? 0.55 : 1 }}>
                    <td style={{ fontWeight: 650 }}>
                      {r.primary_name}
                      <div className="ds-small ds-muted" style={{ marginTop: 2 }}>
                        {r.entity_type === "company" ? "Personne morale" : "Personne physique"}
                      </div>
                    </td>
                    <td className="ds-small">{r.source_ref}</td>
                    <td className="ds-small ds-muted">{r.motif || "—"}</td>
                    <td className="ds-small ds-muted">
                      {r.date_decision ? fmtDate(r.date_decision) : "—"}
                    </td>
                    <td>
                      {r.date_levee
                        ? <Badge tone="neutral">Levée le {fmtDate(r.date_levee)}</Badge>
                        : <Badge tone="critical">En vigueur</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
