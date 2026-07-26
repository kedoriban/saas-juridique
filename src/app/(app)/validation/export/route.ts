import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseValueText } from "@/lib/utils";
import { buildCsv } from "@/lib/csv";

const PAGE_SIZE = 1000;

const VALUE_SELECT = `
  arret_id,
  value_text,
  value_boolean,
  confidence,
  evidence_excerpt,
  validation_status,
  validation_note,
  validated_at,
  criteria(label_original, section_label, llm_group, language, expected_value_type, order_index)
`;

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  // Arrêts terminés, dans l'ordre d'affichage (date décroissante).
  const { data: arrets } = await supabase
    .from("arrets")
    .select("id, numero, langue, date_arret, chambre, procedure_type")
    .eq("statut_traitement", "termine")
    .order("date_arret", { ascending: false });

  if (!arrets || arrets.length === 0) {
    return new NextResponse("Aucun arrêt analysé", { status: 404 });
  }

  const arretIds = arrets.map((a: { id: string }) => a.id);
  const arretMap = Object.fromEntries(
    arrets.map((a: { id: string }) => [a.id, a])
  ) as Record<string, { id: string; numero: string; langue: string; date_arret: string; chambre: string | null; procedure_type: string | null }>;
  const arretPos = Object.fromEntries(arretIds.map((id, i) => [id, i])) as Record<string, number>;

  // Pagination : PostgREST plafonne à max_rows (1000) par requête.
  // On boucle en .range() jusqu'à épuisement pour ne rien tronquer.
  type ValueRow = Record<string, unknown>;
  const values: ValueRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("arret_criteria_values")
      .select(VALUE_SELECT)
      .in("arret_id", arretIds)
      .order("arret_id")
      .order("id") // ordre stable pour une pagination fiable
      .range(from, from + PAGE_SIZE - 1);
    if (error) return new NextResponse(`Erreur export : ${error.message}`, { status: 500 });
    if (!data || data.length === 0) break;
    values.push(...(data as ValueRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  // Tri final : par arrêt (ordre d'affichage) puis par order_index de la cliente.
  values.sort((ra, rb) => {
    const pa = arretPos[ra.arret_id as string] ?? 9999;
    const pb = arretPos[rb.arret_id as string] ?? 9999;
    if (pa !== pb) return pa - pb;
    const oa = ((ra.criteria as Record<string, unknown> | null)?.order_index as number) ?? 9999;
    const ob = ((rb.criteria as Record<string, unknown> | null)?.order_index as number) ?? 9999;
    return oa - ob;
  });

  const header = [
    "arret_numero", "langue_arret", "date_arret", "chambre", "procedure_type",
    "langue_critere", "section", "groupe_llm", "critere", "type_valeur",
    "valeur_llm", "confidence_pct", "statut_llm", "extrait_preuve",
    "statut_validation", "commentaire_avocate", "date_validation",
  ];

  const rows = values.map((r) => {
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
      a?.numero, a?.langue, a?.date_arret, a?.chambre, a?.procedure_type,
      crit?.language, crit?.section_label, crit?.llm_group, crit?.label_original,
      crit?.expected_value_type, valeur, conf, statutLlm, r.evidence_excerpt,
      r.validation_status, r.validation_note, r.validated_at,
    ];
  });

  const csv = buildCsv(header, rows);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `audit_validation_cce_${today}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
