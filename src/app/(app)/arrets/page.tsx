export default function ArretsPage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Arrêts</h1>
      <p className="mt-1 text-sm text-gray-500">
        Liste des arrêts CCE/RVV importés.
      </p>

      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Aucun arrêt importé pour le moment.
        <br />
        <span className="text-xs text-gray-300 mt-1 block">
          Phase 3 : import et scraping
        </span>
      </div>
    </div>
  );
}
