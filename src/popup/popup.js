// ─────────────────────────────────────────────
//  Way2Say — Popup Script
// ─────────────────────────────────────────────

const LICENSE_API =
  "https://way2say-license.gopalakrishnan-work-203.workers.dev";
const CACHE_DAYS = 7;

const DEFAULT_SETTINGS = {
  provider: "ollama",
  model: "llama3:8b",
  apiKey: "",
  baseUrl: "http://localhost:11434",
  tone: "professional",
  persona: "",
  charLimit: 1000,
  timeoutSecs: 60,
};

// ── Provider Config ───────────────────────────
const PROVIDER_CONFIG = {
  ollama: {
    label: "Ollama (Local)",
    icon: "🦙",
    models: [], // populated dynamically
    fields: [
      {
        key: "baseUrl",
        label: "Ollama URL",
        placeholder: "http://localhost:11434",
        type: "text",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "llama3:8b",
        type: "select-or-text",
        dynamic: true,
      },
    ],
    hint: "Run locally free. Start with: <code>OLLAMA_ORIGINS=* ollama serve</code>",
    docsUrl: "https://ollama.com",
  },
  openai: {
    label: "OpenAI",
    icon: "⚡",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-3.5-turbo"],
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-…",
        type: "password",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "",
        type: "select",
        options: ["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-3.5-turbo"],
      },
    ],
    hint: 'Get your key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>',
  },
  anthropic: {
    label: "Claude (Anthropic)",
    icon: "🔷",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-ant-…",
        type: "password",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "",
        type: "select",
        options: [
          "claude-3-5-sonnet-20241022",
          "claude-3-5-haiku-20241022",
          "claude-3-opus-20240229",
        ],
      },
    ],
    hint: 'Get your key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>',
  },
  gemini: {
    label: "Gemini (Google)",
    icon: "✦",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "AIza…",
        type: "password",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "",
        type: "select",
        options: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
      },
    ],
    hint: 'Get your key at <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>',
  },
  groq: {
    label: "Groq (Fast & Free)",
    icon: "🚀",
    models: [
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "gsk_…",
        type: "password",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "",
        type: "select",
        options: [
          "llama-3.1-70b-versatile",
          "llama-3.1-8b-instant",
          "mixtral-8x7b-32768",
          "gemma2-9b-it",
        ],
      },
    ],
    hint: 'Free tier available. Get key at <a href="https://console.groq.com" target="_blank">console.groq.com</a>',
  },
};

// ── Storage ───────────────────────────────────
function loadSettings() {
  return new Promise((r) => chrome.storage.sync.get(DEFAULT_SETTINGS, r));
}
function saveSettings(data) {
  return new Promise((r) => chrome.storage.sync.set(data, r));
}
function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}
function loadLocal(defaults) {
  return new Promise((r) => chrome.storage.local.get(defaults, r));
}
function saveLocal(data) {
  return new Promise((r) => chrome.storage.local.set(data, r));
}

// ── DOM refs ──────────────────────────────────
const themeToggleBtn = document.getElementById("themeToggleBtn");
const tierBadge = document.getElementById("tier-badge");
const ollamaStatus = document.getElementById("ollama-status");
const statusText = document.getElementById("status-text");
const providerHeader = document.getElementById("provider-header");
const providerBody = document.getElementById("provider-body");
const providerChevron = document.getElementById("provider-chevron");
const providerLabel = document.getElementById("provider-label");
const providerFields = document.getElementById("provider-fields");
const providerStatus = document.getElementById("provider-status");
const saveProviderBtn = document.getElementById("save-provider-btn");
const providerTabs = document.querySelectorAll(".provider-tab");
const licenseSection = document.getElementById("license-section");
const licenseHeader = document.getElementById("license-header");
const licenseBody = document.getElementById("license-body");
const licenseChevron = document.getElementById("license-chevron");
const licenseStatusLabel = document.getElementById("license-status-label");
const freeState = document.getElementById("free-state");
const proState = document.getElementById("pro-state");
const licenseKeyInput = document.getElementById("license-key-input");
const licenseActivateBtn = document.getElementById("license-activate-btn");
const licenseDeactivateBtn = document.getElementById("license-deactivate-btn");
const licenseError = document.getElementById("license-error");
const proKeyPreview = document.getElementById("pro-key-preview");
const toneSelect = document.getElementById("tone-select");
const toneLock = document.getElementById("tone-lock");
const charLimit = document.getElementById("char-limit");
const charDisplay = document.getElementById("char-display");
const charSliderRow = document.getElementById("char-slider-row");
const charFixedRow = document.getElementById("char-fixed-row");
const charLock = document.getElementById("char-lock");
const personaInput = document.getElementById("persona");
const personaLock = document.getElementById("persona-lock");
const timeoutSlider = document.getElementById("timeout-slider");
const timeoutDisplay = document.getElementById("timeout-display");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const saveConfirm = document.getElementById("save-confirm");

