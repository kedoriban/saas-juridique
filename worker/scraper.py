"""
scraper.py — Scrape les arrêts publics du site CCE/RVV et insère les nouveaux dans Supabase.

Usage :
    python scraper.py                     # scrape les arrêts récents (max 50)
    python scraper.py --limit 100         # max 100 arrêts
    python scraper.py --page-start 0 --page-end 2   # pages 0 à 2 (50 par page)
    python scraper.py --dry-run           # affiche sans écrire en base

Ne déclenche PAS l'extraction PDF ni l'analyse LLM.
La langue est forcée via --lang (URL de filtre CCE/RVV). Détection par suffixe en fallback uniquement.
"""

import argparse
import os
import re
import sys
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL     = "https://www.rvv-cce.be"
LIST_PATH    = "/fr/arr"          # page FR — liste tous les arrêts (FR + NL)
HEADERS      = {"User-Agent": "Mozilla/5.0 (CCE-RVV SaaS scraper; contact: admin)"}
DELAY_SEC    = 1.5                # pause entre pages pour ne pas surcharger le serveur
MAX_RETRIES  = 2

# Chemins filtrés par langue
LANG_PATHS = {
    "fr": "/fr/arr/lang/french",
    "nl": "/fr/arr/lang/dutch",
    "de": "/fr/arr/lang/german",
}

# Mapping suffixe PDF → code langue ISO
LANG_MAP = {
    "fr_": "fr",
    "an_": "nl",
    "de_": "de",
    "en_": "en",
}

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def detect_language(pdf_url: str) -> str:
    """Détecte la langue depuis le suffixe de l'URL PDF."""
    for suffix, lang in LANG_MAP.items():
        if f".{suffix}.pdf" in pdf_url or f".{suffix}pdf" in pdf_url:
            return lang
    # Fallback : cherche le dernier segment avant .pdf
    m = re.search(r'a\d+\.(\w+)\.pdf', pdf_url)
    if m:
        raw = m.group(1).rstrip("_")
        return LANG_MAP.get(raw + "_", raw[:2])
    return "fr"


def parse_date(raw: str) -> str | None:
    """Convertit 'dd/mm/yyyy' ou 'yyyy-mm-dd...' en 'yyyy-mm-dd'."""
    raw = raw.strip()
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", raw)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
    if m:
        return m.group(1)
    return None


def parse_numero(text: str) -> str | None:
    """Extrait le numéro d'arrêt depuis 'Arrêt 342062 de ...'"""
    m = re.search(r"Arr[eê]t\s+(\d+)", text, re.IGNORECASE)
    return f"CCE {m.group(1)}" if m else None


def parse_page(html: str, lang_override: str | None = None) -> list[dict]:
    """Parse une page de résultats et retourne une liste de dicts arrêt.

    Si lang_override est fourni (ex: "fr"), la langue est forcée à cette valeur
    pour tous les arrêts (l'URL de filtre garantit déjà la bonne langue).
    """
    soup = BeautifulSoup(html, "lxml")
    results = []

    for li in soup.select("li[class*='views-row']"):
        try:
            # Collecter tous les liens PDF du li (potentiellement un par langue)
            all_pdf_anchors = [
                a for a in li.find_all("a", href=True)
                if "/arr/" in a.get("href", "") and ".pdf" in a.get("href", "").lower()
            ]
            if not all_pdf_anchors:
                continue

            chosen = all_pdf_anchors[0]

            pdf_url = chosen.get("href", "").strip()
            if not pdf_url:
                continue

            # Numéro (depuis le premier lien qui a du texte contenant un numéro)
            numero = None
            for a in all_pdf_anchors:
                numero = parse_numero(a.get_text())
                if numero:
                    break
            if not numero:
                continue

            # Date depuis l'attribut ISO du span (cherché dans tout le li)
            span_date = li.select_one("span.date-display-single")
            date_iso = None
            if span_date:
                content = span_date.get("content", "")
                date_iso = parse_date(content) if content else parse_date(span_date.get_text())
            if not date_iso:
                date_iso = parse_date(chosen.get_text())

            # Procédure (matière)
            proc_el = li.select_one(".views-field-field-procedure strong")
            matiere = proc_el.get_text(strip=True) if proc_el else None

            # Pays d'origine — NavigableString "Pays d'origine:" suivi d'un <strong>
            # comme siblings directs du <li> (pas de div englobante)
            pays = None
            from bs4 import NavigableString as NS
            for node in li.children:
                if isinstance(node, NS) and "Pays" in node:
                    sibling = node.find_next_sibling("strong")
                    if sibling:
                        pays = sibling.get_text(strip=True)
                    break

            # Composition (chambre)
            comp_el = li.select_one(".views-field-field-composition strong")
            chambre = comp_el.get_text(strip=True) if comp_el else None

            # Langue : forcée si URL filtrée, sinon détectée depuis le suffixe PDF
            langue = lang_override if lang_override else detect_language(pdf_url)

            results.append({
                "numero":        numero,
                "date_arret":    date_iso,
                "langue":        langue,
                "chambre":       chambre,
                "matiere":       matiere,
                "pays_origine":  pays,
                "pdf_url":       pdf_url,
                "statut_traitement": "en_attente",
            })
        except Exception as e:
            print(f"  [WARN] Ligne ignorée : {e}", file=sys.stderr)
            continue

    return results


