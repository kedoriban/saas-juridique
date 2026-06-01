# Risques et validation juridique

## Risque 1 – Hallucination IA

Le modèle peut inventer une information ou transformer une nuance juridique.

Garde-fous :

- JSON Schema strict.
- Evidence excerpt obligatoire si possible.
- Confidence.
- Validation humaine sur 50 arrêts.
- Pas de valeur validée automatiquement.

## Risque 2 – Mauvaise extraction PDF

Un arrêt peut avoir un texte mal extrait, des en-têtes parasites ou une structure confuse.

Garde-fous :

- Score qualité extraction.
- Fallback pdfplumber.
- OCR seulement si nécessaire.
- Statut `extraction_failed` ou `needs_review`.

## Risque 3 – Scraping bloqué ou fragile

Le site source peut limiter l’accès automatisé.

Garde-fous :

- Modes alternatifs : import manuel d’URLs, petit lot, ajout manuel.
- Débit limité.
- Logs.
- Pas de contournement agressif.
- Validation juridique/technique avant historique.

## Risque 4 – Modification des critères

Une modification de critère peut rendre les anciennes analyses incohérentes.

Garde-fous :

- Versionnement.
- Pas de modification rétroactive.
- Retraitement explicite seulement.
- Audit log.

## Risque 5 – Partage de comptes

Des utilisateurs peuvent partager leurs accès.

Garde-fous :

- MFA.
- Table `active_sessions`.
- Heartbeat.
- Limite de sessions par utilisateur/organisation.
- Révocation automatique des sessions les plus anciennes ou blocage selon règle métier.

## Risque 6 – Coûts et performance

200k+ arrêts ne peuvent pas être traités sur le PC de développement.

Garde-fous :

- MVP sur 50 arrêts.
- Ollama local uniquement pour test.
- Worker interchangeable.
- Serveur GPU plus tard.
- Traitement par lots reprenables.

## Décision go/no-go avant massif

Avant traitement massif, il faut valider :

- taux d’erreur global ;
- taux d’erreur par critère ;
- taux d’erreur par langue ;
- temps moyen par arrêt ;
- coût estimé ;
- stabilité du scraping ;
- conformité avec les attentes de l’avocate.
