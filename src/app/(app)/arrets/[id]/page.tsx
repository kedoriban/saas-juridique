import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Arret, ArretCriteriaValue, Criterion } from "@/lib/types";

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente d'analyse",
  en_cours: "Analyse en cours",
  termine: "Analyse terminée",
  erreur: "Erreur de traitement",
};
const STATUT_COLOR: Record<string, string> = {
  en_attente: "text-gray-500 bg-gray-100",
  en_cours: "text-yellow-700 bg-yellow-100",
  termine: "text-green-700 bg-green-100",
  erreur: "text-red-600 bg-red-100",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type PageProps = { params: Promise<{ id: string }> };

export default async function ArretDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: arret } = await supabase
    .from("arrets")
    .select("*")
    .eq("id", id)
    .single();

  if (!arret) notFound();

  const a = arret as Arret;

  // Valeurs de critères si analyse terminée
  const { data: values } = await supabase
    .from("arret_criteria_values")
    .select("*, criteria(label_original, section_label, language)")
    .eq("arret_id", id)
    .order("created_at");

  const criteriaValues = (values ?? []) as (ArretCriteriaValue & {
    criteria: Pick<Criterion, "label_original" | "section_label" | "language">;
  })[];

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Retour */}
      <Link
        href="/arrets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        ← Arrêts
      </Link>

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              a.langue === "fr"
                ? "bg-blue-100 text-blue-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {a.langue === "fr" ? "FR" : "NL"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLOR[a.statut_traitement] ?? "bg-gray-100 text-gray-500"}`}
          >
            {STATUT_LABEL[a.statut_traitement] ?? a.statut_traitement}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{a.numero}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatDate(a.date_arret)}
        </p>

        {a.resume && (
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            {a.resume}
          </p>
        )}
      </div>

      {/* Métadonnées */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Métadonnées
        </h2>
        <dl className="space-y-2">
          {a.chambre && (
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Chambre</dt>
              <dd className="text-gray-900 font-medium">{a.chambre}</dd>
            </div>
          )}
          {a.matiere && (
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Matière</dt>
              <dd className="text-gray-900 font-medium">{a.matiere}</dd>
            </div>
          )}
          {a.pays_origine && (
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Pays d&apos;origine</dt>
              <dd className="text-gray-900 font-medium">{a.pays_origine}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Lien PDF */}
      {a.pdf_url && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Document original
          </h2>
          <a
            href={a.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Voir le PDF sur rvv-cce.be ↗
          </a>
          <p className="mt-1 text-xs text-gray-400">
            Lien vers le document public — aucun PDF stocké sur ce serveur.
          </p>
        </div>
      )}

      {/* Critères */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Critères
          </h2>
          <span className="text-xs text-gray-400">
            {criteriaValues.length} valeur{criteriaValues.length !== 1 ? "s" : ""}
          </span>
        </div>

        {criteriaValues.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Analyse non encore effectuée.
            <br />
            <span className="text-xs text-gray-300">
              Le worker LLM alimentera cette section.
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            {criteriaValues.map((v) => (
              <div
                key={v.id}
                className="flex justify-between items-start text-sm"
              >
                <div className="text-gray-600 flex-1 pr-2">
                  <span className="text-xs text-gray-400 block">
                    {v.criteria?.section_label}
                  </span>
                  {v.criteria?.label_original}
                </div>
                <div className="text-right shrink-0">
                  {v.value_text ? (
                    <span className="text-gray-900 font-medium">
                      {v.value_text}
                    </span>
                  ) : v.value_boolean !== null ? (
                    <span
                      className={
                        v.value_boolean ? "text-green-600" : "text-red-500"
                      }
                    >
                      {v.value_boolean ? "Oui" : "Non"}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                  {v.confidence !== null && (
                    <span className="block text-xs text-gray-300">
                      {Math.round(v.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
