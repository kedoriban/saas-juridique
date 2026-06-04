#!/bin/bash
# gpu_setup.sh — Setup one-shot sur instance Vast.ai (Ubuntu + CUDA)
# Cloner le repo, créer le venv, installer les dépendances + vLLM.
# À exécuter UNE SEULE FOIS après création de l'instance.
#
# Usage :
#   bash gpu_setup.sh
# ou avec token GitHub si repo privé :
#   GIT_TOKEN=ghp_xxx bash gpu_setup.sh

set -euo pipefail

REPO_URL="https://github.com/kedoriban/saas-juridique.git"
WORKDIR="/workspace/saas-juridique"
PYTHON="python3"

echo "=============================="
echo " GPU SETUP — saas-juridique  "
echo "=============================="

# --- 1. Dépendances système ---
echo "[1/5] Dépendances système..."
apt-get update -qq
apt-get install -y -qq git python3 python3-venv python3-pip curl

# --- 2. Cloner ou mettre à jour le repo ---
echo "[2/5] Repo..."
if [ -d "$WORKDIR/.git" ]; then
  echo "  → Repo déjà présent, git pull..."
  cd "$WORKDIR"
  git pull
else
  if [ -n "${GIT_TOKEN:-}" ]; then
    AUTH_URL="https://${GIT_TOKEN}@github.com/kedoriban/saas-juridique.git"
  else
    AUTH_URL="$REPO_URL"
  fi
  echo "  → Clone dans $WORKDIR..."
  git clone "$AUTH_URL" "$WORKDIR"
fi

# --- 3. Créer le venv worker ---
echo "[3/5] Environnement Python..."
cd "$WORKDIR/worker"
if [ ! -d ".venv" ]; then
  $PYTHON -m venv .venv
fi
.venv/bin/pip install --quiet --upgrade pip

# --- 4. Dépendances worker ---
echo "[4/5] Dépendances worker (requirements.txt)..."
.venv/bin/pip install --quiet -r requirements.txt

# --- 5. vLLM ---
echo "[5/5] Installation vLLM (peut prendre 5-10 min)..."
.venv/bin/pip install --quiet vllm

echo ""
echo "=============================="
echo " SETUP TERMINÉ ✓             "
echo "=============================="
echo ""
echo "Prochaine étape :"
echo "  1. Créer /workspace/saas-juridique/.env.local"
echo "     (copier .env.gpu.example et remplir les valeurs)"
echo "  2. bash /workspace/saas-juridique/worker/gpu_run.sh"
