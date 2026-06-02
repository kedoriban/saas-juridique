# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-03 (correctifs audit appliqués : C1-C3, I1-I7, W1-W3 — typecheck/lint OK)

## Objectif actuel

Valider la qualité des extractions LLM sur ~50 arrêts réels (30 FR + 20 NL) avant toute démo cliente ou traitement massif.

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
- **Scraper : 50 arrêts réels CCE/RVV en base (30 FR + 20 NL, statut=en_attente). DB nettoyée et re-scrappée proprement.**
- **URLs de filtre langue CCE/RVV : `/fr/arr/lang/french`, `/fr/arr/lang/dutch`, `/fr/arr/lang/german` (+ `/date/{année}` cumulable).**
- **Le suffixe `.an_` dans les URLs PDF n'est PAS un code langue** — lié à la procédure. La langue est forcée depuis `--lang` lors du scraping filtré.
- **Limite de validation relevée à 100 arrêts** (était 50).
- **Critères fusionnés FR (`fr_025`, `fr_033`) conservés en l'état jusqu'à validation cliente.**

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
| 1. Base SaaS | ✅ Audité et validé | Auth, layout mobile, rôles, navigation, pages placeholder. TypeScript ✅, Lint ✅ |
| 2. Critères | ✅ Terminé + commité | Migration 002, import JSON, page admin mobile-first, toggle admin, audit log |
| 3. Arrêts et recherche | ✅ Terminé + validé | Migration 003, seed 15 arrêts, liste, fiche détail, filtres avancés, stats |
| 3b. Redesign UI Figma | ✅ Terminé | Sidebar verte, tableau desktop, palette #3A5346, icons SVG |
| 4. Extraction PDF | ✅ Terminé + validé | Worker Python, PyMuPDF, segmentation juridique |
| 5. Analyse LLM | ✅ Terminé + robustifié | Prefilling JSON, system/user séparés, 10–30s/groupe, taux succès élevé |
| 6. Validation avocate | ✅ Terminé | Migration 005 appliquée, écran QA, export CSV, bannière blocage |
| 6b. Scraper + pipeline réel | ✅ En cours | 50 arrêts réels (30 FR + 20 NL) en base, extraction + analyse à lancer |
| 6c. Corrections critères | ✅ Terminé | llm_group x6, typo CvV→RvV, migration 006 appliquée |
| 7. Daily scraper | ✅ Terminé (MVP) | worker/scraper.py fonctionnel, 50 arrêts insérés |
| 8. Traitement massif | 🔴 Bloqué | Attendre validation juridique qualité LLM |
| Audit + correctifs | ✅ Terminé | C1-C3, I1-I7, W1-W3 appliqués — typecheck/lint 0 erreur |

## Audit code complet — 2026-06-03

Audit réalisé après /clear prématuré. Aucune ligne de code modifiée, uniquement recensement.

### Bugs critiques (bloquants avant démo)

| # | Fichier | Problème |
|---|---|---|
| C1 | `src/app/(app)/dashboard/page.tsx` | Dashboard statique : 4 stat cards affichent "—", message "Phase 1 en cours" complètement obsolète. Aucune requête Supabase. |
| C2 | `worker/analyze.py` → `store_criteria_values` | `value_boolean` jamais renseigné. Seul `value_text` est stocké. Les critères de type boolean ne s'affichent pas dans la fiche détail ni dans `/validation`. |
| C3 | `src/app/(app)/recherche/FiltresPanel.tsx` | Bug UX : le formulaire de filtres avancés crée un `FormData` propre sans reprendre `q`. Appliquer des filtres depuis le panneau ouvert efface silencieusement la recherche textuelle. |

### Bugs importants (visibles à la démo)

