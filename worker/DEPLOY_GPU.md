# Déploiement du worker sur GPU loué

Faire tourner l'analyse LLM sur une machine GPU louée (Linux) au lieu du PC de dev.
**Zéro token API** : on paie seulement l'heure de location.

Modèle retenu : **`Qwen/Qwen2.5-32B-Instruct-AWQ`** servi par **vLLM** (API compatible
OpenAI + `guided_json` qui force une sortie JSON conforme au schéma). C'est la précision
maximale visée, et c'est **le même modèle pour le test et pour la production** → la
validation juridique porte sur ce qui sera réellement produit.

Deux phases :

| Phase | Objectif | GPU | Coût |
|---|---|---|---|
| **A. Test 50 arrêts** | Valider la qualité d'extraction sur `/validation` | RTX 3090 (24 Go) | **~1-3 €** |
| **B. Production 181 802** | Traiter tout le corpus | Machine plus costaud (A100 40/80 Go) | à mesurer (cf. calibration) |

> ⚠️ **Règle de coût** : facturation à la seconde + plafond de dépense sur la
> plateforme, et **on arrête (stop/terminate) l'instance dès que le run est fini**.
> Le seul moyen de dépasser le budget = laisser la machine tourner à vide.

> ⚠️ **Prérequis métier** : la phase B ne démarre qu'**après** validation
> juridique de la qualité sur l'échantillon de 50 arrêts (priorité #5 du CLAUDE.md).

> ℹ️ **VRAM** : le 32B-AWQ pèse ~19 Go. Il **rentre** sur un 3090 24 Go mais c'est
> serré : peu de cache KV → **concurrence faible** (2-4). Parfait pour 50 arrêts.
> Pour le corpus complet, prendre une carte avec plus de VRAM (gros cache KV =
> forte concurrence = bien plus de débit par €).

---

## Setup commun (les deux phases)

Sur un fournisseur de GPU à l'heure (**Vast.ai** = le moins cher), louer une instance
**Ubuntu 22.04 + CUDA 12.x**, avec **~50 Go de disque** (modèle ~19 Go + vLLM/torch
~10 Go + repo). Puis en SSH ou dans le terminal Jupyter :

```bash
# 1. Dépendances système + le repo
sudo apt-get update && sudo apt-get install -y python3-venv git
git clone https://github.com/kedoriban/saas-juridique.git
cd saas-juridique
# main est la branche par défaut

# 2. Environnement Python du worker
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. vLLM (sert le modèle 32B-AWQ)
pip install vllm
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

## Phase A — Test 50 arrêts (vLLM + Qwen2.5-32B-AWQ sur 3090)

### 1. Lancer le serveur vLLM

```bash
vllm serve Qwen/Qwen2.5-32B-Instruct-AWQ \
  --quantization awq_marlin \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.97 \
  --max-num-seqs 4 \
  --port 8000 &
```

Le premier lancement télécharge le modèle (~19 Go, quelques minutes). Attendre la
ligne `Uvicorn running on http://0.0.0.0:8000`.

> 🛠️ **Si OOM au démarrage** (le 32B-AWQ + cache KV dépasse les 24 Go) : baisser
> `--max-model-len` à `6144` puis `4096`, ou `--max-num-seqs` à `2`. Nos prompts
> tiennent largement dans 4096 (entrée ≤ ~2000 tokens + sortie ≤ 1500).

### 2. Configurer le worker pour viser vLLM

```bash
cd ~/saas-juridique/worker && source .venv/bin/activate
export LLM_PROVIDER=vllm
export VLLM_BASE_URL=http://localhost:8000/v1
export VLLM_MODEL=Qwen/Qwen2.5-32B-Instruct-AWQ
export LLM_MAX_OUTPUT_TOKENS=1500
```

### 3. Pipeline sur 50 arrêts

```bash
# Scraper 30 FR + 20 NL
python scraper.py --lang fr --limit 30
python scraper.py --lang nl --limit 20

# Extraire le texte (statut en_attente -> termine)
python main.py --limit 55

# Analyser. Concurrence basse (2) car le cache KV est petit sur 3090 avec le 32B.
python analyze.py --limit 50 --concurrency 2
```

