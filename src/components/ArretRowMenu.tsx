"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { setFocus } from "@/app/actions/arrets";

interface Props {
  arretId: string;
  isFocus: boolean;
  pdfUrl: string | null;
}

export default function ArretRowMenu({ arretId, isFocus, pdfUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleFocusToggle() {
    setOpen(false);
    startTransition(() => setFocus(arretId, !isFocus));
  }

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-base leading-none"
      >
        ···
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[11rem]">
          <Link
            href={`/arrets/${arretId}`}
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Voir la fiche
          </Link>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Télécharger le PDF
            </a>
          )}
          <button
            onClick={handleFocusToggle}
            disabled={isPending}
            className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {isFocus ? "Retirer du Focus" : "Indiquer comme Focus"}
          </button>
        </div>
      )}
    </div>
  );
}
