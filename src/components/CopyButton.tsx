"use client";

import { useState } from "react";

interface Props {
  text: string;
  label?: string;
  className?: string;
}

export default function CopyButton({
  text,
  label = "Copier",
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silent fail
    }
  }

  return (
    <button onClick={handleCopy} className={className}>
      {copied ? "Copié ✓" : label}
    </button>
  );
}
