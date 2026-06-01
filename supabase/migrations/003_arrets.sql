-- ============================================================
-- Phase 3 : Arrêts CCE/RVV et valeurs de critères
-- ============================================================

-- Table principale des arrêts
create table if not exists arrets (
  id                uuid        primary key default gen_random_uuid(),
  numero            text        not null unique,
  date_arret        date        not null,
  langue            text        not null check (langue in ('fr', 'nl')),
  chambre           text,
  matiere           text,
  pays_origine      text,
  pdf_url           text,
  resume            text,
  statut_traitement text        not null default 'en_attente'
                    check (statut_traitement in ('en_attente', 'en_cours', 'termine', 'erreur')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists arrets_date     on arrets (date_arret desc);
create index if not exists arrets_langue   on arrets (langue);
create index if not exists arrets_matiere  on arrets (matiere);
create index if not exists arrets_pays     on arrets (pays_origine);
create index if not exists arrets_statut   on arrets (statut_traitement);

-- Valeurs extraites par le LLM pour chaque couple arrêt / critère
create table if not exists arret_criteria_values (
  id             uuid    primary key default gen_random_uuid(),
  arret_id       uuid    not null references arrets(id) on delete cascade,
  criterion_id   text    not null references criteria(id) on delete restrict,
  value_text     text,
  value_boolean  boolean,
  confidence     real    check (confidence >= 0 and confidence <= 1),
  model_run_id   uuid,
  validated_by   uuid    references auth.users(id) on delete set null,
  validated_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (arret_id, criterion_id)
);

create index if not exists acv_arret     on arret_criteria_values (arret_id);
create index if not exists acv_criterion on arret_criteria_values (criterion_id);

-- Suivi des traitements (extraction texte, analyse LLM, etc.)
create table if not exists processing_jobs (
  id             uuid    primary key default gen_random_uuid(),
  arret_id       uuid    not null references arrets(id) on delete cascade,
  job_type       text    not null check (job_type in ('scrape', 'extract_text', 'analyze')),
  status         text    not null default 'pending'
                 check (status in ('pending', 'running', 'done', 'error')),
  started_at     timestamptz,
  finished_at    timestamptz,
  error_message  text,
  created_at     timestamptz not null default now()
);

create index if not exists pj_arret  on processing_jobs (arret_id);
create index if not exists pj_status on processing_jobs (status);

-- Méta des exécutions LLM (tokens, durée, modèle utilisé)
create table if not exists model_runs (
  id                uuid    primary key default gen_random_uuid(),
  arret_id          uuid    not null references arrets(id) on delete cascade,
  model_name        text    not null,
  model_version     text,
  prompt_tokens     integer,
  completion_tokens integer,
  duration_ms       integer,
  status            text    not null default 'done'
                    check (status in ('done', 'error')),
  created_at        timestamptz not null default now()
);

create index if not exists mr_arret on model_runs (arret_id);

-- FK différée : model_runs est créé après arret_criteria_values
alter table arret_criteria_values
  add constraint acv_model_run_fk
  foreign key (model_run_id) references model_runs(id) on delete set null;

-- Trigger updated_at sur arrets (réutilise la fonction créée en phase 2)
drop trigger if exists arrets_updated_at on arrets;
create trigger arrets_updated_at
  before update on arrets
  for each row execute function update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table arrets                enable row level security;
alter table arret_criteria_values enable row level security;
alter table processing_jobs       enable row level security;
alter table model_runs            enable row level security;

-- arrets : lecture pour tous les authentifiés, écriture admin
create policy "arrets_select" on arrets
  for select to authenticated using (true);

create policy "arrets_insert" on arrets
  for insert to authenticated with check (is_admin());

create policy "arrets_update" on arrets
  for update to authenticated using (is_admin());

-- arret_criteria_values : lecture pour tous, écriture admin
create policy "acv_select" on arret_criteria_values
  for select to authenticated using (true);

create policy "acv_insert" on arret_criteria_values
  for insert to authenticated with check (is_admin());

create policy "acv_update" on arret_criteria_values
  for update to authenticated using (is_admin());

-- processing_jobs et model_runs : lecture et écriture admin uniquement
create policy "pj_select" on processing_jobs
  for select to authenticated using (is_admin());

create policy "pj_insert" on processing_jobs
  for insert to authenticated with check (is_admin());

create policy "mr_select" on model_runs
  for select to authenticated using (is_admin());

create policy "mr_insert" on model_runs
  for insert to authenticated with check (is_admin());
