# Permissions Claude Code

## Objectif

Permettre à Claude Code de travailler efficacement sans ouvrir de permissions dangereuses.

## Principe

Commencer en mode prudent. Autoriser progressivement uniquement les actions utiles.

Claude Code gère des règles `allow`, `ask`, `deny`. Les règles de refus sont prioritaires.

Source utile :
https://code.claude.com/docs/en/permissions

## Ne jamais utiliser

```bash
claude --dangerously-skip-permissions
```

## Actions généralement acceptables

- Lire les fichiers du projet.
- Modifier les fichiers du projet.
- Créer de nouveaux fichiers dans le projet.
- Lancer les commandes de développement locales.
- Lancer les tests locaux.
- Lire les fichiers `CLAUDE.md`, `PROJECT_STATE.md`, `docs/`, `prompts/`, `data/`.

## Actions à demander explicitement

- Installer un package.
- Modifier la configuration Supabase.
- Exécuter une migration SQL.
- Supprimer des fichiers.
- Lancer un scraper réel.
- Lancer une analyse IA sur plus de quelques arrêts.
- Modifier `.env`.
- Ajouter une dépendance lourde.

## Actions à refuser

- Lire des fichiers hors projet sans besoin clair.
- Supprimer un dossier entier.
- Lancer un scraping massif.
- Exposer des secrets.
- Commit/push sans demande explicite.
- Déployer en production sans validation.
- Stocker durablement des PDF.

## Exemple de fichier `.claude/settings.local.example.json`

Voir `.claude/settings.local.example.json`.

Ce fichier est volontairement un exemple. Il ne doit pas être copié aveuglément sans vérification.

## Prompt à utiliser après configuration

```text
Vérifie les permissions Claude Code du projet. Propose uniquement des autorisations minimales pour cette phase. Ne demande aucune permission dangereuse et n’utilise jamais --dangerously-skip-permissions.
```
