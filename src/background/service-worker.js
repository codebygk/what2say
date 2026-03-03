import { DEFAULT_SETTINGS, TONES } from "../shared/constants.js";

const OLLAMA_BASE_URL   = "http://localhost:11434";
const OLLAMA_ENDPOINT   = "/api/chat";
const OLLAMA_TIMEOUT_MS = 60_000;
const GENERATE_MENU_ID  = "ai-commenter-generate";
const NOTIF_ID          = "ai-commenter-main";

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

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== GENERATE_MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text) { notifyError("No text selected."); return; }
  generateAndCopy(text);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "LIST_MODELS") {
    listLocalModels().then((models) => sendResponse({ models }));
    return true;
  }
});

async function generateAndCopy(postText) {
  const settings = await loadSettings();
  showGeneratingNotification();
  await sleep(150);

  const messages = buildPrompt({
    postText,
    tone:      settings.tone,
    persona:   settings.persona,
    charLimit: settings.charLimit,
  });

  let comment;
  try {
    comment = await ollamaChat(messages, settings.model);
  } catch (err) {
    console.error("[Way2Say] Ollama error:", err);
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

async function ollamaChat(messages, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(OLLAMA_BASE_URL + OLLAMA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, messages, stream: false }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error("Ollama timed out after 60s. Try gemma2:2b for faster responses.");
    throw new Error("Cannot reach Ollama. Run: OLLAMA_ORIGINS=* ollama serve");
  }
  clearTimeout(timer);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error("Ollama returned " + response.status + ": " + body);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Ollama response was not valid JSON."); }
  const content = data?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Ollama returned empty response. Is " + model + " pulled?");
  return content;
}

async function listLocalModels() {
  try {
    const res = await fetch(OLLAMA_BASE_URL + "/api/tags", { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m) => m.name);
  } catch { return []; }
}

async function writeToClipboard(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isSafeTab =
    tab?.id && tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://") &&
    !tab.url.startsWith("edge://") &&
    !tab.url.startsWith("about:");

  if (isSafeTab) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => navigator.clipboard.writeText(t),
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
      justification: "Write generated comment to clipboard",
    });
  }
  await chrome.runtime.sendMessage({ type: "COPY_TO_CLIPBOARD", text });
  await chrome.offscreen.closeDocument().catch(() => {});
}

function buildPrompt({ postText, tone, persona, charLimit }) {
  const toneDesc = TONES[tone] ?? TONES.professional;
  const personaLine = persona && persona.trim()
    ? "You are writing as: " + persona.trim() + "."
    : "You are a thoughtful professional engaging with content online.";
  const system = [
    personaLine,
    "Write a single comment replying to the social media post below.",
    "Tone: " + toneDesc + ".",
    "Rules:",
    "  - Maximum " + charLimit + " characters.",
    "  - Output ONLY the comment text. No labels, no quotes, no preamble.",
    "  - Never start with Great post! or hollow openers.",
    "  - Be specific to the content.",
    "  - Sound human, not AI-generated.",
  ].join("\n");
  const user = 'Post:\n"""\n' + postText.trim() + '\n"""\n\nWrite a comment:';
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function loadSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULT_SETTINGS, resolve));
}

function showGeneratingNotification() {
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type:     "basic",
      iconUrl:  chrome.runtime.getURL("icons/icon48.png"),
      title:    "Way2Say",
      message:  "Generating comment...",
      priority: 2,
    });
  });
}

function notifySuccess(text) {
  const preview = text.length > 60 ? text.slice(0, 60) + "..." : text;
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type:     "basic",
      iconUrl:  chrome.runtime.getURL("icons/icon48.png"),
      title:    "Way2Say - Done",
      message:  'Copied! "' + preview + '"',
      priority: 1,
    });
  });
}

function notifyError(msg) {
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type:     "basic",
      iconUrl:  chrome.runtime.getURL("icons/icon48.png"),
      title:    "Way2Say - Error",
      message:  msg,
      priority: 2,
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}