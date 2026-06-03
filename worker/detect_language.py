"""
Détection de la langue principale d'un arrêt CCE/RVV depuis son texte.

Renvoie "fr", "nl" ou "unknown" avec un score de confiance 0-1.
Ne dépend d'aucun autre module du pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Patterns caractéristiques — pondérés par fiabilité
# ---------------------------------------------------------------------------
# Chaque entrée : (pattern_regex, poids)
# Poids élevé = signal très discriminant (unique à une langue)
# Poids faible = mot courant qui peut apparaître dans les deux langues

_FR_SIGNALS: list[tuple[str, float]] = [
    # Institutions et intitulés officiels — très discriminants
    (r"Conseil du Contentieux des [EÉ]trangers", 3.0),
    (r"Commissaire g[eé]n[eé]rale? aux r[eé]fugi[eé]s", 3.0),
    (r"Office des [EÉ]trangers", 2.5),
    # Formules d'en-tête
    (r"\bVu la requ[eê]te\b", 2.0),
    (r"\bAPRES EN AVOIR D[EÉ]LIB[EÉ]R[EÉ]\b", 2.0),
    (r"\bLE PR[EÉ]SIDENT\b", 1.5),
    (r"\bAu nom du peuple belge\b", 2.0),
    # Sections juridiques typiques
    (r"\bFaits invoqu[eé]s\b", 2.0),
    (r"\bMotivation\b", 1.0),
    (r"\bConclusion\b", 0.5),
    (r"\bL'acte attaqu[eé]\b", 2.0),
    (r"\bPar ces motifs\b", 2.0),
    (r"\bappr[eé]ciation sous l'angle\b", 2.5),
    (r"\bth[eè]se de la partie requ[eé]rante\b", 2.5),
    (r"\bnouveaux [eé]l[eé]ments\b", 1.5),
    # Vocabulaire juridique courant FR
    (r"\brequ[eé]rant[e]?\b", 1.0),
    (r"\brefus du statut de r[eé]fugi[eé]\b", 2.5),
    (r"\bprotection subsidiaire\b", 1.5),
    (r"\bprot[eé]ger les r[eé]fugi[eé]s\b", 1.5),
    (r"\bprot[eé]g[eé]e? par\b", 0.5),
    (r"\bla requ[eê]te\b", 1.0),
]

_NL_SIGNALS: list[tuple[str, float]] = [
    # Institutions et intitulés officiels — très discriminants
    (r"Raad voor Vreemdelingenbetwistingen", 3.0),
    (r"Commissaris-generaal voor de vluchtelingen", 3.0),
    (r"Dienst Vreemdelingenzaken", 2.5),
    # Formules d'en-tête
    (r"\bGezien het verzoekschrift\b", 2.0),
    (r"\bGehoord het verslag\b", 2.0),
    (r"\bDE WND\.\s*VOORZITTER\b", 1.5),
    (r"\bIn naam van het Belgische volk\b", 2.0),
    # Sections juridiques typiques
    (r"\bFeitenrelaas\b", 2.0),
    (r"\bMotivering\b", 1.0),
    (r"\bConclusie\b", 0.5),
    (r"\bDe bestreden beslissing\b", 2.0),
    (r"\bOm deze redenen\b", 2.0),
    (r"\bBeoordeling\b", 1.5),
    (r"\bstandpunt van de verzoekende partij\b", 2.5),
    (r"\bnieuwe elementen\b", 1.5),
    # Vocabulaire juridique courant NL
    (r"\bverzoek[e]?r[s]?\b", 1.0),
    (r"\bweigering van de vluchtelingenstatus\b", 2.5),
    (r"\bsubsidiaire beschermingsstatus\b", 1.5),
    (r"\binternationale bescherming\b", 1.5),
    (r"\bhet verzoekschrift\b", 1.0),
]


@dataclass
class LanguageDetectionResult:
    language: str        # "fr" | "nl" | "unknown"
    confidence: float    # 0.0 – 1.0
    fr_score: float
    nl_score: float
    fr_matches: int
    nl_matches: int


def detect_language(text: str) -> LanguageDetectionResult:
    """
    Détecte la langue principale de l'arrêt depuis son texte brut ou nettoyé.

    Stratégie : somme pondérée des signaux FR et NL. La langue gagne si son
    score dépasse l'autre d'un ratio suffisant (seuil = 1.5).
    En dessous du seuil ou si les deux scores sont nuls → "unknown".
    """
    if not text or not text.strip():
        return LanguageDetectionResult(
            language="unknown",
            confidence=0.0,
            fr_score=0.0,
            nl_score=0.0,
            fr_matches=0,
            nl_matches=0,
        )

    fr_score = 0.0
    nl_score = 0.0
    fr_matches = 0
    nl_matches = 0

    for pattern, weight in _FR_SIGNALS:
        if re.search(pattern, text, re.IGNORECASE):
            fr_score += weight
            fr_matches += 1

    for pattern, weight in _NL_SIGNALS:
        if re.search(pattern, text, re.IGNORECASE):
            nl_score += weight
            nl_matches += 1

    total = fr_score + nl_score
    if total == 0.0:
        return LanguageDetectionResult(
            language="unknown",
            confidence=0.0,
            fr_score=0.0,
            nl_score=0.0,
            fr_matches=0,
            nl_matches=0,
        )

    # Ratio minimal pour trancher : le gagnant doit peser au moins 60 % du total
    fr_ratio = fr_score / total
    nl_ratio = nl_score / total

    _THRESHOLD = 0.60

    if fr_ratio >= _THRESHOLD:
        language = "fr"
        confidence = round(fr_ratio, 3)
    elif nl_ratio >= _THRESHOLD:
        language = "nl"
        confidence = round(nl_ratio, 3)
    else:
        language = "unknown"
        confidence = round(max(fr_ratio, nl_ratio), 3)

    return LanguageDetectionResult(
        language=language,
        confidence=confidence,
        fr_score=round(fr_score, 2),
        nl_score=round(nl_score, 2),
        fr_matches=fr_matches,
        nl_matches=nl_matches,
    )


# ---------------------------------------------------------------------------
# CLI minimal pour test rapide
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python detect_language.py <chemin_fichier_texte>")
        sys.exit(1)

    path = sys.argv[1]
    with open(path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    result = detect_language(content)
    print(f"Langue       : {result.language}")
    print(f"Confiance    : {result.confidence:.1%}")
    print(f"Score FR     : {result.fr_score} ({result.fr_matches} signaux)")
    print(f"Score NL     : {result.nl_score} ({result.nl_matches} signaux)")
