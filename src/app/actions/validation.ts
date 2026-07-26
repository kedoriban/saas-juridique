"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ValidationStatus } from "@/lib/types";

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Non authentifié" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "avocat"].includes(profile.role)) {
    return { supabase, user, error: "Accès refusé" as const };
  }
  return { supabase, user, error: null };
}

/**
 * Pose, change ou efface le STATUT de validation d'un critère.
 * - status non-null  → enregistre le statut + qui/quand (validated_by/at).
 * - status null      → efface explicitement le statut ET son horodatage.
 * Ne touche jamais au commentaire (géré séparément par saveValidationNote),
 * pour ne plus écrire un `validated_at` sans statut (bug statut_validation vide).
 */
export async function setValidationStatus(
  valueId: string,
  arretId: string,
  status: ValidationStatus | null
) {
  const { supabase, user, error } = await authorize();
  if (error || !user) return { error: error ?? "Non authentifié" };

  const patch = status
    ? {
        validation_status: status,
        validated_by: user.id,
        validated_at: new Date().toISOString(),
      }
    : { validation_status: null, validated_by: null, validated_at: null };

  const { error: dbError } = await supabase
    .from("arret_criteria_values")
    .update(patch)
    .eq("id", valueId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/validation/${arretId}`, "page");
  revalidatePath("/validation", "page");
  return { success: true as const };
}

/**
 * Enregistre le COMMENTAIRE d'un critère, indépendamment du statut.
 * Appelé en autosave (debounce/blur) : n'écrit que validation_note, donc ne
 * peut plus effacer ni fausser le statut de validation.
 */
export async function saveValidationNote(
  valueId: string,
  arretId: string,
  note: string | null
) {
  const { supabase, user, error } = await authorize();
  if (error || !user) return { error: error ?? "Non authentifié" };

  const clean = note && note.trim() ? note : null;

  const { error: dbError } = await supabase
    .from("arret_criteria_values")
    .update({ validation_note: clean })
    .eq("id", valueId);

  if (dbError) return { error: dbError.message };

  // Pas de revalidatePath ici : le commentaire n'alimente aucune UI dérivée du
  // serveur, et l'autosave est fréquent → on évite un refetch RSC à chaque frappe.
  return { success: true as const };
}
