"""
Assembleur du JSON intermédiaire stable pour un arrêt CCE/RVV.

Agrège les sorties de tous les modules de prétraitement :
  - detect_language     → langue + confiance
  - classify_procedure  → type de procédure + signaux
  - extract_metadata    → juge, avocat, dates, numéro
  - detect_applicants   → structure des demandeurs
  - clean_and_segment   → sections nettoyées avec autorité

Produit un IntermediateDocument sérialisable en JSON, sauvegardable sur
disque, utilisable comme artefact stable avant tout appel LLM.

Le LLM ne reçoit jamais les PDF ni l'intégralité du texte : il reçoit
uniquement les sections ciblées extraites de ce JSON intermédiaire.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

from clean import Segment
from detect_language import detect_language
from classify_procedure import classify_procedure
from extract_metadata import extract_metadata
from detect_applicants import detect_applicants

try:
    from extract import ExtractionResult
except ImportError:
    ExtractionResult = object  # type: ignore[misc,assignment]


# ---------------------------------------------------------------------------
# Dataclasses de sortie
# ---------------------------------------------------------------------------

@dataclass
class DocumentInfo:
    pdf_url: str
    decision_id: str | None
    decision_number: str | None
    language: str
    language_confidence: float
    procedure_type: str
    procedure_confidence: float
    requires_main_criteria: bool
    procedure_signals: list[str]
    decision_date: str | None


@dataclass
class ExtractionQuality:
    method: str
    pages_count: int
    text_length: int
    ocr_used: bool
    quality_score: float
    requires_human_review: bool
    review_reasons: list[str]


@dataclass
class MetadataDetected:
    judge: str | None
    lawyer: str | None
    defendant: str | None
    appeal_date: str | None
    attacked_decision_date: str | None
    extraction_notes: list[str]


@dataclass
class ApplicantsDetection:
    is_multi_applicant: bool
    applicant_count: int | None
    jonction: bool
    family_signals: bool
    detection_notes: list[str]


@dataclass
class ApplicantEntry:
    applicant_id: str
    role: str
    detected_gender: str
    criteria_scope: str


@dataclass
class SectionEntry:
    section_id: str | None
    title_detected: str | None
    start_page: int | None
    end_page: int | None
    authority: str
    text: str


@dataclass
class IntermediateDocument:
    document: DocumentInfo
    extraction_quality: ExtractionQuality
    metadata_detected: MetadataDetected
    applicants_detection: ApplicantsDetection
    applicants: list[ApplicantEntry]
    sections: list[SectionEntry]

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(self.to_json(), encoding="utf-8")

    @classmethod
    def from_dict(cls, data: dict) -> "IntermediateDocument":
        """Reconstruit depuis un dict sérialisé (cache JSON ou Supabase jsonb)."""
        d  = data.get("document", {})
        q  = data.get("extraction_quality", {})
        m  = data.get("metadata_detected", {})
        ad = data.get("applicants_detection", {})
        return cls(
            document=DocumentInfo(
                pdf_url=d.get("pdf_url", ""),
                decision_id=d.get("decision_id"),
                decision_number=d.get("decision_number"),
                language=d.get("language", "unknown"),
                language_confidence=float(d.get("language_confidence") or 0.0),
                procedure_type=d.get("procedure_type", "unknown"),
                procedure_confidence=float(d.get("procedure_confidence") or 0.0),
                requires_main_criteria=bool(d.get("requires_main_criteria", True)),
                procedure_signals=list(d.get("procedure_signals") or []),
                decision_date=d.get("decision_date"),
            ),
            extraction_quality=ExtractionQuality(
                method=q.get("method", "unknown"),
                pages_count=int(q.get("pages_count") or 0),
                text_length=int(q.get("text_length") or 0),
                ocr_used=bool(q.get("ocr_used", False)),
                quality_score=float(q.get("quality_score") or 0.0),
                requires_human_review=bool(q.get("requires_human_review", False)),
                review_reasons=list(q.get("review_reasons") or []),
            ),
            metadata_detected=MetadataDetected(
                judge=m.get("judge"),
                lawyer=m.get("lawyer"),
                defendant=m.get("defendant"),
                appeal_date=m.get("appeal_date"),
                attacked_decision_date=m.get("attacked_decision_date"),
                extraction_notes=list(m.get("extraction_notes") or []),
            ),
            applicants_detection=ApplicantsDetection(
                is_multi_applicant=bool(ad.get("is_multi_applicant", False)),
                applicant_count=ad.get("applicant_count"),
                jonction=bool(ad.get("jonction", False)),
                family_signals=bool(ad.get("family_signals", False)),
                detection_notes=list(ad.get("detection_notes") or []),
            ),
            applicants=[
                ApplicantEntry(
                    applicant_id=a.get("applicant_id", ""),
                    role=a.get("role", ""),
                    detected_gender=a.get("detected_gender", "unknown"),
                    criteria_scope=a.get("criteria_scope", ""),
                )
                for a in (data.get("applicants") or [])
            ],
            sections=[
                SectionEntry(
                    section_id=s.get("section_id"),
                    title_detected=s.get("title_detected"),
                    start_page=s.get("start_page"),
                    end_page=s.get("end_page"),
                    authority=s.get("authority", "unknown"),
                    text=s.get("text", ""),
                )
                for s in (data.get("sections") or [])
            ],
        )

    def get_sections_by_id(self, section_id: str) -> list[SectionEntry]:
        """Retourne toutes les sections dont l'ID commence par section_id."""
        return [s for s in self.sections if s.section_id == section_id
                or (s.section_id or "").startswith(section_id + "_")]

    def get_sections_for_criteria_group(self, section_ids: list[str]) -> list[SectionEntry]:
        """
        Retourne les sections utiles pour un groupe de critères donné.
        Utilisé par analyze.py pour cibler les sections avant d'appeler le LLM.
        """
        result: list[SectionEntry] = []
        seen: set[str | None] = set()
        for sid in section_ids:
            for sec in self.sections:
                if sec.section_id == sid or (sec.section_id or "").startswith(sid + "_"):
                    if sec.section_id not in seen:
                        result.append(sec)
                        seen.add(sec.section_id)
        return result


