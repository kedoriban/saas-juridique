"use client";

import { useEffect } from "react";

// Filet de sécurité ultime : capture les erreurs qui remontent jusqu'au layout
// racine (là où l'error boundary applicatif ne peut rien). Doit fournir ses
// propres <html>/<body> car il remplace le layout racine. Styles inline : la
// feuille globale n'est pas garantie chargée à ce niveau.
export default function GlobalError({
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
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F7F7",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#1f2937",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            padding: "28px 32px",
            background: "#fff",
            border: "1px solid #f3d0d0",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Une erreur s&apos;est produite
          </h1>
          <p style={{ fontSize: 14, color: "#4b5563", marginTop: 8 }}>
            L&apos;application a rencontré un problème inattendu. Vos données enregistrées sont
            conservées. Réessayez ou rechargez la page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              fontSize: 14,
              color: "#fff",
              background: "#3A5346",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
              Référence technique : {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
