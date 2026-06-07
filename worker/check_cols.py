import os; from pathlib import Path; from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
print("criteria cols:", list(sb.table("criteria").select("*").limit(1).execute().data[0].keys()))
print("acv cols:", list(sb.table("arret_criteria_values").select("*").limit(1).execute().data[0].keys()))
