"use client";

import { useState, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSearch, IconFilter } from "@/components/icons";
import AdvancedSearchModal, { ADVANCED_PARAMS } from "./AdvancedSearchModal";

export default function ArretFilters({ total }: { total: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [advOpen, setAdvOpen] = useState(false);

  const q = sp.get("q") ?? "";
  const lang = sp.get("lang") ?? "";
  const dateFrom = sp.get("date_from") ?? "";
  const dateTo = sp.get("date_to") ?? "";
  const advancedCount = ADVANCED_PARAMS.filter((p) => !!sp.get(p)).length;

  function buildUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (!val) params.delete(key);
      else params.set(key, val);
    }
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function nav(updates: Record<string, string | null>) {
    router.push(buildUrl(updates));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    nav({ q: inputRef.current?.value.trim() || null });
  }

  const hasFilters = !!(q || lang || dateFrom || dateTo || advancedCount);

  const chips: { id: string; label: string; clear: Record<string, null> }[] = [];
  if (q) chips.push({ id: "q", label: `"${q}"`, clear: { q: null } });
  if (lang) chips.push({ id: "lang", label: lang.toUpperCase(), clear: { lang: null } });
  if (dateFrom || dateTo) {
    const label = [dateFrom, dateTo].filter(Boolean).join(" → ");
    chips.push({ id: "dates", label, clear: { date_from: null, date_to: null } });
  }

  const clearAdvanced = Object.fromEntries(ADVANCED_PARAMS.map((p) => [p, null as null]));

  return (
    <>
    <div className="space-y-2.5 mb-5">
      {/* Row 1 : search + lang + dates + advanced */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl px-3 gap-2 min-w-0"
        >
          <IconSearch className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            key={q}
            ref={inputRef}
            type="text"
            defaultValue={q}
            placeholder="Numéro, résumé…"
            className="flex-1 py-2.5 text-sm outline-none bg-transparent placeholder-gray-400 min-w-0"
          />
          {q && (
            <button
              type="button"
              onClick={() => nav({ q: null })}
              className="text-gray-300 hover:text-gray-500 text-base leading-none shrink-0"
            >
              ×
            </button>
          )}
        </form>

        {/* Language toggle */}
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0">
          {(["", "fr", "nl"] as const).map((l) => (
            <button
              key={l}
              onClick={() => nav({ lang: l || null })}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                lang === l
                  ? "bg-forest-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {l === "" ? "Tous" : l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shrink-0">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => nav({ date_from: e.target.value || null })}
            className="outline-none text-xs bg-transparent w-28 text-gray-600"
          />
          <span className="text-gray-300 text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => nav({ date_to: e.target.value || null })}
            className="outline-none text-xs bg-transparent w-28 text-gray-600"
          />
        </div>

        {/* Filtres avancés */}
        <button
          type="button"
          onClick={() => setAdvOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors shrink-0 ${
            advancedCount > 0
              ? "border-forest-500 text-forest-700 bg-forest-50 hover:bg-forest-100"
              : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
          }`}
        >
          <IconFilter className="w-3.5 h-3.5" />
          Filtres avancés
          {advancedCount > 0 && (
            <span className="bg-forest-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {advancedCount}
            </span>
          )}
        </button>
      </div>

      {/* Row 2 : count + chips + reset */}
      <div className="flex items-center gap-2 flex-wrap min-h-[1.5rem]">
        <span className="text-xs text-gray-400 tabular-nums">
          {total} arrêt{total !== 1 ? "s" : ""}
        </span>

        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => nav(chip.clear)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-100 text-forest-700 text-xs font-medium hover:bg-forest-200 transition-colors"
          >
            {chip.label}
            <span className="text-forest-400 leading-none">×</span>
          </button>
        ))}

        {advancedCount > 0 && (
          <button
            onClick={() => nav(clearAdvanced)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-100 text-forest-700 text-xs font-medium hover:bg-forest-200 transition-colors"
          >
            {advancedCount} filtre{advancedCount > 1 ? "s" : ""} avancé{advancedCount > 1 ? "s" : ""}
            <span className="text-forest-400 leading-none">×</span>
          </button>
        )}

        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>

    <AdvancedSearchModal open={advOpen} onClose={() => setAdvOpen(false)} />
    </>
  );
}
