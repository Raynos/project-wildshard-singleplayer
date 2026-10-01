import type { Scope } from '../app/scope';
import { isDev, onDev } from '../core/devMode';
import { mountUi } from './ownership';

/** The game supplies a label only for hidden levels; the engine owns visibility and lifetime. */
export function mountDeveloperBanner(root: HTMLElement, scope: Scope, label: string | undefined): void {
  if (label === undefined) return;
  const banner = document.createElement('div');
  banner.className = 'ws-game-developer';
  banner.textContent = label;
  const sync = (on: boolean): void => { banner.hidden = !on; };
  sync(isDev());
  scope.onDispose(onDev(sync));
  mountUi(banner, scope, root);
}
