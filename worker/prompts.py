"""
Construction des prompts LLM par groupe de critères — R-Phase 2.

Règles :
- Le LLM ne reçoit jamais le texte complet de l'arrêt.
- Il reçoit uniquement les sections ciblées via get_sections_for_criteria_group().
- Le total texte passé est plafonné à MAX_PASSAGE_CHARS.
- Chaque section est annotée de son autorité source (CCE, CGRA, etc.).
- Si non trouvé, répondre status="not_mentioned" (jamais inventer).
- Confidence obligatoire si valeur trouvée (0.0-1.0).
"""

from __future__ import annotations

import json
from dataclasses import replace

from build_intermediate import IntermediateDocument, SectionEntry

MAX_PASSAGE_CHARS = 6500

# Plafond de caractères par groupe (surcharge MAX_PASSAGE_CHARS).
# decision_reasoning reçoit des sections potentiellement longues (acte_attaque,
# conclusion_cgra_ou_oe) — on augmente la fenêtre pour atteindre le raisonnement CCE.
GROUP_MAX_CHARS: dict[str, int] = {
    "decision_reasoning": 16000,
    "profile_vulnerability": 10000,
    "persecution_claims": 20000,   # acte_attaque + corpus_arret + conclusion_cgra_ou_oe
    "evidence_documents": 12000,   # inventaire COI dans acte_attaque parfois > 6500 chars
}

# Mapping groupe → section_ids prioritaires (ordre de pertinence).
# Inclut les anciens noms (fallback arrêts pré-Phase-1) ET les nouveaux.
GROUP_SECTIONS: dict[str, list[str]] = {
    "metadata": [
        # Header = texte avant le premier titre de section (date, numéro, chambre, juge, avocat)
        "header",
        # Dispositif : juge souvent nommé ici même quand le header est anonymisé
        "dispositif", "dictum",
        # Sections structurelles FR/NL (fallback si header absent)
        "corps_arret", "faits_invokes", "feitenrelaas",
        "acte_attaque", "bestreden_beslissing",
        "cadre_juridique", "juridisch_kader",
        # Anciens (fallback arrêts pré-Phase-1)
        "identite", "procedure",
    ],
    "procedure": [
        "cadre_juridique", "juridisch_kader",
        "acte_attaque", "bestreden_beslissing",
        "corps_arret", "corps_uitspraak",
        "en_droit", "in_rechte",
        "extreme_urgence", "uiterst_dringende_noodzakelijkheid",
        "jonction_affaires", "samenvoeging_zaken",
        "non_comparution",
        "procedure", "faits", "decision_attaquee",
    ],
    "identity": [
        # Header en premier : nationalité souvent uniquement là pour les arrêts non-DPI courts
        "header",
        "faits_invokes", "feitenrelaas",
        "corps_arret", "corps_uitspraak",
        "these_partie_requerante", "standpunt_verzoekende_partij",
        "acte_attaque", "bestreden_beslissing",
        "identite", "faits", "procedure",
    ],
    "profile_vulnerability": [
        "faits_invokes", "feitenrelaas",
        "corps_arret", "corps_uitspraak",
        "these_partie_requerante", "standpunt_verzoekende_partij",
        "motivation_cgra_ou_oe", "motivering_cgvs_of_dv",
        "faits", "identite", "arguments", "credibilite",
    ],
    "decision_reasoning": [
        # Sections spécifiques nommées (priorité absolue — courtes et ciblées)
        "article_48_7", "artikel_48_7",
        "article_3_cedh", "artikel_3_evrm",
        "article_8_cedh", "artikel_8_evrm",
        "appreciation_48_3", "appreciation_48_4",
        "appreciation_generale", "en_droit", "in_rechte",
        "beoordeling_vluchtelingenstatus",
        "beoordeling_subsidiaire_bescherming",
        "beoordeling",
        # Raisonnement CCE en fallback : souvent dans acte_attaque ou conclusion_cgra_ou_oe
        # Ces sections DOIVENT précéder motivation_cgra_ou_oe (très longue) pour être incluses
        "acte_attaque", "bestreden_beslissing",
        "conclusion_cgra_ou_oe", "conclusie_cgvs_of_dv",
        # Motivation CGRA (longue — arrivera tronquée mais partiellement utile)
        "motivation_cgra_ou_oe", "motivering_cgvs_of_dv",
        "dispositif", "dictum",
        "analyse", "cadre_juridique", "credibilite", "arguments",
        # Fallback pour arrêts non-DPI (3 sections) : faits_invokes contient tout
        "faits_invokes", "feitenrelaas",
        "corps_arret", "corps_uitspraak",
    ],
    "persecution_claims": [
        # acte_attaque contient le raisonnement CCE sur Art. 48/7 et les agents de persécution
        "acte_attaque", "bestreden_beslissing",
        "conclusion_cgra_ou_oe", "conclusie_cgvs_of_dv",
        "faits_invokes", "feitenrelaas",
        "corps_arret", "corps_uitspraak",
        "these_partie_requerante", "standpunt_verzoekende_partij",
        "motivation_cgra_ou_oe", "motivering_cgvs_of_dv",
        "nouveaux_elements", "nieuwe_elementen",
        "arguments", "faits", "analyse",
    ],
    "evidence_documents": [
        # acte_attaque contient souvent l'inventaire COI
        "acte_attaque", "bestreden_beslissing",
        "motivation_cgra_ou_oe", "motivering_cgvs_of_dv",
        "conclusion_cgra_ou_oe", "conclusie_cgvs_of_dv",
        "nouveaux_elements", "nieuwe_elementen",
        "faits_invokes", "feitenrelaas",
        "corps_arret", "corps_uitspraak",
        "documents", "analyse",
    ],
    "general": [
        "faits_invokes", "feitenrelaas",
        "corps_arret", "corps_uitspraak",
        "these_partie_requerante", "standpunt_verzoekende_partij",
        "article_48_7", "artikel_48_7",
        "en_droit", "appreciation_generale",
        "dispositif", "dictum",
        "faits", "analyse",
    ],
}

