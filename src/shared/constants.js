// ─────────────────────────────────────────────
//  Constants - single source of truth for the
//  entire extension. Edit here, nowhere else.
// ─────────────────────────────────────────────

export const OLLAMA = {
  BASE_URL: "http://localhost:11434",
  ENDPOINT: "/api/chat",
  DEFAULT_MODEL: "llama3:8b",
  TIMEOUT_MS: 60000, // 60 seconds
};

export const CONTEXT_MENU = {
  ROOT_ID: "zapcomment-root",
  GENERATE_ID: "zapcomment-generate",
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
  funny: "humorous and light-hearted, use wit and playfulness",
};

export const DEFAULT_SETTINGS = {
  provider: "ollama",
  model: "llama3:8b",
  apiKey: "",
  baseUrl: "http://localhost:11434",
  tone: "professional",
  persona: "",
  minCharLimit: 200,
  maxCharLimit: 1000,
};

export const MESSAGES = {
  GENERATE_COMMENT: "GENERATE_COMMENT",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
};

export const NOTIFICATIONS = {
  SUCCESS_ID: "zapcomment-success",
  ERROR_ID: "zapcomment-error",
  ICON: "/icons/icon48.png",
};

export const LICENSE_API = "https://zapcomment-license.gopalakrishnan-work-203.workers.dev";
export const PRO_PLAN_URL = "https://dodo.pe/zapcomment";
export const CACHE_DAYS = 7;

export const PROVIDER_CONFIG = {
  ollama: {
    label: "Ollama (Local)",
    fields: [
      { key: "baseUrl", label: "Ollama URL", placeholder: "http://localhost:11434", type: "text" },
      { key: "model", label: "Model", placeholder: "llama3:8b", type: "select-or-text", dynamic: true },
    ],
    hint: 'Free &amp; local. Start: <code>$env:OLLAMA_ORIGINS=*; ollama serve</code>',
  },
  openai: {
    label: "OpenAI",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-…", type: "password" },
      { key: "model", label: "Model", placeholder: "", type: "select", options: ["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-3.5-turbo"] },
    ],
    hint: 'Get key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>',
  },
  anthropic: {
    label: "Claude (Anthropic)",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-ant-…", type: "password" },
      { key: "model", label: "Model", placeholder: "", type: "select", options: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"] },
    ],
    hint: 'Get key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>',
  },
  gemini: {
    label: "Gemini (Google)",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "AIza…", type: "password" },
      { key: "model", label: "Model", placeholder: "", type: "select", options: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"] },
    ],
    hint: 'Get key at <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>',
  },
  groq: {
    label: "Groq (Fast & Free)",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "gsk_…", type: "password" },
      { key: "model", label: "Model", placeholder: "", type: "select", options: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"] },
    ],
    hint: 'Free tier available. <a href="https://console.groq.com" target="_blank">console.groq.com</a>',
  },
};


export const GENERATE_MENU_ID = "zapcomment-generate";
export const OLLAMA_TIMEOUT_MS = 60_000;
export const CLOUD_TIMEOUT_MS = 30_000;
export const FREE_MIN_CHAR_LIMIT = 100;
export const FREE_MAX_CHAR_LIMIT = 300;
export const FREE_TONE = "professional";
export const PANEL_PATH = "src/sidepanel/sidepanel.html";