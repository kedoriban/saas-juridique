"""
Analyse LLM locale des arrêts CCE/RVV — R-Phase 2.

Pipeline :
  1. Charger les critères actifs depuis Supabase (ou fichier local).
  2. Charger l'IntermediateDocument (cache disque → Supabase → fallback segments).
  3. Pour chaque groupe LLM, sélectionner les sections pertinentes.
  4. Appeler le LLM (≤ MAX_PASSAGE_CHARS par appel).
  5. Valider le JSON retourné.
  6. Stocker dans arret_criteria_values + model_runs.
  7. En cas d'erreur, retenter une fois puis marquer erreur.

Prérequis : migration 008 appliquée sur Supabase
  (colonnes source_authority, source_section, needs_human_review).

Usage :
  python analyze.py --arret-id <uuid>
  python analyze.py --arret-id <uuid> --dry-run
  python analyze.py --arret-id <uuid> --group identity
  python analyze.py --limit 3
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(dotenv_path=_ENV_PATH)

from llm_provider import get_provider, LLMResponse
from schemas import RESPONSE_SCHEMA, PROMPT_VERSION, validate_response, normalize_response, build_schema_for_group
from prompts import build_prompt, build_prompt_fulltext, select_sections
from build_intermediate import (
    IntermediateDocument, DocumentInfo, ExtractionQuality,
    MetadataDetected, ApplicantsDetection, SectionEntry,
)

MAX_RETRIES = 2

BOOL_TRUE  = {"oui", "true", "ja"}
BOOL_FALSE = {"non", "false", "nee"}

# Valeurs autorisées par la contrainte acv_source_authority_check
# Clé = variante LLM (uppercase), valeur = forme canonique attendue par Supabase
_NORMALIZE_SA: dict[str, str] = {
    "CCE": "CCE",
    "RVV": "RvV",
    "RVV.": "RvV",
    "CGRA": "CGRA",
    "CGRa": "CGRA",
    "DVZ": "DVZ",
    "OE": "OE",
}

# ---------------------------------------------------------------------------
# Fix 2 — Injection des métadonnées extraites par regex dans le groupe metadata
# ---------------------------------------------------------------------------

# Slug critère → champ IntermediateDocument.metadata_detected
_METADATA_SLUG_MAP: dict[str, str] = {
    # FR
    "date_de_l_arret":          "decision_date",
    "numero_de_l_arret":        "decision_number",
    "juge":                     "judge",
    "avocat_du_demandeur":      "lawyer",
    "chambres_fr_cce_ou_nl_cvv": "chambre",
    # NL
    "datum_van_het_arrest":     "decision_date",
    "nummer_van_het_arrest":    "decision_number",
    "rechter":                  "judge",
    "advocaat":                 "lawyer",
    "kamers_fr_cce_of_nl_rvv":  "chambre",
}


def _inject_regex_metadata(
    items: list[dict],
    criteria: list[dict],
    intermediate: IntermediateDocument,
    language: str = "fr",
    arret_numero: str = "",
) -> list[dict]:
    """
    Complète les items du groupe 'metadata' avec les valeurs extraites par regex
    (intermediate.metadata_detected) pour les critères où le LLM n'a rien trouvé.
    Pour decision_number et decision_date, le regex / le champ Supabase est toujours
    prioritaire sur le LLM (qui peut confondre le numéro avec des arrêts cités).
    """
    meta = intermediate.metadata_detected

    # Numéro canonique depuis le campo 'numero' Supabase (ex. "CCE 341963", "RvV 342046").
    # C'est la source la plus fiable — vient du scraper, pas du PDF.
    _canonical_number: str | None = None
    if arret_numero:
        m = re.search(r"(\d{5,7})", arret_numero)
        if m:
            _canonical_number = m.group(1)
    items_by_id: dict[str, dict] = {item["criterion_id"]: item for item in items}

    # Corriger les items où le LLM a trouvé une valeur mais a mis status=not_mentioned
    status_fixed = 0
    for item in items_by_id.values():
        val = item.get("value")
        if val and val not in ("null", "NULL", "") and item.get("status") == "not_mentioned":
            item["status"] = "found"
            if not item.get("source_authority"):
                item["source_authority"] = "RvV" if language == "nl" else "CCE"
            status_fixed += 1
    if status_fixed:
        print(f"    [STATUS] {status_fixed} statut(s) corrigé(s) not_mentioned→found")

    # Champs où le regex est plus fiable que le LLM : le LLM confond le numéro/la date
    # de l'arrêt examiné avec ceux d'autres arrêts cités dans le corps du texte.
    _ALWAYS_INJECT = {"decision_number", "decision_date"}

    injected = 0
    for c in criteria:
        field = _METADATA_SLUG_MAP.get(c.get("slug", ""))
        if not field:
            continue
        # Pour le numéro : priorité au campo Supabase (arret_numero) sur le regex PDF
        if field == "decision_number" and _canonical_number:
            value = _canonical_number
        else:
            value = getattr(meta, field, None) or getattr(intermediate.document, field, None)
        if not value:
            continue
        cid = c["id"]
        existing = items_by_id.get(cid)
        if existing and existing.get("status") == "found" and existing.get("value"):
            if field not in _ALWAYS_INJECT:
                continue  # LLM a déjà trouvé → ne pas écraser (sauf numéro/date)
        items_by_id[cid] = {
            "criterion_id":       cid,
            "value":              value,
            "confidence":         0.95,
            "evidence_excerpt":   value[:150],
            "source_authority":   "RvV" if language == "nl" else "CCE",
            "source_section":     "header",
            "needs_human_review": False,
            "status":             "found",
            "expected_value_type": c.get("expected_value_type"),
        }
        injected += 1

    if injected:
        print(f"    [REGEX] {injected} valeur(s) injectée(s) depuis metadata_detected")

    # Reconstituer dans l'ordre des critères
    result: list[dict] = []
    seen: set[str] = set()
    for c in criteria:
        cid = c["id"]
        if cid in items_by_id:
            result.append(items_by_id[cid])
            seen.add(cid)
    # Items LLM hors-critères attendus (ne devrait pas arriver avec guided_json)
    for item in items:
        if item.get("criterion_id") not in seen:
            result.append(item)
    return result

# ---------------------------------------------------------------------------
# Injection regex — groupe identity NL (Geboorteplaats)
# ---------------------------------------------------------------------------

# "geboren op [...]1976 in Jerevan" → capture la ville
_RE_GEBOREN_IN = re.compile(
    r"geboren\b[^.]{0,80}?\bin\s+([A-ZÀ-Ü][a-zA-Zà-ü\-]{2,30})",
    re.IGNORECASE,
)

# Slug partiel qui identifie le critère NL geboorteplaats (tronqué en base)
_GEBOORTEPLAATS_SLUG_PART = "geboorteplaats"


def _inject_regex_identity_nl(
    items: list[dict],
    criteria: list[dict],
    intermediate: IntermediateDocument,
) -> list[dict]:
    """
    Injecte Geboorteplaats (birthplace) par regex pour le groupe identity NL
    quand le LLM retourne not_mentioned ou laisse le critère vide.
    Pattern : "geboren [...] in <Ville>" dans le texte des sections.
    """
    # Trouver le critère geboorteplaats dans la liste
    birth_crit = next(
        (c for c in criteria if _GEBOORTEPLAATS_SLUG_PART in (c.get("slug") or "")),
        None,
    )
    if not birth_crit:
        return items

    cid = birth_crit["id"]
    items_by_id = {item["criterion_id"]: item for item in items}
    existing = items_by_id.get(cid)

    # N'injecter que si le LLM n'a rien trouvé (absent, vide, ou not_mentioned)
    if existing and existing.get("status") == "found" and existing.get("value"):
        return items

    # Concaténer tout le texte disponible
    full_text = "\n".join(sec.text for sec in intermediate.sections if sec.text)
    m = _RE_GEBOREN_IN.search(full_text)
    if not m:
        return items

    city = m.group(1).strip()
    items_by_id[cid] = {
        "criterion_id":        cid,
        "value":               city,
        "confidence":          0.90,
        "evidence_excerpt":    m.group(0)[:150],
        "source_authority":    "RvV",
        "source_section":      None,
        "needs_human_review":  False,
        "status":              "found",
        "expected_value_type": birth_crit.get("expected_value_type"),
    }
    print(f"    [REGEX] Geboorteplaats injectée : '{city}'")

    # Reconstituer dans l'ordre des critères
    result: list[dict] = []
    seen: set[str] = set()
    for c in criteria:
        c2 = c["id"]
        if c2 in items_by_id:
            result.append(items_by_id[c2])
            seen.add(c2)
    for item in items:
        if item.get("criterion_id") not in seen:
            result.append(item)
    return result


_INTERMEDIATE_DIR = Path(__file__).parent.parent / ".tmp" / "intermediate"


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
    res = (
        client.table("arrets")
        .select("id, numero, langue, pdf_url")
        .eq("id", arret_id)
        .maybe_single()
        .execute()
    )
    return res.data


def fetch_pending_analyze(client, limit: int) -> list[dict]:
    """Arrêts dont l'extraction est terminée mais l'analyse pas encore faite."""
    res = (
        client.table("arrets")
        .select("id, numero, langue, pdf_url")
        .eq("statut_traitement", "termine")
        .limit(limit * 2)  # marge : certains seront déjà analysés
        .execute()
    )
    arrets = res.data or []
    if not arrets:
        return []

    # Récupérer en une seule requête les IDs déjà analysés (évite N+1)
    arret_ids = [a["id"] for a in arrets]
    done_res = (
        client.table("arret_criteria_values")
        .select("arret_id")
        .in_("arret_id", arret_ids)
        .limit(len(arret_ids) * 10)
        .execute()
    )
    done_ids = {d["arret_id"] for d in (done_res.data or [])}
    return [a for a in arrets if a["id"] not in done_ids][:limit]


def fetch_segments(client, arret_id: str) -> list[dict]:
    res = (
        client.table("arret_segments")
        .select("section, text, quality_score, segment_index, authority, section_title, page_start, page_end")
        .eq("arret_id", arret_id)
        .order("segment_index")
        .execute()
    )
    return res.data or []


def fetch_criteria(client, language: str) -> list[dict]:
    res = (
        client.table("criteria")
        .select("id, label_original, expected_value_type, llm_group, section_slug, slug")
        .eq("language", language)
        .eq("active", True)
        .order("order_index")
        .execute()
    )
    return res.data or []


def load_criteria_from_file(language: str) -> list[dict]:
    path = Path(__file__).parent.parent / "data" / "criteria_canonical.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        c for c in data.get("criteria", [])
        if c.get("language") == language and c.get("active", True)
    ]


def store_model_run(
    client,
    arret_id: str,
    model: str,
    duration_ms: int,
    group: str,
    status: str,
    criteria_version: str = "",
    prompt_version: str = "",
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> str:
    res = client.table("model_runs").insert({
        "arret_id":                arret_id,
        "model_name":              model,
        "model_version":           model,
        "duration_ms":             duration_ms,
        "status":                  status,
        "prompt_tokens":           prompt_tokens,
        "completion_tokens":       completion_tokens,
        "criteria_schema_version": criteria_version or None,
        "analysis_prompt_version": prompt_version or None,
    }).execute()
    return res.data[0]["id"] if res.data else ""


def store_criteria_values(
    client,
    arret_id: str,
    items: list[dict],
    model_run_id: str,
) -> None:
    """Stocke les valeurs extraites en batch (1 requête au lieu de N)."""
    rows = []
    for item in items:
        if not item.get("criterion_id"):
            continue
        value_text = item.get("value")
        # Quand le LLM détermine explicitement que le critère n'est pas applicable,
        # stocker "N/A" pour que has_value() retourne True dans score_reference.py.
        if not value_text and item.get("status") == "not_applicable":
            value_text = "N/A"
        value_boolean = None
        if item.get("expected_value_type") == "boolean" and isinstance(value_text, str):
            token = value_text.strip().lower()
            if token in BOOL_TRUE:
                value_boolean, value_text = True, None
            elif token in BOOL_FALSE:
                value_boolean, value_text = False, None
        rows.append({
            "arret_id":           arret_id,
            "criterion_id":       item["criterion_id"],
            "value_text":         value_text,
            "value_boolean":      value_boolean,
            "confidence":         item.get("confidence"),
            "evidence_excerpt":   item.get("evidence_excerpt"),
            "model_run_id":       model_run_id,
            "source_authority":   _NORMALIZE_SA.get((item.get("source_authority") or "").strip().upper()),
            "source_section":     item.get("source_section"),
            "needs_human_review": item.get("needs_human_review", False),
        })
    if rows:
        # Dédupliquer par criterion_id : garder l'item avec la confiance la plus haute
        # (le LLM peut retourner plusieurs items pour le même critère, ex. multi-COI)
        seen: dict[str, dict] = {}
        for row in rows:
            cid = row["criterion_id"]
            if cid not in seen:
                seen[cid] = row
            else:
                prev_conf = seen[cid].get("confidence") or 0.0
                curr_conf = row.get("confidence") or 0.0
                if curr_conf >= prev_conf:
                    seen[cid] = row
        client.table("arret_criteria_values").upsert(list(seen.values()), on_conflict="arret_id,criterion_id").execute()


def store_processing_job(client, arret_id: str, status: str, error: str | None = None) -> None:
    client.table("processing_jobs").insert({
        "arret_id":      arret_id,
        "job_type":      "analyze",
        "status":        status,
        "error_message": error,
    }).execute()


# ---------------------------------------------------------------------------
# Chargement du document intermédiaire
# ---------------------------------------------------------------------------

def _segments_to_intermediate(
    segments: list[dict],
    language: str,
    pdf_url: str = "",
) -> IntermediateDocument:
    """
    Construit un IntermediateDocument minimal depuis des segments Supabase.
    Utilisé comme fallback quand intermediate_json est absent.
    """
    sections_dict: dict[str | None, SectionEntry] = {}
    seen_order: list[str | None] = []

    for seg in sorted(segments, key=lambda s: s.get("segment_index", 0)):
        sid = seg.get("section")
        if sid not in sections_dict:
            seen_order.append(sid)
            sections_dict[sid] = SectionEntry(
                section_id=sid,
                title_detected=seg.get("section_title"),
                start_page=seg.get("page_start"),
                end_page=seg.get("page_end"),
                authority=seg.get("authority") or "unknown",
                text=seg.get("text") or "",
            )
        else:
            entry = sections_dict[sid]
            extra = seg.get("text") or ""
            if extra:
                entry.text += "\n\n" + extra

    sections = [sections_dict[sid] for sid in seen_order]
    total_len = sum(len(s.text) for s in sections)

    return IntermediateDocument(
        document=DocumentInfo(
            pdf_url=pdf_url,
            decision_id=None,
            decision_number=None,
            language=language,
            language_confidence=1.0,
            procedure_type="unknown",
            procedure_confidence=0.0,
            requires_main_criteria=True,
            procedure_signals=[],
            decision_date=None,
        ),
        extraction_quality=ExtractionQuality(
            method="segments_fallback",
            pages_count=0,
            text_length=total_len,
            ocr_used=False,
            quality_score=0.0,
            requires_human_review=True,
            review_reasons=["Construit depuis arret_segments — pas de JSON intermédiaire"],
        ),
        metadata_detected=MetadataDetected(
            judge=None, lawyer=None, defendant=None,
            appeal_date=None, attacked_decision_date=None,
            extraction_notes=["fallback depuis arret_segments"],
        ),
        applicants_detection=ApplicantsDetection(
            is_multi_applicant=False,
            applicant_count=None,
            jonction=False,
            family_signals=False,
            detection_notes=[],
        ),
        applicants=[],
        sections=sections,
    )


def load_intermediate(
    arret_id: str,
    client,
    language: str,
    pdf_url: str = "",
) -> IntermediateDocument | None:
    """
    Charge l'IntermediateDocument dans cet ordre de priorité :
      1. Cache disque .tmp/intermediate/<arret_id>.json
      2. Supabase arrets.intermediate_json
      3. Fallback : reconstruction depuis arret_segments
    Retourne None si aucune source ne contient de données utilisables.
    """
    # 1. Cache disque
    cache_path = _INTERMEDIATE_DIR / f"{arret_id}.json"
    if cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            doc = IntermediateDocument.from_dict(data)
            print(f"  Interméd. : cache disque ({len(doc.sections)} sections)")
            return doc
        except Exception as exc:
            print(f"  [WARN] Cache intermédiaire corrompu : {exc}")

    # 2. Supabase intermediate_json
    try:
        res = (
            client.table("arrets")
            .select("intermediate_json")
            .eq("id", arret_id)
            .maybe_single()
            .execute()
        )
        raw = res.data and res.data.get("intermediate_json")
        if raw:
            doc = IntermediateDocument.from_dict(raw)
            print(f"  Interméd. : Supabase ({len(doc.sections)} sections)")
            return doc
    except Exception as exc:
        print(f"  [WARN] intermediate_json Supabase : {exc}")

    # 3. Fallback segments
    print(f"  Interméd. : pas de JSON → fallback segments")
    segments = fetch_segments(client, arret_id)
    if not segments:
        return None
    doc = _segments_to_intermediate(segments, language=language, pdf_url=pdf_url)
    print(f"  Interméd. : {len(doc.sections)} sections reconstruites depuis segments")
    return doc


# ---------------------------------------------------------------------------
# Analyse d'un groupe
# ---------------------------------------------------------------------------

def analyze_group(
    arret_id: str,
    language: str,
    criterion_version: str,
    group: str,
    criteria: list[dict],
    intermediate: IntermediateDocument,
    provider,
    dry_run: bool,
) -> tuple[list[dict], LLMResponse | None]:
    """
    Analyse un groupe de critères depuis l'IntermediateDocument.
    Retourne (items_validés, llm_response).
    """
    sections = select_sections(intermediate, group)
    if not sections:
        print(f"    [SKIP] Aucune section pour le groupe '{group}'")
        return [], None

    system_prompt, user_prompt = build_prompt(
        arret_id=arret_id,
        language=language,
        criterion_version=criterion_version,
        group=group,
        criteria=[{"id": c["id"], "label": c["label_original"], "type": c["expected_value_type"]} for c in criteria],
        sections=sections,
        procedure_type=intermediate.document.procedure_type,
    )
    prompt = (system_prompt, user_prompt)

    valid_ids  = {c["id"] for c in criteria}
    type_by_id = {c["id"]: c.get("expected_value_type") for c in criteria}
    # Schéma JSON avec criterion_id contraint à l'enum des IDs valides →
    # élimine les hallucinations d'ID avec guided_json (vLLM).
    group_schema = build_schema_for_group(list(valid_ids))
    last_response: LLMResponse | None = None

    for attempt in range(MAX_RETRIES + 1):
        response = provider.complete(prompt, json_schema=group_schema)
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

        items = normalized.get("items", [])
        for item in items:
            item["expected_value_type"] = type_by_id.get(item.get("criterion_id"))
        if normalized.get("warnings"):
            print(f"    [WARN] {'; '.join(normalized['warnings'])}")
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
    pdf_url: str = "",
) -> bool:
    print(f"\n[{numero}] Analyse LLM — langue={language}")

    # Charger l'IntermediateDocument
    intermediate = load_intermediate(arret_id, client, language=language, pdf_url=pdf_url)
    if not intermediate:
        print(f"  Aucune donnée disponible (extraction requise d'abord).")
        return False

    # Charger les critères
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
    all_responses: list[LLMResponse] = []
    total_duration_ms = 0

    for group, group_criteria in groups.items():
        print(f"  → Groupe '{group}' ({len(group_criteria)} critères)...")
        items, response = analyze_group(
            arret_id=arret_id,
            language=language,
            criterion_version=criterion_version,
            group=group,
            criteria=group_criteria,
            intermediate=intermediate,
            provider=provider,
            dry_run=dry_run,
        )

        if response:
            total_duration_ms += response.duration_ms
            all_responses.append(response)
            tok_info = ""
            if response.prompt_tokens:
                tok_info = f" | {response.prompt_tokens}+{response.completion_tokens}tok"
            status_label = "OK" if items else "ERREUR"
            print(f"     {status_label} — {len(items)} items — {response.duration_ms}ms{tok_info}")
        else:
            print(f"     SKIP (aucune section)")

        # Fix 2 : compléter les métadonnées avec les valeurs regex (date, numéro, juge, avocat)
        if group == "metadata":
            items = _inject_regex_metadata(
                items, group_criteria, intermediate,
                language=language, arret_numero=numero,
            )
        # Fix NL identity : Geboorteplaats souvent manqué par le LLM (non-déterministe)
        elif group == "identity" and language == "nl":
            items = _inject_regex_identity_nl(items, group_criteria, intermediate)

        all_items.extend(items)

    total_prompt_tokens = sum(r.prompt_tokens or 0 for r in all_responses) or None
    total_completion_tokens = sum(r.completion_tokens or 0 for r in all_responses) or None
    print(f"  Total : {len(all_items)} valeurs extraites en {total_duration_ms}ms"
          + (f" | tokens: {total_prompt_tokens}+{total_completion_tokens}" if total_prompt_tokens else ""))

    if dry_run:
        print("  → dry-run, rien stocké.")
        for item in all_items:
            flag = " ⚠" if item.get("needs_human_review") else ""
            print(
                f"    {item['criterion_id']}: {item.get('value')!r} "
                f"(status={item.get('status')}, conf={item.get('confidence')}, "
                f"auth={item.get('source_authority')}{flag})"
            )
        return True

    model_name = provider.model if hasattr(provider, "model") else "unknown"
    model_run_id = store_model_run(
        client,
        arret_id=arret_id,
        model=model_name,
        duration_ms=total_duration_ms,
        group=target_group or "all",
        status="done" if all_items else "error",
        criteria_version=criterion_version,
        prompt_version=PROMPT_VERSION,
        prompt_tokens=total_prompt_tokens,
        completion_tokens=total_completion_tokens,
    )

    if all_items:
        store_criteria_values(client, arret_id=arret_id, items=all_items, model_run_id=model_run_id)

    store_processing_job(client, arret_id=arret_id, status="done" if all_items else "error")
    print(f"  → Stocké ({len(all_items)} valeurs, model_run={model_run_id[:8]}...)")
    return bool(all_items)


# ---------------------------------------------------------------------------
# R-Phase 12 — Analyse fulltext (1 appel LLM, tout le texte, tous les critères)
# ---------------------------------------------------------------------------

def analyze_arret_fulltext(
    arret_id: str,
    numero: str,
    language: str,
    client,
    provider,
    dry_run: bool,
    pdf_url: str = "",
) -> bool:
    """Analyse un arrêt avec l'approche fulltext (R-Phase 12) : 1 seul appel LLM."""
    print(f"\n[{numero}] Analyse fulltext — langue={language}")

    intermediate = load_intermediate(arret_id, client, language=language, pdf_url=pdf_url)
    if not intermediate:
        print("  Aucune donnée disponible (extraction requise d'abord).")
        return False

    try:
        criteria_all = fetch_criteria(client, language)
    except Exception:
        criteria_all = load_criteria_from_file(language)

    if not criteria_all:
        print(f"  Aucun critère actif pour langue='{language}'.")
        return False

    criterion_version = criteria_all[0].get("version", "client_excel_v1")
    procedure_type = intermediate.document.procedure_type

    # Lire la limite de chars depuis l'env (60000 pour Mixtral, 8000 pour Ollama local)
    max_chars = int(os.environ.get("LLM_MAX_INPUT_CHARS", "60000"))

    system_prompt, user_prompt = build_prompt_fulltext(
        arret_id=arret_id,
        language=language,
        criteria_all=criteria_all,
        intermediate=intermediate,
        procedure_type=procedure_type,
        max_chars=max_chars,
    )

    valid_ids  = {c["id"] for c in criteria_all}
    type_by_id = {c["id"]: c.get("expected_value_type") for c in criteria_all}
    group_schema = build_schema_for_group(list(valid_ids))
    print(f"  → {len(criteria_all)} critères, {len(intermediate.sections)} sections, "
          f"max_chars={max_chars}")

    items: list[dict] = []
    last_response: LLMResponse | None = None

    for attempt in range(MAX_RETRIES + 1):
        # guided_json désactivé + prefilling pour Mixtral (retourne sinon 1 seul item)
        # max_tokens=5500 : budget output fulltext > budget 7-groupes (input ~10k → ~5.5k dispo)
        response = provider.complete(
            (system_prompt, user_prompt), json_schema=None,
            prefill='{"items": [', max_tokens=5500,
        )
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
            group="fulltext",
        )
        errors = validate_response(normalized, group="fulltext", language=language, valid_ids=valid_ids)
        if errors:
            print(f"    [ERR] Tentative {attempt+1} — Validation: {'; '.join(errors)}")
            continue

        items = normalized.get("items", [])
        for item in items:
            item["expected_value_type"] = type_by_id.get(item.get("criterion_id"))
        if normalized.get("warnings"):
            print(f"    [WARN] {'; '.join(normalized['warnings'])}")
        break

    dur_ms = last_response.duration_ms if last_response else 0
    tok_info = ""
    if last_response and last_response.prompt_tokens:
        tok_info = f" | {last_response.prompt_tokens}+{last_response.completion_tokens}tok"
    print(f"  → {len(items)} items — {dur_ms}ms{tok_info}")

    # Injections regex (identiques au mode 7-groupes)
    metadata_criteria = [c for c in criteria_all if c.get("llm_group") == "metadata"]
    items = _inject_regex_metadata(
        items, metadata_criteria, intermediate, language=language, arret_numero=numero,
    )
    if language == "nl":
        identity_criteria = [c for c in criteria_all if c.get("llm_group") == "identity"]
        items = _inject_regex_identity_nl(items, identity_criteria, intermediate)

    if dry_run:
        print("  → dry-run, rien stocké.")
        for item in items:
            flag = " ⚠" if item.get("needs_human_review") else ""
            print(
                f"    {item['criterion_id']}: {item.get('value')!r} "
                f"(status={item.get('status')}, conf={item.get('confidence')}, "
                f"auth={item.get('source_authority')}{flag})"
            )
        return True

    model_name = provider.model if hasattr(provider, "model") else "unknown"
    model_run_id = store_model_run(
        client,
        arret_id=arret_id,
        model=model_name,
        duration_ms=dur_ms,
        group="fulltext",
        status="done" if items else "error",
        criteria_version=criterion_version,
        prompt_version=PROMPT_VERSION,
        prompt_tokens=last_response.prompt_tokens if last_response else None,
        completion_tokens=last_response.completion_tokens if last_response else None,
    )

    if items:
        store_criteria_values(client, arret_id=arret_id, items=items, model_run_id=model_run_id)

    store_processing_job(client, arret_id=arret_id, status="done" if items else "error")
    print(f"  → Stocké ({len(items)} valeurs, model_run={model_run_id[:8]}...)")
    return bool(items)


