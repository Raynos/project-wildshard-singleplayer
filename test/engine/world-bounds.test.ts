import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { installBounds } from '../../src/engine/world/bounds';

const area = { x0: -5, x1: 5, z0: -5, z1: 5, floor: 0 };
describe('authored world bounds', () => {
  it('uses spawn until grounded, remembers a real floor, and ignores hover and suspended rooms', () => {
    const app = new App(), scope = new Scope('bounds'), spawn = vi.fn<(x: number, z: number, yaw: number, y: number) => void>(), toSpawn = vi.fn<() => void>();
    const player = { position: { x: 8, y: 2, z: 0 }, yaw: 0.7, onGround: true, hover: false, spawn };
    let suspended = false;
    installBounds(app, scope, area, { player, toSpawn, floorAt: () => 2, suspended: () => suspended });
    const system = app.systemsByPhase().update[0]; if (system === undefined) throw new Error('No bounds system');
    expect(system.when?.(app)).toBe(false); app.setState('play'); expect(system.when?.(app)).toBe(true);
    system.run(0.3, 0); expect(toSpawn).toHaveBeenCalledOnce();
    player.position.x = 1; system.run(0.2, 0); player.position.x = 9; system.run(0.1, 0);
    expect(spawn).toHaveBeenLastCalledWith(1, 0, 0.7, 2);
    player.position.x = 3; player.hover = true; system.run(0.3, 0); player.position.x = 9; system.run(0.1, 0);
    expect(spawn).toHaveBeenLastCalledWith(1, 0, 0.7, 2);
    suspended = true; player.position.y = -5; system.run(0.3, 0); expect(spawn).toHaveBeenCalledTimes(2);
    scope.dispose(); expect(app.systemsByPhase().update).toEqual([]);
  });
  it('registers nothing without bounds and never records an airborne or mismatched floor', () => {
    const app = new App(), scope = new Scope('bounds'), toSpawn = vi.fn<() => void>(), spawn = vi.fn<(x: number, z: number, yaw: number, y: number) => void>();
    const player = { position: { x: 1, y: 4, z: 0 }, yaw: 0, onGround: false, hover: false, spawn };
    const host = { player, toSpawn, floorAt: () => 2, suspended: () => false };
    installBounds(app, scope, undefined, host); expect(app.systemsByPhase().update).toEqual([]);
    installBounds(app, scope, area, host); const system = app.systemsByPhase().update[0];
    system?.run(0.3, 0); player.onGround = true; system?.run(0.3, 0);
    player.position.x = 7; system?.run(0.1, 0); expect(toSpawn).toHaveBeenCalledOnce(); expect(spawn).not.toHaveBeenCalled();
    scope.dispose();
  });
});
