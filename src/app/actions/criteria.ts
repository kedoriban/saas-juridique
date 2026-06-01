"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleCriterion(
  criterionId: string,
  currentActive: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // Vérification du rôle admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Accès refusé" };

  const newActive = !currentActive;

  const { error: updateError } = await supabase
    .from("criteria")
    .update({ active: newActive })
    .eq("id", criterionId);

  if (updateError) return { error: updateError.message };

  // Audit minimal
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
