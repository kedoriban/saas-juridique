"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { openaiChatWithKey, DEFAULT_OPENAI_MODEL } from "@/lib/llm/openai";

async function requireAdmin() {
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
  if (profile?.role !== "admin") return { supabase, user, error: "Accès réservé aux administrateurs" as const };
  return { supabase, user, error: null };
}

/**
 * Enregistre la clé API OpenAI et/ou le modèle. Admin uniquement.
 * Écrit dans app_settings via le client de session (la RLS admin l'autorise) —
 * pas besoin de la clé service-role côté serveur pour cette étape.
 */
export async function saveOpenAiSettings(input: {
  apiKey?: string;
  model?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  const rows: { key: string; value: string; updated_by: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (input.apiKey !== undefined && input.apiKey.trim()) {
    rows.push({ key: "openai_api_key", value: input.apiKey.trim(), updated_by: user.id, updated_at: now });
  }
  if (input.model !== undefined && input.model.trim()) {
    rows.push({ key: "openai_model", value: input.model.trim(), updated_by: user.id, updated_at: now });
  }
  if (rows.length === 0) return { success: true };

  const { error: dbError } = await supabase
    .from("app_settings")
    .upsert(rows, { onConflict: "key" });
  if (dbError) return { error: dbError.message };

  revalidatePath("/parametres");
  return { success: true };
}

/** Teste la clé configurée par un appel minimal à OpenAI. Admin uniquement. */
export async function testOpenAiConnection(): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["openai_api_key", "openai_model"]);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  const key = map["openai_api_key"];
  const model = map["openai_model"] || DEFAULT_OPENAI_MODEL;
  if (!key) return { error: "Aucune clé configurée." };

  try {
    const reply = await openaiChatWithKey(
      key,
      model,
      [{ role: "user", content: "Réponds uniquement par le mot: OK" }],
      { temperature: 0, maxTokens: 5 }
    );
    if (!reply) return { error: "Réponse vide d'OpenAI" };
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de la connexion" };
  }
}
