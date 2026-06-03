"""
Détection des demandeurs dans un arrêt CCE/RVV.

Identifie :
  - s'il y a un ou plusieurs demandeurs ;
  - le genre de chaque demandeur (si détectable) ;
  - si les affaires sont jointes (jonction explicite) ;
  - si des faits/sections sont partagés.

La détection est conservatrice : en cas de doute, le module indique
is_multi_applicant=False et renvoie un seul demandeur générique plutôt
que d'inventer des identités. Le LLM confirmera ensuite.

Ne dépend d'aucun autre module du pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Signaux de jonction explicite (cas liés, affaires jointes)
# ---------------------------------------------------------------------------
_RE_JONCTION_FR = re.compile(
    r"\bjonction des affaires\b",
    re.IGNORECASE,
)
_RE_JONCTION_NL = re.compile(
    r"\bsamenvoeging van de zaken\b",
    re.IGNORECASE,
)

# Marqueur de sous-section individuelle dans un arrêt joint
# FR : "en ce qui concerne la décision prise à l'égard de"
# NL : "wat betreft de beslissing genomen ten aanzien van"
_RE_INDIVIDUAL_SECTION_FR = re.compile(
    r"en ce qui concerne la d[eé]cision prise [àa] l['']?[eé]gard de",
    re.IGNORECASE,
)
_RE_INDIVIDUAL_SECTION_NL = re.compile(
    r"wat betreft de beslissing genomen ten aanzien van",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Signaux de genre — singulier
# ---------------------------------------------------------------------------
_RE_REQUÉRANT_MALE = re.compile(r"\ble requ[eé]rant\b(?!\s*e\b)", re.IGNORECASE)
_RE_REQUÉRANT_FEMALE = re.compile(r"\bla requ[eé]rante\b", re.IGNORECASE)
_RE_VERZOEKER_MALE = re.compile(r"\bde verzoeker\b(?!\s*s\b)", re.IGNORECASE)
_RE_VERZOEKSTER_FEMALE = re.compile(r"\bde verzoekster\b", re.IGNORECASE)

# Pluriel non genré
_RE_REQUERANTS_PLURAL = re.compile(r"\bles requ[eé]rant[e]?s\b", re.IGNORECASE)
_RE_VERZOEKERS_PLURAL = re.compile(r"\bverzoekers\b", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Signaux de famille
# ---------------------------------------------------------------------------
_RE_FAMILY_FR = re.compile(
    r"\b(ils d[eé]clarent [eê]tre mari[eé]s?|"
    r"leur[s]? enfant[s]?|"
    r"le requérant et la requérante|"
    r"conjointe?|"
    r"leur foyer)\b",
    re.IGNORECASE,
)
_RE_FAMILY_NL = re.compile(
    r"\b(hun kinderen|"
    r"de verzoeker en de verzoekster|"
    r"echtgeno[ot|te]|"
    r"hun gezin)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Résultats
# ---------------------------------------------------------------------------
@dataclass
class ApplicantInfo:
    applicant_id: str          # "applicant_1", "applicant_2", …
    role: str                  # "requérant", "requérante", "verzoeker", "verzoekster", "unknown"
    detected_gender: str       # "male", "female", "unknown"
    criteria_scope: str        # "individual" | "shared" | "decision"


@dataclass
class SharedFactsInfo:
    exists: bool
    text_sections: list[str] = field(default_factory=list)


@dataclass
class ApplicantDetectionResult:
    is_multi_applicant: bool
    applicant_count: int | None              # None si indéterminable
    jonction: bool                           # Jonction explicite des affaires
    family_signals: bool                     # Signaux de famille détectés
    applicants: list[ApplicantInfo] = field(default_factory=list)
    shared_facts: SharedFactsInfo = field(default_factory=lambda: SharedFactsInfo(exists=False))
    detection_notes: list[str] = field(default_factory=list)


def detect_applicants(text: str) -> ApplicantDetectionResult:
    """
    Détecte la structure des demandeurs dans le texte de l'arrêt.

    Stratégie :
    1. Jonction explicite → multi_applicant, tenter de compter les sous-sections.
    2. Signaux pluriels sans jonction → multi_applicant, count inconnu.
    3. Signaux singuliers → 1 demandeur, genre détecté.
    4. Aucun signal → 1 demandeur générique, genre unknown.
    """
    if not text:
        return _single_unknown()

    jonction_fr = bool(_RE_JONCTION_FR.search(text))
    jonction_nl = bool(_RE_JONCTION_NL.search(text))
    jonction = jonction_fr or jonction_nl

    plural_fr = bool(_RE_REQUERANTS_PLURAL.search(text))
    plural_nl = bool(_RE_VERZOEKERS_PLURAL.search(text))
    has_plural = plural_fr or plural_nl

    male_fr = bool(_RE_REQUÉRANT_MALE.search(text))
    female_fr = bool(_RE_REQUÉRANT_FEMALE.search(text))
    male_nl = bool(_RE_VERZOEKER_MALE.search(text))
    female_nl = bool(_RE_VERZOEKSTER_FEMALE.search(text))

    family_fr = bool(_RE_FAMILY_FR.search(text))
    family_nl = bool(_RE_FAMILY_NL.search(text))
    family_signals = family_fr or family_nl

    # ------------------------------------------------------------------
    # CAS 1 : Jonction explicite
    # ------------------------------------------------------------------
    if jonction:
        count_fr = len(_RE_INDIVIDUAL_SECTION_FR.findall(text))
        count_nl = len(_RE_INDIVIDUAL_SECTION_NL.findall(text))
        individual_count = max(count_fr, count_nl)

        sections: list[str] = []
        if jonction_fr:
            sections.append("jonction_affaires")
        if jonction_nl:
            sections.append("samenvoeging_zaken")

        if individual_count >= 2:
            applicants = _build_applicants_from_count(individual_count, male_fr or male_nl, female_fr or female_nl)
            note = f"jonction explicite, {individual_count} sous-sections individuelles détectées"
        else:
            # Jonction mais sous-sections non trouvées → 2 demandeurs par défaut
            applicants = _build_applicants_from_genders(male_fr or male_nl, female_fr or female_nl)
            note = "jonction explicite, sous-sections individuelles non comptabilisées (≥2 présumés)"

        return ApplicantDetectionResult(
            is_multi_applicant=True,
            applicant_count=len(applicants),
            jonction=True,
            family_signals=family_signals,
            applicants=applicants,
            shared_facts=SharedFactsInfo(exists=True, text_sections=sections),
            detection_notes=[note],
        )

    # ------------------------------------------------------------------
    # CAS 2 : Signaux pluriels sans jonction explicite
    # ------------------------------------------------------------------
    if has_plural or (family_signals and (male_fr or female_fr or male_nl or female_nl)):
        applicants = _build_applicants_from_genders(male_fr or male_nl, female_fr or female_nl)
        note = "pluriel détecté sans jonction explicite"
        if family_signals:
            note += ", signaux de famille présents"

        return ApplicantDetectionResult(
            is_multi_applicant=True,
            applicant_count=None,
            jonction=False,
            family_signals=family_signals,
            applicants=applicants,
            shared_facts=SharedFactsInfo(exists=True, text_sections=[]),
            detection_notes=[note],
        )

    # ------------------------------------------------------------------
    # CAS 3 : Un seul demandeur identifié par le genre
    # ------------------------------------------------------------------
    if male_fr or male_nl:
        role = "requérant" if male_fr else "verzoeker"
        return ApplicantDetectionResult(
            is_multi_applicant=False,
            applicant_count=1,
            jonction=False,
            family_signals=family_signals,
            applicants=[ApplicantInfo("applicant_1", role, "male", "decision")],
            shared_facts=SharedFactsInfo(exists=False),
        )

    if female_fr or female_nl:
        role = "requérante" if female_fr else "verzoekster"
        return ApplicantDetectionResult(
            is_multi_applicant=False,
            applicant_count=1,
            jonction=False,
            family_signals=family_signals,
            applicants=[ApplicantInfo("applicant_1", role, "female", "decision")],
            shared_facts=SharedFactsInfo(exists=False),
        )

    # ------------------------------------------------------------------
    # CAS 4 : Aucun signal clair
    # ------------------------------------------------------------------
    return _single_unknown(detection_notes=["aucun signal de genre ou de pluralité détecté"])


# ---------------------------------------------------------------------------
# Helpers internes
# ---------------------------------------------------------------------------

def _single_unknown(detection_notes: list[str] | None = None) -> ApplicantDetectionResult:
    return ApplicantDetectionResult(
        is_multi_applicant=False,
        applicant_count=1,
        jonction=False,
        family_signals=False,
        applicants=[ApplicantInfo("applicant_1", "unknown", "unknown", "decision")],
        shared_facts=SharedFactsInfo(exists=False),
        detection_notes=detection_notes or [],
    )


def _build_applicants_from_genders(has_male: bool, has_female: bool) -> list[ApplicantInfo]:
    """Construit la liste minimale selon les genres détectés."""
    applicants: list[ApplicantInfo] = []
    if has_male and has_female:
        applicants.append(ApplicantInfo("applicant_1", "requérant", "male", "individual"))
        applicants.append(ApplicantInfo("applicant_2", "requérante", "female", "individual"))
    elif has_male:
        applicants.append(ApplicantInfo("applicant_1", "requérant", "male", "individual"))
        applicants.append(ApplicantInfo("applicant_2", "unknown", "unknown", "individual"))
    elif has_female:
        applicants.append(ApplicantInfo("applicant_1", "requérante", "female", "individual"))
        applicants.append(ApplicantInfo("applicant_2", "unknown", "unknown", "individual"))
    else:
        applicants.append(ApplicantInfo("applicant_1", "unknown", "unknown", "individual"))
        applicants.append(ApplicantInfo("applicant_2", "unknown", "unknown", "individual"))
    return applicants


def _build_applicants_from_count(
    count: int, has_male: bool, has_female: bool
) -> list[ApplicantInfo]:
    """Construit une liste de `count` demandeurs en attribuant les genres connus."""
    applicants: list[ApplicantInfo] = []
    for i in range(count):
        aid = f"applicant_{i + 1}"
        if i == 0 and has_male and not has_female:
            applicants.append(ApplicantInfo(aid, "requérant", "male", "individual"))
        elif i == 0 and has_female and not has_male:
            applicants.append(ApplicantInfo(aid, "requérante", "female", "individual"))
        elif i == 0 and has_male:
            applicants.append(ApplicantInfo(aid, "requérant", "male", "individual"))
        elif i == 1 and has_female:
            applicants.append(ApplicantInfo(aid, "requérante", "female", "individual"))
        else:
            applicants.append(ApplicantInfo(aid, "unknown", "unknown", "individual"))
    return applicants


# ---------------------------------------------------------------------------
# CLI minimal pour test rapide
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python detect_applicants.py <chemin_fichier_texte>")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
        content = f.read()

    r = detect_applicants(content)
    print(f"Multi        : {r.is_multi_applicant}")
    print(f"Nombre       : {r.applicant_count}")
    print(f"Jonction     : {r.jonction}")
    print(f"Famille      : {r.family_signals}")
    print(f"Demandeurs   : {[(a.applicant_id, a.role, a.detected_gender) for a in r.applicants]}")
    print(f"Faits partagés: {r.shared_facts}")
    if r.detection_notes:
        print(f"Notes        : {r.detection_notes}")
