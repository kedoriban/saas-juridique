# Schéma database recommandé

## Tables principales

### `organizations`

- `id`
- `name`
- `max_users`
- `max_active_sessions_per_user`
- `status`
- `created_at`

### `profiles`

- `id`
- `user_id`
- `organization_id`
- `role`
- `display_name`
- `mfa_required`
- `created_at`

### `active_sessions`

- `id`
- `user_id`
- `organization_id`
- `session_fingerprint_hash`
- `last_seen_at`
- `expires_at`
- `revoked_at`
- `created_at`

### `criterion_versions`

- `id`
- `language`
- `version_label`
- `source_filename`
- `status`
- `activated_at`
- `created_at`

### `criteria`

- `id`
- `criterion_version_id`
- `language`
- `order_index`
- `section_slug`
- `section_label`
- `label_original`
- `detail_original`
- `expected_value_type`
- `llm_group`
- `active`
- `source_rows`
- `created_at`
- `updated_at`

### `arrets`

- `id`
- `source_site`
- `source_language`
- `source_url`
- `pdf_url`
- `arret_number`
- `decision_date`
- `procedure_type`
- `country`
- `chamber`
- `judge_reporter`
- `scraping_status`
- `extraction_status`
- `analysis_status`
- `text_hash`
- `created_at`
- `updated_at`

### `arret_criteria_values`

- `id`
- `arret_id`
- `criterion_id`
- `criterion_version_id`
- `value_json`
- `value_text`
- `confidence`
- `evidence_excerpt`
- `evidence_section`
- `analysis_status`
- `model_run_id`
- `validated_status`
- `validated_by`
- `validated_at`
- `created_at`

### `processing_jobs`

- `id`
- `job_type`
- `arret_id`
- `status`
- `attempts`
- `last_error`
- `worker_id`
- `started_at`
- `finished_at`
- `created_at`

### `model_runs`

- `id`
- `provider`
- `model_name`
- `model_version`
- `prompt_version`
- `criterion_version_id`
- `input_chars`
- `duration_ms`
- `status`
- `created_at`

### `audit_logs`

- `id`
- `actor_user_id`
- `organization_id`
- `action`
- `entity_type`
- `entity_id`
- `before_json`
- `after_json`
- `created_at`
