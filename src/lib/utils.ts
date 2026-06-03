/**
 * Parse value_text from arret_criteria_values.
 * The LLM sometimes returns a JSON object rather than a plain string.
 * This function extracts a human-readable string in all cases.
 */
export function parseValueText(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      // Common keys the LLM might use
      const candidate =
        parsed.value ?? parsed.extracted_value ?? parsed.result ??
        parsed.text ?? parsed.valeur ?? parsed.answer;
      if (candidate !== undefined && candidate !== null) {
        return String(candidate);
      }
      // Last resort: stringify the object but truncate
      const s = JSON.stringify(parsed);
      return s.length > 120 ? s.slice(0, 117) + "…" : s;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Derive a human-readable LLM status from arret_criteria_values fields.
 * "found"       : a value was extracted
 * "not_found"   : no value and no confidence
 * "ambiguous"   : confidence < 0.5 but a value exists
 */
export function deriveLlmStatus(
  valueText: string | null,
  valueBoolean: boolean | null,
  confidence: number | null
): "found" | "not_found" | "ambiguous" {
  const hasValue = valueText !== null || valueBoolean !== null;
  if (!hasValue) return "not_found";
  if (confidence !== null && confidence < 0.5) return "ambiguous";
  return "found";
}

/**
 * Format a date ISO string to a Belgian locale date.
 */
export function formatDateBE(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
