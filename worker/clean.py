"""
Nettoyage et segmentation du texte extrait des PDF CCE/RVV.

Étapes :
  1. Normaliser les espaces et les ligatures.
  2. Recoller les mots coupés par césure.
  3. Supprimer les en-têtes / pieds de page répétés.
  4. Supprimer les numéros de page isolés.
  5. Détecter les sections juridiques par leurs titres officiels (FR/NL).
  6. Attribuer une autorité à chaque section (CCE, CGRA, CGVS, OE, DVZ, applicant).
  7. Produire des segments avec métadonnées (section, authority, pages, quality_score).
  8. Découper les segments trop longs en sous-segments (max MAX_SEGMENT_CHARS).
  9. Suffixer les sections en double (_2, _3…) issues de titres répétés.

Aucun appel LLM ici.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from extract import PageText

# Taille max d'un segment en caractères (limite pour les appels LLM)
MAX_SEGMENT_CHARS = 3000


# ---------------------------------------------------------------------------
# Définitions de sections — par titre officiel
# Ordre : du plus spécifique au plus général (premier match gagne)
# Champ authority : "CCE" | "RvV" | "CGRA" | "CGVS" | "OE" | "DVZ" | "applicant" | "unknown"
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SectionDef:
    section_id: str
    authority: str
    pattern: re.Pattern[str]


def _p(regex: str) -> re.Pattern[str]:
    """Compile un pattern insensible à la casse avec ancre de début de chaîne."""
    return re.compile(regex, re.IGNORECASE)


# FR — dans l'ordre de spécificité décroissante
_SECTIONS_FR: list[SectionDef] = [
    # Articles spécifiques (les plus précis en premier)
    SectionDef("article_48_7",    "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:appr[eé]ciation\s+sous\s+l.{0,2}angle\s+de\s+l.{0,2}article\s+48/7|article\s+48/7)")),
    SectionDef("article_3_cedh",  "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?article\s+3(?:\s+de\s+la)?\s+CEDH")),
    SectionDef("article_8_cedh",  "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?article\s+8(?:\s+de\s+la)?\s+CEDH")),
    SectionDef("appreciation_48_3", "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?appr[eé]ciation\s+sous\s+l.{0,2}angle\s+de\s+l.{0,2}article\s+48/3")),
    SectionDef("appreciation_48_4", "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?appr[eé]ciation\s+sous\s+l.{0,2}angle\s+de\s+l.{0,2}article\s+48/4")),
    # Extrême urgence / OQT
    SectionDef("extreme_urgence",  "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:extr[eê]me\s+urgence|pr[eé]judice\s+grave\s+difficilement\s+r[eé]parable)")),
    SectionDef("non_comparution",  "CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:non.comparution|d[eé]faut\s+de\s+comparution)")),
    # Jonction et acte attaqué
    SectionDef("jonction_affaires", "CCE",
               _p(r"(?:\d+\.\s*)?jonction\s+des\s+affaires")),
    SectionDef("acte_attaque",     "CGRA",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:l['']acte\s+attaqu[eé]|d[eé]cision\s+attaqu[eé]e)")),
    # Délimiteur de début de corps (REND L'ARRET SUIVANT)
    SectionDef("corps_arret",      "CCE",
               _p(r"apr[eè]s\s+en\s+avoir\s+d[eé]lib[eé]r[eé],?\s*rend\s+l.{0,6}arr[eê]t\s+suivant")),
    # Sections structurelles principales — préfixe numérique (\d+.) ou lettre (A.) ou rien
    SectionDef("faits_invokes",    "CGRA",
               _p(r"(?:\d+\.\s*|[A-Z]\.\s*)?(?:les\s+)?faits\s+(?:pertinents\s+)?(?:de\s+la\s+cause|invoqu[eé]s)[.:]?$")),
    SectionDef("motivation_cgra_ou_oe", "CGRA",
               _p(r"(?:\d+\.\s*|[A-Z]\.\s*)?motivation[.:]?$")),
    SectionDef("conclusion_cgra_ou_oe", "CGRA",
               _p(r"(?:\d+\.\s*|[A-Z]\.\s*)?conclusion[.:]?$")),
    # En droit / Appréciation CCE (sections non-asile et sections CCE génériques)
    SectionDef("en_droit",         "CCE",
               _p(r"(?:\d+\.\s*)?en\s+droit[.:]?$")),
    SectionDef("appreciation_generale", "CCE",
               _p(r"(?:\d+\.\s*)?appr[eé]ciation(?:\s+(?:g[eé]n[eé]rale|du\s+conseil|de\s+la\s+demande))?[.:]?$")),
    SectionDef("cadre_juridique",  "CCE",
               _p(r"(?:\d+\.\s*)?(?:le\s+)?cadre\s+juridique(?:\s+de\s+l['']examen)?")),
    SectionDef("nouveaux_elements","CCE",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:les\s+)?nouveaux\s+[eé]l[eé]ments")),
    SectionDef("these_partie_requerante", "applicant",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?th[eè]se\s+de\s+la\s+partie\s+requ[eé]rante")),
    # Dispositif
    SectionDef("dispositif",       "CCE",
               _p(r"(?:par\s+ces\s+motifs|dispositif|PAR\s+CES\s+MOTIFS)")),
]

# NL — dans l'ordre de spécificité décroissante
_SECTIONS_NL: list[SectionDef] = [
    # Artikelen spécifiques
    SectionDef("artikel_48_7",    "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?artikel\s+48/7")),
    SectionDef("artikel_3_evrm",  "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?artikel\s+3\s+EVRM")),
    SectionDef("artikel_8_evrm",  "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?artikel\s+8\s+EVRM")),
    SectionDef("beoordeling_vluchtelingenstatus", "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:beoordeling\s+van\s+de\s+vluchteling|"
                  r"onderzoek\s+.{0,20}?\s*vluchtelingenstatus)")),
    SectionDef("beoordeling_subsidiaire_bescherming", "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?(?:beoordeling\s+van\s+de\s+subsidiaire|"
                  r"onderzoek\s+.{0,20}?\s*subsidiaire\s+beschermingsstatus)")),
    # Uiterst dringende noodzakelijkheid
    SectionDef("uiterst_dringende_noodzakelijkheid", "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?uiterst\s+dringende\s+noodzakelijkheid")),
    # Samenvoeging en bestreden beslissing
    SectionDef("samenvoeging_zaken",  "RvV",
               _p(r"(?:\d+\.\s*)?samenvoeging\s+van\s+de\s+zaken")),
    SectionDef("bestreden_beslissing","CGVS",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?de\s+bestreden\s+beslissing")),
    # Délimiteur de début de corps (NA BERAADSLAGING)
    SectionDef("corps_uitspraak",  "RvV",
               _p(r"na\s+beraadslaging.*geeft\s+de\s+volgende\s+uitspraak")),
    # Sections structurelles principales — préfixe numérique ou lettre
    SectionDef("feitenrelaas",    "CGVS",
               _p(r"(?:\d+\.\s*|[A-Z]\.\s*)?(?:de\s+)?(?:feiten(?:relaas)?|relevante\s+feiten\s+van\s+(?:de\s+zaak|het\s+geval))[.:]?$")),
    SectionDef("motivering_cgvs_of_dv", "CGVS",
               _p(r"(?:\d+\.\s*|[A-Z]\.\s*)?motivering[.:]?$")),
    SectionDef("conclusie_cgvs_of_dv", "CGVS",
               _p(r"(?:\d+\.\s*|[A-Z]\.\s*)?conclusie[.:]?$")),
    SectionDef("in_rechte",       "RvV",
               _p(r"(?:\d+\.\s*)?in\s+rechte[.:]?$")),
    SectionDef("juridisch_kader", "RvV",
               _p(r"(?:\d+\.\s*)?(?:het\s+)?juridisch\s+kader(?:\s+van\s+het\s+onderzoek)?")),
    SectionDef("nieuwe_elementen","RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?nieuwe\s+elementen")),
    SectionDef("standpunt_verzoekende_partij", "applicant",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?standpunt\s+van\s+de\s+verzoekende\s+partij")),
    SectionDef("beoordeling",     "RvV",
               _p(r"(?:\d+\.\s*|[a-z]\.\s*)?beoordeling$")),
    # Dictum
    SectionDef("dictum",          "RvV",
               _p(r"(?:om\s+deze\s+redenen|dictum|OM\s+DEZE\s+REDENEN)")),
]

# Toutes les définitions (FR puis NL — FR prioritaire en cas d'ambiguïté sur texte mixte)
_ALL_SECTIONS: list[SectionDef] = _SECTIONS_FR + _SECTIONS_NL

# Ligatures courantes dans les PDF juridiques
LIGATURE_MAP = str.maketrans({
    "ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl",
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", " ": " ",
})

# Numéro de page isolé (ligne = juste un chiffre)
_RE_PAGE_NUM = re.compile(r"^\s*\d{1,4}\s*$", re.MULTILINE)
# Césure de fin de ligne
_RE_HYPHEN = re.compile(r"(\w)-\n(\w)")
# Espaces multiples
_RE_SPACES = re.compile(r"[ \t]{2,}")
# Lignes vides multiples
_RE_BLANK_LINES = re.compile(r"\n{3,}")


# ---------------------------------------------------------------------------
# Dataclass Segment — compatible avec main.py existant
# ---------------------------------------------------------------------------
@dataclass
class Segment:
    segment_index: int
    section: str | None
    text: str
    page_start: int | None
    page_end: int | None
    quality_score: float = 0.0
    # Nouveaux champs (avec valeur par défaut → compatibilité main.py)
    authority: str = "unknown"
    section_title: str | None = None
    char_count: int = field(init=False)

    def __post_init__(self) -> None:
        self.char_count = len(self.text)


# ---------------------------------------------------------------------------
# Helpers de nettoyage de texte (inchangés)
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    text = text.replace("\x00", "")
    text = text.translate(LIGATURE_MAP)
    text = _RE_HYPHEN.sub(r"\1\2", text)
    text = _RE_SPACES.sub(" ", text)
    text = _RE_PAGE_NUM.sub("", text)
    text = _RE_BLANK_LINES.sub("\n\n", text)
    return text.strip()


def _detect_repeated_lines(pages: list[PageText], min_freq: int = 3) -> set[str]:
    """Lignes apparaissant dans ≥ min_freq pages → en-têtes/pieds de page."""
    line_pages: dict[str, set[int]] = {}
    for p in pages:
        for line in p.text.splitlines():
            line = line.strip()
            if len(line) < 4:
                continue
            line_pages.setdefault(line, set()).add(p.page_number)
    return {line for line, pnums in line_pages.items() if len(pnums) >= min_freq}


def _remove_repeated_lines(text: str, repeated: set[str]) -> str:
    if not repeated:
        return text
    return "\n".join(l for l in text.splitlines() if l.strip() not in repeated)


def _quality_score(text: str) -> float:
    """Score 0-1 basé sur la longueur et la densité de mots."""
    words = text.split()
    if not words:
        return 0.0
    avg_word_len = sum(len(w) for w in words) / len(words)
    length_score = min(len(text) / 2000, 1.0)
    density_score = min(avg_word_len / 6, 1.0)
    return round((length_score + density_score) / 2, 3)


# ---------------------------------------------------------------------------
# Détection de section par titre
# ---------------------------------------------------------------------------

def _match_section_title(line: str) -> SectionDef | None:
    """
    Vérifie si une ligne correspond au titre d'une section connue.
    Retourne la première définition dont le pattern correspond, ou None.
    """
    stripped = line.strip()
    if len(stripped) < 3 or len(stripped) > 120:
        return None
    for defn in _ALL_SECTIONS:
        if defn.pattern.match(stripped):
            return defn
    return None


def _find_section_boundaries(
    full_text: str,
) -> list[tuple[int, SectionDef, str]]:
    """
    Parcourt le texte ligne par ligne pour trouver les titres de section.
    Retourne [(char_position, SectionDef, matched_title), …] trié par position.
    """
    boundaries: list[tuple[int, SectionDef, str]] = []
    pos = 0
    for line in full_text.splitlines(keepends=True):
        defn = _match_section_title(line)
        if defn is not None:
            boundaries.append((pos, defn, line.strip()))
        pos += len(line)
    return boundaries


# ---------------------------------------------------------------------------
# Découpage des segments trop longs (inchangé)
# ---------------------------------------------------------------------------

def _split_oversized(
    text: str,
    section: str | None,
    authority: str,
    section_title: str | None,
    page_start: int | None,
    page_end: int | None,
    max_chars: int,
) -> list[tuple[str, str | None, str, str | None, int | None, int | None]]:
    """
    Découpe un texte trop long en sous-segments de max max_chars caractères.
    Coupe en priorité sur les paragraphes (\n\n), sinon sur les phrases.
    """
    if len(text) <= max_chars:
        return [(text, section, authority, section_title, page_start, page_end)]

    parts: list[tuple[str, str | None, str, str | None, int | None, int | None]] = []
    paras = re.split(r"\n{2,}", text)
    current = ""

    for para in paras:
        candidate = (current + "\n\n" + para).strip() if current else para
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                parts.append((current.strip(), section, authority, section_title, page_start, page_end))
            if len(para) > max_chars:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                sub = ""
                for sent in sentences:
                    candidate_sub = (sub + " " + sent).strip() if sub else sent
                    if len(candidate_sub) <= max_chars:
                        sub = candidate_sub
                    else:
                        if sub:
                            parts.append((sub.strip(), section, authority, section_title, page_start, page_end))
                        while len(sent) > max_chars:
                            parts.append((sent[:max_chars].strip(), section, authority, section_title, page_start, page_end))
                            sent = sent[max_chars:]
                        sub = sent
                if sub:
                    current = sub
                else:
                    current = ""
            else:
                current = para

    if current.strip():
        parts.append((current.strip(), section, authority, section_title, page_start, page_end))
    return parts


# ---------------------------------------------------------------------------
# Suffixage des sections répétées (_2, _3…) — uniquement entre blocs distincts
# ---------------------------------------------------------------------------

def _suffix_repeated_sections(
    blocks: list[tuple[str | None, str, str | None]],
) -> list[tuple[str | None, str, str | None]]:
    """
    Suffixe les section_id identiques parmi des blocs distincts.
    Entrée/sortie : liste de (section_id, authority, section_title).
    """
    from collections import Counter
    counts = Counter(b[0] for b in blocks)
    seen: dict[str | None, int] = {}
    result = []
    for section_id, authority, title in blocks:
        seen[section_id] = seen.get(section_id, 0) + 1
        if counts[section_id] > 1 and section_id is not None:
            new_id = f"{section_id}_{seen[section_id]}"
        else:
            new_id = section_id
        result.append((new_id, authority, title))
    return result


# ---------------------------------------------------------------------------
# Utilitaire : position → numéro de page
# ---------------------------------------------------------------------------

def _build_page_map(
    pages: list[PageText],
    cleaned_texts: list[str],
) -> list[tuple[int, int, int]]:
    """
    Retourne [(start_char, end_char, page_number), …] dans le texte concaténé.
    """
    boundaries: list[tuple[int, int, int]] = []
    pos = 0
    for page, clean in zip(pages, cleaned_texts):
        if clean:
            boundaries.append((pos, pos + len(clean), page.page_number))
            pos += len(clean) + 2  # +2 pour le séparateur "\n\n"
    return boundaries


def _char_to_page(char_pos: int, page_map: list[tuple[int, int, int]]) -> int | None:
    for start, end, page_num in page_map:
        if start <= char_pos < end:
            return page_num
    # Chercher le plus proche
    if page_map:
        return min(page_map, key=lambda x: abs(x[0] - char_pos))[2]
    return None


# ---------------------------------------------------------------------------
# Point d'entrée principal
# ---------------------------------------------------------------------------

def clean_and_segment(
    pages: list[PageText],
    min_segment_chars: int = 50,
    max_segment_chars: int = MAX_SEGMENT_CHARS,
) -> list[Segment]:
    """
    Nettoie le texte page par page, détecte les sections juridiques par
    leurs titres officiels, attribue une autorité à chaque section, puis
    découpe en segments de max_segment_chars caractères.

    Signature compatible avec main.py existant.
    """
    if not pages:
        return []

    # 1. Détecter les lignes répétées (en-têtes / pieds de page)
    repeated = _detect_repeated_lines(pages)

    # 2. Normaliser chaque page
    cleaned_texts: list[str] = []
    for p in pages:
        clean = _normalize(p.text)
        clean = _remove_repeated_lines(clean, repeated)
        cleaned_texts.append(clean.strip())

    # 3. Construire le texte complet + carte des pages
    full_text = "\n\n".join(t for t in cleaned_texts if t)
    page_map = _build_page_map(pages, cleaned_texts)

    if not full_text.strip():
        return []

    # 4. Trouver les frontières de sections par leurs titres
    boundaries = _find_section_boundaries(full_text)

    # 5. Découper en blocs de section
    raw_blocks: list[tuple[str, str | None, str, str | None]] = []
    # = list of (text, section_id, authority, section_title)

    if not boundaries:
        # Pas de titre détecté → un seul bloc "unknown"
        raw_blocks.append((full_text, None, "unknown", None))
    else:
        # Texte avant le premier titre → "header"
        first_pos = boundaries[0][0]
        header_text = full_text[:first_pos].strip()
        if len(header_text) >= min_segment_chars:
            raw_blocks.append((header_text, "header", "CCE", None))

        # Blocs entre chaque paire de frontières consécutives
        for i, (pos, defn, title) in enumerate(boundaries):
            next_pos = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(full_text)
            block_text = full_text[pos:next_pos].strip()
            # Retirer le titre lui-même de la première ligne du bloc
            first_newline = block_text.find("\n")
            content = block_text[first_newline:].strip() if first_newline != -1 else ""
            # Conserver les sections courtes (header, dispositif…) — le filtre
            # min_segment_chars s'applique uniquement au niveau des segments finaux.
            if content:
                raw_blocks.append((content, defn.section_id, defn.authority, title))
            elif block_text:
                raw_blocks.append((block_text, defn.section_id, defn.authority, title))

    # 6. Suffixer les sections en double
    block_meta = [(b[1], b[2], b[3]) for b in raw_blocks]
    suffixed_meta = _suffix_repeated_sections(block_meta)

    # 7. Découper les blocs trop longs en sous-segments
    exploded: list[tuple[str, str | None, str, str | None, int | None, int | None]] = []
    for (text, _, _, _), (section_id, authority, title) in zip(raw_blocks, suffixed_meta):
        # Estimer les pages du bloc depuis la carte
        start_char = full_text.find(text[:50]) if text else 0
        start_page = _char_to_page(max(0, start_char), page_map)
        end_char = start_char + len(text)
        end_page = _char_to_page(min(end_char, len(full_text) - 1), page_map)

        parts = _split_oversized(text, section_id, authority, title, start_page, end_page, max_segment_chars)
        exploded.extend(parts)

    # 8. Construire les objets Segment finaux
    idx = 0
    segments: list[Segment] = []
    for text, section, authority, title, p_start, p_end in exploded:
        if text.strip() and len(text.strip()) >= min_segment_chars:
            segments.append(Segment(
                segment_index=idx,
                section=section,
                text=text,
                page_start=p_start,
                page_end=p_end,
                quality_score=_quality_score(text),
                authority=authority,
                section_title=title,
            ))
            idx += 1

    return segments
