/**
 * Native saves (docs/plans/NATIVE-APPS.md N-A). The game keeps reading and writing `localStorage` through the v2 SaveStore documents, but a
 * WKWebView / Android WebView may drop localStorage under storage pressure. So in the native shells gameplay documents and `ws.ota.*`
 * keys are mirrored into @capacitor/preferences (UserDefaults / SharedPreferences, never evicted):
 *
 *   hydrateSaves()  before the game module loads: Preferences → localStorage (Preferences is the truth), then
 *                   hook Storage.prototype.setItem / removeItem so each later write is queued to Preferences
 *   flushSaves()    resolves when every queued write has landed (the lifecycle calls it on backgrounding)
 *
 * The web build never imports this file (src/engine/native/boot.ts, run by the native entry src/native.ts, only).
 */
import { appIdentity } from '../app/identity';
import { Preferences } from '@capacitor/preferences';

import { installLegacyMirror } from '../saves/runtime';

declare const __SAVE_NAMESPACES__: readonly string[];
const namespaces: readonly string[] = (() => { try { return __SAVE_NAMESPACES__; } catch { return []; } })();

export function isMirroredSave(key: string, knownNamespaces: readonly string[] = namespaces): boolean {
  if (key.startsWith('ws.ota.')) return true;
  const prefix = appIdentity().savePrefix;
  if (!key.startsWith(prefix)) return false;
  const scope = key.slice(prefix.length);
  return scope === 'global' || scope === 'profile' || knownNamespaces.includes(scope);
}

export function forgetLegacy(keys: readonly string[]): void {
  for (const key of keys) queue(() => Preferences.remove({ key }));
}
installLegacyMirror(forgetLegacy);

let chain: Promise<void> = Promise.resolve();

/** Writes land in order (a later value for a key never loses to an earlier one still in flight). */
function queue(write: () => Promise<void>): void {
  const previous = chain;
  chain = (async () => {
    await previous;
    try { await write(); } catch (error) { console.warn('[native] save mirror write failed', error); }
  })();
}

/** Preferences → localStorage, then mirror later gameplay / OTA writes back. Call once, before the game loads. */
export async function hydrateSaves(): Promise<number> {
  const { keys } = await Preferences.keys();
  const ours = keys.filter((key) => isMirroredSave(key) || key.startsWith('ws.'));
  const rows = await Promise.all(ours.map(async (key) => ({ key, value: (await Preferences.get({ key })).value })));
  for (const { key, value } of rows) if (value !== null) localStorage.setItem(key, value);
  // A save the WebView still holds but Preferences never saw (a first launch after installing this mirror): keep it.
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && isMirroredSave(key) && !ours.includes(key)) {
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
    if (this === localStorage && isMirroredSave(key)) queue(() => Preferences.set({ key, value }));
  };
  proto.removeItem = function removeItem(this: Storage, key: string): void {
    nativeRemove.call(this, key);
    if (this === localStorage && isMirroredSave(key)) queue(() => Preferences.remove({ key }));
  };
  return rows.length;
}

/** Every queued mirror write has landed (or failed). */
export async function flushSaves(): Promise<void> { await chain; }
