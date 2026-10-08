// oxlint-disable-next-line import/no-nodejs-modules -- The camera lifetime witness uses production native worlds.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Game } from '../src/engine/core/Game';
import { worldTime } from '../src/engine/core/time';
import { CameraFX } from '../src/engine/player/CameraFX';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { SIM_LEVEL } from './fixtures/sim-level/level';

it.each(['borrowed', 'owned'])('keeps one camera updater through two rebuilt %s region facades', async mode => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const app = new App(), page = app.engineScope.child('page'), camera = new PerspectiveCamera();
  const candidate: unknown = Object.create(Game.prototype);
  if (!(candidate instanceof Game)) throw new Error('Missing Game prototype');
  const faults = new Map<string, object>();
  for (const [key, value] of Object.entries({ app, camera, levelScope: page, playerScope: page, registrationScope: page, faultSystems: faults, anonymous: 0 })) {
    Reflect.defineProperty(candidate, key, { value, writable: true });
  }
  const root = candidate, originalDt = worldTime.realDt;
  // Owned shells have no home weapon: the first request may come from the first regional facade.
  let fx = mode === 'borrowed' ? CameraFX.for(root) : undefined;
  worldTime.realDt = 1 / 60;
  try {
    for (let visit = 0; visit < 2; visit++) {
      const region = page.child(`region.${String(visit)}`);
      const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier: R, playerBody: false, scope: region });
      const facade = new Proxy(root, { get(target, key, receiver) {
        if (key === 'levelScope' || key === 'registrationScope') return region;
        // Owned runtime callbacks are namespaced and entered-only; borrowed facade callbacks use Game registration.
        if (key === 'onUpdate' && mode === 'owned') return (run: (dt: number, t: number) => void, label: string): void => {
          app.addSystem({ id: `runtime.${String(visit)}.${label}`, phase: 'update', run }, region);
        };
        const value: unknown = Reflect.get(target, key, receiver); return value;
      } });
      const entered = CameraFX.for(facade);
      fx ??= entered;
      expect(entered).toBe(fx);
      expect(app.systemsByPhase().update.map(system => system.id)).toEqual(['engine.player.for']);
      fx.fovPunch(-2);
      for (const system of app.systemsByPhase().update) system.run(1 / 60, visit);
      expect(fx.fovOffset).toBeLessThan(0);
      region.dispose(); expect(host.scope.disposed).toBe(true);
      expect(region.census.bodies).toBe(0); expect(region.census.colliders).toBe(0);
      expect(app.systemsByPhase().update.map(system => system.id)).toEqual(['engine.player.for']);
      // Player-owned effects still settle on the road after the regional native world has been freed.
      for (let tick = 0; tick < 600; tick++) for (const system of app.systemsByPhase().update) system.run(1 / 60, tick);
      expect(fx.fovOffset).toBe(0);
    }
    if (fx === undefined) throw new Error('No entered camera effects');
    page.dispose(); expect(app.systemsByPhase().update).toEqual([]); expect(faults.size).toBe(0);
    const replacement = new Scope('replacement-player');
    Reflect.defineProperty(root, 'playerScope', { value: replacement });
    Reflect.defineProperty(root, 'registrationScope', { value: replacement });
    expect(CameraFX.for(root)).not.toBe(fx); replacement.dispose();
    expect(app.systemsByPhase().update).toEqual([]);
  } finally { page.dispose(); worldTime.realDt = originalDt; }
});
