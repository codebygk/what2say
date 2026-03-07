// ─────────────────────────────────────────────
//  ZapComment - Service Worker
//  Supports: OpenAI, Anthropic, Gemini, Groq, Ollama
// ─────────────────────────────────────────────

import {
  GENERATE_MENU_ID,
  OLLAMA_TIMEOUT_MS,
  CLOUD_TIMEOUT_MS,
  FREE_MIN_CHAR_LIMIT,
  FREE_MAX_CHAR_LIMIT,
  FREE_TONE,
  DEFAULT_SETTINGS,
  TONES,
  LICENSE_API,
  CACHE_DAYS,
} from '../shared/constants.js';
import { buildPrompt } from './prompt-builder.js';

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
    chrome.action.setTitle({ title: "ZapComment - Click icon to generate" });
  });
});

// ── Message Handler ───────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "LIST_MODELS") {
    listOllamaModels(message.baseUrl).then((models) => sendResponse({ models }));
    return true;
  }

  if (message.type === "GENERATE_IN_BG") {
    handleGenerateRequest(message.text, message.quickTone, message.quickMin, message.quickMax)
      .then((result) => sendResponse(result));
    return true;
  }
});

// ── Badge Helpers ─────────────────────────────

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setTitle({ title: "ZapComment" });
}

// ── Call Provider ─────────────────────────────

async function callProvider(messages, settings) {
  const provider = PROVIDERS[settings.provider];
  if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);

  const req = provider.buildRequest({
    messages,
    model: settings.model,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl ?? "http://localhost:11434",
  });

  const timeoutMs = (settings.timeoutSecs ?? 60) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`${provider.name} error ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = provider.parseResponse(data);
    if (!text) throw new Error(`${provider.name} returned an empty response.`);
    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error(`Request timed out after ${settings.timeoutSecs}s.`);
    throw err;
  }
}

// ── Generation ────────────────────────────────

async function handleGenerateRequest(postText, quickTone = null, quickMin = null, quickMax = null) {
  chrome.action.setBadgeText({ text: "..." });
  chrome.action.setBadgeBackgroundColor({ color: "#4f6ef7" });

  const [settings, isPro] = await Promise.all([loadSettings(), checkLicense()]);

  const tone = isPro ? (quickTone ?? settings.tone) : FREE_TONE;
  const minChars = isPro ? (quickMin ?? settings.minCharLimit) : FREE_MIN_CHAR_LIMIT;
  const maxChars = isPro ? (quickMax ?? settings.maxCharLimit) : FREE_MAX_CHAR_LIMIT;

  const messages = buildPrompt({
    postText,
    tone,
    persona: settings.persona,
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

function trimToMax(text, maxChars) {
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);

  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf(".\n"),
  );
  if (sentenceEnd > maxChars * 0.6) {
    const cut = text.slice(0, sentenceEnd + 1).trim();
    if (cut.length <= maxChars) return cut;
  }

  const wordEnd = slice.lastIndexOf(" ");
  if (wordEnd > maxChars * 0.6) {
    const cut = text.slice(0, wordEnd).trim();
    if (cut.length <= maxChars) return cut;
  }

  return text.slice(0, maxChars);
}

async function enforceCharLimits(comment, minChars, maxChars, messages, settings, attempt = 1) {
  const MAX_ATTEMPTS = 3;

  if (comment.length > maxChars) {
    comment = trimToMax(comment, maxChars);
    if (comment.length > maxChars) comment = comment.slice(0, maxChars);
  }

  if (comment.length < minChars && attempt <= MAX_ATTEMPTS) {
    const retryMessages = [
      ...messages,
      { role: "assistant", content: comment },
      {
        role: "user",
        content: `Too short at ${comment.length} chars. Rewrite the comment to be between ${minChars} and ${maxChars} characters. Output ONLY the comment text, nothing else.`,
      },
    ];
    try {
      let expanded = await callProvider(retryMessages, settings);
      if (expanded.length > maxChars) {
        expanded = trimToMax(expanded, maxChars);
        if (expanded.length > maxChars) expanded = expanded.slice(0, maxChars);
      }
      return enforceCharLimits(expanded, minChars, maxChars, messages, settings, attempt + 1);
    } catch {
      return comment;
    }
  }

  if (comment.length > maxChars) comment = comment.slice(0, maxChars);
  return comment;
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

chrome.commands.onCommand.addListener((command) => {
  if (command !== "generate-comment") return;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() ?? ""
    }, ([result]) => {
      const text = result?.result;
      if (!text) return;
      chrome.storage.session.set({ pendingGenerate: text });
      chrome.sidePanel.open({ windowId: tab.windowId });
    });
  });
});

// ── Utility ───────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}