import { createClient } from "@/lib/supabase/server";
import type { Criterion } from "@/lib/types";
import CriterionToggle from "./CriterionToggle";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export default async function CriteresPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  const language: "fr" | "nl" = lang === "nl" ? "nl" : "fr";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const isAdmin = profile?.role === "admin";

  const { data: criteria, error } = await supabase
    .from("criteria")
    .select("*")
    .eq("language", language)
    .order("order_index", { ascending: true });

  // Grouper par section en conservant l'ordre
  const sections: { slug: string; label: string; items: Criterion[] }[] = [];
  const seen = new Map<string, number>();

  for (const c of (criteria as Criterion[]) ?? []) {
    const idx = seen.get(c.section_slug);
    if (idx === undefined) {
      seen.set(c.section_slug, sections.length);
      sections.push({ slug: c.section_slug, label: c.section_label, items: [c] });
    } else {
      sections[idx].items.push(c);
    }
  }

  const total = criteria?.length ?? 0;
  const active = criteria?.filter((c) => (c as Criterion).active).length ?? 0;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <h1 className="text-xl font-bold text-gray-900">Critères d&apos;analyse</h1>
      <p className="mt-1 text-sm text-gray-500">
        {active}/{total} critères actifs
        {isAdmin && (
          <span className="ml-2 text-xs text-blue-600 font-medium">— mode admin</span>
        )}
      </p>

      {/* Onglets langue */}
      <div className="mt-4 flex gap-2">
        <Link
          href="/criteres?lang=fr"
          className={`flex-1 rounded-lg border py-2 text-center text-sm font-medium transition-colors ${
            language === "fr"
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          Français ({criteria && language === "fr" ? total : "…"})
        </Link>
        <Link
          href="/criteres?lang=nl"
          className={`flex-1 rounded-lg border py-2 text-center text-sm font-medium transition-colors ${
            language === "nl"
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          Nederlands ({criteria && language === "nl" ? total : "…"})
        </Link>
      </div>

      {/* Erreur de chargement */}
      {error && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Erreur de chargement : {error.message}
        </div>
      )}

      {/* Aucun critère */}
      {!error && total === 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400 text-sm">
          Aucun critère trouvé.
          <br />
          <span className="text-xs text-gray-300 mt-1 block">
            Lancez l&apos;import : <code>node scripts/import-criteria.mjs</code>
          </span>
        </div>
      )}

      {/* Liste par section */}
      <div className="mt-4 space-y-6">
        {sections.map((section) => (
          <section key={section.slug}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 mb-2">
              {section.label}
            </h2>
            <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {section.items.map((c) => (
                <li
                  key={c.id}
                  className={`px-4 py-3 flex items-start gap-3 ${
                    !c.active ? "opacity-50" : ""
                  }`}
                >
                  {/* Numéro */}
                  <span className="shrink-0 mt-0.5 w-6 text-xs text-gray-400 text-right">
                    {c.order_index}
                  </span>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {c.label_original}
                    </p>
                    {c.detail_original && (
                      <p className="mt-0.5 text-xs text-gray-500 leading-snug">
                        {c.detail_original}
                      </p>
                    )}
                  </div>

                  {/* Toggle (admin uniquement) */}
                  {isAdmin && (
                    <div className="shrink-0 mt-0.5">
                      <CriterionToggle criterionId={c.id} active={c.active} />
                    </div>
                  )}

                  {/* Indicateur lecture seule */}
                  {!isAdmin && (
                    <span
                      className={`shrink-0 mt-1 h-2 w-2 rounded-full ${
                        c.active ? "bg-green-400" : "bg-gray-300"
                      }`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
