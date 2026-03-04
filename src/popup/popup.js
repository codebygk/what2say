// ─────────────────────────────────────────────
//  Popup Script — Way2Say
// ─────────────────────────────────────────────

const FREE_CHAR_LIMIT = 300;
const FREE_TONE       = "professional";
const LICENSE_API     = "https://ai-commenter-license.YOUR_SUBDOMAIN.workers.dev";
const CACHE_DAYS      = 7;

const DEFAULT_SETTINGS = {
  model:     "llama3:8b",
  tone:      "professional",
  persona:   "",
  charLimit: 1000,
};

// ── Storage helpers ───────────────────────────

function loadSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULT_SETTINGS, resolve));
}
function saveSettings(data) {
  return new Promise((resolve) => chrome.storage.sync.set(data, resolve));
}
function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}
function loadLocal(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}
function saveLocal(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

// ── DOM refs ──────────────────────────────────
const modelSelect         = document.getElementById("model-select");
const toneSelect          = document.getElementById("tone-select");
const charLimit           = document.getElementById("char-limit");
const charDisplay         = document.getElementById("char-display");
const charSliderRow       = document.getElementById("char-slider-row");
const charFixedRow        = document.getElementById("char-fixed-row");
const personaInput        = document.getElementById("persona");
const saveBtn             = document.getElementById("save-btn");
const resetBtn            = document.getElementById("reset-btn");
const saveConfirm         = document.getElementById("save-confirm");
const ollamaStatus        = document.getElementById("ollama-status");
const statusText          = document.getElementById("status-text");
const themeToggle         = document.getElementById("themeToggleBtn");
const tierBadge           = document.getElementById("tier-badge");
const licenseSection      = document.getElementById("license-section");
const licenseHeader       = document.getElementById("license-header");
const licenseBody         = document.getElementById("license-body");
const licenseChevron      = document.getElementById("license-chevron");
const licenseStatusLabel  = document.getElementById("license-status-label");
const freeState           = document.getElementById("free-state");
const proState            = document.getElementById("pro-state");
const licenseKeyInput     = document.getElementById("license-key-input");
const licenseActivateBtn  = document.getElementById("license-activate-btn");
const licenseDeactivateBtn= document.getElementById("license-deactivate-btn");
const licenseError        = document.getElementById("license-error");
const proKeyPreview       = document.getElementById("pro-key-preview");
const toneLock            = document.getElementById("tone-lock");
const charLock            = document.getElementById("char-lock");

let savedSnapshot = null;
let isPro = false;

// ── Init ──────────────────────────────────────

async function init() {
  await Promise.all([loadTheme(), initLicense(), populateModels(), populateForm()]);
  savedSnapshot = getFormState();
  watchForChanges();
}

// ── Theme ─────────────────────────────────────

themeToggle.addEventListener("click", toggleTheme);

function loadTheme() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["theme"], (r) => {
      applyTheme(r.theme || "light");
      resolve();
    });
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  if (theme === "dark") {
    themeToggle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  } else {
    themeToggle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>`;
  }
}

function toggleTheme() {
  chrome.storage.local.get(["theme"], (r) => {
    const next = r.theme === "dark" ? "light" : "dark";
    chrome.storage.local.set({ theme: next }, () => applyTheme(next));
  });
}

// ── License Section Toggle ────────────────────

licenseHeader.addEventListener("click", () => {
  const isOpen = licenseBody.classList.contains("open");
  licenseBody.classList.toggle("open", !isOpen);
  licenseChevron.classList.toggle("open", !isOpen);
});

// ── License Init ──────────────────────────────

async function initLicense() {
  const cache = await loadLocal({ licenseCache: null });
  if (!cache.licenseCache?.key) {
    applyTier(false);
    return;
  }

  const { key, plan, lastValidated } = cache.licenseCache;
  const daysSince = (Date.now() - (lastValidated ?? 0)) / 86_400_000;

  if (daysSince < CACHE_DAYS) {
    // Trust cache
    isPro = plan === "pro";
  } else {
    // Re-validate
    const result = await validateWithServer(key);
    isPro = result.valid;
    if (isPro) {
      await saveLocal({
        licenseCache: { ...cache.licenseCache, lastValidated: Date.now() }
      });
    }
  }

  applyTier(isPro, key);
}

// ── Tier UI ───────────────────────────────────

function applyTier(pro, key = "") {
  isPro = pro;

  if (pro) {
    // Badge
    tierBadge.textContent = "Pro";
    tierBadge.className = "tier-badge pro";

    // License section
    licenseSection.classList.add("is-pro");
    licenseStatusLabel.textContent = "Active";
    licenseStatusLabel.style.color = "var(--success)";
    freeState.style.display = "none";
    proState.style.display  = "block";
    proKeyPreview.textContent = maskKey(key);

    // Unlock tone
    toneSelect.disabled = false;
    toneLock.style.display = "none";

    // Show slider
    charSliderRow.style.display = "flex";
    charFixedRow.style.display  = "none";
    charLock.style.display      = "none";

  } else {
    // Badge
    tierBadge.textContent = "Free";
    tierBadge.className = "tier-badge free";

    // License section
    licenseSection.classList.remove("is-pro");
    licenseStatusLabel.textContent = "Click to activate Pro";
    licenseStatusLabel.style.color = "";
    freeState.style.display = "block";
    proState.style.display  = "none";

    // Lock tone to professional
    toneSelect.value    = FREE_TONE;
    toneSelect.disabled = true;
    toneLock.style.display = "inline";

    // Show fixed char label
    charSliderRow.style.display = "none";
    charFixedRow.style.display  = "flex";
    charLock.style.display      = "inline";
  }
}

function maskKey(key) {
  if (!key) return "";
  const parts = key.split("-");
  return parts.map((p, i) => i === 0 ? p : "••••••").join("-");
}

// ── License Activation ────────────────────────

licenseActivateBtn.addEventListener("click", activateLicense);
licenseKeyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") activateLicense();
  licenseKeyInput.classList.remove("error");
  licenseError.textContent = "";
});

async function activateLicense() {
  const key = licenseKeyInput.value.trim().toUpperCase();

  if (!key) {
    setLicenseError("Please enter your license key.");
    return;
  }

  licenseActivateBtn.disabled = true;
  licenseActivateBtn.textContent = "Activating…";
  licenseError.textContent = "";
  licenseKeyInput.classList.remove("error");

  const result = await validateWithServer(key);

  licenseActivateBtn.disabled = false;
  licenseActivateBtn.textContent = "Activate";

  if (!result.valid) {
    licenseKeyInput.classList.add("error");
    setLicenseError(result.error ?? "Invalid license key.");
    return;
  }

  // Cache the valid license
  const { deviceId = crypto.randomUUID() } = await loadLocal({ deviceId: "" });
  await saveLocal({
    deviceId,
    licenseCache: {
      key,
      plan:          result.plan ?? "pro",
      lastValidated: Date.now(),
      deviceId,
    }
  });

  applyTier(true, key);
  licenseBody.classList.remove("open");
  licenseChevron.classList.remove("open");
  showConfirm("Pro activated! All features unlocked ✓");
}

// ── License Deactivation ──────────────────────

licenseDeactivateBtn.addEventListener("click", async () => {
  const cache = await loadLocal({ licenseCache: null });
  const { key, deviceId } = cache.licenseCache ?? {};

  if (key && deviceId) {
    // Best-effort server deactivation
    fetch(`${LICENSE_API}/deactivate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key, deviceId }),
    }).catch(() => {});
  }

  await saveLocal({ licenseCache: null });
  applyTier(false);
  licenseKeyInput.value = "";
  showConfirm("Device deactivated.");
});

