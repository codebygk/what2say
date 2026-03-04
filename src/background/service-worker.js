// ─────────────────────────────────────────────
//  Way2Say — Service Worker
//  Supports: OpenAI, Anthropic, Gemini, Groq, Ollama
//  Self-contained, no imports.
// ─────────────────────────────────────────────

// ── Constants ─────────────────────────────────
const GENERATE_MENU_ID = "way2say-generate";
const NOTIF_ID = "way2say-notif";
const OLLAMA_TIMEOUT_MS = 60_000;
const CLOUD_TIMEOUT_MS = 30_000;

const FREE_CHAR_LIMIT = 300;
const FREE_TONE = "professional";
const CACHE_DAYS = 7;
const LICENSE_API =
  "https://way2say-license.gopalakrishnan-work-203.workers.dev";

const DEFAULT_SETTINGS = {
  provider: "ollama",
  model: "llama3:8b",
  apiKey: "",
  baseUrl: "http://localhost:11434",
  tone: "professional",
  persona: "",
  charLimit: 1000,
};

const TONES = {
  professional: "professional and insightful",
  friendly: "warm and friendly",
  witty: "clever and witty",
  concise: "brief and to the point",
  supportive: "encouraging and supportive",
};

// ── Provider Definitions ──────────────────────
// Each provider exposes a buildRequest() and parseResponse()
// so adding a new provider is just adding a new entry here.

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
      // Anthropic separates system prompt from messages
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
        .map((m) => ({
          role: "user",
          parts: [{ text: m.content }],
        }));
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
      // Same shape as OpenAI
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

chrome.runtime.onInstalled.addListener(registerContextMenu);
chrome.runtime.onStartup.addListener(registerContextMenu);

function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: GENERATE_MENU_ID,
      title: "Generate Comment",
      contexts: ["selection"],
    });
  });
}

// ── Context Menu Click ────────────────────────

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== GENERATE_MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text) {
    notifyError("No text selected.");
    return;
  }
  generateAndCopy(text);
});

// ── Message Handler ───────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "LIST_MODELS") {
    listOllamaModels().then((models) => sendResponse({ models }));
    return true;
  }
});

// ── Core Pipeline ─────────────────────────────

async function generateAndCopy(postText) {
  const [settings, isPro] = await Promise.all([loadSettings(), checkLicense()]);

  // Enforce free tier limits
  const tone = isPro ? settings.tone : FREE_TONE;
  const charLimit = isPro ? settings.charLimit : FREE_CHAR_LIMIT;

  showGeneratingNotification();
  await sleep(150);

  const messages = buildPrompt({
    postText,
    tone,
    persona: isPro ? settings.persona : "",
    charLimit,
  });

  let comment;
  try {
    comment = await callProvider(messages, settings);
  } catch (err) {
    console.error("[Way2Say] Provider error:", err);
    notifyError(err.message);
    return;
  }

  try {
    await writeToClipboard(comment);
  } catch (err) {
    console.error("[Way2Say] Clipboard error:", err);
    notifyError("Clipboard write failed: " + err.message);
    return;
  }

  notifySuccess(comment);
}

// ── Provider Router ───────────────────────────

async function callProvider(messages, settings) {
  const provider = PROVIDERS[settings.provider];
  if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);

  const reqArgs = {
    messages,
    model: settings.model,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl || "http://localhost:11434",
  };

  const { url, headers, body } = provider.buildRequest(reqArgs);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeout);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error(
        `${provider.name} timed out. Check your connection or try a smaller model.`,
      );
    }
    if (settings.provider === "ollama") {
      throw new Error(
        "Cannot reach Ollama. Run: OLLAMA_ORIGINS=* ollama serve",
      );
    }
    throw new Error(
      `Cannot reach ${provider.name}. Check your API key and connection.`,
    );
  }

  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let hint = "";
    if (response.status === 401) hint = " — Invalid API key.";
    if (response.status === 429) hint = " — Rate limit exceeded.";
    if (response.status === 404) hint = " — Model not found.";
    throw new Error(`${provider.name} error ${response.status}${hint}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${provider.name} returned invalid JSON.`);
  }

  const content = provider.parseResponse(data);
  if (!content) throw new Error(`${provider.name} returned an empty response.`);

  return content;
}

// ── Prompt Builder ────────────────────────────

function buildPrompt({ postText, tone, persona, charLimit }) {
  const toneDesc = TONES[tone] ?? TONES.professional;
  const personaLine =
    persona && persona.trim()
      ? "You are writing as: " + persona.trim() + "."
      : "You are a thoughtful professional engaging with content online.";

  const system = [
    personaLine,
    "Write a single comment replying to the social media post below.",
    "Tone: " + toneDesc + ".",
    "Rules:",
    "  - Maximum " + charLimit + " characters.",
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
        if (!licenseCache?.key) {
          resolve(false);
          return;
        }
        const daysSince =
          (Date.now() - (licenseCache.lastValidated ?? 0)) / 86_400_000;
        if (daysSince < CACHE_DAYS) {
          resolve(licenseCache.plan === "pro");
          return;
        }
        // Re-validate
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
        } // grace period on network failure
      },
    );
  });
}

// ── Storage ───────────────────────────────────

function loadSettings() {
  return new Promise((resolve) =>
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve),
  );
}

// ── Clipboard ─────────────────────────────────

async function writeToClipboard(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isSafeTab =
    tab?.id &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://") &&
    !tab.url.startsWith("edge://") &&
    !tab.url.startsWith("about:");

  if (isSafeTab) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => {
        try {
          const el = document.createElement("textarea");
          el.value = t;
          el.style.cssText =
            "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
          document.body.appendChild(el);
          el.focus();
          el.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(el);
          if (!ok) throw new Error("execCommand failed");
        } catch {
          return navigator.clipboard.writeText(t);
        }
      },
      args: [text],
    });
    return;
  }
  await copyViaOffscreen(text);
}

async function copyViaOffscreen(text) {
  const hasDoc = await chrome.offscreen.hasDocument?.().catch(() => false);
  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Write comment to clipboard",
    });
  }
  await chrome.runtime.sendMessage({ type: "COPY_TO_CLIPBOARD", text });
  await chrome.offscreen.closeDocument().catch(() => {});
}

// ── Notifications ─────────────────────────────

function showGeneratingNotification() {
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: "Way2Say",
      message: "⏳ Generating comment…",
      priority: 2,
    });
  });
}

function notifySuccess(text) {
  const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: "Way2Say ✓",
      message: '📋 Copied! "' + preview + '"',
      priority: 1,
    });
  });
}

function notifyError(msg) {
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: "Way2Say — Error",
      message: "❌ " + msg,
      priority: 2,
    });
  });
}

// ── Utility ───────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
