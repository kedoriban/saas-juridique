"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { setValidationStatus, saveValidationNote } from "@/app/actions/validation";
import type { ValidationStatus } from "@/lib/types";

const STATUTS: { value: ValidationStatus; label: string; style: string; activeStyle: string }[] = [
  { value: "correct",   label: "Correct",   style: "border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-700", activeStyle: "border-green-500 bg-green-50 text-green-700 font-semibold" },
  { value: "incorrect", label: "Incorrect", style: "border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600",   activeStyle: "border-red-500 bg-red-50 text-red-600 font-semibold" },
  { value: "incertain", label: "Incertain", style: "border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600", activeStyle: "border-yellow-500 bg-yellow-50 text-yellow-700 font-semibold" },
  { value: "absent",    label: "Absent",    style: "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700",  activeStyle: "border-gray-500 bg-gray-100 text-gray-700 font-semibold" },
  { value: "a_revoir",  label: "À revoir",  style: "border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600", activeStyle: "border-blue-500 bg-blue-50 text-blue-700 font-semibold" },
];

interface Props {
  valueId: string;
  arretId: string;
  initialStatus: ValidationStatus | null;
  initialNote: string | null;
}

type Feedback = { kind: "idle" | "saving" | "saved" | "error"; msg?: string };

const AUTOSAVE_MS = 800;

export default function ValidationRow({ valueId, arretId, initialStatus, initialNote }: Props) {
  const [status, setStatus] = useState<ValidationStatus | null>(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [showNote, setShowNote] = useState(!!initialNote);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });

  // Dernier commentaire réellement persisté — sert à détecter un brouillon non sauvé.
  const savedNoteRef = useRef(initialNote ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteDirty = note !== savedNoteRef.current;

  // Efface le "✓ Enregistré" au bout de 2 s.
  useEffect(() => {
    if (feedback.kind !== "saved") return;
    const t = setTimeout(() => setFeedback({ kind: "idle" }), 2000);
    return () => clearTimeout(t);
  }, [feedback]);

  // Garde anti-perte : prévient si un commentaire tapé n'est pas encore sauvegardé
  // (rechargement / fermeture d'onglet). La navigation interne, elle, est couverte
  // par le flush au blur du textarea.
  useEffect(() => {
    if (!noteDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [noteDirty]);

  // Nettoyage du timer d'autosave au démontage.
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function applyStatus(next: ValidationStatus | null) {
    const prev = status;
    setStatus(next);
    setFeedback({ kind: "saving" });
    startTransition(async () => {
      try {
        const res = await setValidationStatus(valueId, arretId, next);
        if (res?.error) {
          setStatus(prev);
          setFeedback({ kind: "error", msg: res.error });
        } else {
          setFeedback({ kind: "saved" });
        }
      } catch {
        setStatus(prev);
        setFeedback({ kind: "error", msg: "Échec de l'enregistrement" });
      }
    });
  }

  function handleStatus(s: ValidationStatus) {
    if (status === s || isPending) return; // clic sur le statut actif = sans effet (plus de reset destructif)
    applyStatus(s);
  }

  async function persistNote(value: string) {
    setFeedback({ kind: "saving" });
    try {
      const res = await saveValidationNote(valueId, arretId, value.trim() ? value : null);
      if (res?.error) {
        setFeedback({ kind: "error", msg: res.error });
        return;
      }
      savedNoteRef.current = value;
      setFeedback({ kind: "saved" });
    } catch {
      setFeedback({ kind: "error", msg: "Échec de l'enregistrement" });
    }
  }

  function scheduleNoteSave(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      persistNote(value);
    }, AUTOSAVE_MS);
  }

  function flushNote() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (note !== savedNoteRef.current) persistNote(note);
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setNote(v);
    scheduleNoteSave(v);
  }

  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      flushNote();
    }
  }

  return (
    <div className="space-y-2">
      {/* Boutons statut */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {STATUTS.map((s) => (
          <button
            key={s.value}
            disabled={isPending}
            onClick={() => handleStatus(s.value)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all disabled:opacity-60 ${
              status === s.value ? s.activeStyle : s.style
            }`}
          >
            {s.label}
          </button>
        ))}
        {status && (
          <button
            disabled={isPending}
            onClick={() => applyStatus(null)}
            title="Effacer le statut"
            className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            ✕ Effacer
          </button>
        )}
        <button
          onClick={() => setShowNote((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
        >
          {showNote ? "Masquer" : "Commentaire"}
        </button>

        {/* Indicateur d'enregistrement */}
        {feedback.kind === "saving" && (
          <span className="text-xs text-gray-400 ml-1 animate-pulse">Enregistrement…</span>
        )}
        {feedback.kind === "saved" && (
          <span className="text-xs font-semibold text-green-600 ml-1.5">✓ Enregistré</span>
        )}
        {feedback.kind === "error" && (
          <span className="text-xs font-semibold text-red-600 ml-1.5">⚠ {feedback.msg || "Échec"} — réessayez</span>
        )}
      </div>

      {/* Zone commentaire */}
      {showNote && (
        <div className="space-y-1">
          <textarea
            rows={2}
            value={note}
            onChange={handleNoteChange}
            onBlur={flushNote}
            onKeyDown={handleNoteKeyDown}
            placeholder="Commentaire… (enregistrement automatique)"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-forest-500 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            {noteDirty && (
              <span className="text-[10px] text-gray-400">Modifié — enregistrement auto</span>
            )}
            <button
              disabled={!noteDirty}
              onClick={flushNote}
              className="text-xs px-3 py-1.5 bg-forest-600 text-white rounded-lg disabled:opacity-40 hover:bg-forest-700 transition-colors"
            >
              Enregistrer maintenant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
