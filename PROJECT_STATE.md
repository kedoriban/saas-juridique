# PROJECT_STATE.md – État vivant du projet

Dernière mise à jour : 2026-06-04 (R-Phase 3 terminée — prêt pour R-Phase 4)

## Objectif actuel

**R-Phase 4 — Nouveau test sur 50 arrêts avec modèle supérieur sur instance GPU plus puissante.**

Contexte : R-Phase 3 terminée avec succès (Qwen2.5-32B-AWQ sur RTX 3090). 
L'instance GPU précédente (ID 39370495) doit être **arrêtée**.
Prochain test : modèle 72B sur A100 80 Go.

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

### Machine cible sur Vast.ai

**Recommandation : 1× A100 SXM 80 Go** (ou A100 PCIe 80 Go)
- Prix : ~1,50–2,50 €/h sur Vast.ai
- VRAM : permet de charger **Qwen2.5-72B-Instruct-AWQ** (~38 Go) ou un modèle full precision plus petit

Prérequis instance :
- Ubuntu 22.04
- CUDA ≥ 12.4
- Disque ≥ 80 Go
- RAM système ≥ 64 Go

### Modèle cible

**Option A (recommandée) : `Qwen/Qwen2.5-72B-Instruct-AWQ`**
- 72B paramètres quantifiés AWQ (~38 Go VRAM)
- Même famille que le 32B → prompts inchangés
- Meilleure compréhension des textes juridiques FR/NL longs
- vLLM : `--max-model-len 8192 --gpu-memory-utilization 0.92`

**Option B : `Qwen/Qwen3-30B` (ou `Qwen3-32B`)**
- Modèle plus récent, potentiellement meilleur sur le raisonnement
- ~16–18 Go VRAM (quantifié) → tiendrait aussi sur RTX 4090 24 Go

**Option C : `meta-llama/Llama-3.3-70B-Instruct-AWQ`**
- Alternative si Qwen indisponible sur Vast.ai
- Bon en FR/NL mais moins testé sur ce pipeline

### Commande vLLM pour A100 80 Go (Option A)

```bash
nohup /workspace/saas-juridique/worker/.venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-72B-Instruct-AWQ --port 8000 --dtype auto \
  --max-model-len 8192 --gpu-memory-utilization 0.92 --trust-remote-code \
  > /workspace/saas-juridique/logs/vllm.log 2>&1 &
```

### Séquence R-Phase 4

1. Louer instance A100 80 Go sur Vast.ai (template Ubuntu 22.04 + PyTorch)
2. `git clone` + `pip install` + `.env.local` copié
3. Démarrer vLLM avec le modèle 72B
4. Vider les valeurs existantes en base (ou créer 50 nouveaux arrêts)
5. Relancer extraction + analyse sur les 50 mêmes arrêts
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
- Les parties Figma Focus et Imports d'arrêts sont ignorées.
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

## Stack retenue

- Next.js 15.5.18 + TypeScript + Tailwind.
- Supabase Auth + Postgres.
- Vercel pour l'app.
- Worker local séparé pour scraping/extraction/analyse.
- Ollama local pour test LLM (qwen3:4b, 4 Go VRAM).
- PyMuPDF / pdfplumber / OCR fallback pour PDF.
- BeautifulSoup4 + lxml pour le scraping CCE/RVV.

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
| **R-Phase 4. Test Qwen2.5-72B / A100 80 Go** | ⬜ À faire | Nouvelle instance Vast.ai. Reset valeurs LLM. Comparer qualité. |

## Infrastructure Supabase

- Migrations `001` à `008` : **toutes appliquées**.
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

- **Qualité LLM non validée par l'avocate** : 50 arrêts analysés avec Qwen2.5-32B, pas encore revus par l'avocate. Ne pas traiter plus de 100 arrêts avant validation.
- **R-Phase 4 non démarrée** : modèle 72B + A100 pas encore testés.
- **Arrêts fictifs seed** : 15 arrêts (CCE 260.001–015) ont des PDF en 404 → statut `erreur`. Ne nuisent pas mais polluent les stats.
- **Critères FR fusionnés** (`fr_025`, `fr_033`) : à clarifier avec la cliente.
- **PostCSS CVE modérées** : bundlées par Next.js, non corrigeables sans downgrade.

## Risques ouverts spécifiques R-Phase 4

- **`profile_vulnerability`** (15 critères) : 1 hallucination criterion_id observée sur 32B. Surveiller sur 72B.
- **Coût A100 80 Go** : ~1,50–2,50 €/h. Budget estimé pour 50 arrêts : ~3–5 € (environ 2h de GPU).
- **Disponibilité A100 sur Vast.ai** : vérifier avant de louer, les A100 sont parfois pris.

## Points de vigilance permanents

- Ne pas lancer de traitement massif (> 100 arrêts) avant validation juridique.
- Ne pas stocker les PDF.
- Ne pas envoyer les PDF ou l'arrêt complet au LLM.
- Ne pas modifier rétroactivement les analyses après changement de critères sans retraitement explicite.
- Maintenir ce fichier à jour avant chaque `/clear`.
- Lancer `npm install` avant `npm run dev`.
- Appliquer les migrations SQL dans Supabase avant tout test fonctionnel.
- `.env.example` ne doit jamais contenir de vraies clés.
