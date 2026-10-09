import { afterEach, expect, it, vi } from 'vitest';
import { activeLevel, configureLevel } from '../../src/engine/level/selection';
import { setActivePhysics } from '../../src/engine/physics/active';
import { setActiveNavmesh } from '../../src/engine/physics/navmeshLoad';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import type { Animal } from '../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../src/engine/entities/species/registry';
import { manager } from '../fake/manager';
import { AUTHORED_TERRAIN } from '../fixtures/authoredTerrain';

afterEach(() => { configureLevel(toLevelSpec(TEMPLATE)); vi.restoreAllMocks(); });

function steering(): { animal: Animal; steer: (yaw: number, speed: number, turn: number) => void } {
  setActivePhysics(null); setActiveNavmesh(TEMPLATE.slug, null);
  const m = manager().manager, animal = m.spawn('crab', 300, 50, 0, 'small', { y: 10 });
  const ctx = Reflect.get(m, 'thinkCtx') as ThinkCtx;
  return { animal, steer: (yaw, speed, turn) => { ctx.steer(animal, yaw, speed, turn); } };
}

it('keeps ctx.steer heading, speed and turn outside the analytic chunk in a structures-only world', () => {
  configureLevel(toLevelSpec({ ...TEMPLATE, ground: { structures: true }, spawn: { x: 300, y: 10, z: 50, yaw: 0 } }));
  const { animal, steer } = steering();
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    steer(yaw, 3, 4);
    expect(Math.sin(animal.desiredYaw)).toBeCloseTo(Math.sin(yaw));
    expect(Math.cos(animal.desiredYaw)).toBeCloseTo(Math.cos(yaw));
    expect(animal.desiredSpeed).toBe(3); expect(animal.turnRate).toBe(4);
  }
});

it('retains analytic chunk-edge avoidance for authored terrain and mixed worlds', () => {
  for (const ground of [{ terrain: AUTHORED_TERRAIN }, { terrain: AUTHORED_TERRAIN, structures: true as const }]) {
    configureLevel(toLevelSpec({ ...TEMPLATE, ground }));
    expect(activeLevel().ground.terrain).toBeDefined();
    const { animal, steer } = steering();
    steer(Math.PI / 2, 3, 4);
    expect(animal.desiredYaw).not.toBeCloseTo(Math.PI / 2);
    expect(animal.desiredSpeed).toBe(3); expect(animal.turnRate).toBe(4);
  }
});
