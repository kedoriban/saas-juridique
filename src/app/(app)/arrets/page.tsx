import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import ArretCard from "@/components/ArretCard";
import ArretTableRow from "@/components/ArretTableRow";
import ArretFilters from "./ArretFilters";
import ArretPagination from "./ArretPagination";
import type { Arret } from "@/lib/types";

const PER_PAGE_OPTIONS = [10, 25, 50];

const TABLE_HEADERS = [
  "N° Arrêt",
  "Résumé",
  "Procédure",
  "Source",
  "Date",
  "Langue",
  "",
];

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function ArretsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const lang = sp.lang ?? "";
  const dateFrom = sp.date_from ?? "";
  const dateTo = sp.date_to ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const perPage = PER_PAGE_OPTIONS.includes(parseInt(sp.per_page ?? "10", 10))
    ? parseInt(sp.per_page ?? "10", 10)
    : 10;

  // Advanced filters — direct arrets columns
  const numero = sp.numero?.trim() ?? "";
  const chambre = sp.chambre?.trim() ?? "";
  const nationalite = sp.nationalite?.trim() ?? "";
  const typeDec = sp.type_dec ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("arrets")
    .select("*", { count: "exact" })
    .order("date_arret", { ascending: false });

  if (q) query = query.or(`numero.ilike.%${q}%,resume.ilike.%${q}%`);
  if (lang) query = query.eq("langue", lang);
  if (dateFrom) query = query.gte("date_arret", dateFrom);
  if (dateTo) query = query.lte("date_arret", dateTo);
  if (numero) query = query.ilike("numero", `%${numero}%`);
  if (chambre) query = query.ilike("chambre", `%${chambre}%`);
  if (nationalite) query = query.ilike("pays_origine", `%${nationalite}%`);
  if (typeDec) query = query.eq("type_decision", typeDec);

  const { data: arrets, count, error } = await query.range(
    (page - 1) * perPage,
    page * perPage - 1
  );

  const total = count ?? 0;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Arrêts
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Recherchez et filtrez les arrêts CCE / RVV.
        </p>
      </div>

      {/* Filters — needs Suspense for useSearchParams() */}
      <Suspense fallback={<div className="h-20 animate-pulse bg-gray-100 rounded-xl mb-5" />}>
        <ArretFilters total={total} />
      </Suspense>

      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm font-medium text-red-600">
            Erreur de chargement
          </p>
          <p className="text-xs text-red-400 mt-1">
            Vérifiez la connexion à Supabase.
          </p>
        </div>
      ) : !arrets || arrets.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-600">
            Aucun arrêt trouvé
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Modifiez les filtres ou réinitialisez la recherche.
          </p>
        </div>
      ) : (
        <>
          {/* Tableau — desktop */}
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {TABLE_HEADERS.map((h, i) => (
                      <th
                        key={i}
                        className={`text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${
                          i === 0 ? "pl-6" : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(arrets as Arret[]).map((a) => (
                    <ArretTableRow key={a.id} arret={a} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cartes — mobile */}
          <div className="lg:hidden flex flex-col gap-3">
            {(arrets as Arret[]).map((a) => (
              <ArretCard key={a.id} arret={a} />
            ))}
          </div>

          {/* Pagination */}
          <Suspense>
            <ArretPagination page={page} perPage={perPage} total={total} />
          </Suspense>
        </>
      )}
    </div>
  );
}
