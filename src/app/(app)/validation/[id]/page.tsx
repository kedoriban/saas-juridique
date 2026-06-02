import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret, ArretCriteriaValue, Criterion } from "@/lib/types";
import { IconChevronLeft } from "@/components/icons";
import ValidationRow from "./ValidationRow";

type PageProps = { params: Promise<{ id: string }> };

type ValueRow = ArretCriteriaValue & {
  criteria: Pick<Criterion, "label_original" | "section_label" | "language" | "llm_group" | "expected_value_type">;
};

const CONF_STYLE = (c: number | null) => {
  if (c === null) return "text-gray-400";
  if (c >= 0.8) return "text-green-600 font-medium";
  if (c >= 0.5) return "text-yellow-600";
  return "text-red-500";
};

const STATUS_LLM_LABEL: Record<string, string> = {
  extracted: "Extrait",
  not_found: "Non trouvé",
  ambiguous: "Ambigu",
};

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
    .select("*, criteria(label_original, section_label, language, llm_group, expected_value_type)")
    .eq("arret_id", id)
    .order("created_at");

  const rows = (values ?? []) as ValueRow[];

  // Stats par critère
  const total = rows.length;
  const validated = rows.filter((r) => r.validation_status).length;
  const correct = rows.filter((r) => r.validation_status === "correct").length;
  const incorrect = rows.filter((r) => r.validation_status === "incorrect").length;
  const incertain = rows.filter((r) => r.validation_status === "incertain").length;
  const tauxErreur = validated > 0 ? ((incorrect / validated) * 100).toFixed(1) : null;

  // Stats par groupe
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

  // Groupement par section pour l'affichage
  const bySection: Record<string, ValueRow[]> = {};
  for (const r of rows) {
    const s = r.criteria?.section_label ?? "Autre";
    if (!bySection[s]) bySection[s] = [];
    bySection[s].push(r);
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl">
      {/* Header */}
      <Link
        href="/validation"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-forest-600 mb-4 transition-colors"
      >
        <IconChevronLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Arrêt {a.numero}
            <span className="ml-2 uppercase text-sm font-bold text-gray-400">{a.langue}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(a.date_arret).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
            {a.chambre && ` · ${a.chambre}`}
          </p>
        </div>
        <Link
          href={`/validation/${id}/export`}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors"
        >
          Exporter CSV
        </Link>
      </div>

      {/* Stats synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total critères" value={total} />
        <StatCard label="Révisés" value={`${validated} / ${total}`} />
        <StatCard label="Corrects" value={correct} color="text-green-600" />
        <StatCard label="Incorrects" value={incorrect} color="text-red-600" />
        <StatCard label="Taux d'erreur" value={tauxErreur !== null ? `${tauxErreur}%` : "—"} color={tauxErreur && parseFloat(tauxErreur) > 20 ? "text-red-600" : "text-gray-900"} />
      </div>

      {/* Stats par groupe */}
      {Object.keys(groupStats).length > 1 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Taux d&apos;erreur par groupe
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(groupStats).map(([g, s]) => {
              const taux = s.validated > 0 ? Math.round((s.incorrect / s.validated) * 100) : null;
              return (
                <div key={g} className="text-xs">
                  <span className="text-gray-600 block truncate">{g}</span>
                  <span className={`font-semibold ${taux !== null && taux > 20 ? "text-red-600" : "text-gray-800"}`}>
                    {taux !== null ? `${taux}%` : "—"}
                  </span>
                  <span className="text-gray-400 ml-1">({s.validated}/{s.total})</span>
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
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Desktop */}
                <table className="hidden lg:table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-400 font-medium uppercase tracking-wide text-left">
                      <th className="px-4 py-2 w-1/5">Critère</th>
                      <th className="px-4 py-2 w-1/6">Valeur LLM</th>
                      <th className="px-4 py-2 w-16">Conf.</th>
                      <th className="px-4 py-2">Extrait preuve</th>
                      <th className="px-4 py-2 w-1/3">Marquage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sRows.map((r) => (
                      <tr key={r.id} className={r.validation_status === "incorrect" ? "bg-red-50/40" : r.validation_status === "correct" ? "bg-green-50/20" : ""}>
                        <td className="px-4 py-3 align-top">
                          <span className="text-gray-800 text-xs leading-snug">{r.criteria?.label_original}</span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {r.value_boolean !== null ? (
                            <span className={r.value_boolean ? "text-green-700 font-medium" : "text-gray-500"}>
                              {r.value_boolean ? "Oui" : "Non"}
                            </span>
                          ) : r.value_text ? (
                            <span className="text-gray-800 text-xs">{r.value_text}</span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">
                              {STATUS_LLM_LABEL["not_found"] ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`text-xs ${CONF_STYLE(r.confidence)}`}>
                            {r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {r.evidence_excerpt ? (
                            <blockquote className="text-xs text-gray-600 italic border-l-2 border-gray-200 pl-2 leading-relaxed line-clamp-3">
                              {r.evidence_excerpt}
                            </blockquote>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <ValidationRow
                            valueId={r.id}
                            initialStatus={r.validation_status}
                            initialNote={r.validation_note}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile */}
                <div className="lg:hidden divide-y divide-gray-50">
                  {sRows.map((r) => (
                    <div key={r.id} className="p-4 space-y-2">
                      <p className="text-xs font-medium text-gray-800">{r.criteria?.label_original}</p>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>
                          Valeur :{" "}
                          <strong className="text-gray-800">
                            {r.value_boolean !== null
                              ? r.value_boolean ? "Oui" : "Non"
                              : r.value_text ?? "—"}
                          </strong>
                        </span>
                        <span className={CONF_STYLE(r.confidence)}>
                          Conf. {r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : "—"}
                        </span>
                      </div>
                      {r.evidence_excerpt && (
                        <blockquote className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
                          {r.evidence_excerpt}
                        </blockquote>
                      )}
                      <ValidationRow
                        valueId={r.id}
                        initialStatus={r.validation_status}
                        initialNote={r.validation_note}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Avertissement incertain */}
      {incertain > 0 && (
        <div className="mt-6 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-xs text-yellow-800">
          <strong>{incertain} critère{incertain > 1 ? "s" : ""} marqué{incertain > 1 ? "s" : ""} « Incertain »</strong> — à discuter avec l&apos;avocate avant de considérer cet arrêt comme validé.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
