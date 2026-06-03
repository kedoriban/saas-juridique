# Réorientation du projet CCE/RvV — extraction locale assistée par LLM

## 1. Objectif de cette réorientation

Le projet ne doit plus être pensé comme une application qui envoie directement des PDF d’arrêts à une IA pour obtenir une analyse.  
La cible correcte est une chaîne de traitement locale, contrôlée, traçable et économiquement scalable :

```text
URL publique CCE/RvV
→ téléchargement temporaire du PDF
→ extraction texte page par page
→ nettoyage et normalisation du texte
→ classification du type d’arrêt
→ segmentation en sections juridiques
→ production d’un JSON intermédiaire stable
→ extraction des critères par LLM local sur VM
→ sortie JSON structurée + rendu tableau juriste
→ validation humaine éventuelle
→ stockage uniquement des critères + URL du PDF
```

L’objectif principal est de permettre le traitement massif d’arrêts publics du Conseil du Contentieux des Étrangers / Raad voor Vreemdelingenbetwistingen, sans dépendre d’API payantes type OpenAI/Anthropic pour l’analyse de chaque arrêt.

Le principe central est donc :

```text
Le LLM local ne doit jamais travailler sur le PDF brut.
Il doit travailler sur des données textuelles propres, préstructurées et limitées aux sections utiles.
```

Cette réorientation vise à rapprocher la sortie du système du test validé par l’avocate : une analyse systématique, critère par critère, dans l’ordre de la grille, avec réponse juridique courte, base d’observation, mention des pages, et distinction entre position du demandeur, position du CGRA/OE et appréciation du CCE/RvV.

---

## 2. Finalité produit attendue

L’application est un SaaS juridique destiné à des cabinets d’avocats.

Elle doit permettre de :

1. détecter quotidiennement les nouveaux arrêts publiés sur le site du CCE/RvV ;
2. télécharger temporairement les PDF publics ;
3. extraire le texte exploitable des PDF ;
4. analyser les arrêts selon une grille de critères fournie par la cliente ;
5. stocker uniquement les critères extraits et l’URL publique du PDF ;
6. permettre une recherche avancée sur les critères ;
7. générer des statistiques sur les critères ;
8. permettre à la cliente d’ajouter ou modifier les critères pour les futurs arrêts ;
9. faire tourner l’analyse des arrêts en local sur une VM avec Ollama ou autre moteur local compatible.

Il ne faut pas stocker durablement les PDF, sauf éventuellement dans un cache temporaire de traitement supprimé après extraction.

---

## 3. Changement majeur d’architecture

### Ancienne approche à éviter

```text
PDF complet → LLM → critères
```

Cette approche est à éviter parce qu’elle est coûteuse, fragile, difficilement vérifiable et peu scalable sur 200 000+ arrêts.

Elle augmente aussi le risque que le modèle confonde :

- les faits invoqués par le demandeur ;
- la motivation du CGRA/OE ;
- l’argumentation de la partie requérante ;
- l’appréciation propre du CCE/RvV ;
- la conclusion finale.

### Nouvelle approche cible

```text
PDF → texte propre → sections → JSON intermédiaire → LLM local ciblé → critères
```

Le LLM local ne doit recevoir que :

- les sections utiles ;
- les critères à traiter ;
- les consignes de prudence ;
- le format de sortie strict.

Pour les métadonnées simples, il faut utiliser des règles déterministes avant le LLM.

Exemples :

```text
numéro d’arrêt
date de l’arrêt
langue
juge
avocat
nationalité déclarée
date d’introduction du recours
date de décision attaquée
type de procédure
```

Ces champs doivent être extraits par regex ou logique de parsing, puis soumis éventuellement au LLM uniquement pour validation en cas d’ambiguïté.

---

## 4. Architecture cible détaillée

### 4.1. Module 1 — Scraper CCE/RvV

Responsabilités :

- parcourir les pages du site CCE/RvV ;
- détecter les nouvelles URLs de PDF ;
- identifier le numéro d’arrêt à partir de l’URL ;
- conserver l’URL publique ;
- éviter les doublons ;
- mettre les nouveaux arrêts dans une file de traitement.

Format d’URL observé :

```text
https://www.rvv-cce.be/sites/default/files/arr/A{NUMERO}.AN.pdf
```

Exemple :

```text
https://www.rvv-cce.be/sites/default/files/arr/A341995.AN.pdf
```

Le scraper doit enregistrer :

```json
{
  "decision_id": "A341995",
  "decision_number_candidate": "341995",
  "pdf_url": "https://www.rvv-cce.be/sites/default/files/arr/A341995.AN.pdf",
  "scraped_at": "ISO_DATE",
  "status": "pending_preprocessing"
}
```

---

### 4.2. Module 2 — Téléchargement temporaire du PDF

Responsabilités :

