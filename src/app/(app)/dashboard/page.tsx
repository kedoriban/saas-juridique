import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bienvenue{user?.email ? `, ${user.email}` : ""}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          { label: "Arrêts importés", value: "—" },
          { label: "Analysés", value: "—" },
          { label: "À valider", value: "—" },
          { label: "Critères actifs", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800">Phase 1 en cours</p>
        <p className="text-xs text-blue-600 mt-1">
          Base SaaS opérationnelle. Prochaine étape : import des critères et
          des arrêts.
        </p>
      </div>
    </div>
  );
}
