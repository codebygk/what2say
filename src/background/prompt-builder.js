// ─────────────────────────────────────────────
//  Prompt Builder — converts user settings +
//  selected post text into an Ollama messages array.
//  To add a new tone: just add it to TONES in constants.js.
// ─────────────────────────────────────────────
import { TONES } from "/src/shared/constants.js";

/**
 * Build the Ollama messages array for comment generation.
 *
 * @param {object} opts
 * @param {string} opts.postText  - Text selected by the user
 * @param {string} opts.tone      - Key from TONES map
 * @param {string} opts.persona   - Optional custom persona
 * @param {number} opts.charLimit - Max comment character length
 * @returns {{ role: string, content: string }[]}
 */
export function buildCommentPrompt({ postText, tone, persona, charLimit }) {
  const toneDescription = TONES[tone] ?? TONES.professional;

  const personaLine =
    persona && persona.trim()
      ? `You are writing as a person with a strong personality of: ${persona.trim()}.`
      : "You are a thoughtful professional engaging with content online.";

  const minChars = Math.max(50, charLimit - 100);

  const systemLines = [
    personaLine,
    "Your task is to write a single comment replying to the social media post below.",
    `Tone: ${toneDescription}.`,
    "Rules:",
    `  - Your response MUST be at least ${minChars} characters long.`,
    `  - If your response is under ${minChars} characters, expand it before responding.`,
    "  - Output ONLY the comment text. No labels, no quotes, no preamble.",
    "  - Never start with 'Great post!' or similar hollow openers.",
    "  - Be specific to the content — avoid vague generalities.",
    "  - Sound human, not AI-generated.",
  ];

  const system = systemLines.join("\n");
  const user = ["Post:", '"""', postText.trim(), '"""', "", "Write a comment:"].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}