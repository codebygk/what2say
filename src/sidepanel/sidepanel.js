// ─────────────────────────────────────────────
//  Way2Say — Side Panel (Generate + Settings)
// ─────────────────────────────────────────────

const LICENSE_API = "https://way2say-license.gopalakrishnan-work-203.workers.dev";
const CACHE_DAYS  = 7;

const DEFAULT_SETTINGS = {
  provider:     "ollama",
  model:        "llama3:8b",
  apiKey:       "",
  baseUrl:      "http://localhost:11434",
  tone:         "professional",
  persona:      "",
  minCharLimit: 200,
  maxCharLimit: 1000,
  timeoutSecs:  60,
};

const PROVIDER_CONFIG = {
  ollama: {
    label: "Ollama (Local)",
    fields: [
      { key: "baseUrl", label: "Ollama URL", placeholder: "http://localhost:11434", type: "text" },
      { key: "model",   label: "Model",      placeholder: "llama3:8b",              type: "select-or-text", dynamic: true },
    ],
    hint: 'Free &amp; local. Start: <code>OLLAMA_ORIGINS=* ollama serve</code>',
  },
  openai: {
    label: "OpenAI",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-…", type: "password" },
      { key: "model",  label: "Model",   placeholder: "",      type: "select", options: ["gpt-4o","gpt-4o-mini","gpt-4","gpt-3.5-turbo"] },
    ],
    hint: 'Get key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>',
  },
  anthropic: {
    label: "Claude (Anthropic)",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-ant-…", type: "password" },
      { key: "model",  label: "Model",   placeholder: "",           type: "select", options: ["claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022","claude-3-opus-20240229"] },
    ],
    hint: 'Get key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>',
  },
  gemini: {
    label: "Gemini (Google)",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "AIza…", type: "password" },
      { key: "model",  label: "Model",   placeholder: "",        type: "select", options: ["gemini-2.0-flash-exp","gemini-1.5-pro","gemini-1.5-flash"] },
    ],
    hint: 'Get key at <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>',
  },
  groq: {
    label: "Groq (Fast & Free)",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "gsk_…", type: "password" },
      { key: "model",  label: "Model",   placeholder: "",        type: "select", options: ["llama-3.1-70b-versatile","llama-3.1-8b-instant","mixtral-8x7b-32768","gemma2-9b-it"] },
    ],
    hint: 'Free tier available. <a href="https://console.groq.com" target="_blank">console.groq.com</a>',
  },
};

// ── Storage ───────────────────────────────────
const loadSettings = ()    => new Promise(r => chrome.storage.sync.get(DEFAULT_SETTINGS, r));
const saveSettings = data  => new Promise(r => chrome.storage.sync.set(data, r));
const resetSettings = ()   => saveSettings(DEFAULT_SETTINGS);
const loadLocal = defaults => new Promise(r => chrome.storage.local.get(defaults, r));
const saveLocal = data     => new Promise(r => chrome.storage.local.set(data, r));

// ── DOM — Generate tab ────────────────────────
const stateIdle          = document.getElementById("stateIdle");
const stateGenerating    = document.getElementById("stateGenerating");
const stateError         = document.getElementById("stateError");
const stateResult        = document.getElementById("stateResult");
const actionBar          = document.getElementById("actionBar");
const resultTextarea     = document.getElementById("resultTextarea");
const charCountEl        = document.getElementById("charCount");
const copyBtn            = document.getElementById("copyBtn");
const regenerateBtn      = document.getElementById("regenerateBtn");
const retryBtn           = document.getElementById("retryBtn");
const errorMessage       = document.getElementById("errorMessage");
const postPreview        = document.getElementById("postPreview");
const postPreviewText    = document.getElementById("postPreviewText");
const generatingProvider = document.getElementById("generatingProvider");
const quickControls      = document.getElementById("quickControls");
const proSellStrip       = document.getElementById("proSellStrip");
const qcTonePills        = document.getElementById("qcTonePills");
const qcLengthPills      = document.getElementById("qcLengthPills");
const qcCustomRow        = document.getElementById("qcCustomRow");
const qcMinInput         = document.getElementById("qcMinInput");
const qcMaxInput         = document.getElementById("qcMaxInput");

