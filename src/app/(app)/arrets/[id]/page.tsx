import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret, ArretCriteriaValue, Criterion } from "@/lib/types";
import { IconChevronLeft, IconExternalLink } from "@/components/icons";
import { parseValueText, deriveLlmStatus } from "@/lib/utils";

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  erreur: "Erreur",
};
const STATUT_STYLE: Record<string, string> = {
  en_attente: "bg-gray-100 text-gray-500",
  en_cours:   "bg-yellow-100 text-yellow-700",
  termine:    "bg-forest-100 text-forest-700",
  erreur:     "bg-red-100 text-red-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

  const criteriaValues = (values ?? []) as (ArretCriteriaValue & {
    criteria: Pick<Criterion, "label_original" | "section_label" | "language">;
  })[];

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

      {/* Header arrêt — style Figma */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        {/* Titre principal */}
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
          {a.chambre ? `${a.chambre}, ` : ""}{formatDate(a.date_arret)}, n° {a.numero}
        </h1>
        {a.matiere && (
          <p className="text-sm text-gray-500 mt-1">{a.matiere}</p>
        )}

        {/* Chips métadonnées */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            {formatDate(a.date_arret)}
          </span>
          <span className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg ${
            a.langue === "fr"
              ? "bg-blue-50 text-blue-700 border border-blue-100"
              : "bg-orange-50 text-orange-700 border border-orange-100"
          }`}>
            {a.langue === "fr" ? "Français" : "Nederlands"}
          </span>
          <span className={`inline-flex items-center text-xs px-3 py-1.5 rounded-lg border font-medium ${
            STATUT_STYLE[a.statut_traitement] ?? "bg-gray-100 text-gray-500 border-gray-200"
          }`}>
            {STATUT_LABEL[a.statut_traitement] ?? a.statut_traitement}
          </span>
        </div>

        {/* Boutons actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
          {a.pdf_url && (
            <a
              href={a.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-forest-600 hover:text-forest-700 bg-forest-50 hover:bg-forest-100 border border-forest-200 px-4 py-2 rounded-xl transition-colors"
            >
              <IconExternalLink className="w-4 h-4" />
              PDF source
            </a>
          )}
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

      {/* Résumé */}
      {a.resume && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-forest-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-700">Résumé</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{a.resume}</p>
        </div>
      )}

      {/* Informations objectives */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 bg-forest-50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-700">Informations objectives</h2>
        </div>
        <dl className="divide-y divide-gray-50">
          {a.chambre && (
            <div className="flex justify-between items-center py-2.5 text-sm">
              <dt className="text-gray-500">Chambre</dt>
              <dd className="text-gray-900 font-medium text-right">{a.chambre}</dd>
            </div>
          )}
          <div className="flex justify-between items-center py-2.5 text-sm">
            <dt className="text-gray-500">Date</dt>
            <dd className="text-gray-900 font-medium">{formatDate(a.date_arret)}</dd>
          </div>
          <div className="flex justify-between items-center py-2.5 text-sm">
            <dt className="text-gray-500">Numéro</dt>
            <dd className="text-gray-900 font-medium tabular-nums">{a.numero}</dd>
          </div>
          <div className="flex justify-between items-center py-2.5 text-sm">
            <dt className="text-gray-500">Langue</dt>
            <dd className="text-gray-900 font-medium">{a.langue === "fr" ? "Français" : "Nederlands"}</dd>
          </div>
          {a.matiere && (
            <div className="flex justify-between items-center py-2.5 text-sm">
              <dt className="text-gray-500">Matière</dt>
              <dd className="text-gray-900 font-medium text-right max-w-[60%]">{a.matiere}</dd>
            </div>
          )}
          {a.pays_origine && (
            <div className="flex justify-between items-center py-2.5 text-sm">
              <dt className="text-gray-500">Pays d&apos;origine</dt>
              <dd className="text-gray-900 font-medium">{a.pays_origine}</dd>
            </div>
          )}
          {a.procedure_type && a.procedure_type !== "unknown" && (
            <div className="flex justify-between items-center py-2.5 text-sm">
              <dt className="text-gray-500">Type procédure</dt>
              <dd className="text-gray-900 font-medium text-right max-w-[60%] text-xs">
                {a.procedure_type.replace(/_/g, " ")}
              </dd>
            </div>
          )}
          {a.language_detected && a.language_detected !== a.langue && (
            <div className="flex justify-between items-center py-2.5 text-sm">
              <dt className="text-gray-500">Langue détectée</dt>
              <dd className="text-orange-600 font-medium text-xs">
                {a.language_detected.toUpperCase()} (diffère de la langue source)
              </dd>
            </div>
          )}
          <div className="flex justify-between items-center py-2.5 text-sm">
            <dt className="text-gray-500">Statut</dt>
            <dd>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUT_STYLE[a.statut_traitement] ?? "bg-gray-100 text-gray-500"}`}>
                {STATUT_LABEL[a.statut_traitement] ?? a.statut_traitement}
              </span>
            </dd>
          </div>
          {a.pdf_url && (
            <div className="flex justify-between items-center py-2.5 text-sm">
              <dt className="text-gray-500">Format</dt>
              <dd className="text-gray-900 font-medium">Fichier PDF</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Critères analysés */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-forest-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-700">Analyse par critères</h2>
          </div>
          {criteriaValues.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full tabular-nums">
              {criteriaValues.length} valeur{criteriaValues.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {criteriaValues.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Analyse non encore effectuée</p>
            <p className="text-xs text-gray-300 mt-0.5">Le worker LLM alimentera cette section.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {criteriaValues.map((v) => {
              const displayValue = parseValueText(v.value_text);
              const llmStatus = deriveLlmStatus(v.value_text, v.value_boolean, v.confidence);
              return (
                <div
                  key={v.id}
                  className={`rounded-xl border p-4 ${
                    llmStatus === "not_found"
                      ? "bg-gray-50 border-gray-100"
                      : llmStatus === "ambiguous"
                      ? "bg-yellow-50 border-yellow-100"
                      : "bg-white border-gray-100"
                  }`}
                >
                  {v.criteria?.section_label && (
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                      {v.criteria.section_label}
                    </span>
                  )}
                  <p className="text-sm text-gray-700 mt-0.5 leading-snug">
                    {v.criteria?.label_original}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    {llmStatus === "not_found" ? (
                      <span className="text-xs text-gray-400 italic">Non mentionné</span>
                    ) : displayValue ? (
                      <span className="text-sm font-semibold text-gray-900">{displayValue}</span>
                    ) : v.value_boolean !== null ? (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        v.value_boolean
                          ? "bg-forest-100 text-forest-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {v.value_boolean ? "Oui" : "Non"}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                    <div className="flex items-center gap-2">
                      {llmStatus === "ambiguous" && (
                        <span className="text-[10px] text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded font-medium">Ambigu</span>
                      )}
                      {v.confidence !== null && (
                        <span className="text-[11px] text-gray-400 tabular-nums">
                          {Math.round(v.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {v.evidence_excerpt && (
                    <blockquote className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 leading-relaxed line-clamp-2">
                      {v.evidence_excerpt}
                    </blockquote>
                  )}
                  {v.validation_status && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        v.validation_status === "correct" ? "bg-green-100 text-green-700" :
                        v.validation_status === "incorrect" ? "bg-red-100 text-red-600" :
                        v.validation_status === "incertain" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {v.validation_status === "correct" ? "Validé ✓" :
                         v.validation_status === "incorrect" ? "Incorrect ✗" :
                         v.validation_status === "incertain" ? "Incertain ?" :
                         v.validation_status === "absent" ? "Absent" : "À revoir"}
                      </span>
                      {v.validation_note && (
                        <span className="text-[10px] text-gray-400 italic truncate">{v.validation_note}</span>
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
