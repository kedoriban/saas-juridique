"""
Calcule un score de couverture pour les 8 arrêts de référence.

Compare les valeurs extraites en DB (arret_criteria_values) par groupe LLM.
Affiche : couverture par groupe, critères clés, tableau récap.

Usage :
  python score_reference.py
  python score_reference.py --verbose   # affiche les valeurs extraites par critère
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
from supabase import create_client

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

VERBOSE = "--verbose" in sys.argv

REFERENCE_NUMEROS = [
    "341946", "341949", "341951", "341960", "341962", "341963", "342046", "342062",
]

# Critères jugés "clés" pour la décision de validation avocate
KEY_CRITERIA_FR = {
    "fr_001": "Date arrêt",
    "fr_002": "N° arrêt",
    "fr_003": "Juge",
    "fr_004": "Avocat",
    "fr_005": "Chambre",
    "fr_007": "Nationalité",
    "fr_008": "Ethnie",
    "fr_011": "Sexe",
    "fr_021": "Crédibilité",
    "fr_022": "Art. 48/7",
    "fr_025": "Motivation CCE",
    "fr_026": "Conclusion CGRA",
    "fr_027": "Protection nationale",
    "fr_028": "Fuite interne",
    "fr_033": "COI cités",
}
KEY_CRITERIA_NL = {
    "nl_001": "Datum arrest",
    "nl_002": "Nummer arrest",
    "nl_003": "Rechter",
    "nl_004": "Advocaat",
    "nl_005": "Kamer",
    "nl_007": "Nationaliteit",
    "nl_021": "Geloofwaardigheid",
    "nl_025": "Motivering RvV",
    "nl_026": "Conclusie CGVS",
}

# --------------------------------------------------------------------------
# 1. Récupérer les 8 arrêts de référence
# --------------------------------------------------------------------------
arrets = {}
for num in REFERENCE_NUMEROS:
    r = sb.table("arrets").select("id, numero, langue").ilike("numero", f"%{num}%").limit(1).execute()
    if r.data:
        a = r.data[0]
        arrets[a["id"]] = {"numero": a["numero"], "langue": a["langue"]}

if not arrets:
    print("Aucun arrêt de référence trouvé en base.")
    sys.exit(1)

print(f"Arrêts de référence trouvés : {len(arrets)}/8")

# --------------------------------------------------------------------------
# 2. Récupérer tous les critères actifs avec leur groupe
# --------------------------------------------------------------------------
crit_res = sb.table("criteria").select("id, slug, label_original, llm_group, language, active").eq("active", True).execute()
criteria_by_id = {c["id"]: c for c in crit_res.data}
total_criteria_fr = sum(1 for c in crit_res.data if c["language"] == "fr")
total_criteria_nl = sum(1 for c in crit_res.data if c["language"] == "nl")

# --------------------------------------------------------------------------
# 3. Récupérer toutes les valeurs pour les 8 arrêts
# --------------------------------------------------------------------------
arret_ids = list(arrets.keys())
values_res = sb.table("arret_criteria_values").select(
    "arret_id, criterion_id, value_text, value_boolean, confidence, source_section"
).in_("arret_id", arret_ids).execute()

# Indexer par (arret_id, criterion_id)
values_index: dict[tuple, dict] = {}
for v in values_res.data:
    values_index[(v["arret_id"], v["criterion_id"])] = v

# --------------------------------------------------------------------------
# 4. Calculer les scores
# --------------------------------------------------------------------------
def has_value(v: dict) -> bool:
    """Vrai si la valeur extraite est non nulle et non vide."""
    return bool(v.get("value_text")) or v.get("value_boolean") is not None

print("\n" + "=" * 80)
print(f"{'ARRÊT':25s}  {'LANG':4s}  {'TOTAL':7s}  {'MÉTA':6s}  {'IDENT':6s}  {'DÉCIS':6s}  {'PROFIL':7s}  {'PERSÉC':7s}  {'DOCS':5s}")
print("=" * 80)

global_covered = 0
global_total = 0

for arret_id, info in sorted(arrets.items(), key=lambda x: x[1]["numero"]):
    num = info["numero"]
    lang = info["langue"]
    lang_key = lang if lang in ("fr", "nl") else "fr"
    total_crit = total_criteria_fr if lang_key == "fr" else total_criteria_nl

    # Valeurs extraites pour cet arrêt
    covered = sum(
        1 for (aid, cid), v in values_index.items()
        if aid == arret_id and has_value(v)
    )

    # Par groupe
    groups: dict[str, tuple[int, int]] = {}
    for (aid, cid), v in values_index.items():
        if aid != arret_id:
            continue
        crit = criteria_by_id.get(cid)
        if not crit:
            continue
        g = crit.get("llm_group", "?")
        found, tot = groups.get(g, (0, 0))
        groups[g] = (found + (1 if has_value(v) else 0), tot + 1)

    def fmt(g):
        f, t = groups.get(g, (0, 0))
        if t == 0:
            return "  -   "
        pct = int(100 * f / t)
        return f"{f:2d}/{t:2d} {pct:2d}%"

    pct_global = int(100 * covered / total_crit) if total_crit else 0
    print(
        f"{num:25s}  {lang:4s}  {covered:3d}/{total_crit:3d} {pct_global:2d}%  "
        f"{fmt('metadata')}  {fmt('identity')}  {fmt('decision_reasoning')}  "
        f"{fmt('profile_vulnerability')}  {fmt('persecution_claims')}  {fmt('evidence_documents')}"
    )

    global_covered += covered
    global_total += total_crit

    if VERBOSE:
        keys = KEY_CRITERIA_FR if lang == "fr" else KEY_CRITERIA_NL
        print(f"  Critères clés :")
        for cid_prefix, label in keys.items():
            # Trouver le critère correspondant
            matching = [c for c in crit_res.data if c["id"].startswith(cid_prefix) and c["language"] == lang]
            if not matching:
                print(f"    {label:25s}: [critère introuvable]")
                continue
            full_id = matching[0]["id"]
            v = values_index.get((arret_id, full_id))
            if not v:
                print(f"    {label:25s}: ABSENT")
            elif not has_value(v):
                print(f"    {label:25s}: VIDE (conf={v.get('confidence', '?')})")
            else:
                val = v.get("value_text") or str(v.get("value_boolean"))
                trunc = (val or "")[:60].replace("\n", " ")
                print(f"    {label:25s}: {trunc}")
        print()

print("=" * 80)
if global_total:
    pct = int(100 * global_covered / global_total)
    print(f"{'TOTAL':25s}  {'':4s}  {global_covered:3d}/{global_total:3d} {pct:2d}%")

print(f"""
Seuil recommandé avant relecture avocate :
  ≥ 75% couverture globale sur les DPI (341946, 341960, 341962, 342046)
  ≥ 90% sur metadata (fr_001–fr_005 / nl_001–nl_005)
  fr_025/nl_025 (Motivation CCE/RvV) non vide sur ≥ 2 arrêts DPI
""")