// ── DOM — Settings tab ────────────────────────
const tierBadge            = document.getElementById("tier-badge");
const themeBtn             = document.getElementById("themeBtn");
const providerHeader       = document.getElementById("provider-header");
const providerBody         = document.getElementById("provider-body");
const providerChevron      = document.getElementById("provider-chevron");
const providerLabelEl      = document.getElementById("provider-label");
const providerFields       = document.getElementById("provider-fields");
const providerStatus       = document.getElementById("provider-status");
const saveProviderBtn      = document.getElementById("save-provider-btn");
const providerTabs         = document.querySelectorAll(".provider-tab");
const ollamaStatus         = document.getElementById("ollama-status");
const statusText           = document.getElementById("status-text");
const timeoutSlider        = document.getElementById("timeout-slider");
const timeoutDisplay       = document.getElementById("timeout-display");
const licenseSection       = document.getElementById("license-section");
const licenseHeader        = document.getElementById("license-header");
const licenseBody          = document.getElementById("license-body");
const licenseChevron       = document.getElementById("license-chevron");
const licenseStatusLabel   = document.getElementById("license-status-label");
const freeState            = document.getElementById("free-state");
const proState             = document.getElementById("pro-state");
const licenseKeyInput      = document.getElementById("license-key-input");
const licenseActivateBtn   = document.getElementById("license-activate-btn");
const licenseDeactivateBtn = document.getElementById("license-deactivate-btn");
const licenseError         = document.getElementById("license-error");
const proKeyPreview        = document.getElementById("pro-key-preview");
const toneSelect           = document.getElementById("tone-select");
const toneLock             = document.getElementById("tone-lock");
const minCharInput         = document.getElementById("min-char-limit");
const maxCharInput         = document.getElementById("max-char-limit");
const minCharBox           = document.getElementById("min-char-box");
const maxCharBox           = document.getElementById("max-char-box");
const charValidation       = document.getElementById("char-validation");
const charSlidersWrap      = document.getElementById("char-sliders-wrap");
const charFixedRow         = document.getElementById("char-fixed-row");
const charLock             = document.getElementById("char-lock");
const personaInput         = document.getElementById("persona");
const saveBtn              = document.getElementById("save-btn");
const resetBtn             = document.getElementById("reset-btn");
const saveConfirm          = document.getElementById("save-confirm");

let isPro          = false;
let activeProvider = "ollama";
let ollamaModels   = [];
let savedSnapshot  = null;
let lastPostText   = "";
let savedProviderSnapshot = null;

// ── Boot ──────────────────────────────────────
async function init() {
  await Promise.all([loadTheme(), initLicense(), initProvider()]);
  await populateForm();
  savedSnapshot = getFormState();
  watchForChanges();
  initQuickControls();
  showGenerateState("idle");

  // Check if there's a pending generate from context menu (panel just opened)
  chrome.storage.session.get(["pendingGenerate"], ({ pendingGenerate }) => {
    if (pendingGenerate) {
      chrome.storage.session.remove("pendingGenerate");
      startGenerate(pendingGenerate);
    }
  });
}

// Listen for pending generate when panel is already open
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.pendingGenerate?.newValue) {
    const text = changes.pendingGenerate.newValue;
    chrome.storage.session.remove("pendingGenerate");
    startGenerate(text);
  }
});

// ════════════════════════════════════════════
//  TAB SWITCHING
// ════════════════════════════════════════════
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ════════════════════════════════════════════
//  GENERATE
// ════════════════════════════════════════════

