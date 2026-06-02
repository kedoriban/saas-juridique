import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: totalArrets },
    { count: analysesCount },
    { count: aValiderCount },
    { count: criteresActifs },
  ] = await Promise.all([
    supabase.from("arrets").select("*", { count: "exact", head: true }),
    supabase
      .from("arrets")
      .select("*", { count: "exact", head: true })
      .eq("statut_traitement", "termine"),
    supabase
      .from("arret_criteria_values")
      .select("*", { count: "exact", head: true })
      .is("validation_status", null),
    supabase
      .from("criteria")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
  ]);

  const stats = [
    { label: "Arrêts importés", value: totalArrets ?? 0 },
    { label: "Analysés", value: analysesCount ?? 0 },
    { label: "À valider", value: aValiderCount ?? 0 },
    { label: "Critères actifs", value: criteresActifs ?? 0 },
  ];

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bienvenue{user?.email ? `, ${user.email}` : ""}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
