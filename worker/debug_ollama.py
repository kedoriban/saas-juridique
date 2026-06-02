import requests, json

payload = {
    "model": "qwen3:4b",
    "messages": [
        {"role": "system", "content": "Tu reponds UNIQUEMENT en JSON valide, sans markdown, sans explication, sans raisonnement."},
        {"role": "user", "content": 'Retourne: {"test": "ok"}'},
    ],
    "stream": True,
    "think": False,
    "options": {"temperature": 0.0},
}
r = requests.post("http://localhost:11434/api/chat", json=payload, timeout=90)
print("STATUS:", r.status_code)
# Streaming : afficher les 10 premières lignes et le timing
import time
t0 = time.monotonic()
lines_shown = 0
full_text = ""
for line in r.iter_lines():
    if not line:
        continue
    chunk = json.loads(line)
    token = (chunk.get("message") or {}).get("content", "") or chunk.get("response", "")
    full_text += token
    if lines_shown < 5:
        print(f"  t+{time.monotonic()-t0:.1f}s token: {repr(token)}")
        lines_shown += 1
    if chunk.get("done"):
        print(f"  t+{time.monotonic()-t0:.1f}s DONE | reason={chunk.get('done_reason')}")
        break
print("Full response:", repr(full_text[:300]))
