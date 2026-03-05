// ─────────────────────────────────────────────
//  Way2Say — Service Worker
//  Supports: OpenAI, Anthropic, Gemini, Groq, Ollama
// ─────────────────────────────────────────────

// ── Constants ─────────────────────────────────
const GENERATE_MENU_ID = "way2say-generate";
const OLLAMA_TIMEOUT_MS = 60_000;
const CLOUD_TIMEOUT_MS = 30_000;

const FREE_MIN_CHAR_LIMIT = 100;
const FREE_MAX_CHAR_LIMIT = 300;
const FREE_TONE = "professional";
const CACHE_DAYS = 7;
const LICENSE_API =
  "https://way2say-license.gopalakrishnan-work-203.workers.dev";
const PANEL_PATH = "src/sidepanel/sidepanel.html";

const DEFAULT_SETTINGS = {
  provider:     "ollama",
  model:        "llama3:8b",
  apiKey:       "",
  baseUrl:      "http://localhost:11434",
  tone:         "professional",
  persona:      "",
  minCharLimit: 200,
  maxCharLimit: 1000,
};

const TONES = {
  professional: "professional and insightful",
  friendly:     "warm and friendly",
  witty:        "clever and witty",
  concise:      "brief and to the point",
  supportive:   "encouraging and supportive",
};

// ── Provider Definitions ──────────────────────

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    timeout: CLOUD_TIMEOUT_MS,
    buildRequest({ messages, model, apiKey }) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: false }),
      };
    },
    parseResponse(data) {
      return data?.choices?.[0]?.message?.content?.trim() ?? "";
    },
  },

  anthropic: {
    name: "Anthropic",
    timeout: CLOUD_TIMEOUT_MS,
    buildRequest({ messages, model, apiKey }) {
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const userMsgs = messages.filter((m) => m.role !== "system");
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system,
          messages: userMsgs,
        }),
      };
    },
    parseResponse(data) {
      return data?.content?.[0]?.text?.trim() ?? "";
    },
  },

  gemini: {
    name: "Gemini",
    timeout: CLOUD_TIMEOUT_MS,
    buildRequest({ messages, model, apiKey }) {
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const userMsg = messages
        .filter((m) => m.role === "user")
        .map((m) => ({ role: "user", parts: [{ text: m.content }] }));
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: userMsg,
        }),
      };
    },
    parseResponse(data) {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    },
  },

  groq: {
    name: "Groq",
    timeout: CLOUD_TIMEOUT_MS,
    buildRequest({ messages, model, apiKey }) {
      return {
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: false }),
      };
    },
    parseResponse(data) {
      return data?.choices?.[0]?.message?.content?.trim() ?? "";
    },
  },

  ollama: {
    name: "Ollama",
    timeout: OLLAMA_TIMEOUT_MS,
    buildRequest({ messages, model, baseUrl }) {
      return {
        url: `${baseUrl}/api/chat`,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
      };
    },
    parseResponse(data) {
      return data?.message?.content?.trim() ?? "";
    },
  },
};

// ── Setup ─────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: GENERATE_MENU_ID,
      title: "Generate Comment",
      contexts: ["selection"],
    });
  });
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

// ── Context Menu Click ────────────────────────

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== GENERATE_MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text) return;

  chrome.storage.session.set({ pendingGenerate: text }, () => {
    chrome.action.setBadgeText({ text: "⏳" });
    chrome.action.setBadgeBackgroundColor({ color: "#4f6ef7" });
    chrome.action.setTitle({ title: "Way2Say — Click icon to generate" });
  });
});

// ── Message Handler ───────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "LIST_MODELS") {
    listOllamaModels(message.baseUrl).then((models) => sendResponse({ models }));
    return true;
  }

  if (message.type === "GENERATE_IN_BG") {
    handleGenerateRequest(message.text).then((result) => sendResponse(result));
    return true;
  }
});

// ── Badge Helpers ─────────────────────────────

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setTitle({ title: "Way2Say" });
}

// ── Generation ────────────────────────────────

async function handleGenerateRequest(postText) {
  chrome.action.setBadgeText({ text: "..." });
  chrome.action.setBadgeBackgroundColor({ color: "#4f6ef7" });

  const [settings, isPro] = await Promise.all([loadSettings(), checkLicense()]);

  const tone     = isPro ? settings.tone        : FREE_TONE;
  const minChars = isPro ? settings.minCharLimit : FREE_MIN_CHAR_LIMIT;
  const maxChars = isPro ? settings.maxCharLimit : FREE_MAX_CHAR_LIMIT;

  const messages = buildPrompt({
    postText,
    tone,
    persona: isPro ? settings.persona : "",
    minChars,
    maxChars,
  });

  try {
    let comment = await callProvider(messages, settings);
    comment = await enforceCharLimits(comment, minChars, maxChars, messages, settings);
    clearBadge();
    return { ok: true, comment, provider: settings.provider, model: settings.model };
  } catch (err) {
    clearBadge();
    return { ok: false, error: err.message };
  }
}

