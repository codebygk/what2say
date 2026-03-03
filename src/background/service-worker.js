// ─────────────────────────────────────────────
//  Service Worker — the extension's brain.
//  Registers the context menu, listens for clicks,
//  orchestrates the pipeline, writes to clipboard.
//
//  Flow:
//    User selects text → right-click → "Generate Comment"
//    → buildCommentPrompt() → ollamaChat() → clipboard → notify
// ─────────────────────────────────────────────
import {
  clearNotification,
  notifyError,
  notifySuccess,
  showGeneratingNotification,
} from "./notifier.js";
import { listLocalModels, ollamaChat } from "./ollama-client.js";
import { CONTEXT_MENU, MESSAGES, TONES } from "/src/shared/constants.js";
import { loadSettings } from "/src/shared/storage.js";

// ── Setup ─────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

// Re-register on browser startup (service workers can be killed)
chrome.runtime.onStartup.addListener(() => {
  registerContextMenu();
});

// ── Context Menu ──────────────────────────────

function registerContextMenu() {
  // Clear any stale menus first (safe to call on install)
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU.GENERATE_ID,
      title: "Generate Comment",
      contexts: ["selection"], // Only shows up when text is selected
    });
  });
}

// ── Context Menu Click Handler ────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU.GENERATE_ID) return;

  const selectedText = info.selectionText?.trim();
  if (!selectedText) {
    notifyError("No text selected. Select the post text and try again.");
    return;
  }

  await generateAndCopy(selectedText);
});

// ── Message Handler (called from popup) ───────
// Allows the popup to trigger generation or fetch model list.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGES.GENERATE_COMMENT) {
    generateAndCopy(message.postText).then(() => sendResponse({ ok: true }));
    return true; // Keep channel open for async response
  }

  if (message.type === "LIST_MODELS") {
    listLocalModels().then((models) => sendResponse({ models }));
    return true;
  }
});

// ── Core Pipeline ─────────────────────────────

/**
 * Full pipeline: selected text → Ollama → clipboard → notification.
 * All errors are caught and surfaced as notifications so the user
 * always gets feedback regardless of what went wrong.
 *
 * @param {string} postText
 */
async function generateAndCopy(postText) {
  const settings = await loadSettings();

  // Show "generating" notification immediately on click
  showGeneratingNotification();
  await new Promise((resolve) => setTimeout(resolve, 100)); // give Chrome time to render the notification

  const messages = buildPrompt({
    postText,
    tone: settings.tone,
    persona: settings.persona,
    charLimit: settings.charLimit,
  });

  let comment;
  try {
    comment = await ollamaChat(messages, settings.model);
  } catch (err) {
    console.error("[AI Commenter]", err);
    clearNotification();
    notifyError(err.message);
    return;
  }

  try {
    await writeToClipboard(comment);
  } catch (err) {
    clearNotification();
    notifyError("Clipboard write failed: " + err.message);
    return;
  }

  clearNotification();
  notifySuccess(comment);
}

// ── Clipboard Helper ──────────────────────────
// Service workers don't have direct clipboard access.
// We inject a tiny one-off script into the active tab to do it.

async function writeToClipboard(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (textToCopy) => navigator.clipboard.writeText(textToCopy),
    args: [text],
  });

  // executeScript throws on failure; surface any rejection
  if (results?.[0]?.result instanceof Error) {
    throw results[0].result;
  }
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

  const user = 'Post:\n"""\n' + postText + '\n"""\n\nWrite a comment:';

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
