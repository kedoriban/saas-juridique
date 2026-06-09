import os
from dotenv import load_dotenv
load_dotenv('../.env.local')
from supabase import create_client
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

arret_id = '1ba91c9f-0e06-443d-b4e4-492ddeb9f4fb'

# Simuler exactement la requête de la page validation detail
vals = sb.table('arret_criteria_values').select(
    'id,criterion_id,value_text,value_boolean,confidence,validation_status,'
    'criteria(label_original,section_label,language,llm_group,expected_value_type)'
).eq('arret_id', arret_id).order('created_at').execute()

print(f'Rows retournées par la page : {len(vals.data)}')
print()

# Grouper par section comme la page
by_section = {}
for r in vals.data:
    crit = r.get('criteria') or {}
    s = crit.get('section_label') or 'Autre'
    by_section.setdefault(s, []).append(r)

for section, rows in sorted(by_section.items()):
    print(f'  [{section}] : {len(rows)} critères')
    for r in rows:
        crit = r.get('criteria') or {}
        label = crit.get('label_original', 'SANS LABEL')[:55]
        cid = r['criterion_id']
        print(f'    - {cid} | {label}')
print()

# Critères sans join criteria
sans_join = [r for r in vals.data if not r.get('criteria')]
if sans_join:
    print(f'ATTENTION : {len(sans_join)} valeurs sans criteria joint :')
    for r in sans_join:
        print(f'  criterion_id={r["criterion_id"]}')
else:
    print('OK : tous les criteria sont bien joints.')

# Vérifier si la page Supabase limite à 1000 par défaut
print(f'\nTotal rows: {len(vals.data)} (limite Supabase par défaut: 1000)')
