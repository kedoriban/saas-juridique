"""Debug : affiche le prompt réel pour le groupe identity de l'arrêt CCE 260.002."""
import os, sys, json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path("../.env.local"))

from supabase import create_client
from prompts import build_prompt, select_passages

ARRET_ID = "96a30e74-ca27-4400-992a-940e1378f6fe"
LANGUAGE = "nl"
GROUP = "identity"

c = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

segs = c.table("arret_segments").select("section,text,quality_score,segment_index").eq("arret_id", ARRET_ID).order("segment_index").execute().data or []
print(f"Segments : {len(segs)}")

crit_data = json.loads(Path("../data/criteria_canonical.json").read_text(encoding="utf-8"))
criteria = [cr for cr in crit_data["criteria"] if cr.get("language") == LANGUAGE and cr.get("active", True) and cr.get("llm_group") == GROUP]
print(f"Criteres {GROUP} ({LANGUAGE}) : {len(criteria)}")

passages = select_passages(segs, GROUP)
print(f"Passages selectionnes : {len(passages)}, total chars : {sum(len(p) for p in passages)}")

prompt = build_prompt(
    arret_id=ARRET_ID,
    language=LANGUAGE,
    criterion_version="client_excel_v1",
    group=GROUP,
    criteria=[{"id": c["id"], "label": c["label_original"], "type": c["expected_value_type"]} for c in criteria],
    passages=passages,
)
print(f"\nPrompt total : {len(prompt)} chars")
print("\n--- DEBUT PROMPT ---")
print(prompt[:2000])
print("--- FIN (tronque) ---")
