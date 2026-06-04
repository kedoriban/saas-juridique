# Architecture du projet — SaaS juridique CCE/RVV

## Ce que fait le projet

Un cabinet d'avocats veut pouvoir **rechercher dans les arrêts publics du Conseil du Contentieux des Étrangers (CCE / RVV)** en filtrant par critères juridiques précis : nationalité du requérant, motif de persécution invoqué, décision sur l'article 48/7, présence de MGF, etc.

Le CCE publie ~200 000 arrêts en PDF. Le projet les scrape, en extrait le texte, analyse les passages utiles avec un LLM, stocke les critères extraits dans Supabase, et expose une interface de recherche.

---

## Pipeline de traitement (dans l'ordre)

```
Site CCE/RVV
    ↓  scraper.py
URL PDF publique  →  téléchargé temporairement  →  JAMAIS stocké
    ↓  extract.py (PyMuPDF → pdfplumber → OCR)
Texte brut (toutes les pages)
    ↓  clean.py
Segments nommés (header / faits_invoqués / motivation_CGRA / article_48_7 / dispositif…)
    ↓  build_intermediate.py
JSON intermédiaire stable
    ├── langue détectée (FR / NL)
    ├── type de procédure (asile / OQT / séjour / Dublin)
    ├── métadonnées extraites par regex (numéro, date, juge, avocat)
    └── sections[] — chaque section : texte + autorité source (CCE / CGRA / requérant)
    ↓  analyze.py  (LLM appelé ici uniquement)
Critères extraits  →  stockés dans Supabase (arret_criteria_values)
    ↓  Interface Next.js
Recherche avancée / validation avocate / export CSV
```

---

## Pourquoi ne pas envoyer le PDF directement au LLM

Un arrêt fait 3 000 à 20 000 tokens. 200 000 arrêts × ~12 groupes de critères = **~1,4 million d'appels LLM** si on envoie tout le texte à chaque fois. Coût : prohibitif, lent, inutile.

Les contournements appliqués :

### 1. Extraction classique d'abord, LLM en dernier
Le texte des PDF est extrait avec **PyMuPDF** (outil classique, zéro token). Le LLM ne lit jamais de PDF — seulement du texte pré-traité.

### 2. Segmentation nommée
`clean.py` découpe l'arrêt en sections nommées (30 patterns FR + NL). Chaque section a un identifiant (`article_48_7`, `faits_invokes`, `motivation_cgra_ou_oe`…). Le LLM ne reçoit que les sections pertinentes pour chaque groupe de critères.

### 3. Groupes de critères
Les ~48 critères sont regroupés en 7 groupes thématiques (`metadata`, `identity`, `profile_vulnerability`, `decision_reasoning`…). Chaque groupe n'est analysé qu'avec les sections qui lui sont pertinentes.

```
Groupe "identity"  →  sections faits_invoqués + corps_arrêt  (~3 000 tokens)
Groupe "decision_reasoning"  →  sections article_48/7 + motivation  (~4 000 tokens)
```

Sans ce découpage : 12 000 tokens par arrêt × 7 groupes = 84 000 tokens.  
Avec ce découpage : ~4 000 tokens × 7 groupes = **28 000 tokens** (-66 %).

### 4. JSON intermédiaire mis en cache
Le résultat de la segmentation (sections + métadonnées + langue + procédure) est sérialisé en JSON et stocké en base + sur disque (`.tmp/intermediate/<uuid>.json`). Ré-extraction = lecture du cache, pas de re-téléchargement du PDF.

### 5. Prefilling JSON
Le LLM est appelé avec la technique du **prefilling** : la réponse commence par `{"items":[` avant même que le modèle génère quoi que ce soit. Cela force un JSON valide dès le premier token et évite les blabla d'introduction.

### 6. Modèle petit et quantifié
En production locale (démo) : `qwen3:4b` via Ollama (4 Go VRAM, PC laptop).  
Pour le batch réel : `Qwen2.5-32B-Instruct-AWQ` via vLLM sur instance GPU louée à l'heure (Vast.ai / Runpod, ~0,50 €/h). Le même code, le provider LLM est une variable d'environnement.

### 7. Pas de traitement massif avant validation
Les 200 000 arrêts ne sont PAS traités automatiquement. Le système est bloqué à 100 arrêts max tant que l'avocate n'a pas validé la qualité des extractions sur un échantillon.

---

## JSON intermédiaire — structure

```json
{
  "document": {
    "language": "fr",
    "procedure_type": "protection_internationale_fond",
    "decision_id": "CCE 341994",
    "decision_date": "26 février 2025"
  },
  "metadata_detected": {
    "judge": "M. Dupont",
    "lawyer": "Me Martin",
    "appeal_date": "2021-10-07"
  },
  "sections": [
    {
      "section_id": "faits_invokes",
      "authority": "applicant",
      "text": "Le requérant, ressortissant congolais…"
    },
    {
      "section_id": "article_48_7",
      "authority": "CCE",
      "text": "En ce qui concerne la crainte de persécution…"
    }
  ]
}
```

`authority` indique qui parle dans cette section : `CCE` (le tribunal), `CGRA` (l'office d'asile belge), `applicant` (le requérant), `unknown`. Cela permet au LLM de savoir si une affirmation vient de la personne qui demande l'asile ou du tribunal qui statue.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Interface web | Next.js 15 + TypeScript + Tailwind |
| Base de données + auth | Supabase (Postgres) |
| Déploiement web | Vercel |
| Scraping + extraction | Python, BeautifulSoup4, PyMuPDF |
| LLM local (démo) | Ollama + qwen3:4b |
| LLM batch (prod) | vLLM + Qwen2.5-32B-Instruct-AWQ sur GPU loué |
| Cache intermédiaire | JSON disque + colonne `intermediate_json` Supabase |

---

## Critères juridiques

48 critères définis par l'avocate cliente, en deux référentiels distincts (FR et NL — pas de traduction automatique). Exemples : nationalité, appartenance à un groupe social, MGF, présence d'un enfant MENA, article de la CEDH invoqué, décision du CGRA, jurisprudence citée.

Les critères sont versionnés. Un changement de critère ne déclenche pas de retraitement rétroactif des arrêts déjà analysés.

---

## Validation qualité

Avant tout traitement massif, l'avocate valide les extractions sur un échantillon (~50 arrêts) via l'interface `/validation` :
- Elle voit la valeur extraite par le LLM + le passage source cité
- Elle marque chaque critère : Correct / Incorrect / Incertain
- Un export CSV est généré pour identifier les critères systématiquement mal extraits

Seuil de déclenchement du batch massif : **80 % de critères corrects sur au moins 5 arrêts asile**.
