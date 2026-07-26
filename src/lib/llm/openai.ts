import { getSetting } from "@/lib/settings";

/**
 * Provider OpenAI — SERVEUR UNIQUEMENT. La clé API ne transite jamais par le client.
 *
 * Deux façons de fournir la clé :
 * - openaiChatWithKey(...) : clé passée explicitement (l'appelant l'a lue via son
 *   propre client Supabase, ex. l'admin dans Paramètres via la RLS admin).
 * - openaiChat(...) : lit la clé depuis app_settings via le client service-role
 *   (pour les appels déclenchés par un non-admin, ex. pré-remplissage/chat).
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_OPENAI_MODEL = "gpt-4o";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Appel non-streaming avec clé explicite. Renvoie le texte de la réponse. */
export async function openaiChatWithKey(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_OPENAI_MODEL,
      temperature: opts.temperature ?? 0.2,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status} : ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Lit la config OpenAI depuis app_settings via le client service-role. */
export async function getOpenAiConfig(): Promise<{ key: string | null; model: string }> {
  const [key, model] = await Promise.all([
    getSetting("openai_api_key"),
    getSetting("openai_model"),
  ]);
  return { key, model: model || DEFAULT_OPENAI_MODEL };
}

/** Appel non-streaming ; clé lue via service-role (contexte non-admin : 4c/4d). */
export async function openaiChat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const { key, model } = await getOpenAiConfig();
  if (!key) throw new Error("Clé API OpenAI non configurée (Paramètres).");
  return openaiChatWithKey(key, opts.model || model, messages, opts);
}

/** Appel streaming (clé service-role) : renvoie la réponse fetch brute (SSE) pour relais. */
export async function openaiChatStreamResponse(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; signal?: AbortSignal } = {}
): Promise<Response> {
  const { key, model } = await getOpenAiConfig();
  if (!key) throw new Error("Clé API OpenAI non configurée (Paramètres).");
  return fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: opts.model || model,
      temperature: opts.temperature ?? 0.3,
      stream: true,
      messages,
    }),
    signal: opts.signal,
  });
}
