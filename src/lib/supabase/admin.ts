import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase SERVICE-ROLE — À N'UTILISER QUE CÔTÉ SERVEUR
 * (server actions, route handlers). Ne JAMAIS l'importer dans un composant client :
 * il porte la clé service-role qui bypasse la RLS.
 *
 * Sert à lire des secrets (clé API OpenAI dans app_settings) qui ne sont
 * volontairement lisibles par aucun rôle via l'anon key.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Configuration serveur manquante (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
