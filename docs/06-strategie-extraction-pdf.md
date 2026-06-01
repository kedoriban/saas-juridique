# Stratégie extraction PDF

## Règle principale

Le LLM ne lit jamais le PDF. Le PDF est uniquement une source temporaire pour extraire du texte avec un outil classique.

## Pipeline

1. Recevoir `pdf_url`.
2. Télécharger temporairement le PDF ou le lire en streaming.
3. Écrire éventuellement dans un dossier temporaire non versionné.
4. Extraire le texte avec PyMuPDF.
5. Si résultat insuffisant, essayer pdfplumber.
6. Détecter PDF textuel ou scanné.
7. Utiliser OCR uniquement en fallback.
8. Supprimer le PDF temporaire.
9. Nettoyer le texte.
10. Segmenter en zones utiles.
11. Stocker les métadonnées d’extraction, pas le PDF.

## Dossier temporaire

Exemple :

```text
.tmp/pdf-cache/
```

Ce dossier doit être dans `.gitignore`.

## Détection PDF textuel/scanné

Critères possibles :

- nombre de caractères extraits par page ;
- ratio pages vides / pages totales ;
- présence d’images dominantes ;
- texte extrait illisible ou trop court ;
- comparaison taille fichier / texte extrait.

## Outils

Choix principal : PyMuPDF.

Source :
https://pymupdf.io/

Fallback layout : pdfplumber.

Fallback OCR : Tesseract ou équivalent local uniquement si nécessaire.

Source :
https://tesseract-ocr.github.io/tessdoc/

## Données à stocker

Stocker :

- statut extraction ;
- méthode utilisée ;
- nombre de pages ;
- nombre de caractères extraits ;
- hash du texte nettoyé ;
- erreurs éventuelles ;
- date d’extraction.

Ne pas stocker :

- PDF ;
- copie durable du PDF ;
- fichier temporaire ;
- texte intégral durable par défaut, sauf décision juridique spécifique.

## Mode QA temporaire

Pour la validation cliente, on peut prévoir un mode QA limité :

- stocker des extraits courts utilisés comme preuves ;
- stocker les sections segmentées seulement pour 50 arrêts ;
- purger après validation si nécessaire.

Ce mode doit être explicite et désactivable.

## Erreurs possibles

- PDF inaccessible.
- PDF trop lourd.
- PDF scanné.
- Texte extrait vide.
- Encodage incorrect.
- Structure de page confuse.
- Site source bloque la récupération.

Chaque erreur doit créer un statut clair et relançable.
