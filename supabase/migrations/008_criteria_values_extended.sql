-- ============================================================
-- Migration 008 : Champs étendus sur arret_criteria_values — R-Phase 2
--
-- Ajoute les colonnes produites par le nouveau analyze.py :
--   source_authority   — autorité source de l'information extraite
--   source_section     — section_id de la section source
--   needs_human_review — signale les critères à révision humaine recommandée
--
-- À appliquer AVANT de lancer la nouvelle version de analyze.py.
-- Idempotent : toutes les clauses utilisent IF NOT EXISTS.
-- ============================================================


-- Autorité source de l'information extraite par le LLM
ALTER TABLE arret_criteria_values
  ADD COLUMN IF NOT EXISTS source_authority text;

-- Section source (section_id du JSON intermédiaire, ex: article_48_7, faits_invokes)
ALTER TABLE arret_criteria_values
  ADD COLUMN IF NOT EXISTS source_section text;

-- Vrai si le LLM a signalé une ambiguïté, contradiction ou inférence
ALTER TABLE arret_criteria_values
  ADD COLUMN IF NOT EXISTS needs_human_review boolean NOT NULL DEFAULT false;


-- Contrainte sur source_authority
DO $$ BEGIN
  ALTER TABLE arret_criteria_values ADD CONSTRAINT acv_source_authority_check
    CHECK (source_authority IS NULL OR source_authority IN (
      'CCE', 'RvV', 'CGRA', 'CGVS', 'OE', 'DVZ', 'applicant', 'unknown'
    ));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Index pour filtrer les critères à révision humaine
CREATE INDEX IF NOT EXISTS acv_needs_human_review
  ON arret_criteria_values (needs_human_review)
  WHERE needs_human_review = true;


-- Commentaires
COMMENT ON COLUMN arret_criteria_values.source_authority IS
  'Autorité source de l''information extraite (CCE, CGRA, CGVS, etc.). '
  'Renseigné par analyze.py R-Phase 2.';

COMMENT ON COLUMN arret_criteria_values.source_section IS
  'Identifiant de la section source dans le JSON intermédiaire '
  '(article_48_7, faits_invokes, etc.). Renseigné par analyze.py R-Phase 2.';

COMMENT ON COLUMN arret_criteria_values.needs_human_review IS
  'Vrai si le LLM a retourné status ambiguous/conflicting/inferred/error. '
  'Utile pour prioriser la relecture avocate.';
