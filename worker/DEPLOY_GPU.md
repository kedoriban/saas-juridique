# Déploiement du worker sur GPU loué

Faire tourner l'analyse LLM sur une machine GPU louée (Linux) au lieu du PC de dev.
**Zéro token API** : on paie seulement l'heure de location.

Deux phases :

| Phase | Objectif | LLM | GPU conseillé | Coût |
|---|---|---|---|---|
| **A. Test 50 arrêts** | Valider la qualité d'extraction sur `/validation` | Ollama + `qwen3:4b` | RTX 3090 (24 Go) | **~1-2 €** |
| **B. Production 181k** | Traiter tout le corpus | vLLM + modèle 7B-14B | RTX 4090 / A100 | ~15-30 € |

> ⚠️ **Règle de coût** : facturation à la seconde + plafond de dépense sur la
> plateforme, et **on arrête (stop/terminate) l'instance dès que le run est fini**.
> Le seul moyen de dépasser le budget = laisser la machine tourner à vide.

> ⚠️ **Prérequis métier** : la phase B ne démarre qu'**après** validation
> juridique de la qualité sur l'échantillon de 50 arrêts (priorité #5 du CLAUDE.md).

---

## Setup commun (les deux phases)

Sur un fournisseur de GPU à l'heure (**Vast.ai** = le moins cher, ou **Runpod
Community**), louer une instance **Ubuntu 22.04 + CUDA**, puis en SSH :

```bash
# 1. Dépendances système + le repo
sudo apt-get update && sudo apt-get install -y python3-venv git
git clone https://github.com/kedoriban/saas-juridique.git
cd saas-juridique
git checkout phase-02-criteres

# 2. Environnement Python du worker
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Fichier `.env.local` (à la RACINE du repo, jamais commité)

Le worker lit `../.env.local`. Le créer **à la main** sur la machine louée
(ne jamais le pousser sur Git, il est dans `.gitignore`) :

```bash
cat > ../.env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<ton-projet>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<ta-cle-service-role>
EOF
```

> Ce sont les mêmes valeurs que ton `.env.local` local. Les résultats écrits
> depuis la machine louée apparaissent **immédiatement** sur le site (même Supabase).

---

## Phase A — Test 50 arrêts (Ollama)

```bash
# Installer Ollama + le modèle (depuis n'importe quel dossier)
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &                 # démarre le serveur local (port 11434)
ollama pull qwen3:4b

# Depuis worker/ avec le venv actif et ../.env.local créé
cd ~/saas-juridique/worker && source .venv/bin/activate

# Provider par défaut = ollama, donc rien à configurer.
# 1. Scraper 30 FR + 20 NL
python scraper.py --lang fr --limit 30
python scraper.py --lang nl --limit 20

# 2. Extraire le texte (statut en_attente -> termine)
python main.py --limit 55

# 3. Analyser. Concurrence faible pour suivre la qualité (logs lisibles).
python analyze.py --limit 50 --concurrency 4
```

Puis vérifier sur `/validation` du site et faire valider un échantillon par l'avocate.
**Arrêter l'instance ensuite.**

> Ollama sérialise les requêtes par défaut. Pour un peu de parallélisme avec
> Ollama : `export OLLAMA_NUM_PARALLEL=4` avant `ollama serve`. Le vrai batching,
> c'est la phase B (vLLM).

---

## Phase B — Production 181 802 arrêts (vLLM)

vLLM expose une API compatible OpenAI et **batche** les requêtes concurrentes
côté serveur → c'est ce qui permet de tenir le corpus en quelques jours.

```bash
# Installer et lancer vLLM (modèle 7B = bon compromis qualité/VRAM sur 24 Go)
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8000 \
  --max-model-len 8192 &

# Configurer le worker pour viser vLLM
cd ~/saas-juridique/worker && source .venv/bin/activate
export LLM_PROVIDER=vllm
export VLLM_BASE_URL=http://localhost:8000/v1
export VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct
export LLM_MAX_OUTPUT_TOKENS=2000

# Scraper le corpus par paquets (--lang/--year/--page-start selon besoin), extraire,
# puis analyser en parallèle (le worker reprend où il s'est arrêté en cas de coupure).
python analyze.py --limit 2000 --concurrency 32
```

### Calibrer le coût AVANT le run complet

Le débit dépend du modèle et de la longueur des réponses. Lancer un **premier
paquet mesuré** (ex. 200 arrêts) et chronométrer :

```bash
time python analyze.py --limit 200 --concurrency 32
```

- Durée pour 200 arrêts × 909 ≈ durée totale pour 181 802.
- Multiplier par le tarif horaire du GPU = coût total réel.
- Ajuster `--concurrency` (monter tant que le débit augmente sans saturer la VRAM).

`guided_json` (intégré à vLLM) garantit un JSON conforme au schéma → moins
d'échecs de parsing qu'avec Ollama.

---

## Référence des variables d'environnement

| Variable | Phase | Défaut | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | A+B | — | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | A+B | — | Clé service-role (secret) |
| `LLM_PROVIDER` | A+B | `ollama` | `ollama` ou `vllm` |
| `OLLAMA_BASE_URL` | A | `http://localhost:11434` | Endpoint Ollama |
| `OLLAMA_MODEL` | A | `qwen3:4b` | Modèle Ollama |
| `VLLM_BASE_URL` | B | `http://localhost:8000/v1` | Endpoint vLLM (OpenAI-compat) |
| `VLLM_MODEL` | B | `Qwen/Qwen2.5-7B-Instruct` | Modèle servi par vLLM |
| `VLLM_API_KEY` | B | _(vide)_ | Bearer si le serveur en exige une |
| `LLM_MAX_OUTPUT_TOKENS` | B | `3000` | Tokens max générés / appel |
| `LLM_MAX_INPUT_CHARS` | A+B | `8000` | Troncature du prompt utilisateur |
| `LLM_TIMEOUT_SECONDS` | A+B | `180` | Timeout par appel |
