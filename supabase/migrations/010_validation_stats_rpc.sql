-- ============================================================
-- Migration 010 : RPC get_arret_validation_stats
--
-- Contourne la limite max_rows=1000 de PostgREST.
-- Retourne les stats de validation agrégées par arrêt en un
-- seul appel, peu importe le nombre de valeurs en base.
-- ============================================================

create or replace function get_arret_validation_stats(p_arret_ids uuid[])
returns table(
  arret_id   uuid,
  total      bigint,
  validated  bigint,
  correct    bigint,
  incorrect  bigint,
  incertain  bigint
)
language sql stable security definer as $$
  select
    acv.arret_id,
    count(*)                                                           as total,
    count(acv.validation_status)                                       as validated,
    count(case when acv.validation_status = 'correct'   then 1 end)   as correct,
    count(case when acv.validation_status = 'incorrect' then 1 end)   as incorrect,
    count(case when acv.validation_status = 'incertain' then 1 end)   as incertain
  from arret_criteria_values acv
  where acv.arret_id = any(p_arret_ids)
  group by acv.arret_id
$$;

-- Permission d'exécution pour les utilisateurs authentifiés
grant execute on function get_arret_validation_stats(uuid[]) to authenticated;
