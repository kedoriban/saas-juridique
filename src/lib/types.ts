export type Role = "admin" | "avocat" | "lecteur";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  organisation_id: string | null;
  created_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  created_at: string;
}

export interface CriterionVersion {
  id: string;
  language: "fr" | "nl";
  version_label: string;
  source_filename: string | null;
  status: "active" | "archived";
  activated_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Criterion {
  id: string;
  criterion_version_id: string;
  language: "fr" | "nl";
  order_index: number;
  section_slug: string;
  section_label: string;
  label_original: string;
  detail_original: string | null;
  expected_value_type: string | null;
  llm_group: string | null;
  slug: string | null;
  active: boolean;
  source_file: string | null;
  source_sheet: string | null;
  source_rows: number[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Migration 009
  statut?: "actif" | "archive";
  effet_date?: string | null;
}

export interface Arret {
  id: string;
  numero: string;
  date_arret: string;
  langue: "fr" | "nl";
  chambre: string | null;
  matiere: string | null;
  pays_origine: string | null;
  pdf_url: string | null;
  resume: string | null;
  statut_traitement: "en_attente" | "en_cours" | "termine" | "erreur";
  procedure_type: string | null;
  language_detected: string | null;
  created_at: string;
  updated_at: string;
  // Migration 009
  is_focus: boolean;
  source_juridiction: string | null;
  type_decision: "annulation" | "plein_contentieux" | "confirmation" | "refus" | "irrecevabilite" | "autre" | null;
  resume_ai: string | null;
  tags: string[];
}

export type ValidationStatus = "correct" | "incorrect" | "incertain" | "absent" | "a_revoir";

export interface ArretCriteriaValue {
  id: string;
  arret_id: string;
  criterion_id: string;
  value_text: string | null;
  value_boolean: boolean | null;
  confidence: number | null;
  evidence_excerpt: string | null;
  model_run_id: string | null;
  validated_by: string | null;
  validated_at: string | null;
  validation_status: ValidationStatus | null;
  validation_note: string | null;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  arret_id: string;
  job_type: "scrape" | "extract_text" | "analyze";
  status: "pending" | "running" | "done" | "error";
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ModelRun {
  id: string;
  arret_id: string;
  model_name: string;
  model_version: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  status: "done" | "error";
  created_at: string;
}

export interface CriterionAuditLog {
  id: string;
  criterion_id: string;
  changed_by: string | null;
  changed_at: string;
  action: "activated" | "deactivated" | "created" | "updated";
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
}
