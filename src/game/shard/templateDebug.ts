import type { App } from '@wildshard/engine/app/app';
import type { Scope } from '@wildshard/engine/app/scope';
import { registerGlobalDebugAction } from '@wildshard/engine/ui/authoredDebugRows';
import { travel } from '../travel/travel';
import { findShard } from './registry';
/** Game-owned discovery: the engine's developer registry knows no shard slug. */
const installed = new WeakSet<App>();
export function installTemplateDebug(app: App, scope: Scope): void {
  if (installed.has(app)) return;
  const manifest = findShard('_template');
  if (manifest === undefined) return;
  installed.add(app);
  scope.onDispose(() => { installed.delete(app); });
  scope.onDispose(registerGlobalDebugAction({ purpose: 'developer', id: 'game.template', group: 'tools', label: 'Template shard', text: 'Enter',
    run: () => { travel({ to: manifest.slug, mode: 'enter' }); },
    note: 'E357 Z1: hidden grey-box teaching level.', ask: 'E357', reviewBy: '2026-12-01' }));
}
