"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback } from "react";

interface FiltresPanelProps {
  matieres: string[];
  pays: string[];
}

export default function FiltresPanel({ matieres, pays }: FiltresPanelProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = useCallback(
    (key: string) => searchParams.get(key) ?? "",
    [searchParams]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (v) params.set(k, v.toString());
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function handleReset() {
    router.push(pathname);
    setOpen(false);
  }

  const hasActive = ["q", "langue", "matiere", "pays", "statut"].some(
    (k) => searchParams.get(k)
  );

  return (
    <div className="mb-4">
      {/* Barre de recherche toujours visible */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={current("q")}
          placeholder="Numéro, pays, résumé…"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          OK
        </button>
      </form>

      {/* Bouton filtres avancés */}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            open || hasActive
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600"
          }`}
        >
          <span>Filtres</span>
          {hasActive && (
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          )}
          <span className="text-xs">{open ? "▲" : "▼"}</span>
        </button>
        {hasActive && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Panneau filtres */}
      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-2 bg-white rounded-xl border border-gray-200 p-4 space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Langue
            </label>
            <select
              name="langue"
              defaultValue={current("langue")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes</option>
              <option value="fr">Français (FR)</option>
              <option value="nl">Néerlandais (NL)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Matière
            </label>
            <select
              name="matiere"
              defaultValue={current("matiere")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes</option>
              {matieres.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Pays d&apos;origine
            </label>
            <select
              name="pays"
              defaultValue={current("pays")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous</option>
              {pays.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Statut traitement
            </label>
            <select
              name="statut"
              defaultValue={current("statut")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous</option>
              <option value="en_attente">En attente</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="erreur">Erreur</option>
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Réinitialiser
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
