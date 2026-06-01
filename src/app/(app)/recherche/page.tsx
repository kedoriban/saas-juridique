import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import ArretCard from "@/components/ArretCard";
import FiltresPanel from "./FiltresPanel";
import type { Arret } from "@/lib/types";

type SearchParams = Promise<{
  q?: string;
  langue?: string;
  matiere?: string;
  pays?: string;
  statut?: string;
}>;

async function ResultsList({ sp }: { sp: Awaited<SearchParams> }) {
  const supabase = await createClient();

  let query = supabase
    .from("arrets")
    .select("*")
    .order("date_arret", { ascending: false })
    .limit(200);

  if (sp.langue) query = query.eq("langue", sp.langue);
  if (sp.matiere) query = query.eq("matiere", sp.matiere);
  if (sp.pays) query = query.eq("pays_origine", sp.pays);
  if (sp.statut) query = query.eq("statut_traitement", sp.statut);
  if (sp.q) {
    query = query.or(
      `numero.ilike.%${sp.q}%,pays_origine.ilike.%${sp.q}%,resume.ilike.%${sp.q}%`
    );
  }

  const { data: arrets } = await query;

  if (!arrets || arrets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Aucun arrêt ne correspond aux critères sélectionnés.
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-gray-400 mb-3">
        {arrets.length} résultat{arrets.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-3">
        {(arrets as Arret[]).map((a) => (
          <ArretCard key={a.id} arret={a} />
        ))}
      </div>
    </>
  );
}

async function FiltersData() {
  const supabase = await createClient();

  const [{ data: matieresRaw }, { data: paysRaw }] = await Promise.all([
    supabase
      .from("arrets")
      .select("matiere")
      .not("matiere", "is", null)
      .order("matiere"),
    supabase
      .from("arrets")
      .select("pays_origine")
      .not("pays_origine", "is", null)
      .order("pays_origine"),
  ]);

  const matieres = [
    ...new Set((matieresRaw ?? []).map((r: { matiere: string }) => r.matiere)),
  ] as string[];
  const pays = [
    ...new Set(
      (paysRaw ?? []).map((r: { pays_origine: string }) => r.pays_origine)
    ),
  ] as string[];

  return <FiltresPanel matieres={matieres} pays={pays} />;
}

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        Recherche avancée
      </h1>

      <Suspense
        fallback={
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse mb-4" />
        }
      >
        <FiltersData />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        }
      >
        <ResultsList sp={sp} />
      </Suspense>
    </div>
  );
}