Puis vérifier sur `/validation` du site et faire valider un échantillon par l'avocate.
**Arrêter (stop/terminate) l'instance ensuite.**

---

## Phase B — Production 181 802 arrêts (meilleure machine)

Même worker, même modèle, mais sur une carte avec **plus de VRAM** (A100 40/80 Go) :
le gros cache KV permet une **forte concurrence** → vLLM batche beaucoup de requêtes
→ c'est ce qui rend le corpus traitable à coût raisonnable.

```bash
# Setup identique (clone + venv + pip install + vLLM + .env.local), puis :
vllm serve Qwen/Qwen2.5-32B-Instruct-AWQ \
  --quantization awq_marlin \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.95 \
  --port 8000 &

cd ~/saas-juridique/worker && source .venv/bin/activate
export LLM_PROVIDER=vllm
export VLLM_BASE_URL=http://localhost:8000/v1
export VLLM_MODEL=Qwen/Qwen2.5-32B-Instruct-AWQ
export LLM_MAX_OUTPUT_TOKENS=1500

# Scraper le corpus par paquets (--lang/--year/--page-start selon besoin), extraire,
# puis analyser en parallèle (le worker reprend où il s'est arrêté en cas de coupure).
python analyze.py --limit 2000 --concurrency 32
```

### Calibrer le coût AVANT le run complet

Le débit dépend du GPU, du modèle et de la longueur des réponses. Lancer un **premier
paquet mesuré** (ex. 200 arrêts) et chronométrer :

```bash
time python analyze.py --limit 200 --concurrency 32
```

- Durée pour 200 arrêts × 909 ≈ durée totale pour 181 802.
- Multiplier par le tarif horaire du GPU = coût total réel.
- Ajuster `--concurrency` (monter tant que le débit augmente sans saturer la VRAM).

C'est l'étape qui **verrouille le budget** : on connaît le coût réel avant d'engager
les 181 802 arrêts. Si le 32B dépasse le budget visé, on bascule la prod sur un
modèle plus petit (ex. `Qwen/Qwen2.5-14B-Instruct-AWQ`) et on refait le test des 50
sur ce modèle pour que l'avocate valide ce qui shippera vraiment.

`guided_json` (intégré à vLLM) garantit un JSON conforme au schéma → quasi plus
d'échecs de parsing/validation.

---

## Note : dev local sur le laptop

Sur le PC de dev (RTX 3050, 4 Go), le provider par défaut reste **Ollama**
(`LLM_PROVIDER=ollama`, `qwen3:4b`) pour les tests rapides et la démo ≤50 arrêts.
vLLM + 32B-AWQ est réservé à la machine louée.

---

## Référence des variables d'environnement

| Variable | Phase | Défaut | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | A+B | — | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | A+B | — | Clé service-role (secret) |
| `LLM_PROVIDER` | A+B | `ollama` | `ollama` (laptop) ou `vllm` (GPU loué) |
| `OLLAMA_BASE_URL` | dev | `http://localhost:11434` | Endpoint Ollama (laptop) |
| `OLLAMA_MODEL` | dev | `qwen3:4b` | Modèle Ollama (laptop) |
| `VLLM_BASE_URL` | A+B | `http://localhost:8000/v1` | Endpoint vLLM (OpenAI-compat) |
| `VLLM_MODEL` | A+B | `Qwen/Qwen2.5-32B-Instruct-AWQ` | Modèle servi par vLLM |
| `VLLM_API_KEY` | A+B | _(vide)_ | Bearer si le serveur en exige une |
| `LLM_MAX_OUTPUT_TOKENS` | A+B | `3000` | Tokens max générés / appel (mettre `1500` pour le 32B) |
| `LLM_MAX_INPUT_CHARS` | A+B | `8000` | Troncature du prompt utilisateur |
| `LLM_TIMEOUT_SECONDS` | A+B | `180` | Timeout par appel |
