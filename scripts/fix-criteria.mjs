/**
 * fix-criteria.mjs — Applique les corrections identifiées lors du code review (2026-06-02)
 *
 * Corrections :
 *   llm_group FR :
 *     fr_032  procedure          → persecution_claims
 *     fr_033  profile_vulnerability → persecution_claims
 *     fr_034  profile_vulnerability → persecution_claims
 *     fr_035  procedure          → persecution_claims
 *     fr_041  identity           → decision_reasoning
 *   llm_group NL :
 *     nl_001  general            → metadata
 *   label_original FR :
 *     fr_005  "CvV"              → "RvV"
 *
 * Usage : node --env-file=.env.local scripts/fix-criteria.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dir, "..", "data");

// ─── Corrections définies ────────────────────────────────────────────────────

const GROUP_FIXES = {
  fr_032_persecutions_invoquees_par_le_demandeur:               "persecution_claims",
  fr_033_persecutions_de_genre_sur_lesquelles_la_dpi_est_:      "persecution_claims",
  fr_034_persecutions_liees_a_des_opinions_politiques_ou_:      "persecution_claims",
  fr_035_appartenance_a_un_groupe_social_partageant_des_c:      "persecution_claims",
  fr_041_existe_t_il_une_protection_nationale_effective_e:      "decision_reasoning",
  nl_001_datum_van_het_arrest:                                  "metadata",
};

const LABEL_FIXES = {
  fr_005_chambres_fr_cce_ou_nl_cvv: "Chambres FR ( CCE ) ou NL ( RvV )",
};

// ─── Fonction de patch JSON ──────────────────────────────────────────────────

function patchCriteria(data) {
  let fixedGroups = 0;
  let fixedLabels = 0;

  for (const c of data.criteria ?? []) {
    if (GROUP_FIXES[c.id] !== undefined && c.llm_group !== GROUP_FIXES[c.id]) {
      console.log(`  llm_group [${c.id}] : "${c.llm_group}" → "${GROUP_FIXES[c.id]}"`);
      c.llm_group = GROUP_FIXES[c.id];
      fixedGroups++;
    }
    if (LABEL_FIXES[c.id] !== undefined && c.label_original !== LABEL_FIXES[c.id]) {
      console.log(`  label     [${c.id}] : "${c.label_original}" → "${LABEL_FIXES[c.id]}"`);
      c.label_original = LABEL_FIXES[c.id];
      fixedLabels++;
    }
  }
  return { fixedGroups, fixedLabels };
}

// ─── Patch fichiers JSON ─────────────────────────────────────────────────────

const files = [
  "criteria_canonical.json",
  "criteria_fr.json",
  "criteria_nl.json",
];

let totalGroups = 0;
let totalLabels = 0;

for (const filename of files) {
  const path = join(dataDir, filename);
  const data = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`\n[${filename}]`);
  const { fixedGroups, fixedLabels } = patchCriteria(data);
  totalGroups += fixedGroups;
  totalLabels += fixedLabels;
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  → ${fixedGroups} llm_group, ${fixedLabels} labels corrigés`);
}

console.log(`\nJSON : ${totalGroups} llm_group + ${totalLabels} labels corrigés au total.`);

// ─── Patch Supabase (label_original uniquement — llm_group absent de la base) ─

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("\n⚠  Variables Supabase absentes — correction DB ignorée.");
  process.exit(0);
}

const sb = createClient(supabaseUrl, supabaseKey);

console.log("\n[Supabase] Correction label_original...");
for (const [id, label] of Object.entries(LABEL_FIXES)) {
  const { error } = await sb.from("criteria").update({ label_original: label }).eq("id", id);
  if (error) {
    console.error(`  ✗ ${id} : ${error.message}`);
  } else {
    console.log(`  ✓ ${id} → "${label}"`);
  }
}

console.log("\nTerminé. Relancez import-criteria.mjs si vous souhaitez re-synchroniser la base complète.");