async function startGenerate(text) {
  lastPostText = text;

  if (text) {
    postPreviewText.textContent = text;
    postPreview.style.display = "block";
  }

  document.querySelector('[data-tab="generate"]').click();
  showGenerateState("generating");

  const settings = await loadSettings();
  generatingProvider.textContent = `${settings.provider} · ${settings.model}`;

  // Resolve tone — "default" means use settings value (pass null = service worker uses settings)
  const activeTonePill = qcTonePills.querySelector(".qc-pill.active");
  const toneOverride   = (activeTonePill?.dataset.tone !== "default")
    ? activeTonePill?.dataset.tone ?? null
    : null;

  // Resolve length — "default" = null (service worker uses settings), "custom" = inputs
  const activeLenPill = qcLengthPills.querySelector(".qc-pill.active");
  const lenPreset     = activeLenPill?.dataset.preset ?? "default";
  let minOverride = null, maxOverride = null;
  if (lenPreset !== "default") {
    if (lenPreset === "custom") {
      const qMin = Number(qcMinInput.value);
      const qMax = Number(qcMaxInput.value);
      if (qMin > 0 && qMax > 0 && qMin < qMax) {
        minOverride = qMin;
        maxOverride = qMax;
      }
    } else {
      minOverride = Number(activeLenPill.dataset.min);
      maxOverride = Number(activeLenPill.dataset.max);
    }
  }

  console.log(`[Way2Say] Quick overrides — tone: ${toneOverride}, min: ${minOverride}, max: ${maxOverride}`);

  chrome.runtime.sendMessage({
    type:      "GENERATE_IN_BG",
    text,
    quickTone: toneOverride,
    quickMin:  minOverride,
    quickMax:  maxOverride,
  }, async (result) => {
    if (chrome.runtime.lastError) {
      errorMessage.textContent = chrome.runtime.lastError.message;
      showGenerateState("error");
      return;
    }
    if (result?.ok) {
      resultTextarea.value = result.comment;
      updateCharCount();
      showGenerateState("result");
      resultTextarea.focus();
      // Auto-copy and update button text
      copyBtn.textContent = "✓ Copied";
      copyBtn.className   = "btn success";
      await autoCopy(result.comment);
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy";
        copyBtn.className   = "btn primary";
      }, 2500);
    } else {
      errorMessage.textContent = result?.error ?? "Unknown error occurred.";
      showGenerateState("error");
    }
  });
}

async function autoCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback — select + execCommand
    resultTextarea.select();
    document.execCommand("copy");
  }
}

function showGenerateState(state) {
  stateIdle.style.display       = state === "idle"       ? "flex"  : "none";
  stateGenerating.style.display = state === "generating" ? "flex"  : "none";
  stateError.style.display      = state === "error"      ? "flex"  : "none";
  stateResult.style.display     = state === "result"     ? "flex"  : "none";
  actionBar.style.display       = state === "result"     ? "flex"  : "none";
}

resultTextarea.addEventListener("input", updateCharCount);
function updateCharCount() {
  const len = resultTextarea.value.length;
  charCountEl.textContent = `${len} char${len !== 1 ? "s" : ""}`;
  charCountEl.className   = len > 3000 ? "char-count over" : "char-count";
}

copyBtn.addEventListener("click", async () => {
  const text = resultTextarea.value.trim();
  if (!text) return;
  copyBtn.textContent = "✓ Copied!";
  copyBtn.className   = "btn success";
  await autoCopy(text);
  setTimeout(() => {
    copyBtn.textContent = "📋 Copy";
    copyBtn.className   = "btn primary";
  }, 2500);
});

function triggerRegenerate() {
  if (!lastPostText) return;
  startGenerate(lastPostText);
}
regenerateBtn.addEventListener("click", triggerRegenerate);
retryBtn.addEventListener("click", triggerRegenerate);

// ════════════════════════════════════════════
//  THEME
// ════════════════════════════════════════════
themeBtn.addEventListener("click", toggleTheme);

