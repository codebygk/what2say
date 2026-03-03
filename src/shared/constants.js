// ─────────────────────────────────────────────
//  Constants — single source of truth for the
//  entire extension. Edit here, nowhere else.
// ─────────────────────────────────────────────

export const OLLAMA = {
  BASE_URL: "http://localhost:11434",
  ENDPOINT: "/api/chat",
  DEFAULT_MODEL: "llama3:8b",
  TIMEOUT_MS: 15_000,
};

export const CONTEXT_MENU = {
  ROOT_ID: "ai-commenter-root",
  GENERATE_ID: "ai-commenter-generate",
};

export const STORAGE_KEYS = {
  MODEL: "model",
  TONE: "tone",
  PERSONA: "persona",
  CHAR_LIMIT: "charLimit",
};

export const TONES = {
  professional: "professional and insightful",
  friendly: "warm and friendly",
  witty: "clever and witty",
  concise: "brief and to the point",
  supportive: "encouraging and supportive",
};

export const DEFAULT_SETTINGS = {
  model: "llama3:8b",
  tone: "professional",
  persona: "",
  charLimit: 300,
};

export const MESSAGES = {
  GENERATE_COMMENT: "GENERATE_COMMENT",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
};

export const NOTIFICATIONS = {
  SUCCESS_ID: "ai-commenter-success",
  ERROR_ID: "ai-commenter-error",
  ICON: "/icons/Icon-48.png",
};
