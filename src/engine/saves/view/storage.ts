import { installSaveEnvironment } from '../environment';

/** Installed before save readers run. Keep browser APIs out of the save schema/store import graph. */
export function installBrowserSaveEnvironment(): void {
  installSaveEnvironment({
    storage: (scope) => { try { return scope === 'session' ? globalThis.sessionStorage : globalThis.localStorage; } catch { return null; } },
    persistent: () => typeof window !== 'undefined',
    persist: async () => { try { return await navigator.storage.persist(); } catch { return false; } },
  });
}
