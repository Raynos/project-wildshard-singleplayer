/**
 * Native entry (docs/plans/NATIVE-APPS.md). `vite build --mode native` swaps index.html's service-worker, update-pill
 * and main.ts scripts for this one module (vite.config.ts `nativeHtml`), so the iOS / Android shells boot:
 *
 *   1. saves: Preferences → localStorage, and every later `ws.*` write mirrored back (src/native/saves.ts)
 *   2. over-the-air bundle selection (src/native/ota.ts): a staged update activates here, before the game exists
 *   3. lifecycle: background → pause + flush saves, Android Back → the menu (src/native/lifecycle.ts)
 *   4. the game itself (src/main.ts), unchanged
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
async function boot(): Promise<void> {
  try { console.info(`[native] ${await hydrateSaves()} saves restored`); } catch (error) { console.warn('[native] save mirror off', error); }
  let ota: OtaSession | null | undefined;
  try { ota = await prepareOta(); } catch (error) { console.warn('[native] update check skipped', error); }
  if (ota === null) return; // a staged bundle is being activated: the WebView reloads into it
  if (ota) { const session = ota; document.addEventListener('ws:ready', () => { void session.ready(); }, { once: true }); }
  try { await installLifecycle(); } catch (error) { console.warn('[native] lifecycle hooks off', error); }
  await import('../main');
}

void boot();
