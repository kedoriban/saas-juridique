Lis CLAUDE.md, PROJECT_STATE.md, docs/03-ollama-windows.md et docs/08-strategie-llm-local.md.

Objectif : ajouter l’analyse LLM locale sur passages utiles seulement.

Tâches :
1. Créer une interface LLM provider interchangeable.
2. Implémenter provider Ollama local via variables d’environnement.
3. Créer JSON Schema strict pour les réponses.
4. Créer prompts par groupes de critères.
5. Envoyer uniquement les passages utiles, pas l’arrêt complet.
6. Valider le JSON.
7. Stocker valeurs, confidence, evidence excerpt, model version, prompt version.
8. Gérer erreurs et retries limités.
9. Mettre à jour PROJECT_STATE.md.

Contraintes :
- Petit modèle quantifié seulement.
- Pas de gros modèle local.
- Pas d’appel cloud sauf demande explicite.
- Pas de traitement massif.

Fin : fournir un protocole de test sur 1 à 3 arrêts.
