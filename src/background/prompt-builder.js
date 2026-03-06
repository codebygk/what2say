import {
  TONES,
} from '../shared/constants.js';

export function buildPrompt({ postText, tone, persona, minChars, maxChars }) {
  const toneDesc = TONES[tone] ?? TONES.professional;
  const personaLine =
    persona && persona.trim()
      ? "You are writing with a strong personality of: " + persona.trim() + "."
      : "You are a thoughtful professional engaging with content online.";

  const system = [
    personaLine,
    "Write a single comment replying to the social media post below.",
    "Tone: " + toneDesc + ".",
    "Rules:",
    `  - Length: ${minChars} to ${maxChars} characters.`,
    "  - Do NOT wrap the comment in quotes (single or double).",
    "  - Do NOT use code blocks, backticks, or markdown formatting.",
    "  - Do NOT add any labels, headers, preamble or explanation.",
    "  - Never start with 'Great post!' or hollow openers.",
    "  - Be specific to the content of the post.",
    "  - Sound human, not AI-generated.",
  ].join("\n");

  const user = 'Post:\n"""\n' + postText.trim() + '\n"""\n\nWrite a comment:';

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
