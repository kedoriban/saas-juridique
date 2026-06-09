import os, sys
from dotenv import load_dotenv
load_dotenv('../.env.local')
from supabase import create_client
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

arret_id = '1ba91c9f-0e06-443d-b4e4-492ddeb9f4fb'

# Total critères actifs FR
crit_fr = sb.table('criteria').select('id,label_original,language,llm_group,section_label').eq('language','fr').eq('active', True).execute()
print(f'=== Criteres actifs FR : {len(crit_fr.data)} ===')
for c in crit_fr.data:
    print(f'  {c["id"]} | {c["llm_group"]} | {c["label_original"][:60]}')

# Critères NL actifs
crit_nl = sb.table('criteria').select('id').eq('language','nl').eq('active', True).execute()
print(f'\n=== Criteres actifs NL : {len(crit_nl.data)} ===')

# Valeurs stockées pour cet arrêt
vals = sb.table('arret_criteria_values').select('criterion_id').eq('arret_id', arret_id).execute()
stored_ids = set(v['criterion_id'] for v in vals.data)
print(f'\n=== Valeurs stockees pour 341854 : {len(stored_ids)} ===')

# Manquants
all_fr_ids = set(c['id'] for c in crit_fr.data)
missing = all_fr_ids - stored_ids
extra = stored_ids - all_fr_ids
print(f'\n=== Criteres FR manquants : {len(missing)} ===')
for c in crit_fr.data:
    if c['id'] in missing:
        print(f'  MANQUANT: {c["id"]} | {c["llm_group"]} | {c["label_original"][:70]}')
if extra:
    print(f'\n=== IDs stockes mais absents de criteria FR actifs : {len(extra)} ===')
    for eid in extra:
        print(f'  {eid}')