// ── Server Validation ─────────────────────────

async function validateWithServer(key) {
  const { deviceId = crypto.randomUUID() } = await loadLocal({ deviceId: "" });
  await saveLocal({ deviceId });

  try {
    const res = await fetch(`${LICENSE_API}/validate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key, deviceId }),
    });
    return await res.json();
  } catch {
    return { valid: false, error: "Cannot reach license server. Check your connection." };
  }
}

function setLicenseError(msg) {
  licenseError.textContent = msg;
}

// ── Models ────────────────────────────────────

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

// ── Form ──────────────────────────────────────

async function populateForm() {
  const s = await loadSettings();
  toneSelect.value        = s.tone      ?? DEFAULT_SETTINGS.tone;
  charLimit.value         = s.charLimit ?? DEFAULT_SETTINGS.charLimit;
  charDisplay.textContent = charLimit.value;
  personaInput.value      = s.persona   ?? "";
}

function getFormState() {
  return {
    model:     modelSelect.value,
    tone:      toneSelect.value,
    charLimit: Number(charLimit.value),
    persona:   personaInput.value.trim(),
  };
}

function hasChanges() {
  if (!savedSnapshot) return false;
  const c = getFormState();
  return (
    c.model     !== savedSnapshot.model     ||
    c.tone      !== savedSnapshot.tone      ||
    c.charLimit !== savedSnapshot.charLimit ||
    c.persona   !== savedSnapshot.persona
  );
}

function updateSaveBtn() { saveBtn.disabled = !hasChanges(); }

function watchForChanges() {
  modelSelect.addEventListener("change", updateSaveBtn);
  toneSelect.addEventListener("change", updateSaveBtn);
  charLimit.addEventListener("input", () => {
    charDisplay.textContent = charLimit.value;
    updateSaveBtn();
  });
  personaInput.addEventListener("input", updateSaveBtn);
}

// ── Save / Reset ──────────────────────────────

saveBtn.addEventListener("click", async () => {
  const state = getFormState();
  await saveSettings(state);
  savedSnapshot = state;
  saveBtn.disabled = true;
  showConfirm("Settings saved ✓");
});

resetBtn.addEventListener("click", async () => {
  await resetSettings();
  await populateForm();
  if (modelSelect.options.length > 0) {
    const hasDefault = [...modelSelect.options].some((o) => o.value === DEFAULT_SETTINGS.model);
    modelSelect.value = hasDefault ? DEFAULT_SETTINGS.model : modelSelect.options[0].value;
  }
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