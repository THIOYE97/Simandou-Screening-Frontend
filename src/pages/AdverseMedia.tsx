// Base BCRG des médias défavorables — alimentation et suivi par la Conformité.
//
// Cette base était restée vide non par oubli, mais parce qu'aucun écran ne
// permettait de la remplir : seul un appel d'API unitaire existait, quand une
// équipe de conformité travaille sur tableur. C'est pourtant elle qui fait foi
// et qui pèse sur le niveau de risque des personnes morales.
import { useEffect, useRef, useState } from "react";
import {
  Newspaper, Upload, Download, Plus, Search, CheckCircle2, Ban, AlertTriangle,
} from "lucide-react";
import {
  listAdverseRecords, addAdverseRecord, toggleAdverseRecord,
  importAdverseCsv, downloadAdverseTemplate, type AdverseRecord,
} from "../api";
import {
  Button, Card, CardTitle, PageHeader, Badge, Field, Input, Select, Textarea,
  EmptyState, SkeletonRows, StatCard, useUI, fmtDate,
} from "../ui";

const CATEGORIES: Record<string, string> = {
  FRAUD: "Fraude",
  CORRUPTION: "Corruption",
  MONEY_LAUNDERING: "Blanchiment",
  TERRORISM: "Financement du terrorisme",
  TRAFFICKING: "Trafic",
  SANCTIONS_EVASION: "Contournement de sanctions",
  ORGANIZED_CRIME: "Criminalité organisée",
  OTHER: "Autre",
};

// Catégories tenues pour graves : elles portent le risque à élevé quand le
// rapprochement est fort. Aligné sur le service.
const GRAVES = new Set([
  "MONEY_LAUNDERING", "TERRORISM", "SANCTIONS_EVASION",
  "ORGANIZED_CRIME", "TRAFFICKING",
]);

