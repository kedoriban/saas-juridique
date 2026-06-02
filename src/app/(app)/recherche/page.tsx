import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import ArretCard from "@/components/ArretCard";
import ArretTableRow from "@/components/ArretTableRow";
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">Aucun résultat</p>
        <p className="text-xs text-gray-400 mt-1">Modifiez vos critères de recherche.</p>
      </div>
    );
  }

  return (
    <>
      {/* Tableau — desktop */}
      <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <span className="text-sm text-gray-500 tabular-nums">
            {arrets.length} résultat{arrets.length !== 1 ? "s" : ""}
          </span>
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
        <p className="text-xs text-gray-400 mb-3 tabular-nums">
          {arrets.length} résultat{arrets.length !== 1 ? "s" : ""}
        </p>
        <div className="flex flex-col gap-3">
          {(arrets as Arret[]).map((a) => (
            <ArretCard key={a.id} arret={a} />
          ))}
        </div>
      </div>
    </>
  );
}

async function FiltersData() {
  const supabase = await createClient();
  const [{ data: matieresRaw }, { data: paysRaw }] = await Promise.all([
    supabase.from("arrets").select("matiere").not("matiere", "is", null).order("matiere"),
    supabase.from("arrets").select("pays_origine").not("pays_origine", "is", null).order("pays_origine"),
  ]);
  const matieres = [...new Set((matieresRaw ?? []).map((r: { matiere: string }) => r.matiere))] as string[];
  const pays = [...new Set((paysRaw ?? []).map((r: { pays_origine: string }) => r.pays_origine))] as string[];
  return <FiltresPanel matieres={matieres} pays={pays} />;
}

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Recherche avancée</h1>
        <p className="text-sm text-gray-500 mt-1">Filtrez et retrouvez les arrêts par critères.</p>
      </div>

      <Suspense fallback={<div className="h-16 bg-white rounded-2xl animate-pulse mb-5" />}>
        <FiltersData />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        }
      >
        <ResultsList sp={sp} />
      </Suspense>
    </div>
  );
}
