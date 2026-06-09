# Améliorations prompts — identifiées sur CCE 341854 (R-Phase 12)

Validées par la cliente. À appliquer après confirmation du score R-Phase 12.

## fr_013 — Sexe requérant(e)
**Problème :** LLM ne déduit pas le genre depuis la grammaire.
**Fix prompt :** Instruire à chercher marqueurs de genre en français :
- Pronoms (il/elle, lui/sa)
- Accords adjectivaux (sportif/sportive, requérant/requérante)
- Formulations révélatrices ("il a une sœur", "sportif de haut niveau")
**Exemple :** "Masculin, déduit des formulations 'du requérant', 'sportif de haut niveau', 'il a une sœur supplémentaire'"

## fr_018 — Demandeur = mère célibataire ?
**Problème :** LLM ne fait pas l'inférence logique depuis fr_013.
**Fix :** Règle de post-traitement dans analyze.py :
  si fr_013 = masculin → fr_018 = "Non" (sauf contraindication explicite du texte)
  Même approche que les regex metadata_detected actuelles.

## fr_006 — Date d'arrivée + date d'introduction
**Problème :** LLM laisse vide si date d'arrivée non mentionnée.
**Fix prompt :** "Si la date d'arrivée en Belgique n'est pas mentionnée, utiliser la date
d'introduction de la requête devant le CCE. Préciser la nature de chaque date extraite."
**Exemple :** "Date d'arrivée : non mentionnée. Date d'introduction requête CCE : 20/03/2025. → valeur retenue : 20/03/2025"

## fr_007 — Durée procédure
**Problème :** LLM ne calcule pas la durée.
**Fix prompt :** Fournir la date de l'arrêt explicitement dans le contexte et instruire :
"Calculez la durée entre la date d'introduction et la date de l'arrêt. Exprimez en jours ET en mois/jours."
**Exemple :** "20/03/2025 → 25/02/2026 = 342 jours, environ 11 mois et 5 jours"

## fr_014 — Région/ville de naissance + lieu de vie
**Problème :** LLM omet les sous-questions sans réponse au lieu de noter "non mentionné".
**Fix prompt :** "Pour chaque sous-question, répondre explicitement 'non mentionné(e)' si l'information
est absente du texte. Ne pas omettre de sous-question."
**Exemple :** "1. Région/ville de naissance : non mentionnée. 2. Lieu de vie : Belgique (ville non précisée)"

## fr_043 — Motivation du CCE
**Problème :** Résumé trop court, raisonnement incomplet.
**Fix prompt :** Pour decision_reasoning, insister sur :
"Résumez le raisonnement complet du CCE : décision rendue + arguments principaux + articles de loi cités + réponse aux arguments du demandeur."
**Exemple attendu :** "Le CCE rejette le recours. Il estime que la partie défenderesse a valablement
considéré l'absence de circonstances exceptionnelles au sens de l'art. 9bis, notamment parce que
le requérant ne démontre pas qu'il ne pourrait pas poursuivre temporairement un entraînement
adapté en Géorgie. Il considère aussi que l'ingérence dans la vie privée/familiale est
proportionnée et que le droit d'être entendu ne justifie pas l'annulation, faute d'éléments
concrets que le requérant aurait voulu faire valoir."
