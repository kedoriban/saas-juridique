-- ============================================================
-- Phase 6 — Corrections critères suite au code review (2026-06-02)
-- ============================================================
-- Seule la colonne label_original est corrigée en base.
-- llm_group n'existe pas dans la table criteria (géré dans les fichiers JSON).

-- Typo : "CvV" → "RvV" (abréviation correcte de la chambre néerlandophone)
update criteria
set label_original = 'Chambres FR ( CCE ) ou NL ( RvV )'
where id = 'fr_005_chambres_fr_cce_ou_nl_cvv';
