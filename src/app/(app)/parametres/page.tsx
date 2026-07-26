import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { getSetting, maskSecret } from "@/lib/settings";
import { DEFAULT_OPENAI_MODEL } from "@/lib/llm/openai";
import ApiKeyForm from "./ApiKeyForm";

export default async function ParametresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const isAdmin = profile?.role === "admin";

  // Lecture de la config IA (service-role) — admin uniquement, tolérante si la
  // migration/variable Vercel ne sont pas encore en place.
  let ai: { configured: boolean; masked: string | null; model: string } | null = null;
  let aiError: string | null = null;
  if (isAdmin) {
    try {
      const [key, model] = await Promise.all([
        getSetting("openai_api_key"),
        getSetting("openai_model"),
      ]);
      ai = { configured: !!key, masked: maskSecret(key), model: model || DEFAULT_OPENAI_MODEL };
    } catch {
      aiError =
        "Configuration incomplète : appliquez la migration 011 et ajoutez SUPABASE_SERVICE_ROLE_KEY aux variables d'environnement.";
      ai = { configured: false, masked: null, model: DEFAULT_OPENAI_MODEL };
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>

      <section className="mt-6 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Compte</p>
          <p className="text-sm font-medium text-gray-800">{user?.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rôle : {profile?.role ?? "—"}</p>
        </div>

        {isAdmin && ai && (
          <div className="px-4 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              Intégration ChatGPT (OpenAI)
            </p>
            {aiError && (
              <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {aiError}
              </p>
            )}
            <ApiKeyForm configured={ai.configured} masked={ai.masked} model={ai.model} />
          </div>
        )}

        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Administration</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Gestion des utilisateurs</span>
              <span className="text-xs text-gray-300">bientôt</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Organisation</span>
              <span className="text-xs text-gray-300">bientôt</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          <form>
            <button
              formAction={logout}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
