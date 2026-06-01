# Instructions Figma MCP

## Objectif

Utiliser Figma MCP pour reproduire les écrans utiles de la maquette sans gaspiller de tokens et sans implémenter les zones hors périmètre.

## Liens Figma

Design :
https://www.figma.com/design/ZK4KCTUana3Eb6UI4x8RA9/SaaS-juridique?node-id=0-1&p=f&t=31NiAy8p7RXQJUnT-0

Prototype :
https://www.figma.com/proto/ZK4KCTUana3Eb6UI4x8RA9/SaaS-juridique?node-id=190-15294&p=f&t=MsjBZUDv2bWK6gq2-0&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1

## Installation recommandée

Dans le terminal :

```powershell
claude plugin install figma@claude-plugins-official
```

Redémarrer Claude Code si nécessaire, puis vérifier :

```text
/plugin
```

Source utile :
https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server

## Périmètre à demander à Claude

Claude doit inspecter uniquement :

- Dashboard.
- Recherche / filtres.
- Liste d’arrêts.
- Fiche détail d’arrêt.
- Admin critères.
- Statistiques.
- Auth / onboarding si présent.

Claude doit ignorer :

- Focus.
- Imports d’arrêts.
- Tout écran non nécessaire à la V1 montrable.

## Prompt Figma à utiliser

```text
Utilise Figma MCP pour inspecter uniquement les écrans nécessaires à la V1 : dashboard, recherche, liste d’arrêts, fiche détail, admin critères, statistiques et auth si présent. Ignore les parties Focus et Imports d’arrêts. Résume les composants, layouts, couleurs, espacements et variantes utiles dans docs/figma-extraction-summary.md. Ne code rien pour l’instant.
```

## Règles mobile first

- L’admin doit être utilisable sur smartphone.
- Les filtres avancés doivent se présenter en accordéons ou panneaux repliables sur mobile.
- Les tableaux doivent devenir des cartes sur mobile.
- Les actions dangereuses doivent être confirmées.
- Les textes doivent être lisibles par une personne peu technique.

## Règle anti-tokens

Ne pas demander à Claude d’inspecter tout le Figma. Toujours limiter la demande à un écran ou un groupe d’écrans.
