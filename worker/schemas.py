"""
JSON Schema strict pour les réponses LLM — R-Phase 2.

Statuts canoniques (7) :
  found           = information clairement présente dans le texte
  not_mentioned   = information absente des passages fournis
  not_applicable  = critère ne s'applique pas à ce type de procédure
  ambiguous       = information présente mais contradictoire ou floue
  inferred        = information déduite indirectement, non citée explicitement
  conflicting     = informations contradictoires entre sections
  error           = impossible d'analyser ce critère (texte illisible, etc.)
"""

from __future__ import annotations

import json
from typing import Any

import jsonschema

PROMPT_VERSION = "intermediate-v1"

# Schéma JSON attendu en sortie du LLM
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["items"],
    "properties": {
        "arret_id":          {"type": "string"},
        "language":          {"type": "string"},
        "criterion_version": {"type": "string"},
        "group":             {"type": "string"},
        "warnings":          {"type": "array", "items": {"type": "string"}},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["criterion_id", "status"],
                "properties": {
                    "criterion_id":      {"type": "string"},
                    "value":             {"type": ["string", "null"]},
                    "confidence":        {"type": ["number", "null"], "minimum": 0.0, "maximum": 1.0},
                    "evidence_excerpt":  {"type": ["string", "null"]},
                    "source_authority":  {"type": ["string", "null"]},
                    "source_section":    {"type": ["string", "null"]},
                    "needs_human_review":{"type": "boolean"},
                    "status": {
                        "type": "string",
                        "enum": [
                            "found", "not_mentioned", "not_applicable",
                            "ambiguous", "inferred", "conflicting", "error",
                        ],
                    },
                },
            },
        },
    },
}

# Ancien vocabulaire → nouveau canonique (rétrocompatibilité)
STATUS_MAP: dict[str, str] = {
    "extracted":     "found",
    "present":       "found",
    "not_found":     "not_mentioned",
    "not_extracted": "not_mentioned",
    "absent":        "not_mentioned",
    "uncertain":     "ambiguous",
    # Nouveau vocabulaire (pass-through)
    "found":         "found",
    "not_mentioned": "not_mentioned",
    "not_applicable":"not_applicable",
    "ambiguous":     "ambiguous",
    "inferred":      "inferred",
    "conflicting":   "conflicting",
    "error":         "error",
}

# Statuts indiquant une ambiguïté → needs_human_review automatique
_REVIEW_STATUSES = {"ambiguous", "conflicting", "error", "inferred"}


def normalize_response(
    data: dict,
    arret_id: str,
    language: str,
    criterion_version: str,
    group: str,
) -> dict:
    """
    Normalise la réponse LLM vers le format canonique avec items[].
    Accepte deux formats :
      - Format canonique : {items: [{criterion_id, value, status, ...}]}
      - Format plat (qwen3 historique) : {criterion_id_1: {value, confidence, ...}, ...}
    """
    if "items" in data:
        for item in data["items"]:
            raw = item.get("status", "not_mentioned")
            item["status"] = STATUS_MAP.get(raw, "not_mentioned")
            if "needs_human_review" not in item:
                item["needs_human_review"] = item["status"] in _REVIEW_STATUSES
            # Coerce les valeurs non-string retournées par le LLM (dict, list, int…)
            # Le schema attend uniquement string | null.
            val = item.get("value")
            if isinstance(val, dict):
                # Ex: {'date_arrivee': None, 'date_introduction_dpi': '7 oct. 2021'}
                # → sérialiser en JSON (parseValueText() côté frontend le gère)
                item["value"] = json.dumps(val, ensure_ascii=False)
            elif isinstance(val, list):
                item["value"] = ", ".join(str(x) for x in val if x is not None) or None
            elif val is not None and not isinstance(val, str):
                item["value"] = str(val)
        return data

    # Format plat historique
    items = []
    for key, val in data.items():
        if not isinstance(val, dict):
            continue
        raw_status = val.get("status") or ("extracted" if val.get("value") else "not_found")
        canonical = STATUS_MAP.get(raw_status, "not_mentioned")
        item = {
            "criterion_id":      key,
            "value":             val.get("value"),
            "confidence":        val.get("confidence"),
            "evidence_excerpt":  val.get("evidence") or val.get("evidence_excerpt"),
            "source_authority":  val.get("source_authority"),
            "source_section":    val.get("source_section"),
            "needs_human_review":canonical in _REVIEW_STATUSES,
            "status":            canonical,
        }
        items.append(item)

    return {
        "arret_id":          arret_id,
        "language":          language,
        "criterion_version": criterion_version,
        "group":             group,
        "items":             items,
        "warnings":          data.get("warnings", []),
    }


def validate_response(
    data: dict,
    group: str,
    language: str,
    valid_ids: set[str],
) -> list[str]:
    """
    Valide la réponse parsée.
    Filtre silencieusement les items avec criterion_id inconnu.
    Retourne la liste des erreurs bloquantes (vide = OK).
    """
    errors: list[str] = []

    try:
        jsonschema.validate(data, RESPONSE_SCHEMA)
    except jsonschema.ValidationError as exc:
        errors.append(f"Schema : {exc.message}")
        return errors

    valid_items = [item for item in data.get("items", []) if item.get("criterion_id") in valid_ids]
    invalid_count = len(data.get("items", [])) - len(valid_items)
    if invalid_count > 0:
        data["items"] = valid_items
        data.setdefault("warnings", []).append(
            f"{invalid_count} item(s) avec criterion_id invalide(s) filtrés"
        )

    if not data.get("items"):
        # Pas d'erreur bloquante : le LLM n'a rien trouvé (sections absentes ou hors-sujet).
        # On stocke 0 valeurs sans retenter — le retry ne changerait rien.
        data.setdefault("warnings", []).append(
            f"Aucun item retourné pour le groupe '{group}' — sections peut-être absentes"
        )

    return errors
