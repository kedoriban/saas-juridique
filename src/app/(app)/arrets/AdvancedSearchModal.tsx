"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

type FieldType = "text" | "select" | "tristate" | "date" | "multicheck" | "textarea";

interface SelectOption {
  value: string;
  label: string;
}

interface FieldDef {
  param: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  placeholder?: string;
  cols?: 2;
}

interface SectionDef {
  id: string;
  label: string;
  fields: FieldDef[];
}

export type CriterionListItem = {
  id: string;
  label_original: string;
  language: string;
  section_label: string;
};

type CriteriaRow = { uid: string; criterionId: string; keyword: string };

// ── Données statiques ──────────────────────────────────────────────────────────

const TRISTATE: SelectOption[] = [
  { value: "", label: "Non défini" },
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

const PERSECUTIONS_OPTIONS: SelectOption[] = [
  { value: "excision", label: "Excision / MGF" },
  { value: "mariage_force_genre", label: "Mariage forcé" },
  { value: "violence_domestique", label: "Violence domestique" },
  { value: "viol", label: "Viol" },
  { value: "violence_sexuelle", label: "Violence sexuelle" },
  { value: "traite", label: "Traite des êtres humains" },
  { value: "harcelement", label: "Harcèlement" },
  { value: "persecution_politique", label: "Persécution politique" },
  { value: "persecution_ethnique", label: "Persécution ethnique" },
  { value: "persecution_religieuse", label: "Persécution religieuse" },
  { value: "opposition_mgf", label: "Opposition aux MGF" },
  { value: "groupe_social_genre", label: "Groupe social (genre)" },
];

// Params gérés séparément : non comptés dans advancedCount
const DATE_MODAL_PARAMS = ["date_from", "date_to"];

const SECTIONS: SectionDef[] = [
  {
    id: "procedure",
    label: "Procédure",
    fields: [
      { param: "date_from", label: "Date arrêt (depuis)", type: "date" },
      { param: "date_to",   label: "Date arrêt (jusqu'au)", type: "date" },
      { param: "numero", label: "N° arrêt", type: "text", placeholder: "Ex. 342062" },
      { param: "chambre", label: "Chambre", type: "text", placeholder: "Ex. 3e chambre" },
      { param: "juge", label: "Juge", type: "text", placeholder: "Nom du juge" },
      { param: "avocat", label: "Avocat", type: "text", placeholder: "Nom de l'avocat" },
      { param: "date_arrivee", label: "Date arrivée Belgique", type: "date" },
      { param: "date_dpi", label: "Date intro DPI", type: "date" },
      { param: "duree_proc", label: "Durée procédure", type: "text", placeholder: "Ex. > 2 ans" },
      { param: "proc_acceleree", label: "Procédure accélérée", type: "tristate" },
      { param: "demande_ulterieure", label: "Demande ultérieure (Art. 51/8)", type: "tristate" },
      { param: "pays_sur", label: "Pays d'origine sûr / pays tiers sûr", type: "tristate" },
    ],
  },
  {
    id: "identite",
    label: "Identité",
    fields: [
      { param: "nationalite", label: "Nationalité", type: "text", placeholder: "Ex. afghane" },
      { param: "ethnie", label: "Ethnie", type: "text", placeholder: "Ethnie" },
      { param: "religion", label: "Religion", type: "text", placeholder: "Religion" },
      { param: "taux_mgf", label: "Taux prévalence MGF", type: "text", placeholder: "Ex. > 70%" },
      {
        param: "sexe",
        label: "Sexe",
        type: "select",
        options: [
          { value: "", label: "Non défini" },
          { value: "femme", label: "Femme" },
          { value: "homme", label: "Homme" },
        ],
      },
      {
        param: "region_naissance",
        label: "Région / ville de naissance",
        type: "text",
        placeholder: "Ex. Kaboul",
      },
      { param: "lieu_vie", label: "Lieu de vie", type: "text" },
      { param: "mena", label: "MENA (mineur non accompagné)", type: "tristate" },
      { param: "docs_identite", label: "Documents d'identité déposés", type: "tristate" },
    ],
  },
  {
    id: "profil",
    label: "Profil",
    fields: [
      { param: "avec_enfants", label: "Avec enfant(s)", type: "tristate" },
      { param: "annee_naissance", label: "Année de naissance", type: "text", placeholder: "Ex. 1990" },
      { param: "mere_celibataire", label: "Mère célibataire", type: "tristate" },
      { param: "niveau_etude", label: "Niveau d'études", type: "text", placeholder: "Ex. universitaire" },
      { param: "autonomie", label: "Autonomie financière", type: "tristate" },
      { param: "mgf", label: "MGF / crainte de MGF", type: "tristate" },
      { param: "reexcision", label: "Réexcision / crainte de réexcision", type: "tristate" },
      { param: "desinfibulation", label: "Désinfibulation subie ou prévue", type: "tristate" },
      {
        param: "mariage_force",
        label: "Mariage forcé / précoce",
        type: "select",
        options: [
          { value: "", label: "Non défini" },
          { value: "craint", label: "Craint" },
          { value: "effectif", label: "Effectif" },
          { value: "non", label: "Non" },
        ],
      },
      { param: "violences_parcours", label: "Violences parcours migratoire", type: "tristate" },
      { param: "enfant_soldat", label: "Enfant-soldat", type: "tristate" },
      {
        param: "vulnerabilites",
        label: "Vulnérabilités particulières",
        type: "textarea",
        placeholder: "Décrivez les vulnérabilités reconnues…",
        cols: 2,
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    fields: [
      { param: "rapport_medical", label: "Rapport médical déposé", type: "tristate" },
      {
        param: "rapport_psy",
        label: "Rapport psychologique / psychiatrique",
        type: "tristate",
      },
      {
        param: "besoins_proc",
        label: "Besoins procéduraux spéciaux accordés",
        type: "tristate",
      },
      { param: "art_22", label: "Art. 22 §1/1 Loi accueil", type: "tristate" },
    ],
  },
  {
    id: "persecutions",
    label: "Persécutions",
    fields: [
      {
        param: "persecutions_genre",
        label: "Persécutions de genre invoquées",
        type: "multicheck",
        cols: 2,
      },
      {
        param: "opinions_politiques",
        label: "Persécutions liées à opinions politiques / opposition MGF",
        type: "tristate",
      },
      {
        param: "groupe_social",
        label: "Appartenance à un groupe social",
        type: "text",
        placeholder: "Ex. femmes afghanes non émancipées",
        cols: 2,
      },
    ],
  },
  {
    id: "decision",
    label: "Décision",
    fields: [
      {
        param: "type_dec",
        label: "Type de décision",
        type: "select",
        options: [
          { value: "", label: "Tous" },
          { value: "annulation", label: "Annulation" },
          { value: "plein_contentieux", label: "Plein contentieux" },
          { value: "confirmation", label: "Confirmation" },
          { value: "refus", label: "Refus" },
          { value: "irrecevabilite", label: "Irrecevabilité" },
          { value: "autre", label: "Autre" },
        ],
      },
      { param: "statut_refugie_ant", label: "Statut réfugié antérieur", type: "tristate" },
      { param: "credibilite", label: "Crédibilité du récit / bénéfice du doute", type: "tristate" },
      { param: "art_48_7", label: "Art. 48/7 (persécution passée)", type: "tristate" },
      { param: "sequelles_perm", label: "Séquelles permanentes", type: "tristate" },
      {
        param: "agent_persecution",
        label: "Agent de persécution",
        type: "text",
        placeholder: "Ex. État, groupe armé",
      },
      {
        param: "agent_protection",
        label: "Agent(s) de protection",
        type: "text",
        placeholder: "Ex. UNHCR, police nationale",
      },
      { param: "protection_nationale", label: "Protection nationale effective", type: "tristate" },
      { param: "fuite_interne", label: "Possibilité de fuite interne", type: "tristate" },
      { param: "portee_jurisprud", label: "Portée jurisprudentielle", type: "tristate" },
      {
        param: "motivation_cgra",
        label: "Motivation CGRA (mots-clés)",
        type: "textarea",
        placeholder: "Mots-clés de la motivation CGRA…",
        cols: 2,
      },
      {
        param: "motivation_cce",
        label: "Motivation CCE (mots-clés)",
        type: "textarea",
        placeholder: "Mots-clés de la motivation CCE…",
        cols: 2,
      },
      {
        param: "coi_cites",
        label: "COI cités",
        type: "text",
        placeholder: "Rapports pays d'origine cités",
      },
      {
        param: "jurisprudence",
        label: "Jurisprudence / doctrine citées",
        type: "text",
        placeholder: "Références jurisprudentielles",
      },
    ],
  },
  {
    id: "criteres",
    label: "Critères",
    fields: [], // handled dynamically via criteriaRows state
  },
];

// Advanced params tracked in the advancedCount badge (excludes date modal params + criteria)
export const ADVANCED_PARAMS = SECTIONS.flatMap((s) => s.fields.map((f) => f.param))
  .filter((p) => !DATE_MODAL_PARAMS.includes(p));

// ── Helpers ────────────────────────────────────────────────────────────────────

function getActiveFilters(
  draft: Record<string, string>,
  criteriaRows: CriteriaRow[],
  criteriaList: CriterionListItem[],
) {
  const active: { param: string; label: string; value: string }[] = [];
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const v = draft[field.param];
      if (!v) continue;
      let displayValue = v;
      if (field.type === "tristate") {
        displayValue = v === "oui" ? "Oui" : "Non";
      } else if (field.type === "select" && field.options) {
        const opt = field.options.find((o) => o.value === v);
        if (opt) displayValue = opt.label;
      } else if (field.param === "persecutions_genre") {
        displayValue = v
          .split(",")
          .map((k) => PERSECUTIONS_OPTIONS.find((p) => p.value === k)?.label ?? k)
          .join(", ");
      }
      active.push({ param: field.param, label: field.label, value: displayValue });
    }
  }
  // Criteria rows
  for (const row of criteriaRows) {
    if (!row.criterionId || !row.keyword) continue;
    const criterion = criteriaList.find((c) => c.id === row.criterionId);
    active.push({
      param: `criteria:${row.uid}`,
      label: criterion?.label_original ?? row.criterionId,
      value: row.keyword,
    });
  }
  return active;
}

// ── Field renderer ─────────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  draft,
  onSet,
  onToggleMulti,
}: {
  field: FieldDef;
  draft: Record<string, string>;
  onSet: (param: string, value: string) => void;
  onToggleMulti: (param: string, value: string) => void;
}) {
  const value = draft[field.param] ?? "";

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-forest-300 bg-white";

  if (field.type === "tristate") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">{field.label}</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {TRISTATE.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onSet(field.param, o.value)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                value === o.value
                  ? "bg-forest-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">{field.label}</label>
        <select
          value={value}
          onChange={(e) => onSet(field.param, e.target.value)}
          className={inputCls}
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "multicheck") {
    const selected = value.split(",").filter(Boolean);
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">{field.label}</label>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6">
          {PERSECUTIONS_OPTIONS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.includes(p.value)}
                onChange={() => onToggleMulti(field.param, p.value)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-forest-600 focus:ring-forest-500 shrink-0"
              />
              <span className="text-xs text-gray-600 group-hover:text-gray-800">{p.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">{field.label}</label>
        <textarea
          value={value}
          onChange={(e) => onSet(field.param, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{field.label}</label>
      <input
        type={field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => onSet(field.param, e.target.value)}
        placeholder={field.placeholder}
        className={inputCls}
      />
    </div>
  );
}

// ── Criteria section ───────────────────────────────────────────────────────────

function CriteriaSection({
  criteriaRows,
  criteriaList,
  onAdd,
  onRemove,
  onUpdate,
}: {
  criteriaRows: CriteriaRow[];
  criteriaList: CriterionListItem[];
  onAdd: () => void;
  onRemove: (uid: string) => void;
  onUpdate: (uid: string, field: "criterionId" | "keyword", value: string) => void;
}) {
  const inputCls =
    "border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-forest-300 bg-white";

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Filtrez les arrêts par valeur extraite pour un critère donné. Plusieurs lignes = logique ET.
      </p>

      {criteriaRows.length === 0 && (
        <p className="text-xs text-gray-400 italic py-2">
          Aucun filtre critère. Cliquez &quot;+ Ajouter un critère&quot; pour commencer.
        </p>
      )}

      {criteriaRows.map((row) => (
        <div key={row.uid} className="flex items-center gap-2">
          <select
            value={row.criterionId}
            onChange={(e) => onUpdate(row.uid, "criterionId", e.target.value)}
            className={`flex-[2] min-w-0 ${inputCls}`}
          >
            <option value="">— Choisir un critère —</option>
            {criteriaList.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.language.toUpperCase()}] {c.label_original}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={row.keyword}
            onChange={(e) => onUpdate(row.uid, "keyword", e.target.value)}
            placeholder="Mot-clé…"
            className={`flex-1 min-w-0 ${inputCls}`}
          />
          <button
            type="button"
            onClick={() => onRemove(row.uid)}
            className="text-gray-300 hover:text-red-400 text-xl leading-none shrink-0 transition-colors"
            aria-label="Supprimer ce filtre"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-xs text-forest-600 hover:text-forest-700 font-medium transition-colors"
      >
        <span className="text-base leading-none font-bold">+</span> Ajouter un critère
      </button>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export default function AdvancedSearchModal({
  open,
  onClose,
  criteriaList = [],
}: {
  open: boolean;
  onClose: () => void;
  criteriaList?: CriterionListItem[];
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [criteriaRows, setCriteriaRows] = useState<CriteriaRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    SECTIONS.forEach((s) =>
      s.fields.forEach((f) => {
        const v = sp.get(f.param);
        if (v) init[f.param] = v;
      })
    );
    setDraft(init);

    // Parse criteria rows from URL param
    const criteriaParam = sp.get("criteria") ?? "";
    const rows: CriteriaRow[] = criteriaParam
      .split(",")
      .map((s) => {
        const colonIdx = s.indexOf(":");
        if (colonIdx === -1) return null;
        const criterionId = s.slice(0, colonIdx).trim();
        const keyword = s.slice(colonIdx + 1).trim();
        return criterionId && keyword
          ? { uid: crypto.randomUUID(), criterionId, keyword }
          : null;
      })
      .filter((x): x is CriteriaRow => x !== null);
    setCriteriaRows(rows);

    setActiveSection(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  function set(param: string, value: string) {
    setDraft((prev) => ({ ...prev, [param]: value }));
  }

  function toggleMulti(param: string, value: string) {
    const current = (draft[param] || "").split(",").filter(Boolean);
    const idx = current.indexOf(value);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(value);
    set(param, current.join(","));
  }

  function addCriteriaRow() {
    setCriteriaRows((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), criterionId: "", keyword: "" },
    ]);
  }

  function removeCriteriaRow(uid: string) {
    setCriteriaRows((prev) => prev.filter((r) => r.uid !== uid));
  }

  function updateCriteriaRow(uid: string, field: "criterionId" | "keyword", value: string) {
    setCriteriaRows((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, [field]: value } : r))
    );
  }

  function handleApply() {
    const params = new URLSearchParams(sp.toString());

    // Clear standard advanced params
    ADVANCED_PARAMS.forEach((p) => params.delete(p));
    // Also clear date modal params
    DATE_MODAL_PARAMS.forEach((p) => params.delete(p));
    // Clear criteria
    params.delete("criteria");

    // Set non-empty draft values
    Object.entries(draft).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    // Encode criteria rows
    const criteriaValue = criteriaRows
      .filter((r) => r.criterionId && r.keyword)
      .map((r) => `${r.criterionId}:${r.keyword}`)
      .join(",");
    if (criteriaValue) params.set("criteria", criteriaValue);

    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    onClose();
  }

  function handleReset() {
    const params = new URLSearchParams(sp.toString());
    ADVANCED_PARAMS.forEach((p) => params.delete(p));
    DATE_MODAL_PARAMS.forEach((p) => params.delete(p));
    params.delete("criteria");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setDraft({});
    setCriteriaRows([]);
    onClose();
  }

  const activeFilters = getActiveFilters(draft, criteriaRows, criteriaList);
  const section = SECTIONS[activeSection];

  function sectionHasFilters(s: SectionDef) {
    if (s.id === "criteres") return criteriaRows.some((r) => r.criterionId && r.keyword);
    return s.fields.some((f) => !!draft[f.param]);
  }

  function removeFilter(param: string) {
    if (param.startsWith("criteria:")) {
      const uid = param.slice("criteria:".length);
      setCriteriaRows((prev) => prev.filter((r) => r.uid !== uid));
    } else {
      set(param, "");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4 sm:pt-10">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full sm:max-w-5xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[93dvh] sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900">Recherche avancée</span>
            {activeFilters.length > 0 && (
              <span className="bg-forest-600 text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
                {activeFilters.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Mobile: section tabs */}
        <div className="lg:hidden flex overflow-x-auto px-4 py-2.5 gap-2 border-b border-gray-100 shrink-0">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(i)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors ${
                i === activeSection
                  ? "bg-forest-600 text-white"
                  : sectionHasFilters(s)
                  ? "bg-forest-100 text-forest-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.label}
              {sectionHasFilters(s) && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    i === activeSection ? "bg-white/70" : "bg-forest-500"
                  }`}
                />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left nav — desktop */}
          <div className="hidden lg:flex flex-col w-44 shrink-0 border-r border-gray-100 py-2 overflow-y-auto">
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(i)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                  i === activeSection
                    ? "bg-forest-50 text-forest-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{s.label}</span>
                {sectionHasFilters(s) && (
                  <span className="w-2 h-2 rounded-full bg-forest-500 shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {section.label}
            </p>
            {section.id === "criteres" ? (
              <CriteriaSection
                criteriaRows={criteriaRows}
                criteriaList={criteriaList}
                onAdd={addCriteriaRow}
                onRemove={removeCriteriaRow}
                onUpdate={updateCriteriaRow}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.fields.map((field) => (
                  <div key={field.param} className={field.cols === 2 ? "sm:col-span-2" : ""}>
                    <FieldRenderer
                      field={field}
                      draft={draft}
                      onSet={set}
                      onToggleMulti={toggleMulti}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel — desktop */}
          <div className="hidden lg:flex flex-col w-56 shrink-0 border-l border-gray-100">
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Filtres sélectionnés
              </p>
              {activeFilters.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun filtre</p>
              ) : (
                <div className="space-y-2.5">
                  {activeFilters.map((f) => (
                    <div key={f.param} className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 leading-tight truncate">{f.label}</p>
                        <p className="text-xs font-semibold text-forest-700 break-words leading-tight mt-0.5">
                          {f.value}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFilter(f.param)}
                        className="text-gray-300 hover:text-gray-500 text-base leading-none shrink-0 mt-0.5"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 space-y-2 shrink-0">
              <button
                type="button"
                onClick={handleApply}
                className="w-full bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                Lancer la recherche
              </button>
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
                >
                  Tout réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer — mobile */}
        <div className="lg:hidden shrink-0 px-4 py-3 border-t border-gray-100 flex items-center gap-3">
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
            >
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {activeFilters.length > 0
              ? `Lancer (${activeFilters.length} filtre${activeFilters.length > 1 ? "s" : ""})`
              : "Lancer la recherche"}
          </button>
        </div>
      </div>
    </div>
  );
}
