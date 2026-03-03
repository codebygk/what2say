// ─────────────────────────────────────────────
//  Notifier — thin wrapper around chrome.notifications
//  so notification calls read like English.
// ─────────────────────────────────────────────

const NOTIF_ID = "what2say-notification";

// ── Notifications ─────────────────────────────

function showGeneratingNotification() {
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type:     "basic",
      title:    "Way2Say",
      message:  "⏳ Generating comment…",
      priority: 2,
    });
  });
}

function clearNotification() {
  chrome.notifications.clear(NOTIF_ID);
}

function notifySuccess(text) {
  const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type:     "basic",
      title:    "Way2Say",
      message:  '📋 Copied! "' + preview + '"',
      priority: 1,
    });
  });
}

function notifyError(msg) {
  chrome.notifications.clear(NOTIF_ID, () => {
    chrome.notifications.create(NOTIF_ID, {
      type:     "basic",
      title:    "Way2Say - Error",
      message:  "❌ " + msg,
      priority: 2,
    });
  });
}