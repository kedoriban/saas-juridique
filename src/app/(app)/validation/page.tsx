import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret } from "@/lib/types";

function StatPill({
  count,
  total,
  label,
  color,
}: {
  count: number;
  total: number;
  label: string;
  color: string;
}) {
  if (total === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {count} {label}
    </span>
  );
}

function ProgressBar({ validated, total }: { validated: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">Aucune valeur LLM</span>;
  const pct = Math.round((validated / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-forest-600 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{validated}/{total}</span>
    </div>
  );
}

type ArretWithStats = Arret & {
  total: number;
  validated: number;
  correct: number;
  incorrect: number;
  incertain: number;
};

export default async function ValidationPage() {
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

  const arretsWithStats: ArretWithStats[] = arretList.map((a) => ({
    ...a,
    ...(statsMap[a.id] ?? { total: 0, validated: 0, correct: 0, incorrect: 0, incertain: 0 }),
  }));

  const totalGlobal = arretsWithStats.reduce((s, a) => s + a.total, 0);
  const validatedGlobal = arretsWithStats.reduce((s, a) => s + a.validated, 0);
  const erreurGlobal = arretsWithStats.reduce((s, a) => s + a.incorrect, 0);
  const tauxErreur = validatedGlobal > 0 ? Math.round((erreurGlobal / validatedGlobal) * 100) : null;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl">
      <BlockageBanner />

      <div className="mt-6 mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Validation juridique</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {arretList.length} arrêt{arretList.length > 1 ? "s" : ""} traités · {validatedGlobal}/{totalGlobal} valeurs révisées
            {tauxErreur !== null && (
              <span className="ml-2 text-red-600 font-medium">· {tauxErreur}% incorrectes</span>
            )}
          </p>
        </div>
      </div>

      {/* Tableau desktop / cartes mobile */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">
              <th className="px-4 py-3">N° Arrêt</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Langue</th>
              <th className="px-4 py-3">Progression</th>
              <th className="px-4 py-3">Statuts</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {arretsWithStats.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{a.numero}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(a.date_arret).toLocaleDateString("fr-BE")}
                </td>
                <td className="px-4 py-3">
                  <span className="uppercase text-xs font-semibold text-gray-600">{a.langue}</span>
                </td>
                <td className="px-4 py-3 min-w-[140px]">
                  <ProgressBar validated={a.validated} total={a.total} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <StatPill count={a.correct} total={a.validated} label="OK" color="bg-green-50 text-green-700" />
                    <StatPill count={a.incorrect} total={a.validated} label="KO" color="bg-red-50 text-red-600" />
                    <StatPill count={a.incertain} total={a.validated} label="?" color="bg-yellow-50 text-yellow-700" />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/validation/${a.id}`}
                    className="text-forest-600 hover:text-forest-700 font-medium text-xs"
                  >
                    Réviser →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes mobile */}
      <div className="lg:hidden space-y-3">
        {arretsWithStats.map((a) => (
          <Link
            key={a.id}
            href={`/validation/${a.id}`}
            className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">{a.numero}</span>
              <span className="uppercase text-xs font-bold text-gray-400">{a.langue}</span>
            </div>
            <ProgressBar validated={a.validated} total={a.total} />
            <div className="flex gap-1 mt-2 flex-wrap">
              <StatPill count={a.correct} total={a.validated} label="OK" color="bg-green-50 text-green-700" />
              <StatPill count={a.incorrect} total={a.validated} label="KO" color="bg-red-50 text-red-600" />
              <StatPill count={a.incertain} total={a.validated} label="?" color="bg-yellow-50 text-yellow-700" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BlockageBanner() {
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 flex gap-3 items-start">
      <span className="text-xl leading-none mt-0.5">🚫</span>
      <div>
        <p className="font-semibold text-red-700 text-sm">
          Traitement massif bloqué — validation juridique requise
        </p>
        <p className="text-red-600 text-xs mt-0.5">
          Ne lancez pas de batch sur plus de 100 arrêts avant d&apos;avoir validé la qualité des extractions
          sur un échantillon représentatif. Marquez au moins 80 % des critères sur 5 arrêts minimum.
        </p>
      </div>
    </div>
  );
}
