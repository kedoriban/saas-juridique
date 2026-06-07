import { createClient } from "@/lib/supabase/server";
import StatsCharts from "./StatsCharts";
import type { StatsArret, TopCriterion } from "./StatsCharts";

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent = "bg-forest-600",
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-3`} />
      <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
        {value}
      </p>
      <p className="text-xs font-medium text-gray-500 mt-1.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function StatsPage() {
  const supabase = await createClient();

  const [
    { count: total },
    { count: analysedCount },
    { count: annulationCount },
    { data: arretsData },
    { data: valuesData },
  ] = await Promise.all([
    supabase.from("arrets").select("*", { count: "exact", head: true }),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .eq("statut_traitement", "termine"),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .eq("type_decision", "annulation"),
    supabase
      .from("arrets")
      .select("date_arret, langue, procedure_type, pays_origine")
      .order("date_arret", { ascending: true }),
    supabase
      .from("arret_criteria_values")
      .select(
        "criterion_id, value_boolean, value_text, criteria(label_original, section_label)"
      )
      .not("criterion_id", "is", null),
  ]);

  const totalN = total ?? 0;
  const analysedN = analysedCount ?? 0;
  const annulationN = annulationCount ?? 0;

  const analyseRate = totalN ? Math.round((analysedN / totalN) * 100) : 0;
  const annulationRate = analysedN
    ? Math.round((annulationN / analysedN) * 100)
    : 0;

  // Build top criteria
  type ValRow = {
    criterion_id: string | null;
    value_boolean: boolean | null;
    value_text: string | null;
    criteria: { label_original: string; section_label: string } | null;
  };
  const criterionMap = new Map<
    string,
    { label: string; section: string; count: number }
  >();
  for (const v of (valuesData as unknown as ValRow[]) ?? []) {
    if (!v.criterion_id) continue;
    const hasValue =
      v.value_boolean === true ||
      (v.value_text !== null && v.value_text.trim().length > 0);
    if (!hasValue) continue;
    if (!criterionMap.has(v.criterion_id)) {
      criterionMap.set(v.criterion_id, {
        label: v.criteria?.label_original ?? "—",
        section: v.criteria?.section_label ?? "—",
        count: 0,
      });
    }
    criterionMap.get(v.criterion_id)!.count++;
  }
  const topCriteria: TopCriterion[] = [...criterionMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({
      ...c,
      pct: analysedN ? Math.round((c.count / analysedN) * 100) : 0,
    }));

  const arrets = (arretsData as StatsArret[]) ?? [];

  if (totalN === 0) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">
          Statistiques
        </h1>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 text-center">
          <p className="text-sm font-medium text-gray-500">
            Aucune donnée disponible
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Lancez le seed pour voir les statistiques.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Statistiques
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Vue d&apos;ensemble de la base d&apos;arrêts.
        </p>
      </div>

      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total arrêts"
            value={totalN}
            sub="dans la base"
            accent="bg-forest-600"
          />
          <KpiCard
            label="Taux d'analyse"
            value={`${analyseRate}%`}
            sub={`${analysedN} analysé${analysedN !== 1 ? "s" : ""}`}
            accent="bg-forest-400"
          />
          <KpiCard
            label="Taux d'annulation"
            value={`${annulationRate}%`}
            sub={`${annulationN} annulation${annulationN !== 1 ? "s" : ""}`}
            accent="bg-red-400"
          />
          <KpiCard
            label="Critères extraits"
            value={(valuesData?.length ?? 0).toLocaleString("fr-BE")}
            sub="valeurs LLM en base"
            accent="bg-blue-400"
          />
        </div>

        {/* recharts client component */}
        <StatsCharts
          arrets={arrets}
          topCriteria={topCriteria}
          analysedCount={analysedN}
        />
      </div>
    </div>
  );
}
