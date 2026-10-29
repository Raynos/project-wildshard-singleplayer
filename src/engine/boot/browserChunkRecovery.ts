import { pageScope } from '../app/resources';
import { saveStorage } from '../saves/slots';
import { countReload } from '../core/reloadGuard';
import { beginLoadingWait, finishLoadingWait } from './download';
import { markReload } from './lastEnd';
import { createChunkRecovery } from './chunkRecovery';

declare const __BUILD_ID__: string;
function bootSelfReloadClaimed(): boolean {
  try { return saveStorage('session').getItem('boot.selfReload') !== null; } catch { return true; }
}
function claimBootSelfReload(): boolean {
  try {
    if (bootSelfReloadClaimed()) return false;
    saveStorage('session').setItem('boot.selfReload', '1'); return true;
  } catch { return false; }
}
let worldRunning = false;
const recoveryAllowed = (): boolean => !worldRunning;
let recover: ((error: unknown) => Promise<boolean>) | undefined;
async function latestVersion(): Promise<string | null> {
  const owner = pageScope.child('chunk-version'), controller = new AbortController();
  const url = new URL('/version.json', location.href);
  const wait = beginLoadingWait('Checking updated application', { kind: 'file', resource: url.href });
  owner.onDispose(() => { controller.abort(); }); owner.timeout(3000, () => { controller.abort(); });
  try {
    const response = await fetch(url, {cache: 'no-store', signal: controller.signal});
    if (!response.ok || response.url !== '' && new URL(response.url).origin !== url.origin) return null;
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && 'build' in value && typeof value.build === 'string'
      && /^[\w.-]+$/u.test(value.build) ? value.build : null;
  } catch { return null; }
  finally { finishLoadingWait(wait); owner.dispose(); }
}
/** Only a confirmed newer deployment can replace a rejected boot/lazy module or stylesheet. */
export function recoverChunkFailure(error: unknown): Promise<boolean> {
  if (typeof window === 'undefined' || typeof __BUILD_ID__ !== 'string') return Promise.resolve(false);
  recover ??= createChunkRecovery({allowed: recoveryAllowed, base: location.href, runningBuild: __BUILD_ID__, version: latestVersion,
    claimed: bootSelfReloadClaimed, claim: claimBootSelfReload,
    prepare: async build => {
      const wait = beginLoadingWait('Activating updated application', {kind: 'worker', resource: '/sw.js'});
      try { return await (await import('./sw')).refreshWorkerForChunkRecovery(build, recoveryAllowed); }
      finally { finishLoadingWait(wait); }
    },
    reload: () => { countReload(); markReload('stale deployment code'); location.reload(); },
  });
  return recover(error);
}

let installed = false;
/** Arm lazy-import/CSS failures after the initial entry promise has settled.
 * The ordinary error pipeline still receives the original failure. */
export function installChunkRecovery(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  pageScope.listen(document, 'ws:ready', () => {
    if (!document.documentElement.classList.contains('title-first')) worldRunning = true;
  });
  pageScope.listen(document, 'ws:control-ready', () => { worldRunning = true; });
  pageScope.listen(window, 'unhandledrejection', event => { void recoverChunkFailure(event.reason); });
  pageScope.listen(window, 'vite:preloadError', event => { void recoverChunkFailure(Reflect.get(event, 'payload')); });
}
