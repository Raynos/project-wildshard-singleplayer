import type { App } from '@wildshard/engine/app/app';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SystemSpec } from '@wildshard/engine/app/systems';

/** One systems-only simulation callback after the existing player fixed step; the Game remains the sole tick driver. */
export function clientSimStep(ports: { scope: Scope; app: Pick<App, 'state'>; freeCamera: () => boolean; active?: () => boolean; system: (system: SystemSpec) => void }): (run: () => void) => () => void {
  let installed = false;
  return (run) => {
    if (installed || ports.scope.disposed) throw new Error('Shardfile fixed-step driver already installed or disposed');
    installed = true; let active = true;
    ports.system({ id: 'game.shardfile.sim', phase: 'fixed.post', after: ['player.step'], when: () => active && (ports.active?.() ?? true) && !ports.scope.disposed && ports.app.state === 'play' && !ports.freeCamera(), run: () => { run(); } });
    return () => { active = false; };
  };
}
