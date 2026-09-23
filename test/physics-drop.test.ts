// PHYSICS.md P7-L2: loot drops are bodies. A legendary's drop (main.ts spawnSkinDrop → WeaponPickup `toss`) pops out of
// the carcass as a short-lived `Drop` body: it flies, bounces, settles on what is under it (a deck, not the sand below
// it), and then the body is removed — the pickup lies at that point for good. The cap may cull it mid-flight: then it
// lands straight below where it was. No body service: it lands where it was put.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { Bodies, Drop } from '../src/physics/bodies';
import { groups } from '../src/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const DT = 1 / 60;

/** the ground at y = 0 and a deck 4 × 4 m, its top at y = 1, centred on the origin */
async function world(): Promise<Physics> {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
  const ph = new Physics(R);
  ph.world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  ph.world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 0.9, 0).setCollisionGroups(groups('WORLD')));
  ph.world.step();
  return ph;
}

/** fixed steps (pre → step → post) with the owner's per-frame update in between, until it lands */
function run(ph: Physics, bodies: Bodies, d: Drop, seconds: number): { t: number; peak: number; top: number } {
  let peak = 0, top = -Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    bodies.pre(DT); ph.step(); bodies.post(DT);
    const b = d.body;
    if (b) { peak = Math.max(peak, b.takeImpact()); top = Math.max(top, b.curr.y); }
    if (d.update(DT)) return { t: (i + 1) / 60, peak, top };
  }
  return { t: -1, peak, top };
}

describe('drops are bodies (P7-L2)', () => {
  it('tossed out of a carcass on a deck, it arcs up, bounces, and settles on the deck; then its body is gone', async () => {
    const ph = await world(), bodies = new Bodies(ph);
    const d = new Drop(bodies, 'loot', { x: -1, y: 2, z: 0 }, { x: 0.8, y: 3.5, z: 0.4 });
    expect(d.landed).toBe(false);
    expect(bodies.list).toHaveLength(1);
    const r = run(ph, bodies, d, 6);
    expect(r.t).toBeGreaterThan(0.5);             // it flew …
    expect(r.t).toBeLessThan(4);                  // … and came to rest by itself (the flight limit is 5 s)
    expect(r.top).toBeGreaterThan(2.4);           // up out of the carcass first
    expect(r.peak).toBeGreaterThan(2);            // a real landing knock (a bounce)
    expect(d.landed).toBe(true);
    expect(d.floor.y).toBeCloseTo(1, 1);          // on the deck, not the sand under it
    expect(Math.abs(d.floor.x)).toBeLessThan(2); expect(Math.abs(d.floor.z)).toBeLessThan(2);
    expect(d.body).toBeNull();
    expect(bodies.list).toHaveLength(0);          // lying still costs the physics nothing
  });

  it('tossed off the deck\'s edge, it lands on the ground below', async () => {
    const ph = await world(), bodies = new Bodies(ph);
    const d = new Drop(bodies, 'loot', { x: 1.6, y: 2, z: 0 }, { x: 2.5, y: 2.5, z: 0 });
    expect(run(ph, bodies, d, 6).t).toBeGreaterThan(0);
    expect(d.floor.x).toBeGreaterThan(2);
    expect(d.floor.y).toBeCloseTo(0, 1);
  });

  it('culled by the cap in flight, it lands at once on the surface straight below', async () => {
    const ph = await world(), bodies = new Bodies(ph, { x: 30, y: 0, z: 0 }, 1);   // the player 30 m off; room for one
    bodies.spawn({ shape: { ball: 0.2 }, material: 'wood', owner: 'near', keep: true }, { x: 30, y: 3, z: 0 });
    const d = new Drop(bodies, 'loot', { x: 0.5, y: 4, z: 0.5 }, { x: 0, y: 1, z: 0 });
    bodies.pre(DT); ph.step(); bodies.post(DT);     // 2 awake, cap 1: the farther, expendable drop goes
    expect(d.landed).toBe(true);
    expect(d.body).toBeNull();
    expect(d.floor.y).toBeCloseTo(1, 2);            // the deck under it
    expect(d.update(DT)).toBe(false);               // nothing more to do
  });

  it('with no body service it lies where it was put; disposed in flight, it drops straight down', async () => {
    const still = new Drop(null, 'loot', { x: 3, y: 1.5, z: 4 }, { x: 0, y: 3, z: 0 });
    expect(still.landed).toBe(true);
    expect(still.floor).toEqual({ x: 3, y: 1.5, z: 4 });
    const ph = await world(), bodies = new Bodies(ph);
    const d = new Drop(bodies, 'loot', { x: 5, y: 2, z: 5 }, { x: 0, y: 2, z: 0 });
    for (let i = 0; i < 10; i++) { bodies.pre(DT); ph.step(); bodies.post(DT); d.update(DT); }
    d.dispose();                                     // picked up mid-air
    expect(d.landed).toBe(true);
    expect(bodies.list).toHaveLength(0);
    expect(d.floor.y).toBeCloseTo(0, 2);
  });
});
