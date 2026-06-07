"""
audit_arret.py — Compare le texte extrait (intermediate_json) avec les valeurs LLM stockées.
Usage : python audit_arret.py 341995
"""
import os, sys, json
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client

sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

numero = sys.argv[1] if len(sys.argv) > 1 else "341995"
numero_full = f"CCE {numero}" if not numero.startswith("CCE") else numero

# --- Arrêt ---
arret = sb.table("arrets").select("id, numero, langue, intermediate_json").eq("numero", numero_full).execute().data
if not arret:
    print(f"Arrêt {numero_full} introuvable.")
    sys.exit(1)
arret = arret[0]
arret_id = arret["id"]
langue = arret["langue"].lower()  # "fr" ou "nl"

ij = arret.get("intermediate_json") or {}
if isinstance(ij, str):
    ij = json.loads(ij)
sections = ij.get("sections", [])

# --- Valeurs LLM ---
vals = sb.table("arret_criteria_values").select(
    "criterion_id, value_text, value_boolean, confidence, source_authority, needs_human_review, evidence_excerpt, validation_status"
).eq("arret_id", arret_id).execute().data
val_by_crit = {v["criterion_id"]: v for v in vals}

# --- Critères (filtrés par langue) ---
criteria = sb.table("criteria").select(
    "slug, order_index, label_original, llm_group, language"
).eq("language", langue).execute().data
# criterion_id = "{langue}_{order_index:03d}_{slug}" — format utilisé dans arret_criteria_values
crit_by_id = {f"{c['language']}_{c['order_index']:03d}_{c['slug']}": c for c in criteria}

# --- Texte complet ---
full_text = "\n\n".join(
    f"[{s.get('section_id', '?')}]\n{s.get('text', '')}"
    for s in sections
)

print("=" * 70)
print(f"AUDIT : {numero_full} ({langue.upper()}) — {len(sections)} sections | {len(vals)} valeurs LLM | {len(criteria)} critères")
print("=" * 70)

# --- Sections ---
print(f"\n📄 TEXTE EXTRAIT ({sum(len(s.get('text','')) for s in sections)} chars)")
print("-" * 70)
for s in sections:
    sid = s.get("section_id", "?")
    txt = s.get("text", "")
    print(f"\n[{sid}] ({len(txt)} chars)")
    print(txt[:800] + ("..." if len(txt) > 800 else ""))

# --- Valeurs LLM par groupe ---
print("\n\n📊 VALEURS LLM PAR GROUPE")
print("-" * 70)

groups = defaultdict(list)
for cid, c in crit_by_id.items():
    groups[c.get("llm_group") or "?"].append(cid)

total_found = 0
total_missing = 0

for group in sorted(groups.keys()):
    cids = groups[group]
    print(f"\n▶ {group.upper()} ({len(cids)} critères)")
    for cid in cids:
        c = crit_by_id.get(cid, {})
        v = val_by_crit.get(cid)
        label = c.get("label_original", cid)[:55]
        if v:
            val_text = v.get("value_text")
            val_bool = v.get("value_boolean")
            conf = v.get("confidence")
            review = v.get("needs_human_review", False)
            excerpt = v.get("evidence_excerpt") or ""

            if val_text:
                display = str(val_text)[:70]
                tag = "TROUVÉ  "
                total_found += 1
            elif val_bool is True:
                display = "OUI"
                tag = "TROUVÉ  "
                total_found += 1
            elif val_bool is False:
                display = "NON"
                tag = "TROUVÉ  "
                total_found += 1
            else:
                display = "(vide)"
                tag = "VIDE    "
                total_missing += 1

            conf_str = f" [conf={conf:.2f}]" if conf is not None else ""
            review_str = " ⚠️" if review else ""
            print(f"  {tag} {label}")
            print(f"           → {display}{conf_str}{review_str}")
            if excerpt:
                print(f"           excerpt: {excerpt[:70]}")
        else:
            total_missing += 1
            print(f"  ABSENT   {label}")

print(f"\n  → {total_found} trouvés, {total_missing} absents/vides sur {len(criteria)} critères")

# --- Recherche mots-clés dans le texte ---
print("\n\n🔍 MOTS-CLÉS PRÉSENTS DANS LE TEXTE")
print("-" * 70)
keywords = [
    ("juge", "Juge"),
    ("avocat", "Avocat"),
    ("chambre", "Chambre"),
    ("nationalit", "Nationalité"),
    ("né(e)|naissance|geboren", "Date de naissance"),
    ("annul", "Annulation"),
    ("refus", "Refus"),
    ("réfugié|vluchteling", "Statut réfugié"),
    ("protection subsidiaire|subsidiaire bescherming", "Protection subsidiaire"),
    ("mgf|excision|infibulation|mutilation", "MGF"),
    ("mariage forcé|gedwongen huwelijk", "Mariage forcé"),
    ("mineur|minderjarige|mena", "MENA/Mineur"),
    ("vulnérab|kwetsbaar", "Vulnérabilité"),
    ("fuite interne|interne vlucht", "Fuite interne"),
    ("crédibilit|geloofwaardig", "Crédibilité"),
]
for kw_pattern, label in keywords:
    import re
    match = re.search(kw_pattern, full_text, re.IGNORECASE)
    if match:
        idx = match.start()
        snippet = full_text[max(0, idx-20):idx+80].replace("\n", " ")
        print(f"  ✅ {label:<30} → ...{snippet}...")
    else:
        print(f"  ❌ {label:<30} → (absent du texte extrait)")
