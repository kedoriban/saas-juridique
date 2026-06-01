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
