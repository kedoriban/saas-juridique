"""
Lance analyze.py sur les 9 arrêts de référence de RESULTAT ATTENDU.md.

Usage :
  python analyze_reference.py                      # tous les groupes, stocke
  python analyze_reference.py --dry-run            # tous les groupes, affiche seulement
  python analyze_reference.py --group metadata     # un seul groupe, stocke
  python analyze_reference.py --group metadata --dry-run
"""
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client  # noqa: E402

REFERENCE_NUMEROS = [
    "290647", "341963", "341960", "341946", "341951",
    "341962", "341949", "342046", "342062",
]

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

dry_run = "--dry-run" in sys.argv
group_arg: list[str] = []
for i, arg in enumerate(sys.argv[1:], 1):
    if arg == "--group" and i < len(sys.argv):
        group_arg = ["--group", sys.argv[i + 1]]
        break

for numero in REFERENCE_NUMEROS:
    res = (
        sb.table("arrets")
        .select("id, numero, langue")
        .ilike("numero", f"%{numero}%")
        .limit(1)
        .execute()
    )
    if not res or not res.data:
        print(f"\n[WARN] Arrêt {numero} non trouvé en base — ignoré")
        continue
    arret = res.data[0]
    print(f"\n{'='*64}")
    print(f"Arrêt {arret['numero']} ({arret['langue']}) — {arret['id']}")
    print("="*64)
    cmd = [sys.executable, "analyze.py", "--arret-id", arret["id"]] + group_arg
    if dry_run:
        cmd.append("--dry-run")
    subprocess.run(cmd, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
