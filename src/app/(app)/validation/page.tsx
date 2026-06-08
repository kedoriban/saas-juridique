import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret } from "@/lib/types";

// Procédures considérées comme "asile / protection"
const ASYLUM_PROCEDURE_TYPES = new Set([
  "protection_internationale_fond",
  "unknown",
]);

function procedureLabel(pt: string | null): { label: string; classes: string } | null {
  switch (pt) {
    case "protection_internationale_fond":
      return { label: "Asile", classes: "bg-green-50 text-green-700" };
    case "dublin_transfert":
      return { label: "Dublin", classes: "bg-purple-50 text-purple-700" };
    case "oqt_extreme_urgence":
      return { label: "OQT", classes: "bg-orange-50 text-orange-700" };
    case "sejour_visa_regroupement":
      return { label: "Séjour", classes: "bg-gray-100 text-gray-500" };
    case "unknown":
    case null:
    default:
      return null;
  }
}

function ProgressBar({ validated, total }: { validated: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">En attente LLM</span>;
  const pct = Math.round((validated / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[80px]">
        <div
          className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-forest-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap tabular-nums">{validated}/{total}</span>
    </div>
  );
}

function StatPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${color}`}>
      {count} {label}
    </span>
  );
}

type ArretWithStats = Arret & {
  total: number;
  validated: number;
  correct: number;
  incorrect: number;
  incertain: number;
};

type PageProps = { searchParams: Promise<Record<string, string>> };

export default async function ValidationPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  // "asile" par défaut — filtre sur les arrêts protection/unknown
  const filtre: "asile" | "tous" = sp.proc === "tous" ? "tous" : "asile";

  const supabase = await createClient();

  const { data: arrets } = await supabase
    .from("arrets")
    .select("*")
    .eq("statut_traitement", "termine")
    .order("date_arret", { ascending: false });

  const arretList = (arrets ?? []) as Arret[];

  if (arretList.length === 0) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-5xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Validation juridique</h1>
        <BlockageBanner />
        <p className="mt-8 text-sm text-gray-500 text-center">
          Aucun arrêt traité. Lancez le worker d&apos;analyse LLM avant de valider.
        </p>
      </div>
    );
  }

  const arretIds = arretList.map((a) => a.id);

  const { data: values } = await supabase
    .from("arret_criteria_values")
    .select("arret_id, validation_status")
    .in("arret_id", arretIds);

  const statsMap: Record<string, { total: number; validated: number; correct: number; incorrect: number; incertain: number }> = {};
  for (const v of values ?? []) {
    if (!statsMap[v.arret_id]) {
      statsMap[v.arret_id] = { total: 0, validated: 0, correct: 0, incorrect: 0, incertain: 0 };
    }
    statsMap[v.arret_id].total++;
    if (v.validation_status) {
      statsMap[v.arret_id].validated++;
      if (v.validation_status === "correct") statsMap[v.arret_id].correct++;
      if (v.validation_status === "incorrect") statsMap[v.arret_id].incorrect++;
      if (v.validation_status === "incertain") statsMap[v.arret_id].incertain++;
    }
  }

  const allWithStats: ArretWithStats[] = arretList.map((a) => ({
    ...a,
    ...(statsMap[a.id] ?? { total: 0, validated: 0, correct: 0, incorrect: 0, incertain: 0 }),
  }));

  const asileCount = allWithStats.filter((a) => ASYLUM_PROCEDURE_TYPES.has(a.procedure_type ?? "unknown")).length;

  const arretsWithStats = (filtre === "asile"
    ? allWithStats.filter((a) => ASYLUM_PROCEDURE_TYPES.has(a.procedure_type ?? "unknown"))
    : allWithStats
  ).filter((a) => a.total > 0);

  // Stats globales sur la sélection affichée
  const totalGlobal = arretsWithStats.reduce((s, a) => s + a.total, 0);
  const validatedGlobal = arretsWithStats.reduce((s, a) => s + a.validated, 0);
  const incorrectGlobal = arretsWithStats.reduce((s, a) => s + a.incorrect, 0);
  const tauxErreur = validatedGlobal > 0 ? Math.round((incorrectGlobal / validatedGlobal) * 100) : null;
  const arretsComplets = arretsWithStats.filter((a) => a.total > 0 && a.validated === a.total).length;
  const nonAnalyses = arretsWithStats.filter((a) => a.total === 0).length;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Validation juridique</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {arretsWithStats.length} arrêt{arretsWithStats.length > 1 ? "s" : ""}
            · {validatedGlobal}/{totalGlobal} critères révisés
            · {arretsComplets} terminé{arretsComplets > 1 ? "s" : ""}
            {tauxErreur !== null && (
              <span className={`ml-2 font-medium ${tauxErreur > 20 ? "text-red-600" : "text-green-600"}`}>
                · {tauxErreur}% incorrects
              </span>
            )}
          </p>
        </div>
        <Link
          href="/validation/export"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors"
        >
          Exporter audit complet ↓
        </Link>
      </div>

      <BlockageBanner />

      {/* Tabs filtre procédure */}
      <div className="mt-4 flex gap-2">
        <Link
          href="/validation?proc=asile"
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filtre === "asile"
              ? "bg-forest-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Asile / protection
          <span className="ml-1.5 text-[11px] opacity-75">({asileCount})</span>
        </Link>
        <Link
          href="/validation?proc=tous"
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filtre === "tous"
              ? "bg-forest-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Tous les arrêts
          <span className="ml-1.5 text-[11px] opacity-75">({allWithStats.length})</span>
        </Link>
      </div>

      {/* Avertissement arrêts non encore analysés */}
      {nonAnalyses > 0 && (
        <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-800">
          <strong>{nonAnalyses} arrêt{nonAnalyses > 1 ? "s" : ""}</strong> pas encore analysé{nonAnalyses > 1 ? "s" : ""} par le LLM
          — lancez <code className="font-mono bg-blue-100 px-1 rounded">analyze.py --limit 23</code> sur le GPU.
        </div>
      )}

      {/* Tableau desktop */}
      <div className="mt-4 hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">
              <th className="px-4 py-3">N° Arrêt</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Langue</th>
              <th className="px-4 py-3">Procédure</th>
              <th className="px-4 py-3 min-w-[160px]">Progression</th>
              <th className="px-4 py-3">Résultats</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {arretsWithStats.map((a) => {
              const done = a.total > 0 && a.validated === a.total;
              const notAnalyzed = a.total === 0;
              const proc = procedureLabel(a.procedure_type);
              return (
                <tr key={a.id} className={`hover:bg-gray-50 transition-colors ${done ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{a.numero}</td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {new Date(a.date_arret).toLocaleDateString("fr-BE")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      a.langue === "fr" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                    }`}>
                      {a.langue.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {proc ? (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${proc.classes}`}>
                        {proc.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar validated={a.validated} total={a.total} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatPill count={a.correct} label="OK" color="bg-green-50 text-green-700" />
                      <StatPill count={a.incorrect} label="KO" color="bg-red-50 text-red-600" />
                      <StatPill count={a.incertain} label="?" color="bg-yellow-50 text-yellow-700" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {notAnalyzed ? (
                      <span className="text-xs text-gray-300">En attente</span>
                    ) : done ? (
                      <span className="text-xs text-green-600 font-medium">✓ Terminé</span>
                    ) : (
                      <Link
                        href={`/validation/${a.id}`}
                        className="text-forest-600 hover:text-forest-700 font-medium text-xs"
                      >
                        {a.validated > 0 ? "Continuer →" : "Réviser →"}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cartes mobile */}
      <div className="mt-4 lg:hidden space-y-3">
        {arretsWithStats.map((a) => {
          const done = a.total > 0 && a.validated === a.total;
          const notAnalyzed = a.total === 0;
          const proc = procedureLabel(a.procedure_type);
          return (
            <Link
              key={a.id}
              href={notAnalyzed ? "#" : `/validation/${a.id}`}
              className={`block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${done ? "opacity-60" : ""} ${notAnalyzed ? "pointer-events-none" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{a.numero}</span>
                <div className="flex items-center gap-2">
                  {proc && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${proc.classes}`}>
                      {proc.label}
                    </span>
                  )}
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    a.langue === "fr" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                  }`}>
                    {a.langue.toUpperCase()}
                  </span>
                  {done && <span className="text-xs text-green-600 font-medium">✓</span>}
                </div>
              </div>
              <ProgressBar validated={a.validated} total={a.total} />
              <div className="flex gap-1 mt-2 flex-wrap">
                <StatPill count={a.correct} label="OK" color="bg-green-50 text-green-700" />
                <StatPill count={a.incorrect} label="KO" color="bg-red-50 text-red-600" />
                <StatPill count={a.incertain} label="?" color="bg-yellow-50 text-yellow-700" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BlockageBanner() {
  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 items-start">
      <span className="text-lg leading-none mt-0.5 shrink-0">⚠️</span>
      <div>
        <p className="font-semibold text-amber-800 text-sm">
          Traitement massif bloqué — validation juridique requise
        </p>
        <p className="text-amber-700 text-xs mt-0.5">
          Validez la qualité des extractions sur cet échantillon avant tout traitement au-delà de 100 arrêts.
          Objectif : 80 % de critères révisés sur au moins 5 arrêts.
        </p>
      </div>
    </div>
  );
}