let isPro = false;
let activeProvider = "ollama";
let savedSnapshot = null;
let ollamaModels = [];

// ── Init ──────────────────────────────────────

async function init() {
  await Promise.all([loadTheme(), initLicense(), initProvider()]);
  await populateForm();
  savedSnapshot = getFormState();
  watchForChanges();
}

// ── Theme ─────────────────────────────────────

themeToggleBtn.addEventListener("click", toggleTheme);

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
  themeToggleBtn.innerHTML =
    theme === "dark"
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>`;
}

function toggleTheme() {
  chrome.storage.local.get(["theme"], (r) => {
    const next = r.theme === "dark" ? "light" : "dark";
    chrome.storage.local.set({ theme: next }, () => applyTheme(next));
  });
}

// ── Provider Section ──────────────────────────

providerHeader.addEventListener("click", () =>
  toggleSection(providerBody, providerChevron),
);

async function initProvider() {
  const settings = await loadSettings();
  activeProvider = settings.provider ?? "ollama";

  // Fetch Ollama models in background
  if (activeProvider === "ollama") {
    chrome.runtime.sendMessage({ type: "LIST_MODELS" }, (r) => {
      ollamaModels = r?.models ?? [];
      renderProviderFields(activeProvider, settings);
      updateOllamaStatus(ollamaModels);
    });
  }

  setActiveTab(activeProvider);
  renderProviderFields(activeProvider, settings);
  providerLabel.textContent =
    PROVIDER_CONFIG[activeProvider]?.label ?? activeProvider;

  // Init timeout slider from saved settings
  timeoutSlider.value = settings.timeoutSecs ?? 60;
  timeoutDisplay.textContent = timeoutSlider.value + "s";
  timeoutSlider.addEventListener("input", () => {
    timeoutDisplay.textContent = timeoutSlider.value + "s";
  });
}

providerTabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    const p = tab.dataset.provider;
    activeProvider = p;
    setActiveTab(p);
    const settings = await loadSettings();

    // Fetch Ollama models when switching to Ollama
    if (p === "ollama" && ollamaModels.length === 0) {
      chrome.runtime.sendMessage({ type: "LIST_MODELS" }, (r) => {
        ollamaModels = r?.models ?? [];
        renderProviderFields(p, settings);
        updateOllamaStatus(ollamaModels);
      });
    } else {
      renderProviderFields(p, settings);
    }

    timeoutSlider.value = settings.timeoutSecs ?? 60;
    timeoutDisplay.textContent = timeoutSlider.value + "s";
    providerStatus.textContent = "";
    updateOllamaStatus(ollamaModels);
  });
});

function setActiveTab(provider) {
  providerTabs.forEach((t) =>
    t.classList.toggle("active", t.dataset.provider === provider),
  );
}

function updateOllamaStatus(models) {
  // Status pill lives inside the provider section, only show when ollama tab is active
  ollamaStatus.style.display = activeProvider === "ollama" ? "flex" : "none";
  if (activeProvider !== "ollama") return;
  if (models.length > 0) {
    ollamaStatus.className = "connected";
    statusText.textContent = `Connected · ${models.length} model${models.length !== 1 ? "s" : ""} available`;
  } else {
    ollamaStatus.className = "error";
    statusText.textContent = "Ollama not reachable — is it running?";
  }
}

function renderProviderFields(provider, settings) {
  const config = PROVIDER_CONFIG[provider];
  if (!config) return;

  let html = "";

  config.fields.forEach((field) => {
    html += `<div class="field-row"><div class="field-label">${field.label}</div>`;

    if (field.type === "select") {
      html += `<select class="field-input" data-key="${field.key}">`;
      field.options.forEach((opt) => {
        const selected =
          settings[field.key] === opt ||
          (!settings[field.key] && field.options[0] === opt);
        html += `<option value="${opt}" ${selected ? "selected" : ""}>${opt}</option>`;
      });
      html += `</select>`;
    } else if (field.type === "select-or-text" && field.dynamic) {
      // Ollama: dropdown if models loaded, else text input
      const models = ollamaModels.length > 0 ? ollamaModels : null;
      if (models) {
        html += `<select class="field-input" data-key="${field.key}">`;
        models.forEach((m) => {
          html += `<option value="${m}" ${settings.model === m ? "selected" : ""}>${m}</option>`;
        });
        html += `</select>`;
      } else {
        html += `<input class="field-input" data-key="${field.key}" type="text" placeholder="${field.placeholder}" value="${settings[field.key] ?? ""}" />`;
      }
    } else if (field.type === "password") {
      html += `<input class="field-input key-input" data-key="${field.key}" type="password" placeholder="${field.placeholder}" value="${settings[field.key] ?? ""}" autocomplete="off" />`;
    } else {
      html += `<input class="field-input" data-key="${field.key}" type="text" placeholder="${field.placeholder}" value="${settings[field.key] ?? ""}" />`;
    }

    html += `</div>`;
  });

  if (config.hint) {
    html += `<p class="provider-hint">${config.hint}</p>`;
  }

  providerFields.innerHTML = html;
}

saveProviderBtn.addEventListener("click", async () => {
  const inputs = providerFields.querySelectorAll("[data-key]");
  const updates = { provider: activeProvider };
  inputs.forEach((el) => {
    updates[el.dataset.key] = el.value.trim();
  });

  updates.timeoutSecs = Number(timeoutSlider.value);
  await saveSettings(updates);
  providerLabel.textContent =
    PROVIDER_CONFIG[activeProvider]?.label ?? activeProvider;
  providerStatus.textContent = "Saved ✓";
  providerStatus.className = "provider-status ok";
  setTimeout(() => {
    providerStatus.textContent = "";
    providerStatus.className = "provider-status";
  }, 2000);

  // Update snapshot after provider save
  savedSnapshot = getFormState();
  updateSaveBtn();
});

// ── License ───────────────────────────────────

licenseHeader.addEventListener("click", () =>
  toggleSection(licenseBody, licenseChevron),
);

async function initLicense() {
  const { licenseCache } = await loadLocal({ licenseCache: null });
  if (!licenseCache?.key) {
    applyTier(false);
    return;
  }

  const daysSince =
    (Date.now() - (licenseCache.lastValidated ?? 0)) / 86_400_000;
  if (daysSince < CACHE_DAYS) {
    applyTier(licenseCache.plan === "pro", licenseCache.key);
  } else {
    const result = await validateWithServer(licenseCache.key);
    applyTier(result.valid, licenseCache.key);
    if (result.valid) {
      await saveLocal({
        licenseCache: { ...licenseCache, lastValidated: Date.now() },
      });
    }
  }
}

function applyTier(pro, key = "") {
  isPro = pro;

  // Badge
  tierBadge.textContent = pro ? "Pro" : "Free";
  tierBadge.className = "tier-badge " + (pro ? "pro" : "free");

  // License section
  licenseSection.classList.toggle("pro-active", pro);
  licenseStatusLabel.textContent = pro ? "Active" : "Click to activate Pro";
  licenseStatusLabel.style.color = pro ? "var(--success)" : "";
  freeState.style.display = pro ? "none" : "block";
  proState.style.display = pro ? "block" : "none";
  if (pro && key) proKeyPreview.textContent = maskKey(key);

  // Tone
  toneSelect.disabled = !pro;
  toneLock.style.display = pro ? "none" : "inline";

  // Char limit
  charSliderRow.style.display = pro ? "flex" : "none";
  charFixedRow.style.display = pro ? "none" : "flex";
  charLock.style.display = pro ? "none" : "inline";
  if (!pro) {
    toneSelect.value = "professional";
  }

  // Persona
  personaInput.disabled = !pro;
  personaLock.style.display = pro ? "none" : "inline";
}

function maskKey(key) {
  return key
    .split("-")
    .map((p, i) => (i === 0 ? p : "••••••"))
    .join("-");
}

licenseActivateBtn.addEventListener("click", activateLicense);
licenseKeyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") activateLicense();
  licenseKeyInput.classList.remove("error");
  licenseError.textContent = "";
});

async function activateLicense() {
  const key = licenseKeyInput.value.trim();
  if (!key) {
    showLicenseError("Please enter your license key.");
    return;
  }

  licenseActivateBtn.disabled = true;
  licenseActivateBtn.textContent = "Activating…";
  licenseError.textContent = "";

  const result = await validateWithServer(key);

  licenseActivateBtn.disabled = false;
  licenseActivateBtn.textContent = "Activate";

  if (!result.valid) {
    licenseKeyInput.classList.add("error");
    showLicenseError(result.error ?? "Invalid license key.");
    return;
  }

  const stored = await loadLocal({ deviceId: "" });
  const deviceId = stored.deviceId || crypto.randomUUID();
  await saveLocal({
    deviceId,
    licenseCache: {
      key,
      plan: result.plan ?? "pro",
      lastValidated: Date.now(),
      deviceId,
    },
  });

  applyTier(true, key);
  toggleSection(licenseBody, licenseChevron, false);
  showConfirm("Pro activated! All features unlocked ✓");
}

licenseDeactivateBtn.addEventListener("click", async () => {
  const { licenseCache } = await loadLocal({ licenseCache: null });
  if (licenseCache?.key && licenseCache?.deviceId) {
    fetch(`${LICENSE_API}/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: licenseCache.key,
        deviceId: licenseCache.deviceId,
      }),
    }).catch(() => {});
  }
  await saveLocal({ licenseCache: null });
  applyTier(false);
  licenseKeyInput.value = "";
  showConfirm("Device deactivated.");
});

