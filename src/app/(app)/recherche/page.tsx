export default function RecherchePage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Recherche avancée</h1>
      <p className="mt-1 text-sm text-gray-500">
        Filtrez les arrêts par critères juridiques.
      </p>

      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
        <input
          type="search"
          placeholder="Rechercher un arrêt…"
          disabled
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
        />
      </div>

      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Disponible après import des arrêts et des critères.
        <br />
        <span className="text-xs text-gray-300 mt-1 block">
          Phase 3 : recherche avancée
        </span>
      </div>
    </div>
  );
}
