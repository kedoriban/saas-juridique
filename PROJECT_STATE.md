# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-09 (R-Phase 13 — instance 40282418 DÉTRUITE. Switch décidé vers Mistral 7B AWQ. Commit 3129ce0 pushé. Prochain : test Mistral-7B-Instruct-v0.3-AWQ sur 1-2 arrêts.)

## Objectifs en cours

1. **Score courant : 216/384 = 56%** (R-Phase 12 terminée, stable). Dernier commit : `3129ce0`.
2. **~48 arrêts FR sans valeurs LLM** restants — à traiter en R-Phase 13.
3. **R-Phase 13 EN COURS** : instance 40282418 DÉTRUITE (Mistral-Large-2, test fulltext abandonné — timeout répétés : max_tokens=5500 @ 12.7 t/s = 433s > LLM_TIMEOUT_SECONDS=300). Switch vers Mistral-7B-Instruct-v0.3-AWQ (rapide ~50 t/s, <0.30 $/h, ≥16GB VRAM). Test 1-2 arrêts en 7-groupes → validation qualité → batch 50 arrêts.
4. ~~R-Phase 12~~ — **Terminée** (2026-06-09) : 20 arrêts FR analysés (batch limité à 20). Score 216/384 = 56% confirmé, aucune régression. Instance 40250378 (A100 SXM4, ~1.09 $/h) détruite. Durée : ~16:21→19:10 UTC (~2h49, ~3 $). Améliorations prompts identifiées sur CCE 341854 (fr_013 genre grammatical, fr_018 mère célibataire, fr_006 date intro, fr_007 durée, fr_014 info partielle, fr_043 motivation CCE).
5. ~~R-Phase 11~~ — **Terminée** (2026-06-09) : 87 nouveaux FR scrapés + extraits. 105 arrêts analysés sur Vast.ai (instance 40125949, A100 SXM4, 1.20 $/h, ~10 $). Score 211→216/384 = 56% (+5 pts). 37 arrêts ont stocké des valeurs sur les 105 traités. 68 FR sans valeurs restants.
5. ~~R-Phase 10~~ — **Terminée** (2026-06-08) : 50 nouveaux FR scrapés + extraits + analysés (48 valeurs/arrêt). Score 211/384 = 54%.
5. ~~R-Phase 9~~ — **Terminée** (2026-06-08) : 42 non-référence re-analysés + 8 nouveaux (5 FR + 3 NL). Score stable 214/384 = 55%.
5. ~~R-Phase 8~~ — **Terminée** (2026-06-08) : group_note evidence_documents non-DPI + Geboorteplaats regex NL. +3 pts → 214/384. Push `41f59a4`.
6. **Validation avocate** — Cible ≥ 65% DPI avant traitement massif. Actuel ~54% moyen DPI.
6. ~~R-Phase 7 Phase 3~~ — **Terminée** (2026-06-08) : fix has_value() score_reference.py (check explicite "N/A"), re-run identity (8 arrêts), re-score. Score final 211/384 = 54%. Régression 342046 identity 7→6 due au re-run masse. Leçons : docs=0/1 = value_text=None (non "N/A") ; re-run all-arrêts = risqué (LLM non-déterministe NL). Push `7fbe07f`.
6. ~~R-Phase 7 Phase 2~~ — **Terminée** (2026-06-08) : re-run evidence_documents, score 209→212/384. COI trouvé sur 341946/341960/341962/342046. not_applicable stocké pour 341949/341951/341963 (non compté dans le score = bug). Fixes : GROUP_SECTION_MAX, section order, dédup criterion_id.
6. ~~R-Phase 7 Phase 1~~ — **Terminée** (2026-06-08) : fix prompts.py 25000 chars, commit `cb1c724`, pushé.
7. ~~R-Phase 5 Phase 6~~ — **Terminée** (2026-06-08) : MGF guidance + empty-string fix + re-run DPI, score 50%→54%.
8. ~~R-Phase 5 Phase 5~~ — **Terminée** (2026-06-08) : procedure_type not_applicable + acte_attaque persecution_claims, score 34%→50%.
9. ~~R-Phase 5 Phase 4~~ — **Terminée** (2026-06-08) : 8/8 arrêts analysés 72B, score baseline 131/384 = 34%.
10. ~~R-Phase 5 Phase 3~~ — **Terminée** (2026-06-07) : 8 bugs identifiés + 6 corrections prompts/analyze.
11. ~~R-Phase 5 Phase 2~~ — **Terminée** (2026-06-07) : 4 fixes worker + 8/8 metadata stockés.
12. ~~R-Phase 5 Phase 1~~ — **Terminée** (2026-06-07) : Fix header + regex injection + metadata amélioré.
13. ~~R-Phase 4~~ — **Terminée** (2026-06-07) : 72B sur A100 80 Go, ~48 valeurs/arrêt.

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

---

## R-Phase 4 — Bilan (2026-06-07)

### Résultats

- **Instance Vast.ai** : A100 PCIe 80 Go, CUDA 13.2, PyTorch 2.9.0+cu128, vLLM 0.11.2
- **Modèle** : `Qwen/Qwen2.5-72B-Instruct-AWQ`
- **Arrêts analysés** : 48/50 avec succès (~48 valeurs/arrêt)
- **`profile_vulnerability`** : 15/15 critères consistant (amélioration vs 32B)
- **Temps/arrêt** : ~200–370s (mode `--enforce-eager`, plus lent que prévu)

### Problèmes rencontrés et solutions

| Problème | Cause | Solution |
|---|---|---|
| vLLM crash CUDA graph | `VLLM_ATTENTION_BACKEND=XFORMERS` incompatible A100 | Retirer XFORMERS, laisser auto |
| `--enforce-eager` obligatoire | Crash kernel `unified_attention` en mode compilé | Flag `--enforce-eager` ajouté |
| `source_authority` casse mixte | LLM retourne "CGRa" au lieu de "CGRA" | Normalisé en `.upper()` dans `analyze.py` (commit `8913bcf`) |
| model_runs orphelins | Requête Supabase limitée à 1000 lignes → nettoyage incomplet | Pagination avec `.range()` dans les scripts de cleanup |
| 2 arrêts sans valeurs | Contrainte SQL violée (`acv_source_authority_check`) | Corrigé par la normalisation uppercase |

### Commande vLLM validée pour A100 80 Go (CUDA 13.2)

```bash
nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ \
  --port 8000 --dtype auto \
  --max-model-len 8192 --gpu-memory-utilization 0.92 --trust-remote-code \
  --enforce-eager \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &
```

