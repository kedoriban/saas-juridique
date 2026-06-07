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
import time
from pathlib import Path

from dotenv import load_dotenv

# Charger .env.local depuis la racine du projet (un niveau au-dessus de worker/)
_ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(dotenv_path=_ENV_PATH)

from extract import extract_from_url, ExtractionResult
from clean import clean_and_segment, Segment
from build_intermediate import build_intermediate, IntermediateDocument


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
# Cache disque des JSON intermédiaires
# ---------------------------------------------------------------------------

_INTERMEDIATE_DIR = Path(__file__).parent.parent / ".tmp" / "intermediate"


def _save_intermediate(doc: IntermediateDocument, arret_id: str) -> Path:
    """Sauvegarde le JSON intermédiaire dans .tmp/intermediate/<arret_id>.json."""
    _INTERMEDIATE_DIR.mkdir(parents=True, exist_ok=True)
    path = _INTERMEDIATE_DIR / f"{arret_id}.json"
    doc.save(path)
    return path


# ---------------------------------------------------------------------------
# Opérations Supabase
# ---------------------------------------------------------------------------

def fetch_pending(client, limit: int, reprocess: bool = False) -> list[dict]:
    statuts = ["termine", "erreur"] if reprocess else ["en_attente"]
    res = (
        client.table("arrets")
        .select("id, numero, pdf_url, langue")
        .in_("statut_traitement", statuts)
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
            "authority":     s.authority,
            "section_title": s.section_title,
        }
        for s in segments
    ]
    client.table("arret_segments").insert(rows).execute()


def store_intermediate_data(
    client,
    arret_id: str,
    intermediate: IntermediateDocument,
) -> None:
    """Met à jour la ligne arrets avec les données du JSON intermédiaire."""
    doc = intermediate.document
    client.table("arrets").update({
        "procedure_type":    doc.procedure_type,
        "language_detected": doc.language,
        "intermediate_json": intermediate.to_dict(),
    }).eq("id", arret_id).execute()


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
        print(f"    [{section_label:30s}] auth={s.authority:8s}  p{s.page_start}-{s.page_end}  {s.char_count} car.")

    # Construire le JSON intermédiaire (détection langue / procédure / métadonnées)
    intermediate = build_intermediate(pdf_url, result, segments)
    doc = intermediate.document
    q = intermediate.extraction_quality
    print(f"  Langue    : {doc.language} ({doc.language_confidence:.0%})")
    print(f"  Procédure : {doc.procedure_type} ({doc.procedure_confidence:.0%})")
    print(f"  Décision  : {doc.decision_id or '?'}  |  {doc.decision_date or '?'}")
    if q.requires_human_review:
        print(f"  ⚠ Revue humaine : {'; '.join(q.review_reasons)}")

    # Sauvegarder le JSON intermédiaire sur disque (cache local)
    cache_path = _save_intermediate(intermediate, arret_id)
    print(f"  Interméd. : {cache_path}")

    if not dry_run:
        import httpx

        def _do_stores(c) -> None:
            store_extraction(c, arret_id, result)
            store_segments(c, arret_id, segments)
            store_intermediate_data(c, arret_id, intermediate)
            mark_done(c, arret_id, success=True)

        try:
            _do_stores(client)
        except (httpx.WriteError, httpx.ReadError, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
            print(f"  [réseau] {exc.__class__.__name__} — reconnexion et retry…")
            time.sleep(1.5)
            _do_stores(_get_supabase_client())
        print(f"  -> OK (stocké)")
    else:
        print(f"  -> OK (dry-run, rien stocké)")

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


def run_batch(limit: int, dry_run: bool, reprocess: bool = False) -> None:
    client = _get_supabase_client()
    arrets = fetch_pending(client, limit, reprocess=reprocess)
    if not arrets:
        label = "en attente" if not reprocess else "à retraiter (termine/erreur)"
        print(f"Aucun arrêt {label}.")
        return
    print(f"{len(arrets)} arrêt(s) à traiter (limite={limit}, dry_run={dry_run}, reprocess={reprocess})")
    ok = 0
    for arret in arrets:
        # Nouvelle connexion par arrêt : évite les Broken pipe sur connexion HTTP/2 idle
        client = _get_supabase_client()
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
    parser.add_argument("--url",        help="URL d'un PDF public à tester (mode test manuel)")
    parser.add_argument("--limit",      type=int, default=5, help="Nb max d'arrêts à traiter (défaut : 5)")
    parser.add_argument("--dry-run",    action="store_true", help="Extraction sans écriture en base")
    parser.add_argument("--reprocess",  action="store_true",
                        help="Retraiter les arrêts déjà extraits (statut=termine/erreur) "
                             "pour regénérer leur intermediate_json avec les regex améliorées")
    args = parser.parse_args()

    if args.url:
        run_single_url(args.url, dry_run=True)
    else:
        run_batch(limit=args.limit, dry_run=args.dry_run, reprocess=args.reprocess)


if __name__ == "__main__":
    main()
