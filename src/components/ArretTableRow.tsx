import Link from "next/link";
import type { Arret } from "@/lib/types";
import { TagPill } from "@/components/TagPill";
import ArretRowMenu from "@/components/ArretRowMenu";

const LANGUE_STYLE: Record<string, string> = {
  fr: "bg-blue-50 text-blue-700",
  nl: "bg-orange-50 text-orange-700",
};

const PROCEDURE_LABELS: Record<string, string> = {
  asile: "Asile",
  annulation: "Annulation",
  plein_contentieux: "Plein cont.",
  autre: "Autre",
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

function formatProcedure(pt: string | null): string {
  if (!pt) return "—";
  return PROCEDURE_LABELS[pt] ?? pt.charAt(0).toUpperCase() + pt.slice(1);
}

export default function ArretTableRow({ arret }: { arret: Arret }) {
  return (
    <tr className="hover:bg-gray-50/70 transition-colors group">
      {/* N° Arrêt */}
      <td className="px-6 py-3.5 align-middle whitespace-nowrap">
        <Link href={`/arrets/${arret.id}`} className="block">
          <span className="font-semibold text-sm text-gray-900 group-hover:text-forest-600 transition-colors">
            {arret.numero}
          </span>
          {arret.is_focus && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
              ★
            </span>
          )}
        </Link>
      </td>

      {/* Résumé + tags */}
      <td className="px-4 py-3.5 align-middle max-w-xs">
        <Link href={`/arrets/${arret.id}`} className="block">
          {arret.resume ? (
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
              {arret.resume}
            </p>
          ) : (
            <span className="text-sm text-gray-300 italic">—</span>
          )}
          {arret.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {arret.tags.map((t) => (
                <TagPill key={t} tag={t} />
              ))}
            </div>
          )}
        </Link>
      </td>

      {/* Procédure */}
      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
        <span className="text-xs text-gray-600">
          {formatProcedure(arret.procedure_type)}
        </span>
      </td>

      {/* Source juridiction */}
      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
        <span className="text-xs text-gray-500">
          {arret.source_juridiction ?? "—"}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
        <span className="text-xs text-gray-500 tabular-nums">
          {formatDate(arret.date_arret)}
        </span>
      </td>

      {/* Langue */}
      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
        <span
          className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${
            LANGUE_STYLE[arret.langue] ?? "bg-gray-100 text-gray-500"
          }`}
        >
          {arret.langue?.toUpperCase()}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-3.5 align-middle w-10">
        <ArretRowMenu
          arretId={arret.id}
          isFocus={arret.is_focus}
          pdfUrl={arret.pdf_url}
        />
      </td>
    </tr>
  );
}
