Lis CLAUDE.md, PROJECT_STATE.md et docs/04-schema-canonique-criteres.md.

Objectif : intégrer les critères cliente.

Tâches :
1. Lire `data/criteria_canonical.json`.
2. Créer les tables/migrations nécessaires pour versions et critères.
3. Préserver `language`, `order_index`, `section_label`, `label_original`, `detail_original`.
4. Ne pas traduire ni fusionner les critères FR/NL.
5. Créer une page admin critères mobile first.
6. Permettre activation/désactivation.
7. Prévoir versionnement et audit minimal.
8. Mettre à jour PROJECT_STATE.md.

Contraintes :
- Les nouveaux critères ne s’appliquent qu’aux futurs arrêts sauf retraitement explicite.
- Ne pas lancer d’analyse IA.

Fin : fournir commandes exactes de migration/test et demander `/diff` puis `/code-review`.
