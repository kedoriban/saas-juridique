# Pack de cadrage Claude Code – SaaS juridique CCE/RVV

Ce dossier contient les fichiers de cadrage à déposer à la racine du projet avant de lancer Claude Code.

## Objectif

Construire une première version montrable rapidement à la cliente, sans lancer de traitement massif et sans faire lire les PDF au LLM.

## Fichiers principaux

- `CLAUDE.md` : règles permanentes que Claude Code doit relire au début de chaque session.
- `PROJECT_STATE.md` : état vivant du projet à maintenir à jour après chaque phase.
- `docs/00-guide-accompagnement-claude-code.md` : guide pas à pas pour utilisateur non technique.
- `docs/01-prompts-claude-code-etapes.md` : prompts courts et réutilisables.
- `docs/02-figma-mcp.md` : configuration Figma MCP et consignes d’utilisation.
- `docs/03-ollama-windows.md` : installation et usage Ollama sur Windows.
- `docs/04-schema-canonique-criteres.md` : schéma canonique des critères.
- `docs/05-strategie-scraping.md` : stratégie scraping CCE/RVV.
- `docs/06-strategie-extraction-pdf.md` : extraction PDF sans stockage durable.
- `docs/07-strategie-nettoyage-decoupage.md` : nettoyage, segmentation et sélection de passages.
- `docs/08-strategie-llm-local.md` : stratégie LLM local et analyse JSON stricte.
- `docs/09-permissions-claude-code.md` : permissions prudentes Claude Code.
- `docs/10-criteres-acceptation.md` : critères d’acceptation par phase.
- `docs/11-risques-validation-juridique.md` : risques et garde-fous juridiques.
- `prompts/` : prompts par phase à copier dans Claude Code.
- `data/criteria_canonical.json` : critères FR/NL extraits des Excel.
- `data/criteria_canonical.csv` : même contenu au format CSV.

## Résultat de l’extraction des critères

- Critères français extraits : 48
- Critères néerlandais extraits : 48
- Total : 96

Les critères FR et NL sont conservés séparément. Aucune traduction automatique n’a été faite.

## Règle non négociable

Le LLM ne lit jamais les PDF. Il lit uniquement du texte pré-extrait, nettoyé, structuré, découpé et réduit.
