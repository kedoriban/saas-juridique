-- ============================================================
-- Phase 2 : Critères d'analyse FR/NL
-- ============================================================

-- Versions des référentiels critères (une par langue + version_label)
create table if not exists criterion_versions (
  id            uuid    primary key default gen_random_uuid(),
  language      text    not null check (language in ('fr', 'nl')),
  version_label text    not null,
  source_filename text,
  status        text    not null default 'active' check (status in ('active', 'archived')),
  activated_at  timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid    references auth.users(id) on delete set null,
  unique (language, version_label)
);

-- Critères individuels liés à une version
create table if not exists criteria (
  id                   text    primary key,  -- ex: "fr_001_date_de_l_arret"
  criterion_version_id uuid    not null references criterion_versions(id) on delete restrict,
  language             text    not null check (language in ('fr', 'nl')),
  order_index          integer not null,
  section_slug         text    not null,
  section_label        text    not null,
  label_original       text    not null,
  detail_original      text,
  expected_value_type  text,
  llm_group            text,
  slug                 text,
  active               boolean not null default true,
  source_file          text,
  source_sheet         text,
  source_rows          integer[],
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists criteria_language_order on criteria (language, order_index);
create index if not exists criteria_section       on criteria (language, section_slug);
create index if not exists criteria_active        on criteria (language, active);
create index if not exists criteria_llm_group     on criteria (language, llm_group);

-- Journal d'audit minimal (activations / désactivations)
create table if not exists criterion_audit_logs (
  id            uuid    primary key default gen_random_uuid(),
  criterion_id  text    not null references criteria(id) on delete cascade,
  changed_by    uuid    references auth.users(id) on delete set null,
  changed_at    timestamptz not null default now(),
  action        text    not null check (action in ('activated', 'deactivated', 'created', 'updated')),
  previous_value jsonb,
  new_value      jsonb
);

create index if not exists audit_criterion_id on criterion_audit_logs (criterion_id);
create index if not exists audit_changed_at   on criterion_audit_logs (changed_at desc);

-- Trigger updated_at sur criteria
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists criteria_updated_at on criteria;
create trigger criteria_updated_at
  before update on criteria
  for each row execute function update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table criterion_versions  enable row level security;
alter table criteria             enable row level security;
alter table criterion_audit_logs enable row level security;

-- criterion_versions : lecture pour tous les authentifiés, écriture admin
create policy "cv_select" on criterion_versions
  for select to authenticated using (true);

create policy "cv_insert" on criterion_versions
  for insert to authenticated with check (is_admin());

create policy "cv_update" on criterion_versions
  for update to authenticated using (is_admin());

-- criteria : lecture pour tous les authentifiés, écriture admin
create policy "criteria_select" on criteria
  for select to authenticated using (true);

create policy "criteria_insert" on criteria
  for insert to authenticated with check (is_admin());

create policy "criteria_update" on criteria
  for update to authenticated using (is_admin());

-- audit_logs : lecture admin, insertion par tout authentifié (via server action)
create policy "audit_select" on criterion_audit_logs
  for select to authenticated using (is_admin());

create policy "audit_insert" on criterion_audit_logs
  for insert to authenticated with check (true);
