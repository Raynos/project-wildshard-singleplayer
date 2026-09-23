/**
 * Native OTA entry (docs/plans/NATIVE-APPS.md N-D): wires the pure controller in updates.ts to the real
 * @capgo/capacitor-updater plugin, the `ws.ota.*` localStorage keys (mirrored into durable Preferences by
 * src/native/saves.ts) and the public channel in ota-config.ts. Imported only by src/native/boot.ts, so the web build
 * never pulls in Capacitor.
 *
 * Order at boot (src/native/boot.ts): hydrateSaves() → prepareOta() → … game … → `ws:ready` → session.ready().
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { OTA_CHANNELS, OTA_PUBLIC_KEY, OTA_RUNTIME, OTA_SAVE_SCHEMA } from './ota-config';
import { flushSaves } from './saves';
import { createNativeUpdater, readUpdateConfig, type UpdateAdapter, type UpdateResult } from './updates';

declare const __BUILD_ID__: string; // vite.config.ts define

export interface OtaSession { ready: () => Promise<void> }

function runningBuild(): string {
  try { return __BUILD_ID__; } catch { return ''; }
}

/** The plugin, narrowed to what the controller uses (and nothing that could switch bundles mid-session). */
const adapter: UpdateAdapter = {
  current: () => CapacitorUpdater.current(),
  list: () => CapacitorUpdater.list(),
  // Multi-file mode: `url` is required by both native bridges but unused for the transfer; no `checksum`, because the
  // plugin records none for a multi-file bundle and would reject any non-empty one (every file is hash-checked).
  download: ({ url, version, manifest }) => CapacitorUpdater.download({ url, version, manifest }),
  delete: ({ id }) => CapacitorUpdater.delete({ id }),
  set: ({ id }) => CapacitorUpdater.set({ id }),
  notifyAppReady: () => CapacitorUpdater.notifyAppReady(),
};

function report(what: string, result: UpdateResult): void {
  if (result === 'rejected' || result === 'unavailable') console.warn(`[ota] ${what}: ${result}`);
  else console.info(`[ota] ${what}: ${result}`);
}

/**
 * Call first thing at native boot, before the game module is imported. Returns null when a staged bundle was just
 * activated (the WebView is being replaced — do not boot the game).
 */
export async function prepareOta(): Promise<OtaSession | null> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') throw new Error(`[ota] unsupported platform ${platform}`);
  const info = await App.getInfo();
  const updater = createNativeUpdater({
    adapter,
    storage: { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => { localStorage.setItem(k, v); }, removeItem: (k) => { localStorage.removeItem(k); }, flush: flushSaves },
    host: { platform, nativeVersion: info.version, runtime: OTA_RUNTIME, saveSchema: OTA_SAVE_SCHEMA, buildId: runningBuild() },
    config: readUpdateConfig(OTA_CHANNELS[platform], OTA_PUBLIC_KEY),
  });
  const boot = await updater.activateStagedAtBoot();
  report('boot', boot);
  if (boot === 'activated') return null;
  const check = async (): Promise<void> => {
    try { report('check', await updater.checkForUpdate()); } catch (error) { console.warn('[ota] check failed', error); }
  };
  let acknowledged = false;
  return {
    async ready(): Promise<void> {
      if (acknowledged) return;
      acknowledged = true;
      await updater.notifyReady();
      // Update availability must never hold the game hostage to the network: fire and forget, bounded inside.
      void check();
    },
  };
}
