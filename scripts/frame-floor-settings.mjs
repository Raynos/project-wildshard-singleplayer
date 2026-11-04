import { saveFixtureCode } from './debug-settings.mjs';

/** Browser init: remove every persisted Debug override, without touching play saves.
 * Missing choices then take their registered defaults, including shard-local rows.
 * Storage errors refuse the measurement instead of silently reusing an old pick. */
export function resetFrameFloorDebug() {
  for (const scope of ['global', 'device', 'session']) {
    const storage = scope === 'session' ? sessionStorage : localStorage;
    const name = `wildshard.save.v2.${scope}`;
    /** @type {{keys?: Record<string, unknown>}} */
    const document = JSON.parse(storage.getItem(name) ?? '{"keys":{}}');
    const keys = document.keys ?? {};
    for (const key of Object.keys(keys)) if (key.startsWith('debug.') || scope === 'global' && key === 'settings') delete keys[key];
    storage.setItem(name, JSON.stringify({ ...document, keys }));
  }
}

/** Exactly one run's picks; never merge Safari's preceding A/B configuration.
 * @param {Record<string, string>} settings */
export function frameFloorSettingsCode(settings) {
  return `(${resetFrameFloorDebug.toString()})();${saveFixtureCode({ scope: 'global', key: 'settings', data: settings })}`;
}

/** Read back the preparation document before any game import. Fixture writes
 * may be unavailable in Safari's JSON viewer; accepting their evaluation result
 * does not prove that the game origin received its settings.
 * @param {Record<string, string>} settings
 * @param {boolean} developer
 * @param {Record<string, string>} deviceSaves */
export function assertFrameFloorFixture(settings, developer, deviceSaves) {
  const global = JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}');
  const device = JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}');
  if (Object.entries(settings).some(([key, value]) => global.keys?.settings?.data?.[key] !== value)
    || device.keys?.devMode?.data !== developer
    || Object.entries(deviceSaves).some(([key, value]) => device.keys?.[key]?.data !== value)) {
    throw new Error('Frame-floor preparation did not retain its settings/device fixtures');
  }
}

/** A real same-origin HTML document owns Safari's cold fixture writes, rather
 * than the JSON viewer. It loads no game module or measurement window.
 * @param {string} fixture
 * @param {string} check */
export function frameFloorBootstrapHtml(fixture, check) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Frame-floor preparation</title><script>${fixture};${check};window.__frameFloorBootstrapReady=true;</script></head><body>Frame-floor preparation</body></html>`;
}