# ---------------------------------------------------------------------------
# Helpers internes
# ---------------------------------------------------------------------------

def _compute_quality_score(segments: list[Segment]) -> float:
    """Score moyen pondéré par le nombre de caractères."""
    if not segments:
        return 0.0
    total_chars = sum(s.char_count for s in segments)
    if total_chars == 0:
        return 0.0
    weighted = sum(s.quality_score * s.char_count for s in segments)
    return round(weighted / total_chars, 3)


def _merge_segments_into_sections(segments: list[Segment]) -> list[SectionEntry]:
    """
    Regroupe les sous-segments d'une même section en un seul SectionEntry.
    Les sous-segments partagent le même section_id (résultat du découpage long).
    Les sections en double (suffixées _2, _3) restent distinctes.
    """
    merged: dict[str | None, SectionEntry] = {}
    order: list[str | None] = []

    for seg in sorted(segments, key=lambda s: s.segment_index):
        sid = seg.section

        if sid not in merged:
            order.append(sid)
            merged[sid] = SectionEntry(
                section_id=sid,
                title_detected=seg.section_title,
                start_page=seg.page_start,
                end_page=seg.page_end,
                authority=seg.authority,
                text=seg.text,
            )
        else:
            entry = merged[sid]
            entry.text = entry.text + "\n\n" + seg.text
            if seg.page_end is not None:
                entry.end_page = max(entry.end_page or 0, seg.page_end)

    return [merged[sid] for sid in order]


def _detect_human_review_reasons(
    extraction_result,
    language: str,
    procedure_type: str,
    language_confidence: float,
    procedure_confidence: float,
    is_scanned: bool,
) -> list[str]:
    reasons: list[str] = []
    if is_scanned:
        reasons.append("PDF scanné — extraction OCR, qualité potentiellement dégradée")
    if language == "unknown":
        reasons.append("Langue non détectée avec certitude")
    elif language_confidence < 0.70:
        reasons.append(f"Confiance langue faible ({language_confidence:.0%})")
    if procedure_type == "unknown":
        reasons.append("Type de procédure non identifié")
    elif procedure_confidence < 0.60:
        reasons.append(f"Confiance procédure faible ({procedure_confidence:.0%})")
    return reasons


# ---------------------------------------------------------------------------
# Fonction principale
# ---------------------------------------------------------------------------

