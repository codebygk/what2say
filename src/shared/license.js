// ─────────────────────────────────────────────
//  License Client — add this to your extension
//  Place at: src/shared/license.js
//
//  Used by both service-worker.js and popup.js
// ─────────────────────────────────────────────

const LICENSE_API     = "https://ai-commenter-license.YOUR_SUBDOMAIN.workers.dev";
const CACHE_DAYS      = 7;    // days before re-validating with server
const MS_PER_DAY      = 86_400_000;

// ── Public API ────────────────────────────────

/**
 * Activate a license key on this device.
 * Calls the server, stores result locally.
 *
 * @param {string} key
 * @returns {Promise<{ ok: boolean, error?: string, plan?: string }>}
 */
export async function activateLicense(key) {
  const deviceId = await getOrCreateDeviceId();

  let data;
  try {
    const res = await fetch(`${LICENSE_API}/validate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: key.trim().toUpperCase(), deviceId }),
    });
    data = await res.json();
  } catch {
    return { ok: false, error: "Cannot reach license server. Check your connection." };
  }

  if (!data.valid) {
    return { ok: false, error: data.error ?? "Invalid license key." };
  }

  // Cache the result locally
  await saveLicenseCache({
    key,
    plan:          data.plan,
    lastValidated: Date.now(),
    deviceId,
  });

  return { ok: true, plan: data.plan };
}

/**
 * Check if the current device has a valid Pro license.
 * Uses cache for CACHE_DAYS days before re-validating.
 *
 * @returns {Promise<boolean>}
 */
export async function checkLicense() {
  const cache = await loadLicenseCache();
  if (!cache?.key) return false;

  const daysSince = (Date.now() - (cache.lastValidated ?? 0)) / MS_PER_DAY;

  // Within cache window — trust local result
  if (daysSince < CACHE_DAYS) {
    return cache.plan === "pro";
  }

  // Cache expired — re-validate with server
  const result = await activateLicense(cache.key);
  return result.ok && result.plan === "pro";
}

/**
 * Deactivate this device, freeing up a seat.
 * @returns {Promise<{ ok: boolean }>}
 */
export async function deactivateLicense() {
  const cache = await loadLicenseCache();
  if (!cache?.key) return { ok: false };

  try {
    await fetch(`${LICENSE_API}/deactivate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: cache.key, deviceId: cache.deviceId }),
    });
  } catch {
    // Best effort — clear locally regardless
  }

  await clearLicenseCache();
  return { ok: true };
}

// ── Storage helpers ───────────────────────────

function loadLicenseCache() {
  return new Promise((resolve) =>
    chrome.storage.local.get({ licenseCache: null }, ({ licenseCache }) =>
      resolve(licenseCache)
    )
  );
}

function saveLicenseCache(data) {
  return new Promise((resolve) =>
    chrome.storage.local.set({ licenseCache: data }, resolve)
  );
}

function clearLicenseCache() {
  return new Promise((resolve) =>
    chrome.storage.local.remove("licenseCache", resolve)
  );
}

// ── Device ID ─────────────────────────────────

/**
 * Get or create a stable unique ID for this browser install.
 * Used to track which devices a key is active on.
 */
export async function getOrCreateDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ deviceId: "" }, async ({ deviceId }) => {
      if (deviceId) { resolve(deviceId); return; }
      const newId = crypto.randomUUID();
      chrome.storage.local.set({ deviceId: newId }, () => resolve(newId));
    });
  });
}
