Lis CLAUDE.md, PROJECT_STATE.md et docs/05-strategie-scraping.md.

Objectif : créer le scraping quotidien limité aux nouveaux arrêts.

Tâches :
1. Créer un job désactivable.
2. Scraper uniquement les pages récentes.
3. Détecter les nouveaux arrêts par idempotence.
4. Créer des jobs d’extraction/analyse sans les exécuter dans Vercel.
5. Journaliser erreurs et durée.
6. Prévoir limite de débit.
7. Mettre à jour PROJECT_STATE.md.

Contraintes :
- Ne pas traiter l’historique.
- Ne pas lancer 200k arrêts.
- Ne pas contourner agressivement le site.
- Ne pas faire tourner l’analyse IA dans une fonction Vercel longue.

Fin : fournir commandes de test sur petit lot.
