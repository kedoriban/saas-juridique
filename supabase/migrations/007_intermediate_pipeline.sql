-- ============================================================
-- Migration 007 : Réorientation pipeline de prétraitement
--
-- Ajoute les champs produits par les nouveaux modules :
--   detect_language, classify_procedure, build_intermediate
--
-- À appliquer via Supabase SQL Editor (coller et exécuter).
-- Idempotent : toutes les clauses utilisent IF NOT EXISTS.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Table arrets
-- ------------------------------------------------------------

-- Type de procédure classifié par regex (avant LLM)
ALTER TABLE arrets
  ADD COLUMN IF NOT EXISTS procedure_type text;

-- Langue détectée depuis le texte (vs langue forcée par le scraper)
ALTER TABLE arrets
  ADD COLUMN IF NOT EXISTS language_detected text;

-- JSON intermédiaire stable : sortie de build_intermediate()
-- Contient : document, extraction_quality, metadata_detected,
--            applicants_detection, applicants, sections (avec textes)
ALTER TABLE arrets
  ADD COLUMN IF NOT EXISTS intermediate_json jsonb;

-- Contrainte sur procedure_type (ajout conditionnel)
DO $$ BEGIN
  ALTER TABLE arrets ADD CONSTRAINT arrets_procedure_type_check
    CHECK (procedure_type IS NULL OR procedure_type IN (
      'protection_internationale_fond',
      'dublin_transfert',
      'oqt_extreme_urgence',
      'sejour_visa_regroupement',
      'autre_non_supporte',
      'unknown'
    ));
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Contrainte déjà présente, ignorer
END $$;

-- Contrainte sur language_detected (ajout conditionnel)
DO $$ BEGIN
  ALTER TABLE arrets ADD CONSTRAINT arrets_language_detected_check
    CHECK (language_detected IS NULL OR language_detected IN ('fr', 'nl', 'unknown'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Index pour filtrer par procédure et langue détectée
CREATE INDEX IF NOT EXISTS arrets_procedure_type
  ON arrets (procedure_type);

CREATE INDEX IF NOT EXISTS arrets_language_detected
  ON arrets (language_detected);


-- ------------------------------------------------------------
-- 2. Table arret_segments
-- ------------------------------------------------------------

-- Autorité source de la section (qui a produit ce texte)
ALTER TABLE arret_segments
  ADD COLUMN IF NOT EXISTS authority text
  CHECK (authority IN (
    'CCE', 'RvV', 'CGRA', 'CGVS', 'OE', 'DVZ', 'applicant', 'unknown'
  ) OR authority IS NULL);

-- Titre de section tel que détecté dans le document
ALTER TABLE arret_segments
  ADD COLUMN IF NOT EXISTS section_title text;

-- Index sur authority (utile pour cibler les sections CCE vs CGRA)
CREATE INDEX IF NOT EXISTS as_authority
  ON arret_segments (authority);


-- ------------------------------------------------------------
-- 3. Table model_runs
-- ------------------------------------------------------------

-- Version de la grille de critères utilisée pour l'analyse
ALTER TABLE model_runs
  ADD COLUMN IF NOT EXISTS criteria_schema_version text;

-- Version du prompt LLM utilisé
ALTER TABLE model_runs
  ADD COLUMN IF NOT EXISTS analysis_prompt_version text;


-- ------------------------------------------------------------
-- Commentaires de documentation
-- ------------------------------------------------------------

COMMENT ON COLUMN arrets.procedure_type IS
  'Type de procédure classifié par regex depuis le texte PDF. '
  'Valeurs : protection_internationale_fond | dublin_transfert | '
  'oqt_extreme_urgence | sejour_visa_regroupement | autre_non_supporte | unknown';

COMMENT ON COLUMN arrets.language_detected IS
  'Langue détectée depuis le contenu textuel du PDF (fr/nl/unknown). '
  'Peut différer de arrets.langue qui est forcée par le scraper.';

COMMENT ON COLUMN arrets.intermediate_json IS
  'JSON intermédiaire complet produit par build_intermediate(). '
  'Contient toutes les métadonnées, sections et données structurelles '
  'avant l''analyse LLM. Utilisé par analyze.py comme source de vérité.';

COMMENT ON COLUMN arret_segments.authority IS
  'Autorité source de la section : qui a produit ce texte dans l''arrêt. '
  'CCE/RvV = Conseil, CGRA/CGVS = Commissaire général, '
  'OE/DVZ = Office des étrangers, applicant = partie requérante.';

COMMENT ON COLUMN arret_segments.section_title IS
  'Titre de section tel que détecté dans le document PDF (ex: "A. Faits invoqués").';

COMMENT ON COLUMN model_runs.criteria_schema_version IS
  'Identifiant de version de la grille de critères (ex: 2026-06-legal-grid-v1). '
  'Permet de retracer quelle version a produit quels résultats.';

COMMENT ON COLUMN model_runs.analysis_prompt_version IS
  'Identifiant de version du prompt LLM utilisé pour l''analyse '
  '(ex: ollama-cce-v1). Permet de retracer les changements de prompts.';
