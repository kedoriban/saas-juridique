// Helpers CSV partagés par les routes d'export de validation.
// - Échappement RFC 4180 (guillemets, virgules, retours ligne).
// - BOM UTF-8 en tête : indispensable pour qu'Excel (Windows/FR) lise les accents.
// - Séparateur de lignes CRLF : compatibilité Excel maximale.

const BOM = "﻿";

export function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

/** Construit un CSV complet (BOM + en-tête + lignes), chaque cellule échappée. */
export function buildCsv(header: string[], rows: unknown[][]): string {
  const body = [header, ...rows]
    .map((cells) => cells.map(escapeCsv).join(","))
    .join("\r\n");
  return BOM + body;
}
