"""
Interface LLM interchangeable — Phase 5.

Provider actif : ollama_local (MVP).
Remplaçable ultérieurement par gpu_server ou cloud_llm via LLM_PROVIDER.

Variables d'environnement :
  LLM_PROVIDER          = ollama        (seule valeur supportée au MVP)
  OLLAMA_BASE_URL       = http://localhost:11434
  OLLAMA_MODEL          = qwen3:4b
  LLM_TIMEOUT_SECONDS   = 120
  LLM_MAX_INPUT_CHARS   = 8000
  LLM_STORE_RAW_OUTPUT  = false
"""

from __future__ import annotations

import json
import os
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import requests


def _sanitize_json_str(s: str) -> str:
    """Remplace les caractères de contrôle dans les valeurs de strings JSON."""
    return re.sub(
        r'(: *")(.*?)("[ ,\n\r}])',
        lambda m: m.group(1) + m.group(2).replace("\n", " ").replace("\r", " ").replace("\t", " ") + m.group(3),
        s,
        flags=re.DOTALL,
    )


def _try_parse(json_str: str) -> dict | None:
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        try:
            return json.loads(_sanitize_json_str(json_str))
        except json.JSONDecodeError:
            return None


def _find_matching_brace(text: str, start: int, open_ch: str, close_ch: str) -> int:
    """Retourne l'index du brace fermant correspondant, ou -1."""
    depth = 0
    in_string = False
    escape_next = False
    for i, ch in enumerate(text[start:]):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
    return -1


def _extract_json(raw: str) -> tuple[dict | None, str | None]:
    """
    Extrait et parse le PLUS GRAND objet JSON {...} valide dans la réponse du LLM.
    Stratégies (ordre) :
      1. Supprime les blocs <think>...</think> puis cherche le plus grand {}.
      2. Cherche un tableau "items": [...] et reconstruit {"items": [...]}.
      3. Cherche tout objet {} dans le texte brut original.
    """
    # Étape 1 : nettoyer le thinking explicite
    cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    best: dict | None = None
    best_len = 0

    for text in (cleaned, raw):  # essaye d'abord nettoyé, puis brut
        for start_match in re.finditer(r"\{", text):
            pos = start_match.start()
            end = _find_matching_brace(text, pos, "{", "}")
            if end == -1:
                continue
            json_str = text[pos: pos + end + 1]
            parsed = _try_parse(json_str)
            if parsed is not None and isinstance(parsed, dict) and len(json_str) > best_len:
                best = parsed
                best_len = len(json_str)

    if best is not None:
        return best, None

    # Étape 2 : chercher un tableau items[] directement (format partiel)
    for text in (cleaned, raw):
        m = re.search(r'"items"\s*:\s*(\[)', text)
        if m:
            arr_start = m.start(1)
            end = _find_matching_brace(text, arr_start, "[", "]")
            if end != -1:
                arr_str = text[arr_start: arr_start + end + 1]
                try:
                    items = json.loads(arr_str)
                    if isinstance(items, list):
                        return {"items": items}, None
                except json.JSONDecodeError:
                    pass

    return None, f"Aucun JSON valide extrait de la reponse ({len(raw)} chars)"


@dataclass
class LLMResponse:
    raw_text: str
    parsed: dict | None
    model: str
    duration_ms: int
    prompt_chars: int
    error: str | None = None


class LLMProvider(ABC):
    @abstractmethod
    def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResponse:
        ...


class OllamaProvider(LLMProvider):
    def __init__(self) -> None:
        self.base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.model = os.environ.get("OLLAMA_MODEL", "qwen3:4b")
        self.timeout = int(os.environ.get("LLM_TIMEOUT_SECONDS", "180"))
        self.max_input_chars = int(os.environ.get("LLM_MAX_INPUT_CHARS", "8000"))

    def complete(
        self,
        prompt: str | tuple[str, str],
        json_schema: dict[str, Any] | None = None,
    ) -> LLMResponse:
        # Accepte soit un prompt simple (str) soit un tuple (system, user)
        if isinstance(prompt, tuple):
            system_prompt, user_prompt = prompt
        else:
            system_prompt = ""
            user_prompt = prompt

        if len(user_prompt) > self.max_input_chars:
            user_prompt = user_prompt[: self.max_input_chars]

        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})
        # Prefilling : force le modèle à continuer directement en JSON sans phase de réflexion
        messages.append({"role": "assistant", "content": '{"items":['})

        # Streaming pour éviter le timeout pendant la phase de thinking de qwen3
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "think": False,
            "options": {
                "temperature": 0.0,
                "num_predict": 3000,
            },
        }

        t0 = time.monotonic()
        try:
            resp = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout,
                stream=True,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            return LLMResponse(
                raw_text="",
                parsed=None,
                model=self.model,
                duration_ms=int((time.monotonic() - t0) * 1000),
                prompt_chars=len(system_prompt) + len(user_prompt),
                error=str(exc),
            )

        # Accumule la réponse complète token par token
        # On préfixe avec le contenu du message assistant injecté (prefilling)
        raw_text = '{"items":['
        try:
            for line in resp.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                token = (chunk.get("message") or {}).get("content", "")
                raw_text += token
                if chunk.get("done"):
                    break
        except requests.RequestException as exc:
            return LLMResponse(
                raw_text=raw_text,
                parsed=None,
                model=self.model,
                duration_ms=int((time.monotonic() - t0) * 1000),
                prompt_chars=len(system_prompt) + len(user_prompt),
                error=str(exc),
            )

        duration_ms = int((time.monotonic() - t0) * 1000)

        parsed, error = _extract_json(raw_text)
        return LLMResponse(
            raw_text=raw_text,
            parsed=parsed,
            model=self.model,
            duration_ms=duration_ms,
            prompt_chars=len(system_prompt) + len(user_prompt),
            error=error,
        )


def get_provider() -> LLMProvider:
    provider = os.environ.get("LLM_PROVIDER", "ollama").lower()
    if provider == "ollama":
        return OllamaProvider()
    raise ValueError(f"Provider LLM non supporté : '{provider}'. Seule la valeur 'ollama' est disponible au MVP.")
