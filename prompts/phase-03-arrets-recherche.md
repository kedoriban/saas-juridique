Lis CLAUDE.md et PROJECT_STATE.md.

Objectif : créer les données d’arrêts, la recherche avancée et la fiche détail.

Tâches :
1. Créer les tables `arrets`, `arret_criteria_values`, `processing_jobs`, `model_runs` si absentes.
2. Ajouter un seed limité avec quelques arrêts fictifs ou réels sans PDF stocké.
3. Créer liste d’arrêts en cartes mobile first.
4. Créer filtres avancés repliables sur mobile.
5. Créer fiche détail avec URL PDF publique, métadonnées, critères et statuts.
6. Créer stats minimales.
7. Mettre à jour PROJECT_STATE.md.

Contraintes :
- Ne pas scraper massivement.
- Ne pas télécharger de PDF dans cette phase.
- Ne pas appeler le LLM.

Fin : fournir commandes de test et demander `/diff` puis `/code-review`.
