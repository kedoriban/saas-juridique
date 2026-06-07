import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret, ArretCriteriaValue, Criterion } from "@/lib/types";
import { IconChevronLeft, IconExternalLink, IconArrowUpTray } from "@/components/icons";
import { parseValueText, deriveCriteriaStatus, countryFlag } from "@/lib/utils";
import CopyButton from "@/components/CopyButton";

// ─── constants ──────────────────────────────────────────────────────────────

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  erreur: "Erreur",
};
const STATUT_STYLE: Record<string, string> = {
  en_attente: "bg-gray-100 text-gray-500",
  en_cours: "bg-yellow-100 text-yellow-700",
  termine: "bg-forest-100 text-forest-700",
  erreur: "bg-red-100 text-red-600",
};

const TYPE_DECISION_LABEL: Record<string, string> = {
  annulation: "Annulation",
  plein_contentieux: "Plein contentieux",
  confirmation: "Confirmation",
  refus: "Refus",
  irrecevabilite: "Irrecevabilité",
  autre: "Autre",
};
const TYPE_DECISION_STYLE: Record<string, string> = {
  annulation: "bg-red-100 text-red-700 border-red-200",
  plein_contentieux: "bg-blue-100 text-blue-700 border-blue-200",
  confirmation: "bg-green-100 text-green-700 border-green-200",
  refus: "bg-orange-100 text-orange-700 border-orange-200",
  irrecevabilite: "bg-purple-100 text-purple-700 border-purple-200",
  autre: "bg-gray-100 text-gray-600 border-gray-200",
};

const CRITERIA_STATUS_STYLE = {
  confirme: "bg-green-100 text-green-700",
  applicable: "bg-gray-100 text-gray-600",
  non_applicable: "bg-red-50 text-red-600",
} as const;

const CRITERIA_STATUS_LABEL = {
  confirme: "Confirmé",
  applicable: "Applicable",
  non_applicable: "Non applicable",
} as const;

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 text-sm gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-900 font-medium text-right">{children}</dd>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

type PageProps = { params: Promise<{ id: string }> };

