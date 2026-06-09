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
    "evidence_documents": 25000,   # 40 000 cause explosion tokens (acte_attaque_2 > 38 000 chars sur DPI) ; 341962 COI à pos 29 753 = cas limite accepté
}

# Plafond par section-type pour un groupe (évite qu'une section absorbe tout le budget).
# Ex : acte_attaque_2 de 341960 = 38 853 chars → explosion output tokens à 40 000 budget.
GROUP_SECTION_MAX: dict[str, dict[str, int]] = {
    "evidence_documents": {
        "acte_attaque":          10000,  # acte_attaque_2 peut dépasser 38 000 chars
        "bestreden_beslissing":  10000,
    }
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
        # DISPOSITIF EN PREMIER : contient la décision finale (fr_036) — court et décisif
        "dispositif", "dictum",
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
        # acte_attaque en premier (COI souvent cité tôt) — mais capé à 10 000 chars par GROUP_SECTION_MAX
        "acte_attaque", "bestreden_beslissing",
        # conclusion ensuite : pour 341962 le COI est à pos ~30 000 chars (34 922 chars total)
        # → budget restant = 40 000 - min(acte_attaque, 10 000) ≥ 30 000 → conclusion entière incluse
        "conclusion_cgra_ou_oe", "conclusie_cgvs_of_dv",
        "motivation_cgra_ou_oe", "motivering_cgvs_of_dv",
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
- Si l'arrêt concerne UNIQUEMENT le séjour (OQT, 9bis, Dublin, visa étudiant, regroupement familial, cohabitation légale) et NON une DPI (demande de protection internationale/asile), utilise status="not_applicable" pour les critères exclusivement liés à l'asile : MGF/VGV, mariage forcé, crainte de persécution, crédibilité du récit d'asile, art. 48/7, agents de persécution, protection nationale au sens DPI, groupe social art. 48/3, durée procédure DPI, rapports COI/documents sur le pays d'origine cités.
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

Genre grammatical (textes FR uniquement — critère "sexe") :
- Déduire le genre depuis les marqueurs grammaticaux si non explicitement mentionné :
  * Pronoms : "il"/"elle", "lui", "sa"/"son"
  * Accords adjectivaux : "requérant"/"requérante", "sportif"/"sportive", "demandeur"/"demanderesse"
  * Formulations révélatrices : "il a une sœur", "père de famille", "il est parti", "sportif de haut niveau"
- Utiliser status="inferred" si déduit (pas mentionné explicitement).
- Exemple : status="inferred", value="Masculin", evidence_excerpt="sportif de haut niveau, il a une sœur supplémentaire"
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

    section_caps = GROUP_SECTION_MAX.get(group, {})
    result: list[SectionEntry] = []
    total = 0
    for sec in candidates:
        text = (sec.text or "").strip()
        if not text:
            continue
        # Appliquer le cap par section-type si défini
        for sid_prefix, cap in section_caps.items():
            if (sec.section_id or "").startswith(sid_prefix):
                if len(text) > cap:
                    text = text[:cap] + "\n[… tronqué (cap section) …]"
                break
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
    arret_date: str | None = None,
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

    # Notes spécifiques par groupe
    group_note = ""
    if group == "evidence_documents":
        if procedure_type not in ("protection_internationale_fond", "unknown"):
            # Non-DPI confirmé : les COI pays d'origine ne s'appliquent pas
            group_note = (
                "\n⚠️ RÈGLE ABSOLUE — PROCÉDURE NON-DPI : "
                f"Cet arrêt porte sur le séjour ({procedure_type}), PAS sur l'asile/DPI. "
                "Tous les critères de ce groupe (COI, rapports pays d'origine) doivent retourner "
                "status=\"not_applicable\" et value=\"N/A\". "
                "Les rapports COI ne concernent que les dossiers d'asile (DPI). "
                "NE PAS retourner not_mentioned — retourner not_applicable obligatoirement."
            )
        else:
            group_note = (
                "\n⚠️ COI : pour chaque rapport cité, retourne le titre et l'auteur uniquement "
                "(max 200 chars par 'value'). Ne reproduis PAS le contenu des rapports."
            )
    elif group == "identity" and language == "fr":
        group_note = (
            "\n📋 SOUS-QUESTIONS : Pour les critères contenant plusieurs sous-questions "
            "(ex. région/ville de naissance ET lieu de vie actuel), répondre explicitement à "
            "CHAQUE sous-question. Si une sous-question est absente du texte, écrire explicitement "
            "'non mentionné(e)'. Ne pas omettre de sous-question. "
            "Exemple : '1. Région/ville de naissance : non mentionnée. "
            "2. Lieu de vie : Belgique (ville non précisée).'"
        )
    elif group == "procedure" and language == "fr":
        date_ctx = f" La date de l'arrêt est : {arret_date}." if arret_date else ""
        group_note = (
            "\n📋 DATE D'ARRIVÉE : Si la date d'arrivée en Belgique n'est pas mentionnée, "
            "utiliser la date d'introduction de la requête devant le CCE comme valeur de repli. "
            "Préciser la nature de chaque date. "
            "Exemple : 'Date d'arrivée : non mentionnée. "
            "Date d'introduction requête CCE : 20/03/2025 → valeur retenue : 20/03/2025.'"
            + (f"\n📋 DURÉE PROCÉDURE :{date_ctx} Calculez la durée entre la date d'introduction "
               "et la date de l'arrêt. Exprimez en jours ET en mois approximatifs. "
               "Exemple : '20/03/2025 → 25/02/2026 = 342 jours, environ 11 mois.'")
        )
    elif group == "decision_reasoning" and language == "fr":
        group_note = (
            "\n📋 PRIORITÉ ABSOLUE — fr_036 DISPOSITIF : La décision finale du CCE (statut accordé, "
            "recours rejeté, annulation CGRA…) figure dans la section `dispositif` de l'arrêt. "
            "C'est la DÉCISION DU CCE, pas la position du CGRA. "
            "Chercher en PREMIER dans la section `dispositif`. "
            "Exemple : 'Le statut de réfugié est accordé.' ou 'Le recours est rejeté.'\n"
            "📋 ATTENTION fr_043 — MOTIVATION CCE vs CGRA : fr_043 = la motivation du CCE en propre. "
            "Si le CCE annule la décision CGRA et accorde le statut → fr_043 doit expliquer POURQUOI "
            "le CCE accorde (son propre raisonnement). Ne jamais copier la motivation CGRA dans fr_043. "
            "Exemple : 'Le CCE estime crédible le récit du requérant et accorde le statut de réfugié "
            "au sens de l'art. 48/3 car [motif CCE].'\n"
            "📋 fr_037 — CRÉDIBILITÉ : Chercher 'crédibilité' / 'crédible' dans la motivation CCE. "
            "Extraire si la crédibilité du récit est accordée, rejetée, ou partielle. "
            "Utiliser status=not_mentioned uniquement si le mot n'apparaît pas du tout.\n"
            "📋 fr_040 — AGENTS PERSÉCUTION/PROTECTION : 2 sous-questions obligatoires : "
            "1. Agent de persécution (qui persécute : famille, État, rebelles, groupe armé…) "
            "2. Agent de protection (autorités locales, ONG, forces de sécurité…). "
            "Répondre à chaque sous-question même si l'une est non mentionnée.\n"
            "📋 fr_046 — RÉSUMÉ : Toujours remplir, même si aucun autre critère n'est disponible. "
            "Format : mots-clés séparés par virgules + résumé 2-3 phrases. "
            "Exemple : 'DPI, Burundi, statut réfugié accordé, art. 48/3 — Le CCE accorde le statut "
            "de réfugié à un ressortissant burundais, estimant son récit crédible et retenant la "
            "persécution étatique comme motif de protection.'"
        )

    user_prompt = f"""Langue du document : {lang_label} ({language})
Groupe de critères : {group}
Type de procédure : {procedure_type}{proc_note}{group_note}

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


# ---------------------------------------------------------------------------
# R-Phase 12 — Full text : UN SEUL appel LLM par arrêt, tout le texte + tous
# les critères. Approche opposée aux 7 groupes : aucune section cachée au LLM.
# ---------------------------------------------------------------------------

FULLTEXT_MAX_CHARS = 60000  # limite texte brut envoyé au LLM (Mixtral 8x22B)


def build_prompt_fulltext(
    arret_id: str,
    language: str,
    criteria_all: list[dict],
    intermediate: IntermediateDocument,
    procedure_type: str = "unknown",
    max_chars: int = FULLTEXT_MAX_CHARS,
) -> tuple[str, str]:
    """
    Construit un prompt unique avec TOUT le texte de l'arrêt + TOUS les critères.
    Retourne (system_prompt, user_prompt) pour 1 seul appel LLM par arrêt.
    """
    lang_label = "français" if language == "fr" else "néerlandais"

    if procedure_type not in ("protection_internationale_fond", "unknown"):
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
    else:
        proc_note = ""

    # Concaténer TOUTES les sections dans leur ordre naturel
    formatted: list[str] = []
    total_chars = 0
    for sec in intermediate.sections:
        text = (sec.text or "").strip()
        if not text:
            continue
        auth = sec.authority or "unknown"
        sid = sec.section_id or "?"
        title = f" — {sec.title_detected}" if sec.title_detected else ""
        chunk = f"[Section: {sid} | Autorité: {auth}{title}]\n{text}"
        if total_chars + len(chunk) > max_chars:
            remaining = max_chars - total_chars
            if remaining > 200:
                formatted.append(chunk[:remaining] + "\n[… tronqué …]")
            break
        formatted.append(chunk)
        total_chars += len(chunk)

    joined = "\n\n---\n\n".join(formatted) if formatted else "(aucune section disponible)"

    criteria_lines = "\n".join(
        f'  {i+1}. id="{c["id"]}" | {c["label_original"]} | type={c.get("expected_value_type", "text")}'
        for i, c in enumerate(criteria_all)
    )
    valid_ids_list = ", ".join(f'"{c["id"]}"' for c in criteria_all)
    n = len(criteria_all)

    ex_found = json.dumps({
        "criterion_id": criteria_all[0]["id"] if criteria_all else "id_exemple",
        "value": "valeur extraite",
        "confidence": 0.85,
        "evidence_excerpt": "extrait court (max 60 car.)",
        "source_authority": "CCE",
        "source_section": "motivation",
        "needs_human_review": False,
        "status": "found",
    }, ensure_ascii=False)

    ex_absent = json.dumps({
        "criterion_id": criteria_all[-1]["id"] if len(criteria_all) > 1 else "id_exemple_2",
        "value": None,
        "confidence": None,
        "evidence_excerpt": None,
        "source_authority": None,
        "source_section": None,
        "needs_human_review": False,
        "status": "not_mentioned",
    }, ensure_ascii=False)

    user_prompt = f"""Langue du document : {lang_label} ({language})
Type de procédure : {procedure_type}{proc_note}

## TEXTE INTÉGRAL DE L'ARRÊT ({len(intermediate.sections)} section(s), {total_chars} caractères)
{joined}

## CRITÈRES À EXTRAIRE ({n} critères)
{criteria_lines}

## INSTRUCTION CRITIQUE
Tu dois utiliser UNIQUEMENT ces criterion_id exacts (copie mot pour mot) :
{valid_ids_list}

⚠️ RÈGLE ABSOLUE : Chaque critère DOIT avoir une entrée dans "items", même si not_applicable \
ou not_mentioned.
Un critère sans réponse est une ERREUR. Produis EXACTEMENT {n} items, un par criterion_id.

## FORMAT DE RÉPONSE (JSON compact, une ligne par item)
⚠️ evidence_excerpt : MAXIMUM 60 caractères (tronque si plus long).
Réponds avec UNIQUEMENT ce JSON — aucun texte avant ou après :
{{"items": [{ex_found}, {ex_absent}]}}

Produis exactement {n} items dans "items", dans l'ordre des criterion_id listés.
Commence ta réponse par {{ :"""

    return SYSTEM_PROMPT, user_prompt
