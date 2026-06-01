# Stratégie LLM local

## Objectif

Analyser les arrêts à coût faible avec un LLM local pendant le MVP, sans dépendre définitivement d’Ollama.

## Principe

Créer un adaptateur LLM interchangeable :

- `ollama_local` pour le développement.
- `gpu_server` plus tard.
- éventuellement `cloud_llm` en fallback ponctuel si validé.

## Variables d’environnement

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
LLM_TIMEOUT_SECONDS=120
LLM_MAX_INPUT_CHARS=8000
LLM_STORE_RAW_OUTPUT=false
```

## Règles de prompt

Chaque appel LLM doit contenir :

- rôle : extraction juridique structurée ;
- langue de l’arrêt ;
- critères à extraire ;
- passages candidats uniquement ;
- JSON Schema strict ;
- interdiction d’inventer ;
- réponse `null` si non trouvé ;
- confidence obligatoire ;
- evidence excerpt obligatoire si possible.

## JSON attendu

```json
{
  "arret_id": "...",
  "language": "fr",
  "criterion_version": "client_excel_v1",
  "group": "identity",
  "items": [
    {
      "criterion_id": "fr_010_nationalite_du_demandeur",
      "value": "Guinée",
      "confidence": 0.82,
      "evidence_excerpt": "...",
      "status": "extracted"
    }
  ],
  "warnings": []
}
```

## Validation JSON

Après chaque réponse :

1. parser JSON ;
2. valider schema ;
3. vérifier que tous les `criterion_id` existent ;
4. vérifier que la langue correspond ;
5. vérifier que les critères retournés appartiennent au groupe demandé ;
6. rejeter ou relancer si invalide ;
7. stocker le statut.

## Stratégie de confiance

Niveaux proposés :

- `>= 0.85` : utilisable mais validable.
- `0.60 - 0.84` : à vérifier.
- `< 0.60` : incertain.
- `null` : non trouvé.

## Validation juridique

Sur les 50 premiers arrêts, l’avocate doit valider :

- valeurs correctes ;
- valeurs manquantes ;
- hallucinations ;
- erreurs par critère ;
- erreurs par langue ;
- erreurs par type de document.

Pas de traitement massif avant validation.

## À ne pas faire

- Ne pas demander au modèle de lire un PDF.
- Ne pas envoyer l’arrêt complet par défaut.
- Ne pas utiliser un gros modèle sur le PC local.
- Ne pas ignorer les réponses invalides.
- Ne pas stocker des hallucinations comme valeurs validées.
