import { createClient } from "@/lib/supabase/server";
import ArretCard from "@/components/ArretCard";
import ArretTableRow from "@/components/ArretTableRow";
import type { Arret } from "@/lib/types";

export default async function ArretsPage() {
  const supabase = await createClient();

  const { data: arrets, error } = await supabase
    .from("arrets")
    .select("*")
    .order("date_arret", { ascending: false })
    .limit(100);

  const count = arrets?.length ?? 0;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl">
      {/* En-tête page */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Arrêts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Accédez rapidement aux arrêts les plus pertinents.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm font-medium text-red-600">Erreur de chargement</p>
          <p className="text-xs text-red-400 mt-1">Vérifiez la connexion à Supabase.</p>
        </div>
      ) : !arrets || count === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-forest-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-forest-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">Aucun arrêt importé</p>
          <p className="text-xs text-gray-400 mt-1">Lancez le seed ou l&apos;import pour commencer.</p>
        </div>
      ) : (
        <>
          {/* Tableau — desktop */}
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                Liste d&apos;arrêts
                <span className="ml-2 text-xs font-normal text-gray-400 tabular-nums">({count})</span>
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">N° Arrêt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Résumé</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Matière</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Langue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(arrets as Arret[]).map((a) => (
                  <ArretTableRow key={a.id} arret={a} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes — mobile */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 tabular-nums">{count} arrêt{count !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-col gap-3">
              {(arrets as Arret[]).map((a) => (
                <ArretCard key={a.id} arret={a} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
