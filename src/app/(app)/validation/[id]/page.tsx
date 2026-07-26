import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret, ArretCriteriaValue, Criterion } from "@/lib/types";
import { IconChevronLeft, IconExternalLink } from "@/components/icons";
import { parseValueText, deriveLlmStatus } from "@/lib/utils";
import ValidationRow from "./ValidationRow";

type PageProps = { params: Promise<{ id: string }> };

type ValueRow = ArretCriteriaValue & {
  criteria: Pick<Criterion, "label_original" | "section_label" | "language" | "llm_group" | "expected_value_type" | "order_index">;
};

const LLM_STATUS_BADGE: Record<string, string> = {
  found:     "bg-forest-50 text-forest-700 border border-forest-200",
  ambiguous: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  not_found: "bg-gray-100 text-gray-400 border border-gray-200",
};
const LLM_STATUS_LABEL: Record<string, string> = {
  found:     "Extrait",
  ambiguous: "Ambigu",
  not_found: "Non trouvé",
};

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default async function ValidationDetailPage({ params }: PageProps) {
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
    .select("*, criteria(label_original, section_label, language, llm_group, expected_value_type, order_index)")
    .eq("arret_id", id)
    .order("created_at");

  const rows = ((values ?? []) as ValueRow[])
    .sort((a, b) => (a.criteria?.order_index ?? 9999) - (b.criteria?.order_index ?? 9999));

  // Stats globales
  const total = rows.length;
  const validated = rows.filter((r) => r.validation_status).length;
  const correct = rows.filter((r) => r.validation_status === "correct").length;
  const incorrect = rows.filter((r) => r.validation_status === "incorrect").length;
  const incertain = rows.filter((r) => r.validation_status === "incertain").length;
  const remaining = total - validated;
  const tauxErreur = validated > 0 ? ((incorrect / validated) * 100).toFixed(1) : null;

  // Stats par groupe LLM
  const groupStats: Record<string, { total: number; incorrect: number; validated: number }> = {};
  for (const r of rows) {
    const g = r.criteria?.llm_group ?? "autre";
    if (!groupStats[g]) groupStats[g] = { total: 0, incorrect: 0, validated: 0 };
    groupStats[g].total++;
    if (r.validation_status) {
      groupStats[g].validated++;
      if (r.validation_status === "incorrect") groupStats[g].incorrect++;
    }
  }

  // Groupement par section
  const bySection: Record<string, ValueRow[]> = {};
  for (const r of rows) {
    const s = r.criteria?.section_label ?? "Autre";
    if (!bySection[s]) bySection[s] = [];
    bySection[s].push(r);
  }

  const dateStr = new Date(a.date_arret).toLocaleDateString("fr-BE", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl">
      {/* Navigation */}
      <Link
        href="/validation"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-forest-600 mb-4 transition-colors"
      >
        <IconChevronLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      {/* En-tête arrêt */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Arrêt {a.numero}
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-md align-middle ${
                a.langue === "fr" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
              }`}>
                {a.langue === "fr" ? "FR" : "NL"}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {dateStr}
              {a.chambre && <span className="mx-1 text-gray-300">·</span>}
              {a.chambre && <span>{a.chambre}</span>}
              {a.matiere && <span className="mx-1 text-gray-300">·</span>}
              {a.matiere && <span className="text-gray-400">{a.matiere}</span>}
            </p>
            {a.procedure_type && a.procedure_type !== "unknown" && (
              <span className="mt-1 inline-block text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium uppercase tracking-wide">
                {a.procedure_type.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {a.pdf_url && (
              <a
                href={a.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 text-forest-600 bg-forest-50 border border-forest-200 rounded-lg hover:bg-forest-100 transition-colors"
              >
                <IconExternalLink className="w-3.5 h-3.5" />
                PDF source
              </a>
            )}
            <Link
              href={`/validation/${id}/export`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors"
            >
              Exporter CSV
            </Link>
          </div>
        </div>
      </div>

      {/* Stats synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Total critères" value={total} />
        <StatCard label="Révisés" value={`${validated}/${total}`} />
        <StatCard label="Restant" value={remaining} color={remaining > 0 ? "text-blue-600" : "text-gray-400"} />
        <StatCard label="Corrects" value={correct} color="text-green-600" />
        <StatCard label="Incorrects" value={incorrect} color={incorrect > 0 ? "text-red-600" : "text-gray-400"} />
      </div>

      {/* Taux d'erreur */}
      {tauxErreur !== null && (
        <div className={`mb-5 rounded-lg px-4 py-3 text-sm font-medium ${
          parseFloat(tauxErreur) > 20
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          Taux d&apos;erreur global : <strong>{tauxErreur}%</strong>
          {parseFloat(tauxErreur) > 20 && (
            <span className="ml-2 text-xs font-normal">— révision du pipeline recommandée</span>
          )}
        </div>
      )}

      {/* Stats par groupe */}
      {Object.keys(groupStats).length > 1 && (
        <div className="mb-5 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Taux d&apos;erreur par groupe LLM
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(groupStats).map(([g, s]) => {
              const taux = s.validated > 0 ? Math.round((s.incorrect / s.validated) * 100) : null;
              return (
                <div key={g} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-600 block truncate font-medium">{g}</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`font-bold text-sm ${taux !== null && taux > 20 ? "text-red-600" : "text-gray-800"}`}>
                      {taux !== null ? `${taux}%` : "—"}
                    </span>
                    <span className="text-gray-400">({s.validated}/{s.total})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          Aucune valeur LLM pour cet arrêt. Lancez <code className="font-mono bg-gray-100 px-1 rounded">analyze.py</code>.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(bySection).map(([section, sRows]) => (
            <div key={section}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {section}
              </h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-200">
                {sRows.map((r) => {
                  const displayValue = parseValueText(r.value_text);
                  const llmStatus = deriveLlmStatus(r.value_text, r.value_boolean, r.confidence);
                  return (
                    <div
                      key={r.id}
                      className={`p-4 ${
                        r.validation_status === "incorrect" ? "bg-red-50/40" :
                        r.validation_status === "correct" ? "bg-green-50/20" : ""
                      }`}
                    >
                      {/* Ligne principale : critère + badge LLM + valeur */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium leading-snug">
                            {r.criteria?.label_original}
                          </p>
                          {r.criteria?.llm_group && (
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                              {r.criteria.llm_group}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Badge statut LLM */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${LLM_STATUS_BADGE[llmStatus]}`}>
                            {LLM_STATUS_LABEL[llmStatus]}
                          </span>
                          {/* Confiance */}
                          {r.confidence !== null && (
                            <span className={`text-xs tabular-nums font-medium ${
                              r.confidence >= 0.8 ? "text-green-600" :
                              r.confidence >= 0.5 ? "text-yellow-600" : "text-red-500"
                            }`}>
                              {Math.round(r.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Valeur extraite */}
                      {llmStatus !== "not_found" && (
                        <div className="mb-3">
                          {displayValue ? (
                            <span className="inline-block text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                              {displayValue}
                            </span>
                          ) : r.value_boolean !== null ? (
                            <span className={`inline-block text-sm font-bold px-3 py-1 rounded-lg ${
                              r.value_boolean
                                ? "bg-forest-100 text-forest-700"
                                : "bg-red-50 text-red-600"
                            }`}>
                              {r.value_boolean ? "Oui" : "Non"}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Passage source (evidence_excerpt) */}
                      {r.evidence_excerpt && (
                        <blockquote className="mb-3 text-xs text-gray-600 italic bg-gray-50 border-l-3 border-l-2 border-forest-300 pl-3 pr-2 py-2 rounded-r-lg leading-relaxed">
                          {r.evidence_excerpt}
                        </blockquote>
                      )}

                      {/* Zone de validation */}
                      <ValidationRow
                        valueId={r.id}
                        arretId={id}
                        initialStatus={r.validation_status}
                        initialNote={r.validation_note}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Avertissement incertain */}
      {incertain > 0 && (
        <div className="mt-6 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-xs text-yellow-800">
          <strong>{incertain} critère{incertain > 1 ? "s" : ""} marqué{incertain > 1 ? "s" : ""} « Incertain »</strong>
          {" "}— à discuter avec l&apos;avocate avant de finaliser la validation de cet arrêt.
        </div>
      )}
    </div>
  );
}
