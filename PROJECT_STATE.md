# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-04 (R-Phase 2 terminée)

## Objectif actuel

**R-Phase 2 terminée + dry-run validé** sur CCE 341994 (36/~48 valeurs extraites, pipeline OK).

Prochaine étape R-Phase 3 :
1. Appliquer migration 008 dans Supabase (⚠ requis avant tout stockage).
2. Re-extraire les 50 arrêts avec `main.py --limit 55` (populate `intermediate_json` + nouveaux noms de sections).
3. Lancer `analyze.py --limit 20` pour validation intermédiaire avocate.

## Décisions validées

- Le LLM ne lit jamais directement les PDF.
- Les PDF ne sont pas stockés durablement.
- Le worker extrait d'abord le texte avec un outil classique.
- Le texte est nettoyé, segmenté et réduit avant analyse LLM.
- Les critères FR et NL restent deux référentiels distincts, sans traduction ni fusion.
- `order_index` est intouchable pour la version importée.
- Les nouveaux critères ne s'appliquent qu'aux futurs arrêts — aucun retraitement automatique.
- Le PC Windows sert au développement, aux tests locaux et à la démo limitée.
- Le traitement massif sera déplacé plus tard vers un serveur plus puissant.
- Le Mac mini est hors plan.
- Les parties Figma Focus et Imports d'arrêts sont ignorées.
- Rôles : admin / avocat / lecteur. Pas de paiement en V1.
- **Navigation : sidebar verte desktop (lg+) + bottom nav mobile. TopBar conservé sur mobile uniquement.**
- Next.js 15.5.18 (upgrade sécurité depuis 15.3.3).
- La fiche détail affiche l'URL publique CCE/RVV — aucun PDF stocké sur le serveur.
- Le seed insère 15 arrêts fictifs réalistes (FR+NL) via upsert idempotent.
- Les filtres de recherche passent par l'URL (searchParams) pour être partageables.
- **Palette couleurs Figma : `forest-600` = `#3A5346` (sidebar, accents), fond `#F7F7F7`, cartes blanches.**
- **Liste arrêts : tableau sur desktop, cartes sur mobile.**
- **App name affiché : "CCE / RVV" (pas "OpenArret" du Figma placeholder).**
- **LLM : prefilling `{"items":[` + messages system/user séparés — technique validée sur qwen3:4b.**
- **Scraper : 50 arrêts réels CCE/RVV en base (30 FR + 20 NL, statut=en_attente). DB nettoyée.**
- **URLs de filtre langue CCE/RVV : `/fr/arr/lang/french`, `/fr/arr/lang/dutch`, `/fr/arr/lang/german`.**
- **Le suffixe `.an_` dans les URLs PDF n'est PAS un code langue** — langue forcée depuis `--lang`.
- **Limite de validation relevée à 100 arrêts** (était 50).
- **Critères fusionnés FR (`fr_025`, `fr_033`) conservés en l'état jusqu'à validation cliente.**
- **Corpus prod = 181 802 arrêts** (~1,45M appels LLM). Traitement sur GPU loué à l'heure (Vast.ai/Runpod), ~15-30 €.
- **Modèle retenu** : `Qwen/Qwen2.5-32B-Instruct-AWQ` via vLLM — **même modèle pour le test 50 ET la prod**.
- **Prérequis instance GPU** : Ubuntu 22.04, Max CUDA ≥ 12.8, disque ≥ 50 Go.
- **Staging Vercel** : https://dimagin-saasjur.vercel.app. ⏳ DNS LWS + Supabase redirect URLs à configurer.
- **Réorientation pipeline (Option A validée)** : reconstruire le préprocesseur (JSON intermédiaire, sections, autorités) avant le test GPU.
- **Migration 007 appliquée** (confirmé par l'utilisateur).
- **`value_text` dans `arret_criteria_values` peut contenir du JSON brut** si le LLM mal formaté sa réponse — géré côté frontend via `parseValueText()`.
- **Interface validation** : `ValidationRow` utilise un textarea + Ctrl+Entrée pour sauvegarder.

## Stack retenue

- Next.js 15.5.18 + TypeScript + Tailwind.
- Supabase Auth + Postgres.
- Vercel pour l'app.
- Worker local séparé pour scraping/extraction/analyse.
- Ollama local pour test LLM (qwen3:4b, 4 Go VRAM).
- PyMuPDF / pdfplumber / OCR fallback pour PDF.
- BeautifulSoup4 + lxml pour le scraping CCE/RVV.

## État des phases

| Phase | Statut | Notes |
|---|---|---|
| 0. Préparation repo | ✅ Terminé | Next.js initialisé, .gitignore, .env.example, structure dossiers |
| 1. Base SaaS | ✅ Terminé | Auth, layout mobile, rôles, navigation. TypeScript ✅, Lint ✅ |
| 2. Critères | ✅ Terminé | Migration 002, import JSON, page admin mobile-first, audit log |
| 3. Arrêts et recherche | ✅ Terminé | Migration 003, seed 15 arrêts, liste, fiche détail, filtres, stats |
| 3b. Redesign UI Figma | ✅ Terminé | Sidebar verte, tableau desktop, palette #3A5346, icons SVG |
| 4. Extraction PDF | ✅ Terminé | Worker Python, PyMuPDF, segmentation juridique |
| 5. Analyse LLM | ✅ Terminé | Prefilling JSON, system/user séparés, 10–30s/groupe |
| 6. Validation avocate | ✅ **Refait** | Interface entièrement révisée — voir section ci-dessous |
| 6b. Scraper + pipeline réel | ✅ En cours | 50 arrêts réels en base, extraction + analyse à lancer |
| 6c. Corrections critères | ✅ Terminé | llm_group x6, typo CvV→RvV, migration 006 appliquée |
| 7. Daily scraper | ✅ Terminé (MVP) | worker/scraper.py fonctionnel, 50 arrêts insérés |
| 8. Traitement massif | 🔴 Bloqué | Attendre validation juridique qualité LLM |
| Audit + correctifs | ✅ Terminé | C1-C3, I1-I7, W1-W3 appliqués — typecheck/lint 0 erreur |
| **R-Phase 1. Préprocesseur renforcé** | ✅ **Terminé** | 7 nouveaux modules + migration 007 créée et **appliquée** |
| **R-Phase 2. Analyse LLM via JSON intermédiaire** | ✅ **Terminé** | analyze.py + prompts.py + schemas.py + build_intermediate.py + migration 008 |
| **R-Phase 3. Test sur échantillon réel** | 🟡 En cours | dry-run OK (CCE 341994, 36 valeurs). Appliquer 008, re-extraire, analyser 20 arrêts |

## Interface validation — Refonte 2026-06-04

### Fichiers modifiés / créés

| Fichier | Changement |
|---|---|
| `src/lib/types.ts` | Ajout `procedure_type` et `language_detected` dans `Arret` |
| `src/lib/utils.ts` | **Nouveau** — `parseValueText()`, `deriveLlmStatus()`, `formatDateBE()` |
| `src/app/(app)/arrets/[id]/page.tsx` | Fix JSON artefacts critères, badge statut LLM, evidence_excerpt, lien "Valider les critères", procedure_type/language_detected affichés |
| `src/app/(app)/validation/[id]/ValidationRow.tsx` | Textarea (textarea 2 lignes) + Ctrl+Entrée + meilleur feedback |
| `src/app/(app)/validation/[id]/page.tsx` | Réécriture complète : badge statut LLM, valeur extraite propre, passage source visible, stats par groupe, lien PDF |
| `src/app/(app)/validation/page.tsx` | Stats globales enrichies, progress color, bouton export global, bannière simplifiée |
| `src/app/(app)/validation/export/route.ts` | **Nouveau** — CSV d'audit complet (tous arrêts × tous critères × statuts validation) |

### Fonctionnalités ajoutées

- `parseValueText()` : extrait la valeur humaine depuis un `value_text` qui peut être JSON
- `deriveLlmStatus()` : déduit "extrait / ambigu / non trouvé" depuis `value_text`, `value_boolean`, `confidence`
- Badge statut LLM sur chaque critère (vert = extrait, jaune = ambigu, gris = non trouvé)
- Passage source (`evidence_excerpt`) affiché en citation mise en valeur
- Textarea commentaire avocate (2 lignes) + raccourci Ctrl+Entrée
- Compteur "Restant à valider" dans les stats
- Arrêts terminés (100 % validés) grisés dans la liste
- Export CSV d'audit global : `/validation/export` — un CSV unique avec tous les arrêts analysés, toutes les valeurs LLM, tous les statuts de validation + commentaires
- Lien "Valider les critères" dans la fiche arrêt quand statut = terminé
- Champs `procedure_type` / `language_detected` affichés dans la fiche arrêt

### Règles pour l'audit (résultats de validation → amélioration pipeline)

L'export `/validation/export` produit un CSV avec les colonnes :
`arret_numero, langue_arret, date_arret, chambre, procedure_type, langue_critere, section, groupe_llm, critere, type_valeur, valeur_llm, confidence_pct, statut_llm, extrait_preuve, statut_validation, commentaire_avocate, date_validation`

Ce fichier est l'audit destiné à identifier les critères systématiquement mal extraits par le LLM.

## Réorientation pipeline — Phase 1 terminée (2026-06-03)

### Modules créés / modifiés (tous syntaxiquement valides — py_compile ✅)

| Fichier | Rôle |
|---|---|
| `worker/detect_language.py` | Détection FR/NL depuis le texte (20 signaux FR + 20 NL, score pondéré) |
| `worker/classify_procedure.py` | Classification regex : protection_internationale_fond / dublin / oqt / sejour / unknown |
| `worker/extract_metadata.py` | Extraction par regex : numéro, date, juge, avocat, défendeur, dates de recours |
| `worker/detect_applicants.py` | Détection multi-demandeurs, jonction d'affaires, genre |
| `worker/clean.py` | **Refonte** : 30 sections nommées FR/NL avec autorité (CCE/CGRA/applicant…) |
| `worker/build_intermediate.py` | Assembleur → `IntermediateDocument` (JSON stable avant LLM) |
| `worker/main.py` | Intègre `build_intermediate`, cache disque `.tmp/intermediate/`, `store_intermediate_data` |
| `supabase/migrations/007_intermediate_pipeline.sql` | Nouvelles colonnes : `procedure_type`, `language_detected`, `intermediate_json`, `authority`, `section_title`, `criteria_schema_version`, `analysis_prompt_version` |

### Architecture du JSON intermédiaire

```
PDF → extract.py → clean.py
                 ↓
        build_intermediate.py
         ├── detect_language    → document.language
         ├── classify_procedure → document.procedure_type
         ├── extract_metadata   → metadata_detected
         ├── detect_applicants  → applicants_detection + applicants[]
         └── sections[]         → texte + authority + section_title
                 ↓
        intermediate_document.json  (cache disque + Supabase)
                 ↓
        analyze.py (Phase 2 — à faire)
```

### Règle importante pour analyze.py (Phase 2)

`intermediate.get_sections_for_criteria_group(section_ids)` est déjà disponible dans
`build_intermediate.py` — il suffira à `analyze.py` d'appeler cette méthode pour cibler
les sections utiles par groupe de critères, sans envoyer tout le document au LLM.

## R-Phase 2 — Résultats dry-run (2026-06-04)

Arrêt testé : CCE 341994 (`08c34c35-14ec-4c57-8ef9-f208408aba3c`), langue FR, 44 sections reconstruites depuis fallback segments.

| Groupe | Critères | Items OK | Durée | Notes |
|---|---|---|---|---|
| metadata | 7 | 7 | 150s | ✅ date, numéro, juge, avocat, chambre, date arrivée |
| procedure | 6 | 6 | 105s | ✅ |
| identity | 9 | 9 | 164s | ✅ nationalité, ethnie, religion, région, MENA |
| profile_vulnerability | 15 | 3 | 72s | ⚠️ tronqué — qwen3:4b incapable de gérer 15 critères d'un coup |
| decision_reasoning | 8 | 8 | 222s | ✅ motivation CCE, art.48/7, jurisprudence |
| persecution_claims | 2 | 2 | 107s | ✅ |
| evidence_documents | 1 | 1 | 45s | ✅ |
| **Total** | **48** | **36** | **865s** | |

Points observés :
- `source_authority=CCE` correctement renseigné sur fr_043, fr_038, fr_048 (LLM lit les en-têtes de section)
- `source_authority=unknown` sur la majorité → normal : les 50 arrêts ont été extraits sans authority (ancien pipeline)
- `profile_vulnerability` tronqué : 3/15 items retournés. Pas un bloquant prod (Qwen2.5-32B plus capable)
- 1 criterion_id invalide filtré dans profile_vulnerability (hallucination mineure)

## Prochaine action exacte

**Étape 0 — Appliquer la migration 008 dans Supabase (SQL Editor) :**

```sql
-- Coller et exécuter le contenu de supabase/migrations/008_criteria_values_extended.sql
```

**Étape 1 — Re-extraire les 50 arrêts avec le nouveau pipeline :**

```powershell
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\activate
$env:PYTHONIOENCODING="utf-8"
python main.py --limit 55
```

Cela populera `intermediate_json`, `procedure_type`, `language_detected` et les nouveaux noms de sections.

**Étape 2 — Analyser 20 arrêts et valider la qualité :**

```powershell
python analyze.py --limit 20
```

Puis ouvrir `/validation` dans l'app pour que l'avocate valide les extractions.

**Étape 3 — Tester l'interface de validation sur un arrêt réel analysé :**

Lancer l'app en local et vérifier que :
- La page `/validation` liste les arrêts analysés sans artefacts JSON
- La fiche `/validation/[id]` affiche correctement les valeurs extraites et les passages
- Le bouton "Exporter audit complet" génère un CSV propre
- Le textarea commentaire fonctionne (Ctrl+Entrée)

```powershell
cd C:\Projects\saas-juridique-cce-rvv
npm run dev
```

**Étape 2 — Lancer `main.py` en dry-run sur un vrai arrêt (si pas encore fait) :**

```powershell
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\activate
$env:PYTHONIOENCODING="utf-8"
python main.py --url https://www.rvv-cce.be/sites/default/files/arr/A341995.AN.pdf --dry-run
```

**Étape 3 — Passer à la R-Phase 2 (adapter analyze.py au JSON intermédiaire) :**

Objectifs R-Phase 2 :
- `analyze.py` lit le JSON intermédiaire (ou reconstruit depuis Supabase)
- `prompts.py` reçoit des `SectionEntry` ciblées via `get_sections_for_criteria_group()`
- `schemas.py` aligne les statuts sur les 7 obligatoires :
  `found / not_mentioned / not_applicable / ambiguous / inferred / conflicting / error`
- Chaque résultat inclut : `source_authority`, `source_section`, `page_refs`, `quotes`, `needs_human_review`, `certainty`

## Risques ouverts spécifiques R-Phase 3

- **profile_vulnerability tronqué** : qwen3:4b retourne 3/15 items pour ce groupe. À monitorer avec Qwen2.5-32B. Si persistant, envisager de scinder le groupe en deux.
- **source_authority=unknown** : tant que les arrêts ne sont pas re-extraits avec le nouveau `main.py`, l'authority restera `unknown`. Pas bloquant pour la validation.
- **Migration 008 non appliquée** : `analyze.py` échouera sur `store_criteria_values()` sans cette migration.

## Prompt de reprise recommandé (après /clear)

```
Reprends le projet (lis CLAUDE.md + PROJECT_STATE.md).

R-Phase 2 terminée et validée (dry-run CCE 341994 : 36/48 items, pipeline OK).
Migrations 007 et 008 créées (007 appliquée, 008 à appliquer avant tout stockage).

Prochaine action : R-Phase 3
1. Appliquer migration 008 dans Supabase (supabase/migrations/008_criteria_values_extended.sql)
2. Re-extraire les 50 arrêts : python main.py --limit 55
3. Analyser 20 arrêts : python analyze.py --limit 20
4. Valider l'interface /validation avec l'avocate

Point de vigilance : profile_vulnerability retourne 3/15 items avec qwen3:4b (tronqué).
À surveiller sur Qwen2.5-32B. Si persistant, scinder le groupe.
```

## Infrastructure Supabase

- Migration `001` à `007` : **toutes appliquées**.
- `.env.local` configuré avec les vraies clés (jamais commité).
- App fonctionnelle sur http://localhost:3000.

## Commandes de référence

```powershell
# App Next.js
npm install && npm run dev
npm run typecheck   # → 0 erreur
npm run lint        # → 0 erreur

# Worker (depuis worker/, venv actif)
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\activate
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"

# Extraction PDF (avec nouveau pipeline intermédiaire)
$env:PYTHONIOENCODING="utf-8"; python main.py --limit 5 --dry-run
$env:PYTHONIOENCODING="utf-8"; python main.py --limit 55

# Scraper
$env:PYTHONIOENCODING="utf-8"; python scraper.py --lang fr --limit 30
$env:PYTHONIOENCODING="utf-8"; python scraper.py --lang nl --limit 20

# Analyse LLM (batch : tous les groupes par arrêt, PAS de --group)
$env:PYTHONIOENCODING="utf-8"; python analyze.py --limit 50
$env:PYTHONIOENCODING="utf-8"; python analyze.py --arret-id <uuid> --group metadata --dry-run

# Critères
node --env-file=.env.local scripts/import-criteria.mjs
node --env-file=.env.local scripts/fix-criteria.mjs

# Test CLI modules Phase 1
.venv\Scripts\python.exe detect_language.py <fichier.txt>
.venv\Scripts\python.exe classify_procedure.py <fichier.txt>
.venv\Scripts\python.exe extract_metadata.py <fichier.txt> [url_pdf]
.venv\Scripts\python.exe build_intermediate.py <pdf_url> [output.json]
```

## Variables `.env.local` requises

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
LLM_TIMEOUT_SECONDS=180
LLM_MAX_INPUT_CHARS=8000
LLM_STORE_RAW_OUTPUT=false
```

## Risques ouverts

- **Qualité LLM non validée** : les valeurs extraites par `qwen3:4b` n'ont pas encore été vérifiées par l'avocate. Ne pas traiter plus de 100 arrêts avant validation.
- **R-Phase 2 à faire** : `analyze.py` utilise encore les segments bruts, pas le JSON intermédiaire. Le pipeline complet ne sera opérationnel qu'après Phase 2.
- **Arrêts fictifs seed** : 15 arrêts (CCE 260.001–015) ont des PDF en 404 → statut `erreur`. Ne nuisent pas mais polluent les stats.
- **Critères FR fusionnés** (`fr_025`, `fr_033`) : à clarifier avec la cliente.
- **PostCSS CVE modérées** : bundlées par Next.js, non corrigeables sans downgrade.
- **`value_text` JSON** : si `analyze.py` stocke du JSON dans `value_text`, `parseValueText()` gère l'affichage. La correction définitive sera dans R-Phase 2.

## Points de vigilance permanents

- Ne pas lancer de traitement massif (> 100 arrêts) avant validation juridique.
- Ne pas stocker les PDF.
- Ne pas envoyer les PDF ou l'arrêt complet au LLM.
- Ne pas modifier rétroactivement les analyses après changement de critères sans retraitement explicite.
- Maintenir ce fichier à jour avant chaque `/clear`.
- Lancer `npm install` avant `npm run dev` (node_modules absent du repo).
- Appliquer les migrations SQL dans Supabase avant tout test fonctionnel.
- `.env.example` ne doit jamais contenir de vraies clés.
