import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Helpers de configuration applicative (table app_settings).
 * SERVEUR UNIQUEMENT (utilise le client service-role). Ne pas importer côté client.
 */

export async function getSetting(key: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string, userId: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("app_settings")
    .upsert(
      { key, value, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw new Error(error.message);
}

/** Masque une clé secrète pour affichage (ex. "sk-…a1b2"). */
export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}
