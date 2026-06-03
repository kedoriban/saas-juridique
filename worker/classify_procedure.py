"""
Classification du type réel d'arrêt CCE/RVV depuis son texte.

Types supportés :
  protection_internationale_fond  — examen au fond (réfugié / protection subsidiaire)
  dublin_transfert                — décision de transfert Dublin III
  oqt_extreme_urgence             — OQT ou procédure d'extrême urgence
  sejour_visa_regroupement        — séjour, visa, regroupement familial
  autre_non_supporte              — autre type connu mais hors périmètre
  unknown                         — aucun signal suffisant

Renvoie le type, la confiance 0-1, les signaux détectés et si la grille
principale de critères s'applique (requires_main_criteria).

Ne dépend d'aucun autre module du pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Constante de type de procédure
# ---------------------------------------------------------------------------
PROTECTION_INTERNATIONALE_FOND = "protection_internationale_fond"
DUBLIN_TRANSFERT = "dublin_transfert"
OQT_EXTREME_URGENCE = "oqt_extreme_urgence"
SEJOUR_VISA_REGROUPEMENT = "sejour_visa_regroupement"
AUTRE_NON_SUPPORTE = "autre_non_supporte"
UNKNOWN = "unknown"

# Types pour lesquels la grille principale de critères s'applique
_MAIN_CRITERIA_TYPES = {PROTECTION_INTERNATIONALE_FOND}


# ---------------------------------------------------------------------------
# Signaux par type — (pattern_regex, poids, label_court)
# ---------------------------------------------------------------------------

_SIGNALS_PROTECTION: list[tuple[str, float, str]] = [
    # FR — très discriminants
    (r"refus du statut de r[eé]fugi[eé] et refus du statut de protection subsidiaire", 4.0,
     "refus du statut de réfugié et refus du statut de protection subsidiaire"),
    (r"Commissaire g[eé]n[eé]rale? aux r[eé]fugi[eé]s et aux apatrides", 3.0,
     "Commissaire générale aux réfugiés et aux apatrides"),
    (r"\bA\.\s*Faits invoqu[eé]s\b", 2.5, "A. Faits invoqués"),
    (r"\bB\.\s*Motivation\b", 2.0, "B. Motivation"),
    (r"\bC\.\s*Conclusion\b", 1.5, "C. Conclusion"),
    (r"Appr[eé]ciation sous l'angle de l'article 48/[34]", 3.0,
     "Appréciation sous l'angle de l'article 48/3 ou 48/4"),
    (r"\barticle 48/3\b", 2.0, "article 48/3"),
    (r"\barticle 48/4\b", 2.0, "article 48/4"),
    (r"\barticle 48/7\b", 2.0, "article 48/7"),
    (r"demande de protection internationale", 2.0, "demande de protection internationale"),
    # NL — très discriminants
    (r"weigering van de vluchtelingenstatus en weigering van de subsidiaire beschermingsstatus", 4.0,
     "weigering van de vluchtelingenstatus"),
    (r"Commissaris-generaal voor de vluchtelingen en de staatlozen", 3.0,
     "Commissaris-generaal voor de vluchtelingen en de staatlozen"),
    (r"\bFeitenrelaas\b", 2.0, "Feitenrelaas"),
    (r"\bMotivering\b", 1.5, "Motivering"),
    (r"internationale bescherming", 2.0, "internationale bescherming"),
    (r"vluchtelingenstatus", 2.0, "vluchtelingenstatus"),
    (r"subsidiaire beschermingsstatus", 2.0, "subsidiaire beschermingsstatus"),
    (r"\bartikel 48/[34]\b", 2.0, "artikel 48/3 of 48/4"),
    (r"\bartikel 48/7\b", 2.0, "artikel 48/7"),
    (r"verzoek om internationale bescherming", 2.0, "verzoek om internationale bescherming"),
]

_SIGNALS_DUBLIN: list[tuple[str, float, str]] = [
    # FR
    (r"d[eé]cision de transfert", 4.0, "décision de transfert"),
    (r"annexe 26quater", 3.5, "annexe 26quater"),
    (r"R[eè]glement \(?UE\)?\s*(?:n[o°]\s*)?604/2013", 3.5, "Règlement (UE) 604/2013"),
    (r"\bDublin\b", 2.0, "Dublin"),
    (r"prise en charge", 1.5, "prise en charge"),
    (r"reprise en charge", 1.5, "reprise en charge"),
    (r"[EÉ]tat membre responsable", 2.5, "État membre responsable"),
    # NL
    (r"overdrachtsbesluit", 4.0, "overdrachtsbesluit"),
    (r"bijlage 26quater", 3.5, "bijlage 26quater"),
    (r"Verordening \(?EU\)?\s*(?:nr\.)?\s*604/2013", 3.5, "Verordening (EU) nr. 604/2013"),
    (r"verantwoordelijke lidstaat", 2.5, "verantwoordelijke lidstaat"),
    (r"\bovername\b", 1.5, "overname"),
    (r"\bterugname\b", 1.5, "terugname"),
]

_SIGNALS_OQT: list[tuple[str, float, str]] = [
    # FR
    (r"ordre de quitter le territoire", 4.0, "ordre de quitter le territoire"),
    (r"annexe 13septies", 3.5, "annexe 13septies"),
    (r"maintien en vue d'[eé]loignement", 3.5, "maintien en vue d'éloignement"),
    (r"suspension.*proc[eé]dure d'extr[eê]me urgence", 3.0,
     "suspension, selon la procédure d'extrême urgence"),
    (r"pr[eé]judice grave difficilement r[eé]parable", 2.5,
     "préjudice grave difficilement réparable"),
    (r"risque de fuite", 2.0, "risque de fuite"),
    (r"extr[eê]me urgence", 2.0, "extrême urgence"),
    # NL
    (r"bevel om het grondgebied te verlaten", 4.0, "bevel om het grondgebied te verlaten"),
    (r"bijlage 13septies", 3.5, "bijlage 13septies"),
    (r"vasthouding met het oog op verwijdering", 3.5, "vasthouding met het oog op verwijdering"),
    (r"uiterst dringende noodzakelijkheid", 3.0, "uiterst dringende noodzakelijkheid"),
    (r"moeilijk te herstellen ernstig nadeel", 2.5, "moeilijk te herstellen ernstig nadeel"),
    (r"risico op onderduiken", 2.0, "risico op onderduiken"),
]

_SIGNALS_SEJOUR: list[tuple[str, float, str]] = [
    # FR
    (r"regroupement familial", 3.0, "regroupement familial"),
    (r"titre de s[eé]jour", 2.5, "titre de séjour"),
    (r"demande de visa", 2.5, "demande de visa"),
    (r"autorisation de s[eé]jour", 2.5, "autorisation de séjour"),
    (r"annexe 19", 2.0, "annexe 19"),
    (r"article 9bis\b", 2.0, "article 9bis"),
    (r"article 9ter\b", 2.0, "article 9ter"),
    # NL
    (r"gezinshereniging", 3.0, "gezinshereniging"),
    (r"verblijfstitel", 2.5, "verblijfstitel"),
    (r"visumaanvraag", 2.5, "visumaanvraag"),
    (r"verblijfsmachtiging", 2.5, "verblijfsmachtiging"),
    (r"bijlage 19\b", 2.0, "bijlage 19"),
    (r"artikel 9bis\b", 2.0, "artikel 9bis"),
    (r"artikel 9ter\b", 2.0, "artikel 9ter"),
]

_ALL_SIGNAL_GROUPS: list[tuple[str, list[tuple[str, float, str]]]] = [
    (PROTECTION_INTERNATIONALE_FOND, _SIGNALS_PROTECTION),
    (DUBLIN_TRANSFERT, _SIGNALS_DUBLIN),
    (OQT_EXTREME_URGENCE, _SIGNALS_OQT),
    (SEJOUR_VISA_REGROUPEMENT, _SIGNALS_SEJOUR),
]

# Seuil minimum de score pour qu'un type soit retenu
_MIN_SCORE = 4.0
# Le type gagnant doit peser ce ratio par rapport au total pour être retenu
_RATIO_THRESHOLD = 0.50


@dataclass
class ProcedureClassificationResult:
    procedure_type: str
    confidence: float
    signals: list[str] = field(default_factory=list)
    requires_main_criteria: bool = False
    scores: dict[str, float] = field(default_factory=dict)


def classify_procedure(text: str) -> ProcedureClassificationResult:
    """
    Classifie le type de procédure d'un arrêt depuis son texte.

    Stratégie :
    - Calcule un score pondéré par type en cherchant les signaux.
    - Le type retenu est celui dont le score dépasse _MIN_SCORE ET
      représente au moins _RATIO_THRESHOLD du total des scores.
    - En cas d'égalité ou de score insuffisant → unknown.
    """
    if not text or not text.strip():
        return ProcedureClassificationResult(
            procedure_type=UNKNOWN,
            confidence=0.0,
        )

    scores: dict[str, float] = {}
    triggered_signals: dict[str, list[str]] = {}

    for proc_type, signals in _ALL_SIGNAL_GROUPS:
        score = 0.0
        matched: list[str] = []
        for pattern, weight, label in signals:
            if re.search(pattern, text, re.IGNORECASE):
                score += weight
                matched.append(label)
        scores[proc_type] = round(score, 2)
        triggered_signals[proc_type] = matched

    total = sum(scores.values())

    if total == 0.0:
        return ProcedureClassificationResult(
            procedure_type=UNKNOWN,
            confidence=0.0,
            scores=scores,
        )

    # Trier par score décroissant
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_type, best_score = ranked[0]

    if best_score < _MIN_SCORE:
        return ProcedureClassificationResult(
            procedure_type=UNKNOWN,
            confidence=round(best_score / (total or 1), 3),
            scores=scores,
        )

    ratio = best_score / total
    if ratio < _RATIO_THRESHOLD:
        # Deux types en compétition sans gagnant clair → unknown
        return ProcedureClassificationResult(
            procedure_type=UNKNOWN,
            confidence=round(ratio, 3),
            scores=scores,
        )

    return ProcedureClassificationResult(
        procedure_type=best_type,
        confidence=round(ratio, 3),
        signals=triggered_signals[best_type],
        requires_main_criteria=(best_type in _MAIN_CRITERIA_TYPES),
        scores=scores,
    )


# ---------------------------------------------------------------------------
# CLI minimal pour test rapide
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python classify_procedure.py <chemin_fichier_texte>")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
        content = f.read()

    result = classify_procedure(content)
    print(f"Type         : {result.procedure_type}")
    print(f"Confiance    : {result.confidence:.1%}")
    print(f"Grille princ.: {result.requires_main_criteria}")
    print(f"Signaux      : {result.signals}")
    print(f"Scores       : {result.scores}")