SYSTEM_PROMPT = """\
Tu es un extracteur de données juridiques. Tu lis des sections d'arrêts belges du CCE/RVV annotées par leur autorité source, et tu extrais des critères précis.

Règles ABSOLUES :
- Tu extrais UNIQUEMENT les informations présentes dans les sections fournies.
- Si une information est absente, tu retournes null et status="not_mentioned". JAMAIS de valeur inventée.
- Tu réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après le JSON.
- Tu utilises EXACTEMENT les criterion_id fournis, sans les modifier ni en inventer.
- confidence : 0.0 à 1.0, requis si status="found". Sois conservateur.
- evidence_excerpt : citation courte (max 150 car.) copiée mot pour mot de la section.
- source_authority : autorité de la section où tu trouves l'information (CCE, RvV, CGRA, CGVS, OE, DVZ, applicant, unknown).
- source_section : section_id de la section source (ex: "article_48_7", "faits_invokes").
- source_authority : UNIQUEMENT une de ces valeurs exactes : CCE, RvV, CGRA, CGVS, OE, DVZ, applicant, unknown.

Valeurs autorisées pour "status" :
  found           = information clairement présente
  not_mentioned   = information absente du texte fourni
  not_applicable  = critère ne s'applique pas à ce type de procédure
  ambiguous       = information présente mais contradictoire ou peu claire
  inferred        = information déduite indirectement (pas citée explicitement)
  conflicting     = informations contradictoires entre sections
  error           = impossible d'analyser ce critère

Détection du type de procédure (important pour not_applicable) :
- Si l'arrêt concerne UNIQUEMENT le séjour (OQT, 9bis, Dublin, visa étudiant, regroupement familial, cohabitation légale) et NON une DPI (demande de protection internationale/asile), utilise status="not_applicable" pour les critères exclusivement liés à l'asile : MGF/VGV, mariage forcé, crainte de persécution, crédibilité du récit d'asile, art. 48/7, agents de persécution, protection nationale au sens DPI, groupe social art. 48/3, durée procédure DPI.
- Les critères de métadonnées (date, numéro, juge, avocat, chambre) et la nationalité restent applicables à TOUS les types d'arrêts.
- Indices d'un arrêt NON-DPI : absence de "CGRA/CGVS", présence d'"OQT" / "ordre de quitter le territoire" / "9bis" / "Dublin" / "séjour étudiant" comme objet principal.

Pour les DPI, certains critères peuvent aussi être not_applicable :
- MGF/VGV, Réexcision/Herinfibulatie, Désinfibulation : si la DPI n'est PAS fondée sur des mutilations génitales féminines (aucune MGF/VGV invoquée dans les faits), retourne status="not_applicable". Ne retourne JAMAIS not_mentioned pour ces critères — soit la MGF est un motif de la DPI (status=found), soit elle ne s'applique pas à ce dossier (status=not_applicable).
- Mère célibataire / alleenstaande moeder : si le requérant est clairement masculin ou fait partie d'un couple marié, retourne not_applicable.
- Mariage forcé/précoce : si aucun mariage forcé n'est invoqué dans les faits, retourne not_mentioned (information potentiellement absente) OU not_applicable si le contexte exclut clairement ce motif.

Numéro d'arrêt :
- Le numéro de l'ARRÊT EXAMINÉ figure en première ou deuxième ligne du document : "n° XXX XXX du" (FR) ou "nr. XXX XXX van" (NL).
- Si une ligne mentionne un arrêt correctif ("VERBETERD DOOR HET ARREST NR..."), ignore ce numéro — il désigne un arrêt différent.
- Ne jamais retourner le numéro d'un autre arrêt cité dans le corps du texte (ex. "arrêt n° 281 845 du..." cité comme précédent).

VGV (critères NL uniquement) :
- VGV = Vrouwelijke Genitale Verminking = Mutilations Génitales Féminines (MGF en français).
- Ce critère concerne UNIQUEMENT les mutilations génitales féminines, pas d'autres formes de persécution.
- Si le sujet n'est pas abordé dans l'arrêt, retourner status="not_mentioned".
"""


