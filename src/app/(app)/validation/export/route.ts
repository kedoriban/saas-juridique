import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseValueText } from "@/lib/utils";

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  // Récupérer tous les arrêts terminés
  const { data: arrets } = await supabase
    .from("arrets")
    .select("id, numero, langue, date_arret, chambre, procedure_type")
    .eq("statut_traitement", "termine")
    .order("date_arret", { ascending: false });

  if (!arrets || arrets.length === 0) {
    return new NextResponse("Aucun arrêt analysé", { status: 404 });
  }

  const arretIds = arrets.map((a: { id: string }) => a.id);

  // Récupérer toutes les valeurs de critères avec validation
  const { data: values } = await supabase
    .from("arret_criteria_values")
    .select(`
      arret_id,
      value_text,
      value_boolean,
      confidence,
      evidence_excerpt,
      validation_status,
      validation_note,
      validated_at,
      criteria(label_original, section_label, llm_group, language, expected_value_type)
    `)
    .in("arret_id", arretIds)
    .order("arret_id")
    .order("created_at");

  // Index arrêts
  const arretMap = Object.fromEntries(
    arrets.map((a: { id: string; numero: string; langue: string; date_arret: string; chambre: string | null; procedure_type: string | null }) => [a.id, a])
  );

  const header = [
    "arret_numero",
    "langue_arret",
    "date_arret",
    "chambre",
    "procedure_type",
    "langue_critere",
    "section",
    "groupe_llm",
    "critere",
    "type_valeur",
    "valeur_llm",
    "confidence_pct",
    "statut_llm",
    "extrait_preuve",
    "statut_validation",
    "commentaire_avocate",
    "date_validation",
  ].join(",");

  const lines = (values ?? []).map((r: Record<string, unknown>) => {
    const crit = r.criteria as Record<string, unknown> | null;
    const a = arretMap[r.arret_id as string];

    const rawValue = parseValueText(r.value_text as string | null);
    const valeur =
      r.value_boolean !== null && r.value_boolean !== undefined
        ? r.value_boolean ? "oui" : "non"
        : rawValue ?? "";

    const conf =
      r.confidence !== null && r.confidence !== undefined
        ? `${Math.round((r.confidence as number) * 100)}`
        : "";

    const hasValue = r.value_text !== null || r.value_boolean !== null;
    const isAmbiguous = r.confidence !== null && (r.confidence as number) < 0.5;
    const statutLlm = !hasValue ? "non_trouve" : isAmbiguous ? "ambigu" : "extrait";

    return [
      escapeCsv(a?.numero),
      escapeCsv(a?.langue),
      escapeCsv(a?.date_arret),
      escapeCsv(a?.chambre),
      escapeCsv(a?.procedure_type),
      escapeCsv(crit?.language),
      escapeCsv(crit?.section_label),
      escapeCsv(crit?.llm_group),
      escapeCsv(crit?.label_original),
      escapeCsv(crit?.expected_value_type),
      escapeCsv(valeur),
      escapeCsv(conf),
      escapeCsv(statutLlm),
      escapeCsv(r.evidence_excerpt),
      escapeCsv(r.validation_status),
      escapeCsv(r.validation_note),
      escapeCsv(r.validated_at),
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `audit_validation_cce_${today}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