export default async function ArretDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: arret } = await supabase
    .from("arrets")
    .select("*")
    .eq("id", id)
    .single();

  if (!arret) notFound();
  const a = arret as Arret;

  const { data: values } = await supabase
    .from("arret_criteria_values")
    .select("*, criteria(label_original, section_label, language)")
    .eq("arret_id", id)
    .order("created_at");

  type ValueWithCriteria = ArretCriteriaValue & {
    criteria: Pick<Criterion, "label_original" | "section_label" | "language"> | null;
  };
  const criteriaValues = (values ?? []) as ValueWithCriteria[];

  // Pre-compute analysis text for "Copier l'analyse"
  const analyseText = [
    `Arrêt ${a.numero} — ${formatDate(a.date_arret)}`,
    a.source_juridiction ? `Source : ${a.source_juridiction}` : "",
    "",
    "RÉSUMÉ",
    a.resume_ai ?? a.resume ?? "(pas de résumé)",
    "",
    "ANALYSE PAR CRITÈRES",
    "",
    ...criteriaValues.map((v) => {
      const val =
        parseValueText(v.value_text) ??
        (v.value_boolean !== null ? (v.value_boolean ? "Oui" : "Non") : "Non mentionné");
      return `${v.criteria?.label_original ?? "—"}: ${val}`;
    }),
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");

  const headerTitle = [
    a.source_juridiction ?? a.chambre,
    formatDate(a.date_arret),
    `n° ${a.numero}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl">
      {/* Retour */}
      <Link
        href="/arrets"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-forest-600 mb-5 transition-colors"
      >
        <IconChevronLeft className="w-4 h-4" />
        Retour aux arrêts
      </Link>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
          {headerTitle}
        </h1>
        {a.matiere && (
          <p className="text-sm text-gray-500 mt-1">{a.matiere}</p>
        )}

        {/* Chips métadonnées */}
        <div className="flex flex-wrap gap-2 mt-4">
          {/* Date */}
          <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            {formatDate(a.date_arret)}
          </span>

          {/* Langue */}
          <span
            className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg border ${
              a.langue === "fr"
                ? "bg-blue-50 text-blue-700 border-blue-100"
                : "bg-orange-50 text-orange-700 border-orange-100"
            }`}
          >
            {a.langue === "fr" ? "Français" : "Nederlands"}
          </span>

          {/* Source juridiction */}
          {a.source_juridiction && (
            <span className="inline-flex items-center text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">
              {a.source_juridiction}
            </span>
          )}

          {/* Type de décision */}
          {a.type_decision && (
            <span
              className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                TYPE_DECISION_STYLE[a.type_decision] ?? "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {TYPE_DECISION_LABEL[a.type_decision] ?? a.type_decision}
            </span>
          )}

          {/* Statut traitement */}
          <span
            className={`inline-flex items-center text-xs px-3 py-1.5 rounded-lg border font-medium ${
              STATUT_STYLE[a.statut_traitement] ?? "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            {STATUT_LABEL[a.statut_traitement] ?? a.statut_traitement}
          </span>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
          {a.pdf_url && (
            <a
              href={a.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-forest-600 hover:text-forest-700 bg-forest-50 hover:bg-forest-100 border border-forest-200 px-4 py-2 rounded-xl transition-colors"
            >
              <IconExternalLink className="w-4 h-4" />
              Télécharger la source
            </a>
          )}

          {criteriaValues.length > 0 && (
            <CopyButton
              text={analyseText}
              label="Copier l'analyse"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl transition-colors"
            />
          )}

          {/* Exporter PDF — désactivé V1 */}
          <button
            disabled
            title="Disponible prochainement"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-300 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl cursor-not-allowed"
          >
            <IconArrowUpTray className="w-4 h-4" />
            Exporter PDF
          </button>

          {a.statut_traitement === "termine" && (
            <Link
              href={`/validation/${a.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 px-4 py-2 rounded-xl transition-colors"
            >
              Valider les critères →
            </Link>
          )}
        </div>
      </div>

      {/* ── Résumé AI ────────────────────────────────────────────────────── */}
      {(a.resume_ai || a.resume) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-forest-50 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-gray-700">
                {a.resume_ai ? "Résumé IA" : "Résumé"}
              </h2>
            </div>
            <CopyButton
              text={a.resume_ai ?? a.resume ?? ""}
              label="Copier"
              className="text-xs text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
            />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {a.resume_ai ?? a.resume}
          </p>
        </div>
      )}

      {/* ── Informations objectives ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 bg-forest-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-700">
            Informations objectives
          </h2>
        </div>
        <dl className="divide-y divide-gray-50">
          {a.source_juridiction && (
            <InfoRow label="Source">
              {a.source_juridiction}
            </InfoRow>
          )}
          {a.type_decision && (
            <InfoRow label="Type de décision">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  TYPE_DECISION_STYLE[a.type_decision] ?? "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {TYPE_DECISION_LABEL[a.type_decision] ?? a.type_decision}
              </span>
            </InfoRow>
          )}
          {a.chambre && <InfoRow label="Chambre">{a.chambre}</InfoRow>}
          <InfoRow label="Date">{formatDate(a.date_arret)}</InfoRow>
          <InfoRow label="Numéro">
            <span className="tabular-nums">{a.numero}</span>
          </InfoRow>
          <InfoRow label="Langue">
            {a.langue === "fr" ? "Français" : "Nederlands"}
          </InfoRow>
          {a.matiere && <InfoRow label="Matière">{a.matiere}</InfoRow>}
          {a.pays_origine && (
            <InfoRow label="Pays d'origine">
              <span>
                {countryFlag(a.pays_origine)
                  ? `${countryFlag(a.pays_origine)} `
                  : ""}
                {a.pays_origine}
              </span>
            </InfoRow>
          )}
          {a.procedure_type && a.procedure_type !== "unknown" && (
            <InfoRow label="Type procédure">
              <span className="text-xs">{a.procedure_type.replace(/_/g, " ")}</span>
            </InfoRow>
          )}
          {a.language_detected && a.language_detected !== a.langue && (
            <InfoRow label="Langue détectée">
              <span className="text-orange-600 text-xs">
                {a.language_detected.toUpperCase()} (diffère de la langue source)
              </span>
            </InfoRow>
          )}
          <InfoRow label="Statut">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                STATUT_STYLE[a.statut_traitement] ?? "bg-gray-100 text-gray-500"
              }`}
            >
              {STATUT_LABEL[a.statut_traitement] ?? a.statut_traitement}
            </span>
          </InfoRow>
          {a.pdf_url && <InfoRow label="Format">Fichier PDF</InfoRow>}
        </dl>
      </div>

      {/* ── Analyse par critères ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-forest-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-700">
              Analyse par critères
            </h2>
          </div>
          {criteriaValues.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full tabular-nums">
              {criteriaValues.length} valeur{criteriaValues.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {criteriaValues.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">Analyse non encore effectuée</p>
            <p className="text-xs text-gray-300 mt-0.5">
              Le worker LLM alimentera cette section.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {criteriaValues.map((v) => {
              const displayValue = parseValueText(v.value_text);
              const status = deriveCriteriaStatus(
                v.value_boolean,
                v.value_text,
                v.confidence
              );
              const copyText = `${v.criteria?.label_original ?? "—"}: ${
                displayValue ??
                (v.value_boolean !== null
                  ? v.value_boolean
                    ? "Oui"
                    : "Non"
                  : "Non mentionné")
              }`;

              return (
                <div
                  key={v.id}
                  className="rounded-xl border border-gray-100 bg-white p-4"
                >
                  {/* Section label */}
                  {v.criteria?.section_label && (
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                      {v.criteria.section_label}
                    </span>
                  )}

                  {/* Criterion label */}
                  <p className="text-sm text-gray-700 mt-0.5 leading-snug">
                    {v.criteria?.label_original}
                  </p>

                  {/* Value row */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {/* Displayed value */}
                      {displayValue ? (
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {displayValue}
                        </span>
                      ) : v.value_boolean !== null ? (
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                            v.value_boolean
                              ? "bg-forest-100 text-forest-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {v.value_boolean ? "Oui" : "Non"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Non mentionné
                        </span>
                      )}

                      {/* Status badge */}
                      {status && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CRITERIA_STATUS_STYLE[status]}`}
                        >
                          {CRITERIA_STATUS_LABEL[status]}
                        </span>
                      )}
                    </div>

                    {/* Right: confidence + copy */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {v.confidence !== null && (
                        <span className="text-[11px] text-gray-400 tabular-nums">
                          {Math.round(v.confidence * 100)}%
                        </span>
                      )}
                      <CopyButton
                        text={copyText}
                        label="Copier"
                        className="text-[11px] text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-lg transition-colors whitespace-nowrap"
                      />
                    </div>
                  </div>

                  {/* Evidence excerpt */}
                  {v.evidence_excerpt && (
                    <blockquote className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 leading-relaxed line-clamp-2">
                      {v.evidence_excerpt}
                    </blockquote>
                  )}

                  {/* Validation status */}
                  {v.validation_status && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          v.validation_status === "correct"
                            ? "bg-green-100 text-green-700"
                            : v.validation_status === "incorrect"
                            ? "bg-red-100 text-red-600"
                            : v.validation_status === "incertain"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {v.validation_status === "correct"
                          ? "Validé ✓"
                          : v.validation_status === "incorrect"
                          ? "Incorrect ✗"
                          : v.validation_status === "incertain"
                          ? "Incertain ?"
                          : v.validation_status === "absent"
                          ? "Absent"
                          : "À revoir"}
                      </span>
                      {v.validation_note && (
                        <span className="text-[10px] text-gray-400 italic truncate">
                          {v.validation_note}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
