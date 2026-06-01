import Link from "next/link";
import type { Arret } from "@/lib/types";

const LANGUE_LABEL: Record<string, string> = { fr: "FR", nl: "NL" };
const LANGUE_COLOR: Record<string, string> = {
  fr: "bg-blue-100 text-blue-700",
  nl: "bg-orange-100 text-orange-700",
};

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  erreur: "Erreur",
};
const STATUT_COLOR: Record<string, string> = {
  en_attente: "bg-gray-100 text-gray-500",
  en_cours: "bg-yellow-100 text-yellow-700",
  termine: "bg-green-100 text-green-700",
  erreur: "bg-red-100 text-red-600",
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
    <Link href={`/arrets/${arret.id}`} className="block">
      <div className="bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 hover:border-gray-300 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LANGUE_COLOR[arret.langue] ?? "bg-gray-100 text-gray-500"}`}
          >
            {LANGUE_LABEL[arret.langue] ?? arret.langue.toUpperCase()}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLOR[arret.statut_traitement] ?? "bg-gray-100 text-gray-500"}`}
          >
            {STATUT_LABEL[arret.statut_traitement] ?? arret.statut_traitement}
          </span>
          <span className="ml-auto text-xs text-gray-400">
            {formatDate(arret.date_arret)}
          </span>
        </div>

        <p className="font-semibold text-gray-900 text-sm">{arret.numero}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
          {arret.matiere && <span>{arret.matiere}</span>}
          {arret.pays_origine && (
            <>
              <span className="text-gray-300">·</span>
              <span>{arret.pays_origine}</span>
            </>
          )}
          {arret.chambre && (
            <>
              <span className="text-gray-300">·</span>
              <span>{arret.chambre}</span>
            </>
          )}
        </div>

        {arret.resume && (
          <p className="mt-2 text-xs text-gray-400 line-clamp-2">
            {arret.resume}
          </p>
        )}
      </div>
    </Link>
  );
}
