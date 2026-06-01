# Critères d’acceptation par phase

## Phase 0 – Préparation repo

Accepté si :

- Le repo contient `CLAUDE.md`, `PROJECT_STATE.md`, `docs/`, `prompts/`, `data/`.
- Next.js est initialisé.
- TypeScript est actif.
- Tailwind est configuré.
- `.env.example` existe.
- `.gitignore` exclut `.env`, `.tmp/`, caches PDF et fichiers secrets.
- `PROJECT_STATE.md` est mis à jour.

## Phase 1 – Base SaaS

Accepté si :

- Supabase client est configuré.
- Auth login/logout fonctionne.
- Les routes privées sont protégées.
- Le layout mobile first existe.
- Les pages principales existent même en placeholder.
- Les rôles de base sont prévus.

## Phase 2 – Critères

Accepté si :

- Les critères FR/NL sont importés depuis `data/criteria_canonical.json`.
- L’ordre d’origine est conservé.
- Les critères FR/NL ne sont pas traduits ni fusionnés.
- L’admin critères affiche les sections et critères.
- On peut activer/désactiver un critère.
- Une modification ne détruit pas l’historique.

## Phase 3 – Arrêts et recherche

Accepté si :

- La table `arrets` existe.
- Une liste d’arrêts s’affiche.
- Une fiche détail s’affiche.
- L’URL PDF publique est visible.
- Les filtres principaux fonctionnent.
- Les résultats sont utilisables sur mobile.

## Phase 4 – Extraction PDF

Accepté si :

- Le worker peut traiter une URL PDF.
- Le PDF est temporaire.
- Le PDF est supprimé après extraction.
- Le texte est extrait.
- La méthode d’extraction est journalisée.
- Les erreurs sont stockées proprement.
- Aucun PDF n’est stocké durablement.

## Phase 5 – Analyse LLM locale

Accepté si :

- Ollama est appelé via un adaptateur.
- Le modèle est configurable par variable d’environnement.
- Les prompts sont groupés par critères.
- Le LLM reçoit uniquement des passages utiles.
- La réponse JSON est validée.
- Les erreurs JSON sont gérées.
- Les valeurs extraites sont stockées avec confidence et preuve.

## Phase 6 – Validation avocate

Accepté si :

- La cliente peut vérifier les résultats de 50 arrêts.
- Les erreurs peuvent être marquées.
- Un export QA est disponible.
- Les taux d’erreurs par critère sont visibles.
- Une décision go/no-go est possible avant traitement massif.

## Phase 7 – Daily scraper

Accepté si :

- Le job détecte les nouveaux arrêts.
- Il ne traite pas l’historique complet.
- Il est idempotent.
- Il journalise les erreurs.
- Il peut être désactivé facilement.

## Phase 8 – Traitement massif

Accepté uniquement après validation juridique si :

- Un plan de lots existe.
- Un serveur adapté est choisi.
- Les coûts sont estimés.
- Les jobs sont reprenables.
- Le monitoring est en place.
- La cliente a validé la qualité d’extraction.
