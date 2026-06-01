# Prompts Claude Code étape par étape

Ces prompts sont conçus pour économiser les tokens. Ils doivent être utilisés dans l’ordre.

## Prompt de démarrage de session

```text
Lis CLAUDE.md et PROJECT_STATE.md. Résume l’état du projet en 10 lignes maximum. N’écris pas de code. Attends ma prochaine consigne.
```

## Phase 0 – Préparation du repo

Voir `prompts/phase-00-preparation-repo.md`.

Objectif : créer la structure du projet sans développer les fonctionnalités métier.

## Phase 1 – Base SaaS

Voir `prompts/phase-01-base-saas.md`.

Objectif : auth Supabase, layout mobile first, navigation et pages protégées.

## Phase 2 – Critères

Voir `prompts/phase-02-criteres.md`.

Objectif : importer les critères FR/NL depuis `data/criteria_canonical.json`, préserver l’ordre et créer l’admin critères.

## Phase 3 – Arrêts et recherche

Voir `prompts/phase-03-arrets-recherche.md`.

Objectif : tables `arrets`, valeurs de critères, liste, recherche avancée, fiche détail.

## Phase 4 – Extraction PDF

Voir `prompts/phase-04-extraction-pdf.md`.

Objectif : worker local qui télécharge temporairement, extrait, nettoie et supprime le PDF.

## Phase 5 – Analyse LLM locale

Voir `prompts/phase-05-llm-local.md`.

Objectif : Ollama, JSON Schema, prompts par groupe de critères, validation JSON.

## Phase 6 – Validation avocate

Voir `prompts/phase-06-validation-avocate.md`.

Objectif : validation humaine, export QA, taux d’erreur par critère.

## Phase 7 – Daily scraper

Voir `prompts/phase-07-daily-scraper.md`.

Objectif : détection quotidienne des nouveaux arrêts sans historique massif.

## Phase 8 – Traitement massif

Voir `prompts/phase-08-traitement-massif.md`.

Objectif : cadrage seulement. Ne pas exécuter avant validation juridique.