# ---------------------------------------------------------------------------
# Points d'entrée CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse LLM locale CCE/RVV — R-Phase 2")
    parser.add_argument("--arret-id",  help="UUID d'un arrêt spécifique")
    parser.add_argument("--group",     help="Analyser uniquement ce groupe LLM (ex: identity). Ignoré si --fulltext.")
    parser.add_argument("--limit",     type=int, default=3, help="Nb max d'arrêts en batch (défaut: 3)")
    parser.add_argument("--concurrency", type=int, default=1,
                        help="Nb d'arrêts traités en parallèle (défaut: 1). "
                             "Monter à 16-32 avec un serveur vLLM.")
    parser.add_argument("--dry-run",   action="store_true", help="Affiche sans écrire en base")
    parser.add_argument("--fulltext",  action="store_true",
                        help="R-Phase 12 : 1 seul appel LLM, texte complet + tous les critères "
                             "(Mixtral 8x22B). Ne modifie pas l'ancienne logique 7-groupes.")
    args = parser.parse_args()

    client = _get_supabase()
    provider = get_provider()
    print(f"Provider : {type(provider).__name__} | Modèle : {getattr(provider, 'model', '?')}")
    print(f"Prompt version : {PROMPT_VERSION}")

    if args.arret_id:
        arret = fetch_arret(client, args.arret_id)
        if not arret:
            sys.exit(f"Arrêt '{args.arret_id}' introuvable.")
        if args.fulltext:
            analyze_arret_fulltext(
                arret_id=arret["id"],
                numero=arret.get("numero", arret["id"]),
                language=arret["langue"],
                client=client,
                provider=provider,
                dry_run=args.dry_run,
                pdf_url=arret.get("pdf_url", ""),
            )
        else:
            analyze_arret(
                arret_id=arret["id"],
                numero=arret.get("numero", arret["id"]),
                language=arret["langue"],
                client=client,
                provider=provider,
                dry_run=args.dry_run,
                target_group=args.group,
                pdf_url=arret.get("pdf_url", ""),
            )
    else:
        arrets = fetch_pending_analyze(client, args.limit)
        if not arrets:
            print("Aucun arrêt prêt pour analyse (statut=termine sans valeurs).")
            return
        print(f"{len(arrets)} arrêt(s) à analyser (limite={args.limit}, "
              f"concurrence={args.concurrency}, dry_run={args.dry_run}, "
              f"fulltext={args.fulltext})")

        def _run_one(a: dict, task_client) -> bool:
            if args.fulltext:
                return analyze_arret_fulltext(
                    arret_id=a["id"],
                    numero=a.get("numero", a["id"]),
                    language=a["langue"],
                    client=task_client,
                    provider=provider,
                    dry_run=args.dry_run,
                    pdf_url=a.get("pdf_url", ""),
                )
            return analyze_arret(
                arret_id=a["id"],
                numero=a.get("numero", a["id"]),
                language=a["langue"],
                client=task_client,
                provider=provider,
                dry_run=args.dry_run,
                target_group=args.group,
                pdf_url=a.get("pdf_url", ""),
            )

        ok = 0
        if args.concurrency <= 1:
            for a in arrets:
                if _run_one(a, client):
                    ok += 1
        else:
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
