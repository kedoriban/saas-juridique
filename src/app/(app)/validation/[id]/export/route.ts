import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseValueText } from "@/lib/utils";
import { buildCsv } from "@/lib/csv";

const PAGE_SIZE = 1000;

const VALUE_SELECT = `
  id,
  value_text,
  value_boolean,
  confidence,
  evidence_excerpt,
  validation_status,
  validation_note,
  validated_at,
  criteria(label_original, section_label, llm_group, language, order_index)
`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const { data: arret } = await supabase
    .from("arrets")
    .select("numero, langue, date_arret")
    .eq("id", id)
    .single();

  if (!arret) return new NextResponse("Not found", { status: 404 });

  // Pagination défensive (un arrêt ~96 critères max, mais on reste cohérent
  // avec l'export global et à l'abri de toute évolution).
  type ValueRow = Record<string, unknown>;
  const values: ValueRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("arret_criteria_values")
      .select(VALUE_SELECT)
      .eq("arret_id", id)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return new NextResponse(`Erreur export : ${error.message}`, { status: 500 });
    if (!data || data.length === 0) break;
    values.push(...(data as ValueRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  // Tri par order_index de la cliente (comme l'UI de validation).
  values.sort((ra, rb) => {
    const oa = ((ra.criteria as Record<string, unknown> | null)?.order_index as number) ?? 9999;
    const ob = ((rb.criteria as Record<string, unknown> | null)?.order_index as number) ?? 9999;
    return oa - ob;
  });

  const header = [
    "arret_numero", "langue_arret", "date_arret", "section", "groupe_llm",
    "langue_critere", "critere", "valeur_llm", "confidence_pct", "extrait_preuve",
    "statut_validation", "commentaire_avocate", "date_validation",
  ];

  const rows = values.map((r) => {
    const crit = r.criteria as Record<string, unknown> | null;
    const rawValue = parseValueText(r.value_text as string | null);
    const valeur =
      r.value_boolean !== null && r.value_boolean !== undefined
        ? r.value_boolean ? "oui" : "non"
        : rawValue ?? "";
    const conf =
      r.confidence !== null && r.confidence !== undefined
        ? `${Math.round((r.confidence as number) * 100)}`
        : "";
    return [
      arret.numero, arret.langue, arret.date_arret, crit?.section_label, crit?.llm_group,
      crit?.language, crit?.label_original, valeur, conf, r.evidence_excerpt,
      r.validation_status, r.validation_note, r.validated_at,
    ];
  });

  const csv = buildCsv(header, rows);
  const filename = `validation_${arret.numero.replace(/\s+/g, "_")}_${arret.date_arret}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
