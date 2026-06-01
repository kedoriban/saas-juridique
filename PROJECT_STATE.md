# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-01 (phase 2)

## Objectif actuel

Construire une première version montrable à la cliente avant tout traitement massif.

## Décisions validées

- Le LLM ne lit jamais directement les PDF.
- Les PDF ne sont pas stockés durablement.
- Le worker extrait d'abord le texte avec un outil classique.
- Le texte est nettoyé, segmenté et réduit avant analyse LLM.
- Les critères FR et NL restent deux référentiels distincts.
- Le PC Windows sert au développement, aux tests locaux et à la démo limitée.
- Le traitement massif sera déplacé plus tard vers un serveur plus puissant.
- Le Mac mini est hors plan.
- Les parties Figma Focus et Imports d'arrêts sont ignorées.
- Rôles : admin / avocat / lecteur. Pas de paiement en V1.
- Navigation mobile : bottom nav 5 items (Accueil, Arrêts, Recherche, Critères, Stats) + Paramètres via icône TopBar.
- Next.js 15.5.18 (upgrade sécurité depuis 15.3.3).

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
| 2. Critères | ✅ Terminé | Migration SQL, import JSON, page admin mobile-first |
| 3. Arrêts et recherche | À faire | Tables, seed, liste, fiche détail |
| 4. Extraction PDF | À faire | Worker local, extraction, nettoyage |
| 5. Analyse LLM | À faire | Ollama, JSON schema, validation |
| 6. Validation avocate | À faire | Export/écran QA |
| 7. Daily scraper | À faire | Détection nouveaux arrêts |
| 8. Traitement massif | Bloqué | Attendre validation juridique |

## Prochain prompt recommandé

Phase 3 : tables arrêts, seed de 50 arrêts, liste et fiche détail. Copier `prompts/phase-03-arrets-recherche.md`.

## Derniers fichiers modifiés (phase 2 – 2026-06-01)

- `supabase/migrations/002_criteria.sql` — NOUVEAU : tables criterion_versions, criteria, criterion_audit_logs, RLS, index, trigger updated_at
- `scripts/import-criteria.mjs` — NOUVEAU : script d'import idempotent depuis data/criteria_canonical.json
- `src/lib/types.ts` — Ajout types CriterionVersion, Criterion, CriterionAuditLog
- `src/app/actions/criteria.ts` — NOUVEAU : Server Action toggleCriterion (admin uniquement + audit)
- `src/app/(app)/criteres/CriterionToggle.tsx` — NOUVEAU : Client Component toggle switch
- `src/app/(app)/criteres/page.tsx` — Refait : page admin critères mobile-first, tabs FR/NL, sections, toggle admin

## Derniers fichiers modifiés (phase 1 audit – 2026-06-01)

- `package.json` – Next.js 15.3.3 → 15.5.18 (correctifs sécurité CVE)
- `src/lib/supabase/middleware.ts` – typage explicite CookieOptions (fix typecheck)
- `src/lib/supabase/server.ts` – typage explicite CookieOptions (fix typecheck)
- `src/app/actions/auth.ts` – signature compatible useActionState (_prevState)
- `src/app/login/page.tsx` – délégation à LoginForm (Server/Client split)
- `src/app/login/LoginForm.tsx` – NOUVEAU : affichage erreurs via useActionState + état pending
- `src/components/BottomNav.tsx` – Stats réintégré (manquait), Réglages déplacé vers TopBar
- `src/components/TopBar.tsx` – icône ⚙ lien vers /parametres
- `src/app/(app)/criteres/page.tsx` – apostrophe échappée (lint)
- `src/app/(app)/stats/page.tsx` – apostrophes échappées (lint)
- `supabase/migrations/001_profiles_organisations.sql` – fonction is_admin() security definer pour éviter récursion RLS infinie
- `package.json` – autoprefixer ajouté en devDependencies (manquait, causait Internal Server Error au démarrage)

## Infrastructure Supabase

- Projet Supabase créé et connecté.
- Migration `001_profiles_organisations.sql` appliquée (tables organisations + profiles, trigger, RLS, is_admin()).
- `.env.local` configuré avec les vraies clés (URL + anon key + service role key).
- App accessible et fonctionnelle sur http://localhost:3000.

## Commandes testées

```
npm install       → OK (autoprefixer ajouté en devDependencies — manquait)
npm run typecheck → OK (0 erreur)
npm run lint      → OK (0 erreur, 0 warning)
npm run dev       → OK — app tourne sur http://localhost:3000, .env.local chargé
```

## Limites connues documentées

- **PostCSS modéré** : 2 CVE modérées dans PostCSS bundlé par Next.js. Pas corrigeables sans downgrade majeur. À surveiller à la prochaine release Next.js.
- **Rôle en dur dans /parametres** : affiché "avocat" statiquement. Sera lu depuis `profiles` en phase 2 quand la table sera disponible.
- **Pas de route /auth/callback** : pas nécessaire pour email/password. À ajouter si magic link ou OAuth Supabase activés plus tard.
- **`next lint` déprécié** : avertissement informatif Next.js 15+, pas bloquant. Migrer vers ESLint CLI avant Next.js 16.
- **`.env.example` ne doit jamais contenir de vraies clés** : les secrets vont uniquement dans `.env.local` (ignoré par git).

## Points de vigilance

- Ne pas lancer de traitement massif.
- Ne pas stocker les PDF.
- Ne pas envoyer les PDF ou l'arrêt complet au LLM.
- Ne pas modifier rétroactivement les analyses après changement de critères sans retraitement explicite.
- Maintenir ce fichier à jour avant chaque `/clear`.
- Lancer `npm install` avant `npm run dev` (node_modules absent du repo).
- Appliquer la migration SQL dans Supabase avant tout test d'auth.