// ── Char Limit Enforcement ────────────────────

function hardTrimToMax(text, maxChars) {
  if (text.length <= maxChars) return text;

  const trimmed = text.slice(0, maxChars);

  // Try to cut at last sentence boundary
  const lastPeriod = Math.max(
    trimmed.lastIndexOf(". "),
    trimmed.lastIndexOf("! "),
    trimmed.lastIndexOf("? ")
  );
  if (lastPeriod > maxChars * 0.5) {
    return trimmed.slice(0, lastPeriod + 1).trim();
  }

  // Fall back to last word boundary
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.5) {
    return trimmed.slice(0, lastSpace).trim();
  }

  return trimmed.trim();
}

async function enforceCharLimits(comment, minChars, maxChars, messages, settings, attempt = 1) {
  const MAX_ATTEMPTS = 3;

  // Always hard trim first if over max
  if (maxChars && comment.length > maxChars) {
    comment = hardTrimToMax(comment, maxChars);
  }

  // If still over max after trim (edge case), force slice
  if (maxChars && comment.length > maxChars) {
    comment = comment.slice(0, maxChars).trim();
  }

  // Retry if under min
  if (minChars && comment.length < minChars && attempt <= MAX_ATTEMPTS) {
    const retryMessages = [
      ...messages,
      { role: "assistant", content: comment },
      {
        role: "user",
        content: `That comment is only ${comment.length} characters. It must be at least ${minChars} characters and no more than ${maxChars} characters. Expand it. Output ONLY the comment text, nothing else.`,
      },
    ];
    try {
      let expanded = await callProvider(retryMessages, settings);
      // Trim the retry result too if it comes back over max
      if (maxChars && expanded.length > maxChars) {
        expanded = hardTrimToMax(expanded, maxChars);
      }
      return enforceCharLimits(expanded, minChars, maxChars, messages, settings, attempt + 1);
    } catch {
      return comment;
    }
  }

  return comment;
}

// ── Prompt Builder ────────────────────────────

function buildPrompt({ postText, tone, persona, minChars, maxChars }) {
  const toneDesc = TONES[tone] ?? TONES.professional;
  const personaLine =
    persona && persona.trim()
      ? "You are writing with a strong personality of: " + persona.trim() + "."
      : "You are a thoughtful professional engaging with content online.";

  const system = [
    personaLine,
    "Write a single comment replying to the social media post below.",
    "Tone: " + toneDesc + ".",
    "STRICT CHARACTER LIMIT RULES — YOU MUST FOLLOW THESE:",
    `  - Your response MUST be AT LEAST ${minChars} characters long.`,
    `  - Your response MUST be NO MORE THAN ${maxChars} characters long.`,
    `  - Target length: ${minChars}–${maxChars} characters. This is non-negotiable.`,
    "  - Count characters carefully before responding.",
    "  - If you are over the limit, shorten. If under, expand. Do not exceed " + maxChars + " characters under any circumstance.",
    "OTHER RULES:",
    "  - Output ONLY the comment text. No labels, no quotes, no preamble.",
    "  - Never start with 'Great post!' or hollow openers.",
    "  - Be specific to the content.",
    "  - Sound human, not AI-generated.",
  ].join("\n");

  const user = 'Post:\n"""\n' + postText.trim() + '\n"""\n\nWrite a comment:';

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── Ollama Model List ─────────────────────────

async function listOllamaModels(baseUrl = "http://localhost:11434") {
  try {
    const res = await fetch(baseUrl + "/api/tags", {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

// ── License Check ─────────────────────────────

async function checkLicense() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { licenseCache: null },
      async ({ licenseCache }) => {
        if (!licenseCache?.key) { resolve(false); return; }
        const daysSince =
          (Date.now() - (licenseCache.lastValidated ?? 0)) / 86_400_000;
        if (daysSince < CACHE_DAYS) {
          resolve(licenseCache.plan === "pro");
          return;
        }
        try {
          const res = await fetch(`${LICENSE_API}/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: licenseCache.key,
              deviceId: licenseCache.deviceId,
            }),
          });
          const data = await res.json();
          resolve(data.valid === true);
        } catch {
          resolve(true);
        }
      }
    );
  });
}

// ── Storage ───────────────────────────────────

function loadSettings() {
  return new Promise((resolve) =>
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve)
  );
}

// ── Utility ───────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}