// PHYSICS.md P5 (ranged): the crossbow's bolts and the rifle's rounds ask the physics world what they hit
// (`worldHit` in Crossbow.ts), by material: bolts stick in wood / ground, glance off rock; the invisible chunk-edge
// walls are looked through; no physics world → nothing in the world is hit.
import { afterEach, describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { groups } from '../src/physics/groups';
import { tagCollider, clearTags, type Material } from '../src/physics/surface';
import { setActivePhysics } from '../src/physics/active';
import { sticksIn } from '../src/physics/query';
import { worldHit, impactSurfaceOf } from '../src/player/Crossbow';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** a thin wall across the +x flight line at x = `x`, of `material` */
function wall(ph: Physics, x: number, material: Material): void {
  const c = ph.world.createCollider(ph.R.ColliderDesc.cuboid(0.5, 5, 5).setTranslation(x + 0.5, 0, 0).setCollisionGroups(groups('WORLD')));
  tagCollider(c, material);
}

async function world(...walls: [number, Material][]): Promise<Physics> {
  const ph = new Physics(await rapier());
  for (const [x, m] of walls) wall(ph, x, m);
  ph.step();
  setActivePhysics(ph);
  return ph;
}

afterEach(() => { setActivePhysics(null); clearTags(); });

describe('ranged weapons vs the physics world', () => {
  it('no physics world: nothing is hit', () => {
    setActivePhysics(null);
    expect(worldHit({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 0)).toBeNull();
    expect(worldHit({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 0.03)).toBeNull();
  });

  it('a shot stops at the first wall; the material comes with it', async () => {
    await world([20, 'rock'], [10, 'wood']);
    const hit = worldHit({ x: 0, y: 0, z: 0 }, { x: 300, y: 0, z: 0 }, 0);
    expect(hit?.distance).toBeCloseTo(10, 3);
    expect(hit?.material).toBe('wood');
    expect(hit?.normal.x).toBeCloseTo(-1, 3);
  });

  it("a bolt's ball sweep touches one radius short; a clear step is null", async () => {
    await world([10, 'rock']);
    const hit = worldHit({ x: 0, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, 0.03);
    expect(hit?.distance).toBeCloseTo(9.97, 3);
    expect(hit?.material).toBe('rock');
    expect(worldHit({ x: 0, y: 0, z: 0 }, { x: 9, y: 0, z: 0 }, 0.03)).toBeNull();
  });

  it('looks through the invisible chunk-edge walls (nothing stops in mid-air), distance still from the start', async () => {
    await world([5, 'edge'], [15, 'planks']);
    const hit = worldHit({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 0);
    expect(hit?.material).toBe('planks');
    expect(hit?.distance).toBeCloseTo(15, 2);
    await world([5, 'edge']);
    expect(worldHit({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 0.03)).toBeNull();
  });

  it('bolts stick in wood and ground, glance off rock and stone; sounds by material', () => {
    for (const m of ['wood', 'planks', 'ground', 'sand', 'grass'] as const) expect(sticksIn(m)).toBe(true);
    for (const m of ['rock', 'stone', 'metal', 'shell'] as const) expect(sticksIn(m)).toBe(false);
    expect(impactSurfaceOf('wood')).toBe('wood');
    expect(impactSurfaceOf('planks')).toBe('wood');
    expect(impactSurfaceOf('flesh')).toBe('flesh');
    expect(impactSurfaceOf('rock')).toBe('ground');
    expect(impactSurfaceOf('sand')).toBe('ground');
  });
});
