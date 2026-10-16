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
