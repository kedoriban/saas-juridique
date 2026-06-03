#!/usr/bin/env bash
# =============================================================================
# Test 50 arrêts sur GPU loué — Qwen2.5-32B-AWQ via vLLM (précision maximale).
# Relance tout le pipeline de bout en bout sur une instance fraîche.
# =============================================================================
#
# PRÉREQUIS DE L'INSTANCE (Vast.ai / Runpod) — à vérifier AVANT de louer :
#   • Ubuntu 22.04
#   • GPU 24 Go (RTX 3090 ou mieux)
#   • Max CUDA >= 12.8   (sinon vLLM 0.22 plante : « NVIDIA driver too old »)
#   • Disque >= 50 Go    (modèle ~19 Go + vLLM/torch ~10 Go ; 32 Go = trop juste)
#
# UTILISATION sur une instance fraîche (terminal SSH ou Jupyter) :
#   sudo apt-get update && sudo apt-get install -y python3-venv git curl
#   git clone https://github.com/kedoriban/saas-juridique.git
#   cd saas-juridique/worker
#   # créer ../.env.local (voir bloc ci-dessous), puis :
#   bash run_gpu_test.sh
#
# ../.env.local (À LA RACINE du repo, jamais commité — contient le secret) :
#   cat > ../.env.local <<'EOF'
#   NEXT_PUBLIC_SUPABASE_URL=https://kuwhvnyvughydcqzjrby.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<ta-cle-service-role>
#   EOF
#
# ⚠️ Quand le run est fini : vérifier /validation sur le site, puis ARRÊTER
#    (stop/terminate) l'instance — elle facture tant qu'elle tourne.
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")"   # se place dans worker/

# --- 1. Environnement Python -------------------------------------------------
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
pip install -q vllm

# --- 2. Vérifier le secret Supabase -----------------------------------------
if [ ! -f ../.env.local ]; then
  echo "ERREUR : ../.env.local manquant (voir l'en-tête de ce script)." >&2
  exit 1
fi

# --- 3. Config worker -> vLLM ------------------------------------------------
export LLM_PROVIDER=vllm
export VLLM_BASE_URL=http://localhost:8000/v1
export VLLM_MODEL=Qwen/Qwen2.5-32B-Instruct-AWQ
export LLM_MAX_OUTPUT_TOKENS=1500

# --- 4. Lancer vLLM en arrière-plan (logs dans vllm.log) ---------------------
echo ">>> Démarrage de vLLM (1er lancement = téléchargement ~19 Go, sois patient)..."
nohup vllm serve "$VLLM_MODEL" \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.95 \
  --max-num-seqs 2 \
  --enforce-eager \
  --port 8000 > vllm.log 2>&1 &
VLLM_PID=$!

# --- 5. Attendre que le serveur réponde (jusqu'à ~25 min) --------------------
echo ">>> Attente du serveur vLLM..."
for _ in $(seq 1 150); do
  if curl -sf http://localhost:8000/v1/models > /dev/null 2>&1; then
    echo ">>> vLLM prêt."
    break
  fi
  if ! kill -0 "$VLLM_PID" 2>/dev/null; then
    echo "ERREUR : vLLM s'est arrêté. Dernières lignes de vllm.log :" >&2
    tail -n 40 vllm.log >&2
    exit 1
  fi
  sleep 10
done

# --- 6. Pipeline sur 50 arrêts ----------------------------------------------
# Scraping + extraction : idempotents (arrêts déjà présents/extraits = ignorés).
# Si la DB est déjà peuplée, ces 3 étapes ne refont rien d'inutile.
python scraper.py --lang fr --limit 30
python scraper.py --lang nl --limit 20
python main.py --limit 55

# Analyse (concurrence basse car cache KV serré sur 3090 avec le 32B).
python analyze.py --limit 50 --concurrency 2

echo ">>> Terminé. Vérifie /validation sur le site, puis ARRÊTE l'instance."
