# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-01 (phase 3 terminée — prêt pour /clear)

## Objectif actuel

Construire une première version montrable à la cliente avant tout traitement massif.

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
- Navigation mobile : bottom nav 5 items (Accueil, Arrêts, Recherche, Critères, Stats) + Paramètres via icône TopBar.
- Next.js 15.5.18 (upgrade sécurité depuis 15.3.3).
- La fiche détail affiche l'URL publique CCE/RVV — aucun PDF stocké sur le serveur.
- Le seed insère 15 arrêts fictifs réalistes (FR+NL) via upsert idempotent.
- Les filtres de recherche passent par l'URL (searchParams) pour être partageables.

## Stack retenue

- Next.js 15.5.18 + TypeScript + Tailwind.
- Supabase Auth + Postgres.
- Vercel pour l'app.
- Worker local séparé pour scraping/extraction/analyse.
- Ollama local pour test LLM.
- PyMuPDF / pdfplumber / OCR fallback pour PDF.

## État des phases

| Phase | Statut | Notes |
|---|---|---|
| 0. Préparation repo | ✅ Terminé | Next.js initialisé, .gitignore, .env.example, structure dossiers |
| 1. Base SaaS | ✅ Audité et validé | Auth, layout mobile, rôles, navigation, pages placeholder. TypeScript ✅, Lint ✅ |
| 2. Critères | ✅ Terminé + commité | Migration 002, import JSON, page admin mobile-first, toggle admin, audit log |
| 3. Arrêts et recherche | ✅ Terminé | Migration 003, seed 15 arrêts, liste cartes, fiche détail, filtres avancés, stats |
| 4. Extraction PDF | À faire | Worker local, extraction, nettoyage |
| 5. Analyse LLM | À faire | Ollama, JSON schema, validation |
| 6. Validation avocate | À faire | Export/écran QA |
| 7. Daily scraper | À faire | Détection nouveaux arrêts |
| 8. Traitement massif | Bloqué | Attendre validation juridique |

## Prochaine action exacte

Démarrer la phase 4 : worker local d'extraction texte PDF.
Étapes : téléchargement temporaire du PDF via URL publique, extraction PyMuPDF, nettoyage, segmentation, stockage du texte extrait (sans stocker le PDF).

## Prochain prompt recommandé

Phase 4 : créer le worker local Node.js/Python qui, pour un arrêt donné :
1. Télécharge temporairement le PDF depuis `arrets.pdf_url`.
2. Extrait le texte avec PyMuPDF (fallback pdfplumber).
3. Nettoie et segmente le texte en passages.
4. Stocke les passages utiles dans une nouvelle table `arret_text_segments`.
5. Met à jour `arrets.statut_traitement` à `en_cours` puis `termine`.
Ne pas appeler le LLM dans cette phase.

## Fichiers créés/modifiés – phase 3 (2026-06-01)

- `supabase/migrations/003_arrets.sql` — NOUVEAU : tables arrets, arret_criteria_values, processing_jobs, model_runs ; RLS (is_admin()), index, trigger updated_at, FK différée acv_model_run_fk
- `scripts/seed-arrets.mjs` — NOUVEAU : seed idempotent de 15 arrêts fictifs réalistes FR/NL ; usage : `node --env-file=.env.local scripts/seed-arrets.mjs`
- `src/lib/types.ts` — Ajout : types Arret, ArretCriteriaValue, ProcessingJob, ModelRun
- `src/components/ArretCard.tsx` — NOUVEAU : carte arrêt mobile-first (badges langue/statut, numéro, date, matière, pays, résumé tronqué)
- `src/app/(app)/arrets/page.tsx` — Refait : Server Component, liste cartes triée par date, compteur résultats
- `src/app/(app)/arrets/[id]/page.tsx` — NOUVEAU : fiche détail — en-tête, métadonnées, lien PDF public, critères et valeurs LLM (vides en V1 seed)
- `src/app/(app)/recherche/FiltresPanel.tsx` — NOUVEAU : Client Component filtres repliables (langue, matière, pays, statut) via URL searchParams
- `src/app/(app)/recherche/page.tsx` — Refait : Server Component, filtres dynamiques + résultats avec Suspense
- `src/app/(app)/stats/page.tsx` — Refait : Server Component, totaux par langue/statut/matière avec barres de progression

## Fichiers créés/modifiés – phase 2 (2026-06-01)

