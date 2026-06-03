"""
Analyse LLM locale des arrêts CCE/RVV — Phase 5.

Pipeline :
  1. Charger les critères actifs depuis Supabase (ou fichier local).
  2. Charger les segments de l'arrêt.
  3. Pour chaque groupe LLM, sélectionner les passages candidats.
  4. Appeler le LLM (≤ MAX_PASSAGE_CHARS par appel).
  5. Valider le JSON retourné.
  6. Stocker dans arret_criteria_values + model_runs.
  7. En cas d'erreur, retenter une fois puis marquer erreur.

Usage :
  python analyze.py --arret-id <uuid>
  python analyze.py --arret-id <uuid> --dry-run
  python analyze.py --arret-id <uuid> --group identity
  python analyze.py --limit 3

Contraintes :
  - Jamais plus de MAX_PASSAGE_CHARS par appel LLM.
  - Modèle petit quantifié uniquement.
  - Pas de traitement massif (--limit défaut = 3).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(dotenv_path=_ENV_PATH)

from llm_provider import get_provider, LLMResponse
from schemas import RESPONSE_SCHEMA, validate_response, normalize_response
from prompts import build_prompt, select_passages

MAX_RETRIES = 2  # 2 retries après échec = 3 tentatives max par groupe

# Valeurs textuelles converties en value_boolean pour les critères de type 'boolean'
BOOL_TRUE = {"oui", "true", "ja"}
BOOL_FALSE = {"non", "false", "nee"}


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _get_supabase():
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("ERREUR : variables Supabase manquantes dans .env.local")
    return create_client(url, key)


def fetch_arret(client, arret_id: str) -> dict | None:
    res = client.table("arrets").select("id, numero, langue").eq("id", arret_id).maybe_single().execute()
    return res.data


def fetch_pending_analyze(client, limit: int) -> list[dict]:
    """Arrêts dont l'extraction est terminée mais l'analyse pas encore faite."""
    res = (
        client.table("arrets")
        .select("id, numero, langue")
        .eq("statut_traitement", "termine")
        .limit(limit)
        .execute()
    )
    arrets = res.data or []
    # Exclure ceux qui ont déjà des valeurs extraites
    result = []
    for a in arrets:
        check = (
            client.table("arret_criteria_values")
            .select("id")
            .eq("arret_id", a["id"])
            .limit(1)
            .execute()
        )
        if not check.data:
            result.append(a)
    return result


def fetch_segments(client, arret_id: str) -> list[dict]:
    res = (
        client.table("arret_segments")
        .select("section, text, quality_score, segment_index")
        .eq("arret_id", arret_id)
        .order("segment_index")
        .execute()
    )
    return res.data or []


def fetch_criteria(client, language: str) -> list[dict]:
    """Charge les critères actifs pour la langue donnée."""
    res = (
        client.table("criteria")
        .select("id, label_original, expected_value_type, llm_group, section_slug")
        .eq("language", language)
        .eq("active", True)
        .order("order_index")
        .execute()
    )
    return res.data or []


def load_criteria_from_file(language: str) -> list[dict]:
    """Fallback : charge depuis data/criteria_canonical.json."""
    path = Path(__file__).parent.parent / "data" / "criteria_canonical.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        c for c in data.get("criteria", [])
        if c.get("language") == language and c.get("active", True)
    ]


def store_model_run(client, arret_id: str, model: str, duration_ms: int, group: str, status: str) -> str:
    res = client.table("model_runs").insert({
        "arret_id":      arret_id,
        "model_name":    model,
        "model_version": model,
        "duration_ms":   duration_ms,
        "status":        status,
        "prompt_tokens": None,
        "completion_tokens": None,
    }).execute()
    return res.data[0]["id"] if res.data else ""


def store_criteria_values(client, arret_id: str, items: list[dict], model_run_id: str) -> None:
    for item in items:
        if not item.get("criterion_id"):
            continue
        value_text = item.get("value")
        value_boolean = None
        if item.get("expected_value_type") == "boolean" and isinstance(value_text, str):
            token = value_text.strip().lower()
            if token in BOOL_TRUE:
                value_boolean, value_text = True, None
            elif token in BOOL_FALSE:
                value_boolean, value_text = False, None
        row = {
            "arret_id":        arret_id,
            "criterion_id":    item["criterion_id"],
            "value_text":      value_text,
            "value_boolean":   value_boolean,
            "confidence":      item.get("confidence"),
            "evidence_excerpt": item.get("evidence_excerpt"),
            "model_run_id":    model_run_id,
        }
        client.table("arret_criteria_values").upsert(row, on_conflict="arret_id,criterion_id").execute()


def store_processing_job(client, arret_id: str, status: str, error: str | None = None) -> None:
    client.table("processing_jobs").insert({
        "arret_id":      arret_id,
        "job_type":      "analyze",
        "status":        status,
        "error_message": error,
    }).execute()


# ---------------------------------------------------------------------------
# Analyse d'un groupe
# ---------------------------------------------------------------------------

def analyze_group(
    arret_id: str,
    language: str,
    criterion_version: str,
    group: str,
    criteria: list[dict],
    segments: list[dict],
    provider,
    dry_run: bool,
) -> tuple[list[dict], LLMResponse | None]:
    """
    Analyse un groupe de critères. Retourne (items_validés, llm_response).
    Tente MAX_RETRIES+1 fois en cas d'erreur JSON ou de validation.
    """
    passages = select_passages(segments, group)
    if not passages:
        print(f"    [SKIP] Aucun passage pour le groupe '{group}'")
        return [], None

    system_prompt, user_prompt = build_prompt(
        arret_id=arret_id,
        language=language,
        criterion_version=criterion_version,
        group=group,
        criteria=[{"id": c["id"], "label": c["label_original"], "type": c["expected_value_type"]} for c in criteria],
        passages=passages,
    )
    prompt = (system_prompt, user_prompt)

    valid_ids = {c["id"] for c in criteria}
    type_by_id = {c["id"]: c.get("expected_value_type") for c in criteria}
    last_response: LLMResponse | None = None

    for attempt in range(MAX_RETRIES + 1):
        response = provider.complete(prompt, json_schema=RESPONSE_SCHEMA)
        last_response = response

        if response.error and not response.parsed:
            print(f"    [ERR] Tentative {attempt+1} — LLM error: {response.error}")
            continue

        if response.parsed is None:
            print(f"    [ERR] Tentative {attempt+1} — JSON non parseable")
            continue

        normalized = normalize_response(
            response.parsed,
            arret_id=arret_id,
            language=language,
            criterion_version=criterion_version,
            group=group,
        )
        errors = validate_response(normalized, group=group, language=language, valid_ids=valid_ids)
        if errors:
            print(f"    [ERR] Tentative {attempt+1} — Validation: {'; '.join(errors)}")
            continue

        # Succès
        items = normalized.get("items", [])
        for item in items:
            item["expected_value_type"] = type_by_id.get(item.get("criterion_id"))
        if normalized.get("warnings"):
            print(f"    [WARN] {'; '.join(response.parsed['warnings'])}")
        return items, response

    return [], last_response


# ---------------------------------------------------------------------------
# Analyse complète d'un arrêt
# ---------------------------------------------------------------------------

def analyze_arret(
    arret_id: str,
    numero: str,
    language: str,
    client,
    provider,
    dry_run: bool,
    target_group: str | None = None,
) -> bool:
    print(f"\n[{numero}] Analyse LLM — langue={language}")

    segments = fetch_segments(client, arret_id)
    if not segments:
        print(f"  Aucun segment trouvé pour cet arrêt (extraction requise d'abord).")
        return False

    print(f"  Segments chargés : {len(segments)}")

    # Charger les critères (Supabase d'abord, fallback fichier)
    try:
        criteria_all = fetch_criteria(client, language)
    except Exception:
        criteria_all = load_criteria_from_file(language)

    if not criteria_all:
        print(f"  Aucun critère actif pour langue='{language}'.")
        return False

    criterion_version = criteria_all[0].get("version", "client_excel_v1") if criteria_all else "client_excel_v1"

    # Regrouper par llm_group
    groups: dict[str, list[dict]] = {}
    for c in criteria_all:
        g = c.get("llm_group") or "general"
        groups.setdefault(g, []).append(c)

    if target_group:
        groups = {k: v for k, v in groups.items() if k == target_group}
        if not groups:
            print(f"  Groupe '{target_group}' inconnu ou sans critères pour langue='{language}'.")
            return False

    all_items: list[dict] = []
    total_duration_ms = 0
    success = True

    for group, group_criteria in groups.items():
        print(f"  → Groupe '{group}' ({len(group_criteria)} critères)...")
        items, response = analyze_group(
            arret_id=arret_id,
            language=language,
            criterion_version=criterion_version,
            group=group,
            criteria=group_criteria,
            segments=segments,
            provider=provider,
            dry_run=dry_run,
        )

        if response:
            total_duration_ms += response.duration_ms
            status_label = "OK" if items else "ERREUR"
            print(f"     {status_label} — {len(items)} items — {response.duration_ms}ms")
        else:
            print(f"     SKIP (aucun passage)")

        all_items.extend(items)

    print(f"  Total : {len(all_items)} valeurs extraites en {total_duration_ms}ms")

    if dry_run:
        print("  → dry-run, rien stocké.")
        for item in all_items:
            print(f"    {item['criterion_id']}: {item.get('value')!r} (conf={item.get('confidence')})")
        return True

    # Stocker model_run
    model_run_id = store_model_run(
        client,
        arret_id=arret_id,
        model=provider.model if hasattr(provider, "model") else "unknown",
        duration_ms=total_duration_ms,
        group=target_group or "all",
        status="done" if all_items else "error",
    )

    # Stocker les valeurs
    if all_items:
        store_criteria_values(client, arret_id=arret_id, items=all_items, model_run_id=model_run_id)

    store_processing_job(client, arret_id=arret_id, status="done" if all_items else "error")
    print(f"  → Stocké ({len(all_items)} valeurs, model_run={model_run_id[:8]}...)")
    return bool(all_items)


# ---------------------------------------------------------------------------
# Points d'entrée CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse LLM locale CCE/RVV — Phase 5")
    parser.add_argument("--arret-id", help="UUID d'un arrêt spécifique")
    parser.add_argument("--group",    help="Analyser uniquement ce groupe LLM (ex: identity)")
    parser.add_argument("--limit",    type=int, default=3, help="Nb max d'arrêts en batch (défaut: 3)")
    parser.add_argument("--concurrency", type=int, default=1,
                        help="Nb d'arrêts traités en parallèle (défaut: 1 = séquentiel). "
                             "Monter à 16-32 avec un serveur vLLM pour exploiter le batching.")
    parser.add_argument("--dry-run",  action="store_true", help="Affiche sans écrire en base")
    args = parser.parse_args()

    client = _get_supabase()
    provider = get_provider()
    print(f"Provider : {type(provider).__name__} | Modèle : {getattr(provider, 'model', '?')}")

    if args.arret_id:
        arret = fetch_arret(client, args.arret_id)
        if not arret:
            sys.exit(f"Arrêt '{args.arret_id}' introuvable.")
        analyze_arret(
            arret_id=arret["id"],
            numero=arret.get("numero", arret["id"]),
            language=arret["langue"],
            client=client,
            provider=provider,
            dry_run=args.dry_run,
            target_group=args.group,
        )
    else:
        arrets = fetch_pending_analyze(client, args.limit)
        if not arrets:
            print("Aucun arrêt prêt pour analyse (statut=termine sans valeurs).")
            return
        print(f"{len(arrets)} arrêt(s) à analyser (limite={args.limit}, "
              f"concurrence={args.concurrency}, dry_run={args.dry_run})")

        def _run_one(a: dict, task_client) -> bool:
            return analyze_arret(
                arret_id=a["id"],
                numero=a.get("numero", a["id"]),
                language=a["langue"],
                client=task_client,
                provider=provider,
                dry_run=args.dry_run,
                target_group=args.group,
            )

        ok = 0
        if args.concurrency <= 1:
            for a in arrets:
                if _run_one(a, client):
                    ok += 1
        else:
            # Un client Supabase par thread (postgrest-py n'est pas thread-safe) ;
            # le provider est sans état, partageable. NB : les logs s'entrelacent
            # à forte concurrence — utiliser --arret-id pour un suivi qualité ligne à ligne.
            with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
                futures = {executor.submit(_run_one, a, _get_supabase()): a for a in arrets}
                for future in as_completed(futures):
                    a = futures[future]
                    try:
                        if future.result():
                            ok += 1
                    except Exception as exc:  # noqa: BLE001
                        print(f"[{a.get('numero', a['id'])}] EXCEPTION : {exc}")
        print(f"\nRésumé : {ok}/{len(arrets)} arrêts analysés avec succès.")


if __name__ == "__main__":
    main()
