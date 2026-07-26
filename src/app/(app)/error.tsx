"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundary applicatif : capture toute erreur de rendu d'une page sous (app)
// SANS démonter le shell (sidebar/topbar), et sans afficher le message générique
// « Application error » de Next.js. Le travail déjà enregistré côté serveur est
// conservé ; recharger la page ne perd rien.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-4 lg:px-8 py-10 max-w-2xl">
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
        <h1 className="text-lg font-bold text-gray-900">Une erreur s&apos;est produite</h1>
        <p className="mt-2 text-sm text-gray-600">
          Un problème est survenu pendant l&apos;affichage de cette page. Vos données déjà
          enregistrées sont conservées — vous pouvez réessayer ou recharger sans rien perdre.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => reset()}
            className="text-sm px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/validation"
            className="text-sm px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Retour à la validation
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">Référence technique : {error.digest}</p>
        )}
      </div>
    </div>
  );
}