- télécharger le PDF dans un dossier temporaire ;
- calculer un hash ;
- vérifier que le fichier est lisible ;
- supprimer ou archiver temporairement selon la politique définie ;
- ne pas dépendre du PDF comme source stockée principale.

Champs utiles :

```json
{
  "pdf_sha256": "...",
  "file_size_bytes": 123456,
  "download_status": "success",
  "downloaded_at": "ISO_DATE"
}
```

---

### 4.3. Module 3 — Extraction texte page par page

Le système doit extraire le texte du PDF page par page.

Objectif :

```json
{
  "pages": [
    {
      "page": 1,
      "raw_text": "...",
      "clean_text": "..."
    },
    {
      "page": 2,
      "raw_text": "...",
      "clean_text": "..."
    }
  ]
}
```

Recommandations techniques :

- commencer par extraction texte native ;
- détecter les PDF scannés ou mal extraits ;
- prévoir OCR uniquement si nécessaire ;
- conserver les numéros de page ;
- ne pas supprimer les titres de section ;
- supprimer les artefacts évidents de pagination uniquement si cela n’abîme pas la structure.

Signaux de mauvaise extraction :

```text
- texte total très court pour un PDF de plusieurs pages ;
- pages vides ;
- ratio élevé de caractères illisibles ;
- répétition excessive d’en-têtes ;
- absence de mots juridiques attendus.
```

Sortie attendue :

```json
{
  "extraction_quality": {
    "method": "native_pdf_text | ocr | mixed",
    "pages_count": 11,
    "text_length": 43821,
    "ocr_used": false,
    "quality_score": 0.94,
    "requires_human_review": false
  }
}
```

---

### 4.4. Module 4 — Détection de langue

Le système doit détecter la langue principale de l’arrêt :

```json
{
  "language": "fr | nl | unknown",
  "confidence": 0.98
}
```

Indices FR :

```text
Conseil du Contentieux des Etrangers
LE PRÉSIDENT
Vu la requête
APRES EN AVOIR DELIBERE
Faits invoqués
Motivation
Conclusion
```

Indices NL :

```text
Raad voor Vreemdelingenbetwistingen
DE WND. VOORZITTER
Gezien het verzoekschrift
Gehoord het verslag
Feitenrelaas
Motivering
Conclusie
```

La détection de langue conditionne :

- le choix des labels de critères ;
- les patterns de section ;
- la langue du prompt envoyé au LLM ;
- les synonymes juridiques recherchés.

---

### 4.5. Module 5 — Classification du type d’arrêt

Avant toute extraction de critères, il faut classifier le type réel de l’arrêt.

Ne jamais faire confiance uniquement à la catégorie de collecte ou au mot-clé utilisé lors de la recherche.

Types minimaux à gérer :

```text
protection_internationale_fond
dublin_transfert
oqt_extreme_urgence
sejour_visa_regroupement
autre_non_supporte
unknown
```

La grille principale de la cliente semble pensée prioritairement pour les arrêts de protection internationale au fond, notamment ceux qui discutent le statut de réfugié, la protection subsidiaire, la crédibilité, l’article 48/7, les persécutions de genre, les vulnérabilités, etc.

Les arrêts Dublin, OQT ou extrême urgence peuvent être utiles pour le SaaS, mais ils doivent être traités par une logique séparée ou marqués avec de nombreux critères `not_applicable`.

#### Règles de classification FR

Protection internationale au fond :

```text
"refus du statut de réfugié et refus du statut de protection subsidiaire"
"Commissaire générale aux réfugiés et aux apatrides"
"A. Faits invoqués"
"B. Motivation"
"C. Conclusion"
"Appréciation sous l’angle de l’article 48/3"
"Appréciation sous l’angle de l’article 48/4"
```

Dublin / transfert :

```text
"décision de transfert"
"annexe 26quater"
"Règlement (UE) 604/2013"
"Dublin"
"prise en charge"
"reprise en charge"
"État membre responsable"
```

OQT / extrême urgence :

```text
"ordre de quitter le territoire"
"annexe 13septies"
"maintien en vue d’éloignement"
"suspension, selon la procédure d’extrême urgence"
"préjudice grave difficilement réparable"
"risque de fuite"
```

#### Règles de classification NL

Protection internationale au fond :

```text
"weigering van de vluchtelingenstatus"
"weigering van de subsidiaire beschermingsstatus"
"Commissaris-generaal voor de vluchtelingen en de staatlozen"
"internationale bescherming"
"vluchtelingenstatus"
"subsidiaire beschermingsstatus"
```

Dublin / transfert :

```text
"overdrachtsbesluit"
"bijlage 26quater"
"Verordening (EU) nr. 604/2013"
"Dublin"
"verantwoordelijke lidstaat"
"overname"
"terugname"
```

OQT / extrême urgence :

