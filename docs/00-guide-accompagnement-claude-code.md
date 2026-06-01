# Guide d’accompagnement Claude Code

Ce guide est écrit pour une personne non technique qui doit piloter Claude Code sans perdre le contexte du projet.

## 1. Avant de commencer

Créer un dossier de projet sur le PC Windows, puis y déposer tout le contenu de ce pack.

Exemple PowerShell :

```powershell
mkdir C:\Projects\saas-juridique-cce-rvv
cd C:\Projects\saas-juridique-cce-rvv
```

Déposer ensuite les fichiers :

- `CLAUDE.md`
- `PROJECT_STATE.md`
- `docs/`
- `prompts/`
- `data/`
- `.claude/`

## 2. Principe de travail avec Claude Code

Claude Code ne doit jamais recevoir tout le projet mentalement en une seule demande. Il faut travailler par phases courtes.

À chaque début de session, demander :

```text
Lis CLAUDE.md et PROJECT_STATE.md. Résume l’état du projet en 10 lignes maximum, puis attends ma prochaine consigne.
```

Ensuite, copier le prompt de phase correspondant depuis le dossier `prompts/`.

## 3. Quand utiliser /compact

Utiliser `/compact` quand la session devient longue mais que la phase n’est pas terminée.

Exemples :

- Claude a déjà modifié plusieurs fichiers.
- Il reste des corrections à faire dans la même phase.
- Le contexte commence à devenir lourd.

Avant `/compact`, demander :

```text
Mets à jour PROJECT_STATE.md avec ce qui a été fait, les fichiers modifiés, les décisions prises et la prochaine action exacte. Ensuite je lancerai /compact.
```

Puis taper :

```text
/compact
```

## 4. Quand utiliser /clear

Utiliser `/clear` après une phase réellement terminée, testée et documentée dans `PROJECT_STATE.md`.

Avant `/clear`, demander :

```text
Vérifie que PROJECT_STATE.md est à jour, liste les fichiers modifiés et donne-moi le prochain prompt à utiliser après /clear.
```

Puis taper :

```text
/clear
```

Après `/clear`, recommencer par :

```text
Lis CLAUDE.md et PROJECT_STATE.md. Résume l’état du projet en 10 lignes maximum, puis attends ma prochaine consigne.
```

## 5. Quand utiliser /diff

Utiliser `/diff` avant de valider une phase ou avant de demander une revue.

```text
/diff
```

Puis demander :

```text
Explique-moi les changements du diff en langage simple. Signale les risques et les fichiers à vérifier manuellement.
```

## 6. Quand utiliser /code-review

Utiliser `/code-review` avant de considérer une phase comme terminée.

```text
/code-review
```

Puis demander :

```text
Corrige uniquement les problèmes critiques ou évidents. Ne lance pas de refonte large.
```

## 7. Règles anti-perte de contexte

- Une phase = un objectif.
- Un prompt = un petit ensemble de fichiers.
- Après chaque phase, `PROJECT_STATE.md` est mis à jour.
- Après chaque `/clear`, Claude relit `CLAUDE.md` et `PROJECT_STATE.md`.
- Les gros documents sont dans `docs/`; Claude ne les lit que si nécessaire.

## 8. Règle de sécurité documentaire

Ne jamais demander :

```text
Analyse directement ce PDF avec le LLM.
```

Toujours demander :

```text
Extrais d’abord le texte avec le pipeline classique, nettoie-le, segmente-le, sélectionne les passages utiles, puis analyse uniquement ces passages avec le LLM.
```
