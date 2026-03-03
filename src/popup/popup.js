// ─────────────────────────────────────────────
//  Popup Script — handles the settings UI.
//  Reads from storage on open, saves back on click.
// ─────────────────────────────────────────────
import { DEFAULT_SETTINGS } from "/src/shared/constants.js";
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from "/src/shared/storage.js";

// ── DOM refs ──────────────────────────────────
const modelSelect = document.getElementById("model-select");
const toneSelect = document.getElementById("tone-select");
const charLimit = document.getElementById("char-limit");
const charDisplay = document.getElementById("char-display");
const personaInput = document.getElementById("persona");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const saveConfirm = document.getElementById("save-confirm");
const ollamaStatus = document.getElementById("ollama-status");
const statusText = document.getElementById("status-text");

// ── Init ──────────────────────────────────────

async function init() {
  await Promise.all([populateModels(), populateForm()]);
}

/** Fetch available models from Ollama via the service worker. */
async function populateModels() {
  const response = await chrome.runtime.sendMessage({ type: "LIST_MODELS" });
  const models = response?.models ?? [];

  if (models.length === 0) {
    setStatus("error", "Ollama not reachable — is it running?");
    modelSelect.innerHTML = '<option value="">No models found</option>';
    return;
  }

  setStatus(
    "connected",
    `Connected · ${models.length} model${models.length !== 1 ? "s" : ""} available`,
  );

  const settings = await loadSettings();
  modelSelect.innerHTML = models
    .map(
      (m) =>
        `<option value="${m}" ${m === settings.model ? "selected" : ""}>${m}</option>`,
    )
    .join("");
}

/** Populate form fields from saved settings. */
async function populateForm() {
  const settings = await loadSettings();
  toneSelect.value = settings.tone ?? DEFAULT_SETTINGS.tone;
  charLimit.value = settings.charLimit ?? DEFAULT_SETTINGS.charLimit;
  charDisplay.textContent = charLimit.value;
  personaInput.value = settings.persona ?? "";
}

// ── Event Listeners ───────────────────────────

charLimit.addEventListener("input", () => {
  charDisplay.textContent = charLimit.value;
});

saveBtn.addEventListener("click", async () => {
  await saveSettings({
    model: modelSelect.value,
    tone: toneSelect.value,
    charLimit: Number(charLimit.value),
    persona: personaInput.value.trim(),
  });
  showConfirm("Settings saved ✓");
});

resetBtn.addEventListener("click", async () => {
  await resetSettings();
  await populateForm();
  // Re-select model in dropdown if possible
  if (modelSelect.options.length > 0) {
    modelSelect.value = DEFAULT_SETTINGS.model;
    if (!modelSelect.value) modelSelect.selectedIndex = 0;
  }
  showConfirm("Reset to defaults ✓");
});

// ── Helpers ───────────────────────────────────

function setStatus(type, message) {
  ollamaStatus.className = type; // "connected" | "error" | ""
  statusText.textContent = message;
}

let confirmTimer;
function showConfirm(message) {
  saveConfirm.textContent = message;
  clearTimeout(confirmTimer);
  confirmTimer = setTimeout(() => (saveConfirm.textContent = ""), 2500);
}

// ── Boot ──────────────────────────────────────
init();
