// ─────────────────────────────────────────────
//  Storage - typed wrapper around chrome.storage.sync
//  All reads/writes go through here so the rest
//  of the code never touches the raw API.
// ─────────────────────────────────────────────
import { DEFAULT_SETTINGS } from "./constants.js";

/**
 * Load all user settings, falling back to defaults for
 * any key that hasn't been saved yet.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve(result);
    });
  });
}

/**
 * Persist a partial settings object.
 * @param {Partial<typeof DEFAULT_SETTINGS>} updates
 * @returns {Promise<void>}
 */
export async function saveSettings(updates) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(updates, resolve);
  });
}

/**
 * Reset all settings back to factory defaults.
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}