- `supabase/migrations/002_criteria.sql` — NOUVEAU : tables criterion_versions, criteria, criterion_audit_logs ; RLS (is_admin()), index, trigger updated_at
- `scripts/import-criteria.mjs` — NOUVEAU : import idempotent des 96 critères (48 FR + 48 NL) depuis data/criteria_canonical.json ; usage : `node --env-file=.env.local scripts/import-criteria.mjs`
- `src/lib/types.ts` — Ajout : types CriterionVersion, Criterion, CriterionAuditLog
- `src/app/actions/criteria.ts` — NOUVEAU : Server Action `toggleCriterion` — vérifie rôle admin, met à jour `criteria.active`, insère audit log
- `src/app/(app)/criteres/CriterionToggle.tsx` — NOUVEAU : Client Component toggle switch (useTransition, pending state)
- `src/app/(app)/criteres/page.tsx` — Refait : Server Component, tabs FR/NL via searchParams, groupement par section, toggle admin, indicateur lecteur, message si table vide

## Fichiers créés/modifiés – phase 1 (2026-06-01)

- `package.json` — Next.js 15.3.3 → 15.5.18 ; autoprefixer ajouté
- `src/lib/supabase/middleware.ts` — typage explicite CookieOptions
- `src/lib/supabase/server.ts` — typage explicite CookieOptions
- `src/app/actions/auth.ts` — signature compatible useActionState (_prevState)
- `src/app/login/page.tsx` — délégation à LoginForm
- `src/app/login/LoginForm.tsx` — NOUVEAU : useActionState + état pending
- `src/components/BottomNav.tsx` — Stats réintégré, Réglages → TopBar
- `src/components/TopBar.tsx` — icône ⚙ lien /parametres
- `supabase/migrations/001_profiles_organisations.sql` — is_admin() security definer

## Infrastructure Supabase

- Projet Supabase créé et connecté.
- Migration `001_profiles_organisations.sql` **appliquée** (organisations, profiles, trigger, RLS, is_admin()).
- Migration `002_criteria.sql` **appliquée** (criterion_versions, criteria, criterion_audit_logs).
- Import des 96 critères (48 FR + 48 NL) **effectué** via `scripts/import-criteria.mjs`.
- Migration `003_arrets.sql` **à appliquer** dans Supabase (arrets, arret_criteria_values, processing_jobs, model_runs).
- Seed `scripts/seed-arrets.mjs` **à exécuter** après application de 003.
- Page `/criteres` **vérifiée fonctionnelle**.
- Clé Supabase service role **régénérée** — `.env.local` mis à jour.
- `.env.local` configuré avec les vraies clés (jamais commité).
- App fonctionnelle sur http://localhost:3000.

## Commandes de référence

```bash
# Démarrer
npm install
npm run dev

# Vérifications
npm run typecheck    # → 0 erreur
npm run lint         # → 0 erreur

# Phase 2 – à exécuter après avoir appliqué 002_criteria.sql
node --env-file=.env.local scripts/import-criteria.mjs

# Phase 3 – à exécuter après avoir appliqué 003_arrets.sql dans Supabase
node --env-file=.env.local scripts/seed-arrets.mjs
```

## Risques ouverts

- **Migration 003 non encore appliquée** : les pages /arrets, /recherche et /stats retourneront une erreur tant que la migration n'est pas exécutée dans Supabase Dashboard.
- **Seed idempotent mais pas versionné** : relancer le script met à jour les arrêts existants. Acceptable pour le MVP.
- **Import idempotent mais `activated_at` écrasé** : chaque relance du script import-criteria remet `activated_at` à maintenant. Acceptable pour le MVP.
- **Groupement sections en page critères** : si `criteria` est `null` (erreur réseau), la boucle de groupement plante avant la guard.
- **PostCSS CVE modérées** : bundlées par Next.js, non corrigeables sans downgrade. À surveiller.
- **Rôle en dur dans /parametres** : toujours "avocat" statiquement — à brancher sur `profiles` en phase 4 ou 5.
- **pdf_url du seed** : URLs générées selon le pattern CCE supposé (`a260001.fr.pdf`) — à vérifier sur le vrai site avant la démo.

## Points de vigilance permanents

- Ne pas lancer de traitement massif.
- Ne pas stocker les PDF.
- Ne pas envoyer les PDF ou l'arrêt complet au LLM.
- Ne pas modifier rétroactivement les analyses après changement de critères sans retraitement explicite.
- Maintenir ce fichier à jour avant chaque `/clear`.
- Lancer `npm install` avant `npm run dev` (node_modules absent du repo).
- Appliquer les migrations SQL dans Supabase avant tout test fonctionnel.
- `.env.example` ne doit jamais contenir de vraies clés.
