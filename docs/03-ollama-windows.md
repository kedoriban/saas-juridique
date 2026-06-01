# Instructions Ollama Windows

## Objectif

Tester localement l’analyse IA sur un petit lot d’arrêts nettoyés et segmentés, sans utiliser de gros modèle et sans traiter massivement.

## Machine cible

PC Windows MSI Thin GF63 12UC :

- RAM : 16 Go.
- GPU : NVIDIA GeForce RTX 3050 Laptop, 4 Go VRAM.
- CUDA visible : 12.5.

Cette machine sert au développement, aux tests LLM locaux et à la démo limitée. Elle ne sert pas au traitement massif de 200k+ arrêts.

## Vérifier le GPU

Dans PowerShell :

```powershell
nvidia-smi
```

## Installer Ollama

```powershell
winget install --id Ollama.Ollama -e
ollama --version
```

## Modèle recommandé pour test

Commencer petit :

```powershell
ollama pull qwen3:4b
ollama run qwen3:4b
```

Si le PC est trop lent ou sature, descendre vers un modèle 3B ou inférieur disponible dans Ollama.

Ne pas utiliser de modèles 14B, 32B, 70B sur cette machine.

## Tester l’API locale

```powershell
curl http://localhost:11434/api/tags
```

## Sorties structurées

L’analyse doit utiliser un JSON Schema strict via l’API Ollama quand c’est possible.

Source utile :
https://docs.ollama.com/capabilities/structured-outputs

## Règle projet

Ollama est un provider interchangeable. Le code doit utiliser une interface abstraite :

- provider : `ollama_local` au MVP.
- base URL : variable d’environnement.
- model name : variable d’environnement.
- timeout : variable d’environnement.

Exemples de variables :

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
LLM_TIMEOUT_SECONDS=120
```

## Limite importante

Le LLM ne lit jamais les PDF. Il reçoit uniquement des passages utiles, courts et pré-extraits.
