import { expect, it, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { installBounds } from '../src/engine/world/bounds';
import { resolveLevelBounds, type ShardPlayHooks } from '../src/game/shard/runtime';

it('selects a session-local area once while OFF retains the exact authored recovery policy', () => {
  const authored = { x0: -120, x1: 120, z0: -240, z1: 60, floor: 12 };
  const override = { x0: -250, x1: 250, z0: -250, z1: 250, floor: -8 };
  const choose = vi.fn(() => override), on: ShardPlayHooks = { levelBounds: choose }, off: ShardPlayHooks = {};
  const boots = [off, on].map(hooks => {
    const app = new App(), scope = new Scope('bounds'), recover = vi.fn<() => void>();
    const player = { position: { x: 0, y: 11, z: 0 }, yaw: 0, onGround: false, hover: false, spawn: () => undefined };
    const selected = resolveLevelBounds(authored, hooks);
    installBounds(app, scope, selected, { player, toSpawn: recover, floorAt: () => undefined, suspended: () => false });
    const system = app.systemsByPhase().update[0]; if (system === undefined) throw new Error('Missing bounds');
    return { app, scope, player, recover, selected, system };
  });
  try {
    const inactive = boots[0], active = boots[1]; if (inactive === undefined || active === undefined) throw new Error('Missing session');
    expect(inactive.selected).toBe(authored); expect(active.selected).toBe(override);
    for (const boot of boots) {
      boot.system.run(1 / 60, 0);
      boot.player.position.y = 30; boot.player.position.x = 130; boot.system.run(1 / 60, 0);
      boot.player.position.x = 0; boot.player.position.y = -9; boot.system.run(1 / 60, 0);
    }
    expect(inactive.recover).toHaveBeenCalledTimes(3); expect(active.recover).toHaveBeenCalledOnce();
    expect(choose).toHaveBeenCalledOnce(); expect(choose).toHaveBeenCalledWith(authored);
    expect(authored).toEqual({ x0: -120, x1: 120, z0: -240, z1: 60, floor: 12 });
    expect(resolveLevelBounds(undefined, off)).toBeUndefined();
  } finally {
    for (const boot of boots) { boot.scope.dispose(); expect(boot.app.systemsByPhase().update).toEqual([]); }
  }
});


it('delegates grid falls to the spatial policy without the standalone 0.2 s soft checkpoint', () => {
  const app = new App(), scope = new Scope('grid.bounds'), recover = vi.fn<() => void>(), spawn = vi.fn<() => void>();
  const player = { position: { x: 245, y: 0, z: 0 }, yaw: 0, onGround: true, hover: false, spawn };
  let floor = -250;
  installBounds(app, scope, { x0: -100, x1: 100, z0: -100, z1: 100, floor: -10 }, {
    player, toSpawn: recover, floorAt: () => 0, suspended: () => false, grid: () => true, fallFloor: () => floor,
  });
  const system = app.systemsByPhase().update[0]; if (system === undefined) throw new Error('Missing grid bounds');
  try {
    system.run(1, 0); player.position.y = -249; system.run(1, 0);
    expect(recover).not.toHaveBeenCalled(); player.position.y = -251; system.run(1, 0);
    expect(recover).toHaveBeenCalledOnce(); expect(spawn).not.toHaveBeenCalled();
    floor = -60; player.position.y = -59; system.run(1, 0); expect(recover).toHaveBeenCalledOnce();
    player.position.y = -61; system.run(1, 0); expect(recover).toHaveBeenCalledTimes(2);
  } finally { scope.dispose(); }
});
