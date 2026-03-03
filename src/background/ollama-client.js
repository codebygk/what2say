// ─────────────────────────────────────────────
//  Ollama Client — all network logic lives here.
//  The rest of the app never calls fetch() directly.
// ─────────────────────────────────────────────
import { OLLAMA } from "/src/shared/constants.js";

/**
 * @typedef {Object} OllamaMessage
 * @property {"system"|"user"|"assistant"} role
 * @property {string} content
 */

/**
 * Send a chat completion request to the local Ollama server.
 * Returns the full assistant reply as a string.
 *
 * @param {OllamaMessage[]} messages
 * @param {string} model
 * @returns {Promise<string>}
 */
export async function ollamaChat(messages, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA.TIMEOUT_MS);

  const url = `${OLLAMA.BASE_URL}${OLLAMA.ENDPOINT}`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, messages, stream: true }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Ollama request timed out. Is Ollama running?");
    }
    throw new Error(
      `Cannot reach Ollama at ${OLLAMA.BASE_URL}. Start it with: ollama serve`,
    );
  }

  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama error ${response.status}: ${body}`);
  }

  // Collect streamed NDJSON chunks into one string
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        fullText += parsed?.message?.content ?? "";
      } catch {
        // Ignore malformed lines
      }
    }
  }

  return fullText.trim();
}

/**
 * Fetch the list of locally available models from Ollama.
 * Returns an array of model name strings.
 *
 * @returns {Promise<string[]>}
 */
export async function listLocalModels() {
  try {
    const response = await fetch(`${OLLAMA.BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}
