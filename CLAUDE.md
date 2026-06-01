# CLAUDE.md – Règles permanentes du projet

Tu travailles sur un SaaS juridique pour des cabinets d’avocats. L’application doit scraper les arrêts publics du CCE/RVV, extraire le texte des PDF avec des outils classiques, analyser des passages utiles avec un LLM local ou interchangeable, stocker les critères extraits dans Supabase, puis permettre une recherche avancée.

## Priorités absolues

1. Économiser les tokens.
2. Ne pas perdre le contexte.
3. Rendre le projet transmissible à une autre personne.
4. Produire une première version montrable rapidement à la cliente.
5. Ne jamais lancer de traitement massif avant validation juridique de la qualité d’extraction.
6. Ne jamais faire lire les PDF directement au LLM.
7. Ne jamais stocker durablement les PDF en base ou sur serveur.
8. Ne jamais proposer le Mac mini dans ce projet.
9. Ne jamais proposer de gros modèle local sur le PC de développement.
10. Ne jamais envoyer systématiquement tout le texte d’un arrêt au LLM.

## Règle d’architecture non négociable

Le pipeline est :

`URL PDF publique -> téléchargement temporaire ou streaming -> extraction texte classique -> nettoyage -> segmentation -> sélection de passages utiles -> analyse LLM JSON stricte -> validation JSON -> stockage des critères`

Le LLM lit uniquement du texte pré-extrait, nettoyé, structuré, découpé et réduit.

## Stack cible

- App : Next.js, TypeScript, Tailwind, mobile first.
- Base et auth : Supabase Postgres + Supabase Auth.
- Déploiement app : Vercel.
- Worker local MVP : Node.js ou Python, lancé sur PC Windows.
- LLM local MVP : Ollama sur Windows avec petit modèle quantifié.
- PDF : PyMuPDF en premier choix, pdfplumber en fallback, OCR seulement en fallback.
- Design : Figma MCP si disponible.

## Machine locale réelle

Développement sur PC Windows MSI Thin GF63 12UC :

- RAM : 16 Go.
- GPU : NVIDIA GeForce RTX 3050 Laptop, 4 Go VRAM.
- CUDA affichée par `nvidia-smi` : 12.5.

Conséquences :

- Le PC sert au développement, aux tests LLM locaux et à une démo limitée.
- Le PC ne doit pas être considéré comme machine de production pour 200k+ arrêts.
- Les modèles locaux doivent être petits et quantifiés.
- Le code doit permettre de remplacer Ollama local par un serveur GPU plus tard.

## Périmètre Figma

Figma design :
https://www.figma.com/design/ZK4KCTUana3Eb6UI4x8RA9/SaaS-juridique?node-id=0-1&p=f&t=31NiAy8p7RXQJUnT-0

Prototype :
https://www.figma.com/proto/ZK4KCTUana3Eb6UI4x8RA9/SaaS-juridique?node-id=190-15294&p=f&t=MsjBZUDv2bWK6gq2-0&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1

Ignorer les parties Focus et Imports d’arrêts.

## Critères cliente

Les critères sont fournis en deux fichiers séparés : français et néerlandais.

Règles :

- Conserver l’ordre fourni par la cliente.
- Ne pas traduire automatiquement les critères FR vers NL.
- Utiliser la version néerlandaise validée.
- Versionner les critères.
- Les nouveaux critères s’appliquent uniquement aux futurs arrêts sauf retraitement explicite.

Fichiers de référence générés :

- `data/criteria_canonical.json`
- `data/criteria_fr.json`
- `data/criteria_nl.json`
- `data/criteria_canonical.csv`

## Fonctionnalités V1 montrable

La V1 doit montrer :

- Authentification.
- Dashboard simple.
- Liste des arrêts.
- Recherche avancée par critères.
- Fiche détail d’arrêt.
- URL publique vers le PDF original.
- Admin mobile first des critères FR/NL.
- Import/scraping limité à environ 50 arrêts.
- Extraction texte sans stockage durable du PDF.
- Analyse LLM locale sur passages utiles uniquement.
- Statistiques minimales.

## Ce qui est hors périmètre V1

- Traitement massif 200k+ arrêts.
- Optimisation serveur GPU.
- Paiement/abonnement avancé.
- Import massif manuel.
- Parties Figma Focus et Imports d’arrêts.
- Stockage durable des PDF.

## Gestion du contexte Claude Code

Au début de chaque session, relire :

1. `CLAUDE.md`
2. `PROJECT_STATE.md`

Après chaque phase ou décision importante, mettre à jour `PROJECT_STATE.md`.

Utiliser :

- `/compact` quand la session est longue mais que la tâche continue.
- `/clear` après une phase terminée, validée, documentée dans `PROJECT_STATE.md`.
- `/diff` avant toute validation importante.
- `/code-review` avant de considérer une étape comme terminée.

## Règles de réponse pour Claude Code

- Avant de modifier, résumer en 5 lignes ce qui va être fait.
- Ne pas toucher aux fichiers hors périmètre.
- Privilégier des changements petits et vérifiables.
- Ne jamais inventer une fonctionnalité non demandée.
- Ne jamais supprimer un fichier sans demander confirmation.
- Ne jamais exposer de secret dans les logs.
- Toujours proposer les commandes exactes à lancer sur Windows quand une action terminal est nécessaire.
