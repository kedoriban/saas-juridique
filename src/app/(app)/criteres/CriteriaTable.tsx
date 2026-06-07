"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Criterion } from "@/lib/types";
import { setStatut, duplicateCriterion, createCriterion } from "@/app/actions/criteria";
import { IconSearch } from "@/components/icons";

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupBySection(list: Criterion[]) {
  const sections: { slug: string; label: string; items: Criterion[] }[] = [];
  const seen = new Map<string, number>();
  for (const c of list) {
    const idx = seen.get(c.section_slug);
    if (idx === undefined) {
      seen.set(c.section_slug, sections.length);
      sections.push({ slug: c.section_slug, label: c.section_label, items: [c] });
    } else {
      sections[idx].items.push(c);
    }
  }
  return sections;
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── RowMenu ──────────────────────────────────────────────────────────────────

function RowMenu({
  criterionId,
  onDuplicate,
}: {
  criterionId: string;
  onDuplicate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-base leading-none"
        aria-label="Actions"
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[9rem]">
          <button
            onClick={() => {
              setOpen(false);
              onDuplicate(criterionId);
            }}
            className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Dupliquer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CreateModal ──────────────────────────────────────────────────────────────

function CreateModal({
  language,
  sections,
  onClose,
}: {
  language: "fr" | "nl";
  sections: { slug: string; label: string }[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const sectionSlug = fd.get("section_slug") as string;
    const sectionLabel =
      sections.find((s) => s.slug === sectionSlug)?.label ?? sectionSlug;

    startTransition(async () => {
      const result = await createCriterion({
        label_original: fd.get("label_original") as string,
        detail_original: (fd.get("detail_original") as string) || null,
        language,
        section_slug: sectionSlug,
        section_label: sectionLabel,
        effet_date: (fd.get("effet_date") as string) || null,
      });
      if (result.error) {
        setFormError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">
          Nouveau critère
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Section
            </label>
            <select
              name="section_slug"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest-500 bg-white"
            >
              <option value="">— Choisir une section —</option>
              {sections.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              name="label_original"
              type="text"
              required
              placeholder="Libellé du critère"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Description
            </label>
            <textarea
              name="detail_original"
              rows={2}
              placeholder="Détail ou précision (optionnel)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest-500 resize-none"
            />
          </div>

          {/* Effet */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Date d&apos;effet
            </label>
            <input
              name="effet_date"
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-forest-500"
            />
          </div>

          {/* Langue (info only) */}
          <p className="text-xs text-gray-400">
            Langue :{" "}
            <span className="font-semibold">
              {language === "fr" ? "Français" : "Nederlands"}
            </span>
          </p>

          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CriteriaTable ────────────────────────────────────────────────────────────

interface Props {
  criteria: Criterion[];
  isAdmin: boolean;
  language: "fr" | "nl";
}

export default function CriteriaTable({ criteria, isAdmin, language }: Props) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const q = search.trim().toLowerCase();
  const filtered = q
    ? criteria.filter(
        (c) =>
          c.label_original.toLowerCase().includes(q) ||
          c.section_label.toLowerCase().includes(q) ||
          (c.detail_original ?? "").toLowerCase().includes(q)
      )
    : criteria;

  const sections = groupBySection(filtered);
  const uniqueSections = groupBySection(criteria).map((s) => ({
    slug: s.slug,
    label: s.label,
  }));

  function handleToggleStatut(c: Criterion) {
    const next = (c.statut ?? "actif") === "actif" ? "archive" : "actif";
    startTransition(async () => {
      await setStatut(c.id, next);
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      await duplicateCriterion(id);
    });
  }

  const COLS = isAdmin ? 7 : 6;

  return (
    <>
      {/* Search bar + Create button */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl px-3 gap-2">
          <IconSearch className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un critère…"
            className="flex-1 py-2.5 text-sm outline-none bg-transparent placeholder-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-gray-300 hover:text-gray-500 text-base leading-none"
            >
              ×
            </button>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            + Nouveau critère
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400 mb-3 tabular-nums">
        {filtered.length} critère{filtered.length !== 1 ? "s" : ""}
        {search && ` — filtre : "${search}"`}
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-10">
                  #
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Nom
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-20">
                  Langue
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-24">
                  État
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-28">
                  Effet
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-28">
                  Modifié
                </th>
                {isAdmin && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sections.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLS}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Aucun critère trouvé.
                  </td>
                </tr>
              ) : (
                sections.map((section) => (
                  <>
                    {/* Section header */}
                    <tr key={`s-${section.slug}`} className="bg-gray-50/80">
                      <td
                        colSpan={COLS}
                        className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest"
                      >
                        {section.label}
                      </td>
                    </tr>

                    {/* Criteria rows */}
                    {section.items.map((c) => {
                      const isArchived = (c.statut ?? "actif") === "archive";
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-gray-50/50 transition-colors ${
                            isArchived ? "opacity-50" : ""
                          }`}
                        >
                          {/* # */}
                          <td className="px-4 py-3 text-xs text-gray-400 tabular-nums align-top">
                            {c.order_index}
                          </td>

                          {/* Nom */}
                          <td className="px-4 py-3 align-top max-w-xs">
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                              {c.label_original}
                            </p>
                            {c.detail_original && (
                              <p className="mt-0.5 text-xs text-gray-400 leading-snug line-clamp-2">
                                {c.detail_original}
                              </p>
                            )}
                          </td>

                          {/* Langue */}
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                c.language === "fr"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-orange-50 text-orange-700"
                              }`}
                            >
                              {c.language.toUpperCase()}
                            </span>
                          </td>

                          {/* État */}
                          <td className="px-4 py-3 align-top">
                            {isAdmin ? (
                              <button
                                onClick={() => handleToggleStatut(c)}
                                disabled={isPending}
                                className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                                  isArchived
                                    ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    : "bg-forest-100 text-forest-700 hover:bg-forest-200"
                                }`}
                              >
                                {isArchived ? "Archivé" : "Actif"}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                  isArchived
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-forest-100 text-forest-700"
                                }`}
                              >
                                {isArchived ? "Archivé" : "Actif"}
                              </span>
                            )}
                          </td>

                          {/* Effet */}
                          <td className="px-4 py-3 align-top">
                            <span className="text-xs text-gray-500 tabular-nums">
                              {formatShortDate(c.effet_date)}
                            </span>
                          </td>

                          {/* Modifié */}
                          <td className="px-4 py-3 align-top">
                            <span className="text-xs text-gray-400 tabular-nums">
                              {formatShortDate(c.updated_at)}
                            </span>
                          </td>

                          {/* Actions */}
                          {isAdmin && (
                            <td className="px-3 py-3 align-top">
                              <RowMenu
                                criterionId={c.id}
                                onDuplicate={handleDuplicate}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          language={language}
          sections={uniqueSections}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
