// Save fixtures for the v2 trust boundary. Safe to serialize into a browser init script or an external evaluator.
/** Parse explicit device-row picks without treating them as global Settings. @param {readonly string[]} values */
export function deviceSavePicks(values) {
  /** @type {Record<string, string>} */
  const picks = {};
  for (const value of values) {
    const match = /^([a-zA-Z][a-zA-Z0-9._-]*)=(.+)$/u.exec(value);
    if (match === null) throw new Error('Invalid device save; expected key=value');
    const key = match[1], data = match[2];
    if (Object.hasOwn(picks, key)) throw new Error('Duplicate device save');
    Object.defineProperty(picks, key, { value: data, enumerable: true, configurable: true, writable: true });
  }
  return picks;
}
/** @param {{scope: string, key: string, data: unknown, merge?: boolean, once?: string}} fixture */
export function writeSaveFixture(fixture) {
  try {
    if (fixture.once && sessionStorage.getItem(fixture.once)) return;
    const storage = fixture.scope === 'session' ? sessionStorage : localStorage;
    const name = `wildshard.save.v2.${fixture.scope}`;
    const doc = JSON.parse(storage.getItem(name) ?? '{"keys":{}}');
    const previous = doc.keys?.[fixture.key]?.data;
    doc.keys ??= {};
    doc.keys[fixture.key] = { v: 1, data: fixture.merge ? { ...(typeof previous === 'object' && previous !== null ? previous : {}), ...(typeof fixture.data === 'object' && fixture.data !== null ? fixture.data : {}) } : fixture.data };
    storage.setItem(name, JSON.stringify(doc));
    // Fixtures must survive the first v2 boot's one-time legacy reset.
    if (!localStorage.getItem('wildshard.save.v2.global')) localStorage.setItem('wildshard.save.v2.global', '{"keys":{}}');
    if (fixture.once) sessionStorage.setItem(fixture.once, '1');
  } catch { /* opaque origin / blocked storage: use the game's defaults */ }
}
/** @param {{addInitScript: Function}} target @param {{scope: string, key: string, data: unknown, merge?: boolean, once?: string}} fixture */
export async function saveFixture(target, fixture) { await target.addInitScript(writeSaveFixture, fixture); }
/** @param {{addInitScript: Function}} target @param {Record<string, string | boolean | number>} picks */
export async function debugSettings(target, picks) { await saveFixture(target, { scope: 'global', key: 'settings', data: picks, merge: true }); }
/** Explicit diagnostic capture settings: enable the device Developer gate before the global picks are read.
 * @param {{addInitScript: Function}} target @param {Record<string, string | boolean | number>} picks */
export async function developerSettings(target, picks) {
  await saveFixture(target, { scope: 'device', key: 'devMode', data: true });
  await debugSettings(target, picks);
}
/** Capture-only presentation: keep Developer settings effective while excluding diagnostic overlays from pixels.
 * Late-mounted overlays inherit the same rule; gameplay HUD, loading and error screens remain untouched. */
export function hideDeveloperOverlays() {
  const mount = () => {
    const style = document.createElement('style');
    style.id = 'parity-developer-overlays';
    style.textContent = '.ws-perf,.ws-perf-panel,.ws-game-developer,.ws-game-dev-alert,.ws-grid-budget,.ws-memory-warning,.ws-game-boundary{visibility:hidden!important}';
    document.head.append(style);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}
/** @param {{scope: string, key: string, data: unknown, merge?: boolean, once?: string}} fixture */
export function saveFixtureCode(fixture) { return `(${writeSaveFixture.toString()})(${JSON.stringify(fixture)})`; }
/** Browser-side raw JSON codec for script evaluators which cannot accept addInitScript callbacks. @param {string} scope */
export function fixtureStorage(scope) {
  const storage = scope === 'session' ? sessionStorage : localStorage;
  const name = `wildshard.save.v2.${scope}`;
  const read = () => JSON.parse(storage.getItem(name) ?? '{"keys":{}}');
  return {
    getItem: (/** @type {string} */ key) => { const data = read().keys?.[key]?.data; return data === undefined ? null : typeof data === 'string' ? data : JSON.stringify(data); },
    setItem: (/** @type {string} */ key, /** @type {string} */ raw) => { const doc = read(); doc.keys ??= {}; let data; try { data = JSON.parse(raw); } catch { data = raw; } doc.keys[key] = { v: 1, data }; storage.setItem(name, JSON.stringify(doc)); if (!localStorage.getItem('wildshard.save.v2.global')) localStorage.setItem('wildshard.save.v2.global', '{"keys":{}}'); },
    removeItem: (/** @type {string} */ key) => { const doc = read(); delete doc.keys?.[key]; storage.setItem(name, JSON.stringify(doc)); },
  };
}
/** @param {string} scope */
export function fixtureStorageCode(scope) { return `(${fixtureStorage.toString()})(${JSON.stringify(scope)})`; }