function loadTheme() {
  return new Promise(resolve => {
    chrome.storage.local.get(["theme"], r => { applyTheme(r.theme || "light"); resolve(); });
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  themeBtn.innerHTML = theme === "dark"
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>`;
}

function toggleTheme() {
  chrome.storage.local.get(["theme"], r => {
    const next = r.theme === "dark" ? "light" : "dark";
    chrome.storage.local.set({ theme: next }, () => applyTheme(next));
  });
}

// ════════════════════════════════════════════
//  PROVIDER SECTION
// ════════════════════════════════════════════
providerHeader.addEventListener("click", () => toggleSection(providerBody, providerChevron));

async function initProvider() {
  const settings = await loadSettings();
  activeProvider = settings.provider ?? "ollama";

  if (activeProvider === "ollama") {
    chrome.runtime.sendMessage({ type: "LIST_MODELS", baseUrl: settings.baseUrl }, r => {
      ollamaModels = r?.models ?? [];
      renderProviderFields(activeProvider, settings);
      updateOllamaStatus(ollamaModels);
      savedProviderSnapshot = getProviderFormState();
      watchProviderFields();
    });
  } else {
    renderProviderFields(activeProvider, settings);
    savedProviderSnapshot = getProviderFormState();
    watchProviderFields();
  }

  setActiveProviderTab(activeProvider);
  providerLabelEl.textContent = PROVIDER_CONFIG[activeProvider]?.label ?? activeProvider;

  timeoutSlider.value        = settings.timeoutSecs ?? 60;
  timeoutDisplay.textContent = timeoutSlider.value + "s";
  timeoutSlider.addEventListener("input", () => {
    timeoutDisplay.textContent = timeoutSlider.value + "s";
    updateSaveProviderBtn();
  });
}

providerTabs.forEach(tab => {
  tab.addEventListener("click", async () => {
    const p = tab.dataset.provider;
    activeProvider = p;
    setActiveProviderTab(p);
    const settings = await loadSettings();

    if (p === "ollama" && ollamaModels.length === 0) {
      chrome.runtime.sendMessage({ type: "LIST_MODELS", baseUrl: settings.baseUrl }, r => {
        ollamaModels = r?.models ?? [];
        renderProviderFields(p, settings);
        updateOllamaStatus(ollamaModels);
        savedProviderSnapshot = getProviderFormState();
        watchProviderFields();
      });
    } else {
      renderProviderFields(p, settings);
      savedProviderSnapshot = getProviderFormState();
      watchProviderFields();
    }

    timeoutSlider.value        = settings.timeoutSecs ?? 60;
    timeoutDisplay.textContent = timeoutSlider.value + "s";
    updateOllamaStatus(ollamaModels);
    saveProviderBtn.disabled   = true;
    providerStatus.textContent = "";
    providerStatus.className   = "provider-status";
  });
});

function setActiveProviderTab(provider) {
  providerTabs.forEach(t => t.classList.toggle("active", t.dataset.provider === provider));
}

function updateOllamaStatus(models) {
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
  config.fields.forEach(field => {
    html += `<div class="field-row"><div class="field-label">${field.label}</div>`;
    if (field.type === "select") {
      html += `<select class="field-input" data-key="${field.key}">`;
      field.options.forEach(opt => {
        html += `<option value="${opt}" ${settings[field.key] === opt ? "selected" : ""}>${opt}</option>`;
      });
      html += `</select>`;
    } else if (field.type === "select-or-text" && field.dynamic) {
      if (ollamaModels.length > 0) {
        html += `<select class="field-input" data-key="${field.key}">`;
        ollamaModels.forEach(m => {
          html += `<option value="${m}" ${settings.model === m ? "selected" : ""}>${m}</option>`;
        });
        html += `</select>`;
      } else {
        html += `<input class="field-input" data-key="${field.key}" type="text" placeholder="${field.placeholder}" value="${settings[field.key] ?? ""}" />`;
      }
    } else if (field.type === "password") {
      html += `<input class="field-input" data-key="${field.key}" type="password" placeholder="${field.placeholder}" value="${settings[field.key] ?? ""}" autocomplete="off" />`;
    } else {
      html += `<input class="field-input" data-key="${field.key}" type="text" placeholder="${field.placeholder}" value="${settings[field.key] ?? ""}" />`;
    }
    html += `</div>`;
  });
  if (config.hint) html += `<p class="provider-hint">${config.hint}</p>`;
  providerFields.innerHTML = html;
}

function getProviderFormState() {
  const inputs = providerFields.querySelectorAll("[data-key]");
  const state = { provider: activeProvider, timeoutSecs: Number(timeoutSlider.value) };
  inputs.forEach(el => { state[el.dataset.key] = el.value.trim(); });
  return JSON.stringify(state);
}

function updateSaveProviderBtn() {
  saveProviderBtn.disabled = getProviderFormState() === savedProviderSnapshot;
}

function watchProviderFields() {
  providerFields.querySelectorAll("[data-key]").forEach(el => {
    el.addEventListener("input", updateSaveProviderBtn);
    el.addEventListener("change", updateSaveProviderBtn);
  });
  timeoutSlider.addEventListener("input", updateSaveProviderBtn);
}

saveProviderBtn.addEventListener("click", async () => {
  const inputs  = providerFields.querySelectorAll("[data-key]");
  const updates = { provider: activeProvider };
  inputs.forEach(el => { updates[el.dataset.key] = el.value.trim(); });
  updates.timeoutSecs = Number(timeoutSlider.value);

  await saveSettings(updates);
  savedProviderSnapshot = getProviderFormState();
  saveProviderBtn.disabled = true;
  providerLabelEl.textContent = PROVIDER_CONFIG[activeProvider]?.label ?? activeProvider;
  providerStatus.textContent  = "Saved ✓";
  providerStatus.className    = "provider-status ok";
  setTimeout(() => {
    providerStatus.textContent = "";
    providerStatus.className   = "provider-status";
  }, 2000);
});

// ════════════════════════════════════════════
//  LICENSE
// ════════════════════════════════════════════
licenseHeader.addEventListener("click", () => toggleSection(licenseBody, licenseChevron));

async function initLicense() {
  const { licenseCache } = await loadLocal({ licenseCache: null });
  if (!licenseCache?.key) { applyTier(false); return; }

  const daysSince = (Date.now() - (licenseCache.lastValidated ?? 0)) / 86_400_000;
  if (daysSince < CACHE_DAYS) {
    applyTier(licenseCache.plan === "pro", licenseCache.key);
  } else {
    const result = await validateWithServer(licenseCache.key);
    applyTier(result.valid, licenseCache.key);
    if (result.valid) {
      await saveLocal({ licenseCache: { ...licenseCache, lastValidated: Date.now() } });
    }
  }
}

function applyTier(pro, key = "") {
  isPro = pro;
  tierBadge.textContent = pro ? "Pro" : "Free";
  tierBadge.className   = "tier-badge " + (pro ? "pro" : "free");

  licenseSection.classList.toggle("pro-active", pro);
  licenseStatusLabel.textContent = pro ? "Active" : "Click to activate Pro";
  licenseStatusLabel.style.color = pro ? "var(--success)" : "";
  freeState.style.display = pro ? "none"  : "block";
  proState.style.display  = pro ? "block" : "none";
  if (pro && key) proKeyPreview.textContent = maskKey(key);

  toneSelect.disabled    = !pro;
  toneLock.style.display = pro ? "none" : "inline";
  if (!pro) toneSelect.value = "professional";

  charSlidersWrap.style.display = pro ? "flex"  : "none";
  charFixedRow.style.display    = pro ? "none"  : "flex";
  charLock.style.display        = pro ? "none"  : "inline";
  if (!pro) {
    document.querySelectorAll(".char-badge").forEach(b => b.disabled = true);
    setCharInputsLocked(true);
  } else {
    document.querySelectorAll(".char-badge").forEach(b => b.disabled = false);
    // restore locked state based on current mode
    setCharInputsLocked(!isCustomMode);
  }

  personaInput.disabled = false;
  applyQuickControlsTier(pro);
}

function maskKey(key) {
  return key.split("-").map((p, i) => i === 0 ? p : "••••••").join("-");
}

licenseActivateBtn.addEventListener("click", activateLicense);
licenseKeyInput.addEventListener("keydown", e => {
  if (e.key === "Enter") activateLicense();
  licenseKeyInput.classList.remove("error");
  licenseError.textContent = "";
});

async function activateLicense() {
  const key = licenseKeyInput.value.trim();
  if (!key) { licenseError.textContent = "Please enter your license key."; return; }

  licenseActivateBtn.disabled    = true;
  licenseActivateBtn.textContent = "Activating…";
  licenseError.textContent       = "";

  const result = await validateWithServer(key);

  licenseActivateBtn.disabled    = false;
  licenseActivateBtn.textContent = "Activate";

  if (!result.valid) {
    licenseKeyInput.classList.add("error");
    licenseError.textContent = result.error ?? "Invalid license key.";
    return;
  }

  const stored   = await loadLocal({ deviceId: "" });
  const deviceId = stored.deviceId || crypto.randomUUID();
  await saveLocal({
    deviceId,
    licenseCache: { key, plan: result.plan ?? "pro", lastValidated: Date.now(), deviceId },
  });

  applyTier(true, key);
  toggleSection(licenseBody, licenseChevron, false);
  showSaveConfirm("Pro activated! All features unlocked ✓");
}

licenseDeactivateBtn.addEventListener("click", async () => {
  const { licenseCache } = await loadLocal({ licenseCache: null });
  if (licenseCache?.key && licenseCache?.deviceId) {
    fetch(`${LICENSE_API}/deactivate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseCache.key, deviceId: licenseCache.deviceId }),
    }).catch(() => {});
  }
  await saveLocal({ licenseCache: null });
  applyTier(false);
  licenseKeyInput.value = "";
  showSaveConfirm("Device deactivated.");
});