```text
"bevel om het grondgebied te verlaten"
"bijlage 13septies"
"vasthouding met het oog op verwijdering"
"uiterst dringende noodzakelijkheid"
"moeilijk te herstellen ernstig nadeel"
"risico op onderduiken"
```

Sortie attendue :

```json
{
  "procedure_type": "protection_internationale_fond",
  "confidence": 0.93,
  "signals": [
    "refus du statut de réfugié et refus du statut de protection subsidiaire",
    "A. Faits invoqués",
    "B. Motivation"
  ],
  "requires_main_criteria": true
}
```

---

### 4.6. Module 6 — Segmentation en sections juridiques

Le système doit découper le texte en sections.

C’est une étape centrale. Le LLM ne doit pas recevoir un document brut, mais des sections utiles.

Sections FR typiques :

```text
header
jonction_affaires
acte_attaque
faits_invokes
motivation_cgra_ou_oe
conclusion_cgra_ou_oe
cadre_juridique
nouveaux_elements
these_partie_requerante
non_comparution
appreciation_48_3
appreciation_48_4
article_48_7
article_3_cedh
article_8_cedh
dispositif
```

Sections NL typiques :

```text
header
samenvoeging_zaken
bestreden_beslissing
feitenrelaas
motivering_cgvs_of_dv
conclusie_cgvs_of_dv
juridisch_kader
nieuwe_elementen
standpunt_verzoekende_partij
beoordeling_vluchtelingenstatus
beoordeling_subsidiaire_bescherming
artikel_48_7
artikel_3_evrm
artikel_8_evrm
dictum
```

Chaque section doit conserver :

```json
{
  "section_id": "facts_invoked",
  "title_detected": "A. Faits invoqués",
  "start_page": 1,
  "end_page": 2,
  "start_char": 1234,
  "end_char": 9876,
  "authority": "CGRA | OE | CCE | applicant | unknown",
  "text": "..."
}
```

Important : dans beaucoup d’arrêts, la décision du CGRA/OE est reproduite dans l’arrêt entre guillemets. Il faut donc distinguer :

```text
texte reproduisant la décision attaquée
vs
analyse propre du CCE/RvV
```

Cette distinction est indispensable pour éviter que le LLM confonde la motivation du CGRA avec la conclusion du CCE.

---

### 4.7. Module 7 — Détection multi-demandeurs

Certains arrêts concernent plusieurs demandeurs ou une famille.

Signaux FR :

```text
"Jonction des affaires"
"les requérants"
"la requérante"
"le requérant"
"en ce qui concerne la décision prise à l’égard de"
"ils déclarent être mariés"
"leurs enfants"
```

Signaux NL :

```text
"samenvoeging van de zaken"
"verzoekers"
"verzoekster"
"verzoeker"
"wat betreft de beslissing genomen ten aanzien van"
"hun kinderen"
```

Le JSON intermédiaire doit permettre :

```json
{
  "applicants": [
    {
      "applicant_id": "applicant_1",
      "role": "requérant",
      "detected_gender": "male",
      "criteria_scope": "individual"
    },
    {
      "applicant_id": "applicant_2",
      "role": "requérante",
      "detected_gender": "female",
      "criteria_scope": "individual"
    }
  ],
  "shared_facts": {
    "exists": true,
    "text_sections": ["jonction_affaires", "faits_invokes"]
  }
}
```

Les critères doivent pouvoir être :

```text
- communs à l’arrêt ;
- propres à un demandeur ;
- partagés par plusieurs demandeurs ;
- non applicables à certains demandeurs.
```

---

## 5. Format cible du JSON intermédiaire

Claude Code doit produire un fichier JSON intermédiaire avant tout appel au LLM local.

Exemple minimal :

```json
{
  "document": {
    "decision_id": "A341995",
    "decision_number": "341995",
    "pdf_url": "https://www.rvv-cce.be/sites/default/files/arr/A341995.AN.pdf",
    "language": "fr",
    "procedure_type": "protection_internationale_fond",
    "decision_date": "27 février 2026"
  },
  "extraction_quality": {
    "method": "native_pdf_text",
    "pages_count": 11,
    "text_length": 43821,
    "quality_score": 0.94,
    "requires_human_review": false
  },
  "metadata_detected": {
    "judge": "S. SEGHIN",
    "lawyer": "Me B. BRIJS",
    "defendant": "Commissaire générale aux réfugiés et aux apatrides",
    "appeal_date": "3 mars 2025",
    "attacked_decision_date": "31 janvier 2025"
  },
  "applicants": [
    {
      "applicant_id": "applicant_1",
      "nationality": "turque",
      "ethnicity": "kurde",
      "religion": "musulmane"
    }
  ],
  "sections": [
    {
      "section_id": "header",
      "title_detected": null,
      "start_page": 1,
      "end_page": 1,
      "authority": "CCE",
      "text": "..."
    },
    {
      "section_id": "facts_invoked",
      "title_detected": "A. Faits invoqués",
      "start_page": 1,
      "end_page": 2,
      "authority": "CGRA",
      "text": "..."
    },
    {
      "section_id": "motivation_cgra",
      "title_detected": "B. Motivation",
      "start_page": 2,
      "end_page": 4,
      "authority": "CGRA",
      "text": "..."
    },
    {
      "section_id": "appreciation_48_3",
      "title_detected": "Appréciation sous l’angle de l’article 48/3",
      "start_page": 6,
      "end_page": 9,
      "authority": "CCE",
      "text": "..."
    }
  ]
}
```

