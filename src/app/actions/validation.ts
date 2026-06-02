"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ValidationStatus } from "@/lib/types";

export async function updateValidationStatus(
  valueId: string,
  status: ValidationStatus,
  note: string | null
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "avocat"].includes(profile.role)) {
    return { error: "Accès refusé" };
  }

  const { error } = await supabase
    .from("arret_criteria_values")
    .update({
      validation_status: status,
      validation_note: note ?? null,
      validated_by: user.id,
      validated_at: new Date().toISOString(),
    })
    .eq("id", valueId);

  if (error) return { error: error.message };

  revalidatePath("/validation", "layout");
  return { success: true };
}