async function validateWithServer(key) {
  const stored   = await loadLocal({ deviceId: "" });
  const deviceId = stored.deviceId || crypto.randomUUID();
  if (!stored.deviceId) await saveLocal({ deviceId });
  try {
    const res = await fetch(`${LICENSE_API}/validate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, deviceId }),
    });
    return await res.json();
  } catch {
    return { valid: false, error: "Cannot reach license server. Check your connection." };
  }
}

// ════════════════════════════════════════════
//  QUICK CONTROLS (Generate tab)
// ════════════════════════════════════════════

function initQuickControls() {
  // Tone pills — Default always resets to settings value
  qcTonePills.querySelectorAll(".qc-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      if (pill.disabled) return;
      qcTonePills.querySelectorAll(".qc-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });

  // Length pills
  qcLengthPills.querySelectorAll(".qc-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      if (pill.disabled) return;
      qcLengthPills.querySelectorAll(".qc-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      // Show/hide custom inputs
      const isCustom = pill.dataset.preset === "custom";
      qcCustomRow.style.display = isCustom ? "flex" : "none";
    });
  });

  // Custom length inputs — clamp on change
  qcMinInput.addEventListener("input", () => {
    let v = Number(qcMinInput.value);
    if (v < 0) qcMinInput.value = 0;
    if (v > 2000) qcMinInput.value = 2000;
  });
  qcMaxInput.addEventListener("input", () => {
    let v = Number(qcMaxInput.value);
    if (v < 0) qcMaxInput.value = 0;
    if (v > 2000) qcMaxInput.value = 2000;
  });
}

// Called on load and after settings save — resets both to Default
function syncQuickControlsFromSettings() {
  // Always reset to Default on load
  qcTonePills.querySelectorAll(".qc-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.tone === "default")
  );
  qcLengthPills.querySelectorAll(".qc-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.preset === "default")
  );
  qcCustomRow.style.display = "none";
}

function applyQuickControlsTier(pro) {
  // Free: disable all non-default pills
  qcTonePills.querySelectorAll(".qc-pill").forEach(p => {
    p.disabled = !pro && p.dataset.tone !== "default";
  });
  qcLengthPills.querySelectorAll(".qc-pill").forEach(p => {
    p.disabled = !pro && p.dataset.preset !== "default";
  });
  // Lock custom inputs for free
  qcMinInput.disabled = !pro;
  qcMaxInput.disabled = !pro;
  proSellStrip.style.display = pro ? "none" : "block";
}

// ── Char limit badge + custom input logic ─────

const CHAR_PRESETS = [
  { label: "Micro",  min: 50,  max: 150 },
  { label: "Short",  min: 100, max: 300 },
  { label: "Medium", min: 200, max: 500 },
  { label: "Long",   min: 400, max: 800 },
];

let isCustomMode = false;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function setCharInputsLocked(locked) {
  const els = [minCharInput, maxCharInput,
               document.getElementById("min-up"),
               document.getElementById("min-down"),
               document.getElementById("max-up"),
               document.getElementById("max-down")];
  els.forEach(el => { el.disabled = locked; });
  minCharBox.classList.toggle("locked", locked);
  maxCharBox.classList.toggle("locked", locked);
}

function selectBadge(badgeEl) {
  document.querySelectorAll(".char-badge").forEach(b => b.classList.remove("active"));
  badgeEl.classList.add("active");

  const isCustom = badgeEl.classList.contains("custom");
  isCustomMode = isCustom;
  setCharInputsLocked(!isCustom);

  if (!isCustom) {
    minCharInput.value = badgeEl.dataset.min;
    maxCharInput.value = badgeEl.dataset.max;
    clearCharValidation();
  }
}

function findMatchingPreset(min, max) {
  return CHAR_PRESETS.find(p => p.min === min && p.max === max) ?? null;
}

function syncBadgeToValues(min, max) {
  const match = findMatchingPreset(min, max);
  document.querySelectorAll(".char-badge").forEach(b => b.classList.remove("active"));
  if (match) {
    const badge = [...document.querySelectorAll(".char-badge")]
      .find(b => Number(b.dataset.min) === match.min && Number(b.dataset.max) === match.max);
    if (badge) { badge.classList.add("active"); isCustomMode = false; setCharInputsLocked(true); }
  } else {
    document.querySelector(".char-badge.custom").classList.add("active");
    isCustomMode = true; setCharInputsLocked(false);
  }
}

function clearCharValidation() {
  charValidation.textContent = "";
  minCharBox.classList.remove("error");
  maxCharBox.classList.remove("error");
}

function validateCharInputs() {
  const min = Number(minCharInput.value);
  const max = Number(maxCharInput.value);
  if (min < 0 || max < 0) {
    charValidation.textContent = "Values cannot be negative.";
    minCharBox.classList.add("error");
    return false;
  }
  if (max > 2000) {
    charValidation.textContent = "Max cannot exceed 2000.";
    maxCharBox.classList.add("error");
    return false;
  }
  if (min >= max) {
    charValidation.textContent = `Min (${min}) must be less than Max (${max}).`;
    minCharBox.classList.add("error");
    maxCharBox.classList.add("error");
    return false;
  }
  clearCharValidation();
  return true;
}

function initCharBadges() {
  document.querySelectorAll(".char-badge").forEach(badge => {
    badge.addEventListener("click", () => {
      selectBadge(badge);
      updateSaveBtn();
    });
  });

  // Steppers
  document.getElementById("min-up").addEventListener("click", () => {
    minCharInput.value = clamp(Number(minCharInput.value) + 10, 0, 2000);
    onCustomCharChange();
  });
  document.getElementById("min-down").addEventListener("click", () => {
    minCharInput.value = clamp(Number(minCharInput.value) - 10, 0, 2000);
    onCustomCharChange();
  });
  document.getElementById("max-up").addEventListener("click", () => {
    maxCharInput.value = clamp(Number(maxCharInput.value) + 10, 0, 2000);
    onCustomCharChange();
  });
  document.getElementById("max-down").addEventListener("click", () => {
    maxCharInput.value = clamp(Number(maxCharInput.value) - 10, 0, 2000);
    onCustomCharChange();
  });

  // Direct typing
  minCharInput.addEventListener("input", () => {
    minCharInput.value = clamp(Number(minCharInput.value), 0, 2000);
    onCustomCharChange();
  });
  maxCharInput.addEventListener("input", () => {
    maxCharInput.value = clamp(Number(maxCharInput.value), 0, 2000);
    onCustomCharChange();
  });
}

function onCustomCharChange() {
  validateCharInputs();
  updateSaveBtn();
}

async function populateForm() {
  const s = await loadSettings();
  toneSelect.value = s.tone ?? DEFAULT_SETTINGS.tone;

  const minVal = s.minCharLimit ?? DEFAULT_SETTINGS.minCharLimit;
  const maxVal = s.maxCharLimit ?? DEFAULT_SETTINGS.maxCharLimit;
  minCharInput.value = minVal;
  maxCharInput.value = maxVal;
  syncBadgeToValues(minVal, maxVal);
  syncQuickControlsFromSettings();

  personaInput.value = s.persona ?? "";
}

function getFormState() {
  return {
    tone:         toneSelect.value,
    minCharLimit: clamp(Number(minCharInput.value), 0, 2000),
    maxCharLimit: clamp(Number(maxCharInput.value), 0, 2000),
    persona:      personaInput.value.trim(),
    timeoutSecs:  Number(timeoutSlider.value),
  };
}

function hasChanges() {
  if (!savedSnapshot) return false;
  const c = getFormState();
  return (
    c.tone         !== savedSnapshot.tone         ||
    c.minCharLimit !== savedSnapshot.minCharLimit ||
    c.maxCharLimit !== savedSnapshot.maxCharLimit ||
    c.persona      !== savedSnapshot.persona      ||
    c.timeoutSecs  !== savedSnapshot.timeoutSecs
  );
}

function updateSaveBtn() {
  const valid = isCustomMode ? validateCharInputs() : true;
  saveBtn.disabled = !hasChanges() || !valid;
}

function watchForChanges() {
  toneSelect.addEventListener("change", updateSaveBtn);
  personaInput.addEventListener("input", updateSaveBtn);
  timeoutSlider.addEventListener("input", updateSaveBtn);
  initCharBadges();
}

saveBtn.addEventListener("click", async () => {
  const state = getFormState();
  await saveSettings(state);
  savedSnapshot    = state;
  saveBtn.disabled = true;
  showSaveConfirm("Settings saved ✓");
  syncQuickControlsFromSettings();
});

resetBtn.addEventListener("click", async () => {
  await resetSettings();
  await populateForm();
  savedSnapshot    = getFormState();
  saveBtn.disabled = true;
  clearCharValidation();
  showSaveConfirm("Reset to defaults ✓");
});

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════
function toggleSection(body, chevron, forceOpen) {
  const open = forceOpen !== undefined ? forceOpen : !body.classList.contains("open");
  body.classList.toggle("open", open);
  chevron.classList.toggle("open", open);
}

let confirmTimer;
function showSaveConfirm(msg) {
  saveConfirm.textContent = msg;
  clearTimeout(confirmTimer);
  confirmTimer = setTimeout(() => { saveConfirm.textContent = ""; }, 2500);
}

// ── Boot ──────────────────────────────────────
init();