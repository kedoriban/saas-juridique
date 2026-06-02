import Link from "next/link";
import type { Arret } from "@/lib/types";

const LANGUE_STYLE: Record<string, string> = {
  fr: "bg-blue-50 text-blue-700",
  nl: "bg-orange-50 text-orange-700",
};
const STATUT_DOT: Record<string, string> = {
  en_attente: "bg-gray-300",
  en_cours: "bg-yellow-400",
  termine: "bg-forest-400",
  erreur: "bg-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ArretTableRow({ arret }: { arret: Arret }) {
  return (
    <tr className="hover:bg-gray-50/70 transition-colors group">
      <td className="px-6 py-4 align-top">
        <Link href={`/arrets/${arret.id}`} className="block">
          <span className="font-semibold text-gray-900 group-hover:text-forest-600 transition-colors text-sm">
            {arret.numero}
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUT_DOT[arret.statut_traitement] ?? "bg-gray-300"}`} />
            <span className="text-xs text-gray-400 tabular-nums">{formatDate(arret.date_arret)}</span>
          </div>
        </Link>
      </td>
      <td className="px-4 py-4 align-top max-w-xs">
        <Link href={`/arrets/${arret.id}`} className="block">
          {arret.resume ? (
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{arret.resume}</p>
          ) : (
            <span className="text-sm text-gray-300 italic">—</span>
          )}
        </Link>
      </td>
      <td className="px-4 py-4 align-top">
        <Link href={`/arrets/${arret.id}`} className="block">
          {arret.matiere ? (
            <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
              {arret.matiere}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </Link>
      </td>
      <td className="px-4 py-4 align-top">
        <Link href={`/arrets/${arret.id}`} className="block">
          <span className="text-sm text-gray-600">
            {arret.chambre ?? <span className="text-gray-300">—</span>}
          </span>
        </Link>
      </td>
      <td className="px-4 py-4 align-top">
        <Link href={`/arrets/${arret.id}`} className="block">
          <span className="text-sm text-gray-600 tabular-nums whitespace-nowrap">
            {formatDate(arret.date_arret)}
          </span>
        </Link>
      </td>
      <td className="px-4 py-4 align-top">
        <Link href={`/arrets/${arret.id}`} className="block">
          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${LANGUE_STYLE[arret.langue] ?? "bg-gray-100 text-gray-500"}`}>
            {arret.langue?.toUpperCase()}
          </span>
        </Link>
      </td>
    </tr>
  );
}
