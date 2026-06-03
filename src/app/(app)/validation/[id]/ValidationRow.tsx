"use client";

import { useTransition, useState } from "react";
import { updateValidationStatus } from "@/app/actions/validation";
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
  initialStatus: ValidationStatus | null;
  initialNote: string | null;
}

export default function ValidationRow({ valueId, initialStatus, initialNote }: Props) {
  const [status, setStatus] = useState<ValidationStatus | null>(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [showNote, setShowNote] = useState(!!initialNote);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(nextStatus: ValidationStatus | null, nextNote: string) {
    if (!nextStatus) return;
    startTransition(async () => {
      await updateValidationStatus(valueId, nextStatus, nextNote || null);
      setSaved(true);
    });
  }

  function handleStatus(s: ValidationStatus) {
    const next = status === s ? null : s;
    setStatus(next);
    setSaved(false);
    if (next) save(next, note);
  }

  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      setSaved(false);
      save(status, note);
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
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
              status === s.value ? s.activeStyle : s.style
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setShowNote((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
        >
          {showNote ? "Masquer" : "Commentaire"}
        </button>
        {saved && !isPending && (
          <span className="text-xs text-green-600 ml-1">✓</span>
        )}
        {isPending && (
          <span className="text-xs text-gray-400 ml-1 animate-pulse">…</span>
        )}
      </div>

      {/* Zone commentaire */}
      {showNote && (
        <div className="space-y-1">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => { setNote(e.target.value); setSaved(false); }}
            onKeyDown={handleNoteKeyDown}
            placeholder="Commentaire… (Ctrl+Entrée pour enregistrer)"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-forest-500 resize-none"
          />
          <div className="flex justify-end">
            <button
              disabled={isPending || !status}
              onClick={() => { setSaved(false); save(status, note); }}
              className="text-xs px-3 py-1.5 bg-forest-600 text-white rounded-lg disabled:opacity-40 hover:bg-forest-700 transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
