"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── helpers ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Non authentifié" };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase, user, error: "Accès refusé" };
  return { supabase, user, error: null };
}

// Génère un id texte unique (ex. "fr_059_mon_critere") — criteria.id est une PK
// texte SANS valeur par défaut, il faut donc la fournir à chaque insert.
async function nextCriterionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  language: string,
  slug: string
): Promise<string> {
  const { data: rows } = await supabase
    .from("criteria")
    .select("id")
    .eq("language", language);
  let max = 0;
  for (const r of (rows ?? []) as { id: string }[]) {
    const m = /^[a-z]{2}_(\d+)_/.exec(r.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const num = String(max + 1).padStart(3, "0");
  const safeSlug = (slug || "critere").slice(0, 60);
  return `${language}_${num}_${safeSlug}`;
}

// ─── existing action ─────────────────────────────────────────────────────────

export async function toggleCriterion(
  criterionId: string,
  currentActive: boolean
): Promise<{ error?: string }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  const newActive = !currentActive;
  const { error: updateError } = await supabase
    .from("criteria").update({ active: newActive }).eq("id", criterionId);
  if (updateError) return { error: updateError.message };

  await supabase.from("criterion_audit_logs").insert({
    criterion_id: criterionId,
    changed_by: user.id,
    action: newActive ? "activated" : "deactivated",
    previous_value: { active: currentActive },
    new_value: { active: newActive },
  });

  revalidatePath("/criteres");
  return {};
}

// ─── new actions ─────────────────────────────────────────────────────────────

export async function setStatut(
  criterionId: string,
  newStatut: "actif" | "archive"
): Promise<{ error?: string }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  const newActive = newStatut === "actif";
  const { error: updateError } = await supabase
    .from("criteria")
    .update({ statut: newStatut, active: newActive })
    .eq("id", criterionId);
  if (updateError) return { error: updateError.message };

  await supabase.from("criterion_audit_logs").insert({
    criterion_id: criterionId,
    changed_by: user.id,
    action: newActive ? "activated" : "deactivated",
    previous_value: { statut: newStatut === "actif" ? "archive" : "actif" },
    new_value: { statut: newStatut, active: newActive },
  });

  revalidatePath("/criteres");
  return {};
}

export async function duplicateCriterion(
  criterionId: string
): Promise<{ error?: string }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  const { data: source } = await supabase
    .from("criteria").select("*").eq("id", criterionId).single();
  if (!source) return { error: "Critère introuvable" };

  const { data: maxRow } = await supabase
    .from("criteria")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .single();
  const nextIndex = (maxRow?.order_index ?? 0) + 10;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = source;
  const dupId = await nextCriterionId(supabase, source.language, source.slug || "copie");
  const { error: insertError } = await supabase.from("criteria").insert({
    ...rest,
    id: dupId,
    label_original: `${source.label_original} (copie)`,
    order_index: nextIndex,
    active: false,
    statut: "actif",
    effet_date: null,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/criteres");
  return {};
}

export async function createCriterion(data: {
  label_original: string;
  detail_original: string | null;
  language: "fr" | "nl";
  section_slug: string;
  section_label: string;
  effet_date: string | null;
}): Promise<{ error?: string }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  if (!data.label_original.trim()) return { error: "Le nom est requis" };

  // Active version for this language
  const { data: version } = await supabase
    .from("criterion_versions")
    .select("id")
    .eq("language", data.language)
    .eq("status", "active")
    .limit(1)
    .single();
  if (!version) return { error: "Aucune version active pour cette langue" };

  // Next order_index
  const { data: maxRow } = await supabase
    .from("criteria")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .single();
  const nextIndex = (maxRow?.order_index ?? 0) + 10;

  // Simple slug
  const slug = data.label_original
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/, "")
    .slice(0, 60);

  const newId = await nextCriterionId(supabase, data.language, slug);

  const { data: inserted, error: insertError } = await supabase
    .from("criteria")
    .insert({
      id: newId,
      criterion_version_id: version.id,
      language: data.language,
      order_index: nextIndex,
      section_slug: data.section_slug,
      section_label: data.section_label,
      label_original: data.label_original.trim(),
      detail_original: data.detail_original?.trim() || null,
      active: true,
      statut: "actif",
      slug,
      effet_date: data.effet_date || null,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  if (inserted?.id) {
    await supabase.from("criterion_audit_logs").insert({
      criterion_id: inserted.id,
      changed_by: user.id,
      action: "created",
      previous_value: null,
      new_value: { label_original: data.label_original },
    });
  }

  revalidatePath("/criteres");
  return {};
}
