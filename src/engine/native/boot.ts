import { pageScope } from '../app/resources';
/**
 * Native boot (docs/plans/NATIVE-APPS.md), run by the native entry src/native.ts: `vite build --mode native` swaps
 * index.html's service-worker, update-pill and main.ts scripts for that one module (vite.config.ts `nativeHtml`), so the
 * iOS / Android shells boot (E405: the entry hands in the page services and the game; the engine imports no app module):
 *
 *   1. saves: Preferences → localStorage, and every later `ws.*` write mirrored back (src/engine/native/saves.ts)
 *   2. over-the-air bundle selection (src/engine/native/ota.ts): a staged update activates here, before the game exists
 *   3. lifecycle: background → pause + flush saves, Android Back → the menu (src/engine/native/lifecycle.ts)
 *   4. the page services, the tier, then the game itself (src/main.ts), unchanged
 *   5. on `ws:ready` (booted to the title): tell the updater this bundle is healthy, then check for the next one
 *
 * The web fonts are bundled here too — the stores' reviewers launch offline, and Google Fonts is a network fetch.
 */
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { prepareOta, type OtaSession } from './ota';
import { hydrateSaves } from './saves';
import { installLifecycle } from './lifecycle';

// Steps 1–3 never keep the game from starting: each failure is logged and the boot goes on.
// Saves hydrate first: the updater keeps its own state in `ws.ota.*` keys, and its boot-time writes (consuming the
// staged marker, recording an activation) must go through the Preferences mirror, not only the evictable WebView copy.
export async function nativeBoot(game: { pageServices: () => Promise<void>; main: () => Promise<unknown> }): Promise<void> {
  try { console.info(`[native] ${await hydrateSaves()} saves restored`); } catch (error) { console.warn('[native] save mirror off', error); }
  let ota: OtaSession | null | undefined;
  try { ota = await prepareOta(); } catch (error) { console.warn('[native] update check skipped', error); }
  if (ota === null) return; // a staged bundle is being activated: the WebView reloads into it
  if (ota) { const session = ota; pageScope.listen(document, 'ws:ready', () => { void session.ready(); }, { once: true }); }
  try { await installLifecycle(); } catch (error) { console.warn('[native] lifecycle hooks off', error); }
  await game.pageServices();
  const { initializeTier } = await import('../core/tier');
  await initializeTier();
  await game.main();
}
