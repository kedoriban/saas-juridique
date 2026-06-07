"""
Extraction des métadonnées procédurales d'un arrêt CCE/RVV par regex.

Champs extraits :
  decision_number       — numéro normalisé (ex. "341995")
  decision_id           — identifiant complet (ex. "A341995")
  decision_date         — date de l'arrêt telle qu'elle apparaît dans le texte
  judge                 — nom du juge/président de chambre
  lawyer                — nom de l'avocat de la partie requérante
  defendant             — institution défenderesse (CGRA, OE…)
  appeal_date           — date d'introduction du recours
  attacked_decision_date — date de la décision attaquée

Ces champs ne passent PAS par le LLM sauf en cas d'ambiguïté signalée.
Ne dépend d'aucun autre module du pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Mois FR / NL pour la normalisation des dates textuelles
# ---------------------------------------------------------------------------
_MONTHS_FR = (
    "janvier|f[eé]vrier|mars|avril|mai|juin|"
    "juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre"
)
_MONTHS_NL = (
    "januari|februari|maart|april|mei|juni|"
    "juli|augustus|september|oktober|november|december"
)
_MONTHS_ALL = f"(?:{_MONTHS_FR}|{_MONTHS_NL})"

# Date complète : "27 février 2026" ou "27 februari 2026"
_RE_DATE_FULL = re.compile(
    rf"\b(\d{{1,2}})\s+({_MONTHS_ALL})\s+(\d{{4}})\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Numéro d'arrêt
# ---------------------------------------------------------------------------
# Formats observés : "n° 341 995", "n° 341.995", "nr. 341 995", "nr. 341.995"
# La base CCE stocke "341995" (sans séparateur).
_RE_ARRET_NUMBER = re.compile(
    r"(?:arr[eê]t|arrest)\s+n[o°r]?[°.]?\s*(\d{3}[\s.]\d{3}|\d{6,7})",
    re.IGNORECASE,
)
# Depuis l'URL PDF : A341995.AN.pdf
_RE_URL_NUMBER = re.compile(r"/A(\d{5,7})\.", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Date de l'arrêt (dans l'en-tête)
# FR : "du 27 février 2026"   NL : "van 27 februari 2026"
# ---------------------------------------------------------------------------
_RE_ARRET_DATE = re.compile(
    rf"(?:du|van)\s+(\d{{1,2}}\s+{_MONTHS_ALL}\s+\d{{4}})",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Juge / président de chambre
# FR : "présid(ent|ente) de chambre", "juge au contentieux", "conseillèr(e) d'État"
# NL : "kamervoorzitter", "rechter in vreemdelingenzaken"
# Contexte : ligne contenant "PRESENT :" ou "AANWEZIG :"
# ---------------------------------------------------------------------------
_RE_JUDGE_HEADER = re.compile(
    r"(?:PRESENT|PR[EÉ]SENT|AANWEZIG)\s*:\s*([A-ZÀ-Ü][^\n,]+?)(?:\s*,|\n)",
    re.IGNORECASE,
)
# Fallback : ligne avec titre de juge connu
_RE_JUDGE_TITLE = re.compile(
    r"([A-ZÀ-Ü][A-Za-zÀ-ü.\- ]{2,30}),\s*"
    r"(?:pr[eé]sid[e]?nt[e]? de chambre|juge au contentieux|"
    r"conseiller[e]? d[' ](?:[eé]tat|appel)|"
    r"kamervoorzitter|rechter in vreemdelingenzaken|"
    r"rechter)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Avocat
# FR : "Maître X" / "Me X"    NL : "Meester X" / "Mr. X"
# ---------------------------------------------------------------------------
_RE_LAWYER = re.compile(
    r"(?:Ma[îi]tre|M[e\.]\s|Meester|Mr\.)\s+([A-ZÀ-Ü][A-Za-zÀ-ü.\- ]{1,40}?)(?=[,\n;])",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Date d'introduction du recours
# FR : "la requête introduite le <date>"
# NL : "het verzoekschrift ingediend op <date>"
# ---------------------------------------------------------------------------
_RE_APPEAL_DATE = re.compile(
    rf"(?:requ[eê]te\b[^.]*?\bintroduite le|verzoekschrift\b[^.]*?\bingediend op)\s+"
    rf"(\d{{1,2}}\s+{_MONTHS_ALL}\s+\d{{4}})",
    re.IGNORECASE | re.DOTALL,
)

# ---------------------------------------------------------------------------
# Date de la décision attaquée
# FR : "décision du <institution> du <date>"
# NL : "beslissing van de <institution> van <date>"
# ---------------------------------------------------------------------------
_RE_ATTACKED_DATE = re.compile(
    rf"(?:d[eé]cision du|d[eé]cision de la|beslissing van de?)\s+"
    rf"[^.\n]{{5,120}}"
    rf"\s+(?:du|van)\s+(\d{{1,2}}\s+{_MONTHS_ALL}\s+\d{{4}})",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Chambre (numéro romain + langue)
# CCE : "Ière chambre francophone", "IIIème CHAMBRE", "Xe chambre"
# RvV : "XIde kamer, Nederlandstalig", "IVde kamer"
# ---------------------------------------------------------------------------
_RE_CHAMBRE = re.compile(
    # Numéro romain ≥ 2 chars (II, III, IV, VI, IX, XI...) OU I/V/X suivi d'un suffixe ordinal
    # Exclut les faux positifs comme "V" seul dans "RvV"
    r"\b("
    r"(?:[IVXLC]{2,6}|[IVX](?:i?[eè]r?e?m?e?|de))"
    r"(?:i?[eè]r?e?m?e?|de?)?"
    r"\s+(?:chambre|kamer)"
    r"(?:[,\s]+(?:francophone|n[eé]erlandophone|nederlandstalig))?)",
    re.IGNORECASE,
)

# Numéro sans préfixe "arrêt/arrest" : "n° 341 968", "nr. 342 046"
_RE_NUMBER_FALLBACK = re.compile(
    r"\bn[°or]?\.?\s+(\d{3}[\s.]\d{3}|\d{6,7})\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Institution défenderesse
# ---------------------------------------------------------------------------
_DEFENDANTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"Commissaire g[eé]n[eé]rale? aux r[eé]fugi[eé]s et aux apatrides", re.I),
     "Commissaire générale aux réfugiés et aux apatrides"),
    (re.compile(r"Commissaris-generaal voor de vluchtelingen en de staatlozen", re.I),
     "Commissaris-generaal voor de vluchtelingen en de staatlozen"),
    (re.compile(r"Office des [EÉ]trangers", re.I),
     "Office des Étrangers"),
    (re.compile(r"Dienst Vreemdelingenzaken", re.I),
     "Dienst Vreemdelingenzaken"),
]


# ---------------------------------------------------------------------------
# Résultat
# ---------------------------------------------------------------------------
@dataclass
class MetadataExtractionResult:
    decision_number: str | None = None          # "341995"
    decision_id: str | None = None              # "A341995"
    decision_date: str | None = None            # "27 février 2026"
    judge: str | None = None
    lawyer: str | None = None
    defendant: str | None = None
    appeal_date: str | None = None
    attacked_decision_date: str | None = None
    chambre: str | None = None
    extraction_notes: list[str] = field(default_factory=list)


def _clean_number(raw: str) -> str:
    """Supprime les séparateurs de milliers et renvoie le chiffre pur."""
    return re.sub(r"[\s.]", "", raw)


def extract_metadata(
    text: str,
    pdf_url: str | None = None,
) -> MetadataExtractionResult:
    """
    Extrait les métadonnées procédurales depuis le texte de l'arrêt.

    pdf_url est optionnel : permet de récupérer le numéro depuis l'URL
    si le header textuel ne le donne pas clairement.
    """
    result = MetadataExtractionResult()

    if not text:
        return result

    # ------------------------------------------------------------------
    # Numéro d'arrêt — texte d'abord, URL en fallback
    # ------------------------------------------------------------------
    m = _RE_ARRET_NUMBER.search(text)
    if m:
        raw_num = _clean_number(m.group(1))
        result.decision_number = raw_num
        result.decision_id = f"A{raw_num}"
    else:
        # Fallback : "n° 341 968" sans préfixe "arrêt/arrest"
        m = _RE_NUMBER_FALLBACK.search(text[:500])
        if m:
            raw_num = _clean_number(m.group(1))
            result.decision_number = raw_num
            result.decision_id = f"A{raw_num}"
            result.extraction_notes.append("decision_number extrait sans préfixe arrêt/arrest")
        elif pdf_url:
            m_url = _RE_URL_NUMBER.search(pdf_url)
            if m_url:
                result.decision_number = m_url.group(1)
                result.decision_id = f"A{m_url.group(1)}"
                result.extraction_notes.append("decision_number extrait depuis l'URL (non trouvé dans le texte)")

    # ------------------------------------------------------------------
    # Date de l'arrêt
    # Chercher dans les 500 premiers caractères (en-tête)
    # ------------------------------------------------------------------
    header = text[:1000]
    m = _RE_ARRET_DATE.search(header)
    if m:
        result.decision_date = m.group(1).strip()
    else:
        # Fallback : première date complète dans le header
        m = _RE_DATE_FULL.search(header)
        if m:
            result.decision_date = m.group(0).strip()
            result.extraction_notes.append("decision_date extraite par fallback (première date du header)")

    # ------------------------------------------------------------------
    # Juge
    # ------------------------------------------------------------------
    m = _RE_JUDGE_HEADER.search(text[:2000])
    if m:
        result.judge = m.group(1).strip()
    else:
        m = _RE_JUDGE_TITLE.search(text[:3000])
        if m:
            result.judge = m.group(1).strip()
            result.extraction_notes.append("judge extrait par titre (PRESENT non trouvé)")
    if not result.judge:
        # Fallback : dispositif / signature en fin d'arrêt (nom non anonymisé même sur PDF CCE publié)
        m = _RE_JUDGE_TITLE.search(text[-2000:])
        if m:
            result.judge = m.group(1).strip()
            result.extraction_notes.append("judge extrait depuis le dispositif/signature (fin du texte)")

    # ------------------------------------------------------------------
    # Avocat — souvent en début d'arrêt dans la désignation des parties
    # ------------------------------------------------------------------
    lawyers: list[str] = []
    for m in _RE_LAWYER.finditer(text[:3000]):
        name = m.group(1).strip().rstrip(".")
        if len(name) >= 2:
            entry = f"Me {name}"
            if entry not in lawyers:
                lawyers.append(entry)
    result.lawyer = " ; ".join(lawyers) if lawyers else None

    # ------------------------------------------------------------------
    # Institution défenderesse
    # ------------------------------------------------------------------
    for pattern, label in _DEFENDANTS:
        if pattern.search(text):
            result.defendant = label
            break

    # ------------------------------------------------------------------
    # Chambre (numéro romain, non anonymisé dans les PDF CCE/RvV publiés)
    # ------------------------------------------------------------------
    m = _RE_CHAMBRE.search(text[:1500])
    if m:
        result.chambre = m.group(1).strip()

    # ------------------------------------------------------------------
    # Date d'introduction du recours
    # ------------------------------------------------------------------
    m = _RE_APPEAL_DATE.search(text)
    if m:
        result.appeal_date = m.group(1).strip()

    # ------------------------------------------------------------------
    # Date de la décision attaquée
    # ------------------------------------------------------------------
    m = _RE_ATTACKED_DATE.search(text)
    if m:
        result.attacked_decision_date = m.group(1).strip()

    return result


# ---------------------------------------------------------------------------
# CLI minimal pour test rapide
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python extract_metadata.py <chemin_fichier_texte>")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
        content = f.read()

    url_arg = sys.argv[2] if len(sys.argv) > 2 else None
    r = extract_metadata(content, pdf_url=url_arg)

    fields = [
        ("Numéro",          r.decision_number),
        ("ID",              r.decision_id),
        ("Date arrêt",      r.decision_date),
        ("Juge",            r.judge),
        ("Avocat",          r.lawyer),
        ("Défendeur",       r.defendant),
        ("Date recours",    r.appeal_date),
        ("Date décis. att.", r.attacked_decision_date),
    ]
    for label, value in fields:
        print(f"{label:20} : {value or '—'}")
    if r.extraction_notes:
        print("Notes :", r.extraction_notes)
