-- Migration 009 : champs UI manquants pour l'alignement Figma

-- Table arrets : champs UI manquants
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS is_focus boolean NOT NULL DEFAULT false;
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS source_juridiction text;
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS type_decision text
  CHECK (type_decision IS NULL OR type_decision IN (
    'annulation', 'plein_contentieux', 'confirmation', 'refus', 'irrecevabilite', 'autre'
  ));
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS resume_ai text;
ALTER TABLE arrets ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS arrets_is_focus ON arrets (is_focus) WHERE is_focus = true;
CREATE INDEX IF NOT EXISTS arrets_type_decision ON arrets (type_decision);

-- Table criteria : champs UI manquants
ALTER TABLE criteria ADD COLUMN IF NOT EXISTS effet_date date;
ALTER TABLE criteria ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'actif'
  CHECK (statut IN ('actif', 'archive'));
