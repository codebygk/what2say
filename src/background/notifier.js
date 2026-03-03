// ─────────────────────────────────────────────
//  Notifier — thin wrapper around chrome.notifications
//  so notification calls read like English.
// ─────────────────────────────────────────────

const NOTIF_ID = "ai-commenter-main";

export function showGeneratingNotification() {
  chrome.notifications.create(NOTIF_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("/icons/Icon-48.png"),
    title: "AI Commenter",
    message: "⏳ Generating comment…",
    priority: 1,
  });
}

export function notifySuccess(text) {
  const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
  chrome.notifications.create(NOTIF_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("/icons/Icon-48.png"),
    title: "AI Commenter ✓",
    message: '📋 Copied! "' + preview + '"',
    priority: 1,
  });
}

export function notifyError(msg) {
  chrome.notifications.create(NOTIF_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("/icons/Icon-48.png"),
    title: "AI Commenter — Error",
    message: "❌ " + msg,
    priority: 1,
  });
}

export function clearNotification() {
  chrome.notifications.clear(NOTIF_ID);
}
