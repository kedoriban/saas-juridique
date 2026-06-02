"""
Construction des prompts LLM par groupe de critères — Phase 5.

Règles :
- Le LLM ne reçoit jamais le texte complet de l'arrêt.
- Il reçoit uniquement les passages candidats pour le groupe demandé.
- Le total texte passé est plafonné à MAX_PASSAGE_CHARS.
- Si non trouvé, répondre null (jamais inventer).
- Confidence obligatoire (0.0-1.0).
- Evidence excerpt si disponible.
"""

from __future__ import annotations

import json

# Plafond du texte de passages par appel (hors prompt système)
MAX_PASSAGE_CHARS = 5000

# Mapping groupe → sections de segment prioritaires (ordre de pertinence)
GROUP_SECTIONS: dict[str, list[str]] = {
    "metadata":             ["identite", "procedure", "dispositif"],
    "procedure":            ["procedure", "faits", "decision_attaquee"],
    "identity":             ["identite", "faits", "procedure"],
    "profile_vulnerability":["faits", "identite", "arguments", "credibilite"],
    "decision_reasoning":   ["analyse", "credibilite", "arguments", "dispositif"],
    "persecution_claims":   ["arguments", "faits", "analyse"],
    "evidence_documents":   ["documents", "analyse"],
    "general":              ["faits", "analyse", "dispositif"],
}

SYSTEM_PROMPT = """\
/no_think
Tu es un extracteur de données juridiques. Tu lis des passages d'arrêts belges du CCE/RVV et tu extrais des critères précis.

Règles ABSOLUES :
- Tu extrais UNIQUEMENT les informations présentes dans les passages fournis.
- Si une information est absente, tu retournes null. JAMAIS de valeur inventée.
- Tu réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après le JSON.
- Tu utilises EXACTEMENT les criterion_id fournis, sans les modifier ni en inventer.
- confidence : 0.0 à 1.0. Sois conservateur.
- evidence_excerpt : citation courte (max 150 car.) copiée mot pour mot du passage.
"""


def build_prompt(
    arret_id: str,
    language: str,
    criterion_version: str,
    group: str,
    criteria: list[dict],  # [{id, label, type}, ...]
    passages: list[str],   # textes des segments candidats
) -> tuple[str, str]:
    """
    Construit le prompt pour un groupe de critères.
    Retourne (system_prompt, user_prompt) séparément pour l'API chat.
    """
    lang_label = "français" if language == "fr" else "néerlandais"

    # Tronquer les passages pour rester sous le plafond
    joined = "\n\n---\n\n".join(passages)
    if len(joined) > MAX_PASSAGE_CHARS:
        joined = joined[:MAX_PASSAGE_CHARS] + "\n[... tronqué ...]"

    # Critères avec IDs exacts
    criteria_lines = "\n".join(
        f'  {i+1}. id="{c["id"]}" | {c["label"]} | type={c["type"]}'
        for i, c in enumerate(criteria)
    )

    # Liste des IDs valides pour instruction explicite
    valid_ids_list = ", ".join(f'"{c["id"]}"' for c in criteria)

    # Exemples concrets avec le premier et dernier critère réels
    ex_found = json.dumps({
        "criterion_id": criteria[0]["id"] if criteria else "id_exemple",
        "value": "exemple de valeur extraite",
        "confidence": 0.85,
        "evidence_excerpt": "copie exacte du texte source (max 150 car.)",
        "status": "extracted",
    }, ensure_ascii=False)

    ex_absent = json.dumps({
        "criterion_id": criteria[-1]["id"] if len(criteria) > 1 else "id_exemple_2",
        "value": None,
        "confidence": None,
        "evidence_excerpt": None,
        "status": "not_found",
    }, ensure_ascii=False)

    user_prompt = f"""Langue du document : {lang_label} ({language})
Groupe de critères : {group}

## PASSAGES DE L'ARRÊT ({len(joined)} caractères)
{joined}

## CRITÈRES À EXTRAIRE ({len(criteria)} critères)
{criteria_lines}

## INSTRUCTION CRITIQUE
Tu dois utiliser UNIQUEMENT ces criterion_id exacts (copie mot pour mot) :
{valid_ids_list}

## FORMAT DE RÉPONSE (JSON strict)
Réponds avec UNIQUEMENT ce JSON — aucun texte avant ou après :
{{
  "items": [
    {ex_found},
    {ex_absent}
  ]
}}

Produis exactement {len(criteria)} items dans "items", un par criterion_id listé ci-dessus, dans l'ordre.
Commence ta réponse par {{ :"""

    return SYSTEM_PROMPT, user_prompt


def select_passages(
    segments: list[dict],
    group: str,
    max_chars: int = MAX_PASSAGE_CHARS,
) -> list[str]:
    """
    Sélectionne et ordonne les segments pertinents pour le groupe donné.
    Respecte le plafond max_chars au total.
    """
    priority_sections = GROUP_SECTIONS.get(group, [])

    # Trier : sections prioritaires d'abord, puis par quality_score décroissant
    def sort_key(seg: dict) -> tuple[int, float]:
        sec = seg.get("section") or ""
        try:
            prio = priority_sections.index(sec)
        except ValueError:
            prio = len(priority_sections)
        return (prio, -(seg.get("quality_score") or 0.0))

    sorted_segs = sorted(segments, key=sort_key)

    selected: list[str] = []
    total = 0
    for seg in sorted_segs:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        if total + len(text) > max_chars:
            remaining = max_chars - total
            if remaining > 200:
                selected.append(text[:remaining])
            break
        selected.append(text)
        total += len(text)

    return selected
