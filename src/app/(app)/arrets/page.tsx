import { createClient } from "@/lib/supabase/server";
import ArretCard from "@/components/ArretCard";
import type { Arret } from "@/lib/types";

export default async function ArretsPage() {
  const supabase = await createClient();

  const { data: arrets, error } = await supabase
    .from("arrets")
    .select("*")
    .order("date_arret", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">Arrêts</h1>
        <p className="mt-4 text-sm text-red-500">
          Erreur lors du chargement des arrêts.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Arrêts</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          {arrets?.length ?? 0} résultat{(arrets?.length ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>

      {!arrets || arrets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          Aucun arrêt importé pour le moment.
          <br />
          <span className="text-xs text-gray-300 mt-1 block">
            Lancez le seed ou l&apos;import pour commencer.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(arrets as Arret[]).map((a) => (
            <ArretCard key={a.id} arret={a} />
          ))}
        </div>
      )}
    </div>
  );
}
