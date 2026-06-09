"""
Exporte les données d'un arrêt pour tester l'extraction manuelle dans ChatGPT.

Génère deux fichiers dans worker/exports/ :
  - <numero>_intermediate.json  : le JSON intermédiaire brut (sections extraites du PDF)
  - <numero>_prompts.json       : les prompts exacts envoyés au LLM (system + user par groupe)

Usage :
    python export_for_chatgpt.py 341946          # arrêt CCE 341946
    python export_for_chatgpt.py 342046          # arrêt RvV 342046
    python export_for_chatgpt.py --reference     # les 8 arrêts de référence
    python export_for_chatgpt.py --limit 3       # 3 premiers arrêts disponibles
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")

from supabase import create_client

from build_intermediate import IntermediateDocument
from prompts import build_prompt, select_sections

# ── Supabase ─────────────────────────────────────────────────────────────────
sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

REFERENCE_NUMBERS = [
    "341946", "341949", "341951", "341960",
    "341962", "341963", "342046", "342062",
]

GROUPS = [
    "metadata", "procedure", "identity",
    "profile_vulnerability", "decision_reasoning",
    "persecution_claims", "evidence_documents",
]


def fetch_arret(numero: str) -> dict | None:
    res = (
        sb.table("arrets")
        .select("id, numero, langue, intermediate_json, procedure_type")
        .ilike("numero", f"%{numero}%")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def fetch_criteria(language: str) -> list[dict]:
    res = (
        sb.table("criteria")
        .select("id, label_original, expected_value_type, llm_group, slug, order_index")
        .eq("language", language)
        .eq("active", True)
        .order("order_index")
        .execute()
    )
    return res.data or []


def export_arret(arret: dict, output_dir: Path) -> None:
    numero = arret["numero"].replace(" ", "_").replace("/", "-")
    langue = arret["langue"]
    procedure_type = arret.get("procedure_type") or "unknown"

    # ── 1. intermediate_json brut ────────────────────────────────────────────
    intermediate_raw = arret.get("intermediate_json") or {}
    intermediate_path = output_dir / f"{numero}_intermediate.json"
    with open(intermediate_path, "w", encoding="utf-8") as f:
        json.dump(intermediate_raw, f, ensure_ascii=False, indent=2)
    print(f"  → {intermediate_path.name}")

    # ── 2. Charger l'IntermediateDocument ───────────────────────────────────
    if not intermediate_raw:
        print(f"  ⚠️  Pas d'intermediate_json pour {arret['numero']} — export partiel")
        return

    try:
        doc = IntermediateDocument.from_dict(intermediate_raw)
    except Exception as e:
        print(f"  ❌ Erreur parse intermediate_json : {e}")
        return

    # ── 3. Critères ─────────────────────────────────────────────────────────
    criteria_all = fetch_criteria(langue)
    criteria_version = "intermediate-v1"

    # ── 4. Prompts par groupe ────────────────────────────────────────────────
    prompts_export = {
        "arret": arret["numero"],
        "langue": langue,
        "procedure_type": procedure_type,
        "note": (
            "Copiez le contenu de 'system' dans le champ System de ChatGPT, "
            "et le contenu de 'user' dans le message utilisateur. "
            "Attendez la réponse JSON puis passez au groupe suivant."
        ),
        "groups": [],
    }

    for group in GROUPS:
        criteria_group = [
            {
                "id": c["id"],
                "label": c["label_original"],
                "type": c["expected_value_type"],
            }
            for c in criteria_all
            if c.get("llm_group") == group
        ]
        if not criteria_group:
            continue

        sections = select_sections(doc, group)
        if not sections:
            prompts_export["groups"].append({
                "group": group,
                "criteria_count": len(criteria_group),
                "status": "SKIP — aucune section disponible",
                "system": None,
                "user": None,
            })
            continue

        system_prompt, user_prompt = build_prompt(
            arret_id=arret["id"],
            language=langue,
            criterion_version=criteria_version,
            group=group,
            criteria=criteria_group,
            sections=sections,
            procedure_type=procedure_type,
        )

        prompts_export["groups"].append({
            "group": group,
            "criteria_count": len(criteria_group),
            "sections_used": [s.section_id for s in sections],
            "chars_total": sum(len(s.text) for s in sections),
            "status": "OK",
            "system": system_prompt,
            "user": user_prompt,
        })

    prompts_path = output_dir / f"{numero}_prompts.json"
    with open(prompts_path, "w", encoding="utf-8") as f:
        json.dump(prompts_export, f, ensure_ascii=False, indent=2)
    print(f"  → {prompts_path.name}")

    # ── 5. Résumé ────────────────────────────────────────────────────────────
    ok = sum(1 for g in prompts_export["groups"] if g["status"] == "OK")
    skip = sum(1 for g in prompts_export["groups"] if "SKIP" in g.get("status", ""))
    print(f"     {ok} groupes exportés, {skip} groupes SKIP")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export arrêt pour test ChatGPT")
    parser.add_argument("numero", nargs="?", help="Numéro d'arrêt (ex: 341946)")
    parser.add_argument("--reference", action="store_true", help="Exporter les 8 arrêts de référence")
    parser.add_argument("--limit", type=int, help="Exporter les N premiers arrêts analysés")
    args = parser.parse_args()

    output_dir = Path(__file__).parent / "exports"
    output_dir.mkdir(exist_ok=True)

    if args.reference:
        numeros = REFERENCE_NUMBERS
    elif args.numero:
        numeros = [args.numero]
    elif args.limit:
        res = (
            sb.table("arrets")
            .select("numero")
            .eq("statut_traitement", "termine")
            .limit(args.limit)
            .execute()
        )
        numeros = [
            a["numero"].split()[-1]
            for a in (res.data or [])
        ]
    else:
        parser.print_help()
        return

    print(f"\nExport vers : {output_dir}")
    print(f"Arrêts à exporter : {len(numeros)}\n")

    for numero in numeros:
        arret = fetch_arret(numero)
        if not arret:
            print(f"[{numero}] ❌ Non trouvé en base")
            continue
        print(f"[{arret['numero']}] langue={arret['langue']} procédure={arret.get('procedure_type','?')}")
        export_arret(arret, output_dir)
        print()

    print(f"✅ Exports disponibles dans : {output_dir}")
    print()
    print("Comment utiliser dans ChatGPT :")
    print("  1. Ouvrez le fichier *_prompts.json")
    print("  2. Pour chaque groupe (metadata, identity, etc.) :")
    print("     - Copiez 'system' → collez dans le System prompt de ChatGPT")
    print("     - Copiez 'user'   → collez comme message utilisateur")
    print("     - Récupérez la réponse JSON")
    print("  3. Comparez avec RESULTAT ATTENDU.md")


if __name__ == "__main__":
    main()
