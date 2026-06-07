"""Affiche le metadata_detected du cache disque pour un arrêt donné."""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client

numero = sys.argv[1] if len(sys.argv) > 1 else "341963"

sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
r = sb.table("arrets").select("id, numero").ilike("numero", f"%{numero}%").limit(1).execute()
if not r.data:
    print(f"Arrêt {numero} introuvable.")
    sys.exit(1)

uid = r.data[0]["id"]
print(f"UUID : {uid}")

cache = Path(__file__).parent.parent / ".tmp" / "intermediate" / f"{uid}.json"
if not cache.exists():
    print(f"Cache disque absent : {cache}")
    print("→ Supabase intermediate_json sera utilisé à la place.")
    r2 = sb.table("arrets").select("intermediate_json").eq("id", uid).maybe_single().execute()
    if r2 and r2.data and r2.data.get("intermediate_json"):
        meta = r2.data["intermediate_json"].get("metadata_detected", {})
        print("\nmetadata_detected (depuis Supabase) :")
        print(json.dumps(meta, indent=2, ensure_ascii=False))
    else:
        print("Pas d'intermediate_json en Supabase non plus.")
    sys.exit(0)

d = json.loads(cache.read_text("utf-8"))
meta = d.get("metadata_detected", {})
print(f"Cache : {cache}")
print("\nmetadata_detected :")
print(json.dumps(meta, indent=2, ensure_ascii=False))
