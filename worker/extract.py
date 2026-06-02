"""
Téléchargement et extraction de texte depuis un PDF public.

Pipeline :
  1. Télécharger le PDF dans un fichier temporaire.
  2. Extraire avec PyMuPDF (premier choix).
  3. Détecter si le résultat est insuffisant (PDF scanné).
  4. Fallback vers pdfplumber si nécessaire.
  5. Supprimer le fichier temporaire dans tous les cas.
  6. Retourner les métadonnées + texte brut par page.

Le texte n'est jamais envoyé à un LLM ici.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import requests


# Seuil : si moins de MIN_CHARS_PER_PAGE caractères en moyenne → probable scanné
MIN_CHARS_PER_PAGE = 100
# Seuil absolu : si moins de MIN_TOTAL_CHARS pour tout le doc → extraction vide
MIN_TOTAL_CHARS = 200
# Timeout de téléchargement en secondes
DOWNLOAD_TIMEOUT = 60
# Taille max acceptée en octets (20 Mo)
MAX_FILE_SIZE = 20 * 1024 * 1024


@dataclass
class PageText:
    page_number: int  # 1-based
    text: str
    char_count: int = field(init=False)

    def __post_init__(self) -> None:
        self.char_count = len(self.text)


@dataclass
class ExtractionResult:
    method: str  # 'pymupdf' | 'pdfplumber' | 'ocr' | 'failed'
    page_count: int
    pages: list[PageText]
    is_scanned: bool
    char_count: int
    text_hash: str
    error_message: str | None = None

    @property
    def full_text(self) -> str:
        return "\n\n".join(p.text for p in self.pages if p.text.strip())


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,*/*",
}


def download_pdf(url: str) -> Path:
    """Télécharge le PDF vers un fichier temporaire et retourne son chemin."""
    response = requests.get(url, headers=_HEADERS, timeout=DOWNLOAD_TIMEOUT, stream=True)
    response.raise_for_status()

    content_length = int(response.headers.get("Content-Length", 0))
    if content_length and content_length > MAX_FILE_SIZE:
        raise ValueError(f"PDF trop lourd : {content_length // 1024} Ko (max {MAX_FILE_SIZE // 1024} Ko)")

    suffix = ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=_tmp_dir())
    size = 0
    try:
        for chunk in response.iter_content(chunk_size=65536):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                tmp.close()
                os.unlink(tmp.name)
                raise ValueError(f"PDF trop lourd (>{MAX_FILE_SIZE // 1024} Ko)")
            tmp.write(chunk)
        tmp.flush()
        return Path(tmp.name)
    except Exception:
        tmp.close()
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)
        raise
    finally:
        tmp.close()


def _tmp_dir() -> Path:
    """Retourne (et crée si besoin) le dossier temporaire local."""
    base = Path(__file__).parent.parent / ".tmp" / "pdf-cache"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _extract_with_pymupdf(pdf_path: Path) -> list[PageText]:
    import fitz  # PyMuPDF

    pages: list[PageText] = []
    with fitz.open(str(pdf_path)) as doc:
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text")
            pages.append(PageText(page_number=i, text=text))
    return pages


def _extract_with_pdfplumber(pdf_path: Path) -> list[PageText]:
    import pdfplumber

    pages: list[PageText] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            pages.append(PageText(page_number=i, text=text))
    return pages


def _is_scanned(pages: list[PageText]) -> bool:
    if not pages:
        return True
    total = sum(p.char_count for p in pages)
    avg = total / len(pages)
    return avg < MIN_CHARS_PER_PAGE or total < MIN_TOTAL_CHARS


def _hash_text(pages: list[PageText]) -> str:
    combined = "".join(p.text for p in pages)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def extract_from_url(url: str) -> ExtractionResult:
    """Point d'entrée principal. Télécharge, extrait, supprime le PDF temporaire."""
    pdf_path: Path | None = None
    try:
        pdf_path = download_pdf(url)

        # --- Tentative PyMuPDF ---
        try:
            pages = _extract_with_pymupdf(pdf_path)
            method = "pymupdf"
        except Exception as e:
            pages = []
            method = "failed"
            # On essaie quand même pdfplumber ci-dessous

        # --- Fallback pdfplumber si pymupdf a échoué ou résultat insuffisant ---
        if method == "failed" or _is_scanned(pages):
            try:
                pages_fb = _extract_with_pdfplumber(pdf_path)
                if not _is_scanned(pages_fb):
                    pages = pages_fb
                    method = "pdfplumber"
                elif method == "pymupdf":
                    # pymupdf avait réussi mais résultat maigre ; garder pymupdf
                    pass
            except Exception:
                pass  # on garde ce qu'on a

        scanned = _is_scanned(pages)
        char_count = sum(p.char_count for p in pages)
        text_hash = _hash_text(pages) if pages else ""

        if char_count < MIN_TOTAL_CHARS:
            method = "failed" if not pages else method
            return ExtractionResult(
                method=method,
                page_count=len(pages),
                pages=pages,
                is_scanned=scanned,
                char_count=char_count,
                text_hash=text_hash,
                error_message="Texte extrait insuffisant — PDF probablement scanné ou vide",
            )

        return ExtractionResult(
            method=method,
            page_count=len(pages),
            pages=pages,
            is_scanned=scanned,
            char_count=char_count,
            text_hash=text_hash,
        )

    except requests.HTTPError as e:
        return ExtractionResult(
            method="failed",
            page_count=0,
            pages=[],
            is_scanned=False,
            char_count=0,
            text_hash="",
            error_message=f"HTTP {e.response.status_code} — {url}",
        )
    except Exception as e:
        return ExtractionResult(
            method="failed",
            page_count=0,
            pages=[],
            is_scanned=False,
            char_count=0,
            text_hash="",
            error_message=str(e),
        )
    finally:
        if pdf_path and pdf_path.exists():
            os.unlink(pdf_path)
