"""Liste les arrêts en base avec leur numéro, langue et statut."""
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client

sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
res = sb.table("arrets").select("numero, langue, statut_traitement").order("numero").execute()
for a in (res.data or []):
    print(f"{a['numero']:>8}  {a['langue']}  {a['statut_traitement']}")
print(f"\nTotal : {len(res.data or [])} arrêts")
