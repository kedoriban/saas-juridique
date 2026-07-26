"use client";

import { useState, useTransition } from "react";
import { saveOpenAiSettings, testOpenAiConnection } from "@/app/actions/settings";

const MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"];

interface Props {
  configured: boolean;
  masked: string | null;
  model: string;
}

export default function ApiKeyForm({ configured, masked, model: initialModel }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initialModel);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveOpenAiSettings({
        apiKey: apiKey.trim() || undefined,
        model,
      });
      if (res.error) setFeedback({ kind: "error", msg: res.error });
      else {
        setFeedback({ kind: "ok", msg: "Enregistré." });
        setApiKey("");
      }
    });
  }

  async function handleTest() {
    setFeedback(null);
    setTesting(true);
    try {
      const res = await testOpenAiConnection();
      if (res.error) setFeedback({ kind: "error", msg: res.error });
      else setFeedback({ kind: "ok", msg: "Connexion OpenAI réussie ✓" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${configured ? "bg-green-500" : "bg-gray-300"}`}
        />
        <span className="text-sm text-gray-600">
          {configured ? (
            <>Clé configurée <code className="text-xs bg-gray-100 px-1 rounded">{masked}</code></>
          ) : (
            "Aucune clé configurée"
          )}
        </span>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          {configured ? "Remplacer la clé API OpenAI" : "Clé API OpenAI"}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-…"
          autoComplete="off"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-forest-500"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          La clé est stockée côté serveur uniquement et n&apos;est jamais renvoyée au navigateur.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Modèle</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-forest-500"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isPending || (!apiKey.trim() && model === initialModel)}
          className="text-sm px-4 py-2 bg-forest-600 text-white rounded-lg disabled:opacity-40 hover:bg-forest-700 transition-colors"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !configured}
          title={!configured ? "Enregistrez d'abord une clé" : "Tester la connexion OpenAI"}
          className="text-sm px-4 py-2 text-forest-700 border border-forest-200 rounded-lg disabled:opacity-40 hover:bg-forest-50 transition-colors"
        >
          {testing ? "Test…" : "Tester la connexion"}
        </button>
        {feedback && (
          <span className={`text-xs font-medium ${feedback.kind === "ok" ? "text-green-600" : "text-red-600"}`}>
            {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
}
