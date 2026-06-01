# Schéma canonique des critères

## Objectif

Transformer les deux Excel cliente en référentiels versionnés, sans traduction automatique et en conservant l’ordre d’origine.

## Fichiers générés

- `data/criteria_canonical.json`
- `data/criteria_fr.json`
- `data/criteria_nl.json`
- `data/criteria_canonical.csv`
- `data/criteria_sections.json`

## Résultat d’extraction

- Critères français : 48
- Critères néerlandais : 48
- Total : 96

## Champs canoniques

```json
{
  "id": "fr_001_date_de_l_arret",
  "language": "fr",
  "version": "client_excel_v1",
  "order_index": 1,
  "section_slug": "metadata_arret",
  "section_label": "Métadonnées de l’arrêt",
  "label_original": "Date de l'arrêt",
  "detail_original": null,
  "expected_value_type": "text_or_structured_json",
  "active": true,
  "source_file": "Critères analyse(2).xlsx",
  "source_sheet": "Feuil1",
  "source_rows": [6],
  "slug": "date_de_l_arret",
  "llm_group": "metadata",
  "notes": null
}
```

## Règles métier

- `order_index` est intouchable pour la version importée.
- `label_original` doit rester identique au fichier cliente, sauf correction manuelle validée.
- `language` vaut `fr` ou `nl`.
- `version` permet de gérer l’évolution des critères.
- `active=false` désactive un critère sans supprimer l’historique.
- Une modification de critère crée une nouvelle version ou un événement d’audit.
- Les analyses existantes restent liées à la version utilisée au moment de l’analyse.
- Aucun retraitement automatique après modification des critères.

## Tables Supabase recommandées

### `criterion_versions`

- `id`
- `language`
- `version_label`
- `source_filename`
- `status`
- `activated_at`
- `created_at`
- `created_by`

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
- `source_file`
- `source_sheet`
- `source_rows`
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
- `validated_by`
- `validated_at`
- `created_at`

## Groupes LLM recommandés

- `metadata`
- `identity`
- `profile_vulnerability`
- `evidence_documents`
- `procedure`
- `persecution_claims`
- `decision_reasoning`
- `general`

Ces groupes servent à sélectionner uniquement les passages utiles avant d’appeler le LLM.