| # | Fichier | Problème |
|---|---|---|
| I1 | `src/app/(app)/parametres/page.tsx` | Rôle hardcodé `"avocat"` statique. Doit lire `profile.role` depuis Supabase. |
| I2 | `src/components/Sidebar.tsx` + `BottomNav.tsx` | Section Admin (Validation, Critères, Paramètres) visible pour tous les rôles. Sidebar ne reçoit pas le rôle en prop. |
| I3 | `src/app/actions/validation.ts` | `updateValidationStatus` vérifie l'auth mais pas le rôle. N'importe quel `lecteur` peut valider. La RLS protège en dernier recours mais la Server Action devrait aussi vérifier. |
| I4 | `src/components/BottomNav.tsx` ligne 28 | Active state `text-blue-600` au lieu de `text-forest-600`. Incohérence charte graphique. |
| I5 | `src/components/TopBar.tsx` ligne 11 | Logo `bg-blue-600` au lieu de `bg-forest-600`. Incohérence charte graphique. |
| I6 | `src/app/(app)/parametres/page.tsx` | Liens `/parametres/utilisateurs` et `/parametres/organisation` pointent vers des routes inexistantes (404). |
| I7 | `src/components/BottomNav.tsx` | `/validation` absent du BottomNav mobile — pourtant c'est la fonctionnalité principale pour l'avocate sur mobile. `/criteres` est là mais moins prioritaire. |

### Bugs worker Python

| # | Fichier | Problème |
|---|---|---|
| W1 | `worker/llm_provider.py` ligne 229 | `prompt_chars=len(prompt)` retourne `2` (longueur du tuple) quand `prompt` est un `(system, user)`. Devrait être `len(system_prompt) + len(user_prompt)`. Pas bloquant mais incorrect dans les logs. |
| W2 | `worker/scraper.py` ligne 12 | Docstring du module dit encore "La langue est déduite du suffixe de l'URL PDF" — obsolète depuis la décision du 2026-06-03 (langue forcée par `--lang`). |
| W3 | `worker/schemas.py` `normalize_response` ligne 64 | `STATUS_MAP` est redéfini à chaque itération de boucle. Doit être une constante module. |
| W4 | `worker/analyze.py` `fetch_pending_analyze` | N+1 queries : 1 requête Supabase par arrêt pour vérifier les valeurs existantes. 50 arrêts = 50 appels HTTP. Acceptable MVP mais à optimiser. |
| W5 | `worker/analyze.py` ligne 260 | `criteria_all[0].get("version", "client_excel_v1")` : la colonne `version` n'existe pas sur les critères Supabase (c'est `criterion_version_id`). Le fallback est toujours utilisé. Pas bloquant. |
| W6 | `worker/prompts.py` ligne 114 | Instruction "Commence ta réponse par `{`" alors que le prefilling a déjà injecté `{"items":[`. Légèrement redondant/trompeur mais sans impact. |

### Points de qualité mineurs

| # | Fichier | Remarque |
|---|---|---|
| Q1 | `src/components/icons.tsx` | `IconCheckSquare` réutilisé pour Validation ET Critères dans la Sidebar. Aucune distinction visuelle. |
| Q2 | `worker/extract.py` `_tmp_dir()` | Crée `.tmp/pdf-cache/` à la racine du projet. ✅ Déjà dans `.gitignore` (ligne 27). |
| Q3 | `worker/analyze.py` `store_model_run` | Le `group` actif n'est pas stocké dans `model_runs` (pas de colonne). Info perdue si on veut retracer quel groupe a produit quoi. |
| Q4 | `src/app/(app)/arrets/page.tsx` | Tableau desktop : pas de colonne "Statut" dans les headers, le statut est affiché via un dot couleur dans `ArretTableRow` sans libellé. |

### Fonctionnalité demandée à implémenter (pas encore codée)

- **Onglet "Scrap"** dans l'app : page affichant les commandes worker (scraper, extraction, analyse) organisées par étape, copiables en un clic. Utile pour lancer le pipeline sans mémoriser les paramètres.

### Correctifs audit appliqués — 2026-06-03

Bugs critiques + importants + worker corrigés. `npm run typecheck` ✅ 0 erreur, `npm run lint` ✅ 0 erreur, fichiers worker compilent (`py_compile`).

