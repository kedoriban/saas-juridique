"""
Nettoyage et segmentation du texte extrait des PDF CCE/RVV.

Étapes :
  1. Normaliser les espaces et les ligatures.
  2. Recoller les mots coupés par césure.
  3. Supprimer les en-têtes / pieds de page répétés.
  4. Supprimer les numéros de page isolés.
  5. Détecter les sections juridiques connues.
  6. Produire des segments avec métadonnées (section, pages, quality_score).
  7. Découper les segments trop longs en sous-segments (max MAX_SEGMENT_CHARS).
  8. Suffixer les occurrences répétées d'une même section (_2, _3…).

Aucun appel LLM ici.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from extract import PageText

# Taille max d'un segment en caractères (limite pour les appels LLM phase 5)
MAX_SEGMENT_CHARS = 3000


# ---------------------------------------------------------------------------
# Sections juridiques cibles (patterns FR + NL)
# ---------------------------------------------------------------------------
SECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("identite",            re.compile(r"\b(identit[eé]|nationalit[eé]|identiteit|nationaliteit)\b", re.I)),
    ("procedure",           re.compile(r"\b(proc[eé]dure|demande ult[eé]rieure|tweede verzoek|procedure)\b", re.I)),
    ("faits",               re.compile(r"\b(faits|en fait|in feite|feiten)\b", re.I)),
    ("decision_attaquee",   re.compile(r"\b(d[eé]cision attaqu[eé]e|bestreden beslissing|CGRA|DVZ|OE)\b", re.I)),
    ("arguments",           re.compile(r"\b(argument|grief|moyen|middel|aanvoert)\b", re.I)),
    ("documents",           re.compile(r"\b(document|pi[eè]ce|rapport m[eé]dical|medisch rapport|medische|psychologisch)\b", re.I)),
    ("analyse",             re.compile(r"\b(analyse|examen|beoordeling|conseil)\b", re.I)),
    ("credibilite",         re.compile(r"\b(cr[eé]dibilit[eé]|geloofwaardigheid|b[eé]n[eé]fice du doute|voordeel van de twijfel)\b", re.I)),
    ("protection",          re.compile(r"\b(protection nationale|fuite interne|interne bescherming|binnenlandse vlucht)\b", re.I)),
    ("dispositif",          re.compile(r"\b(dispositif|par ces motifs|om deze redenen|d[eé]cide|beslist)\b", re.I)),
]

# Ligatures courantes dans les PDF juridiques
LIGATURE_MAP = str.maketrans({
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬀ": "ff",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "’": "'",
    "‘": "'",
    "“": '"',
    "”": '"',
    "–": "-",
    "—": "-",
    " ": " ",
})

# Détection de numéro de page isolé (ligne = juste un chiffre + espace)
_RE_PAGE_NUM = re.compile(r"^\s*\d{1,4}\s*$", re.MULTILINE)
# Césure de fin de ligne : mot-\n suite du mot
_RE_HYPHEN = re.compile(r"(\w)-\n(\w)")
# Espaces multiples
_RE_SPACES = re.compile(r"[ \t]{2,}")
# Lignes vides multiples
_RE_BLANK_LINES = re.compile(r"\n{3,}")


@dataclass
class Segment:
    segment_index: int
    section: str | None
    text: str
    page_start: int | None
    page_end: int | None
    quality_score: float = 0.0
    char_count: int = field(init=False)

    def __post_init__(self) -> None:
        self.char_count = len(self.text)


def _normalize(text: str) -> str:
    text = text.replace("\x00", "")  # null bytes rejetés par Postgres
    text = text.translate(LIGATURE_MAP)
    text = _RE_HYPHEN.sub(r"\1\2", text)
    text = _RE_SPACES.sub(" ", text)
    text = _RE_PAGE_NUM.sub("", text)
    text = _RE_BLANK_LINES.sub("\n\n", text)
    return text.strip()


def _detect_repeated_lines(pages: list[PageText], min_freq: int = 3) -> set[str]:
    """Trouve les lignes apparaissant dans min_freq pages ou plus → en-têtes/pieds."""
    from collections import Counter
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
    lines = text.splitlines()
    cleaned = [l for l in lines if l.strip() not in repeated]
    return "\n".join(cleaned)


def _detect_section(text: str) -> str | None:
    for name, pattern in SECTION_PATTERNS:
        if pattern.search(text):
            return name
    return None


def _quality_score(text: str) -> float:
    """Score 0-1 basé sur la longueur et la densité de mots."""
    words = text.split()
    if not words:
        return 0.0
    avg_word_len = sum(len(w) for w in words) / len(words)
    length_score = min(len(text) / 2000, 1.0)
    density_score = min(avg_word_len / 6, 1.0)
    return round((length_score + density_score) / 2, 3)


def _split_oversized(
    text: str,
    section: str | None,
    page_start: int | None,
    page_end: int | None,
    max_chars: int,
) -> list[tuple[str, str | None, int | None, int | None]]:
    """
    Découpe un texte trop long en sous-segments d'au plus max_chars caractères,
    en coupant sur les limites de paragraphe (\n\n) ou à défaut sur les phrases.
    Retourne une liste de (text, section, page_start, page_end).
    La page_end est approximative pour les sous-segments intermédiaires.
    """
    if len(text) <= max_chars:
        return [(text, section, page_start, page_end)]

    parts: list[tuple[str, str | None, int | None, int | None]] = []
    # Découper d'abord sur les doubles sauts de ligne
    paras = re.split(r"\n{2,}", text)
    current = ""
    for para in paras:
        candidate = (current + "\n\n" + para).strip() if current else para
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                parts.append((current.strip(), section, page_start, page_end))
            # Si le seul paragraphe dépasse déjà max_chars, couper sur les phrases
            if len(para) > max_chars:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                sub = ""
                for sent in sentences:
                    candidate_sub = (sub + " " + sent).strip() if sub else sent
                    if len(candidate_sub) <= max_chars:
                        sub = candidate_sub
                    else:
                        if sub:
                            parts.append((sub.strip(), section, page_start, page_end))
                        # Phrase seule encore trop longue → tronquer brutalement
                        while len(sent) > max_chars:
                            parts.append((sent[:max_chars].strip(), section, page_start, page_end))
                            sent = sent[max_chars:]
                        sub = sent
                if sub:
                    current = sub
                else:
                    current = ""
            else:
                current = para
    if current.strip():
        parts.append((current.strip(), section, page_start, page_end))
    return parts


def _suffix_repeated_sections(segments: list[Segment]) -> None:
    """Ajoute _2, _3… au champ section pour les occurrences répétées."""
    counts: dict[str, int] = {}
    for seg in segments:
        key = seg.section or ""
        counts[key] = counts.get(key, 0) + 1
    seen: dict[str, int] = {}
    for seg in segments:
        key = seg.section or ""
        seen[key] = seen.get(key, 0) + 1
        if counts[key] > 1 and seg.section is not None:
            seg.section = f"{seg.section}_{seen[key]}"


def clean_and_segment(
    pages: list[PageText],
    min_segment_chars: int = 150,
    max_segment_chars: int = MAX_SEGMENT_CHARS,
) -> list[Segment]:
    """
    Nettoie le texte, détecte les sections juridiques, découpe en segments
    d'au plus max_segment_chars caractères, et suffixe les sections répétées.
    """
    if not pages:
        return []

    repeated = _detect_repeated_lines(pages)

    annotated: list[tuple[str, int]] = []
    for p in pages:
        clean = _normalize(p.text)
        clean = _remove_repeated_lines(clean, repeated)
        if clean.strip():
            annotated.append((clean.strip(), p.page_number))

    # Accumuler les paragraphes par section détectée
    raw_segments: list[tuple[str, str | None, int | None, int | None]] = []
    current_section: str | None = None
    current_chunks: list[str] = []
    current_page_start: int | None = None
    current_page_end: int | None = None

    def flush() -> None:
        nonlocal current_chunks, current_page_start, current_page_end
        combined = "\n\n".join(current_chunks).strip()
        if len(combined) >= min_segment_chars:
            raw_segments.append((combined, current_section, current_page_start, current_page_end))
        current_chunks.clear()
        current_page_start = None
        current_page_end = None

    for text_block, page_num in annotated:
        for para in re.split(r"\n{2,}", text_block):
            para = para.strip()
            if not para:
                continue
            detected = _detect_section(para)

            if detected and detected != current_section and current_chunks:
                flush()
                current_section = detected
            if current_section is None and detected:
                current_section = detected

            current_chunks.append(para)
            if current_page_start is None:
                current_page_start = page_num
            current_page_end = page_num

    if current_chunks:
        flush()

    # Découper les segments trop longs
    exploded: list[tuple[str, str | None, int | None, int | None]] = []
    for text, section, p_start, p_end in raw_segments:
        exploded.extend(_split_oversized(text, section, p_start, p_end, max_segment_chars))

    # Construire les objets Segment finaux
    segments = [
        Segment(
            segment_index=i,
            section=section,
            text=text,
            page_start=p_start,
            page_end=p_end,
            quality_score=_quality_score(text),
        )
        for i, (text, section, p_start, p_end) in enumerate(exploded)
    ]

    # Suffixer les sections répétées
    _suffix_repeated_sections(segments)

    return segments
