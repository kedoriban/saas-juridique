import Link from "next/link";
import type { Arret } from "@/lib/types";

const LANGUE_COLOR: Record<string, string> = {
  fr: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  nl: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  erreur: "Erreur",
};
const STATUT_DOT: Record<string, string> = {
  en_attente: "bg-gray-300",
  en_cours: "bg-yellow-400",
  termine: "bg-green-400",
  erreur: "bg-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ArretCard({ arret }: { arret: Arret }) {
  return (
    <Link href={`/arrets/${arret.id}`} className="block group">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm group-hover:shadow-md group-hover:border-gray-200 group-active:bg-gray-50 transition-all duration-150">
        {/* Ligne 1 : langue + date */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${LANGUE_COLOR[arret.langue] ?? "bg-gray-100 text-gray-500"}`}>
            {arret.langue === "fr" ? "FR" : "NL"}
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            {formatDate(arret.date_arret)}
          </span>
        </div>

        {/* Numéro d'arrêt */}
        <p className="font-semibold text-gray-900 text-[15px] leading-snug">
          {arret.numero}
        </p>

        {/* Métadonnées inline */}
        {(arret.matiere || arret.pays_origine || arret.chambre) && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
            {arret.matiere && (
              <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arret.matiere}
              </span>
            )}
            {arret.pays_origine && (
              <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arret.pays_origine}
              </span>
            )}
            {arret.chambre && (
              <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arret.chambre}
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

        {/* Statut */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUT_DOT[arret.statut_traitement] ?? "bg-gray-300"}`} />
          <span className="text-xs text-gray-400">
            {STATUT_LABEL[arret.statut_traitement] ?? arret.statut_traitement}
          </span>
        </div>
      </div>
    </Link>
  );
}
