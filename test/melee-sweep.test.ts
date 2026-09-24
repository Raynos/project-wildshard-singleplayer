// PHYSICS.md P5: the sword's world checks ask the physics world (MeleeSweep → query.ts) — no hit through a wall, and
// the blade tip's clang is the tip ray's hit, its sound picked by the struck collider's material.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { groups } from '../src/physics/groups';
import { tagCollider, type Material } from '../src/physics/surface';
import { bladeBlocked, bladeContact, clangOf } from '../src/player/MeleeSweep';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** a 2 m × 0.2 m × 3 m wall along x at z = 1 (0..3 m high), of `material` */
async function wallWorld(material: Material): Promise<Physics> {
  const ph = new Physics(await rapier());
  const c = ph.world.createCollider(ph.R.ColliderDesc.cuboid(1, 1.5, 0.1).setTranslation(0, 1.5, 1).setCollisionGroups(groups('WORLD')));
  tagCollider(c, material);
  ph.step();
  return ph;
}

const EYE = { x: 0, y: 1.6, z: 0 };
const FWD = { x: 0, y: 0, z: 1 };

describe('MeleeSweep (the sword hit test against the physics world, C1 / B5 → P5)', () => {
  it('a target behind a wall is blocked; one beside it, or over a low wall, is not', async () => {
    const ph = await wallWorld('planks');
    expect(bladeBlocked(ph, EYE, { x: 0, y: 1, z: 2 })).toBe(true);
    expect(bladeBlocked(ph, { x: 1.5, y: 1.6, z: 0 }, { x: 1.5, y: 1, z: 2 })).toBe(false);
    const low = new Physics(ph.R);
    low.world.createCollider(low.R.ColliderDesc.cuboid(1, 0.25, 0.1).setTranslation(0, 0.25, 1).setCollisionGroups(groups('WORLD')));
    low.step();
    expect(bladeBlocked(low, EYE, { x: 0, y: 1.2, z: 2 })).toBe(false);
  });

  it('a surface just short of the target (its own body, the ground under it) does not block', async () => {
    const ph = await wallWorld('stone');
    // the wall's near face is 0.2 m short of the hit point (inside BLADE_SLACK); 0.5 m short of it blocks
    expect(bladeBlocked(ph, EYE, { x: 0, y: 1.6, z: 1.1 })).toBe(false);
    expect(bladeBlocked(ph, EYE, { x: 0, y: 1.6, z: 1.4 })).toBe(true);
  });

  it('standing inside a room of real walls, a target inside it is fair game', async () => {
    const ph = new Physics(await rapier());
    const G = groups('WORLD');
    for (const [x, z, hw, hd] of [[0, 3, 3, 0.1], [0, -3, 3, 0.1], [3, 0, 0.1, 3], [-3, 0, 0.1, 3]] as const) {
      ph.world.createCollider(ph.R.ColliderDesc.cuboid(hw, 1.5, hd).setTranslation(x, 1.5, z).setCollisionGroups(G));
    }
    ph.world.createCollider(ph.R.ColliderDesc.cuboid(3, 0.1, 3).setTranslation(0, -0.1, 0).setCollisionGroups(G)); // the floor
    ph.step();
    expect(bladeBlocked(ph, EYE, { x: 0.5, y: 0.4, z: 1.8 })).toBe(false);
    expect(bladeBlocked(ph, EYE, { x: 0, y: 1, z: 4 })).toBe(true); // outside, through the wall
  });

  it("the player's own capsule never blocks or clangs", async () => {
    const ph = await wallWorld('stone');
    const me = ph.world.createCollider(ph.R.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 1, 0.3).setCollisionGroups(groups('WORLD')));
    ph.step();
    expect(bladeContact(ph, EYE, FWD, 2, me)?.hit.point.z).toBeCloseTo(0.9, 5);
    expect(bladeBlocked(ph, { x: 0, y: 1.6, z: -0.5 }, { x: 0, y: 1.6, z: 0.8 }, me)).toBe(false);
  });

  it('the blade tip meets the wall at its near face, with the wall\'s material picking the clang', async () => {
    const stone = await wallWorld('rock');
    const c = bladeContact(stone, EYE, FWD, 2);
    expect(c?.clang).toBe('stone');
    expect(c?.hit.material).toBe('rock');
    expect(c?.hit.point.z).toBeCloseTo(0.9, 5);
    expect(c?.hit.normal.z).toBeCloseTo(-1, 5);
    expect(bladeContact(await wallWorld('planks'), EYE, FWD, 2)?.clang).toBe('wood');
  });

  it('no contact: a swing beside the wall, one short of it, soft ground, or no physics world', async () => {
    const ph = await wallWorld('wood');
    expect(bladeContact(ph, { x: 1.5, y: 1.6, z: 0 }, FWD, 2)).toBeNull();
    expect(bladeContact(ph, EYE, FWD, 0.8)).toBeNull();
    const sand = await wallWorld('sand');
    expect(bladeContact(sand, EYE, FWD, 2)).toBeNull();
    expect(bladeContact(null, EYE, FWD, 2)).toBeNull();
    expect(bladeBlocked(null, EYE, { x: 0, y: 1, z: 2 })).toBe(false);
  });

  it('clangOf: stone-like rings, timber thuds, the rest makes no contact', () => {
    for (const m of ['stone', 'rock', 'metal', 'shell'] as const) expect(clangOf(m)).toBe('stone');
    expect(clangOf('wood')).toBe('wood');
    expect(clangOf('planks')).toBe('wood');
    for (const m of ['sand', 'wetSand', 'grass', 'water', 'ground', 'edge', 'flesh'] as const) expect(clangOf(m)).toBeNull();
  });
});
