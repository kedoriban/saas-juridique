import { getSetting } from "@/lib/settings";

/**
 * Provider OpenAI — SERVEUR UNIQUEMENT (lit la clé API depuis app_settings via
 * le client service-role). La clé ne transite jamais par le client.
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_OPENAI_MODEL = "gpt-4o";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function getOpenAiConfig(): Promise<{ key: string | null; model: string }> {
  const [key, model] = await Promise.all([
    getSetting("openai_api_key"),
    getSetting("openai_model"),
  ]);
  return { key, model: model || DEFAULT_OPENAI_MODEL };
}

/** Appel non-streaming. Renvoie le texte de la réponse. Throw en cas d'erreur. */
export async function openaiChat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const { key, model } = await getOpenAiConfig();
  if (!key) throw new Error("Clé API OpenAI non configurée (Paramètres).");

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model || model,
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

/** Appel streaming : renvoie la réponse fetch brute (SSE) pour un relais côté route handler. */
export async function openaiChatStreamResponse(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; signal?: AbortSignal } = {}
): Promise<Response> {
  const { key, model } = await getOpenAiConfig();
  if (!key) throw new Error("Clé API OpenAI non configurée (Paramètres).");

  return fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model || model,
      temperature: opts.temperature ?? 0.3,
      stream: true,
      messages,
    }),
    signal: opts.signal,
  });
}