def build_intermediate(
    pdf_url: str,
    extraction_result,          # ExtractionResult de extract.py
    segments: list[Segment],
) -> IntermediateDocument:
    """
    Construit le document JSON intermédiaire stable à partir des résultats
    d'extraction et de segmentation.

    Appelle en interne tous les modules de détection sur le texte complet.
    """
    # Texte complet (concaténation des segments — déjà nettoyé)
    full_text = "\n\n".join(s.text for s in sorted(segments, key=lambda x: x.segment_index))

    # ------------------------------------------------------------------
    # Détections
    # ------------------------------------------------------------------
    lang_result = detect_language(full_text)
    proc_result = classify_procedure(full_text)
    meta_result = extract_metadata(full_text, pdf_url=pdf_url)
    appl_result = detect_applicants(full_text)

    # ------------------------------------------------------------------
    # Qualité d'extraction
    # ------------------------------------------------------------------
    doc_quality_score = _compute_quality_score(segments)
    is_scanned = getattr(extraction_result, "is_scanned", False)
    review_reasons = _detect_human_review_reasons(
        extraction_result=extraction_result,
        language=lang_result.language,
        procedure_type=proc_result.procedure_type,
        language_confidence=lang_result.confidence,
        procedure_confidence=proc_result.confidence,
        is_scanned=is_scanned,
    )

    extraction_quality = ExtractionQuality(
        method=getattr(extraction_result, "method", "unknown"),
        pages_count=getattr(extraction_result, "page_count", 0),
        text_length=getattr(extraction_result, "char_count", len(full_text)),
        ocr_used=is_scanned,
        quality_score=doc_quality_score,
        requires_human_review=bool(review_reasons),
        review_reasons=review_reasons,
    )

    # ------------------------------------------------------------------
    # Document
    # ------------------------------------------------------------------
    document = DocumentInfo(
        pdf_url=pdf_url,
        decision_id=meta_result.decision_id,
        decision_number=meta_result.decision_number,
        language=lang_result.language,
        language_confidence=lang_result.confidence,
        procedure_type=proc_result.procedure_type,
        procedure_confidence=proc_result.confidence,
        requires_main_criteria=proc_result.requires_main_criteria,
        procedure_signals=proc_result.signals,
        decision_date=meta_result.decision_date,
    )

    # ------------------------------------------------------------------
    # Métadonnées
    # ------------------------------------------------------------------
    metadata_detected = MetadataDetected(
        judge=meta_result.judge,
        lawyer=meta_result.lawyer,
        defendant=meta_result.defendant,
        appeal_date=meta_result.appeal_date,
        attacked_decision_date=meta_result.attacked_decision_date,
        extraction_notes=meta_result.extraction_notes,
    )

    # ------------------------------------------------------------------
    # Demandeurs
    # ------------------------------------------------------------------
    applicants_detection = ApplicantsDetection(
        is_multi_applicant=appl_result.is_multi_applicant,
        applicant_count=appl_result.applicant_count,
        jonction=appl_result.jonction,
        family_signals=appl_result.family_signals,
        detection_notes=appl_result.detection_notes,
    )

    applicants = [
        ApplicantEntry(
            applicant_id=a.applicant_id,
            role=a.role,
            detected_gender=a.detected_gender,
            criteria_scope=a.criteria_scope,
        )
        for a in appl_result.applicants
    ]

    # ------------------------------------------------------------------
    # Sections
    # ------------------------------------------------------------------
    sections = _merge_segments_into_sections(segments)

    return IntermediateDocument(
        document=document,
        extraction_quality=extraction_quality,
        metadata_detected=metadata_detected,
        applicants_detection=applicants_detection,
        applicants=applicants,
        sections=sections,
    )


# ---------------------------------------------------------------------------
# CLI minimal pour test rapide
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python build_intermediate.py <pdf_url> [output.json]")
        sys.exit(1)

    # Test avec une URL réelle (nécessite PyMuPDF + réseau)
    from extract import extract_from_url
    from clean import clean_and_segment

    url = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "intermediate_test.json"

    print(f"Extraction : {url}")
    result = extract_from_url(url)
    print(f"  Méthode  : {result.method} | {result.page_count} pages | {result.char_count} chars")

    segs = clean_and_segment(result.pages)
    print(f"  Segments : {len(segs)}")

    doc = build_intermediate(url, result, segs)
    doc.save(out_path)

    print(f"\nDocument intermédiaire sauvegardé : {out_path}")
    print(f"  Langue          : {doc.document.language} ({doc.document.language_confidence:.0%})")
    print(f"  Procédure       : {doc.document.procedure_type} ({doc.document.procedure_confidence:.0%})")
    print(f"  Numéro          : {doc.document.decision_id}")
    print(f"  Date            : {doc.document.decision_date}")
    print(f"  Juge            : {doc.metadata_detected.judge}")
    print(f"  Multi-demand.   : {doc.applicants_detection.is_multi_applicant}")
    print(f"  Sections        : {[s.section_id for s in doc.sections]}")
    print(f"  Revue humaine   : {doc.extraction_quality.requires_human_review}")
    if doc.extraction_quality.review_reasons:
        for r in doc.extraction_quality.review_reasons:
            print(f"    - {r}")