Note : sans `VLLM_ATTENTION_BACKEND=XFORMERS` (contrairement à l'instance RTX 3090).

### Audit qualité (CCE 341995)

Script `worker/audit_arret.py` créé — compare `intermediate_json` vs `arret_criteria_values`.

**Problèmes identifiés :**

| Critère | Dans le texte | LLM | Cause probable |
|---|---|---|---|
| Date de l'arrêt | ✅ "27 février 2026" | VIDE | Anonymisation X dans header confond le LLM |
| Numéro de l'arrêt | ✅ "n° 341 995" | VIDE | Idem |
| Juge | ✅ "S. SEGHIN" (dispositif) | VIDE | Section dispositif peut-être non transmise au groupe metadata |
| Avocat | ✅ "Bob BRIJS" | VIDE | Idem header anonymisé |
| Chambre | ✅ "Xème CHAMBRE" | VIDE | Idem |
| Crédibilité | ✅ présent | ABSENT | Groupe decision_reasoning non mappé ? |
| Art. 48/7 | À vérifier | ABSENT | À clarifier avec l'avocate |

**Ce qui fonctionne bien :**
- Nationalité, ethnie, religion → conf 1.00
- Motivation CGRA/CCE → conf 0.85
- COI cités → conf 0.95
- Persécutions invoquées → OK

### Prochaine action : R-Phase 5

Voir section "Prochaine action exacte" ci-dessous.

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

- **Instances Vast.ai : gestion entièrement autonome par Claude** — location, choix du GPU, copie des secrets, setup vLLM, destruction après batch. Aucune confirmation demandée à l'utilisateur.
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
- **UI-Phase C** : Liste arrêts — recherche texte + toggle langue + date range, chips filtres URL, chips ×, Réinitialiser, menu ⋯ par ligne (PDF, Focus toggle), pagination URL (10/25/50), Filtres avancés bouton activé (Phase D terminée).
- **UI-Phase D** : Modal recherche avancée — 6 sections (Procédure, Identité, Profil, Documents, Persécutions, Décision), 50+ champs, tristate / select / multicheck / textarea, colonne "Filtres sélectionnés", chip effaçable dans la barre, filtres direct sur arrets (numero, chambre, nationalite→pays_origine, type_dec→type_decision). Filtres critères-based capturés en URL, filtrage Supabase = TODO V2.
- **Worker R-Phase 4** : `/no_think` retiré du system prompt ; `build_schema_for_group()` contraignant `criterion_id` via enum guided_json ; `evidence_excerpt` tronqué à 150 chars ; batch upsert Supabase (N→1 par groupe) ; fetch_pending_analyze N+1→2 requêtes ; VLLMProvider prefilling + token usage + max_input_chars 32000 + max_output_tokens 4096 + modèle 72B par défaut.
- **UI-Phase E** : Fiche détail — header avec source_juridiction + type_decision badge coloré, CTA Copier l'analyse + Copier résumé + Copier par critère, Exporter PDF désactivé, section Résumé IA (resume_ai > resume), badges Confirmé (vert, conf>0.7) / Applicable (gris) / Non applicable (rouge), flag emoji pays d'origine.
- **UI-Phase F** : Stats — 4 KPI (total, taux analyse, taux annulation, valeurs LLM), donut Langue + donut Procédure, line chart Évolution toggle 7j/30j/12m, bar chart Pays top 6 toggle 7j/30j/12m, table Top 10 critères par count + barre %.
- **UI-Phase G** : Admin critères — banner Important jaune, table groupée par section (Nom/Langue/État/Effet/Modifié/Actions), badge État cliquable (toggle Actif↔Archivé, sync champ `active`), menu ⋯ Dupliquer, modal Créer (Nom, Description, Section, Effet date). `setStatut` synchronise aussi `active` pour le worker.
- **CopyButton** : composant client générique, feedback "Copié ✓" 2s.
- **ArretRowMenu** : composant client ⋯ par ligne (Voir fiche, Télécharger PDF, Focus toggle via server action).
- **countryFlag** : 30+ pays FR → flag emoji dans utils.ts.
- **deriveCriteriaStatus** : logique Confirmé/Applicable/Non applicable dans utils.ts.
- **Fix 1 (metadata group)** : `"header"` en tête de GROUP_SECTIONS["metadata"] — section `"header"` = texte avant le premier titre de section (date, numéro, chambre).
- **Fix 2 (regex injection)** : `_inject_regex_metadata()` dans analyze.py — fallback depuis metadata_detected pour 5 critères (date, numéro, juge, avocat, chambre). Ne jamais écraser un item LLM avec status=found.
- **MetadataDetected.chambre** : nouveau champ backward-compatible (default=None). Les anciens intermediate_json retournent None pour ce champ via from_dict.
- **`main.py --reprocess`** : pour tout rebuild des intermediate_json, utiliser ce flag. Pas de reset de statut en base nécessaire.
- **nl_001 + nl_006 llm_group** : corrigés en Supabase (general → metadata). Ne pas ré-importer les critères NL depuis le JSON sans vérifier ces deux critères au préalable.
- **RESULTAT ATTENDU.md** : fichier de référence client à conserver à la racine du projet. Contient 9 arrêts avec valeurs attendues pour chaque critère.
- **Gaps Phase 2** : not_applicable pour non-DPI, type_decision extraction, resume_ai génération, format structuré fr_006/nl_006.
- **R-Phase 5 Phase 5** : `procedure_type` passé à `build_prompt` → note ⚠️ non-DPI dans le prompt ; `not_applicable` → `value_text="N/A"` → `has_value=True` dans score. Score 34%→50%.
- **R-Phase 5 Phase 6** : guidance SYSTEM_PROMPT DPI — MGF/Réexcision/Désinfibulation = `not_applicable` si DPI non-MGF ; mère célibataire = `not_applicable` si requérant masculin ou en couple. `if not value_text` au lieu de `if value_text is None` dans `store_criteria_values`. Score 50%→54%.
- **Objectif validation avocate révisé** : 90% global inaccessible à court terme. Cible révisée : ≥ 65% sur DPI uniquement avant soumission.
- **vLLM commande validée Phase 4** (A100 80 Go, CUDA 13.2, sans XFORMERS) : `--enforce-eager --max-model-len 16384 --gpu-memory-utilization 0.92` — référence pour la prochaine session Vast.ai.
- **R-Phase 7 Phase 2 — fixes evidence_documents** : GROUP_SECTION_MAX (acte_attaque cap 10 000 chars), section order (acte_attaque → conclusion → motivation), dédup criterion_id dans store_criteria_values, group_note concision (max 200 chars/value), COI ajouté à not_applicable non-DPI dans SYSTEM_PROMPT. Score 209→212/384.
- **R-Phase 7 Phase 3 — diagnostic has_value()** : La valeur en base pour fr_047 sur 341949/341951/341963 est `value_text=None` (NOT "N/A"). Le LLM retourne `not_mentioned` (pas `not_applicable`) pour le critère COI des arrêts non-DPI malgré la guidance SYSTEM_PROMPT. Fix has_value() ajouté (`if vt == "N/A": return True`) comme robustesse (commit `7fbe07f` pushé), mais sans gain de score.
- **Re-run identity sur tous les arrêts = DANGEREUX** : la non-déterminisme du LLM peut faire régresser des arrêts qui étaient bien extraits. Toujours cibler des arrêts spécifiques via `analyze.py --arret-id <uuid> --group <group>`.
- **Identity arrêts 3-sections** : 341949/341951/341963 ont identity faible (2-3/9) parce que Sexe/Ethnie sont absents des sections transmises au groupe identity (arrêts non-DPI courts). Gain impossible sans revoir les sections ou le prompt.
- **342046 identity NL** : régression 7→6/11 après re-run. Geboorteplaats ("Jerevan") probablement perdu. LLM déterministe sur ce cas (même token count = même réponse). Récupérable seulement via changement de prompt.
- **instance Vast.ai (2026-06-08)** : `ssh -p 18823 root@202.122.49.242`, A100-SXM4-80GB, vLLM PID 8709 actif, git à `d880f77` (score_reference.py à jour via SCP). **Toujours facturée.**
- **R-Phase 12 — fulltext** : `build_prompt_fulltext()` dans prompts.py + `analyze_arret_fulltext()` + `--fulltext` dans analyze.py. Ancienne logique 7-groupes préservée intacte. Commit `39f3679`.
- **R-Phase 12 — fulltext ABANDONNÉ** : Mixtral ignore les `criterion_id` longs (invente des noms courts) même avec prefilling + json_schema=None. Mode 7-groupes retenu à la place.
- **R-Phase 12 — 7-groupes validé avec Mixtral** : guided_json + Mixtral → 48 valeurs/arrêt non-null, criterion_ids corrects. Batch `analyze.py --limit 100` lancé (2026-06-09 16:21 UTC). Commit `eab41c6`.
- **Mixtral AWQ modèle validé** : `MaziyarPanahi/Mixtral-8x22B-Instruct-v0.1-AWQ` (TheBloke n'a pas de version AWQ pour ce modèle). Chargement : 68.6 GiB VRAM sur A100 SXM4 80Go. KV cache 3.8 GiB disponible pour max_model_len=16384.
- **Mixtral chat template** : ne supporte pas le rôle `system` séparé. Intégré nativement dans `VLLMProvider.complete()` : si model contient "mixtral", merger system dans user avant construction des messages. Plus besoin de `_patch_mixtral.py`. Commit `eab41c6`.
- **VLLMProvider.complete() enrichi** : paramètres `prefill` (string partiel pour prefilling + `continue_final_message`/`add_generation_prompt`) et `max_tokens` (override local). Commit `eab41c6`.
- **guided_json désactivé pour fulltext** : `guided_json` actif force Mixtral à retourner `value=null` pour tous les critères (seul `status` est rempli). Solution documentée : `json_schema=None` + prefilling dans `analyze_arret_fulltext()`. Non utilisé en pratique (fulltext abandonné).
- **Limites contexte Mixtral 16384** : `LLM_MAX_INPUT_CHARS=28000`, `LLM_MAX_OUTPUT_TOKENS=4096` pour rester dans les 16 384 tokens totaux (input ≈ 12 000 tokens, output ≈ 3 500 tokens pour 48 critères).
- **EngineCore zombie Vast.ai** : quand vLLM est tué avec `kill -9`, l'EngineCore (processus séparé visible avec `ps aux | grep VLLM`) peut rester vivant et tenir la VRAM. Toujours tuer explicitement le PID EngineCore avant de relancer vLLM.
- **R-Phase 8 — group_note evidence_documents conditionnel** : `procedure_type` non-DPI → "RÈGLE ABSOLUE — not_applicable obligatoire" dans group_note (cumulé avec proc_note). `procedure_type` DPI/unknown → note COI standard inchangée.
- **R-Phase 8 — _inject_regex_identity_nl()** : filet de sécurité Geboorteplaats NL. Regex `geboren\b[^.]{0,80}?\bin\s+([A-ZÀ-Ü][a-zA-Zà-ü\-]{2,30})` sur `intermediate.sections`. Skip si LLM a `status=found` + value non vide. Slug partiel "geboorteplaats" pour trouver nl_014.
- **Geboorteplaats dans header 342046** : "geboren op [redacted]1976 in Jerevan" est dans la section `header` (5454 chars), pas dans `motivering_cgvs_of_dv`. LLM l'a trouvé lors du re-run R-Phase 8 (conf=0.95, value="Jerevan, Armenië; Moskou, Rusland").
- **Re-run 342046 identity = net 0** : LLM trouve Jerevan (+1) mais perd simultanément un autre critère (-1). Score stable 6/11. Ne pas re-run sans changement de prompt significatif.
- **R-Phase 13 — 6 améliorations prompts** (commit `c4c42f8`) : SYSTEM_PROMPT genre grammatical FR (fr_013) ; group_note identity/fr pour sous-questions (fr_014) ; group_note procedure/fr pour date d'arrivée fallback + durée (fr_006, fr_007) ; group_note decision_reasoning/fr pour motivation CCE complète (fr_043) ; `_inject_fr018_mere_celibataire()` dans analyze.py (fr_018 : si sexe=masculin → mere_celibataire=Non) ; PROMPT_VERSION `intermediate-v1` → `intermediate-v2`.
- **R-Phase 13 — modèle Mistral-Large-2 AWQ** : nom exact = `TechxGenus/Mistral-Large-Instruct-2411-AWQ` (casperhansen n'existe pas). Poids = 60.5 GiB. Sur A100 SXM4 80GB : max_model_len max sûr = 24000 (27104 limite, KV cache = 9.10 GiB à utilization=0.90). Note : awq_marlin serait plus rapide qu'awq pour la prochaine session.
- **R-Phase 13 — instance 40282418** : DÉTRUITE (2026-06-09). Test fulltext abandonné — timeout répétés (max_tokens=5500 @ 12.7 t/s = 433s > timeout=300s). Mistral-Large-2 trop lent pour fulltext sans augmenter LLM_TIMEOUT_SECONDS.
- **R-Phase 13 — switch Mistral 7B AWQ** : décision de tester `TechxGenus/Mistral-7B-Instruct-v0.3-AWQ`. Rapide (~50 t/s sur RTX 3090), VRAM ~4GB → compatible GPU ≥16GB à <0.30$/h. Pas de coût token. Test sur 1-2 arrêts en 7-groupes avant batch 50.
- **R-Phase 13 — commit 3129ce0** : fix stdout line-buffering (sys.stdout.reconfigure) + LLM_FULLTEXT_MAX_TOKENS configurable via env (défaut 3500, ok pour 7B ; 5500 pour Mistral-Large à augmenter avec timeout ≥450s).
- **R-Phase 13 — .env.local Mistral 7B** : LLM_PROVIDER=vllm, VLLM_BASE_URL=http://localhost:8000/v1, VLLM_MODEL=TechxGenus/Mistral-7B-Instruct-v0.3-AWQ, LLM_MAX_INPUT_CHARS=32000, LLM_MAX_OUTPUT_TOKENS=3000, LLM_FULLTEXT_MAX_TOKENS=3500, LLM_TIMEOUT_SECONDS=180.
- **R-Phase 13 — vLLM Mistral 7B AWQ validé** : commande cible = `python -m vllm.entrypoints.openai.api_server --model TechxGenus/Mistral-7B-Instruct-v0.3-AWQ --quantization awq --max-model-len 16384 --gpu-memory-utilization 0.90 --enforce-eager --port 8000`.

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
| **R-Phase 4. Test Qwen2.5-72B / A100 80 Go** | ✅ **Terminé** | 48/50 arrêts, 72B validé, --enforce-eager, source_authority fix |
| **R-Phase 5. Amélioration extraction prompts** | ✅ **Terminé** | Phases 1–6 : score 34%→54% sur 8 arrêts référence. Gaps résiduels : identity, COI, profile_vulnerability NL. |
| **R-Phase 6–8. Corrections itératives** | ✅ **Terminé** | COI fix, has_value fix, evidence_documents non-DPI, Geboorteplaats NL. Score 54%→55%. |
| **R-Phase 9. Batch 58 arrêts (prompts R-Phase 8)** | ✅ **Terminé** | 42 non-référence re-analysés + 8 nouveaux (5 FR + 3 NL). 58 arrêts total. Score stable 55%. |
| **R-Phase 10. 50 nouveaux arrêts FR** | ✅ **Terminé** | 50 FR scrapés + extraits + analysés. Score 211/384 = 54%. 108 arrêts en base. |
| **R-Phase 11. 105 arrêts FR batch** | ✅ **Terminé** | 87 FR scrapés + extraits + analysés. Score 211→216/384 = 56%. 195 arrêts en base. |
| **R-Phase 12. Mixtral 8x22B AWQ — batch 7-groupes** | ✅ **Terminé** | 20 FR analysés (batch limité à 20). Score 216/384 = 56% stable. Instance 40250378 détruite (~3 $). |
| **R-Phase 13. Mistral-Large-2 + prompts améliorés** | 🔄 **EN COURS** | Instance 40282418 active. 6 améliorations prompts appliquées (commit c4c42f8). Test fulltext 4 arrêts en cours. |
| **UI-Phase A. Sidebar & navigation** | ✅ **Terminé** | Focus/Export désactivés, Validation retiré du nav, Critères→Administration, BottomNav 4 items |
| **UI-Phase B. Dashboard rebuild** | ✅ **Terminé** | 4 KPI + table 8 récents + section Focus (état vide) + donut type_decision |
| **UI-Phase C. Liste arrêts** | ✅ **Terminé** | Search + chips filtres URL + menu ⋯ Focus + pagination 10/25/50 + tags |
| **UI-Phase D. Recherche avancée modal** | ✅ **Terminé** | Modal 6 sections, 50+ champs, 3 col desktop / tabs mobile, filtres URL searchParams |
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

- **~48 arrêts FR sans valeurs LLM** : restants après batch R-Phase 12 (limité à 20). À traiter en R-Phase 13.
- **Score 56% (216/384)** : stable depuis R-Phase 11. Objectif ≥ 65% DPI avant traitement massif toujours non atteint.
- **Qualité LLM non validée par l'avocate** : score 56% global, ~54% moyen sur DPI. Objectif ≥ 65% DPI avant traitement massif.
- **UI non commitée** : `icons.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `layout.tsx` modifiés localement — à commiter avant la prochaine session Vast.ai.
- **Scripts temporaires à supprimer** : `worker/_check_roles.py`, `worker/_set_admin.py` — utilitaires ponctuels, ne pas commiter.
- **`type_decision` non extrait** : le worker ne produit pas encore ce champ → donut stats + KPI taux d'annulation restent à 0. À ajouter dans analyze.py (regex sur dispositif).
- **`resume_ai` non extrait** : idem — la fiche détail affiche "Résumé" (scraper) et non "Résumé IA". À ajouter dans analyze.py (nouveau groupe "summary").
- **DPI score ~54% moyen** : 341946=60%, 341960=50%, 341962=60%, 342046=47%. Objectif ≥ 65% non atteint. Gaps : profile_vulnerability NL + identity NL + persecution_claims 342046.
- **Régression légère score référence** : 214→211 (-3 pts) due à LLM non-déterministe sur decision_reasoning de 341951 et 342062 lors de R-Phase 10. Ne pas re-analyser sans changement de prompt.
- **identity faible** sur arrêts courts : 341951 = 2/9, 341963 = 2/9, 341949 = 3/9. Sexe, ethnie, documents identité non extraits.
- **profile_vulnerability NL** : 342046 = 5/13 = 38%, 342062 = 5/13 = 38%. Critères NL gender-specific encore partiellement capturés.
- **`arrets.tags` vide** : TagPill n'apparaît pas encore. Alimenté manuellement ou par le worker après validation.
- **`is_focus` vide** : section Focus du dashboard affiche l'état vide. Activé via menu ⋯.
- **Arrêts fictifs seed** : 15 arrêts (CCE 260.001–015) avec PDF en 404 → statut `erreur`. Polluent légèrement les stats.
- **Critères FR fusionnés** (`fr_025`, `fr_033`) : à clarifier avec la cliente.
- **Filtres critères-based non branchés côté serveur** : params avancés capturés en URL mais ne filtrent pas encore Supabase. TODO V2.

## R-Phase 5 — Phase 1 terminée (2026-06-07)

### Contexte : fichier RESULTAT ATTENDU.md

La cliente a fourni `RESULTAT ATTENDU.md` : analyses complètes de 9 arrêts de référence (CCE 290647, 341963, 341960, 341946, 341951, 341962, 341949 + RvV 342046, 342062) avec les valeurs attendues critère par critère.

### Diagnostic initial (avant fixes)

| Problème | Cause identifiée |
|---|---|
| groupe `metadata` → tout vide | section `"header"` absente de GROUP_SECTIONS["metadata"] |
| Fix 2 sans effet | `metadata_detected` null dans les intermediate_json existants |
| Un seul avocat extrait | `break` après premier match dans `_RE_LAWYER` |
| Chambre absente | aucune extraction regex de la chambre |
| `nl_001` datum absent du groupe | `llm_group=general` en Supabase au lieu de `metadata` |
| auth=CCE pour arrêts NL | valeur hardcodée dans `_inject_regex_metadata` |

### Fixes appliqués

**Fix 1 — `worker/prompts.py`**
- `"header"` ajouté en tête de `GROUP_SECTIONS["metadata"]` → LLM reçoit les premières lignes de l'arrêt
- `"dispositif"` / `"dictum"` remontés en 2ème position (juge non anonymisé dans le dispositif)

**Fix 2 — `worker/analyze.py`**
- `_METADATA_SLUG_MAP` : mapping slug → champ `metadata_detected` (FR + NL, 5 critères dont chambre)
- `_inject_regex_metadata()` : injecte les valeurs regex quand LLM retourne null, sans écraser les valeurs LLM valides
- `source_authority` language-aware : `"RvV"` si langue=nl, `"CCE"` si langue=fr
- `fetch_criteria()` : `slug` ajouté au SELECT Supabase (nécessaire pour le mapping)

**Fix 3 — `worker/extract_metadata.py`**
- `_RE_CHAMBRE` : extrait le numéro de chambre (Ière, IIIème, XIde, etc.) — patterne excluant les faux positifs comme "V" de "RvV"
- `_RE_NUMBER_FALLBACK` : fallback pour "n° 341 968" sans préfixe "arrêt/arrest"
- Extraction de **tous les avocats** (plus de `break`) avec préfixe "Me " → ex. "Me J. HARDY ; Me F. LAURENT"
- Juge : fallback sur `text[-2000:]` (dispositif/signature, non anonymisé)
- Champ `chambre: str | None = None` ajouté à `MetadataExtractionResult`

**Fix 4 — `worker/build_intermediate.py`**
- Champ `chambre` ajouté à `MetadataDetected` (avec default None, backward-compatible)
- `from_dict` lit `chambre` depuis le JSON
- Construction depuis `meta_result.chambre`

**Fix 5 — `worker/main.py`**
- Flag `--reprocess` : retraite les arrêts avec `statut=termine/erreur` pour regénérer leur `intermediate_json`

**Fix 6 — Supabase**
- `nl_001_datum_van_het_arrest` : `llm_group` corrigé `general` → `metadata`
- `nl_006_datum_van_aankomst...` : `llm_group` corrigé `general` → `metadata`

### Résultat du dry-run après Phase 1 (CCE 342057, NL)

```
nl_002_nummer_van_het_arrest: '342 057' (status=found, conf=0.95, auth=RvV) ✅
nl_003_rechter: 'N. VERMANDER'          (status=found, conf=0.95, auth=RvV) ✅
nl_004_advocaat: 'A. VAN OVERBERGHE, C. DECORDIER, T. BRICOUT, S. VAN ROMPAEY' ✅
nl_005_kamers: 'RvV'                    (partiel — regex à tester post-reprocess)
nl_001_datum: absent (llm_group corrigé, sera présent après reprocess)
```

### Gaps restants identifiés (Phase 3+)

| Gap | Plan |
|---|---|
| `not_applicable` pour arrêts non-DPI | Améliorer SYSTEM_PROMPT : guidance sur détection type procédure |
| `type_decision` non extrait | Regex sur dispositif + update `arrets.type_decision` |
| `resume_ai` non généré | Nouveau groupe `"summary"` → update `arrets.resume_ai` |
| Format structuré `fr_006` (date arrivée+DPI) | Guider le LLM vers format "Arrivée: X ; DPI: Y" |
| ~~`intermediate_json` stale~~ | ~~`main.py --reprocess --limit 50`~~ ✅ **FAIT** |

---

## R-Phase 5 — Phase 2 terminée (2026-06-07)

### Contexte
Suite du dry-run groupe `metadata` : 3 bugs bloquants identifiés, 4 fixes appliqués, 8/8 arrêts de référence stockés avec succès. Les 8 fichiers audit sont disponibles dans `worker/audit_*.txt` pour comparaison avec `RESULTAT ATTENDU.md`.

### Bugs identifiés et corrigés

| Fix | Fichier | Problème | Solution |
|---|---|---|---|
| Fix A | `worker/schemas.py` | `qwen3:4b` retourne `"0.95"` (string) → schema validation échoue 3× → 0 items LLM pour FR | Coercer `confidence` string→float dans `normalize_response()` |
| Fix B | `worker/analyze.py` | LLM retourne valeur avec `status=not_mentioned` (contradiction) → mauvais statut stocké | Passe de correction dans `_inject_regex_metadata()` : not_mentioned→found si valeur présente |
| Fix C | `worker/analyze.py` | `source_authority` `.upper()` → `"RVV"` interdit par contrainte SQL ; LLM retourne `"unknown"` → `"UNKNOWN"` interdit | `_NORMALIZE_SA` whitelist : `"RVV"`→`"RvV"`, `"UNKNOWN"`→None |
| Fix D | `worker/analyze.py` | `decision_date` et `decision_number` absents de `MetadataDetected` (dans `DocumentInfo`) → injection rate fr_001/fr_002 | Fallback `getattr(intermediate.document, field, None)` dans `_inject_regex_metadata()` |

### Nouveaux scripts utilitaires

| Fichier | Rôle |
|---|---|
| `worker/analyze_reference.py` | Lance analyze.py sur les 9 arrêts de référence (par numéro) |
| `worker/list_arrets.py` | Liste les arrêts en base avec numéro/langue/statut |
| `worker/check_cache.py` | Affiche le metadata_detected du cache disque pour un arrêt |

### Résultat dry-run après Phase 2

**CCE 342057 (NL)** — 5 statuts corrigés :
```
nl_001 date      : '27 februari 2026' (status=found, auth=RvV) ✅
nl_002 numéro    : '342 057'          (status=found, auth=RvV) ✅
nl_003 juge      : 'N. VERMANDER'     (status=found, auth=RvV) ✅
nl_005 chambre   : 'IIde KAMER'       (status=found, auth=RvV) ✅
```

**CCE 341935 (FR)** — plus d'erreur schema :
```
fr_001 date      : '26 février 2026'  (status=found, auth=CCE) ✅
fr_002 numéro    : 'n°341 935'        (status=found, auth=CCE) ✅
fr_003 juge      : 'N. RENIERS'       (status=found, auth=CCE) ✅
fr_004 avocat    : 'Maître E. TCHIBONSOU' (status=found)       ✅
fr_005 chambre   : 'VIIE CHAMBRE'     (status=found, auth=CCE) ✅
```

### Audit CCE 341963 — constat important
CCE 341963 est un **cas OQT séjour étudiant** (pas DPI/asile). Comportement correct :
- Metadata : juge ✅, avocat ✅, chambre ✅, date ✅, numéro ✅ (après Fix D)
- Critères DPI : tous `not_mentioned` → devrait être `not_applicable` (gap Phase 3)
- Nationalité turque présente dans le texte mais non extraite (groupe identity non relancé)

### État des 8 arrêts de référence en base

| Arrêt | Langue | Metadata stocké | Type cas |
|---|---|---|---|
| CCE 341963 | FR | ✅ 7 valeurs | OQT étudiant (non-DPI) |
| CCE 341960 | FR | ✅ 5 valeurs | À confirmer |
| CCE 341946 | FR | ✅ 7 valeurs | Asile (DPI) |
| CCE 341951 | FR | ✅ 7 valeurs | 9bis (non-DPI probable) |
| CCE 341962 | FR | ✅ 7 valeurs | À confirmer |
| CCE 341949 | FR | ✅ 7 valeurs | OQT (non-DPI probable) |
| CCE 342046 | NL | ✅ 7 valeurs | À confirmer |
| CCE 342062 | NL | ✅ 7 valeurs | Dublin (non-DPI) |
| CCE 290647 | FR | ❌ absent | À scraper (arrêt ~2020) |

---

## Fichiers modifiés — session 2026-06-07 (R-Phase 5 Phase 1)

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---|---|
| `worker/prompts.py` | Fix 1 : `"header"`, `"dispositif"`, `"dictum"` en tête de GROUP_SECTIONS["metadata"] |
| `worker/analyze.py` | Fix 2 : `_METADATA_SLUG_MAP` + `_inject_regex_metadata()` + `source_authority` language-aware + `slug` dans fetch_criteria |
| `worker/extract_metadata.py` | `_RE_CHAMBRE` + `_RE_NUMBER_FALLBACK` + tous avocats + juge fin de texte + champ `chambre` |
| `worker/build_intermediate.py` | Champ `chambre` dans `MetadataDetected` + `from_dict` + construction |
| `worker/main.py` | Flag `--reprocess` pour rebuild intermediate_json des arrêts terminés |

### Décisions
- **RESULTAT ATTENDU.md** : fichier de référence pour 9 arrêts (CCE + RvV), à conserver à la racine du projet
- **Fix 2 validé** : injection regex fonctionne pour numéro, juge, avocats multiples
- **nl_001 + nl_006 corrigés** en Supabase (llm_group general → metadata) — ne pas ré-importer les critères depuis le JSON sans vérifier d'abord
- **source_authority** pour les injections regex : "RvV" si langue=nl, "CCE" si langue=fr
- **Chambre regex** : requiert ≥ 2 chars romains OU 1 char avec suffixe ordinal explicite (évite faux positifs "V" de "RvV")
- **confidence coercion** : `normalize_response()` dans schemas.py coerce string→float avant validation schema (fix qwen3:4b)
- **`_NORMALIZE_SA`** : whitelist source_authority dans `store_criteria_values` — "RVV"→"RvV", "UNKNOWN"/"unknown"/autres→None. Remplace le `.upper()` brut.
- **`decision_date` / `decision_number`** sont dans `DocumentInfo` (intermediate.document), pas dans `MetadataDetected`. `_inject_regex_metadata()` cherche dans les deux via fallback.
- **CCE 290647** absent de la base — arrêt ~2020, hors du lot FR scrapé (341931–342062). À scraper séparément.
- **audit_arret.py** : `sys.stdout.reconfigure(encoding="utf-8")` ajouté pour éviter le mangling UTF-8 dans les pipes PowerShell.
- **analyze_reference.py** : utiliser `.ilike("numero", f"%{numero}%")` car les numéros en base ont le préfixe "CCE " (ex. "CCE 341963").
- **Fichiers audit générés** : `worker/audit_341963.txt` … `worker/audit_342062.txt` — 8 fichiers pour comparaison manuelle avec RESULTAT ATTENDU.md.

---

## Fichiers modifiés — session 2026-06-07 (suite : R-Phase 4)

### Nouveaux fichiers
| Fichier | Rôle |
|---|---|
| `worker/audit_arret.py` | Script d'audit qualité : compare intermediate_json vs arret_criteria_values |
| `worker/check_cols.py` | Script diagnostic colonnes Supabase (utilitaire ponctuel) |
| `worker/check_join.py` | Script diagnostic jointure criterion_id (utilitaire ponctuel) |

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---|---|
| `worker/analyze.py` | Normalisation `source_authority` en `.upper()` avant upsert (commit `8913bcf`) |

### Décisions ajoutées
- **vLLM sur A100 80 Go** : sans `VLLM_ATTENTION_BACKEND=XFORMERS`, avec `--enforce-eager`
- **Cleanup Supabase** : toujours paginer les requêtes `arret_criteria_values` (`.range()` par blocs de 1000)
- **audit_arret.py** : jointure `criterion_id = f"{langue}_{order_index:03d}_{slug}"`
- **R-Phase 4 terminée** : 72B validé, meilleur que 32B sur profile_vulnerability

---

## Fichiers modifiés — session 2026-06-07 (début : UI-Phase D)

### Nouveaux fichiers
| Fichier | Rôle |
|---|---|
| `src/app/(app)/arrets/AdvancedSearchModal.tsx` | Modal recherche avancée 6 sections — client, 3 colonnes desktop / tabs mobile |

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---|---|
| `src/app/(app)/arrets/ArretFilters.tsx` | Bouton Filtres avancés activé, badge count, chip effaçable, import modal |
| `src/app/(app)/arrets/page.tsx` | Filtres directs : numero, chambre, nationalite, type_dec |
| `worker/prompts.py` | Retire `/no_think`, ajoute liste source_authority valides |
| `worker/schemas.py` | `build_schema_for_group()` avec enum criterion_id, troncature evidence_excerpt 150 chars |
| `worker/analyze.py` | guided_json par groupe, batch upsert, fetch_pending N+1→2, token usage dans model_runs |
| `worker/llm_provider.py` | VLLMProvider : prefilling + token usage + max_input 32000 + max_output 4096 + modèle 72B |

---

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

## R-Phase 5 — Phase 3 : analyse audits + corrections (2026-06-07)

### Analyse comparative effectuée

Les 8 fichiers `worker/audit_*.txt` ont été lus et comparés avec `RESULTAT ATTENDU.md`.

**Scores observés (avant corrections) :**

| Arrêt | Type | Score LLM |
|---|---|---|
| 341946 (FR, DPI Burundi) | DPI accordé | 17/48 |
| 341960 (FR, DPI Guinée MENA) | DPI refusé | 9/48 |
| 341962 (FR, DPI Sénégal LGBT) | DPI refusé | 13/48 |
| 341963 (FR, OQT étudiant) | Non-DPI | 6/48 |
| 341949 (FR, OQT cohabitation) | Non-DPI | 6/48 |
| 341951 (FR, 9bis + OQT) | Non-DPI | 8/48 |
| 342046 (NL, DPI Russie) | DPI refusé | 9/48 |
| 342062 (NL, Dublin Croatie) | Non-DPI | 11/48* |

### 8 bugs identifiés avec causes racines

| # | Pattern | Cause racine |
|---|---|---|
| 1 | Numéro d'arrêt incorrect (341951→281845, 341960→227624, 341963→341961, 342062→342080) | `_RE_ARRET_NUMBER` cherche dans le texte complet, trouve un arrêt cité avant le bon numéro du header |
| 2 | Motivation CCE systématiquement VIDE (8/8) | `acte_attaque` et `conclusion_cgra_ou_oe` absents de `GROUP_SECTIONS["decision_reasoning"]` |
| 3 | Nationalité absente pour arrêts non-DPI courts | `header` absent de `GROUP_SECTIONS["identity"]` |
| 4 | Critères DPI → ABSENT/VIDE au lieu de `not_applicable` | Aucune guidance dans SYSTEM_PROMPT sur la détection du type procédure |
| 5 | VGV NL confondu avec persécutions politiques | LLM ne comprend pas que VGV = Mutilations Génitales Féminines |
| 6 | Date/numéro incorrects sur arrêts corrigés (342062) | Header commence par "DIT ARREST WERD VERBETERD…" — LLM prend la mauvaise info |
| 7 | Juge NL : titre sans nom (342046) | LLM retourne "wnd. voorzitter" au lieu de "V. HOEFNAGELS" |
| 8 | COI (pays d'origine) vides malgré présence | `acte_attaque` (inventaire COI) absent de `GROUP_SECTIONS["evidence_documents"]` |

### Corrections appliquées

**`worker/prompts.py` :**
- `GROUP_MAX_CHARS` : `decision_reasoning` → 16 000 chars (était 6 500), `profile_vulnerability` → 10 000
- `identity` : `"header"` ajouté en première position → corrige bug 3
- `decision_reasoning` : `"acte_attaque"` + `"conclusion_cgra_ou_oe"` ajoutés AVANT `"motivation_cgra_ou_oe"` → corrige bug 2
- `evidence_documents` : `"acte_attaque"` ajouté en première position → corrige bug 8
- `SYSTEM_PROMPT` : guidance `not_applicable` pour arrêts non-DPI (OQT, 9bis, Dublin, étudiant) → corrige bug 4
- `SYSTEM_PROMPT` : définition VGV = Vrouwelijke Genitale Verminking → corrige bug 5
- `SYSTEM_PROMPT` : guidance numéro d'arrêt (ignorer numéros cités dans le corps) → aide bug 1

**`worker/analyze.py` :**
- `_inject_regex_metadata` : nouveau paramètre `arret_numero` (campo Supabase, ex. "CCE 341963")
- `_canonical_number` : extrait le numéro pur depuis `arret_numero` — source la plus fiable (scraper web)
- Pour `decision_number` : `_canonical_number` (Supabase) > regex PDF > LLM → corrige bug 1 et 6
- `_ALWAYS_INJECT` : `decision_number` + `decision_date` toujours injectés même si LLM a déjà trouvé

### Validation dry-run (341963)

```
fr_001_date_de_l_arret: '26 février 2026'  (status=found, conf=0.95) ✅
fr_002_numero_de_l_arret: '341963'          (status=found, conf=0.95) ✅ (était '341961')
fr_003_juge: 'J. MAHIELS'                  (status=found, conf=0.95) ✅
fr_004_avocat_du_demandeur: 'Me J. HARDY'  (status=found, conf=0.95) ✅
fr_005_chambres_fr_cce_ou_nl_cvv: 'IIIème CHAMBRE' (status=found, conf=0.95) ✅
```

### Gaps restants (Phase 4+)

| Gap | Statut |
|---|---|
| `type_decision` non extrait | Non traité — regex sur dispositif ("annule"→annulation) |
| `resume_ai` non généré | Non traité — nouveau groupe `"summary"` à créer |
| Format `fr_006` (date arrivée+DPI) | Non traité — guider le LLM vers format "Arrivée: X ; DPI: Y" |
| Juge NL sans nom complet | Partiellement traité via injection regex — à vérifier |
| CCE 290647 absent | Non traité — arrêt ~2020, à scraper |

---

## Fichiers modifiés — session 2026-06-07 (R-Phase 5 Phase 2)

### Nouveaux fichiers
| Fichier | Rôle |
|---|---|
| `worker/analyze_reference.py` | Lance analyze.py sur les 9 arrêts de référence par numéro (ilike) |
| `worker/list_arrets.py` | Liste tous les arrêts en base avec numéro/langue/statut |
| `worker/check_cache.py` | Affiche metadata_detected du cache disque ou Supabase pour un arrêt |

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---|---|
| `worker/schemas.py` | Fix A : coercion `confidence` string→float dans `normalize_response()` |
| `worker/analyze.py` | Fix B : passe status not_mentioned→found si valeur présente ; Fix C : `_NORMALIZE_SA` whitelist source_authority ; Fix D : fallback `intermediate.document` pour decision_date/decision_number |
| `worker/audit_arret.py` | `sys.stdout.reconfigure(encoding="utf-8")` pour pipes PowerShell |

---

## Fichiers modifiés — session 2026-06-07 (R-Phase 5 Phase 3)

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---|---|
| `worker/prompts.py` | `GROUP_MAX_CHARS` (decision_reasoning→16 000, profile_vulnerability→10 000) ; `header` dans identity ; `acte_attaque`+`conclusion_cgra_ou_oe` dans decision_reasoning ; `acte_attaque` dans evidence_documents ; SYSTEM_PROMPT : guidance not_applicable + VGV + numéro d'arrêt |
| `worker/analyze.py` | `_inject_regex_metadata` : param `arret_numero`, `_canonical_number` depuis Supabase, `_ALWAYS_INJECT` pour decision_number/decision_date |

### Décisions ajoutées (Phase 3)

- **Numéro canonique** : toujours injecter le numéro depuis le campo `arrets.numero` (Supabase, ex. "CCE 341963") — plus fiable que le regex PDF ou le LLM qui confondent avec des arrêts cités dans le corps.
- **`_ALWAYS_INJECT`** : `decision_number` et `decision_date` sont toujours écrasés par le regex/Supabase, même si le LLM a retourné `status=found`.
- **`GROUP_MAX_CHARS["decision_reasoning"] = 16000`** : la limite de 6 500 chars empêchait d'atteindre le raisonnement CCE (en fin de longues sections CGRA). Avec 16 000, `acte_attaque` (≤15 000 chars) est lu en entier.
- **Ordre dans `decision_reasoning`** : `acte_attaque` et `conclusion_cgra_ou_oe` avant `motivation_cgra_ou_oe` — sections CGRA trop longues consommaient tout le budget avant que le raisonnement CCE soit atteint.
- **`header` dans `identity`** : les arrêts non-DPI courts (3 sections) n'ont la nationalité que dans le header, pas dans `faits_invokes`.
- **Guidance VGV** : le LLM confond `VGV` (critère NL = MGF) avec d'autres formes de persécution — définition explicite nécessaire dans le SYSTEM_PROMPT.
- **Guidance not_applicable** : sans guidance, le LLM retourne ABSENT/VIDE pour les critères DPI sur les arrêts non-DPI, rendant les résultats indiscernables des DPI avec info manquante.
- **analyze_reference.py ne supporte pas `--numero`** comme filtre individuel — il traite tous les arrêts de référence en base. Pour tester un seul arrêt, utiliser `analyze.py --arret-id <uuid> --group <group>`.

---

## R-Phase 5 — Phase 6 terminée (2026-06-08)

### Diagnostic

Après Phase 5 (score 50%), `profile_vulnerability` restait faible sur les DPI (9/15, 4/15, 5/15, 2/13).
Cause confirmée par dry-run : le LLM retourne `status=not_mentioned` pour MGF/Réexcision/Désinfibulation sur les DPI non-MGF, au lieu de `not_applicable`.
Fix secondaire : `if value_text is None` ne couvrait pas les retours `value=""` (chaîne vide) du LLM.

### Fixes appliqués

| Fix | Fichier | Détail |
|---|---|---|
| Guidance DPI not_applicable | `worker/prompts.py` | SYSTEM_PROMPT : pour les DPI non-MGF, retourner `not_applicable` (pas `not_mentioned`) pour MGF/Réexcision/Désinfibulation ; mère célibataire not_applicable si requérant masculin ou en couple |
| Empty-string fix | `worker/analyze.py` | `if not value_text` au lieu de `if value_text is None` — couvre les cas `value=""` |

### Résultats (re-run profile_vulnerability sur les 4 DPI + 342062 + 341949)

| Arrêt | Avant | Après | Delta profile_vuln |
|---|---|---|---|
| 341946 DPI Burundi | 26/48 = 54% | 29/48 = 60% | 9/15 → 12/15 |
| 341960 DPI Guinée | 19/48 = 39% | 23/48 = 47% | 4/15 → 8/15 |
| 341962 DPI Sénégal | 25/48 = 52% | 28/48 = 58% | 5/15 → 8/15 |
| 342046 DPI NL | 20/48 = 41% | 23/48 = 47% | 2/13 → 5/13 |
| 342062 non-DPI NL | 26/48 = 54% | 29/48 = 60% | 2/13 → 5/13 |
| 341949 non-DPI OQT | 26/48 = 54% | 26/48 = 54% | 6/15 → 6/15 (inchangé) |

**Score Phase 5 → Phase 6 : 193/384 (50%) → 209/384 (54%)**

### État de l'instance Vast.ai après Phase 6

- vLLM : **stoppé** (kill -9 PID 4167 + 4453), VRAM = 0 MiB
- Instance : **toujours active** — à stopper manuellement sur vast.ai
- Fichiers sur instance : à jour (SCP + analyse terminée)

### Commits (sur main local — à pusher)

| Commit | Hash | Contenu |
|---|---|---|
| Phase 5 | `1f0ee30` | procedure_type not_applicable + acte_attaque persecution_claims + faits_invokes |
| Phase 6 | `987633b` | MGF guidance SYSTEM_PROMPT + empty-string fix store_criteria_values |

---

## R-Phase 5 — Phase 5 (terminée — 2026-06-08)

### Diagnostic effectué

| Problème | Cause réelle confirmée | Fix appliqué |
|---|---|---|
| Non-DPI 0% sur décision/profil/persécution | LLM retourne `not_mentioned` pas `not_applicable` → valeur null → has_value=False | **procedure_type dans build_prompt** + stockage `"N/A"` pour not_applicable |
| Art. 48/7 absent sur DPI | `acte_attaque` (CCE reasoning) absent de GROUP_SECTIONS["persecution_claims"] | **acte_attaque ajouté en premier** + GROUP_MAX_CHARS 20000 |
| COI absent sur certains DPI | GROUP_MAX_CHARS["evidence_documents"] = 6500 trop court | **12000 chars** |
| profile_vulnerability 9→14 DPI 341946 | 6 critères VIDE (not_mentioned) : MGF, réexcision, mariage, rapports | Partiellement couvert par proc_note ; rapport médical encore manqué |

### Fixes appliqués (2026-06-08, session R-Phase 5)

| Fichier | Changement |
|---|---|
| `worker/prompts.py` | `GROUP_MAX_CHARS` : persecution_claims→20000, evidence_documents→12000 |
| `worker/prompts.py` | `GROUP_SECTIONS["persecution_claims"]` : acte_attaque + conclusion_cgra_ou_oe en premier |
| `worker/prompts.py` | `build_prompt` : paramètre `procedure_type` + note ⚠️ non-DPI dans user_prompt |
| `worker/analyze.py` | `store_criteria_values` : status=not_applicable → value_text="N/A" |
| `worker/analyze.py` | `analyze_group` : passe `intermediate.document.procedure_type` à build_prompt |

### Run en cours (2026-06-08 ~23:32 UTC)

```bash
nohup .venv/bin/python analyze_reference.py > /workspace/saas-juridique/logs/analyze_ref_v2.log 2>&1 &
tail -f /workspace/saas-juridique/logs/analyze_ref_v2.log
```

Log de progression : `/workspace/saas-juridique/logs/analyze_ref_v2.log`

### Résultats dry-run avant run complet

| Test | Avant | Après |
|---|---|---|
| 341949 decision_reasoning (non-DPI) | 0/8 (all not_mentioned) | 3/8 not_applicable → "N/A" stocké (score +3) |
| 341946 persecution_claims fr_038 Art. 48/7 | not_mentioned | **found** (CCE reasoning extrait) |
| 341946 persecution_claims fr_040 agents | found | not_mentioned (tradeoff) |

Gain estimé : **+30 à +50 items** → score estimé **~41-47%**

### Gaps restants après Phase 5

| Gap | Cause | Fix futur |
|---|---|---|
| Non-DPI : 5/8 decision_reasoning encore not_mentioned | `faits_invokes` absent de GROUP_SECTIONS["decision_reasoning"] → arrêts 3-section | Ajouter `faits_invokes` à la fin de decision_reasoning |
| COI pour 341960/341962/342046 | acte_attaque peut ne pas avoir de COI dans les premières 6500 chars | Verify avec dry-run post-run |
| rapport médical 341946 | Information dans acte_attaque après position 10000 chars | Investiguer section dans intermediate |
| 90% inatteignable à court terme | Problème structurel : arrêts non-DPI avec 3 sections → tout dans faits_invokes | Refactoriser section extraction non-DPI |

## R-Phase 7 — Phase 1 : fix COI (2026-06-08)

### Diagnostic

Dry-run `evidence_documents` sur CCE 341960 (DPI Guinée, UUID `464635d4-0f8b-4b98-a408-6b5f674ac249`) :
- `acte_attaque_1` = 2 049 chars (CGRA faits invoqués)
- `acte_attaque_2` = **40 375 chars** (CCE appréciation complète — mislabeled CGRA)
- Avec limite 12 000 : budget restant pour `acte_attaque_2` = 9 951 chars → COI à ~22 200 chars : **TRONQUÉ**
- Même problème : 342046 `bestreden_beslissing` = 23 512 chars ; 341962 `motivation_cgra_ou_oe` = 43 500 chars

### Fix appliqué

`worker/prompts.py` ligne 29 : `"evidence_documents": 12000` → `25000`

Vérification post-fix :
- 341960 : COI "COI-Focus Guinée, situation politique" visible à pos 23 638 / 25 015 ✅
- 342046 : `bestreden_beslissing` (23 512 chars) rentre entièrement dans 25 000 ✅
- Non-DPI (341949, 341951, 341963) : Phase 6 empty-string fix → "N/A" stocké lors du prochain re-run ✅
- 341962 : incertain — COI = "articles de presse sur l'homophobie au Sénégal" peut être dans les 21 201 chars de `motivation_cgra_ou_oe` accessibles

### Commit

`cb1c724` — pushé sur GitHub (2026-06-08)

### Valeurs attendues COI par arrêt (RESULTAT ATTENDU.md)

| Arrêt | Valeur attendue |
|---|---|
| 341946 DPI Burundi | COI Focus Burundi 2025 + HRW + Amnesty + US Dept State + Iwacu + Ligue Iteka + ACLED |
| 341960 DPI Guinée | COI-Focus Guinée, situation politique + COI MGF Guinée |
| 341962 DPI Sénégal | Articles de presse sur l'homophobie au Sénégal produits par la requérante |
| 342046 DPI NL Russie | EUAA The Russian Federation - Political dissent + EUAA COI Query + Algemeen ambtsbericht |
| 341949 OQT | Aucun rapport pertinent cité → `not_applicable` |
| 341951 9bis | Aucun → `not_applicable` |
| 341963 OQT étudiant | Aucun → `not_applicable` |
| 342062 Dublin NL | Aucun → `not_applicable` |

### Gain estimé

Score actuel : 54% (209/384). Gain attendu : +5 à +6 pts → ~56-57% (209→214-215/384).

---

## R-Phase 7 — Phase 2 : bilan (2026-06-08)

### Score final : 212/384 = 55% (+3 pts vs 209)

| Arrêt | Docs avant | Docs après | COI stocké |
|---|---|---|---|
| 341946 DPI Burundi | 1/1 ✅ | 1/1 ✅ | JSON COI Burundi (7 refs) |
| 341960 DPI Guinée | 0/1 ❌ | 1/1 ✅ | COI-Focus Guinée |
| 341962 DPI Sénégal | 0/1 ❌ | 1/1 ✅ | Informations personnes homosexuelles au Sénégal |
| 341949 OQT | 0/1 ❌ | not_applicable stocké (VIDE dans score) | bug has_value() |
| 341951 9bis | 0/1 ❌ | not_applicable stocké (VIDE dans score) | bug has_value() |
| 341963 OQT étudiant | 0/1 ❌ | not_applicable stocké (VIDE dans score) | bug has_value() |
| 342046 DPI NL Russie | 1/1 ✅ | 1/1 ✅ | EUAA Russia (2 refs) |
| 342062 Dublin NL | 1/1 ✅ | 1/1 ✅ | stable |

### Fixes appliqués (session 2026-06-08)

| Fix | Fichier | Détail |
|---|---|---|
| GROUP_SECTION_MAX | `worker/prompts.py` | Cap acte_attaque/bestreden_beslissing à 10 000 chars (acte_attaque_2 de 341960 = 38 853 chars → explosion 4096 tokens) |
| Section order evidence_documents | `worker/prompts.py` | conclusion_cgra_ou_oe avant motivation_cgra_ou_oe (COI Sénégal à pos 29 753 dans conclusion) |
| Dédup criterion_id | `worker/analyze.py` | `store_criteria_values` : garder item confiance max si LLM retourne plusieurs items pour le même criterion_id (sinon erreur ON CONFLICT Supabase) |
| not_applicable COI non-DPI | `worker/prompts.py` | SYSTEM_PROMPT + group_note evidence_documents : COI = not_applicable pour OQT/9bis/Dublin |
| group_note concision | `worker/prompts.py` | Max 200 chars par value pour COI (évite output JSON trop long) |

### Bug score_reference.py à corriger

`has_value()` dans `score_reference.py` ne reconnaît pas `value_text="N/A"` avec `status=not_applicable` comme valeur valide pour le groupe `docs`.

Conséquence : 341949, 341951, 341963 affichent `0/1` pour docs alors que "N/A" est stocké en base.

Correction probable dans `score_reference.py` : `has_value()` doit retourner True si `value_text == "N/A"` (not_applicable).

Gain attendu après fix : +3 pts → 215/384 = 56%.

### Instance Vast.ai

- **Toujours active** : `ssh -p 18823 root@202.122.49.242`
- vLLM : **actif** (PID 8709, A100-SXM4-80GB, CUDA 13.1)
- Repo : `/workspace/saas-juridique` — git est en retard (commit `d880f77`), tous les worker files sont à jour via SCP
- Fichiers à jour sur l'instance : `worker/prompts.py`, `worker/analyze.py`, `worker/analyze_reference.py`, `worker/score_reference.py`
- **⚠️ Facturée à l'heure — stopper dès que possible si plus utilisée**

---

## R-Phase 7 — Phase 3 : bilan (2026-06-08)

### Score final : 211/384 = 54% (-1 pt vs Phase 2)

| Cause | Constat | Enseignement |
|---|---|---|
| `has_value("N/A")` | bool("N/A")=True → déjà True avant le fix. La vraie valeur en DB est `None`, pas "N/A" | Le LLM retourne `not_mentioned` pour fr_047 COI — fix requis dans prompts.py |
| Re-run identity (8 arrêts) | 341949/341951/341963 inchangés (Sexe/Ethnie absents du texte) | Ne jamais relancer sur tous les arrêts — cibler par `--arret-id` |
| 342046 identity NL | 7→6/11 (Geboorteplaats "Jerevan" perdu), LLM déterministe, non récupérable par re-run | Regex injection NL ou prompt amélioré nécessaire |

### Fichiers modifiés (session 2026-06-08 R-Phase 7 Phase 3)

| Fichier | Changement |
|---|---|
| `worker/score_reference.py` | Fix `has_value()` : check explicite `vt == "N/A"` avant `bool(vt)` (robustesse) |
| `PROJECT_STATE.md` | Mise à jour bilan Phase 3, gaps, prochaine action |

### Commits pushés

| Hash | Contenu |
|---|---|
| `7fbe07f` | fix(worker): R-Phase 7 Phase 3 — has_value() check explicite "N/A" |
| `c9cbb66` | chore: PROJECT_STATE Phase 3 — score 211/384=54%, gaps docs+identity NL |

---

## R-Phase 8 — Bilan (2026-06-08)

### Score final : 214/384 = 55% (+3 pts vs 211)

| Fix | Résultat | Points gagnés |
|---|---|---|
| `evidence_documents` group_note non-DPI → force `not_applicable`+`N/A` | 341949/341951/341963 COI = N/A ✅ | +3 pts |
| `_inject_regex_identity_nl()` Geboorteplaats 342046 | LLM a trouvé Jerevan seul ce run, injection skippée. Net 0 (autre critère perdu) | 0 pt |

### Scores par arrêt après R-Phase 8

| Arrêt | Type | Score | Méta | Ident | Décis | Profil | Perséc | Docs |
|---|---|---|---|---|---|---|---|---|
| CCE 341946 (DPI Burundi) | DPI | 29/48 = **60%** | 6/7 85% | 5/9 55% | 4/8 50% | 12/15 80% | 1/2 50% | 1/1 100% |
| CCE 341949 (OQT) | non-DPI | 27/48 = **56%** | 6/7 85% | 3/9 33% | 7/8 87% | 6/15 40% | 2/2 100% | 1/1 100% |
| CCE 341951 (9bis) | non-DPI | 28/48 = **58%** | 5/7 71% | 2/9 22% | 8/8 100% | 8/15 53% | 2/2 100% | 1/1 100% |
| CCE 341960 (DPI Guinée) | DPI | 24/48 = **50%** | 6/7 85% | 4/9 44% | 4/8 50% | 8/15 53% | 1/2 50% | 1/1 100% |
| CCE 341962 (DPI Sénégal) | DPI | 29/48 = **60%** | 6/7 85% | 7/9 77% | 4/8 50% | 8/15 53% | 1/2 50% | 1/1 100% |
| CCE 341963 (OQT étudiant) | non-DPI | 25/48 = **52%** | 5/7 71% | 2/9 22% | 3/8 37% | 10/15 66% | 2/2 100% | 1/1 100% |
| RvV 342046 (DPI NL Russie) | DPI | 23/48 = **47%** | 6/7 85% | 6/11 54% | 5/9 55% | 5/13 38% | 0/1 0% | 1/1 100% |
| RvV 342062 (Dublin NL) | non-DPI | 29/48 = **60%** | 6/7 85% | 7/11 63% | 8/9 88% | 5/13 38% | 1/1 100% | 1/1 100% |
| **TOTAL** | | **214/384 = 55%** | | | | | | |

### Fichiers modifiés (session 2026-06-08 R-Phase 8)

| Fichier | Changement |
|---|---|
| `worker/prompts.py` | `group_note` evidence_documents conditionnel : non-DPI → "RÈGLE ABSOLUE — force not_applicable+N/A" ; DPI/unknown → note COI standard |
| `worker/analyze.py` | `import re` module-level ; `_RE_GEBOREN_IN` + `_GEBOORTEPLAATS_SLUG_PART` ; `_inject_regex_identity_nl()` : regex "geboren [...] in <Ville>" → injecte Geboorteplaats si LLM manqué ; appel dans boucle pour `group=identity` + `language=nl` ; suppression `import re as _re` local dans `_inject_regex_metadata` |

### Commits pushés

| Hash | Contenu |
|---|---|
| `41f59a4` | fix(worker): R-Phase 8 — evidence_documents not_applicable non-DPI + Geboorteplaats regex injection NL |

### Décisions

- **group_note evidence_documents conditionnel** : quand `procedure_type` est confirmé non-DPI (`sejour_visa_regroupement`, etc.), le group_note surcharge explicitement avec "RÈGLE ABSOLUE — not_applicable obligatoire". Cumulé avec le proc_note existant → double instruction LLM.
- **_inject_regex_identity_nl** : filet de sécurité pour Geboorteplaats NL. S'applique uniquement si le LLM retourne absent/vide. N'écrase PAS une valeur `status=found` du LLM.
- **Geboorteplaats dans le header 342046** : le texte "geboren op [<redacted>]1976 in Jerevan" est dans la section `header` (pas `motivering_cgvs_of_dv`). La regex matche correctement sur ce texte.
- **Re-run 342046 identity net 0** : le LLM a trouvé Jerevan (nl_014 = "Jerevan, Armenië; Moskou, Rusland", conf=0.95) mais perdu un autre critère simultanément (non-déterminisme). Ne pas re-run à nouveau — risque de nouvelle régression.
- **procedure_type des 3 non-DPI confirmé** : `sejour_visa_regroupement` en base → le branch non-DPI du group_note se déclenche correctement.

### Gaps résiduels après R-Phase 8

| Gap | Arrêts touchés | Impact estimé | Piste |
|---|---|---|---|
| profile_vulnerability NL | 342046=5/13, 342062=5/13 | +4 pts | Critères gender-specific NL (VGV/mariage/etc.) partiellement capturés |
| identity arrêts 3-sections | 341949=3/9, 341951=2/9, 341963=2/9 | ~2 pts | Sexe/Ethnie absents du texte — gain structurellement limité |
| Juge NL sans nom complet | 342046/342062 = "wnd. voorzitter" | ~2 pts | Fallback regex nom propre après titre |
| DPI score moyen ~54% | 341946=60%, 341960=50%, 341962=60%, 342046=47% | ~10 pts → 65% | Gaps decision_reasoning + persecution_claims |
| `type_decision` non extrait | Tous | UI donut vide | Regex sur dispositif + update arrets.type_decision |
| `resume_ai` non généré | Tous | UI Résumé IA vide | Nouveau groupe "summary" dans analyze.py |

### Seuils de validation avocate

| Critère | Seuil | Valeur actuelle | État |
|---|---|---|---|
| Score global | ≥ 60% | 55% (214/384) | ❌ |
| DPI (341946, 341960, 341962, 342046) | ≥ 65% | ~54% moyen | ❌ |
| Metadata (fr/nl 001-005) | ≥ 90% | ~82% | ❌ |
| Motivation CCE non vide sur DPI | ≥ 3/4 | 4/4 | ✅ |

---

## R-Phase 10 — Bilan (2026-06-08)

### Résultats

- **50 nouveaux arrêts FR** scrapés (CCE 341802–341925), extraits (50/50 OK), analysés (50/50 OK, 48 valeurs/arrêt)
- **Instance Vast.ai** : 2× A100-SXM4-80GB, CUDA 13.2, vLLM 0.11.2, `--tensor-parallel-size 2` — modèle chargé en ~80s, analyse en ~25 min
- **Score référence post-analyse** : 211/384 = 54% (régression -3 pts LLM non-déterministe sur 341951 decision et 342062 decision)
- **Total base** : 108 arrêts analysés (85 FR + 23 NL)

### Commande vLLM validée (2× A100 SXM4 80 Go, CUDA 13.2)

```bash
nohup .venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ \
  --port 8000 --dtype auto \
  --max-model-len 16384 --gpu-memory-utilization 0.92 \
  --trust-remote-code --enforce-eager \
  --tensor-parallel-size 2 \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &
```

### Fichiers modifiés (session 2026-06-08 R-Phase 10 + UI)

| Fichier | Changement |
|---|---|
| `src/components/icons.tsx` | `IconClipboard` ajouté (icône presse-papier pour Validation) |
| `src/components/Sidebar.tsx` | `{ href: "/validation", label: "Validation", Icon: IconClipboard }` ajouté en tête de `adminNav` |
| `src/components/BottomNav.tsx` | Prop `userRole?: string` ; pour admin/avocat : "Validation" remplace "Focus" (grisé) en 4e position |
| `src/app/(app)/layout.tsx` | `<BottomNav userRole={userRole} />` — `userRole` passé en prop |

### Nouveaux fichiers temporaires (à supprimer)

| Fichier | Rôle |
|---|---|
| `worker/_check_roles.py` | Liste les rôles des profils en base |
| `worker/_set_admin.py` | Met à jour le rôle d'un utilisateur |

### Décisions ajoutées

- **`--tensor-parallel-size 2`** : validé sur 2× A100-SXM4-80GB (CUDA 13.2). Divise le temps d'analyse par ~2 vs 1× GPU. À utiliser systématiquement si l'instance a ≥ 2 GPUs.
- **Onglet Validation dans la sidebar** : visible uniquement pour `admin` et `avocat` (section Admin). Sur mobile, remplace "Focus" (grisé) dans le BottomNav.
- **Rôles Supabase mis à jour** : `kdoucenet@gmail.com` → `admin` ; `test@dimagin.studio` → `avocat`. La policy RLS `acv_update` (migration 005) autorise déjà ces deux rôles à écrire `validation_status` + `validation_note`.
- **Score référence légèrement régressé** (214→211) : LLM non-déterministe sur decision_reasoning de 341951 et 342062. Les valeurs de référence ne sont PAS été re-purgées — la régression vient d'un re-run accidentel de ces arrêts lors de l'analyse batch R-Phase 10 (arrêts probablement re-sélectionnés comme "pending" pour une raison inconnue). Ne pas re-analyser sans changement de prompt.

---

## Prochaine action exacte

**R-Phase 12 — Surveiller batch → score → détruire instance**

### Contexte R-Phase 12 (2026-06-09, session en cours)

Instance Vast.ai **40250378 ACTIVE** (ssh8.vast.ai:10378, A100 SXM4 80Go, ~1.09 $/h).
vLLM PID 4261 actif : `MaziyarPanahi/Mixtral-8x22B-Instruct-v0.1-AWQ`, `max_model_len=16384`.
Commit `eab41c6` pushé (fix llm_provider Mixtral + analyze.py + prompts.py).

**Décisions prises (2026-06-09) :**
- Fulltext mode abandonné : Mixtral ignore les `criterion_id` longs et invente des noms courts, même avec prefilling.
- **Mode 7-groupes validé** : guided_json + Mixtral → 48 valeurs/arrêt non-null, criterion_ids corrects.
- Batch lancé : `analyze.py --limit 100` (PID 5950 sur l'instance), log : `/workspace/saas-juridique/logs/batch_main.log`.
- 5 arrêts test déjà analysés et stockés (2 NL + 3 FR, 35-48 valeurs).

**Améliorations `llm_provider.py` (commit `eab41c6`) :**
- Merge Mixtral system→user intégré nativement (plus besoin de `_patch_mixtral.py`)
- `prefill` et `max_tokens` params ajoutés à `VLLMProvider.complete()`

### Séquence à reprendre

**Étape 1 — Vérifier si le batch est terminé**
```bash
ssh -p 10378 root@ssh8.vast.ai
grep -c 'Stocké' /workspace/saas-juridique/logs/batch_main.log
tail -10 /workspace/saas-juridique/logs/batch_main.log
ps aux | grep analyze | grep -v grep
```
Attendre que le process analyze.py soit terminé (~63 arrêts × ~3.5 min = ~3.5h depuis 16:21 UTC).

**Étape 2 — Si batch terminé : score depuis le PC Windows**
```powershell
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\python.exe score_reference.py --verbose
```
Objectif : ne pas régresser sous 216/384 = 56%.

**Étape 3 — DÉTRUIRE l'instance**
```powershell
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\vastai destroy instance 40250378
```

**Étape 4 — Commit PROJECT_STATE avec bilan R-Phase 12**

### UUIDs des 8 arrêts de référence (à ne jamais purger)

| Arrêt | UUID |
|---|---|
| CCE 341946 fr | 0fd55631-00d4-433c-b599-5fbb75692d16 |
| CCE 341949 fr | e62bfb49-8e15-45f9-95d5-2c558c2571d4 |
| CCE 341951 fr | b3adae70-1776-4c6c-846f-0d0776ae742b |
| CCE 341960 fr | 464635d4-0f8b-4b98-a408-6b5f674ac249 |
| CCE 341962 fr | 02552ae3-ae24-40ed-9918-98a5e69f0f16 |
| CCE 341963 fr | 6f490a37-224c-4b96-92e9-97b740ede7c4 |
| RvV 342046 nl | 08e588e6-62dc-4c41-adc8-d0fd5dd965e6 |
| RvV 342062 nl | ff586b0e-0ca2-4c40-b3ca-f0dac25811d8 |

---

### Prompt de reprise (autosuffisant — à coller après /clear)

```
R-Phase 10 terminée (2026-06-08). Score référence : 211/384 = 54%. Dernier commit : `4bc2463` (main). Instance Vast.ai détruite.

État base : 108 arrêts analysés (85 FR + 23 NL), tous avec prompts R-Phase 8.
15 arrêts fictifs seed (CCE 260.001–015) ignorés. UI Validation commitée.
Rôles : kdoucenet@gmail.com = admin, test@dimagin.studio = avocat.

VASTAI : CLI installée dans worker/.venv, clé configurée (~/.config/vastai/vast_api_key + .env.local).
RÈGLE PRIX : max 2,50 $/h, viser toujours le moins cher. Balance compte : ~15 $ (après R-Phase 10 ~0,50 $).

OBJECTIF R-Phase 11 : scraper 50 nouveaux arrêts FR + s'assurer qu'il y a au moins 50 arrêts avec valeurs LLM à analyser.

SÉQUENCE AUTONOME (Claude fait tout) :
1. Scraper 50 nouveaux FR localement :
   cd C:\Projects\saas-juridique-cce-rvv\worker
   $env:PYTHONIOENCODING="utf-8"; .\.venv\Scripts\python.exe scraper.py --lang fr --limit 50
2. Extraire les PDF localement :
   .\.venv\Scripts\python.exe main.py --limit 50
3. Vérifier combien d'arrêts sont sans valeurs LLM (pending) → si < 50, scraper à nouveau
4. Louer instance Vast.ai via CLI (max 2,50 $/h, chercher le moins cher) :
   .venv\Scripts\vastai search offers "gpu_name=A100_SXM4 num_gpus=2 gpu_ram>=79 dph_total<=2.5 cuda_vers>=12.6 disk_space>=80" --order dph_total
   .venv\Scripts\vastai create instance <ID> --image pytorch/pytorch --disk 80
5. Attendre que l'instance soit Running → récupérer SSH
6. Git clone + pip install + .env.local + vLLM + analyze.py --limit 50 --concurrency 4
7. score_reference.py (ne pas régresser 211/384)
8. Détruire l'instance : .venv\Scripts\vastai destroy instance <ID>

COMMANDE vLLM validée (2× A100 SXM4, CUDA ≥ 12.6) :
nohup .venv/bin/python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-72B-Instruct-AWQ --port 8000 --dtype auto --max-model-len 16384 --gpu-memory-utilization 0.92 --trust-remote-code --enforce-eager --tensor-parallel-size 2 > /workspace/saas-juridique/logs/vllm.log 2>&1 &

.env.local à créer sur l'instance :
NEXT_PUBLIC_SUPABASE_URL=https://kuwhvnyvughydcqzjrby.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1d2h2bnl2dWdoeWRjcXpqcmJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwNjAyNywiZXhwIjoyMDk1ODgyMDI3fQ.c8pnDRQTBTAGEzgELoqwU8v8RSIkXcC8k4Sj9aj-Qlo
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct-AWQ
LLM_MAX_OUTPUT_TOKENS=4096
LLM_TIMEOUT_SECONDS=240
LLM_MAX_INPUT_CHARS=32000

RÈGLES ABSOLUES :
- Ne PAS modifier worker/prompts.py ni worker/analyze.py sans validation du score référence
- Ne PAS lancer analyze_reference.py (régression non-déterministe)
- Ne PAS purger les 8 UUIDs de référence (voir PROJECT_STATE.md)
- Ne PAS dépasser 160 arrêts analysés au total avant retour avocate
- Vast.ai : max 2,50 $/h, toujours chercher le moins cher, détruire dès que l'analyse est terminée
```

---

## ~~R-Phase 9~~ — Terminée (2026-06-08)

### Résultats

- **42 arrêts non-référence** re-analysés avec prompts R-Phase 8 (vieilles valeurs R-Phase 3/4 purgées)
- **8 nouveaux arrêts** scrapés (5 FR OQT urgence + 3 NL DPI fond), extraits, analysés (49-51 valeurs/arrêt)
- **Total : 58 arrêts analysés** en base (35 FR + 23 NL)
- **Score référence : 214/384 = 55% — aucune régression**
- **Instance Vast.ai détruite** après la session

---

## R-Phase 9 — Plan initial (archivé)

**R-Phase 9 — Préparer 50 arrêts pour validation avocate (instance Vast.ai active)**

### Contexte

Score R-Phase 8 : **214/384 = 55%**. Instance Vast.ai active (`ssh -p 18823 root@202.122.49.242`, vLLM PID 8709, ~2€/h).

**Objectif :** avoir **50 arrêts non-référence analysés** avec le worker R-Phase 8 (prompts à jour), en plus des 8 arrêts de référence déjà frais.

**État actuel en base (vérifié 2026-06-08) :**
- 50 arrêts totaux, tous statut=termine
- 8 arrêts de référence → analysés avec R-Phase 5-8 (frais ✓)
- **42 arrêts non-référence** (24 FR + 18 NL) :
  - 25 ont des valeurs LLM avec les VIEUX prompts (R-Phase 3/4 — qualité inférieure)
  - 17 n'ont aucune valeur LLM
  - → tous doivent être (re-)analysés avec les prompts R-Phase 8
- **8 nouveaux arrêts à scraper** pour atteindre 50 non-référence

### Séquence exacte à exécuter (sans modifier le worker)

**Étape 1 — Vérifier vLLM actif**
```bash
ssh -p 18823 root@202.122.49.242
ps aux | grep vllm | grep -v grep
# Doit afficher vllm.entrypoints.openai.api_server (PID ~8709)
# Si mort → relancer (voir commande R-Phase 4 dans ce fichier)
```

**Étape 2 — Purger les vieilles valeurs des 25 non-référence déjà analysés**

Les 8 UUIDs de référence à NE PAS toucher :
```
0fd55631-00d4-433c-b599-5fbb75692d16  CCE 341946
e62bfb49-8e15-45f9-95d5-2c558c2571d4  CCE 341949
b3adae70-1776-4c6c-846f-0d0776ae742b  CCE 341951
464635d4-0f8b-4b98-a408-6b5f674ac249  CCE 341960
02552ae3-ae24-40ed-9918-98a5e69f0f16  CCE 341962
6f490a37-224c-4b96-92e9-97b740ede7c4  CCE 341963
08e588e6-62dc-4c41-adc8-d0fd5dd965e6  RvV 342046
ff586b0e-0ca2-4c40-b3ca-f0dac25811d8  RvV 342062
```

```bash
cd /workspace/saas-juridique/worker
PYTHONIOENCODING=utf-8 .venv/bin/python - << 'PYEOF'
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path("..") / ".env.local")
from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

REFERENCE_IDS = {
    "0fd55631-00d4-433c-b599-5fbb75692d16",
    "e62bfb49-8e15-45f9-95d5-2c558c2571d4",
    "b3adae70-1776-4c6c-846f-0d0776ae742b",
    "464635d4-0f8b-4b98-a408-6b5f674ac249",
    "02552ae3-ae24-40ed-9918-98a5e69f0f16",
    "6f490a37-224c-4b96-92e9-97b740ede7c4",
    "08e588e6-62dc-4c41-adc8-d0fd5dd965e6",
    "ff586b0e-0ca2-4c40-b3ca-f0dac25811d8",
}

r = sb.table("arrets").select("id,numero").eq("statut_traitement","termine").execute()
non_ref_ids = [a["id"] for a in r.data if a["id"] not in REFERENCE_IDS]
print(f"Arrêts non-référence à purger : {len(non_ref_ids)}")

# Purger par blocs de 50
for i in range(0, len(non_ref_ids), 50):
    batch = non_ref_ids[i:i+50]
    sb.table("arret_criteria_values").delete().in_("arret_id", batch).execute()
    sb.table("model_runs").delete().in_("arret_id", batch).execute()
    print(f"  Purgé bloc {i//50+1} ({len(batch)} arrêts)")

print("Purge terminée. 8 arrêts de référence préservés.")
PYEOF
```

**Étape 3 — Re-analyser les 42 non-référence existants**
```bash
# Vérifier que les 42 n'ont plus de valeurs
PYTHONIOENCODING=utf-8 .venv/bin/python - << 'PYEOF'
import os; from pathlib import Path; from dotenv import load_dotenv
load_dotenv(Path("..") / ".env.local")
from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
r = sb.table("arrets").select("id").eq("statut_traitement","termine").execute()
tot = len(r.data)
done = sb.table("arret_criteria_values").select("arret_id").limit(5000).execute()
done_ids = {d["arret_id"] for d in done.data}
pending = [a for a in r.data if a["id"] not in done_ids]
print(f"Total arrêts termine : {tot} | Avec valeurs : {len(done_ids)} | À analyser : {len(pending)}")
PYEOF

# Lancer en batch avec concurrence 4 (A100 peut gérer 4 arrêts en parallèle)
nohup .venv/bin/python analyze.py --limit 50 --concurrency 4 \
  > /workspace/saas-juridique/logs/analyze_batch_rp9.log 2>&1 &
echo "PID: $!"
tail -f /workspace/saas-juridique/logs/analyze_batch_rp9.log
```

**Étape 4 — Scraper 8 nouveaux arrêts (pour atteindre 50 non-référence)**
```bash
# Après que les 42 soient analysés :
# Scraper 5 nouveaux FR + 3 nouveaux NL
PYTHONIOENCODING=utf-8 .venv/bin/python scraper.py --lang fr --limit 5
PYTHONIOENCODING=utf-8 .venv/bin/python scraper.py --lang nl --limit 3

# Extraire les PDF des nouveaux
PYTHONIOENCODING=utf-8 .venv/bin/python main.py --limit 8

# Analyser les nouveaux
PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --limit 8 --concurrency 4
```

**Étape 5 — Vérification finale + rapport**
```bash
PYTHONIOENCODING=utf-8 .venv/bin/python - << 'PYEOF'
import os; from pathlib import Path; from dotenv import load_dotenv
load_dotenv(Path("..") / ".env.local")
from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
r = sb.table("arrets").select("id,numero,langue,statut_traitement").order("numero").execute()
done = sb.table("arret_criteria_values").select("arret_id").limit(10000).execute()
done_ids = {d["arret_id"] for d in done.data}
analyse_ok = [a for a in r.data if a["id"] in done_ids]
print(f"Arrêts totaux : {len(r.data)}")
print(f"Arrêts analysés : {len(analyse_ok)}")
print(f"FR analysés : {sum(1 for a in analyse_ok if a['langue']=='fr')}")
print(f"NL analysés : {sum(1 for a in analyse_ok if a['langue']=='nl')}")
PYEOF

# Lancer le score de référence pour vérifier qu'on n'a pas régressé
PYTHONIOENCODING=utf-8 .venv/bin/python score_reference.py
```

**Étape 6 — Stopper l'instance Vast.ai**
- Aller sur https://vast.ai → instances → Destroy (ou Stop si on veut garder le disque)

### Durée estimée

| Étape | Durée estimée |
|---|---|
| Purge vieilles valeurs | ~1 min |
| Re-analyser 42 arrêts (concurrence 4) | ~35-45 min |
| Scraper 8 nouveaux | ~3 min |
| Extraire 8 PDF (main.py) | ~10-15 min |
| Analyser 8 nouveaux | ~7 min |
| **Total** | **~60 min (~2€ sur Vast.ai)** |

### ⚠️ Règles absolues pour cette session

- **Ne PAS modifier** `worker/prompts.py`, `worker/analyze.py` ni aucun autre fichier worker
- **Ne PAS toucher** aux 8 arrêts de référence (ne pas purger leurs valeurs)
- **Ne PAS lancer** `analyze_reference.py` (risque de régression sur les 8 référence)
- Toujours utiliser SCP si un fichier local doit être transféré (git stale à `d880f77`)
- Stopper l'instance Vast.ai après la session

### Prompt de reprise (autosuffisant — à coller après /clear)

```
R-Phase 8 terminée (2026-06-08). Score référence : 214/384 = 55%. Commit `41f59a4` pushé (main).

Instance Vast.ai ACTIVE : ssh -p 18823 root@202.122.49.242 (A100-SXM4-80GB, vLLM PID 8709 — vérifier d'abord).
Worker sur instance : git stale d880f77 + SCP prompts.py+analyze.py R-Phase 8. Ne PAS git pull, toujours SCP.

OBJECTIF SESSION : re-analyser les 42 arrêts non-référence avec les prompts R-Phase 8 + scraper 8 nouveaux pour avoir 50 arrêts non-référence analysés pour l'avocate. NE PAS modifier le worker.

ÉTAT BASE :
- 50 arrêts totaux (statut=termine), dont 8 arrêts de référence (valeurs fraîches à NE PAS toucher)
- 42 non-référence : 25 avec vieilles valeurs (R-Phase 3/4), 17 sans valeurs → purger les 25 + analyser les 42
- 8 nouveaux arrêts à scraper (5 FR + 3 NL) pour atteindre 50 non-référence

SÉQUENCE EXACTE (sans modifier le worker) :
1. Vérifier vLLM actif : ssh -p 18823 root@202.122.49.242 && ps aux | grep vllm
2. Purger valeurs non-référence (script Python en ligne — voir PROJECT_STATE.md section "Prochaine action exacte")
3. Re-analyser 42 : analyze.py --limit 50 --concurrency 4 (nohup, ~40 min)
4. Scraper 8 nouveaux : scraper.py --lang fr --limit 5 && scraper.py --lang nl --limit 3
5. Extraire + analyser les 8 : main.py --limit 8 && analyze.py --limit 8 --concurrency 4
6. Vérification + score_reference.py (ne pas régresser les 8 référence)
7. Stopper l'instance Vast.ai

UUIDs de référence (NE PAS purger) :
341946→0fd55631, 341949→e62bfb49, 341951→b3adae70, 341960→464635d4
341962→02552ae3, 341963→6f490a37, 342046→08e588e6, 342062→ff586b0e

Commande vLLM si morte :
nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-72B-Instruct-AWQ --port 8000 --dtype auto --max-model-len 16384 --gpu-memory-utilization 0.92 --trust-remote-code --enforce-eager > /workspace/saas-juridique/logs/vllm.log 2>&1 &
```

### Score R-Phase 7 Phase 3 (2026-06-08) — score final après re-run identity

| Arrêt | Type | Score | Méta | Ident | Décis | Profil | Perséc | Docs |
|---|---|---|---|---|---|---|---|---|
| CCE 341946 (DPI Burundi) | DPI | 29/48 = **60%** | 6/7 85% | 5/9 55% | 4/8 50% | 12/15 80% | 1/2 50% | 1/1 100% |
| CCE 341949 (OQT) | non-DPI | 26/48 = **54%** | 6/7 85% | 3/9 33% | 7/8 87% | 6/15 40% | 2/2 100% | 0/1 0%† |
| CCE 341951 (9bis) | non-DPI | 27/48 = **56%** | 5/7 71% | 2/9 22% | 8/8 100% | 8/15 53% | 2/2 100% | 0/1 0%† |
| CCE 341960 (DPI Guinée) | DPI | 24/48 = **50%** | 6/7 85% | 4/9 44% | 4/8 50% | 8/15 53% | 1/2 50% | 1/1 100% |
| CCE 341962 (DPI Sénégal) | DPI | 29/48 = **60%** | 6/7 85% | 7/9 77% | 4/8 50% | 8/15 53% | 1/2 50% | 1/1 100% |
| CCE 341963 (OQT étudiant) | non-DPI | 24/48 = **50%** | 5/7 71% | 2/9 22% | 3/8 37% | 10/15 66% | 2/2 100% | 0/1 0%† |
| RvV 342046 (DPI NL Russie) | DPI | 23/48 = **47%** | 6/7 85% | 6/11 54%‡ | 5/9 55% | 5/13 38% | 0/1 0% | 1/1 100% |
| RvV 342062 (Dublin NL) | non-DPI | 29/48 = **60%** | 6/7 85% | 7/11 63% | 8/9 88% | 5/13 38% | 1/1 100% | 1/1 100% |
| **TOTAL** | | **211/384 = 54%** | | | | | | |

† `value_text=None` en base (LLM retourne `not_mentioned` pour fr_047 COI malgré la guidance). Nécessite fix analyze.py ou prompts.py.
‡ Régression 7→6 suite au re-run identity masse (LLM déterministe). Geboorteplaats "Jerevan" perdu.

### Gaps résiduels prioritaires (après Phase 3)

| Gap | Arrêts touchés | Impact estimé | Piste |
|---|---|---|---|
| docs non-DPI : fr_047 = NULL | 341949, 341951, 341963 | +3 pts → 57% | Renforcer guidance prompts.py evidence_documents group_note |
| 342046 identity NL régression | 342046 | +1 pt → 55% | Regex injection Geboorteplaats NL |
| profile_vulnerability NL | 342046=5/13 | ~4 pts | Critères gender-specific NL partiellement capturés |
| Metadata ≥ 90% | Juge NL = "wnd. voorzitter" sans nom (342046/342062) | ~2 pts | Fallback regex juge NL |
| identity arrêts 3-sections | 341949=3/9, 341951=2/9, 341963=2/9 | ~1-2 pts | Sexe/Ethnie absents du texte → gain limité |

### Seuils de validation avocate

| Critère | Seuil | Valeur actuelle | État |
|---|---|---|---|
| Score global | ≥ 56% | 54% (211/384) | ❌ |
| DPI (341946, 341960, 341962, 342046) | ≥ 65% | ~52% moyen | ❌ |
| Metadata (fr/nl 001-005) | ≥ 90% | ~82% | ❌ |
| Motivation CCE non vide sur DPI | ≥ 3/4 | 4/4 | ✅ |
| profile_vulnerability DPI | ≥ 13/15 | 341946=12/15 | ⚠️ Proche |

### Instance Vast.ai (TOUJOURS ACTIVE)

- **SSH** : `ssh -p 18823 root@202.122.49.242`
- **GPU** : A100-SXM4-80GB, CUDA 13.1, vLLM actif (PID 8709)
- **Repo** : `/workspace/saas-juridique` — git à `d880f77` (ancien), fichiers worker à jour via SCP
- **⚠️ Instance facturée à l'heure — stopper sur vast.ai après la prochaine session**

### Diagnostic des gaps (pour atteindre 90%)

**Score actuel : 131/384 = 34%**

| Gap | Impact estimé | Cause probable | Piste |
|---|---|---|---|
| Non-DPI : critères DPI marqués ABSENT | ~80 pts | LLM retourne `not_applicable` sans valeur → `has_value=False` | Compter not_applicable comme "couvert" dans score_reference.py |
| `profile_vulnerability` DPI : 9/15 (était 14/15 en R-Phase 3) | ~20 pts | Retrait prefilling → LLM utilise status=not_applicable pour les critères gender-specific d'un requérant homme | Vérifier audit_arret.py 341946, groupe profile_vulnerability |
| `persecution_claims` Art. 48/7 : 0/2 | ~16 pts | Groupe `persecution_claims` avec sections correctes ? | Vérifier GROUP_SECTIONS["persecution_claims"] dans prompts.py |
| `evidence_documents` COI : 0/1 sur 7/8 | ~7 pts | fr_047 dans groupe evidence_documents, section acte_attaque en première position (fix Phase 3) | Relancer dry-run un arrêt DPI sur ce groupe |

### Plan Phase 5 — séquence d'investigation

**Étape 1 — Vérifier/relancer vLLM**
```bash
ssh -p 18823 root@202.122.49.242
ps aux | grep VLLM  # vérifier EngineCore vivant
# Si mort → relancer :
nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ \
  --port 8000 --dtype auto --max-model-len 16384 \
  --gpu-memory-utilization 0.92 --trust-remote-code --enforce-eager \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &
# Attendre "Application startup complete" (~2 min)
```

**Étape 2 — Investiguer profile_vulnerability sur 341946**
```bash
.venv/bin/python audit_arret.py 341946 2>&1 | grep -A2 'profile_vuln\|fr_02\|fr_03'
# Identifier quels 6 critères sont vides (sur 15)
# Comparer avec R-Phase 3 : était 14/15, maintenant 9/15 après retrait prefilling
```

**Étape 3 — Dry-run persecution_claims sur 341946**
```bash
.venv/bin/python analyze.py --arret-id 0fd55631-00d4-433c-b599-5fbb75692d16 --group persecution_claims --dry-run
# Vérifier si fr_038 (Art. 48/7) est extrait
```

**Étape 4 — Dry-run evidence_documents sur 341960 (DPI)**
```bash
.venv/bin/python analyze.py --arret-id 464635d4-0f8b-4b98-a408-6b5f674ac249 --group evidence_documents --dry-run
# Vérifier fr_047 COI cités
```

**Étape 5 — Corriger score_reference.py : compter not_applicable comme couvert**
```python
# Dans has_value(), ajouter check sur status ou value stockée
# OU vérifier si les not_applicable sont réellement en DB avec value_text="not_applicable"
```

**Étape 6 — Après corrections → relancer analyze_reference.py + score**
```bash
PYTHONIOENCODING=utf-8 PYTHONUNBUFFERED=1 .venv/bin/python analyze_reference.py 2>&1 | tee logs/analyze_reference_v2.log
.venv/bin/python score_reference.py --verbose
```

### UUIDs des 8 arrêts de référence

| Arrêt | UUID |
|---|---|
| CCE 341946 fr | 0fd55631-00d4-433c-b599-5fbb75692d16 |
| CCE 341949 fr | e62bfb49-8e15-45f9-95d5-2c558c2571d4 |
| CCE 341951 fr | b3adae70-1776-4c6c-846f-0d0776ae742b |
| CCE 341960 fr | 464635d4-0f8b-4b98-a408-6b5f674ac249 |
| CCE 341962 fr | 02552ae3-ae24-40ed-9918-98a5e69f0f16 |
| CCE 341963 fr | 6f490a37-224c-4b96-92e9-97b740ede7c4 |
| RvV 342046 nl | 08e588e6-62dc-4c41-adc8-d0fd5dd965e6 |
| RvV 342062 nl | ff586b0e-0ca2-4c40-b3ca-f0dac25811d8 |

### Points de vigilance Phase 5

- **Commits locaux non pushés** → toujours utiliser SCP pour transférer les fichiers modifiés vers l'instance
- **`kill -9 vLLM`** ne suffit pas — tuer aussi `VLLM::EngineCore` (ps aux | grep VLLM) sinon GPU reste occupé
- **`has_value` dans score_reference.py** peut sous-estimer le score réel si not_applicable ≠ NULL en DB
- **profile_vulnerability regression** : R-Phase 3 avait 14/15 (avec prefilling), R-Phase 5 Phase 4 a 9/15 (sans prefilling + max-model-len 16384) — le retrait du prefilling peut avoir changé la structure de réponse
- **Objectif avocate** : ≥ 90% global (346/384) — ne pas envoyer avant ce seuil

---

## R-Phase 5 — Phase 4 — Bilan (2026-06-07)

### Résultats analyse 72B Phase 4 (corrections Phase 3 appliquées)

| Arrêt | Total | Méta | Ident | Décis | Profil | Perséc | Docs |
|---|---|---|---|---|---|---|---|
| CCE 341946 (DPI) | 26/48 54% | 6/7 85% | 5/9 55% | 4/8 50% | 9/15 60% | 1/2 50% | 1/1 100% |
| CCE 341949 (non-DPI) | 8/48 16% | 6/7 85% | 2/9 22% | 0/8 0% | 0/15 0% | 0/2 0% | 0/1 0% |
| CCE 341951 (non-DPI) | 8/48 16% | 5/7 71% | 1/9 11% | 0/8 0% | 2/15 13% | 0/2 0% | 0/1 0% |
| CCE 341960 (DPI) | 18/48 37% | 6/7 85% | 4/9 44% | 4/8 50% | 4/15 26% | 0/2 0% | 0/1 0% |
| CCE 341962 (DPI) | 24/48 50% | 6/7 85% | 7/9 77% | 4/8 50% | 5/15 33% | 0/2 0% | 0/1 0% |
| CCE 341963 (non-DPI) | 10/48 20% | 5/7 71% | 1/9 11% | 0/8 0% | 4/15 26% | 0/2 0% | 0/1 0% |
| RvV 342046 (DPI NL) | 21/48 43% | 6/7 85% | 7/11 63% | 5/9 55% | 3/13 23% | 0/1 0% | 0/1 0% |
| RvV 342062 (non-DPI NL) | 16/48 33% | 6/7 85% | 4/11 36% | 3/9 33% | 2/13 15% | 0/1 0% | 0/1 0% |
| **TOTAL** | **131/384 34%** | | | | | | |

### Ce qui a été amélioré vs baseline Phase 3 (120/384 = 31%)

| Améliorations | Détail |
|---|---|
| Juge NL | V. HOEFNAGELS / V. SERBRUYNS ✅ (était "wnd. voorzitter") |
| Motivation CCE/RvV | Remplie sur 4/4 DPI (était 0/8 avant Fix 2) |
| Crédibilité | Remplie sur 341946, 341960, 341962, 342046 |
| Nationalité | Burundaise / Guinéenne / Sénégalaise / Russe / Afghane ✅ |
| 342046 NL | 12→21 valeurs (+75%) — identity 0→7/11 |

### Seuils de validation avocate

| Critère | Seuil | Valeur | État |
|---|---|---|---|
| Couverture DPI (341946, 341960, 341962, 342046) | ≥ 65% | 46% | ❌ |
| Metadata | ≥ 90% | 85% | ❌ |
| Motivation CCE ≥ 2/4 DPI | ≥ 2/4 | 4/4 | ✅ |
| profile_vulnerability DPI | ≥ 13/15 | 9/15 | ❌ |

### Fixes techniques appliqués en Phase 4

| Fix | Fichier | Problème | Solution |
|---|---|---|---|
| prefilling retiré | `worker/llm_provider.py` | `{"items":[` + `guided_json` → 400 Bad Request vLLM | Supprimer le message assistant prefillé (guided_json seul suffit) |
| max-model-len 16384 | config vLLM | input_tokens (6641) + max_tokens (4096) > max_model_len (8192) → 400 | Démarrer vLLM avec `--max-model-len 16384` (pas 8192) |
| IDs critères corrigés | `worker/score_reference.py` | KEY_CRITERIA utilisait fr_007/fr_021/fr_025… (décalage ~4) | Corriger avec les vrais IDs : fr_009, fr_037, fr_043… |
| EngineCore zombie | instance Vast.ai | `kill -9` laisse l'EngineCore vivant (PID 1260) → GPU occupé | `ps aux | grep VLLM` → kill explicite PID EngineCore |

### Commande vLLM validée Phase 4 (A100-SXM4-80GB, CUDA 13.2)

```bash
nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ \
  --port 8000 --dtype auto \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.92 --trust-remote-code \
  --enforce-eager \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &
```

### Score baseline Phase 4 (REMPLACE le précédent)

| Arrêt | Total | Méta | Ident | Décis | Profil | Perséc | Docs |
|---|---|---|---|---|---|---|---|
| CCE 341946 (DPI) | 29/48 60% | 5/7 71% | 6/9 66% | 3/8 37% | 14/15 93% | 1/2 50% | 0/1 0% |
| CCE 341949 (non-DPI) | 7/48 14% | 5/7 71% | 2/9 22% | 0/8 0% | 0/15 0% | 0/2 0% | 0/1 0% |
| CCE 341951 (non-DPI) | 9/48 18% | 5/7 71% | 1/9 11% | 0/8 0% | 2/15 13% | 0/2 0% | 0/1 0% |
| CCE 341960 (DPI) | 17/48 35% | 6/7 85% | 4/9 44% | 3/8 37% | 4/15 26% | 0/2 0% | 0/1 0% |
| CCE 341962 (DPI) | 23/48 47% | 6/7 85% | 7/9 77% | 3/8 37% | 5/15 33% | 0/2 0% | 0/1 0% |
| CCE 341963 (non-DPI) | 9/48 18% | 5/7 71% | 0/9 0% | 0/8 0% | 4/15 26% | 0/2 0% | 0/1 0% |
| RvV 342046 (DPI NL) | 12/48 25% | 4/7 57% | 0/11 0% | 4/9 44% | 3/13 23% | 0/1 0% | 1/1 100% |
| RvV 342062 (non-DPI NL) | 14/48 29% | 7/7 100% | 0/11 0% | 2/9 22% | 4/13 30% | 0/1 0% | 1/1 100% |
| **TOTAL** | **120/384 31%** | | | | | | |

Note : les colonnes Décis/Profil/etc. reflètent les valeurs R-Phase 4 (sans fixes Phase 3).
Après le run Vast.ai (Phase 3 appliquée) : attendre Décis ≥ 5/8 sur DPI, fr_025 non vide.

### Seuils de décision (vert = relecture avocate autorisée)

| Critère | Seuil vert |
|---|---|
| Couverture DPI (341946, 341960, 341962, 342046) | ≥ 65% moyenne |
| Metadata (fr/nl_001–005) | ≥ 90% |
| fr_025 / nl_025 Motivation CCE non vide | ≥ 2/4 arrêts DPI |
| profile_vulnerability sur DPI | ≥ 13/15 |

### UUIDs des 8 arrêts de référence

| Arrêt | UUID |
|---|---|
| CCE 341946 fr | 0fd55631-00d4-433c-b599-5fbb75692d16 |
| CCE 341949 fr | e62bfb49-8e15-45f9-95d5-2c558c2571d4 |
| CCE 341951 fr | b3adae70-1776-4c6c-846f-0d0776ae742b |
| CCE 341960 fr | 464635d4-0f8b-4b98-a408-6b5f674ac249 |
| CCE 341962 fr | 02552ae3-ae24-40ed-9918-98a5e69f0f16 |
| CCE 341963 fr | 6f490a37-224c-4b96-92e9-97b740ede7c4 |
| RvV 342046 nl | 08e588e6-62dc-4c41-adc8-d0fd5dd965e6 |
| RvV 342062 nl | ff586b0e-0ca2-4c40-b3ca-f0dac25811d8 |

### Séquence Vast.ai (à exécuter après setup utilisateur)

**Instance** : A100 PCIe/SXM4 80 Go (VRAM ≥ 79 Go), PyTorch, CUDA ≥ 12.6, disque ≥ 80 Go

```bash
# Sur l'instance (user fait git clone + .env.local)
# Claude prend la main via SSH (Bash tool) une fois SSH disponible

# 1. Install
cd /workspace/saas-juridique/worker
python -m venv .venv && .venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install "vllm>=0.9,<0.12"

# 2. vLLM (commande validée R-Phase 4)
nohup .venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ \
  --port 8000 --dtype auto --max-model-len 8192 \
  --gpu-memory-utilization 0.92 --trust-remote-code --enforce-eager \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &

# 3. Analyse (tous groupes, ~40 min)
PYTHONIOENCODING=utf-8 .venv/bin/python analyze_reference.py \
  2>&1 | tee /workspace/saas-juridique/logs/analyze_reference.log

# 4. Score
PYTHONIOENCODING=utf-8 .venv/bin/python score_reference.py --verbose

# 5. Audits
for num in 341946 341960 341962 342046 341963; do
  .venv/bin/python audit_arret.py $num > /workspace/saas-juridique/logs/audit_${num}_v2.txt
done
```

### .env.local requis sur l'instance

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct-AWQ
LLM_MAX_OUTPUT_TOKENS=4096
LLM_TIMEOUT_SECONDS=240
LLM_MAX_INPUT_CHARS=32000
```

### Points de vigilance
- Ne pas relancer `main.py --reprocess` — intermediate_json à jour en Supabase.
- `analyze_reference.py` sans `--group` = tous les groupes, sans `--dry-run` = stocke.
- Les valeurs existantes sont écrasées par upsert — pas besoin de vider avant.
- En cas d'erreur vLLM prefilling : retirer `messages.append({"role": "assistant", ...})` dans VLLMProvider.
- `score_reference.py` compare avec la DB en temps réel — lancer après la fin de l'analyse.

### Stratégie tokens (session longue autonome)
- Faire /compact après le démarrage vLLM (avant l'analyse)
- Faire /compact après la fin de l'analyse (avant l'audit)
- Lire les logs SSH par tranches (Select-Object -Last 30), pas en entier

---

## Résultats dry-run metadata — VALIDÉ (2026-06-07)

| Arrêt | fr_002 numéro | fr_001 date | fr_003 juge | fr_004 avocat | fr_005 chambre |
|---|---|---|---|---|---|
| CCE 341963 (FR) | '341963' ✅ | '26 février 2026' ✅ | 'J. MAHIELS' ✅ | 'Me J. HARDY' ✅ | 'IIIème CHAMBRE' ✅ |
| CCE 341960 (FR) | '341960' ✅ | '26 février 2026' ✅ | 'R. HANGANU' ✅ | 'Me G. TEFENGANG' ✅ | 'Ve CHAMBRE' ✅ |
| CCE 341946 (FR) | '341946' ✅ | '26 février 2026' ✅ | 'M. de HEMRICOURT' ✅ | 'Me C. DESENFANS' ✅ | 'Ve CHAMBRE' ✅ |
| CCE 341951 (FR) | '341951' ✅ | '26 février 2026' ✅ | 'G. PINTIAUX' ✅ | 'Me S. DELHEZ' ✅ | 'Ière CHAMBRE' ✅ |
| CCE 341962 (FR) | '341962' ✅ | '26 février 2026' ✅ | 'C. ADAM' ✅ | 'Me F. BELLAKHDAR' ✅ | 'Xe chambre' ✅ |
| CCE 341949 (FR) | '341949' ✅ | '26 février 2026' ✅ | 'G. PINTIAUX' ✅ | 'Me A. DRUITTE' ✅ | 'Ière CHAMBRE' ✅ |
| RvV 342046 (NL) | '342046' ✅ | '27 februari 2026' ✅ | 'wnd. voorzitter' ⚠️ | None ⚠️ | 'XIde KAMER' ✅ |
| RvV 342062 (NL) | '342062' ✅ | '28 februari 2026' ✅ | 'wnd. voorzitter' ⚠️ | — | 'XIde KAMER' ✅ |

⚠️ NL : juge = titre sans nom (bug 7 partiel), avocat NL non extrait (connu). Numéros tous corrects.

### Stockage metadata — TERMINÉ (2026-06-07)
8/8 arrêts stockés (exit 0) :
341963: 7v ✅ | 341960: 5v ✅ | 341946: 7v ✅ | 341951: 7v ✅
341962: 7v ✅ | 341949: 7v ✅ | 342046: 7v ✅ | 342062: 4v ✅

---

## Résultats dry-run metadata (2026-06-07, partiels — archivé)

| Arrêt | fr_002 numéro | fr_001 date | fr_003 juge | fr_004 avocat | fr_005 chambre |
|---|---|---|---|---|---|
| CCE 341963 (FR) | '341963' ✅ | '26 février 2026' ✅ | 'J. MAHIELS' ✅ | 'Me J. HARDY' ✅ | 'IIIème CHAMBRE' ✅ |
| CCE 341960 (FR) | '341960' ✅ | '26 février 2026' ✅ | 'R. HANGANU' ✅ | 'Me G. TEFENGANG' ✅ | 'Ve CHAMBRE' ✅ |

Note : qwen3:4b timeout fréquents (Ollama local), mais le fallback regex injecte 5 valeurs correctement. Le fix `_canonical_number` est validé.

### Étape 1 — Vérifier que le dry-run metadata complet est terminé

Le process `analyze_reference.py --group metadata --dry-run` a été lancé en background le 2026-06-07.
Si le résultat n'est pas encore disponible, relancer manuellement :

```powershell
cd C:\Projects\saas-juridique-cce-rvv\worker
.venv\Scripts\activate
$env:PYTHONIOENCODING="utf-8"
python analyze_reference.py --group metadata --dry-run
```

Vérifier que tous les numéros sont corrects (341946, 341949, 341951, 341962, 342046, 342062).

### Étape 2 — Stocker metadata (si dry-run OK)

```powershell
python analyze_reference.py --group metadata
```

### Étape 3 — Tester decision_reasoning (le plus critique)

```powershell
# Dry-run sur 341946 (DPI Burundi accordé — cas idéal pour valider Motivation CCE)
python analyze.py --arret-id <uuid-341946> --group decision_reasoning --dry-run
```

Vérifier que `fr_025_motivation_du_cce` et `fr_026_conclusion_cgra_ou_oe` sont remplis (étaient vides en 8/8 avant corrections).

### Étape 4 — Tester identity (nationalité non-DPI)

```powershell
# Dry-run sur 341963 (OQT étudiant turc — nationalité attendue : turc)
python analyze.py --arret-id <uuid-341963> --group identity --dry-run
```

### Étape 5 — Si tous les groupes OK : régénérer les audits v2

```powershell
python audit_arret.py 341946 | Out-File -Encoding utf8 audit_341946_v2.txt
python audit_arret.py 341963 | Out-File -Encoding utf8 audit_341963_v2.txt
python audit_arret.py 342046 | Out-File -Encoding utf8 audit_342046_v2.txt
python audit_arret.py 342062 | Out-File -Encoding utf8 audit_342062_v2.txt
```

Comparer les v2 avec `RESULTAT ATTENDU.md`.

### Étape 6 — Gaps restants (après validation)

- **`type_decision`** : regex sur dispositif ("annule"→annulation) dans `extract_metadata.py`
- **`resume_ai`** : nouveau groupe `"summary"` dans `prompts.py`
- **Format `fr_006`/`nl_006`** : guider le LLM vers "Arrivée : X ; DPI : Y"
- **CCE 290647** : `python scraper.py --lang fr --limit 1`

### Points de vigilance
- Ne pas relancer `main.py --reprocess` — les intermediate_json existants sont à jour.
- Les corrections de `prompts.py`/`analyze.py` s'appliquent à l'étape analyze, pas extract.
- `analyze_reference.py` ne filtre pas par numéro — traite tous les arrêts de référence en base.
- Pour un seul arrêt : `python analyze.py --arret-id <uuid> --group <group> --dry-run`

---

**R-Phase 4 — Test Qwen2.5-72B sur A100 80 Go Vast.ai (TERMINÉ)**

1. Louer instance Vast.ai : **VRAM ≥ 79 Go** (A100 SXM4 80 Go ou H100 80 Go), template PyTorch, CUDA ≥ 12.6, disque ≥ 80 Go, RAM ≥ 64 Go
2. Sur l'instance :
   ```bash
   git clone <repo> /workspace/saas-juridique
   cd /workspace/saas-juridique/worker
   python -m venv .venv
   .venv/bin/pip install --upgrade pip
   .venv/bin/pip install -r requirements.txt
   .venv/bin/pip install "vllm>=0.9,<0.12"
   # Créer .env.local à la racine avec les clés Supabase + variables LLM (voir ci-dessous)
   ```
3. Démarrer vLLM :
   ```bash
   FLASHINFER_DISABLE_VERSION_CHECK=1 \
   VLLM_ATTENTION_BACKEND=XFORMERS \
   nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server \
     --model Qwen/Qwen2.5-72B-Instruct-AWQ \
     --port 8000 --dtype auto \
     --max-model-len 8192 --gpu-memory-utilization 0.92 --trust-remote-code \
     > /workspace/saas-juridique/logs/vllm.log 2>&1 &
   ```
4. Vider les valeurs LLM en base (garder les 50 arrêts) :
   ```bash
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
5. Lancer l'analyse :
   ```bash
   PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --limit 50 --concurrency 4
   ```
6. Comparer avec R-Phase 3 : nombre d'items, hallucinations criterion_id, qualité NL, temps/arrêt

**Variables `.env.local` requises sur le serveur Vast.ai :**
```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct-AWQ
LLM_MAX_OUTPUT_TOKENS=4096
LLM_TIMEOUT_SECONDS=240
```

**Si prefilling + guided_json crée une erreur vLLM :** retirer la ligne `messages.append({"role": "assistant", "content": '{"items":['})` dans `worker/llm_provider.py` (VLLMProvider.complete, vers ligne 279).

---

## Prompt de reprise (à coller après /clear)

```
Relis CLAUDE.md et PROJECT_STATE.md pour te remettre dans le contexte.

Résumé de la session 2026-06-07 (R-Phase 5 Phase 2) :
- R-Phase 5 Phase 3 terminée : analyse comparative 8 audits vs RESULTAT ATTENDU.md.
    * 8 bugs identifiés avec causes racines (numéro incorrect, motivation CCE vide, VGV confondu…)
    * 6 corrections appliquées dans worker/prompts.py et worker/analyze.py
    * Validation dry-run sur 341963 : fr_002 retourne '341963' (était '341961') ✅
- worker/prompts.py modifié :
    * GROUP_MAX_CHARS : decision_reasoning→16 000, profile_vulnerability→10 000
    * identity : "header" en première position
    * decision_reasoning : "acte_attaque" + "conclusion_cgra_ou_oe" avant "motivation_cgra_ou_oe"
    * evidence_documents : "acte_attaque" en première position
    * SYSTEM_PROMPT : guidance not_applicable (OQT/9bis/Dublin/étudiant) + VGV + numéro d'arrêt
- worker/analyze.py modifié :
    * _inject_regex_metadata : param arret_numero, _canonical_number depuis Supabase, _ALWAYS_INJECT

Prochain objectif : R-Phase 7 Phase 3 — corriger has_value() dans score_reference.py,
re-run identity sur les arrêts faibles, puis viser ≥ 58% avant validation avocate.

IMPORTANT :
- Ne pas relancer main.py --reprocess — les intermediate_json existants sont à jour.
- Instance Vast.ai ACTIVE : ssh -p 18823 root@202.122.49.242 (vLLM PID 8709 actif).
- Tous les fichiers worker sont à jour sur l'instance via SCP (git sur instance = d880f77, stale).
- Les commits locaux (prompts.py + analyze.py) sont non pushés — à pusher avant la fin de session.
- Ne pas lancer de traitement massif (>100 arrêts) avant validation avocate.
```

## Prompt de reprise R-Phase 8

```
Relis CLAUDE.md et PROJECT_STATE.md.

R-Phase 7 Phase 3 terminée (2026-06-08) : fix has_value() + re-run identity.
Score actuel : 211/384 = 54% (régression -1 vs 212 suite re-run identity masse sur 342046).
Tous les commits sont pushés (c9cbb66). Aucun fichier local non commité.
Instance Vast.ai ACTIVE : ssh -p 18823 root@202.122.49.242 (vLLM PID 8709, A100-SXM4-80GB).

Objectif R-Phase 8 — 2 tâches prioritaires (dans cet ordre) :

1. Fix docs non-DPI — gain attendu : +3 pts → 214/384 = 56%
   Cause : LLM retourne `not_mentioned` (pas `not_applicable`) pour fr_047 COI sur OQT/9bis/341949/341951/341963.
   Fix local dans worker/prompts.py : renforcer le group_note evidence_documents pour forcer
   value="N/A" explicitement quand procedure_type = non-DPI.
   Après fix → SCP prompts.py → re-run sur les 3 arrêts UNIQUEMENT (--arret-id, pas analyze_reference) :
     ssh -p 18823 root@202.122.49.242
     cd /workspace/saas-juridique/worker
     .venv/bin/python analyze.py --arret-id e62bfb49-8e15-45f9-95d5-2c558c2571d4 --group evidence_documents
     .venv/bin/python analyze.py --arret-id b3adae70-1776-4c6c-846f-0d0776ae742b --group evidence_documents
     .venv/bin/python analyze.py --arret-id 6f490a37-224c-4b96-92e9-97b740ede7c4 --group evidence_documents
     PYTHONIOENCODING=utf-8 .venv/bin/python score_reference.py --verbose

2. Fix 342046 identity NL — gain attendu : +1 pt → 55%
   Régression : Geboorteplaats "Jerevan" perdu (LLM déterministe sur ce cas).
   Fix : ajouter regex injection Geboorteplaats dans extract_metadata.py ou _inject_regex_metadata.
   UUIDs : 342046 → 08e588e6-62dc-4c41-adc8-d0fd5dd965e6

IMPORTANT :
- Instance Vast.ai facturée (~2€/h) — stopper sur vast.ai après la session si plus utilisée.
- Ne pas relancer main.py --reprocess.
- Ne JAMAIS relancer analyze_reference.py sans --group ET sans cibler les arrêts concernés.
  Toujours utiliser analyze.py --arret-id <uuid> --group <group> pour éviter les régressions.
- Git sur l'instance est à d880f77 (stale) — toujours utiliser SCP pour transférer les fixes.
- score_reference.py est à jour sur l'instance (via SCP en Phase 3).
```

## Prompt de reprise R-Phase 12 (v2 — après fix guided_json)

```
Relis CLAUDE.md et PROJECT_STATE.md.

R-Phase 12 EN COURS (2026-06-09). Code fulltext implémenté + committé (39f3679).
Score actuel : 216/384 = 56%. Instance Vast.ai ACTIVE — à détruire dès tests terminés.

━━━ ÉTAT EXACT AU MOMENT DU CLEAR ━━━

CODE LOCAL (committé, pushé) :
  - worker/prompts.py : build_prompt_fulltext() ajoutée ✅
  - worker/analyze.py : analyze_arret_fulltext() + --fulltext flag ✅
  - worker/_patch_mixtral.py : script de patch llm_provider.py (utilitaire, ne pas commiter)

INSTANCE VAST.AI 40250378 :
  - SSH : ssh -p 10378 root@ssh8.vast.ai
  - GPU : A100 SXM4 80Go, ~1.09 $/h — COÛT EN COURS
  - vLLM PID 4261 : MaziyarPanahi/Mixtral-8x22B-Instruct-v0.1-AWQ, max_model_len=16384
  - .env.local sur instance : LLM_MAX_INPUT_CHARS=28000, LLM_MAX_OUTPUT_TOKENS=4096
  - llm_provider.py patché SUR L'INSTANCE (merge system→user pour Mixtral chat template)
    → Ce patch n'est PAS dans le repo local

BUG IDENTIFIÉ ET FIX À APPLIQUER :
  guided_json actif = Mixtral retourne status mais value=null pour tous les critères.
  Fix : dans analyze.py LOCAL, fonction analyze_arret_fulltext(), remplacer :
    response = provider.complete((system_prompt, user_prompt), json_schema=group_schema)
  par :
    response = provider.complete((system_prompt, user_prompt), json_schema=None)
  Puis : scp -P 10378 worker/analyze.py root@ssh8.vast.ai:/workspace/saas-juridique/worker/

MODÈLE AWQ : TheBloke/Mixtral-8x22B-Instruct-v0.1-AWQ n'existe pas sur HuggingFace.
  → Modèle validé : MaziyarPanahi/Mixtral-8x22B-Instruct-v0.1-AWQ (chargé et actif ✅)
  → Mixtral ne supporte pas le rôle system séparé dans son chat template.
    Fix appliqué dans llm_provider.py sur l'instance (script /tmp/_patch_mixtral.py)

DRY-RUN CCE 341946 DÉJÀ FAIT : 45 items, 89s, 10778+2230 tok — values=null (bug guided_json)

━━━ SÉQUENCE EXACTE À REPRENDRE ━━━

ÉTAPE 1 — Fix local + SCP :
  # Dans worker/analyze.py, fonction analyze_arret_fulltext() :
  # Remplacer json_schema=group_schema par json_schema=None
  # Puis :
  cd C:\Projects\saas-juridique-cce-rvv
  scp -P 10378 worker/analyze.py root@ssh8.vast.ai:/workspace/saas-juridique/worker/
  # Commiter le fix localement aussi

ÉTAPE 2 — Dry-runs sur les 5 arrêts (depuis l'instance via SSH) :
  ssh -p 10378 root@ssh8.vast.ai
  cd /workspace/saas-juridique/worker
  PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --arret-id 0fd55631-00d4-433c-b599-5fbb75692d16 --fulltext --dry-run
  PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --arret-id 464635d4-0f8b-4b98-a408-6b5f674ac249 --fulltext --dry-run
  PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --arret-id 02552ae3-ae24-40ed-9918-98a5e69f0f16 --fulltext --dry-run
  PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --arret-id 08e588e6-62dc-4c41-adc8-d0fd5dd965e6 --fulltext --dry-run
  PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --arret-id 6f490a37-224c-4b96-92e9-97b740ede7c4 --fulltext --dry-run
  # Vérifier que value n'est plus null (ex: nationalité, motivation CCE, etc.)

ÉTAPE 3 — Si valeurs OK : run réel sans --dry-run :
  for UUID in 0fd55631-00d4-433c-b599-5fbb75692d16 464635d4-0f8b-4b98-a408-6b5f674ac249 02552ae3-ae24-40ed-9918-98a5e69f0f16 08e588e6-62dc-4c41-adc8-d0fd5dd965e6 6f490a37-224c-4b96-92e9-97b740ede7c4; do
    PYTHONIOENCODING=utf-8 .venv/bin/python analyze.py --arret-id $UUID --fulltext
  done

ÉTAPE 4 — Score depuis le PC Windows :
  cd C:\Projects\saas-juridique-cce-rvv\worker
  .venv\Scripts\python.exe score_reference.py --verbose
  # Objectif : dépasser 216/384 = 56%

ÉTAPE 5 — DÉTRUIRE l'instance (IMMÉDIATEMENT après les tests) :
  .venv\Scripts\vastai destroy instance 40250378

━━━ RÈGLES ABSOLUES ━━━
- Ne PAS modifier les fonctions existantes (7 groupes) — seul --fulltext est nouveau
- Ne PAS lancer sans --dry-run d'abord
- Ne PAS purger les 8 UUIDs de référence
- Vast.ai instance 40250378 : DÉTRUIRE dès que les 5 dry-runs sont validés
- Si vLLM est mort sur l'instance : relancer avec PID de EngineCore zombie à tuer d'abord
  (ps aux | grep VLLM → kill -9 <PID EngineCore>)

━━━ CONTEXTE DU PIVOT (rappel) ━━━
Problème 7-groupes : une partie du texte est cachée au LLM → données manquées.
Solution fulltext : 1 seul appel LLM, tout le texte (28 000 chars), tous les critères.
Modèle : MaziyarPanahi/Mixtral-8x22B-Instruct-v0.1-AWQ sur A100 SXM4 80Go.
Objectif : dépasser 65% sur les DPI → validation avocate → batch massif.
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
