# Stratégie scraping CCE/RVV

## Source

Page principale des arrêts :
https://www.rvv-cce.be/fr/arr

Exemple de PDF public :
https://www.rvv-cce.be/sites/default/files/arr/a342062.an_.pdf

## Objectif

Détecter les nouveaux arrêts publics, récupérer leurs métadonnées et l’URL publique du PDF, sans stocker le PDF durablement.

## Principes

- Scraper poliment.
- Limiter le débit.
- Journaliser les erreurs.
- Respecter les conditions applicables.
- Ne pas contourner agressivement les protections du site.
- Ne pas lancer de scraping massif avant validation juridique et technique.

## Modes d’entrée MVP

Pour la V1, prévoir trois modes :

1. Ajout manuel d’une URL PDF publique.
2. Import d’une petite liste d’URLs PDF.
3. Scraping limité des dernières pages publiques.

Cela évite de bloquer la démo si le site répond différemment selon l’environnement.

## Métadonnées minimales à collecter

- `source_site` : `rvv-cce`
- `source_language` : `fr` ou `nl`
- `source_url`
- `pdf_url`
- `arret_number`
- `decision_date`
- `procedure_type`
- `country`
- `chamber`
- `judge_reporter`
- `scraped_at`
- `source_hash`

## Idempotence

Ne jamais créer deux fois le même arrêt.

Clés candidates :

- `pdf_url`
- `arret_number + source_language`
- `source_hash`

## Scraping quotidien

Le job quotidien doit :

1. ouvrir les pages les plus récentes ;
2. extraire les liens d’arrêts ;
3. comparer aux arrêts déjà connus ;
4. créer uniquement les nouveaux ;
5. planifier extraction/analyse ;
6. s’arrêter dès qu’il retrouve une série d’arrêts déjà connus.

## Traitement historique

Le traitement depuis 2015 est interdit avant validation juridique.

Quand il sera autorisé :

- Traiter par année.
- Séparer FR/NL.
- Séparer par procédure si utile.
- Utiliser des lots reprenables.
- Prévoir pause/reprise.
- Prévoir monitoring.
- Prévoir serveur GPU/worker dédié.

## À ne pas faire

- Ne pas scraper 200k arrêts depuis Vercel.
- Ne pas stocker les PDF.
- Ne pas lancer des milliers de requêtes sans limite.
- Ne pas considérer le PC Windows comme serveur de production.
- Ne pas déclencher l’analyse IA au moment de la requête utilisateur.

## Architecture recommandée

- Vercel : interface, API légères, déclenchement de jobs.
- Supabase : stockage des métadonnées, statuts, résultats.
- Worker local ou serveur : scraping, extraction PDF, LLM.
- Cron : déclenche le worker ou marque les jobs à faire.

## Sources techniques utiles

Supabase Cron :
https://supabase.com/docs/guides/cron

Vercel Cron :
https://vercel.com/docs/cron-jobs/manage-cron-jobs
