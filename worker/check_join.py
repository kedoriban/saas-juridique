import os; from pathlib import Path; from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Quelques criterion_id de arret_criteria_values
arret = sb.table("arrets").select("id").eq("numero", "CCE 341995").execute().data[0]
vals = sb.table("arret_criteria_values").select("criterion_id").eq("arret_id", arret["id"]).limit(5).execute().data
print("=== criterion_id dans arret_criteria_values ===")
for v in vals:
    print(" ", v["criterion_id"])

# Quelques slug et criterion_version_id de criteria
crit = sb.table("criteria").select("slug, criterion_version_id, label_original").eq("language", "fr").limit(5).execute().data
print("\n=== criteria (slug / criterion_version_id) ===")
for c in crit:
    print(f"  slug={c['slug']} | version_id={c['criterion_version_id']} | {c['label_original'][:40]}")