---

## 6. Format cible de la sortie d’analyse

Le système doit produire deux sorties.

### 6.1. Sortie machine : JSON structuré

Chaque critère doit respecter ce format :

```json
{
  "criterion_id": "article_48_7",
  "order": 42,
  "label": "Application art. 48/7",
  "applicant_scope": "applicant_1 | all | decision",
  "value": "oui",
  "answer": "Oui, explicitement appliqué par le CCE. Le Conseil rappelle la présomption en faveur du demandeur ayant déjà subi une persécution, puis l’applique à la requérante ayant subi une MGF type 3.",
  "status": "found",
  "certainty": "high",
  "source_authority": "CCE",
  "source_section": "appreciation_48_3",
  "base_observation": "Raisonnement du CCE sur l’article 48/7.",
  "page_refs": [9, 10],
  "quotes": [
    {
      "page": 9,
      "text": "citation courte ou extrait justificatif"
    }
  ],
  "needs_human_review": false
}
```

### 6.2. Sortie humaine : tableau juriste

Le rendu humain doit se rapprocher du test validé par l’avocate :

```markdown
| Critère | Réponse (analyse de l’arrêt) | Base / observation |
|---|---|---|
| Date de l’arrêt | 20 juin 2023 | En-tête de l’arrêt, page 1 |
| Numéro de l’arrêt | CCE n° 290 647 | En-tête, page 1 |
| Application art. 48/7 | Oui, explicitement appliqué par le CCE... | Pages 9-10 |
```

Le tableau juriste ne remplace pas le JSON.  
Il sert à la validation humaine et à l’expérience utilisateur.

---

## 7. Statuts normalisés par critère

Chaque critère doit avoir un statut standardisé.

```text
found
not_mentioned
not_applicable
ambiguous
inferred
conflicting
error
```

Définitions :

### `found`

Le critère est explicitement présent dans l’arrêt.

Exemple :

```json
{
  "status": "found",
  "value": "guinéenne",
  "answer": "La requérante est de nationalité guinéenne."
}
```

### `not_mentioned`

L’arrêt ne mentionne pas l’information.

Exemple :

```json
{
  "status": "not_mentioned",
  "value": null,
  "answer": "Non mentionné dans l’arrêt."
}
```

### `not_applicable`

Le critère n’est pas pertinent pour ce type d’arrêt.

Exemple :

```json
{
  "status": "not_applicable",
  "value": null,
  "answer": "Non applicable : l’arrêt porte sur une décision Dublin et non sur l’examen au fond d’une demande de protection internationale."
}
```

### `ambiguous`

L’arrêt contient une ambiguïté.

Exemple :

```json
{
  "status": "ambiguous",
  "value": null,
  "answer": "Deux dates différentes apparaissent dans l’arrêt ; l’une semble correspondre à l’arrivée, l’autre à l’enregistrement effectif de la demande.",
  "needs_human_review": true
}
```

### `inferred`

La réponse est déduite mais pas explicitement formulée.

Exemple :

```json
{
  "status": "inferred",
  "value": "oui",
  "answer": "Semble oui de facto, mais l’arrêt ne qualifie pas expressément la requérante de mère célibataire.",
  "needs_human_review": true
}
```

### `conflicting`

Deux passages semblent donner des informations incompatibles.

Exemple :

```json
{
  "status": "conflicting",
  "value": null,
  "answer": "Le document contient deux informations contradictoires sur la date d’introduction de la demande.",
  "needs_human_review": true
}
```

---

## 8. Règles juridiques essentielles pour le LLM local

Le LLM local doit suivre ces règles de manière stricte.

### 8.1. Ne jamais inventer

Si une information n’est pas dans le texte fourni :

```text
Répondre "Non mentionné dans l’arrêt".
```

Ne pas compléter avec des connaissances générales.

### 8.2. Distinguer les sources internes de l’arrêt

Pour chaque critère juridique, distinguer autant que possible :

```text
- ce que le demandeur affirme ;
- ce que le CGRA/OE estime ;
- ce que la requête soutient ;
- ce que le CCE/RvV retient.
```

Le CCE/RvV est la source décisive pour l’analyse finale.

