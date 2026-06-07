# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-06 (UI-Phases A→G terminées sauf D)

## Objectifs en cours

1. **R-Phase 4** — Test 50 arrêts avec Qwen2.5-72B-Instruct-AWQ sur A100 80 Go (Vast.ai). En attente d'instance.
2. **UI-Phase D** — Modal recherche avancée 6 sections sur /arrets (la plus complexe, ~4h).
3. **Validation avocate** — Faire relire les 50 arrêts analysés avant tout traitement massif.

---

## État après R-Phase 3 (2026-06-04)

### Résultats finaux

- **50 arrêts** en base : 30 FR + 20 NL, tous extraits + analysés.
- **2 batchs** : 23 arrêts (batch 1) + 31 arrêts (batch 2, après fixes).
- **Exemple final** CCE 341944 (3 sections, `unknown`) : **47 valeurs, 0 ERREUR**.
- `profile_vulnerability` : 14/15 items (1 hallucination filtrée — normal).

### Bugs identifiés et corrigés (commits sur `main`)

| Commit | Fichier | Fix |
|---|---|---|
| `514d8c8` | `clean.py`, `prompts.py` | Patterns sections + MAX_PASSAGE_CHARS 5000→6500 |
| `78640be` | `main.py` | Broken pipe HTTP/2 Supabase : client neuf par arrêt + retry |
| `5fdac0b` | `schemas.py` | `items=[]` → warning sans retry (stop 3×9s gaspillés) |
| `5fdac0b` | `prompts.py` | Suppression fallback "toutes sections" → `[SKIP]` propre |
| `6c0c4db` | `schemas.py` | Coerce `dict`/`list` → `string` dans `normalize_response` |
| `ec5dd24` | `docs/architecture.md` | Documentation humaine du pipeline |

### Qualité Qwen2.5-32B-AWQ sur RTX 3090

- Arrêts **3 sections** (courts, procéduraux) : ~9–47 valeurs selon contenu
- Arrêts **5–12 sections** (asile FR) : attendu ~40–48 valeurs
- Durée par arrêt : ~90–110s (7 groupes, séquentiel)
- Hallucination `criterion_id` : 1/15 sur `profile_vulnerability` → filtré automatiquement
- **Limites observées** : groupes avec sections absentes → items vides malgré le texte (modèle trop petit pour certains passages)

### Limites du modèle 32B

