Lis CLAUDE.md, PROJECT_STATE.md, docs/06-strategie-extraction-pdf.md et docs/07-strategie-nettoyage-decoupage.md.

Objectif : créer le worker local d’extraction PDF sans IA.

Tâches :
1. Créer un worker séparé de l’app Vercel.
2. Prendre en entrée une URL PDF publique.
3. Télécharger temporairement ou streamer le PDF.
4. Extraire le texte avec PyMuPDF en premier choix.
5. Prévoir fallback pdfplumber.
6. Détecter PDF textuel/scanné.
7. OCR seulement si nécessaire, mais ne pas l’activer par défaut si trop lourd.
8. Supprimer le PDF temporaire après extraction.
9. Nettoyer et segmenter le texte.
10. Stocker uniquement métadonnées d’extraction et statuts.
11. Mettre à jour PROJECT_STATE.md.

Contraintes :
- Aucun stockage durable de PDF.
- Aucun appel LLM.
- Pas de traitement massif.
- Prévoir test sur un seul PDF ou petit lot.

Fin : fournir commandes Windows exactes et proposer validation manuelle de l’extraction.
