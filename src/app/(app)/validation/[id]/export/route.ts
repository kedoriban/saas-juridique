import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: arret } = await supabase
    .from("arrets")
    .select("numero, langue, date_arret")
    .eq("id", id)
    .single();

  if (!arret) return new NextResponse("Not found", { status: 404 });

  const { data: values } = await supabase
    .from("arret_criteria_values")
    .select(`
      id,
      value_text,
      value_boolean,
      confidence,
      evidence_excerpt,
      validation_status,
      validation_note,
      validated_at,
      criteria(label_original, section_label, llm_group, language)
    `)
    .eq("arret_id", id)
    .order("created_at");

  const rows = values ?? [];

  const header = [
    "arret_numero",
    "langue_arret",
    "date_arret",
    "section",
    "groupe_llm",
    "langue_critere",
    "critere",
    "valeur_llm",
    "confidence_pct",
    "extrait_preuve",
    "statut_validation",
    "note",
    "date_validation",
  ].join(",");

  const lines = rows.map((r: Record<string, unknown>) => {
    const crit = r.criteria as Record<string, unknown> | null;
    const valeur =
      r.value_boolean !== null && r.value_boolean !== undefined
        ? r.value_boolean ? "oui" : "non"
        : r.value_text ?? "";
    const conf =
      r.confidence !== null && r.confidence !== undefined
        ? `${Math.round((r.confidence as number) * 100)}`
        : "";
    return [
      escapeCsv(arret.numero),
      escapeCsv(arret.langue),
      escapeCsv(arret.date_arret),
      escapeCsv(crit?.section_label),
      escapeCsv(crit?.llm_group),
      escapeCsv(crit?.language),
      escapeCsv(crit?.label_original),
      escapeCsv(valeur),
      escapeCsv(conf),
      escapeCsv(r.evidence_excerpt),
      escapeCsv(r.validation_status),
      escapeCsv(r.validation_note),
      escapeCsv(r.validated_at),
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  const filename = `validation_${arret.numero.replace(/\s+/g, "_")}_${arret.date_arret}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