def select_sections(
    intermediate: IntermediateDocument,
    group: str,
    max_chars: int = MAX_PASSAGE_CHARS,
) -> list[SectionEntry]:
    """
    Sélectionne les sections pertinentes pour le groupe de critères donné.
    Appelle get_sections_for_criteria_group() puis applique le plafond de caractères.
    Si aucune section ne correspond, retourne toutes les sections (fallback).
    """
    effective_max = GROUP_MAX_CHARS.get(group, max_chars)
    section_ids = GROUP_SECTIONS.get(group, [])
    candidates = intermediate.get_sections_for_criteria_group(section_ids)

    # Pas de fallback : si aucune section ne correspond au groupe, retourner []
    # → analyze_group affichera [SKIP] au lieu de passer du texte hors-sujet au LLM.
    if not candidates:
        return []

    result: list[SectionEntry] = []
    total = 0
    for sec in candidates:
        text = (sec.text or "").strip()
        if not text:
            continue
        if total + len(text) > effective_max:
            remaining = effective_max - total
            if remaining > 200:
                result.append(replace(sec, text=text[:remaining] + "\n[… tronqué …]"))
            break
        result.append(sec)
        total += len(text)

    return result


def build_prompt(
    arret_id: str,
    language: str,
    criterion_version: str,
    group: str,
    criteria: list[dict],    # [{id, label, type}, ...]
    sections: list[SectionEntry],
    procedure_type: str = "unknown",
) -> tuple[str, str]:
    """
    Construit le prompt pour un groupe de critères à partir de sections ciblées.
    Retourne (system_prompt, user_prompt) pour l'API chat.
    """
    lang_label = "français" if language == "fr" else "néerlandais"

    # Note procédurale : si non-DPI, tous les critères DPI sont not_applicable
    if procedure_type == "protection_internationale_fond":
        proc_note = ""
    elif procedure_type == "unknown":
        proc_note = ""
    else:
        proc_note = (
            f"\n⚠️ PROCÉDURE NON-DPI ({procedure_type}) : "
            "cet arrêt ne porte PAS sur une demande de protection internationale. "
            "Retourner status=\"not_applicable\" pour TOUS les critères liés à l'asile "
            "(crédibilité, Art. 48/7, agents de persécution/protection, protection subsidiaire, "
            "statut réfugié, CGRA/CGVS, fuite interne, groupe social, persécutions de genre, "
            "MGF/VGV, mariage forcé, motivation CGRA, motivation CCE sur le fond DPI, COI). "
            "Seules les métadonnées (date, numéro, juge, chambre, avocat) et la nationalité "
            "restent applicables à tous les types d'arrêts."
        )

    # Formater les sections avec leur en-tête d'autorité
    formatted: list[str] = []
    total_chars = 0
    for sec in sections:
        auth = sec.authority or "unknown"
        sid  = sec.section_id or "?"
        title = f" — {sec.title_detected}" if sec.title_detected else ""
        header = f"[Section: {sid} | Autorité: {auth}{title}]"
        formatted.append(f"{header}\n{sec.text}")
        total_chars += len(sec.text)

    joined = "\n\n---\n\n".join(formatted) if formatted else "(aucune section disponible)"

    # Critères avec IDs exacts
    criteria_lines = "\n".join(
        f'  {i+1}. id="{c["id"]}" | {c["label"]} | type={c["type"]}'
        for i, c in enumerate(criteria)
    )
    valid_ids_list = ", ".join(f'"{c["id"]}"' for c in criteria)

    ex_found = json.dumps({
        "criterion_id":      criteria[0]["id"] if criteria else "id_exemple",
        "value":             "exemple de valeur extraite",
        "confidence":        0.85,
        "evidence_excerpt":  "copie exacte du texte source (max 150 car.)",
        "source_authority":  "CCE",
        "source_section":    "article_48_7",
        "needs_human_review":False,
        "status":            "found",
    }, ensure_ascii=False)

    ex_absent = json.dumps({
        "criterion_id":      criteria[-1]["id"] if len(criteria) > 1 else "id_exemple_2",
        "value":             None,
        "confidence":        None,
        "evidence_excerpt":  None,
        "source_authority":  None,
        "source_section":    None,
        "needs_human_review":False,
        "status":            "not_mentioned",
    }, ensure_ascii=False)

    user_prompt = f"""Langue du document : {lang_label} ({language})
Groupe de critères : {group}
Type de procédure : {procedure_type}{proc_note}

## SECTIONS DE L'ARRÊT ({len(sections)} section(s), {total_chars} caractères)
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