### 8.3. Ne pas confondre crédibilité et décision finale

Un arrêt peut :

```text
- rejeter une partie du récit comme non crédible ;
- mais reconnaître quand même le statut de réfugié sur un élément objectivé.
```

Exemple type : MGF établie médicalement, article 48/7 appliqué, même si d’autres pans du récit sont contestés.

### 8.4. Gérer les critères sensibles avec prudence

Critères sensibles :

```text
MGF / VGV
réexcision
désinfibulation / réinfibulation
mariage forcé
violences de genre
violences sexuelles
MENA / NBMV
vulnérabilités psychologiques
rapports médicaux
article 48/7
groupe social
protection nationale
fuite interne
```

Pour ces critères, le modèle doit toujours fournir :

```text
- réponse ;
- base d’observation ;
- autorité source ;
- page ;
- niveau de certitude ;
- besoin ou non de revue humaine.
```

---

## 9. Découpage des critères par zones utiles

Pour réduire le coût de traitement local, il ne faut pas envoyer tout le document au LLM pour chaque critère.

### 9.1. Métadonnées

Sections utiles :

```text
header
acte_attaque
```

Critères :

```text
date de l’arrêt
numéro d’arrêt
juge
avocat
chambre FR/NL
lien URL
date d’introduction du recours
date de décision attaquée
```

Extraction prioritaire :

```text
regex / parsing déterministe
```

LLM seulement si ambiguïté.

### 9.2. Identité du demandeur

Sections utiles :

```text
header
faits_invokes
feitenrelaas
```

Critères :

```text
nationalité
ethnie
religion
sexe
région / ville de naissance
lieu de vie
âge
documents d’identité
```

### 9.3. Profil du demandeur

Sections utiles :

```text
faits_invokes
motivation_cgra
appreciation_48_3
```

Critères :

```text
enfants
mère célibataire
niveau d’études
autonomie financière
MGF
réexcision
mariage forcé
polygamie
vulnérabilités
violences pendant parcours migratoire
```

### 9.4. Documents déposés

Sections utiles :

```text
faits_invokes
motivation_cgra
nouveaux_elements
requete
audience
```

Critères :

```text
documents d’identité
certificat médical
rapport psychologique
rapport psychiatrique
besoins procéduraux spéciaux
nouveaux éléments
```

### 9.5. Persécutions invoquées

Sections utiles :

```text
faits_invokes
motivation_cgra
these_partie_requerante
appreciation_48_3
```

Critères :

```text
persécutions de genre
opinions politiques
groupe social
religion
ethnie
nationalité
famille / tribu
orientation sexuelle
service militaire
```

### 9.6. Appréciation juridique

Sections utiles :

```text
motivation_cgra
appreciation_48_3
appreciation_48_4
article_48_7
dispositif
```

Critères :

```text
crédibilité
bénéfice du doute
article 48/7
agent de persécution
agent de protection
protection nationale effective
fuite interne
motivation du CGRA
motivation du CCE
décision finale
arrêt de principe
jurisprudence citée
rapports pays cités
```

---

## 10. Contrat d’appel au LLM local

### 10.1. Entrée envoyée au LLM

Le LLM doit recevoir un payload réduit :

```json
{
  "task": "extract_criteria",
  "language": "fr",
  "procedure_type": "protection_internationale_fond",
  "decision_id": "A341995",
  "criteria": [
    {
      "criterion_id": "nationality",
      "order": 9,
      "label": "Nationalité du demandeur",
      "instruction": "Préciser si elle est contestée par CGRA et/ou CCE.",
      "expected_type": "text"
    }
  ],
  "sections": [
    {
      "section_id": "header",
      "authority": "CCE",
      "start_page": 1,
      "end_page": 1,
      "text": "..."
    },
    {
      "section_id": "facts_invoked",
      "authority": "CGRA",
      "start_page": 1,
      "end_page": 2,
      "text": "..."
    }
  ],
  "output_schema": "criteria_extraction_v1"
}
```

### 10.2. Sortie obligatoire du LLM

```json
{
  "decision_id": "A341995",
  "criteria_results": [
    {
      "criterion_id": "nationality",
      "order": 9,
      "label": "Nationalité du demandeur",
      "value": "turque",
      "answer": "Le demandeur déclare être de nationalité turque. Cette nationalité n’est pas remise en cause dans les passages analysés.",
      "status": "found",
      "certainty": "high",
      "source_authority": "CGRA",
      "source_section": "facts_invoked",
      "base_observation": "Faits invoqués, page 1.",
      "page_refs": [1],
      "quotes": [
        {
          "page": 1,
          "text": "vous êtes né ... en Turquie. Vous êtes de nationalité turque"
        }
      ],
      "needs_human_review": false
    }
  ]
}
```

