// ─────────────────────────────────────────────
//  Constants — single source of truth for the
//  entire extension. Edit here, nowhere else.
// ─────────────────────────────────────────────

export const OLLAMA = {
  BASE_URL: "http://localhost:11434",
  ENDPOINT: "/api/chat",
  DEFAULT_MODEL: "llama3:8b",
  TIMEOUT_MS: 60000, // 60 seconds
};

export const CONTEXT_MENU = {
  ROOT_ID: "way2say-root",
  GENERATE_ID: "way2say-generate",
};

export const STORAGE_KEYS = {
  MODEL: "model",
  TONE: "tone",
  PERSONA: "persona",
  CHAR_LIMIT: "charLimit",
};

export const TONES = {
  professional: "professional and insightful",
  clever: "clever and witty",
  supportive: "encouraging and supportive",
  funny:        "humorous and light-hearted, use wit and playfulness",
};

export const DEFAULT_SETTINGS = {
  provider:     "ollama",
  model:        "llama3:8b",
  apiKey:       "",
  baseUrl:      "http://localhost:11434",
  tone:         "professional",
  persona:      "",
  minCharLimit: 200,
  maxCharLimit: 1000,
};

export const MESSAGES = {
  GENERATE_COMMENT: "GENERATE_COMMENT",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
};

export const NOTIFICATIONS = {
  SUCCESS_ID: "way2say-success",
  ERROR_ID: "way2say-error",
  ICON: "/icons/icon48.png",
};
