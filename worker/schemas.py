"""
JSON Schema strict pour les réponses LLM — Phase 5.

Chaque appel retourne un objet avec :
  - arret_id, language, criterion_version, group
  - items[]  : un objet par critère du groupe
  - warnings : liste de chaînes (hallucinations détectées, valeur invraisemblable, etc.)
"""

from __future__ import annotations

from typing import Any

import jsonschema

# Schéma JSON attendu en sortie du LLM (utilisé aussi comme "format" Ollama)
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["items"],
    "properties": {
        # Champs optionnels conservés pour compatibilité avec ancien format
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
                    "criterion_id":     {"type": "string"},
                    "value":            {"type": ["string", "null"]},
                    "confidence":       {"type": ["number", "null"], "minimum": 0.0, "maximum": 1.0},
                    "evidence_excerpt": {"type": ["string", "null"]},
                    "status": {
                        "type": "string",
                        "enum": ["extracted", "not_found", "not_extracted", "uncertain", "absent", "present"],
                    },
                },
            },
        },
    },
}


# Mapping des statuts LLM bruts vers le vocabulaire canonique
STATUS_MAP = {
    "absent": "not_found",
    "present": "extracted",
    "uncertain": "uncertain",
    "extracted": "extracted",
    "not_found": "not_found",
    "not_extracted": "not_found",
}


def normalize_response(data: dict, arret_id: str, language: str, criterion_version: str, group: str) -> dict:
    """
    Normalise la réponse du LLM vers le format canonique avec items[].
    Accepte deux formats :
      - Format canonique : {arret_id, language, ..., items: [{criterion_id, value, ...}]}
      - Format plat (qwen3) : {criterion_id_1: {value, confidence, evidence, status}, ...}
    """
    # Déjà au bon format
    if "items" in data:
        return data

    # Format plat : les clés sont des criterion_id
    items = []
    for key, val in data.items():
        if not isinstance(val, dict):
            continue
        raw_status = val.get("status") or ("extracted" if val.get("value") else "not_found")
        item = {
            "criterion_id":     key,
            "value":            val.get("value"),
            "confidence":       val.get("confidence"),
            "evidence_excerpt": val.get("evidence") or val.get("evidence_excerpt"),
            "status":           STATUS_MAP.get(raw_status, "not_found"),
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


def validate_response(data: dict, group: str, language: str, valid_ids: set[str]) -> list[str]:
    """
    Valide la réponse parsée.
    - Filtre silencieusement les items avec un criterion_id inconnu (au lieu de rejeter tout).
    - Retourne la liste des erreurs bloquantes (vide = OK).
    """
    errors: list[str] = []

    # 1. Validation structurelle minimale
    try:
        jsonschema.validate(data, RESPONSE_SCHEMA)
    except jsonschema.ValidationError as exc:
        errors.append(f"Schema : {exc.message}")
        return errors

    # 2. Filtrer les items aux IDs invalides (ne pas rejeter toute la réponse)
    valid_items = [item for item in data.get("items", []) if item.get("criterion_id") in valid_ids]
    invalid_count = len(data.get("items", [])) - len(valid_items)
    if invalid_count > 0:
        # On logue mais on ne bloque pas
        data["items"] = valid_items
        data.setdefault("warnings", []).append(
            f"{invalid_count} item(s) avec criterion_id invalide(s) filtrés"
        )

    # 3. Aucun item valide = erreur bloquante
    if not data.get("items"):
        errors.append(f"Aucun item valide pour le groupe '{group}'")

    return errors
