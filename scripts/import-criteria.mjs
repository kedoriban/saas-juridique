/**
 * Import des critères depuis data/criteria_canonical.json vers Supabase.
 * Usage : node --env-file=.env.local scripts/import-criteria.mjs
 * Prérequis : .env.local avec SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const dataPath = join(__dirname, "../data/criteria_canonical.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));

async function run() {
  console.log("Démarrage import critères…");

  // 1. Créer les versions FR et NL (idempotent)
  const versions = [
    {
      language: "fr",
      version_label: "client_excel_v2",
      source_filename: "Critères analyse_V2.xlsx",
      status: "active",
      activated_at: new Date().toISOString(),
    },
    {
      language: "nl",
      version_label: "client_excel_v1",
      source_filename: "Critères analyse nl_Relu Lb(2).xlsx",
      status: "active",
      activated_at: new Date().toISOString(),
    },
  ];

  const { data: insertedVersions, error: versionsError } = await supabase
    .from("criterion_versions")
    .upsert(versions, { onConflict: "language,version_label", ignoreDuplicates: false })
    .select();

  if (versionsError) {
    console.error("Erreur insertion versions :", versionsError.message);
    process.exit(1);
  }

  const versionMap = {};
  for (const v of insertedVersions) {
    versionMap[v.language] = v.id;
  }

  console.log(`Versions créées/mises à jour : FR=${versionMap["fr"]}, NL=${versionMap["nl"]}`);

  // Archiver l'ancienne version FR v1 (la V2 devient la version FR active)
  const { error: archiveError } = await supabase
    .from("criterion_versions")
    .update({ status: "archived" })
    .eq("language", "fr")
    .eq("version_label", "client_excel_v1");
  if (archiveError) {
    console.error("Erreur archivage FR v1 :", archiveError.message);
    process.exit(1);
  }
  console.log("Ancienne version FR client_excel_v1 archivée.");

  // 2. Insérer les critères (idempotent)
  const criteriaRows = data.criteria.map((c) => ({
    id: c.id,
    criterion_version_id: versionMap[c.language],
    language: c.language,
    order_index: c.order_index,
    section_slug: c.section_slug,
    section_label: c.section_label,
    label_original: c.label_original,
    detail_original: c.detail_original ?? null,
    expected_value_type: c.expected_value_type ?? null,
    llm_group: c.llm_group ?? null,
    slug: c.slug ?? null,
    active: c.active ?? true,
    source_file: c.source_file ?? null,
    source_sheet: c.source_sheet ?? null,
    source_rows: c.source_rows ?? null,
    notes: c.notes ?? null,
  }));

  // Insérer par lots de 50 pour éviter les limites
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < criteriaRows.length; i += BATCH) {
    const batch = criteriaRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("criteria")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    if (error) {
      console.error(`Erreur batch ${i}-${i + BATCH} :`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${criteriaRows.length} critères importés`);
  }

  console.log(`\nImport terminé : ${criteriaRows.length} critères (${data.metadata.counts.fr} FR + ${data.metadata.counts.nl} NL)`);
}

run().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