La sortie doit être validée par un schéma JSON strict.  
Si le JSON est invalide, Claude Code doit relancer localement une tentative de correction JSON, sans modifier le fond.

---

## 11. Modèle local et exécution sur VM

Objectif : réduire au maximum les coûts de tokens payants.

Recommandation :

```text
- utiliser Ollama sur VM ;
- éviter les appels API externes pour l’analyse de masse ;
- réserver les API payantes uniquement à la phase de prototypage ou de benchmark ;
- stocker les outputs intermédiaires pour éviter de retraiter les mêmes arrêts.
```

Architecture suggérée :

```text
worker_scraper
worker_pdf_extract
worker_preprocess
worker_llm_local
worker_validation
database
admin_review_ui
```

Le worker LLM local doit être découplé du reste.  
Claude Code doit pouvoir changer de modèle local sans réécrire toute l’application.

Exemple de configuration :

```json
{
  "llm_provider": "ollama",
  "base_url": "http://localhost:11434",
  "model": "qwen2.5:14b-instruct",
  "temperature": 0.0,
  "top_p": 0.2,
  "max_retries": 2,
  "json_mode": true
}
```

Ne pas hardcoder le modèle. Utiliser une variable d’environnement.

Exemples :

```env
LOCAL_LLM_PROVIDER=ollama
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5:14b-instruct
LOCAL_LLM_TEMPERATURE=0
```

---

## 12. Validation qualité

Chaque analyse doit produire un score de qualité.

Exemple :

```json
{
  "analysis_quality": {
    "criteria_total": 49,
    "criteria_found": 21,
    "criteria_not_mentioned": 17,
    "criteria_not_applicable": 6,
    "criteria_ambiguous": 3,
    "criteria_inferred": 2,
    "requires_human_review": true,
    "reasons": [
      "Deux dates contradictoires détectées pour l’introduction de la DPI.",
      "Critère mère célibataire inféré mais non explicitement mentionné."
    ]
  }
}
```

Critères déclenchant une revue humaine :

```text
- status = ambiguous ;
- status = conflicting ;
- status = inferred pour un critère sensible ;
- extraction_quality.quality_score < seuil ;
- procédure classifiée avec faible confiance ;
- arrêt multi-demandeurs ;
- LLM sans citation/page pour un critère sensible ;
- incohérence entre décision finale et motivation extraite.
```

---

## 13. Base de données : principe de stockage

Ne pas stocker les PDF durablement.

Stocker :

```text
- URL du PDF ;
- hash du PDF ;
- texte extrait éventuellement si légalement validé par la cliente ;
- JSON intermédiaire ;
- critères extraits ;
- statut de validation ;
- version de la grille de critères ;
- version du modèle local ;
- logs de traitement.
```

Il est important de versionner la grille de critères.

Exemple :

```json
{
  "criteria_schema_version": "2026-06-legal-grid-v1",
  "analysis_model": "qwen2.5:14b-instruct",
  "analysis_prompt_version": "ollama-cce-v1",
  "processed_at": "ISO_DATE"
}
```

Quand la cliente modifie les critères, la modification ne s’applique qu’aux futurs arrêts, sauf décision explicite de relancer l’analyse.

---

## 14. Prompt maître à donner à Claude Code

Copier-coller le prompt suivant dans Claude Code pour réorienter le projet.

