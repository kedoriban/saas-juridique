import { createClient } from "@/lib/supabase/server";
import type { Criterion } from "@/lib/types";
import CriteriaTable from "./CriteriaTable";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export default async function CriteresPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  const language: "fr" | "nl" = lang === "nl" ? "nl" : "fr";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const isAdmin = profile?.role === "admin";

  const { data: criteria, error } = await supabase
    .from("criteria")
    .select("*")
    .eq("language", language)
    .order("order_index", { ascending: true });

  const allCriteria = (criteria as Criterion[]) ?? [];
  const total = allCriteria.length;
  const activeCount = allCriteria.filter((c) => (c.statut ?? "actif") === "actif").length;

  // Count for the other language tab
  const { count: otherCount } = await supabase
    .from("criteria")
    .select("*", { count: "exact", head: true })
    .eq("language", language === "fr" ? "nl" : "fr");

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">
          Gestion des critères d&apos;analyse
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {activeCount} actif{activeCount !== 1 ? "s" : ""} sur {total} critères
          {isAdmin && (
            <span className="ml-2 text-xs text-forest-600 font-medium">
              — mode admin
            </span>
          )}
        </p>
      </div>

      {/* Banner Important */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
        <span className="text-amber-500 text-base leading-none mt-0.5 shrink-0">⚠</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Important</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Les modifications apportées aux critères s&apos;appliquent uniquement aux
            analyses futures. Les arrêts déjà analysés ne sont pas retraités
            automatiquement.
          </p>
        </div>
      </div>

      {/* Onglets langue */}
      <div className="flex gap-2 mb-5">
        <Link
          href="/criteres?lang=fr"
          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            language === "fr"
              ? "border-forest-300 bg-forest-50 text-forest-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Français {language === "fr" ? `(${total})` : `(${otherCount ?? "…"})`}
        </Link>
        <Link
          href="/criteres?lang=nl"
          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            language === "nl"
              ? "border-forest-300 bg-forest-50 text-forest-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Nederlands {language === "nl" ? `(${total})` : `(${otherCount ?? "…"})`}
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
          Erreur de chargement : {error.message}
        </div>
      )}

      {/* Empty state */}
      {!error && total === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          Aucun critère trouvé.
          <br />
          <span className="text-xs text-gray-300 mt-1 block">
            Lancez l&apos;import :{" "}
            <code className="font-mono">node scripts/import-criteria.mjs</code>
          </span>
        </div>
      )}

      {/* Table */}
      {!error && total > 0 && (
        <CriteriaTable
          criteria={allCriteria}
          isAdmin={isAdmin}
          language={language}
        />
      )}
    </div>
  );
}