async function validateWithServer(key) {
  // Load existing deviceId — generate and persist one if not yet created
  const stored = await loadLocal({ deviceId: "" });
  const deviceId = stored.deviceId || crypto.randomUUID();
  if (!stored.deviceId) await saveLocal({ deviceId });

  try {
    const res = await fetch(`${LICENSE_API}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, deviceId }),
    });
    return await res.json();
  } catch {
    return {
      valid: false,
      error: "Cannot reach license server. Check your connection.",
    };
  }
}

function showLicenseError(msg) {
  licenseError.textContent = msg;
}

// ── Form ──────────────────────────────────────

async function populateForm() {
  const s = await loadSettings();
  toneSelect.value = s.tone ?? DEFAULT_SETTINGS.tone;
  charLimit.value = s.charLimit ?? DEFAULT_SETTINGS.charLimit;
  charDisplay.textContent = charLimit.value;
  personaInput.value = s.persona ?? "";
}

function getFormState() {
  return {
    tone: toneSelect.value,
    charLimit: Number(charLimit.value),
    persona: personaInput.value.trim(),
  };
}

function hasChanges() {
  if (!savedSnapshot) return false;
  const c = getFormState();
  return (
    c.tone !== savedSnapshot.tone ||
    c.charLimit !== savedSnapshot.charLimit ||
    c.persona !== savedSnapshot.persona
  );
}

function updateSaveBtn() {
  saveBtn.disabled = !hasChanges();
}

function watchForChanges() {
  toneSelect.addEventListener("change", updateSaveBtn);
  charLimit.addEventListener("input", () => {
    charDisplay.textContent = charLimit.value;
    updateSaveBtn();
  });
  personaInput.addEventListener("input", updateSaveBtn);
}

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
  savedSnapshot = getFormState();
  saveBtn.disabled = true;
  showConfirm("Reset to defaults ✓");
});

// ── Helpers ───────────────────────────────────

function toggleSection(body, chevron, forceOpen) {
  const open =
    forceOpen !== undefined ? forceOpen : !body.classList.contains("open");
  body.classList.toggle("open", open);
  chevron.classList.toggle("open", open);
}

function setStatus(type, message) {
  // Kept for compatibility — delegates to updateOllamaStatus shape
  ollamaStatus.className = type;
  statusText.textContent = message;
}

let confirmTimer;
function showConfirm(message) {
  saveConfirm.textContent = message;
  clearTimeout(confirmTimer);
  confirmTimer = setTimeout(() => (saveConfirm.textContent = ""), 2500);
}

init();
