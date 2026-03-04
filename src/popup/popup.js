// ─────────────────────────────────────────────
//  Popup Script
// ─────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  model:     "llama3:8b",
  tone:      "professional",
  persona:   "",
  charLimit: 1000,
};

function loadSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULT_SETTINGS, resolve));
}

function saveSettings(data) {
  return new Promise((resolve) => chrome.storage.sync.set(data, resolve));
}

function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}

// ── DOM refs ──────────────────────────────────
const modelSelect  = document.getElementById("model-select");
const toneSelect   = document.getElementById("tone-select");
const charLimit    = document.getElementById("char-limit");
const charDisplay  = document.getElementById("char-display");
const personaInput = document.getElementById("persona");
const saveBtn      = document.getElementById("save-btn");
const resetBtn     = document.getElementById("reset-btn");
const saveConfirm  = document.getElementById("save-confirm");
const ollamaStatus = document.getElementById("ollama-status");
const statusText   = document.getElementById("status-text");
const themeToggle = document.getElementById("themeToggleBtn");

// ── Theme ─────────────────────────────────────
themeToggle.addEventListener("click", toggleTheme);

// ===============================
// THEME
// ===============================

function loadTheme() {
  chrome.storage.local.get(["theme"], (r) => {
    const theme = r.theme || "light";
    applyTheme(theme);
    const sel = document.getElementById("themeSelect");
    if (sel) sel.value = theme;
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  if (theme === "dark") {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>`;
  }
}

function toggleTheme() {
  chrome.storage.local.get(["theme"], (r) => {
    const next = r.theme === "dark" ? "light" : "dark";
    chrome.storage.local.set({ theme: next }, () => applyTheme(next));
  });
}


// Snapshot of what's currently saved — used to detect changes
let savedSnapshot = null;

// ── Init ──────────────────────────────────────

async function init() {
  await Promise.all([loadTheme(), populateModels(), populateForm()]);
  savedSnapshot = getFormState();
  watchForChanges();
}
// ── Model List ────────────────────────────────

async function populateModels() {
  const response = await chrome.runtime.sendMessage({ type: "LIST_MODELS" });
  const models = response?.models ?? [];

  if (models.length === 0) {
    setStatus("error", "Ollama not reachable — is it running?");
    modelSelect.innerHTML = '<option value="">No models found</option>';
    return;
  }

  setStatus("connected", `Connected · ${models.length} model${models.length !== 1 ? "s" : ""} available`);

  const settings = await loadSettings();
  modelSelect.innerHTML = models
    .map((m) => `<option value="${m}" ${m === settings.model ? "selected" : ""}>${m}</option>`)
    .join("");
}

// ── Form Population ───────────────────────────

async function populateForm() {
  const s = await loadSettings();
  toneSelect.value        = s.tone      ?? DEFAULT_SETTINGS.tone;
  charLimit.value         = s.charLimit ?? DEFAULT_SETTINGS.charLimit;
  charDisplay.textContent = charLimit.value;
  personaInput.value      = s.persona   ?? "";
}

// ── Change Detection ──────────────────────────

/** Returns a plain object snapshot of the current form values */
function getFormState() {
  return {
    model:     modelSelect.value,
    tone:      toneSelect.value,
    charLimit: Number(charLimit.value),
    persona:   personaInput.value.trim(),
  };
}

/** Returns true if the form differs from the last saved snapshot */
function hasChanges() {
  if (!savedSnapshot) return false;
  const current = getFormState();
  return (
    current.model     !== savedSnapshot.model     ||
    current.tone      !== savedSnapshot.tone      ||
    current.charLimit !== savedSnapshot.charLimit ||
    current.persona   !== savedSnapshot.persona
  );
}

function updateSaveBtn() {
  saveBtn.disabled = !hasChanges();
}

/** Attach change listeners to all inputs */
function watchForChanges() {
  modelSelect.addEventListener("change", updateSaveBtn);
  toneSelect.addEventListener("change", updateSaveBtn);
  charLimit.addEventListener("input", () => {
    charDisplay.textContent = charLimit.value;
    updateSaveBtn();
  });
  personaInput.addEventListener("input", updateSaveBtn);
}

// ── Save ──────────────────────────────────────

saveBtn.addEventListener("click", async () => {
  const state = getFormState();
  await saveSettings(state);
  savedSnapshot = state;         // update snapshot so button disables again
  saveBtn.disabled = true;
  showConfirm("Settings saved ✓");
});

// ── Reset ─────────────────────────────────────

resetBtn.addEventListener("click", async () => {
  await resetSettings();
  await populateForm();

  // Re-select model in dropdown if possible
  if (modelSelect.options.length > 0) {
    const hasDefault = [...modelSelect.options].some(
      (o) => o.value === DEFAULT_SETTINGS.model
    );
    modelSelect.value = hasDefault ? DEFAULT_SETTINGS.model : modelSelect.options[0].value;
  }

  // After reset, snapshot what's now showing and disable save
  savedSnapshot = getFormState();
  saveBtn.disabled = true;
  showConfirm("Reset to defaults ✓");
});

// ── Helpers ───────────────────────────────────

function setStatus(type, message) {
  ollamaStatus.className = type;
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