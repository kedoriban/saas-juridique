"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { IconSearch, IconFilter } from "@/components/icons";

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

  const activeFilters = ["langue", "matiere", "pays", "statut"].filter(
    (k) => searchParams.get(k)
  );
  const hasActive = activeFilters.length > 0 || !!searchParams.get("q");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      {/* Barre de recherche */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            name="q"
            type="search"
            defaultValue={current("q")}
            placeholder="Rechercher par titre, numéro, contenu…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent focus:bg-white transition-colors"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-forest-600 text-white text-sm font-semibold rounded-xl hover:bg-forest-700 active:bg-forest-800 transition-colors"
        >
          Chercher
        </button>
      </form>

      {/* Ligne filtres */}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            open || hasActive
              ? "border-forest-300 bg-forest-50 text-forest-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <IconFilter className="w-3.5 h-3.5" />
          <span>Filtres avancés</span>
          {activeFilters.length > 0 && (
            <span className="bg-forest-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {activeFilters.length}
            </span>
          )}
        </button>
        {hasActive && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
          >
            Réinitialiser
          </button>
        )}

        {/* Chips filtres actifs */}
        {activeFilters.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 text-xs bg-forest-50 text-forest-700 border border-forest-200 px-2.5 py-1 rounded-lg"
          >
            <span className="font-medium capitalize">{k}</span>
            <span className="text-forest-500">: {searchParams.get(k)}</span>
          </span>
        ))}
      </div>

      {/* Panneau filtres déroulant */}
      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 pt-3 border-t border-gray-100 space-y-3"
        >
          {/* Préserve la recherche textuelle quand on applique des filtres */}
          <input type="hidden" name="q" value={current("q")} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Langue</label>
              <select
                name="langue"
                defaultValue={current("langue")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
              >
                <option value="">Toutes</option>
                <option value="fr">Français (FR)</option>
                <option value="nl">Néerlandais (NL)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Statut traitement</label>
              <select
                name="statut"
                defaultValue={current("statut")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
              >
                <option value="">Tous</option>
                <option value="en_attente">En attente</option>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
                <option value="erreur">Erreur</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Matière</label>
            <select
              name="matiere"
              defaultValue={current("matiere")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
            >
              <option value="">Toutes les matières</option>
              {matieres.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Pays d&apos;origine</label>
            <select
              name="pays"
              defaultValue={current("pays")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
            >
              <option value="">Tous les pays</option>
              {pays.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-forest-600 text-white text-sm font-semibold rounded-xl hover:bg-forest-700 transition-colors"
            >
              Appliquer les filtres
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
