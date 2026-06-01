# Stratégie nettoyage et découpage du texte

## Objectif

Transformer le texte brut extrait du PDF en passages courts et utiles pour l’analyse IA.

## Étapes de nettoyage

1. Normaliser les espaces.
2. Corriger les ligatures fréquentes.
3. Recoller les mots coupés par césure.
4. Supprimer les en-têtes répétés.
5. Supprimer les pieds de page répétés.
6. Supprimer les numéros de page isolés.
7. Supprimer les répétitions parasites.
8. Conserver les paragraphes juridiques importants.
9. Marquer les pages d’origine si utile.

## Sections cibles

Le découpage doit essayer d’identifier :

- identité ;
- procédure ;
- faits ;
- décision attaquée ;
- arguments du demandeur ;
- documents déposés ;
- analyse du Conseil ;
- crédibilité ;
- protection nationale ou fuite interne ;
- dispositif final.

## Sélection des passages utiles

Pour chaque groupe de critères, créer une requête interne de sélection.

Exemples :

- `identity` : nationalité, ethnie, religion, sexe, âge, ville, MENA.
- `profile_vulnerability` : enfants, mère célibataire, MGF/VGV, mariage forcé, violences, vulnérabilités.
- `evidence_documents` : rapports médicaux, psychologiques, documents d’identité, besoins procéduraux.
- `procedure` : demande ultérieure, pays sûr, procédure accélérée.
- `persecution_claims` : genre, politique, groupe social.
- `decision_reasoning` : crédibilité, bénéfice du doute, articles 48/5, 48/6, 48/7, motivation CGRA/CCE/RVV.

## Règle anti-tokens

Ne jamais envoyer tout l’arrêt au LLM par défaut.

Le LLM reçoit :

- le groupe de critères à extraire ;
- les critères du groupe ;
- des extraits courts sélectionnés ;
- éventuellement les métadonnées déjà connues.

## Taille cible

Pour chaque appel LLM :

- viser quelques milliers de caractères maximum ;
- préférer plusieurs appels ciblés plutôt qu’un gros appel instable ;
- inclure uniquement les passages nécessaires.

## Données de preuve

Chaque valeur extraite doit idéalement être reliée à :

- un extrait court ;
- une section ;
- une page ou position si disponible ;
- un niveau de confiance.

## Sortie attendue de la segmentation

```json
{
  "arret_id": "...",
  "language": "fr",
  "segments": [
    {
      "section": "decision_reasoning",
      "text": "...",
      "page_start": 4,
      "page_end": 6,
      "quality_score": 0.86
    }
  ]
}
```