```text
Tu dois réorienter le projet SaaS juridique CCE/RvV.

Objectif principal :
L’application ne doit pas envoyer les PDF bruts à une API LLM. Elle doit scraper les URLs publiques des arrêts CCE/RvV, télécharger temporairement les PDF, extraire le texte page par page, produire un JSON intermédiaire propre, puis faire analyser ces données par un LLM local sur VM via Ollama ou fournisseur local configurable. L’objectif est de réduire au maximum les coûts de tokens payants pour permettre le traitement massif de 200 000+ arrêts.

Finalité métier :
La cliente veut une analyse systématique des arrêts selon une grille de critères fournie en français et en néerlandais. La sortie doit se rapprocher du test validé par l’avocate : un tableau critère par critère, dans l’ordre exact de la grille, avec :
- critère ;
- réponse/analyse de l’arrêt ;
- base ou observation ;
- page(s) ;
- distinction entre demandeur, CGRA/OE et CCE/RvV ;
- mention explicite "non mentionné", "non applicable", "ambigu", ou "inféré" si nécessaire.

Architecture obligatoire :
1. Scraper les URLs des PDF sur rvv-cce.be.
2. Télécharger temporairement chaque PDF.
3. Extraire le texte page par page.
4. Nettoyer le texte sans perdre les titres de section.
5. Détecter la langue : fr ou nl.
6. Classifier le type réel d’arrêt :
   - protection_internationale_fond
   - dublin_transfert
   - oqt_extreme_urgence
   - sejour_visa_regroupement
   - autre_non_supporte
   - unknown
7. Segmenter le texte en sections juridiques.
8. Extraire les métadonnées simples par regex/parsing déterministe.
9. Construire un JSON intermédiaire stable.
10. Envoyer uniquement les sections utiles au LLM local.
11. Forcer une sortie JSON stricte par critère.
12. Générer aussi un rendu Markdown/HTML "tableau juriste".
13. Stocker uniquement les critères extraits, l’URL du PDF, les métadonnées et les logs de traitement. Ne pas stocker durablement les PDF.

Très important :
Le LLM local ne doit jamais travailler sur un PDF brut.
Le LLM local ne doit jamais recevoir tout le document si seules certaines sections sont utiles.
Il faut réduire le contexte envoyé au LLM en fonction des critères.

Statuts obligatoires pour chaque critère :
- found
- not_mentioned
- not_applicable
- ambiguous
- inferred
- conflicting
- error

Format obligatoire pour chaque résultat de critère :
{
  "criterion_id": "string",
  "order": number,
  "label": "string",
  "applicant_scope": "decision | all | applicant_1 | applicant_2",
  "value": "string | boolean | number | array | null",
  "answer": "string",
  "status": "found | not_mentioned | not_applicable | ambiguous | inferred | conflicting | error",
  "certainty": "high | medium | low",
  "source_authority": "CCE | RvV | CGRA | CGVS | OE | DVZ | applicant | unknown | null",
  "source_section": "string | null",
  "base_observation": "string",
  "page_refs": [number],
  "quotes": [
    {
      "page": number,
      "text": "short quote"
    }
  ],
  "needs_human_review": boolean
}

Règles juridiques pour le LLM :
- Ne jamais inventer.
- Si l’information n’est pas dans le texte fourni, répondre "Non mentionné dans l’arrêt".
- Si le critère n’est pas pertinent pour ce type d’arrêt, répondre "Non applicable".
- Distinguer la position du demandeur, du CGRA/OE/CGVS/DVZ, et l’appréciation finale du CCE/RvV.
- Le CCE/RvV est la source décisive pour la conclusion juridique finale.
- Ne pas confondre un récit invoqué avec un fait retenu.
- Ne pas confondre la motivation du CGRA/OE avec la motivation du CCE/RvV.
- Signaler toute ambiguïté.
- Pour les critères sensibles, toujours fournir page, source et base d’observation.
- Pour les critères inférés, marquer "status": "inferred" et "needs_human_review": true.

Critères sensibles :
- MGF / VGV
- réexcision
- désinfibulation / réinfibulation
- mariage forcé
- violences de genre
- violences sexuelles
- mineur / MENA / NBMV
- vulnérabilités médicales ou psychologiques
- rapports médicaux
- rapports psychologiques ou psychiatriques
- besoins procéduraux spéciaux
- article 48/7
- crédibilité du récit
- bénéfice du doute
- groupe social
- agents de persécution
- agents de protection
- protection nationale
- fuite interne
- décision finale

Patterns FR à utiliser pour la segmentation :
- "A. Faits invoqués"
- "B. Motivation"
- "C. Conclusion"
- "L’acte attaqué"
- "Les faits"
- "Le cadre juridique de l’examen du recours"
- "Les nouveaux éléments"
- "Thèse de la partie requérante"
- "Appréciation sous l’angle de l’article 48/3"
- "Appréciation sous l’angle de l’article 48/4"
- "Préjudice grave difficilement réparable"
- "Extrême urgence"
- "MOTIF DE LA DECISION"
- "Reconduite à la frontière"
- "Maintien"

Patterns NL à utiliser pour la segmentation :
- "Feitenrelaas"
- "Motivering"
- "Conclusie"
- "De bestreden beslissing"
- "De feiten"
- "Nieuwe elementen"
- "Beoordeling"
- "Onderzoek in het licht van artikel"
- "vluchtelingenstatus"
- "subsidiaire beschermingsstatus"
- "uiterst dringende noodzakelijkheid"
- "moeilijk te herstellen ernstig nadeel"
- "bevel om het grondgebied te verlaten"
- "vasthouding met het oog op verwijdering"

Règles de classification :
Protection internationale au fond si le texte contient des signaux comme :
- "refus du statut de réfugié et refus du statut de protection subsidiaire"
- "Commissaire générale aux réfugiés et aux apatrides"
- "A. Faits invoqués"
- "B. Motivation"
- "article 48/3"
- "article 48/4"
ou en néerlandais :
- "weigering van de vluchtelingenstatus"
- "weigering van de subsidiaire beschermingsstatus"
- "Commissaris-generaal voor de vluchtelingen en de staatlozen"
- "internationale bescherming"

Dublin/transfert si le texte contient :
- "décision de transfert"
- "annexe 26quater"
- "Règlement (UE) 604/2013"
- "Dublin"
- "État membre responsable"
ou en néerlandais :
- "overdrachtsbesluit"
- "bijlage 26quater"
- "Verordening (EU) nr. 604/2013"
- "verantwoordelijke lidstaat"

OQT/extrême urgence si le texte contient :
- "ordre de quitter le territoire"
- "annexe 13septies"
- "maintien en vue d’éloignement"
- "suspension, selon la procédure d’extrême urgence"
- "risque de fuite"
ou en néerlandais :
- "bevel om het grondgebied te verlaten"
- "bijlage 13septies"
- "vasthouding met het oog op verwijdering"
- "uiterst dringende noodzakelijkheid"
- "risico op onderduiken"

Configuration LLM local :
Créer une couche d’abstraction configurable :
LOCAL_LLM_PROVIDER=ollama
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5:14b-instruct
LOCAL_LLM_TEMPERATURE=0

Ne pas hardcoder le modèle.
Prévoir retries et validation JSON.
Prévoir logs.
Prévoir traitement batch.
Prévoir reprise après erreur.
Prévoir cache des JSON intermédiaires pour éviter de retraiter les mêmes PDF.

Livrables à créer/modifier :
1. Un module scraper CCE/RvV.
2. Un module PDF extraction page par page.
3. Un module text cleaning.
4. Un module language detection.
5. Un module procedure classification.
6. Un module section segmentation FR/NL.
7. Un module metadata extraction par regex.
8. Un schéma JSON intermédiaire.
9. Un client Ollama/local LLM configurable.
10. Un extracteur de critères par sections ciblées.
11. Un validateur JSON strict.
12. Un générateur de tableau juriste Markdown/HTML.
13. Un système de statuts et revue humaine.
14. Des tests unitaires sur les PDF exemples.
15. Des fixtures JSON à partir de quelques arrêts FR/NL.

Priorité :
Commence par le pipeline PDF → texte → JSON intermédiaire → classification → sections.
Ne commence pas par l’extraction IA des critères.
L’extraction IA doit venir après, une fois le JSON intermédiaire fiable.

Résultat attendu :
Pour chaque arrêt, le système doit produire :
- intermediate_document.json
- criteria_results.json
- legal_analysis_table.md
- processing_log.json

Le rendu legal_analysis_table.md doit être lisible par l’avocate et proche du format :
| Critère | Réponse (analyse de l’arrêt) | Base / observation |
|---|---|---|
| Date de l’arrêt | ... | En-tête, page 1 |
| Numéro de l’arrêt | ... | En-tête, page 1 |
| Application art. 48/7 | ... | Pages ... |

Commence par auditer le code existant, identifier l’ancienne logique de traitement PDF/IA, puis propose et applique une refonte progressive sans casser l’application existante.
```

