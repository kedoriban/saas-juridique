import Link from "next/link";
import type { Arret } from "@/lib/types";
import { TagPill } from "@/components/TagPill";

const LANGUE_COLOR: Record<string, string> = {
  fr: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  nl: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

function formatDate(iso: string) {
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

export default function ArretCard({ arret }: { arret: Arret }) {
  return (
    <Link href={`/arrets/${arret.id}`} className="block group">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm group-hover:shadow-md group-hover:border-gray-200 group-active:bg-gray-50 transition-all duration-150">
        {/* Ligne 1 : langue + focus + date */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                LANGUE_COLOR[arret.langue] ?? "bg-gray-100 text-gray-500"
              }`}
            >
              {arret.langue === "fr" ? "FR" : "NL"}
            </span>
            {arret.is_focus && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
                ★ Focus
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 tabular-nums">
            {formatDate(arret.date_arret)}
          </span>
        </div>

        {/* Numéro */}
        <p className="font-semibold text-gray-900 text-[15px] leading-snug">
          {arret.numero}
        </p>

        {/* Métadonnées inline */}
        {(arret.procedure_type || arret.pays_origine || arret.source_juridiction) && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
            {arret.procedure_type && (
              <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arret.procedure_type}
              </span>
            )}
            {arret.pays_origine && (
              <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arret.pays_origine}
              </span>
            )}
            {arret.source_juridiction && (
              <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arret.source_juridiction}
              </span>
            )}
          </div>
        )}

        {/* Résumé */}
        {arret.resume && (
          <p className="mt-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">
            {arret.resume}
          </p>
        )}

        {/* Tags */}
        {arret.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {arret.tags.map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