- Confond parfois la structure JSON (retourne un dict imbriqué au lieu d'une string)
- `profile_vulnerability` (15 critères) : proche de la limite de compréhension contextuelle
- Résultats NL légèrement moins bons que FR
- Vitesse : ~15 tokens/s — acceptable mais pas rapide

---

## R-Phase 4 — Objectif : meilleur modèle, meilleure machine

### Pourquoi changer

| Critère | Qwen2.5-32B / RTX 3090 | Cible R-Phase 4 |
|---|---|---|
| Précision | Correct mais hallucinations | Meilleure compréhension juridique |
| Vitesse | ~90–110s/arrêt | < 40s/arrêt |
| `profile_vulnerability` (15 critères) | 14/15, parfois 12/15 | 15/15 fiable |
| NL | Moins précis qu'en FR | Meilleur |

### Apprentissages vLLM sur Vast.ai (instances testées)

| Instance | CUDA driver | GPU réel | Résultat |
|---|---|---|---|
| 39660884 | 12.4 | inconnu | vLLM 0.9+ exige CUDA ≥ 12.6 → abandonné |
| 39665352 | 12.8 (`12080`) | A100 **40 Go** (affiché 80 Go) | vLLM 0.11.2 OK, OOM au chargement du 72B |

**Leçons clés :**
- `pip install vllm` → dernière version (0.22.1 en juin 2026), trop récente. Pincer à `"vllm>=0.9,<0.12"`.
- Conflit flashinfer système (`/venv/main`) vs `.venv` → contourner avec `FLASHINFER_DISABLE_VERSION_CHECK=1 VLLM_ATTENTION_BACKEND=XFORMERS`.
- Vast.ai peut afficher "A100" sans préciser 40 Go vs 80 Go → **filtrer VRAM ≥ 79 Go**.
- AWQ 72B = 38.79 Go de poids → nécessite ≥ 44 Go VRAM (poids + KV cache). 40 Go insuffisant.

### Machine cible sur Vast.ai (critères stricts)

**Recommandation : 1× A100 SXM4 80 Go** (ou A100 PCIe 80 Go, ou H100 80 Go)
- **Filtre VRAM ≥ 79 Go** — obligatoire pour exclure les A100 40 Go
- Prix : ~1,50–2,50 €/h (A100 80 Go)
- Template : **PyTorch** (Ubuntu 22.04, CUDA ≥ 12.6)
- Disque ≥ 80 Go, RAM ≥ 64 Go

### Modèle cible

**Option A (recommandée) : `Qwen/Qwen2.5-72B-Instruct-AWQ`**
- 72B paramètres quantifiés AWQ (~38 Go VRAM)
- Même famille que le 32B → prompts inchangés
- Meilleure compréhension des textes juridiques FR/NL longs

**Option B (si A100 80 Go indisponible) : `Qwen/Qwen3-32B`**
- Architecture plus récente que Qwen2.5-32B, meilleur raisonnement
- ~18 Go VRAM → tient sur 40 Go aussi

### Commande vLLM validée (CUDA 12.8, avec contournement flashinfer)

```bash
FLASHINFER_DISABLE_VERSION_CHECK=1 \
VLLM_ATTENTION_BACKEND=XFORMERS \
nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ \
  --port 8000 --dtype auto \
  --max-model-len 8192 --gpu-memory-utilization 0.92 --trust-remote-code \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &
```

### Installation vLLM (séquence validée)

```bash
python -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install "vllm>=0.9,<0.12"   # NE PAS faire pip install vllm
```

### Séquence R-Phase 4

1. Louer instance A100 **80 Go** (VRAM ≥ 79 Go, template PyTorch)
2. `git clone` + `pip install` + `.env.local` à la racine du projet
3. Démarrer vLLM avec `FLASHINFER_DISABLE_VERSION_CHECK=1 VLLM_ATTENTION_BACKEND=XFORMERS`
4. Vider les valeurs existantes en base
5. Relancer analyse sur les 50 mêmes arrêts
6. Comparer : nombre d'items, taux d'hallucination, qualité NL
7. Si bon → validation avocate → seuil 80 % → déclenchement batch massif

### Commandes de reset avant R-Phase 4

```bash
# Vider les valeurs LLM existantes (garder les arrêts et extractions)
.venv/bin/python - << 'EOF'
import os; from pathlib import Path; from dotenv import load_dotenv
load_dotenv(Path("/workspace/saas-juridique/.env.local"))
from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
sb.table("arret_criteria_values").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
sb.table("model_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
print("Valeurs LLM vidées. Les 50 arrêts extraits sont conservés.")
EOF
```

---

## Plan UI — Alignement Figma (analysé le 2026-06-06)

Design de référence : https://www.figma.com/design/ZK4KCTUana3Eb6UI4x8RA9/SaaS-juridique

### Inventaire des écrans Figma et état actuel

#### Inventaire code existant (vérifié)

| Fichier | Route | Ce qu'il fait |
|---|---|---|
| `src/app/(app)/dashboard/page.tsx` | `/dashboard` | 4 KPI simples (totaux, pas de table, pas de charts) |
| `src/app/(app)/arrets/page.tsx` | `/arrets` | Table desktop + cartes mobile, pas de search/filtres/pagination |
| `src/app/(app)/arrets/[id]/page.tsx` | `/arrets/[id]` | Fiche détail complète mais sans Résumé AI ni CTAs Copier/Export |
| `src/app/(app)/recherche/page.tsx` | `/recherche` | Page séparée avec 5 filtres simples (q, langue, matière, pays, statut) |
| `src/app/(app)/stats/page.tsx` | `/stats` | Stat cards + barres langues/statuts/matières — pas de vrais charts |
| `src/app/(app)/criteres/page.tsx` | `/criteres` | Liste critères FR/NL + toggle actif/inactif |
| `src/components/Sidebar.tsx` | — | Nav : Dashboard, Arrêts, Recherche, Stats / Admin : Validation, Critères, Paramètres |

#### Schéma DB existant (colonnes pertinentes vérifiées)

Table `arrets` : `id, numero, date_arret, langue, chambre ✅, matiere, pays_origine ✅, pdf_url, resume (scraper), statut_traitement, procedure_type, language_detected, intermediate_json`

**Colonnes absentes nécessaires pour le Figma :**
- `source_juridiction` (CNDA, Cour d'appel…) — mentionné dans la fiche détail
- `type_decision` (Annulation, Plein contentieux, Confirmation, Refusé…) — badge rouge/vert dans la fiche et les charts
- `is_focus` boolean — pour marquer les arrêts mis en avant
- `resume_ai` text — résumé généré par le LLM (≠ `resume` du scraper)

Table `criteria` : colonnes `active` boolean — mais le Figma montre un état "Archivé" séparé d'"Actif".
**Colonne absente :** `effet_date date` (date d'entrée en vigueur du critère).

**Tags 2-3 lettres (PS, TR, SO, KE, ING…) :** Non implémentés. Après analyse du Figma, ce sont des **codes thématiques libres** associés à chaque arrêt (ex. PS=Protection Subsidiaire, TR=Traitement, SO=Social…). Ils coexistent avec des labels textuels. **Décision : nouveau champ `arrets.tags text[]`** alimenté manuellement ou par le LLM sur les top critères applicables.

---

### UI-Phase A — Sidebar & navigation (priorité 1)

**Objectif :** Aligner la navigation sur le Figma.

| Action | Fichier | Détail |
|---|---|---|
| Renommer "Recherche" → supprimer du nav principal | `Sidebar.tsx`, `BottomNav.tsx` | La recherche avancée devient un modal sur /arrets |
| Ajouter "Focus" (désactivé V1, tooltip) | `Sidebar.tsx` | `href="/focus"`, apparence grisée |
| Ajouter "Export" (désactivé V1) | `Sidebar.tsx` | `href="/export"`, apparence grisée |
| Renommer "Critères" → "Administration" dans Admin section | `Sidebar.tsx` | Pointe vers `/criteres` |
| Retirer "Validation" du nav principal | `Sidebar.tsx` | Validation reste accessible directement via `/validation` |
| Aligner BottomNav mobile | `BottomNav.tsx` | Dashboard, Arrêts, Focus (désactivé), Stats |

---

### UI-Phase B — Dashboard rebuild (priorité 1)

**Objectif :** Passer de 4 KPI simples à un dashboard complet.

| Bloc | Action |
|---|---|
| KPI 1 — "Arrêts analysés" | Compter `statut_traitement = 'termine'` |
| KPI 2 — "Récemment ajoutés" | Compter les 30 derniers jours + delta mois précédent |
| KPI 3 — "Derniers arrêts importants" | Compter `is_focus = true` du mois |
| Table "Arrêts récemment ajoutés (8)" | Query 8 derniers arrêts, colonnes : N° Arrêt, Résumé + tags, Procédure, Source, Date, Langue |
| Tags colorés dans le tableau | Afficher `arrets.tags[]` en pills colorées selon valeur |
| Section "Focus – Derniers arrêts importants" | Query 2 arrêts avec `is_focus = true` les plus récents + extrait résumé |
| Donut "Répartition par type de décision" | Grouper par `type_decision`, chart recharts |

**Dépendances migrations :** `is_focus`, `type_decision`, `tags` (migration 009).

---

### UI-Phase C — Liste d'arrêts (priorité 1)

**Objectif :** Intégrer search + filtres + UX manquants directement sur `/arrets`.

| Élément | Action |
|---|---|
| Barre de recherche texte libre | Remplacer la page /recherche séparée par un champ en haut de /arrets |
| Filtre date (date range picker) | "01 Fév – 30 Fév ×" avec X pour effacer |
| Bouton "Filtres avancés" | Ouvre le modal Recherche avancée (UI-Phase D) |
| Chips filtres actifs au-dessus du tableau | Afficher chaque filtre actif comme chip avec × |
| Bouton "Réinitialiser" | Efface tous les searchParams |
| Tags colorés dans colonne Résumé | Afficher `arrets.tags[]` + badge Focus si `is_focus = true` |
| Menu contextuel `⋯` par ligne | Voir la fiche / Télécharger le PDF / Indiquer comme Focus |
| "Indiquer comme Focus" | Server action → `UPDATE arrets SET is_focus = true WHERE id = ?` |
| Pagination | Paramètre `?page=N&per_page=10`, sélecteur "10 / pages" |
| Colonne "Source" | Afficher `source_juridiction` |
| Colonne "Procédure" | Afficher `procedure_type` formaté (ex. "Annulation") |

---

### UI-Phase D — Recherche avancée (modal) (priorité 2)

**Objectif :** Remplacer `/recherche` par un modal 3-colonnes ouvert depuis /arrets.

Structure du modal :
- **Colonne gauche** : nav verticale (6 sections)
- **Colonne centrale** : formulaire de la section active
- **Colonne droite** : "Filtres sélectionnés" + "Lancer la recherche" + "Réinitialiser"

**6 sections et champs :**

| Section | Champs clés |
|---|---|
| Procédure | Date de l'arrêt (range), N° arrêt, Juge, Avocat, Chambre (dropdown), Date arrivée Belgique, Date intro DPI, Durée procédure, Procédure accélérée (Non défini/Oui/Non), Demande ultérieure, Élément nouveau (textarea), Pays d'origine sûr |
| Identité du demandeur | Nationalité (dropdown+flag), Ethnie, Religion, Taux MGF, Sexe (Non défini/Homme/Femme), Région/ville naissance, Lieu de vie, MENA (Oui/Non), Docs identité (Oui/Non) |
| Profil du demandeur | Avec enfant(s), Date naissance, Mère célibataire, Niveau étude, Autonomie financière, MGF/Réexcision/Désinfibulation (tristate), Mariage forcé (Non défini/Craint/Effectif/Non), Vulnérabilités (textarea), Violences parcours migratoire, Enfant-soldat |
| Documents déposés | Rapport médical (+ observations + traitements), Rapport psy (+ observations), Besoins procéduraux spéciaux (+ lesquels), Art. 22 §1/1 Loi accueil |
| Persécutions invoquées | Multi-select persécutions genre (12 types), Opinions politiques/MGF, Groupe social |
| Décision | Statut réfugié antérieur, Crédibilité récit, Art. 48/7, Séquelles permanentes, Agent de persécution, Agent(s) de protection, Protection nationale effective, Possibilité fuite interne, Motivation CGRA (textarea), Motivation CCE (textarea), Portée jurisprudentielle, Résumé mots-clés (textarea), COI cités (textarea), Jurisprudence/doctrine (textarea) |

**Implémentation :** Tous les filtres passent par les URL searchParams (shareable). La majorité filtre sur `arret_criteria_values` via les `criterion_id` correspondants.

**V2 (après démo) :** Sauvegarder/charger des recherches → table `saved_searches (id, user_id, title, description, filters_json, created_at)`.

---

### UI-Phase E — Fiche détail enrichissement (priorité 1)

**Objectif :** Aligner `/arrets/[id]` sur le Figma (écran "Détails Arrêt").

| Élément | État actuel | Action |
|---|---|---|
| Header juridiction + date + numéro | ✅ présent | Ajuster libellé source : "Conseil d'État, 28 fév 2026, n° 342062" |
| Chips : Date, Langue, Source | Source absente | Ajouter `source_juridiction` |
| CTA "Télécharger la source" | ✅ (PDF source) | Renommer bouton |
| CTA "Copier l'analyse" | ❌ absent | Copier dans presse-papier tout le texte des critères + résumé |
| CTA "Exporter PDF" | ❌ absent | Générer un PDF côté client (jsPDF ou route server) |
| Section "Résumé AI" | ⚠️ `resume` du scraper | Nouveau champ `resume_ai` produit par LLM (migration 009) |
| "Copier le résumé" | ❌ absent | Bouton copy-to-clipboard |
| "Analyse par critères" — cards | ✅ grid présent | Ajouter badge Applicable/Confirmé/Refusé dérivé du `value_boolean` + `confidence` |
| "Copier" par critère | ❌ absent | Bouton copy-to-clipboard par card |
| "Informations objectives" | ✅ présent | Ajouter : Source juridiction, Type de décision (badge coloré), Format |
| `pays_origine` avec flag emoji | ⚠️ texte simple | Ajouter flag emoji par pays |
| `type_decision` badge couleur | ❌ absent | Annulation=rouge, Plein contentieux=bleu, Confirmation=vert |

**Logique badge Applicable/Confirmé/Refusé :**
- `value_boolean = true` + `confidence > 0.7` → **Confirmé** (vert)
- `value_boolean = true` + `confidence ≤ 0.7` → **Applicable** (gris)
- `value_boolean = false` → **Non applicable** (rouge discret)
- `value_text` non null → afficher le texte (date, nom, etc.)
- `needs_human_review = true` → badge "À réviser" (orange)

---

### UI-Phase F — Statistiques rebuild (priorité 2)

**Objectif :** Passer des barres progress aux vrais charts Figma.

**Librairie chart recommandée : `recharts`** (légère, compatible Next.js RSC avec `"use client"` wrapper).

| Chart | Type | Données |
|---|---|---|
| KPI "Taux d'annulation" | Calculé | `type_decision = 'annulation'` / total |
| "Évolution temporelle" | Line chart | Arrêts groupés par mois sur 12 mois (toggle 12m/30j/7j) |
| "Type de procédure" | Donut | Group by `procedure_type` |
| "Langue" | Donut | Group by `langue` (FR/NL) |
| "Pays d'origine (top 6)" | Bar chart | Group by `pays_origine` + filtre "Autres", toggle 12m/30j/7j |
| "Résumé par critères" | Table | Top critères par count + % + tendance vs mois précédent |

**Dépendance :** `type_decision` en base (migration 009).

---

### UI-Phase G — Admin critères (priorité 2)

**Objectif :** Aligner `/criteres` sur l'écran "Gestion des critères d'analyse".

| Élément Figma | Action |
|---|---|
| Banner "Important" (jaune) | Ajouter : "Les modifications s'appliquent uniquement aux analyses futures." |
| Tableau avec colonnes Nom / Langue / État / Effet / Modification | Restructurer la liste actuelle |
| État "Archivé" (vs Actif) | Ajouter `criteria.statut text ('actif', 'archive')` — migration 009 |
| Champ "Effet" (date entrée en vigueur) | Ajouter `criteria.effet_date date` — migration 009 |
| Recherche dans la liste | Filtre texte client-side sur `label_original` |
| Actions ✎ Copier ⋯ par ligne | Éditer, dupliquer, archiver |
| Modal "Créer un nouveau critère" | Formulaire avec Nom, Description, Langue (dropdown), Effet (date picker) |

---

### Migration 009 — Champs Figma manquants

À créer dans `supabase/migrations/009_figma_fields.sql` :

```sql
-- Table arrets : champs UI manquants
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS is_focus boolean NOT NULL DEFAULT false;
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS source_juridiction text;
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS type_decision text
  CHECK (type_decision IS NULL OR type_decision IN (
    'annulation', 'plein_contentieux', 'confirmation', 'refus', 'irrecevabilite', 'autre'
  ));
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS resume_ai text;
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS arrets_is_focus ON arrets (is_focus) WHERE is_focus = true;
CREATE INDEX IF NOT EXISTS arrets_type_decision ON arrets (type_decision);

-- Table criteria : champs UI manquants
ALTER TABLE criteria ADD COLUMN IF NOT EXISTS effet_date date;
ALTER TABLE criteria ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'actif'
  CHECK (statut IN ('actif', 'archive'));
```

**Note :** `type_decision` et `resume_ai` seront remplis par le worker (analyze.py à étendre) ou saisis manuellement. `is_focus` et `tags` peuvent être remplis via l'interface admin.

---

### Hors périmètre V1 (CLAUDE.md — à ne pas coder avant validation)

| Fonctionnalité | Raison |
|---|---|
| Page Focus `/focus` | CLAUDE.md : "Ignorer les parties Focus et Imports d'arrêts" |
| Import d'arrêt drag & drop | CLAUDE.md : hors périmètre V1 |
| Sauvegarde/chargement de recherches | V2 uniquement |
| Export page (CSV/PDF bulk) | V2 uniquement |
| Google OAuth | Non bloquant pour la démo |

---

### Ordre d'exécution recommandé (UI-Phases)

```
Migration 009 (20 min)
  → UI-Phase A — Sidebar (30 min)
  → UI-Phase E — Fiche détail enrichissement (2h)
  → UI-Phase C — Liste arrêts (3h)
  → UI-Phase B — Dashboard rebuild (2h)
  → UI-Phase G — Admin critères (1h)
  → UI-Phase F — Statistiques (3h, nécessite recharts)
  → UI-Phase D — Recherche avancée modal (4h, le plus complexe)
```

---

## Décisions validées

- Le LLM ne lit jamais directement les PDF.
- Les PDF ne sont pas stockés durablement.
- Le worker extrait d'abord le texte avec un outil classique.
- Le texte est nettoyé, segmenté et réduit avant analyse LLM.
- Les critères FR et NL restent deux référentiels distincts, sans traduction ni fusion.
- `order_index` est intouchable pour la version importée.
- Les nouveaux critères ne s'appliquent qu'aux futurs arrêts — aucun retraitement automatique.
- Le PC Windows sert au développement, aux tests locaux et à la démo limitée.
- Le traitement massif sera déplacé plus tard vers un serveur plus puissant.
- Le Mac mini est hors plan.
- Les parties Figma Focus et Imports d'arrêts sont ignorées en V1.
- Rôles : admin / avocat / lecteur. Pas de paiement en V1.
- **Navigation : sidebar verte desktop (lg+) + bottom nav mobile. TopBar conservé sur mobile uniquement.**
- Next.js 15.5.18 (upgrade sécurité depuis 15.3.3).
- La fiche détail affiche l'URL publique CCE/RVV — aucun PDF stocké sur le serveur.
- Le seed insère 15 arrêts fictifs réalistes (FR+NL) via upsert idempotent.
- Les filtres de recherche passent par l'URL (searchParams) pour être partageables.
- **Palette couleurs Figma : `forest-600` = `#3A5346` (sidebar, accents), fond `#F7F7F7`, cartes blanches.**
- **Liste arrêts : tableau sur desktop, cartes sur mobile.**
- **App name affiché : "CCE / RVV" (pas "OpenArret" du Figma placeholder).**
- **LLM : prefilling `{"items":[` + messages system/user séparés — technique validée sur qwen3:4b.**
- **Scraper : 50 arrêts réels CCE/RVV en base (30 FR + 20 NL, statut=termine). Tous extraits + analysés.**
- **URLs de filtre langue CCE/RVV : `/fr/arr/lang/french`, `/fr/arr/lang/dutch`, `/fr/arr/lang/german`.**
- **Le suffixe `.an_` dans les URLs PDF n'est PAS un code langue** — langue forcée depuis `--lang`.
- **Limite de validation relevée à 100 arrêts** (était 50).
- **Critères fusionnés FR (`fr_025`, `fr_033`) conservés en l'état jusqu'à validation cliente.**
- **Corpus prod = 181 802 arrêts** (~1,45M appels LLM). Traitement sur GPU loué à l'heure (Vast.ai/Runpod), ~15-30 €.
- **Modèle testé R-Phase 3** : `Qwen/Qwen2.5-32B-Instruct-AWQ` via vLLM — résultats corrects, limits observées.
- **Modèle cible R-Phase 4** : `Qwen/Qwen2.5-72B-Instruct-AWQ` sur A100 80 Go.
- **Staging Vercel** : https://dimagin-saasjur.vercel.app.
- **`value_text` dans `arret_criteria_values` peut contenir du JSON brut** → géré côté frontend via `parseValueText()`.
- **Interface validation** : filtre "Asile / protection" par défaut (`?proc=asile`), badge `procedure_type`, `ValidationRow` Ctrl+Entrée.
- **Tags 2-3 lettres dans le Figma** : nouveau champ `arrets.tags text[]`, alimenté par le worker ou manuellement.
- **`type_decision`** : nouveau champ `arrets.type_decision` (Annulation, Plein contentieux, Confirmation…) → migration 009.
- **`resume_ai`** : nouveau champ `arrets.resume_ai` (résumé LLM) ≠ `arrets.resume` (extrait scraper) → migration 009.
- **Recherche avancée Figma** : modal 6 sections sur /arrets (pas une page séparée), filtres via URL searchParams.
- **Charts statistiques** : librairie `recharts` installée (v2, compatible Next.js RSC avec wrapper "use client").
- **UI-Phase A** : Sidebar — Recherche supprimée du nav, Focus/Export ajoutés grisés, Validation retirée, Critères→Administration. BottomNav : 4 items (Accueil, Arrêts, Stats, Focus grisé).
- **UI-Phase B** : Dashboard — 4 KPI, table 8 récents (desktop+mobile), section Focus (état vide explicite), donut type_decision. TagPill couleur déterministe par hash.
- **UI-Phase C** : Liste arrêts — recherche texte + toggle langue + date range, chips filtres URL, chips ×, Réinitialiser, menu ⋯ par ligne (PDF, Focus toggle), pagination URL (10/25/50), Filtres avancés bouton désactivé (Phase D).
- **UI-Phase E** : Fiche détail — header avec source_juridiction + type_decision badge coloré, CTA Copier l'analyse + Copier résumé + Copier par critère, Exporter PDF désactivé, section Résumé IA (resume_ai > resume), badges Confirmé (vert, conf>0.7) / Applicable (gris) / Non applicable (rouge), flag emoji pays d'origine.
- **UI-Phase F** : Stats — 4 KPI (total, taux analyse, taux annulation, valeurs LLM), donut Langue + donut Procédure, line chart Évolution toggle 7j/30j/12m, bar chart Pays top 6 toggle 7j/30j/12m, table Top 10 critères par count + barre %.
- **UI-Phase G** : Admin critères — banner Important jaune, table groupée par section (Nom/Langue/État/Effet/Modifié/Actions), badge État cliquable (toggle Actif↔Archivé, sync champ `active`), menu ⋯ Dupliquer, modal Créer (Nom, Description, Section, Effet date). `setStatut` synchronise aussi `active` pour le worker.
- **CopyButton** : composant client générique, feedback "Copié ✓" 2s.
- **ArretRowMenu** : composant client ⋯ par ligne (Voir fiche, Télécharger PDF, Focus toggle via server action).
- **countryFlag** : 30+ pays FR → flag emoji dans utils.ts.
- **deriveCriteriaStatus** : logique Confirmé/Applicable/Non applicable dans utils.ts.

## Stack retenue

- Next.js 15.5.18 + TypeScript + Tailwind.
- Supabase Auth + Postgres.
- Vercel pour l'app.
- Worker local séparé pour scraping/extraction/analyse.
- Ollama local pour test LLM (qwen3:4b, 4 Go VRAM).
- PyMuPDF / pdfplumber / OCR fallback pour PDF.
- BeautifulSoup4 + lxml pour le scraping CCE/RVV.
- `recharts` pour les charts Statistiques (**installé**, v2).

## État des phases

| Phase | Statut | Notes |
|---|---|---|
| 0. Préparation repo | ✅ Terminé | Next.js initialisé, .gitignore, .env.example, structure dossiers |
| 1. Base SaaS | ✅ Terminé | Auth, layout mobile, rôles, navigation. TypeScript ✅, Lint ✅ |
| 2. Critères | ✅ Terminé | Migration 002, import JSON, page admin mobile-first, audit log |
| 3. Arrêts et recherche | ✅ Terminé | Migration 003, seed 15 arrêts, liste, fiche détail, filtres, stats |
| 3b. Redesign UI Figma | ✅ Terminé | Sidebar verte, tableau desktop, palette #3A5346, icons SVG |
| 4. Extraction PDF | ✅ Terminé | Worker Python, PyMuPDF, segmentation juridique |
| 5. Analyse LLM | ✅ Terminé | Prefilling JSON, system/user séparés, 10–30s/groupe |
| 6. Validation avocate | ✅ Terminé | Interface entièrement révisée, filtre asile, badge procedure_type |
| 6b. Scraper + pipeline réel | ✅ Terminé | 50 arrêts réels en base, extraits + analysés (R-Phase 3) |
| 6c. Corrections critères | ✅ Terminé | llm_group x6, typo CvV→RvV, migration 006 appliquée |
| 7. Daily scraper | ✅ Terminé (MVP) | worker/scraper.py fonctionnel, 50 arrêts insérés |
| 8. Traitement massif | 🔴 Bloqué | Attendre validation juridique qualité LLM |
| R-Phase 1. Préprocesseur renforcé | ✅ Terminé | 7 modules + migration 007 appliquée |
| R-Phase 2. Analyse LLM JSON intermédiaire | ✅ Terminé | analyze.py + prompts.py + schemas.py + build_intermediate.py + migration 008 |
| R-Phase 3. Test Qwen2.5-32B / RTX 3090 | ✅ **Terminé** | 50 arrêts analysés. Bugs corrigés. ~47 valeurs/arrêt asile. |
| **R-Phase 4. Test Qwen2.5-72B / A100 80 Go** | 🔄 En cours | 2 instances échouées. Prochaine instance : VRAM ≥ 79 Go. |
| **UI-Phase A. Sidebar & navigation** | ✅ **Terminé** | Focus/Export désactivés, Validation retiré du nav, Critères→Administration, BottomNav 4 items |
| **UI-Phase B. Dashboard rebuild** | ✅ **Terminé** | 4 KPI + table 8 récents + section Focus (état vide) + donut type_decision |
| **UI-Phase C. Liste arrêts** | ✅ **Terminé** | Search + chips filtres URL + menu ⋯ Focus + pagination 10/25/50 + tags |
| **UI-Phase D. Recherche avancée modal** | ⏳ Planifié | Modal 6 sections, URL searchParams, hors V1 la sauvegarde |
| **UI-Phase E. Fiche détail** | ✅ **Terminé** | Résumé IA, badges Confirmé/Applicable/Non applicable, CTAs Copier, flag emoji pays |
| **UI-Phase F. Statistiques** | ✅ **Terminé** | recharts : line, 2 donuts, bar chart pays, table top 10 critères |
| **UI-Phase G. Admin critères** | ✅ **Terminé** | Banner Important, table statut, toggle Actif/Archivé, modal Créer, Dupliquer |
| **Migration 009** | ✅ **Appliquée** | is_focus, type_decision, resume_ai, tags, effet_date, criteria.statut |

## Infrastructure Supabase

- Migrations `001` à `009` : **toutes appliquées**.
- Migration `009` (2026-06-06) : `arrets` → `is_focus`, `source_juridiction`, `type_decision`, `resume_ai`, `tags` ; `criteria` → `statut`, `effet_date`.
- `.env.local` configuré avec les vraies clés (jamais commité).
- App fonctionnelle sur http://localhost:3000.

## Commandes de référence

```powershell
# App Next.js
npm install && npm run dev
npm run typecheck   # → 0 erreur
npm run lint        # → 0 erreur

# Worker (depuis worker/, venv actif)
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\activate
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"

# Extraction PDF
$env:PYTHONIOENCODING="utf-8"; python main.py --limit 5 --dry-run
$env:PYTHONIOENCODING="utf-8"; python main.py --limit 55

# Scraper
$env:PYTHONIOENCODING="utf-8"; python scraper.py --lang fr --limit 30
$env:PYTHONIOENCODING="utf-8"; python scraper.py --lang nl --limit 20

# Analyse LLM
$env:PYTHONIOENCODING="utf-8"; python analyze.py --limit 50
$env:PYTHONIOENCODING="utf-8"; python analyze.py --arret-id <uuid> --group metadata --dry-run
```

## Variables `.env.local` requises

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
LLM_TIMEOUT_SECONDS=180
LLM_MAX_INPUT_CHARS=8000
LLM_STORE_RAW_OUTPUT=false
```

## Risques ouverts

- **Qualité LLM non validée par l'avocate** : 50 arrêts analysés avec Qwen2.5-32B, pas encore revus. Ne pas traiter plus de 100 arrêts avant validation.
- **R-Phase 4 non terminée** : instance Vast.ai A100 80 Go non encore louée. Filtrer VRAM ≥ 79 Go impérativement.
- **`type_decision` non extrait** : le worker ne produit pas encore ce champ → donut stats + KPI taux d'annulation restent à 0. À ajouter dans analyze.py après R-Phase 4.
- **`resume_ai` non extrait** : idem — la fiche détail affiche "Résumé" (scraper) et non "Résumé IA". À ajouter dans analyze.py.
- **`arrets.tags` vide** : TagPill n'apparaît pas encore — alimenté manuellement ou par le worker après validation sémantique avec la cliente.
- **`is_focus` vide** : section Focus du dashboard affiche l'état vide. Activé via menu ⋯ de la liste ou colonne État future.
- **Arrêts fictifs seed** : 15 arrêts (CCE 260.001–015) ont des PDF en 404 → statut `erreur`. Polluent légèrement les stats.
- **Critères FR fusionnés** (`fr_025`, `fr_033`) : à clarifier avec la cliente.
- **PostCSS CVE modérées** : bundlées par Next.js, non corrigeables sans downgrade.
- **UI-Phase D non implémentée** : bouton "Filtres avancés" désactivé sur /arrets. La recherche avancée (modal 6 sections) est la prochaine grosse fonctionnalité UI.

## Risques ouverts spécifiques R-Phase 4

- **`profile_vulnerability`** (15 critères) : 1 hallucination criterion_id observée sur 32B. Surveiller sur 72B.
- **Coût A100 80 Go** : ~1,50–2,50 €/h. Budget estimé pour 50 arrêts : ~3–5 € (environ 2h de GPU).
- **Disponibilité A100 sur Vast.ai** : vérifier avant de louer, les A100 sont parfois pris.

## Fichiers modifiés — session 2026-06-06

### Nouveaux fichiers
| Fichier | Rôle |
|---|---|
| `supabase/migrations/009_figma_fields.sql` | Champs Figma manquants (appliqué) |
| `src/components/TagPill.tsx` | Pill tag couleur déterministe |
| `src/components/CopyButton.tsx` | Bouton copier presse-papier générique |
| `src/components/ArretRowMenu.tsx` | Menu ⋯ par ligne d'arrêt (client) |
| `src/app/actions/arrets.ts` | Server action `setFocus` |
| `src/app/actions/criteria.ts` | Server actions `setStatut`, `duplicateCriterion`, `createCriterion` (+ `toggleCriterion` existant) |
| `src/app/(app)/dashboard/DecisionDonut.tsx` | Donut recharts type_decision |
| `src/app/(app)/arrets/ArretFilters.tsx` | Barre filtres URL-based (client) |
| `src/app/(app)/arrets/ArretPagination.tsx` | Pagination URL-based (client) |
| `src/app/(app)/criteres/CriteriaTable.tsx` | Table critères + recherche + modals (client) |
| `src/app/(app)/stats/StatsCharts.tsx` | Tous les charts recharts (client) |

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---|---|
| `src/lib/types.ts` | `Arret` + 5 champs migration 009 ; `Criterion` + `statut`, `effet_date` |
| `src/lib/utils.ts` | + `deriveCriteriaStatus`, `countryFlag` |
| `src/components/icons.tsx` | + `IconBookmark`, `IconArrowUpTray` |
| `src/components/Sidebar.tsx` | Refonte navigation : Focus/Export grisés, Administration, sans Validation ni Recherche |
| `src/components/BottomNav.tsx` | 4 items : Accueil, Arrêts, Stats, Focus grisé |
| `src/components/ArretTableRow.tsx` | Colonnes : Procédure, Source, tags, badge Focus, menu ⋯ |
| `src/components/ArretCard.tsx` | Tags + badge Focus + source_juridiction |
| `src/app/(app)/dashboard/page.tsx` | Refonte complète : 4 KPI + table récents + Focus + donut |
| `src/app/(app)/arrets/page.tsx` | searchParams async, filtres Supabase, pagination range |
| `src/app/(app)/arrets/[id]/page.tsx` | Header enrichi, Résumé IA, badges critères, CopyButtons, flag emoji |
| `src/app/(app)/criteres/page.tsx` | Banner Important, onglets forest, max-w-5xl, délègue à CriteriaTable |
| `src/app/(app)/stats/page.tsx` | 4 KPI, data fetching, top critères, passe tout à StatsCharts |

---

## Prochaine action exacte

**Option A — UI-Phase D (recherche avancée modal)** — ~4h
- Créer `src/app/(app)/arrets/AdvancedSearchModal.tsx` (client, modal 3 colonnes)
- 6 sections : Procédure, Identité, Profil, Documents, Persécutions, Décision
- Tous les filtres via URL searchParams (partageables)
- Déclenché par le bouton "Filtres avancés" déjà présent dans ArretFilters
- Filtres qui touchent `arret_criteria_values` via criterion_id

**Option B — R-Phase 4 (Vast.ai A100 80 Go)** — ~2h de GPU
- Louer instance VRAM ≥ 79 Go, template PyTorch CUDA ≥ 12.6
- git clone + pip install + .env.local
- Lancer vLLM avec FLASHINFER_DISABLE_VERSION_CHECK=1 VLLM_ATTENTION_BACKEND=XFORMERS
- Vider les valeurs LLM en base (garder les 50 arrêts)
- Relancer analyze.py --limit 50
- Comparer : nombre items, hallucinations, qualité NL

**Option C — Validation avocate** — décision métier
- Montrer l'interface à la cliente
- Faire valider les 50 arrêts analysés dans /validation
- Décision sur la qualité avant traitement massif

---

## Prompt de reprise (à coller après /clear)

```
Relis CLAUDE.md et PROJECT_STATE.md pour te remettre dans le contexte.

Résumé de la session précédente (2026-06-06) :
- Migration 009 appliquée (is_focus, type_decision, resume_ai, tags sur arrets ; statut, effet_date sur criteria)
- UI-Phases A, B, C, E, F, G terminées (sidebar, dashboard, liste arrêts, fiche détail, stats, admin critères)
- recharts installé. TypeScript 0 erreur, lint 0 erreur.
- Seule UI-Phase D (modal recherche avancée 6 sections) reste à faire.
- R-Phase 4 (Qwen2.5-72B sur A100 80 Go Vast.ai) toujours en attente d'instance.

Prochaines options selon priorité :
1. UI-Phase D — modal recherche avancée sur /arrets (bouton "Filtres avancés" déjà désactivé, à activer)
2. R-Phase 4 — test Qwen2.5-72B sur Vast.ai (VRAM ≥ 79 Go, commandes dans PROJECT_STATE.md)
3. Validation avocate — montrer l'interface à la cliente

Dis-moi par quoi commencer.
```

## Points de vigilance permanents

- Ne pas lancer de traitement massif (> 100 arrêts) avant validation juridique.
- Ne pas stocker les PDF.
- Ne pas envoyer les PDF ou l'arrêt complet au LLM.
- Ne pas modifier rétroactivement les analyses après changement de critères sans retraitement explicite.
- Maintenir ce fichier à jour avant chaque `/clear`.
- Lancer `npm install` avant `npm run dev`.
- Appliquer les migrations SQL dans Supabase avant tout test fonctionnel.
- `.env.example` ne doit jamais contenir de vraies clés.