---

## 15. Prompt court si le contexte Claude Code est déjà chargé

Utiliser ce prompt court après avoir fourni le document complet une première fois.

```text
Réoriente le projet selon le document de spécification fourni : l’IA locale ne doit plus traiter les PDF bruts. Mets en place un pipeline PDF → texte page par page → nettoyage → langue → type d’arrêt → sections juridiques FR/NL → JSON intermédiaire → extraction ciblée par Ollama local → JSON critères strict → tableau juriste. Priorise d’abord le préprocesseur et les schémas, puis seulement l’extraction des critères. Ne hardcode pas le modèle Ollama. Tous les résultats doivent être traçables avec statut, page, source_authority, source_section, base_observation et needs_human_review.
```

---

## 16. Commandes utiles côté VM

Exemples génériques à adapter au projet.

Installer Ollama :

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Télécharger un modèle :

```bash
ollama pull qwen2.5:14b-instruct
```

Lancer le serveur Ollama :

```bash
ollama serve
```

Tester l’API locale :

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:14b-instruct",
  "prompt": "Réponds uniquement en JSON valide: {\"ok\": true}",
  "stream": false
}'
```

Variables d’environnement recommandées :

```env
LOCAL_LLM_PROVIDER=ollama
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5:14b-instruct
LOCAL_LLM_TEMPERATURE=0
LOCAL_LLM_TOP_P=0.2
LOCAL_LLM_MAX_RETRIES=2
```

---

## 17. Prochaine étape recommandée

Avant d’analyser 200 000+ arrêts :

1. constituer un échantillon représentatif de 20 à 30 arrêts ;
2. inclure FR, NL, protection internationale, famille, MGF, 48/7, Dublin, OQT, anciens/récents ;
3. produire les JSON intermédiaires ;
4. vérifier la segmentation ;
5. faire valider 5 à 10 sorties par l’avocate ;
6. ajuster les critères et les prompts ;
7. seulement ensuite lancer le batch historique.

La réussite du projet dépend moins du choix exact du modèle local que de la qualité du prétraitement et de la structure envoyée au LLM.