export default function AdverseMedia() {
  const { toast } = useUI();
  const [rows, setRows] = useState<AdverseRecord[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nom, setNom] = useState("");
  const [cat, setCat] = useState("CORRUPTION");
  const [src, setSrc] = useState("");
  const [url, setUrl] = useState("");
  const [resume, setResume] = useState("");

  async function load() {
    try { setRows(await listAdverseRecords()); }
    catch { toast("Chargement impossible", "error"); setRows([]); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ajouter() {
    if (nom.trim().length < 3) { toast("Dénomination trop courte", "error"); return; }
    setBusy(true);
    try {
      await addAdverseRecord({
        entity_name: nom.trim(), category: cat,
        source: src.trim() || undefined, url: url.trim() || undefined,
        summary: resume.trim() || undefined,
      });
      setNom(""); setSrc(""); setUrl(""); setResume("");
      toast("Signalement enregistré");
      load();
    } catch { toast("Enregistrement impossible", "error"); }
    finally { setBusy(false); }
  }

  async function importer(f: File) {
    setBusy(true);
    try {
      const r = await importAdverseCsv(f);
      toast(`${r.crees} signalement(s) ajouté(s), ${r.ignores} déjà présent(s)`);
      if (r.erreurs?.length) {
        toast(`${r.erreurs.length} ligne(s) en erreur — ${r.erreurs[0]}`, "error");
      }
      load();
    } catch (e: any) {
      toast(e?.response?.data?.detail || "Import impossible", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function basculer(r: AdverseRecord) {
    try {
      await toggleAdverseRecord(r.id, !r.active);
      load();
    } catch { toast("Modification impossible", "error"); }
  }

  const filtres = (rows ?? []).filter((r) =>
    !q.trim() || r.entity_name.toLowerCase().includes(q.trim().toLowerCase()));
  const actifs = (rows ?? []).filter((r) => r.active).length;
  const graves = (rows ?? []).filter((r) => r.active && GRAVES.has(r.category)).length;

  return (
    <div>
      <PageHeader
        icon={<Newspaper size={22} />}
        title="Médias défavorables — base BCRG"
        subtitle="Signalements retenus par la Conformité. Cette base fait foi : elle relève le niveau de risque des personnes morales vérifiées."
        actions={<>
          <Button variant="secondary" icon={<Download size={16} />}
            onClick={() => downloadAdverseTemplate()}>Modèle de fichier</Button>
          <Button icon={<Upload size={16} />} disabled={busy}
            onClick={() => fileRef.current?.click()}>
            {busy ? "Import…" : "Importer un fichier"}
          </Button>
        </>}
      />
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); }} />

      {rows !== null && rows.length === 0 && (
        <Card className="ds-mb-16" style={{ borderColor: "var(--risk-high)" }}>
          <div className="ds-row" style={{ gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={18} style={{ color: "var(--risk-high)", marginTop: 2, flexShrink: 0 }} />
            <div className="ds-small" style={{ lineHeight: 1.55 }}>
              <b>Cette base est vide.</b> Le volet « médias défavorables » s'exécute
              à chaque vérification de personne morale, mais il ne signalera rien
              tant que la Conformité ne l'aura pas alimentée. Un dossier sans
              signalement ne signifie donc pas, aujourd'hui, qu'il n'y en a pas.
            </div>
          </div>
        </Card>
      )}

      <div className="ds-grid ds-grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={<Newspaper size={20} />} value={String(rows?.length ?? "—")} label="Signalements" />
        <StatCard icon={<CheckCircle2 size={20} />} value={String(actifs)} label="Actifs" />
        <StatCard icon={<AlertTriangle size={20} />} value={String(graves)} label="Faits graves" />
        <StatCard icon={<Ban size={20} />} value={String((rows?.length ?? 0) - actifs)} label="Désactivés" />
      </div>

      <Card className="ds-mb-16">
        <CardTitle sub="Un signalement isolé peut aussi être saisi à la main.">
          Ajouter un signalement
        </CardTitle>
        <div className="ds-row ds-wrap" style={{ gap: 12, alignItems: "flex-end" }}>
          <Field label="Dénomination sociale">
            <Input value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="ex. Global Mining SARL" style={{ minWidth: 240 }} />
          </Field>
          <Field label="Catégorie">
            <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 220 }}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <Input value={src} onChange={(e) => setSrc(e.target.value)}
              placeholder="ex. OCCRP" style={{ width: 160 }} />
          </Field>
          <Field label="Lien (facultatif)">
            <Input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…" style={{ width: 220 }} />
          </Field>
          <Button icon={<Plus size={16} />} onClick={ajouter} disabled={busy}>Ajouter</Button>
        </div>
        <div className="ds-mt-16">
          <Field label="Résumé du fait signalé">
            <Textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={2}
              placeholder="Ce que l'analyste doit comprendre en lisant le dossier." />
          </Field>
        </div>
      </Card>

      <Card pad0>
        <div style={{ padding: "18px 22px 0" }}>
          <CardTitle sub="Un signalement retiré est désactivé, jamais supprimé : les dossiers déjà décidés doivent rester relisibles.">
            Signalements enregistrés
          </CardTitle>
          <div style={{ maxWidth: 320, marginBottom: 14 }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une dénomination…" />
          </div>
        </div>

        {rows === null ? <SkeletonRows rows={5} /> : filtres.length === 0 ? (
          <div style={{ padding: "0 22px 22px" }}>
            <EmptyState icon={<Search size={26} />}
              title={rows.length === 0 ? "Aucun signalement" : "Aucun résultat"}
              subtitle={rows.length === 0
                ? "Importez un fichier ou saisissez un premier signalement."
                : "Aucune dénomination ne correspond à cette recherche."} />
          </div>
        ) : (
          <div className="ds-table-wrap" style={{ border: "none" }}>
            <table className="ds-table">
              <thead><tr>
                <th>Dénomination</th><th>Catégorie</th><th>Source</th>
                <th>Enregistré le</th><th>État</th><th></th>
              </tr></thead>
              <tbody>
                {filtres.map((r) => (
                  <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                    <td style={{ fontWeight: 650 }}>
                      {r.entity_name}
                      {r.summary && (
                        <div className="ds-small ds-muted" style={{ marginTop: 2 }}>
                          {r.summary}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone={GRAVES.has(r.category) ? "critical" : "neutral"}>
                        {CATEGORIES[r.category] || r.category}
                      </Badge>
                    </td>
                    <td className="ds-small ds-muted">
                      {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.source || "lien"}</a>
                             : (r.source || "—")}
                    </td>
                    <td className="ds-small ds-muted">{fmtDate(r.created_at)}</td>
                    <td>
                      <Badge tone={r.active ? "low" : "neutral"}>
                        {r.active ? "Actif" : "Désactivé"}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="secondary" onClick={() => basculer(r)}>
                        {r.active ? "Désactiver" : "Réactiver"}
                      </Button>
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
