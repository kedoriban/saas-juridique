import { createClient } from "@/lib/supabase/server";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function StatsPage() {
  const supabase = await createClient();

  const [{ count: total }, { data: parLangue }, { data: parStatut }, { data: parMatiere }] =
    await Promise.all([
      supabase.from("arrets").select("*", { count: "exact", head: true }),
      supabase
        .from("arrets")
        .select("langue")
        .order("langue"),
      supabase
        .from("arrets")
        .select("statut_traitement")
        .order("statut_traitement"),
      supabase
        .from("arrets")
        .select("matiere")
        .not("matiere", "is", null)
        .order("matiere"),
    ]);

  function countBy<T>(arr: T[], key: keyof T) {
    const map: Record<string, number> = {};
    for (const item of arr) {
      const k = String(item[key]);
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  const langueStats = countBy(parLangue ?? [], "langue");
  const statutStats = countBy(parStatut ?? [], "statut_traitement");
  const matiereStats = countBy(parMatiere ?? [], "matiere").slice(0, 5);

  const frCount = langueStats.find(([k]) => k === "fr")?.[1] ?? 0;
  const nlCount = langueStats.find(([k]) => k === "nl")?.[1] ?? 0;

  const STATUT_LABEL: Record<string, string> = {
    en_attente: "En attente",
    en_cours: "En cours",
    termine: "Terminé",
    erreur: "Erreur",
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Statistiques</h1>

      {!total || total === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          Aucune donnée disponible.
          <br />
          <span className="text-xs text-gray-300 mt-1 block">
            Lancez le seed pour voir les statistiques.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Vue générale */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value={total} />
            <StatCard label="FR" value={frCount} />
            <StatCard label="NL" value={nlCount} />
          </div>

          {/* Par statut de traitement */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Traitement
            </h2>
            <div className="space-y-2">
              {statutStats.map(([statut, count]) => (
                <div key={statut} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">
                        {STATUT_LABEL[statut] ?? statut}
                      </span>
                      <span className="text-gray-400 font-medium">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full"
                        style={{ width: `${((count / (total ?? 1)) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top matières */}
          {matiereStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Matières (top {matiereStats.length})
              </h2>
              <div className="space-y-2">
                {matiereStats.map(([matiere, count]) => (
                  <div key={matiere} className="flex justify-between text-sm">
                    <span className="text-gray-700">{matiere}</span>
                    <span className="text-gray-400 font-medium">{count}</span>
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
