-- ============================================================
-- Phase 4 : Extraction PDF — métadonnées et segments texte
-- ============================================================

-- Métadonnées d'extraction (une ligne par arrêt)
create table if not exists arret_extractions (
  id                uuid        primary key default gen_random_uuid(),
  arret_id          uuid        not null references arrets(id) on delete cascade,
  extraction_method text        check (extraction_method in ('pymupdf', 'pdfplumber', 'ocr', 'failed')),
  page_count        integer,
  char_count        integer,
  is_scanned        boolean     not null default false,
  text_hash         text,
  error_message     text,
  extracted_at      timestamptz not null default now(),
  unique (arret_id)
);

create index if not exists ae_arret on arret_extractions (arret_id);

-- Segments texte découpés par section juridique
create table if not exists arret_segments (
  id            uuid        primary key default gen_random_uuid(),
  arret_id      uuid        not null references arrets(id) on delete cascade,
  segment_index integer     not null,
  section       text,
  text          text        not null,
  page_start    integer,
  page_end      integer,
  quality_score real        check (quality_score >= 0 and quality_score <= 1),
  created_at    timestamptz not null default now(),
  unique (arret_id, segment_index)
);

create index if not exists as_arret   on arret_segments (arret_id);
create index if not exists as_section on arret_segments (section);

-- ============================================================
-- RLS
-- ============================================================

alter table arret_extractions enable row level security;
alter table arret_segments     enable row level security;

-- Lecture : tous les authentifiés ; écriture : admin uniquement
create policy "ae_select" on arret_extractions
  for select to authenticated using (true);

create policy "ae_insert" on arret_extractions
  for insert to authenticated with check (is_admin());

create policy "ae_update" on arret_extractions
  for update to authenticated using (is_admin());

create policy "as_select" on arret_segments
  for select to authenticated using (true);

create policy "as_insert" on arret_segments
  for insert to authenticated with check (is_admin());

create policy "as_delete" on arret_segments
  for delete to authenticated using (is_admin());