# ---------------------------------------------------------------------------
# Fetch avec retry
# ---------------------------------------------------------------------------

def fetch_page(page_num: int, list_path: str = LIST_PATH) -> str | None:
    url = f"{BASE_URL}{list_path}?page={page_num}"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                return r.text
            print(f"  HTTP {r.status_code} sur page {page_num} (tentative {attempt})")
        except requests.RequestException as e:
            print(f"  Erreur réseau page {page_num} (tentative {attempt}) : {e}")
        if attempt < MAX_RETRIES:
            time.sleep(2)
    return None


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

def load_existing_numeros(client) -> set[str]:
    """Retourne l'ensemble des numéros déjà en base."""
    res = client.table("arrets").select("numero").execute()
    return {row["numero"] for row in (res.data or [])}


def upsert_arrets(client, arrets: list[dict]) -> int:
    """Insère les arrêts (upsert sur numero). Retourne le nombre traité."""
    if not arrets:
        return 0
    res = client.table("arrets").upsert(arrets, on_conflict="numero").execute()
    return len(res.data or [])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv("../.env.local")

    parser = argparse.ArgumentParser(description="Scrape les arrêts CCE/RVV")
    parser.add_argument("--limit",      type=int, default=50,  help="Nombre max d'arrêts à insérer (défaut: 50)")
    parser.add_argument("--page-start", type=int, default=0,   help="Page de départ (0-indexé)")
    parser.add_argument("--page-end",   type=int, default=None, help="Page de fin (incluse). Défaut: calculé depuis --limit")
    parser.add_argument("--dry-run",    action="store_true",   help="Affiche sans écrire en base")
    parser.add_argument("--force",      action="store_true",   help="Upsert même les arrêts déjà en base")
    parser.add_argument("--lang",       type=str, default=None, choices=["fr", "nl", "de"], help="Filtre par langue (ex: fr → /fr/arr/lang/french)")
    parser.add_argument("--year",       type=int, default=None, help="Filtre par année (ex: 2026 → ajoute /date/2026 au chemin)")
    parser.add_argument("--debug-html", action="store_true",   help="Imprime le HTML brut des 2 premiers li puis quitte")
    parser.add_argument("--list-path",  type=str, default=None, help="Surcharge le chemin URL complet")
    args = parser.parse_args()

    if args.list_path:
        list_path = args.list_path
    elif args.lang:
        list_path = LANG_PATHS[args.lang]
        if args.year:
            list_path += f"/date/{args.year}"
    elif args.year:
        list_path = f"{LIST_PATH}/date/{args.year}"
    else:
        list_path = LIST_PATH

    if args.lang or args.year:
        print(f"  URL filtrée : {BASE_URL}{list_path}")

    # Calcul automatique de page-end
    # Avec --lang : scanner jusqu'à 50 pages (sortie anticipée dès que --limit est atteint)
    # Sans --lang : 1 page suffit pour 50 arrêts
    if args.lang and args.page_end is None:
        pages_needed = 50
    else:
        pages_needed = (args.limit + 49) // 50
    page_end = args.page_end if args.page_end is not None else args.page_start + pages_needed - 1

    year_label = f"/{args.year}" if args.year else ""
    print(f"Scraper CCE/RVV — pages {args.page_start}→{page_end} | limit={args.limit} | lang={args.lang or 'tous'}{year_label} | dry_run={args.dry_run}")

    # Connexion Supabase
    client = None
    existing: set[str] = set()
    if not args.dry_run:
        url_sb = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key_sb = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url_sb or not key_sb:
            print("ERREUR : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.", file=sys.stderr)
            sys.exit(1)
        client = create_client(url_sb, key_sb)
        if not args.force:
            existing = load_existing_numeros(client)
            print(f"  {len(existing)} arrêts déjà en base (ignorés sauf --force)")

    # Mode debug : affiche le HTML brut des 2 premiers li et quitte
    if args.debug_html:
        html = fetch_page(args.page_start, list_path)
        if html:
            soup = BeautifulSoup(html, "lxml")
            # Essai 1 : sélecteur habituel
            rows = soup.select("li[class*='views-row']")
            label = "views-row"
            # Essai 2 : tous les li avec une classe
            if not rows:
                rows = [li for li in soup.find_all("li") if li.get("class")]
                label = "li[class]"
            # Essai 3 : tous les li
            if not rows:
                rows = soup.find_all("li")
                label = "li (sans classe)"
            print(f"  Sélecteur utilisé : {label} → {len(rows)} éléments trouvés")
            for i, li in enumerate(rows[:2]):
                print(f"\n{'='*60} LI #{i+1} {'='*60}")
                print(li.prettify())
        return

    collected:  list[dict] = []
    inserted_total = 0

    for page_num in range(args.page_start, page_end + 1):
        if len(collected) >= args.limit:
            break

        print(f"\n  Page {page_num}…", end=" ", flush=True)
        html = fetch_page(page_num, list_path)
        if not html:
            print("ECHEC — arrêt du scrape.")
            break

        rows = parse_page(html, lang_override=args.lang)
        print(f"{len(rows)} arrêts{'  [' + args.lang + ']' if args.lang else ''} parsés", end="")

        # Filtrage nouveaux
        if not args.force and not args.dry_run:
            new_rows = [r for r in rows if r["numero"] not in existing]
            print(f" — {len(new_rows)} nouveaux", end="")
        else:
            new_rows = rows

        # Limite globale
        remaining = args.limit - len(collected)
        new_rows = new_rows[:remaining]
        collected.extend(new_rows)

        if args.dry_run:
            for r in new_rows:
                print(f"\n    {r['numero']} | {r['date_arret']} | {r['langue']} | {r['matiere']} | {r['pays_origine']} | {r['pdf_url']}")
        else:
            if new_rows:
                n = upsert_arrets(client, new_rows)
                inserted_total += n
                existing.update(r["numero"] for r in new_rows)
                print(f" — {n} insérés", end="")

        print()

        if page_num < page_end and len(collected) < args.limit:
            time.sleep(DELAY_SEC)

    # Résumé
    print(f"\n{'[DRY-RUN] ' if args.dry_run else ''}Résumé : {len(collected)} arrêts collectés", end="")
    if not args.dry_run:
        print(f", {inserted_total} insérés/mis à jour en base.")
    else:
        print(" (aucune écriture).")

    # Rappel blocage traitement massif
    if not args.dry_run and inserted_total > 0:
        print(
            "\n⚠  Rappel : ne lancez PAS main.py + analyze.py sur plus de 100 arrêts"
            "\n   avant validation juridique de la qualité d'extraction (phase 6)."
        )


if __name__ == "__main__":
    main()
