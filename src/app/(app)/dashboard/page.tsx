import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DecisionDonut from "./DecisionDonut";
import { TagPill } from "@/components/TagPill";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const PROCEDURE_LABELS: Record<string, string> = {
  asile: "Asile",
  annulation: "Annulation",
  plein_contentieux: "Plein cont.",
  autre: "Autre",
};

function formatProcedure(pt: string | null): string {
  if (!pt) return "—";
  return PROCEDURE_LABELS[pt] ?? pt.charAt(0).toUpperCase() + pt.slice(1);
}

function LangBadge({ lang }: { lang: string }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
        lang === "fr"
          ? "bg-blue-100 text-blue-700"
          : "bg-orange-100 text-orange-700"
      }`}
    >
      {lang}
    </span>
  );
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {delta !== undefined && (
        <p
          className={`text-xs mt-1 font-medium ${
            delta > 0
              ? "text-green-600"
              : delta < 0
              ? "text-red-500"
              : "text-gray-400"
          }`}
        >
          {delta > 0 ? `+${delta}` : delta === 0 ? "=" : delta} vs période préc.
        </p>
      )}
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalArrets },
    { count: analysesCount },
    { count: recent30 },
    { count: prev30 },
    { count: focusCount },
    { data: recentArrets },
    { data: focusArrets },
    { data: decisionsData },
  ] = await Promise.all([
    supabase.from("arrets").select("*", { count: "exact", head: true }),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .eq("statut_traitement", "termine"),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", d30),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", d60)
      .lt("created_at", d30),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .eq("is_focus", true),
    supabase
      .from("arrets")
      .select("id, numero, date_arret, langue, procedure_type, source_juridiction, resume, tags")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("arrets")
      .select("id, numero, date_arret, langue, resume, resume_ai")
      .eq("is_focus", true)
      .order("date_arret", { ascending: false })
      .limit(2),
    supabase.from("arrets").select("type_decision"),
  ]);

  const recentDelta = (recent30 ?? 0) - (prev30 ?? 0);

  // Group type_decision for donut
  const decisionMap: Record<string, number> = {};
  for (const row of decisionsData ?? []) {
    const key = row.type_decision ?? "Non défini";
    decisionMap[key] = (decisionMap[key] ?? 0) + 1;
  }
  const donutData = Object.entries(decisionMap).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Bienvenue{user?.email ? `, ${user.email}` : ""}.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total arrêts" value={totalArrets ?? 0} />
        <KpiCard label="Analysés" value={analysesCount ?? 0} />
        <KpiCard
          label="Ajoutés (30 jours)"
          value={recent30 ?? 0}
          delta={recentDelta}
        />
        <KpiCard label="Arrêts focus" value={focusCount ?? 0} />
      </div>

      {/* Recent Arrêts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">
            Arrêts récemment ajoutés
          </h2>
          <Link
            href="/arrets"
            className="text-xs text-forest-600 hover:underline"
          >
            Voir tout →
          </Link>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  {["Arrêt", "Résumé", "Procédure", "Source", "Date", "Langue"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(recentArrets ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      Aucun arrêt
                    </td>
                  </tr>
                ) : (
                  (recentArrets ?? []).map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/arrets/${a.id}`}
                          className="font-mono text-xs font-semibold text-gray-800 hover:text-forest-600"
                        >
                          {a.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {a.resume ?? "—"}
                        </p>
                        {(a.tags as string[])?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(a.tags as string[]).map((t) => (
                              <TagPill key={t} tag={t} />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatProcedure(a.procedure_type as string | null)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {(a.source_juridiction as string | null) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatShortDate(a.date_arret as string)}
                      </td>
                      <td className="px-4 py-3">
                        <LangBadge lang={a.langue as string} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {(recentArrets ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Aucun arrêt
            </p>
          ) : (
            (recentArrets ?? []).map((a) => (
              <Link
                key={a.id}
                href={`/arrets/${a.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-800">
                    {a.numero}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">
                      {formatShortDate(a.date_arret as string)}
                    </span>
                    <LangBadge lang={a.langue as string} />
                  </div>
                </div>
                {a.resume && (
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {a.resume as string}
                  </p>
                )}
                {(a.tags as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(a.tags as string[]).map((t) => (
                      <TagPill key={t} tag={t} />
                    ))}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Bottom row: Focus + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Focus */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Arrêts importants (Focus)
          </h2>
          {(focusArrets ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <p className="text-sm text-gray-400">Aucun arrêt marqué comme important.</p>
              <p className="text-xs text-gray-300 text-center">
                Utilisez le menu ⋯ depuis la liste des arrêts pour marquer un arrêt comme Focus.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(focusArrets ?? []).map((a) => (
                <Link
                  key={a.id}
                  href={`/arrets/${a.id}`}
                  className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold text-gray-800">
                      {a.numero}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatShortDate(a.date_arret as string)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-3">
                    {(a.resume_ai as string | null) ?? (a.resume as string | null) ?? "—"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Decision Donut */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Répartition par type de décision
          </h2>
          <DecisionDonut data={donutData} />
        </section>
      </div>
    </div>
  );
}
