"""
Diagnostic de l'état de la base : combien d'arrêts sont analysés avec valeurs LLM,
sans valeurs LLM, ou encore en attente. Aide à planifier R-Phase 11.

Usage :
    python check_db_state.py
"""
import os
import sys
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")

from supabase import create_client

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# ── 1. Charger tous les arrêts (paginé) ──────────────────────────────────────
arrets = []
page_size = 1000
offset = 0
while True:
    res = (
        sb.table("arrets")
        .select("id, numero, langue, statut_traitement")
        .range(offset, offset + page_size - 1)
        .execute()
    )
    batch = res.data or []
    arrets.extend(batch)
    if len(batch) < page_size:
        break
    offset += page_size

# ── 2. Charger tous les arret_id distincts ayant au moins une valeur LLM ────
arret_ids_with_values: set[str] = set()
offset = 0
while True:
    res = (
        sb.table("arret_criteria_values")
        .select("arret_id")
        .range(offset, offset + page_size - 1)
        .execute()
    )
    batch = res.data or []
    for row in batch:
        arret_ids_with_values.add(row["arret_id"])
    if len(batch) < page_size:
        break
    offset += page_size

# ── 3. Classifier les arrêts ──────────────────────────────────────────────────
# Catégories :
#   "ok"      : statut=termine ET au moins une valeur LLM → déjà analysé, ne pas retoucher
#   "no_llm"  : statut=termine MAIS zéro valeur LLM → à re-analyser
#   "pending" : statut=pending → jamais analysé
#   "erreur"  : statut=erreur → extraction échouée

cats: dict[str, list[dict]] = defaultdict(list)

for a in arrets:
    st = a.get("statut_traitement", "")
    has_llm = a["id"] in arret_ids_with_values
    if st == "termine" and has_llm:
        cats["ok"].append(a)
    elif st == "termine" and not has_llm:
        cats["no_llm"].append(a)
    elif st in ("pending", "en_attente"):
        cats["pending"].append(a)
    elif st == "erreur":
        cats["erreur"].append(a)
    else:
        cats[f"autre:{st}"].append(a)

# ── 4. Affichage ──────────────────────────────────────────────────────────────
total = len(arrets)
ok      = cats["ok"]
no_llm  = cats["no_llm"]
pending = cats["pending"]
erreur  = cats["erreur"]

print("=" * 60)
print("  DIAGNOSTIC BASE — R-Phase 11")
print("=" * 60)
print(f"\nTotal arrêts en base : {total}")
print(f"  ✅ analysés + valeurs LLM     : {len(ok)}")
print(f"  ⚠️  analysés SANS valeurs LLM : {len(no_llm)}")
print(f"  🕐 pending (jamais analysés)  : {len(pending)}")
print(f"  ❌ erreur extraction          : {len(erreur)}")

# Détail par langue des catégories qui comptent comme "cibles à analyser"
targets = no_llm + pending
fr_targets = [a for a in targets if a.get("langue") == "fr"]
nl_targets = [a for a in targets if a.get("langue") == "nl"]

print()
print(f"Cibles à analyser (no_llm + pending) : {len(targets)}")
print(f"  FR : {len(fr_targets)}")
print(f"  NL : {len(nl_targets)}")

needed = max(0, 50 - len(targets))
print()
if needed == 0:
    print(f"✅ Déjà {len(targets)} cibles disponibles — aucun scraping nécessaire avant analyse.")
else:
    print(f"⚠️  Il manque {needed} arrêt(s) pour atteindre 50 cibles.")
    print(f"   → Lancer : python scraper.py --lang fr --limit {needed + 5}  (marge de 5)")

# ── 5. Détail des arrêts sans valeurs LLM (pour décision) ────────────────────
if no_llm:
    print()
    print(f"Détail arrêts SANS valeurs LLM ({len(no_llm)}) :")
    print(f"  {'Numéro':<20}  {'Langue':<6}  Statut")
    print(f"  {'-'*20}  {'-'*6}  {'-'*10}")
    for a in sorted(no_llm, key=lambda x: x.get("numero", "")):
        print(f"  {a.get('numero','?'):<20}  {a.get('langue','?'):<6}  {a.get('statut_traitement','?')}")

# ── 6. Détail des pending ──────────────────────────────────────────────────────
if pending:
    print()
    print(f"Détail arrêts PENDING ({len(pending)}) :")
    print(f"  {'Numéro':<20}  {'Langue':<6}  Statut")
    print(f"  {'-'*20}  {'-'*6}  {'-'*10}")
    for a in sorted(pending, key=lambda x: x.get("numero", "")):
        print(f"  {a.get('numero','?'):<20}  {a.get('langue','?'):<6}  {a.get('statut_traitement','?')}")

# ── 7. Répartition langue des arrêts "ok" ─────────────────────────────────────
ok_fr = sum(1 for a in ok if a.get("langue") == "fr")
ok_nl = sum(1 for a in ok if a.get("langue") == "nl")
print()
print(f"Arrêts déjà analysés avec valeurs LLM : {len(ok)} (FR={ok_fr} / NL={ok_nl})")
print("=" * 60)
