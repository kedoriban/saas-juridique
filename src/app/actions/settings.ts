"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setSetting } from "@/lib/settings";
import { openaiChat } from "@/lib/llm/openai";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Non authentifié" as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { user, error: "Accès réservé aux administrateurs" as const };
  return { user, error: null };
}

/** Enregistre la clé API OpenAI et/ou le modèle. Admin uniquement. */
export async function saveOpenAiSettings(input: {
  apiKey?: string;
  model?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  try {
    if (input.apiKey !== undefined && input.apiKey.trim()) {
      await setSetting("openai_api_key", input.apiKey.trim(), user.id);
    }
    if (input.model !== undefined && input.model.trim()) {
      await setSetting("openai_model", input.model.trim(), user.id);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'enregistrement" };
  }

  revalidatePath("/parametres");
  return { success: true };
}

/** Teste la clé configurée par un appel minimal à OpenAI. Admin uniquement. */
export async function testOpenAiConnection(): Promise<{ error?: string; ok?: boolean; model?: string }> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Erreur" };

  try {
    const reply = await openaiChat(
      [{ role: "user", content: "Réponds uniquement par le mot: OK" }],
      { temperature: 0, maxTokens: 5 }
    );
    if (!reply) return { error: "Réponse vide d'OpenAI" };
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de la connexion" };
  }
}
