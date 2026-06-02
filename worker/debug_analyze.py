"""Debug : affiche le JSON brut retourné par le LLM pour un groupe."""
import os, json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path("../.env.local"))

from supabase import create_client
from llm_provider import get_provider, _extract_json
from prompts import build_prompt, select_passages

ARRET_ID = "96a30e74-ca27-4400-992a-940e1378f6fe"
LANGUAGE = "nl"
GROUP = "identity"

c = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
segs = c.table("arret_segments").select("section,text,quality_score,segment_index").eq("arret_id", ARRET_ID).order("segment_index").execute().data or []

crit_data = json.loads(Path("../data/criteria_canonical.json").read_text(encoding="utf-8"))
criteria = [cr for cr in crit_data["criteria"] if cr.get("language") == LANGUAGE and cr.get("active", True) and cr.get("llm_group") == GROUP]

passages = select_passages(segs, GROUP)
prompt = build_prompt(
    arret_id=ARRET_ID, language=LANGUAGE, criterion_version="client_excel_v1",
    group=GROUP,
    criteria=[{"id": c["id"], "label": c["label_original"], "type": c["expected_value_type"]} for c in criteria],
    passages=passages,
)

provider = get_provider()
print(f"Appel LLM... (modele={provider.model})")
resp = provider.complete(prompt)
print(f"Duree: {resp.duration_ms}ms | Chars reponse: {len(resp.raw_text)}")
print("\n--- RAW debut (300 chars) ---")
print(repr(resp.raw_text[:300]))
print("\n--- RAW fin (1500 chars) ---")
print(resp.raw_text[-1500:])
print("\n--- PARSED ---")
if resp.parsed:
    print(json.dumps(resp.parsed, ensure_ascii=False, indent=2)[:1000])
else:
    print("ERREUR:", resp.error)
