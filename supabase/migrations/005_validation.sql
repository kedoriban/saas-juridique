-- ============================================================
-- Phase 6 : Validation juridique des extractions LLM
-- ============================================================

-- Ajout des colonnes de validation sur arret_criteria_values
alter table arret_criteria_values
  add column if not exists evidence_excerpt  text,
  add column if not exists validation_status text
    check (validation_status in ('correct', 'incorrect', 'incertain', 'absent', 'a_revoir')),
  add column if not exists validation_note   text;

-- Index sur validation_status pour les requêtes de stats
create index if not exists acv_validation_status on arret_criteria_values (validation_status);

-- Politique de mise à jour élargie : admin et avocat peuvent valider
drop policy if exists "acv_update" on arret_criteria_values;

create policy "acv_update" on arret_criteria_values
  for update to authenticated
  using (
    is_admin()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'avocat')
    )
  );
