import { createClient } from "@/lib/supabase/server";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = "bg-forest-600" }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-1.5 h-1.5 rounded-full ${color} mb-3`} />
      <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-1.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours:   "En cours",
  termine:    "Terminé",
  erreur:     "Erreur",
};
const STATUT_BAR: Record<string, string> = {
  en_attente: "bg-gray-300",
  en_cours:   "bg-yellow-400",
  termine:    "bg-forest-500",
  erreur:     "bg-red-400",
};

export default async function StatsPage() {
  const supabase = await createClient();

  const [
    { count: total },
    { data: parLangue },
    { data: parStatut },
    { data: parMatiere },
  ] = await Promise.all([
    supabase.from("arrets").select("*", { count: "exact", head: true }),
    supabase.from("arrets").select("langue").order("langue"),
    supabase.from("arrets").select("statut_traitement").order("statut_traitement"),
    supabase.from("arrets").select("matiere").not("matiere", "is", null).order("matiere"),
  ]);

  function countBy<T>(arr: T[], key: keyof T) {
    const map: Record<string, number> = {};
    for (const item of arr) {
      const k = String(item[key]);
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  const langueStats  = countBy(parLangue  ?? [], "langue");
  const statutStats  = countBy(parStatut  ?? [], "statut_traitement");
  const matiereStats = countBy(parMatiere ?? [], "matiere").slice(0, 5);

  const frCount      = langueStats.find(([k]) => k === "fr")?.[1] ?? 0;
  const nlCount      = langueStats.find(([k]) => k === "nl")?.[1] ?? 0;
  const termineCount = statutStats.find(([k]) => k === "termine")?.[1] ?? 0;
  const analyseRate  = total ? Math.round((termineCount / total) * 100) : 0;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Statistiques</h1>
        <p className="text-sm text-gray-500 mt-1">Vue d&apos;ensemble de la base d&apos;arrêts.</p>
      </div>

      {!total || total === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 text-center">
          <div className="w-12 h-12 bg-forest-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-forest-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">Aucune donnée disponible</p>
          <p className="text-xs text-gray-400 mt-1">Lancez le seed pour voir les statistiques.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stat cards principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total arrêts"    value={total}           sub="dans la base"        color="bg-forest-600" />
            <StatCard label="Analysés"         value={`${analyseRate}%`} sub={`${termineCount} terminés`} color="bg-forest-400" />
            <StatCard label="En français"      value={frCount}         sub={`${total ? Math.round((frCount/total)*100) : 0}% du total`} color="bg-blue-400" />
            <StatCard label="En néerlandais"   value={nlCount}         sub={`${total ? Math.round((nlCount/total)*100) : 0}% du total`} color="bg-orange-400" />
          </div>

          {/* Barre langues */}
          {frCount + nlCount > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Répartition linguistique</h2>
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
                {frCount > 0 && (
                  <div className="bg-blue-500 rounded-full" style={{ width: `${((frCount/total!)*100).toFixed(1)}%` }} />
                )}
                {nlCount > 0 && (
                  <div className="bg-orange-400 rounded-full" style={{ width: `${((nlCount/total!)*100).toFixed(1)}%` }} />
                )}
              </div>
              <div className="flex gap-5">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  Français — <span className="font-semibold text-gray-900">{frCount}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
                  Nederlands — <span className="font-semibold text-gray-900">{nlCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Statuts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">État du traitement</h2>
            <div className="space-y-3">
              {statutStats.map(([statut, count]) => (
                <div key={statut}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">{STATUT_LABEL[statut] ?? statut}</span>
                    <span className="text-gray-400 tabular-nums">{count} <span className="text-gray-300">/ {total}</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUT_BAR[statut] ?? "bg-gray-300"}`}
                      style={{ width: `${((count/(total??1))*100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top matières */}
          {matiereStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Top matières
              </h2>
              <div className="space-y-3">
                {matiereStats.map(([matiere, count], i) => (
                  <div key={matiere} className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 font-bold w-4 tabular-nums text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 truncate pr-3">{matiere}</span>
                        <span className="text-gray-400 shrink-0 tabular-nums">{count}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forest-400 rounded-full"
                          style={{ width: `${((count/(matiereStats[0]?.[1]??1))*100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
