Lis CLAUDE.md, PROJECT_STATE.md et docs/11-risques-validation-juridique.md.

Objectif : cadrer le traitement massif sans l’exécuter.

Tâches :
1. Vérifier que la validation juridique est marquée comme acceptée dans PROJECT_STATE.md.
2. Si elle ne l’est pas, refuser de lancer le massif et proposer uniquement un plan.
3. Décrire architecture serveur GPU/worker.
4. Décrire lots, reprise sur erreur, monitoring, coût, cadence.
5. Décrire stratégie de retraitement par version de critères.
6. Mettre à jour PROJECT_STATE.md.

Contraintes :
- Ne jamais exécuter le massif dans cette phase sans validation explicite.
- Ne pas utiliser le PC Windows comme production.
- Ne pas stocker les PDF.

Fin : produire un plan go/no-go.
