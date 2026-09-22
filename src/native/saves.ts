/**
 * Native saves (docs/plans/NATIVE-APPS.md N-A). The game keeps reading and writing `localStorage` exactly as it
 * does on the web (Progress, Inventory, Skins, Settings, tier, boot timing — every key starts `ws.`), but a
 * WKWebView / Android WebView may drop localStorage under storage pressure. So in the native shells every `ws.*`
 * key is mirrored into @capacitor/preferences (UserDefaults / SharedPreferences, never evicted):
 *
 *   hydrateSaves()  before the game module loads: Preferences → localStorage (Preferences is the truth), then
 *                   hook Storage.prototype.setItem / removeItem so each later write is queued to Preferences
 *   flushSaves()    resolves when every queued write has landed (the lifecycle calls it on backgrounding)
 *
 * The web build never imports this file (src/native/boot.ts is the native entry only).
 */
import { Preferences } from '@capacitor/preferences';

const PREFIX = 'ws.';

let chain: Promise<void> = Promise.resolve();
let failures = 0;

/** Writes land in order (a later value for a key never loses to an earlier one still in flight). */
function queue(write: () => Promise<void>): void {
  const previous = chain;
  chain = (async () => {
    await previous;
    try { await write(); } catch (error) { failures++; console.warn('[native] save mirror write failed', error); }
  })();
}

/** Preferences → localStorage, then mirror every later `ws.*` write back. Call once, before the game loads. */
export async function hydrateSaves(): Promise<number> {
  const { keys } = await Preferences.keys();
  const ours = keys.filter((k) => k.startsWith(PREFIX));
  const rows = await Promise.all(ours.map(async (key) => ({ key, value: (await Preferences.get({ key })).value })));
  for (const { key, value } of rows) if (value !== null) localStorage.setItem(key, value);
  // A save the WebView still holds but Preferences never saw (a first launch after installing this mirror): keep it.
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX) === true && !ours.includes(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) queue(() => Preferences.set({ key, value }));
    }
  }
  const proto = Storage.prototype;
  // the originals, re-called with the right `this` below — exactly the case unbound-method guards against by default
  // oxlint-disable-next-line typescript/unbound-method -- saved to be re-invoked via .call(this) in the wrappers
  const nativeSet = proto.setItem, nativeRemove = proto.removeItem;
  proto.setItem = function setItem(this: Storage, key: string, value: string): void {
    nativeSet.call(this, key, value);
    if (this === localStorage && key.startsWith(PREFIX)) queue(() => Preferences.set({ key, value }));
  };
  proto.removeItem = function removeItem(this: Storage, key: string): void {
    nativeRemove.call(this, key);
    if (this === localStorage && key.startsWith(PREFIX)) queue(() => Preferences.remove({ key }));
  };
  return rows.length;
}

/** Every queued mirror write has landed (or failed and been counted). */
export async function flushSaves(): Promise<void> { await chain; }

/** Mirror writes that failed this session (shown by the native diagnostics). */
export function saveFailures(): number { return failures; }
