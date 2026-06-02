"""
Worker local d'extraction PDF — Phase 4.

Usage :
  # Traiter un seul arrêt par URL (mode test)
  python main.py --url https://www.cce-rvv.be/.../.../a260001.fr.pdf

  # Traiter jusqu'à N arrêts 'en_attente' depuis Supabase (défaut : 5)
  python main.py --limit 5

  # Dry-run : extraction sans écriture en base
  python main.py --url https://... --dry-run

Contraintes respectées :
  - Aucun stockage durable de PDF.
  - Aucun appel LLM.
  - Pas de traitement massif (limite configurable, défaut 5).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Charger .env.local depuis la racine du projet (un niveau au-dessus de worker/)
_ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(dotenv_path=_ENV_PATH)

from extract import extract_from_url, ExtractionResult
from clean import clean_and_segment, Segment


def _get_supabase_client():
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit(
            "ERREUR : variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY "
            "manquantes. Vérifier .env.local à la racine du projet."
        )
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Opérations Supabase
# ---------------------------------------------------------------------------

def fetch_pending(client, limit: int) -> list[dict]:
    res = (
        client.table("arrets")
        .select("id, numero, pdf_url, langue")
        .eq("statut_traitement", "en_attente")
        .limit(limit)
        .execute()
    )
    return res.data or []


def mark_in_progress(client, arret_id: str) -> None:
    client.table("arrets").update({"statut_traitement": "en_cours"}).eq("id", arret_id).execute()


def store_extraction(client, arret_id: str, result: ExtractionResult) -> None:
    client.table("arret_extractions").upsert({
        "arret_id":           arret_id,
        "extraction_method":  result.method,
        "page_count":         result.page_count,
        "char_count":         result.char_count,
        "is_scanned":         result.is_scanned,
        "text_hash":          result.text_hash,
        "error_message":      result.error_message,
    }, on_conflict="arret_id").execute()


def store_segments(client, arret_id: str, segments: list[Segment]) -> None:
    # Supprimer les anciens segments avant réinsertion
    client.table("arret_segments").delete().eq("arret_id", arret_id).execute()
    if not segments:
        return
    rows = [
        {
            "arret_id":      arret_id,
            "segment_index": s.segment_index,
            "section":       s.section,
            "text":          s.text,
            "page_start":    s.page_start,
            "page_end":      s.page_end,
            "quality_score": s.quality_score,
        }
        for s in segments
    ]
    client.table("arret_segments").insert(rows).execute()


def mark_done(client, arret_id: str, success: bool, error: str | None = None) -> None:
    status = "termine" if success else "erreur"
    client.table("arrets").update({"statut_traitement": status}).eq("id", arret_id).execute()
    client.table("processing_jobs").insert({
        "arret_id":      arret_id,
        "job_type":      "extract_text",
        "status":        "done" if success else "error",
        "error_message": error,
    }).execute()


# ---------------------------------------------------------------------------
# Traitement d'un seul arrêt
# ---------------------------------------------------------------------------

def process_arret(
    arret_id: str,
    pdf_url: str,
    numero: str,
    client,
    dry_run: bool,
) -> bool:
    print(f"\n[{numero}] Extraction -> {pdf_url}")

    if not dry_run:
        mark_in_progress(client, arret_id)

    result = extract_from_url(pdf_url)

    print(f"  Méthode   : {result.method}")
    print(f"  Pages     : {result.page_count}")
    print(f"  Caractères: {result.char_count}")
    print(f"  Scanné    : {result.is_scanned}")
    if result.error_message:
        print(f"  Erreur    : {result.error_message}")

    if result.method == "failed" or result.char_count < 200:
        if not dry_run:
            store_extraction(client, arret_id, result)
            mark_done(client, arret_id, success=False, error=result.error_message)
        print(f"  -> ECHEC")
        return False

    segments = clean_and_segment(result.pages)
    print(f"  Segments  : {len(segments)}")
    for s in segments:
        section_label = s.section or "?"
        print(f"    [{section_label:20s}] p{s.page_start}-{s.page_end}  {s.char_count} car.  score={s.quality_score}")

    if not dry_run:
        store_extraction(client, arret_id, result)
        store_segments(client, arret_id, segments)
        mark_done(client, arret_id, success=True)
        print(f"  -> OK (stocke)")
    else:
        print(f"  -> OK (dry-run, rien stocke)")

    return True


# ---------------------------------------------------------------------------
# Points d'entrée
# ---------------------------------------------------------------------------

def run_single_url(url: str, dry_run: bool) -> None:
    client = _get_supabase_client()
    process_arret(
        arret_id="00000000-0000-0000-0000-000000000000",
        pdf_url=url,
        numero="test-manuel",
        client=client,
        dry_run=True,  # URL manuelle = toujours dry-run (pas d'arret_id réel)
    )


def run_batch(limit: int, dry_run: bool) -> None:
    client = _get_supabase_client()
    arrets = fetch_pending(client, limit)
    if not arrets:
        print("Aucun arrêt en attente.")
        return
    print(f"{len(arrets)} arrêt(s) à traiter (limite={limit}, dry_run={dry_run})")
    ok = 0
    for arret in arrets:
        success = process_arret(
            arret_id=arret["id"],
            pdf_url=arret.get("pdf_url") or "",
            numero=arret.get("numero") or arret["id"],
            client=client,
            dry_run=dry_run,
        )
        if success:
            ok += 1
    print(f"\nRésumé : {ok}/{len(arrets)} arrêts extraits avec succès.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Worker local d'extraction PDF CCE/RVV")
    parser.add_argument("--url",      help="URL d'un PDF public à tester (mode test manuel)")
    parser.add_argument("--limit",    type=int, default=5, help="Nb max d'arrêts à traiter (défaut : 5)")
    parser.add_argument("--dry-run",  action="store_true", help="Extraction sans écriture en base")
    args = parser.parse_args()

    if args.url:
        run_single_url(args.url, dry_run=True)
    else:
        run_batch(limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