- **C1** ✅ Dashboard branché sur Supabase (4 counts : arrêts totaux, `statut='termine'`, valeurs `validation_status IS NULL`, critères `active=true`). Bloc bleu « Phase 1 » supprimé.
- **C2** ✅ `store_criteria_values` convertit oui/non/true/false/ja/nee → `value_boolean` quand `expected_value_type == 'boolean'` ; type propagé aux items via `analyze_group`. ⚠️ **Préventif** : aucun critère actuel n'est `boolean` (tous `text_or_structured_json`) → sans effet sur les 96 critères présents.
- **C3** ✅ `FiltresPanel` : `<input hidden name="q">` dans le formulaire de filtres avancés → la recherche textuelle survit à l'application des filtres.
- **I1** ✅ `/parametres` lit le vrai rôle depuis `profiles` (`profile?.role ?? "—"`).
- **I2** ✅ Section Admin de la Sidebar conditionnée à `userRole ∈ {admin, avocat}` (rôle lu dans `layout.tsx`, passé en prop). ⚠️ Un compte `lecteur` ne voit plus Validation/Critères/Paramètres dans la sidebar desktop.
- **I3** ✅ `updateValidationStatus` refuse si rôle ∉ {admin, avocat} (défense en plus de la RLS).
- **I4** ✅ BottomNav : état actif `text-forest-600` + barre `bg-forest-600` (étaient `blue-600`).
- **I5** ✅ TopBar : logo `bg-forest-600` (était `blue-600`).
- **I6** ✅ Liens 404 de `/parametres` (utilisateurs, organisation) remplacés par des libellés désactivés « bientôt ».
- **I7** ✅ BottomNav mobile : `/validation` remplace `/criteres`.
- **W1** ✅ `prompt_chars = len(system_prompt) + len(user_prompt)` — **3 occurrences** corrigées dans `llm_provider.py` (2 handlers d'erreur + retour final).
- **W2** ✅ Docstring `scraper.py` corrigée (langue forcée via `--lang`, détection par suffixe en fallback).
- **W3** ✅ `STATUS_MAP` extrait en constante module dans `schemas.py` (n'est plus redéfini à chaque itération).

Non traités volontairement (hors périmètre session) : Q1–Q4 et W4–W6 (mineurs), onglet « Scrap » (session suivante).

---

## Prochaine action exacte

**Repartir d'une DB propre, re-scraper 50 arrêts (30 FR + 20 NL), extraire le texte, analyser, puis valider dans `/validation`.**

> ⚠️ Important : en batch, `analyze.py` **sans** `--group` (tous les groupes par arrêt).
> `fetch_pending_analyze` ignore tout arrêt ayant déjà ≥1 valeur ; enchaîner
> `--group identity`, `--group metadata`, … remplit tout au 1er groupe puis les
> suivants ne trouvent plus rien. Le `--group` ne sert qu'au contrôle qualité
> ciblé sur un seul arrêt (`--arret-id <uuid> --group identity --dry-run`).

```sql
-- 0. Vider la DB (Supabase → SQL Editor). Cascade : supprime segments,
--    extractions, valeurs, jobs, model_runs. Garde criteria / profiles / organisations.
truncate table arrets cascade;
```

```powershell
# 1. Scraper 30 FR + 20 NL (depuis worker/, charge ../.env.local)
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\activate
$env:PYTHONIOENCODING="utf-8"; python scraper.py --lang fr --limit 30
$env:PYTHONIOENCODING="utf-8"; python scraper.py --lang nl --limit 20

# 2. Extraire le texte PDF (statut en_attente → termine)
$env:PYTHONIOENCODING="utf-8"; python main.py --limit 55

# 3. Analyser (Ollama actif). PAS de --group en batch (voir avertissement ci-dessus).
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"   # si Ollama absent du PATH
$env:PYTHONIOENCODING="utf-8"; python analyze.py --limit 5    # contrôle qualité d'abord
$env:PYTHONIOENCODING="utf-8"; python analyze.py --limit 50   # le reste (déjà analysés ignorés)
```

Puis ouvrir `/validation` et valider manuellement un échantillon avec l'avocate.

> Compte de démo : le sidebar masque la section Admin (Validation / Critères /
> Paramètres) si `profiles.role` = `lecteur`. Mettre le compte démo en `admin`
> ou `avocat` dans la table `profiles`.

## Correctifs audit — ✅ APPLIQUÉS le 2026-06-03 (prompt d'origine conservé ci-dessous pour archive)

```
Reprends le projet (lis CLAUDE.md + PROJECT_STATE.md).

Un audit complet a été fait (voir section "Audit code complet — 2026-06-03" dans PROJECT_STATE.md).
Aucune ligne de code n'a encore été modifiée. Applique tous les correctifs listés dans cet ordre.

== ÉTAPE 1 — Bugs critiques ==

C1 — Dashboard (src/app/(app)/dashboard/page.tsx)
  Connecter les 4 stat cards à Supabase :
  - "Arrêts importés" → count total de la table arrets
  - "Analysés" → count statut_traitement='termine'
  - "À valider" → count arret_criteria_values avec validation_status IS NULL (arrêts termine uniquement)
  - "Critères actifs" → count criteria WHERE active=true
  Supprimer le bloc bleu "Phase 1 en cours".

C2 — value_boolean jamais stocké (worker/analyze.py, fonction store_criteria_values)
  Avant d'insérer, si expected_value_type du critère est 'boolean' ET que value_text est
  "oui"/"non"/"true"/"false"/"ja"/"nee" (insensible casse), mapper vers value_boolean=True/False
  et mettre value_text=None. Le type du critère est dans criteria_all mais pas encore passé
  à store_criteria_values — il faudra l'ajouter au dict item lors de analyze_group.

C3 — Bug UX filtres recherche (src/app/(app)/recherche/FiltresPanel.tsx)
  Dans le formulaire de filtres avancés (open && ...), ajouter un champ hidden
  <input type="hidden" name="q" value={current("q")} />
  pour que le texte de recherche survive à l'application des filtres.

== ÉTAPE 2 — Bugs importants ==

I1 — Rôle hardcodé (src/app/(app)/parametres/page.tsx)
  Faire une requête Supabase sur profiles pour lire le vrai role de l'utilisateur connecté.
  Afficher profile?.role ?? "—".

I2 — Section Admin visible pour tous (src/components/Sidebar.tsx)
  La Sidebar reçoit déjà userEmail. Ajouter userRole: string en prop (passé depuis
  src/app/(app)/layout.tsx qui a déjà accès à supabase).
  Conditionner l'affichage de adminNav à userRole === "admin" || userRole === "avocat".
  Dans layout.tsx, lire le profile : const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

I3 — Validation sans vérif rôle (src/app/actions/validation.ts)
  Après la vérif user, ajouter la vérification du rôle :
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!["admin", "avocat"].includes(profile?.role)) return { error: "Accès refusé" }

I4 — BottomNav couleur (src/components/BottomNav.tsx)
  Remplacer text-blue-600 par text-forest-600 (active state) et bg-blue-600 par bg-forest-600 (barre indicatrice).

I5 — TopBar logo (src/components/TopBar.tsx)
  Remplacer bg-blue-600 par bg-forest-600 sur le logo.

I6 — Liens brisés paramètres (src/app/(app)/parametres/page.tsx)
  Remplacer les <a href="/parametres/utilisateurs"> et <a href="/parametres/organisation">
  par des spans désactivés avec "(bientôt)" ou les supprimer. Ne pas créer les pages.

I7 — /validation dans BottomNav (src/components/BottomNav.tsx)
  Remplacer /criteres par /validation dans les navItems du BottomNav mobile.
  (Critères reste accessible via la sidebar desktop et via /criteres directement.)

== ÉTAPE 3 — Worker Python ==

W1 — prompt_chars (worker/llm_provider.py ligne ~229)
  Remplacer prompt_chars=len(prompt) par prompt_chars=len(system_prompt)+len(user_prompt).

W2 — Docstring scraper (worker/scraper.py ligne 12)
  Remplacer la ligne "La langue est déduite du suffixe de l'URL PDF..."
  par "La langue est forcée via --lang (URL de filtre CCE/RVV). Détection par suffixe en fallback uniquement."

W3 — STATUS_MAP en constante (worker/schemas.py)
  Déplacer STATUS_MAP hors de la boucle for dans normalize_response, en constante module.

== VÉRIFICATION FINALE ==
Après les modifications :
  npm run typecheck   → 0 erreur
  npm run lint        → 0 erreur

Ne pas lancer le pipeline worker (main.py / analyze.py) dans cette session.
Ne pas créer l'onglet Scrap (prévu session suivante).
Mettre à jour PROJECT_STATE.md après.
```

## Prochain prompt recommandé — Pipeline worker (après les correctifs)

```
Reprends le projet (lis CLAUDE.md + PROJECT_STATE.md).

Les correctifs d'audit sont appliqués. Objectif : repartir d'une DB propre et lancer le pipeline sur 50 arrêts réels (30 FR + 20 NL).

État cible après reset :
- DB vidée via `truncate table arrets cascade;` puis re-scrapée (statut=en_attente)
- worker/main.py extrait le texte PDF → arret_segments (statut → termine)
- worker/analyze.py analyse avec qwen3:4b → arret_criteria_values (value_boolean maintenant géré)
- /validation affiche les valeurs LLM pour validation juridique

Commandes à lancer (depuis worker/ avec Ollama actif) — voir « Prochaine action exacte » :
  python scraper.py --lang fr --limit 30  ;  python scraper.py --lang nl --limit 20
  $env:PYTHONIOENCODING="utf-8"; python main.py --limit 55
  python analyze.py --limit 5  (contrôle)  puis  python analyze.py --limit 50
  ⚠️ PAS de --group en batch (dedup fetch_pending_analyze) — --group = QA ciblée par arrêt.

Diagnostiquer les erreurs, vérifier /validation, préparer checklist réunion cliente.
```

## Fichiers modifiés – session 2026-06-03 (scraper multi-langue + nettoyage DB)

### Scraper
- `worker/scraper.py` — Refonte du filtrage langue :
  - Ajout `--lang fr/nl/de` : utilise les vraies URLs de filtre (`/fr/arr/lang/french` etc.)
  - Ajout `--year` : filtre par année (`/date/2026`), cumulable avec `--lang`
  - Ajout `--list-path` : surcharge URL pour tests
  - Ajout `--debug-html` : affiche le HTML brut des 2 premiers li pour diagnostic
  - Langue forcée depuis `--lang` (plus de détection par suffixe PDF quand URL filtrée)
  - `parse_page()` renommé param `lang_override` (était `lang_filter`)
  - Avertissement traitement massif : 50 → **100 arrêts**

### App Next.js
- `src/app/(app)/validation/page.tsx` — Bannière blocage : "50 arrêts" → **"100 arrêts"**

### Décision importante
- **Le suffixe `.an_` dans les URLs PDF n'est PAS un code langue.** Toute l'ancienne logique `LANG_MAP` était fausse. La langue correcte vient de l'URL de filtre du site CCE/RVV.
- **DB nettoyée** : `arret_criteria_values`, `arret_segments`, `arrets` vidés via SQL Supabase.
- **Re-scraping propre** : 30 FR (`/fr/arr/lang/french`) + 20 NL (`/fr/arr/lang/dutch`) = 50 arrêts.

## Fichiers créés/modifiés – session 2026-06-02 (phase 6b/6c/7)

### Scraper (phase 7)
- `worker/scraper.py` — NOUVEAU : scrape https://www.rvv-cce.be/fr/arr, parse HTML (BeautifulSoup4), détecte langue depuis suffixe PDF (.fr_/. an_), upsert idempotent dans `arrets`, délai poli entre pages, bannière anti-traitement-massif. 50 arrêts réels insérés.
- `worker/requirements.txt` — Ajout `beautifulsoup4==4.12.3` + `lxml==5.3.0`

### Robustification LLM (amélioration phase 5)
- `worker/llm_provider.py` — Refonte majeure : messages system/user séparés dans l'API chat, **prefilling `{"items":[`** (force le modèle à produire du JSON sans phase de thinking), `num_predict=3000`, `_extract_json` amélioré avec fallback sur tableau `items[]`, `_find_matching_brace` robuste
- `worker/prompts.py` — `build_prompt()` retourne maintenant `(system_prompt, user_prompt)` tuple ; liste explicite des criterion_id dans le prompt ; few-shot avec les vrais IDs du groupe ; `MAX_PASSAGE_CHARS` 3000 → **5000**
- `worker/schemas.py` — Schéma simplifié (seul `items` requis, champs wrapper optionnels) ; `validate_response()` **filtre** les items à ID invalide au lieu de rejeter toute la réponse ; ajout `"not_extracted"` dans l'enum status
- `worker/analyze.py` — `MAX_RETRIES` 1 → **2** (3 tentatives max) ; adaptation à `build_prompt()` retournant un tuple

### Validation juridique (phase 6)
- `supabase/migrations/005_validation.sql` — NOUVEAU : colonnes `evidence_excerpt`, `validation_status`, `validation_note` sur `arret_criteria_values` ; RLS admin+avocat
- `src/lib/types.ts` — Type `ValidationStatus` + champs validation sur `ArretCriteriaValue`
- `src/app/actions/validation.ts` — NOUVEAU : Server Action `updateValidationStatus`
- `src/app/(app)/validation/page.tsx` — NOUVEAU : liste arrêts avec barre progression + bannière blocage
- `src/app/(app)/validation/[id]/page.tsx` — NOUVEAU : tableau QA par section + stats par groupe + avertissement incertains
- `src/app/(app)/validation/[id]/ValidationRow.tsx` — NOUVEAU : 5 boutons statut + note + feedback
- `src/app/(app)/validation/[id]/export/route.ts` — NOUVEAU : export CSV par arrêt
- `src/components/Sidebar.tsx` — Lien « Validation » ajouté en section Admin
- `worker/analyze.py` — Stockage `evidence_excerpt` dans `store_criteria_values`

### Corrections critères (phase 6c)
- `data/criteria_canonical.json` — 6 `llm_group` corrigés + typo CvV→RvV
- `data/criteria_fr.json` — 5 `llm_group` corrigés + typo CvV→RvV
- `data/criteria_nl.json` — 1 `llm_group` corrigé
- `supabase/migrations/006_criteria_fixes.sql` — NOUVEAU : correction label `fr_005` en base
- `scripts/fix-criteria.mjs` — NOUVEAU : script reproductible de correction (JSON + Supabase)

## Décisions prises – session 2026-06-02

- **Prefilling LLM** : injecter `{"items":[` comme début de message assistant force qwen3 à produire du JSON sans thinking. Validé : 10–30s/groupe au lieu de 120–530s.
- **Scraper CCE/RVV** : `/fr/arr?page=N`, 50 résultats/page, langue déduite du suffixe PDF. Délai 1.5s entre pages.
- **Arrêts réels scrapés** : 50 arrêts CCE 342xxx (NL récents). Les arrêts fictifs du seed (260.001–015) ont des PDF en 404 → passeront en `erreur` à l'extraction, ne polluent pas `/validation`.
- **llm_group corrigés** : fr_032–035 → `persecution_claims` ; fr_041 → `decision_reasoning` ; nl_001 → `metadata`.
- **Critères FR fusionnés** : fr_025 et fr_033 restent fusionnés jusqu'à décision explicite de la cliente.
- **`not_extracted`** ajouté à l'enum status pour éviter les rejets répétés.
- **MAX_RETRIES=2** : 3 tentatives max par groupe (était 2).
- **`validation_status` RLS** : avocat peut valider, pas seulement admin.

## Infrastructure Supabase

- Migration `001_profiles_organisations.sql` **appliquée**.
- Migration `002_criteria.sql` **appliquée** — 96 critères importés.
- Migration `003_arrets.sql` **appliquée** — 65 arrêts en base (15 fictifs + 50 réels).
- Migration `004_segments.sql` **appliquée**.
- Migration `005_validation.sql` **appliquée** — colonnes validation opérationnelles.
- Migration `006_criteria_fixes.sql` **appliquée** — typo CvV→RvV corrigé.
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
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"   # si Ollama absent du PATH

# Scraper (insérer nouveaux arrêts)
$env:PYTHONIOENCODING="utf-8"; python scraper.py --limit 50
$env:PYTHONIOENCODING="utf-8"; python scraper.py --limit 50 --dry-run   # test sans écriture

# Extraction PDF
$env:PYTHONIOENCODING="utf-8"; python main.py --limit 60

# Analyse LLM (batch : tous les groupes par arrêt, PAS de --group)
$env:PYTHONIOENCODING="utf-8"; python analyze.py --limit 50
$env:PYTHONIOENCODING="utf-8"; python analyze.py --arret-id <uuid> --group metadata --dry-run   # QA ciblée

# Critères
node --env-file=.env.local scripts/import-criteria.mjs
node --env-file=.env.local scripts/fix-criteria.mjs   # rejouer les corrections

# Seed arrêts fictifs (si besoin de démo)
node --env-file=.env.local scripts/seed-arrets.mjs
```

UUID de test validé : `96a30e74-ca27-4400-992a-940e1378f6fe` (CCE 260.002, NL, 45 segments, statut=termine)

Variables `.env.local` requises :
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
LLM_TIMEOUT_SECONDS=180
LLM_MAX_INPUT_CHARS=8000
LLM_STORE_RAW_OUTPUT=false
```

## Risques ouverts

- **Qualité LLM non validée** : les valeurs extraites par `qwen3:4b` n'ont pas encore été vérifiées par l'avocate. Ne pas traiter plus de 50 arrêts avant validation.
- **Hallucinations possibles** : surveiller les critères booléens et les dates.
- **50 arrêts en base sont 30 FR + 20 NL** — mélange voulu pour la validation. Le pipeline (main.py + analyze.py) traite les deux langues sans distinction.
- **`llm_group` manquant en base** : colonne absente de `criteria` — fallback automatique sur `data/criteria_canonical.json`. Impact : si JSON et base divergent, la base prime.
- **Critères FR fusionnés** (fr_025, fr_033) : la cliente a des critères séparés dans son Excel. À clarifier en réunion.
- **IDs tronqués** (44 IDs ≥ 50 chars) : plus bloquants grâce au prefilling, mais à surveiller si le modèle hallucine encore des completions.
- **Arrêts fictifs seed** : 15 arrêts (CCE 260.001–015) ont des PDF en 404 → statut `erreur` après extraction. Ne nuisent pas à la validation mais polluent les stats.
- **Ollama service** : doit être démarré manuellement sur Windows. Vérifier `ollama list` avant `analyze.py`.
- **PATH Ollama** : `$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"` si absent.
- **Rôle /parametres** : ✅ branché sur `profiles` (I1). La section Admin de la sidebar dépend désormais du rôle (I2) — un compte `lecteur` ne la voit plus. Vérifier que le compte de démo est bien `admin`/`avocat`.
- **PostCSS CVE modérées** : bundlées par Next.js, non corrigeables sans downgrade. À surveiller.
- **Seed idempotent** : relancer le script met à jour les arrêts existants (acceptable MVP).
- **Figma MCP** : inaccessible via API token — utiliser Chrome MCP + screenshots en contournement.

## Points de vigilance permanents

- Ne pas lancer de traitement massif (> 50 arrêts) avant validation juridique.
- Ne pas stocker les PDF.
- Ne pas envoyer les PDF ou l'arrêt complet au LLM.
- Ne pas modifier rétroactivement les analyses après changement de critères sans retraitement explicite.
- Maintenir ce fichier à jour avant chaque `/clear`.
- Lancer `npm install` avant `npm run dev` (node_modules absent du repo).
- Appliquer les migrations SQL dans Supabase avant tout test fonctionnel.
- `.env.example` ne doit jamais contenir de vraies clés.
