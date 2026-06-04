#!/bin/bash
# gpu_run.sh — Lance le pipeline complet sur instance Vast.ai RTX 3090.
# Ordre : vLLM (background) → wait health → main.py → analyze.py
# Logs dans /workspace/saas-juridique/logs/
#
# Usage :
#   bash gpu_run.sh
# Options :
#   EXTRACT_LIMIT=55   (défaut) nombre d'arrêts à ré-extraire
#   ANALYZE_LIMIT=20   (défaut) nombre d'arrêts à analyser
#   VLLM_PORT=8000     (défaut)

set -euo pipefail

WORKDIR="/workspace/saas-juridique"
WORKER="$WORKDIR/worker"
LOG_DIR="$WORKDIR/logs"
ENV_FILE="$WORKDIR/.env.local"

# Créer le dossier logs en tout premier (avant tout redirect externe)
mkdir -p "$LOG_DIR"

VLLM_MODEL="Qwen/Qwen2.5-32B-Instruct-AWQ"
VLLM_PORT="${VLLM_PORT:-8000}"
EXTRACT_LIMIT="${EXTRACT_LIMIT:-55}"
ANALYZE_LIMIT="${ANALYZE_LIMIT:-20}"

mkdir -p "$LOG_DIR"

echo "=============================="
echo " GPU RUN — saas-juridique    "
echo " $(date '+%Y-%m-%d %H:%M:%S') "
echo "=============================="

# --- Vérifications préalables ---
if [ ! -f "$ENV_FILE" ]; then
  echo "ERREUR : $ENV_FILE introuvable."
  echo "Copier .env.gpu.example → .env.local et remplir SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

if [ ! -d "$WORKER/.venv" ]; then
  echo "ERREUR : venv absent. Lancer d'abord gpu_setup.sh"
  exit 1
fi

cd "$WORKER"
PYTHON="$WORKER/.venv/bin/python"

# --- 1. Lancer vLLM en arrière-plan ---
echo ""
echo "[1/3] Démarrage vLLM ($VLLM_MODEL)..."
echo "      Log → $LOG_DIR/vllm.log"

nohup "$WORKER/.venv/bin/python" -m vllm.entrypoints.openai.api_server \
  --model "$VLLM_MODEL" \
  --port "$VLLM_PORT" \
  --dtype auto \
  --max-model-len 5500 \
  --gpu-memory-utilization 0.9825 \
  --trust-remote-code \
  > "$LOG_DIR/vllm.log" 2>&1 &

VLLM_PID=$!
echo "      PID vLLM : $VLLM_PID"

# --- 2. Attendre que vLLM réponde ---
echo ""
echo "[2/3] Attente démarrage vLLM (max 12 min)..."
READY=0
for i in $(seq 1 144); do
  if curl -sf "http://localhost:${VLLM_PORT}/health" > /dev/null 2>&1; then
    READY=1
    echo "      → vLLM prêt ($(( i * 5 ))s)"
    break
  fi
  # Afficher progression toutes les 30s
  if (( i % 6 == 0 )); then
    echo "      ... ${i}×5s écoulées — dernière ligne log :"
    tail -1 "$LOG_DIR/vllm.log" || true
  fi
  sleep 5
done

if [ $READY -eq 0 ]; then
  echo "ERREUR : vLLM n'a pas démarré en 12 min."
  echo "=== Dernières lignes de vllm.log ==="
  tail -30 "$LOG_DIR/vllm.log"
  exit 1
fi

# Variables d'environnement communes aux deux scripts
export LLM_PROVIDER="vllm"
export VLLM_BASE_URL="http://localhost:${VLLM_PORT}/v1"
export VLLM_MODEL="$VLLM_MODEL"
export LLM_TIMEOUT_SECONDS="300"
export LLM_MAX_INPUT_CHARS="8000"
export LLM_MAX_OUTPUT_TOKENS="2000"
export LLM_STORE_RAW_OUTPUT="false"
export PYTHONIOENCODING="utf-8"

# --- 3a. Extraction + construction JSON intermédiaire ---
echo ""
echo "[3a/3] Extraction PDF — main.py --limit $EXTRACT_LIMIT"
echo "       Log → $LOG_DIR/main.log"
echo "       Démarré à $(date '+%H:%M:%S')"

"$PYTHON" main.py --limit "$EXTRACT_LIMIT" 2>&1 | tee "$LOG_DIR/main.log"

echo "       Terminé à $(date '+%H:%M:%S')"

# --- 3b. Analyse LLM ---
echo ""
echo "[3b/3] Analyse LLM — analyze.py --limit $ANALYZE_LIMIT"
echo "       Log → $LOG_DIR/analyze.log"
echo "       Démarré à $(date '+%H:%M:%S')"

"$PYTHON" analyze.py --limit "$ANALYZE_LIMIT" 2>&1 | tee "$LOG_DIR/analyze.log"

echo "       Terminé à $(date '+%H:%M:%S')"

# --- Résumé ---
echo ""
echo "=============================="
echo " PIPELINE TERMINÉ ✓           "
echo " $(date '+%Y-%m-%d %H:%M:%S') "
echo "=============================="
echo ""
echo "Logs disponibles :"
echo "  vLLM    → $LOG_DIR/vllm.log"
echo "  main.py → $LOG_DIR/main.log"
echo "  analyze → $LOG_DIR/analyze.log"
echo ""
echo "vLLM toujours actif (PID $VLLM_PID). Pour l'arrêter : kill $VLLM_PID"
