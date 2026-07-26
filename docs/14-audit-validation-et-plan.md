# Audit validation + plan d'évolution (2026-07-26)

Audit complet de l'interface de validation à partir de retours cliente + d'un export CSV
réel (`audit_validation_cce_2026-07-26.csv`, 1000 lignes) + d'une V2 de la grille de
critères (`Critères analyse_V2.xlsx`, FR). Décisions prises et Phase 0 livrée.

## Constats vérifiés (avec causes racines)

### 1. Verdicts de l'avocate jamais enregistrés (critique)
- `updateValidationStatus` écrivait `validation_status` (parfois `null`) **et** `validated_at = now()`
  ensemble ([validation.ts:29-34](../src/app/actions/validation.ts)). L'UI envoyait `status = null`
  (toggle-off `ValidationRow.tsx:43`, Ctrl+Entrée sans statut).
- Résultat CSV : `statut_validation` **0/1000**, `commentaire_avocate` 49/1000, `date_validation` 85/1000.
- La copie de travail avait **retiré le garde** `if(!status) return` présent dans le commit ; comme
  le déploiement = `vercel --prod` (déploie la copie de travail), c'est la version buguée qui tournait.
- Erreur avalée : `await …; setSaved(true)` sans lire `{error}` → « ✓ Enregistré » même en échec.

### 2. Crash « Application error » + perte de travail
- **Aucun error boundary** dans `src/app` → toute erreur (rejet de server action, session expirée,
  échec `revalidatePath`) affichait le message générique Next.js et démontait toute la page.
- Commentaire non autosauvé (Ctrl+Entrée ou bouton grisé si pas de statut), pas de garde navigation.

### 3. Export CSV non fiable
- **Tronqué à 1000 lignes** (pas de pagination ; correctif `8b46d8e` non porté ici) → CSV incomplet au-delà de ~10 arrêts.
- Trié par `created_at` au lieu de `order_index`. Pas de BOM UTF-8 (accents cassés dans Excel).
- Aucune colonne « valeur corrigée » : la bonne valeur ne vit que dans le commentaire libre.

### 4. Qualité d'extraction (fond)
Les 49 commentaires cliente = règles à injecter dans `worker/prompts.py` : défaut « NON » si non
mentionné, distinguer chaque demandeur (multi-demandeurs), sous-questions, CGRA vs CCE, durée =
date arrêt − date introduction, désinfibulation = MGF type III, résumé 8-15 descripteurs, citer la jurisprudence.

### 5. État technique pour les évolutions
- Critères : clé = `criteria.id` (texte). Réordonner/renuméroter = sûr ; renommer un id = casse tout.
  Seed via `scripts/import-criteria.mjs` (`version_label` figé `client_excel_v1`). `createCriterion`
  admin insère sans id (PK sans default) → **création via UI probablement cassée** (à vérifier).
- Clé API : page Paramètres informative, non gardée admin. `OPENAI_API_KEY` dans `.env.local` non
  consommé. `requireAdmin()` + RLS `is_admin()` réutilisables. Clé à garder côté serveur uniquement.
- ChatGPT : aucune route API (tout en server actions). Texte de l'arrêt déjà en base
  (`arrets.intermediate_json.sections[].text`, ~89k car., par autorité). Provider LLM = Python only
  → miroir TS à créer. Tables à prévoir : `arret_chat_messages`, `arret_ai_suggestions`.

## Grille V2 (FR) — révision lourde
48 → ~57 critères. Nouveaux : Tuteur, Décision (octroi/refus/renvoi/annulation), Demandeurs multiples,
Nouveaux documents devant CCE/RvV, Procédure orale/écrite, Comparution à l'audience, Portée juridique.
Scindés : Vulnérabilités↔violences parcours ; Crédibilité↔bénéfice du doute ; Protection nationale↔fuite
interne ; Persécutions hors-genre↔de genre. Section PERSÉCUTIONS distincte. « Lien vers l'arrêt » à
supprimer (doublon). Résumé mots-clés très détaillé. Cadre général : loi 15/12/1980, réponse par
demandeur, distinguer CGRA/CCE, citer la jurisprudence. **V2 = FR uniquement** (NL reste V1).

## Décisions
- Ce round = **Phase 0 uniquement**.
- Ré-analyse V2/prompts = **nouveaux arrêts + lot de référence** (mesurer avant traitement massif).
- Néerlandais = **V2 FR maintenant, NL reste en V1** jusqu'à une V2 NL validée.

## Plan par phases
- **Phase 0 — Correctifs critiques ✅ LIVRÉE** (branche `fix/validation-phase0`, commit `dc9f203`).
- **Phase 1 — Validation « training-ready »** : champ valeur corrigée structuré + bouton « Adopter » ;
  statut non destructible (fait) ; migration des corrections en commentaire.
- **Phase 2 — Critères V2 (FR)** : import `client_excel_v2` (nouveaux ids, libellés/détails), archivage
  v1, fix `createCriterion`, MAJ `data/criteria_*.json`.
- **Phase 3 — Qualité extraction (prompts.py)** : injecter les règles cliente + 49 commentaires,
  re-mesure sur lot de référence.
- **Phase 4 — Intégration ChatGPT** : 4a clé API dans Paramètres (admin, serveur) ; 4b provider TS +
  route handlers proxy OpenAI ; 4c volet pré-remplissage côte-à-côte ; 4d chat persistant par arrêt.

## Phase 0 — ce qui a été livré (commit `dc9f203`)
| Fichier | Changement |
|---|---|
| `src/app/actions/validation.ts` | Scindé en `setValidationStatus` (statut+date, ou effacement explicite) / `saveValidationNote` (commentaire seul). Plus de `validated_at` sans statut. |
| `src/app/(app)/validation/[id]/ValidationRow.tsx` | Statut non destructif + bouton « ✕ Effacer », lecture de `{error}`, autosave debounced (800 ms) + flush au blur, garde `beforeunload`. |
| `src/app/(app)/error.tsx`, `src/app/global-error.tsx` | Error boundaries (fin du crash générique + perte de page). |
| `src/app/(app)/validation/export/route.ts`, `[id]/export/route.ts` | Pagination, tri `order_index`, BOM UTF-8, helper partagé. |
| `src/lib/csv.ts` | Helper CSV (échappement + BOM + CRLF). |

Build + typecheck + lint OK. Parcours authentifié à tester manuellement (login requis).
