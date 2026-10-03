/**
 * Native entry (docs/plans/NATIVE-APPS.md): `vite build --mode native` swaps index.html's web boot for this module
 * (vite.config.ts `nativeHtml`). The engine's native boot (saves, the over-the-air bundle, lifecycle) runs first, then
 * the page services and the game; the composition root wires them, so the engine imports no app module (E405).
 */
// oxlint-disable-next-line import/no-unassigned-import -- evaluated for its effect: the app identity is installed before any other module body runs (E414)
import './identity';
import { nativeBoot } from '#engine/native/boot';

void nativeBoot({
  pageServices: async () => { (await import('./pageServices')).startPageServices(); },
  main: () => import('./main'),
});
