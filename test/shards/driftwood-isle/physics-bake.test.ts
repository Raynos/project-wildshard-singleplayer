// oxlint-disable-next-line import/no-nodejs-modules -- Trusted-bake freshness is checked against the test checkout.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The native physics module is read from the in-tree wasm.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { driftwoodPhysicsInputs } from '../../../scripts/driftwood-physics-inputs.mjs';
import bakedJson from '../../../src/shards/driftwood-isle/runtime/physics.baked.json';
import { DRIFTWOOD_ISLE, WRECK, PRACTICE_CRAB } from '../../../src/shards/driftwood-isle/manifest';
import { holdCentre, placeEnemies, PRACTICE_AT, WRECK_SITE } from '../../../src/shards/driftwood-isle/runtime/placement';
import { Rng } from '../../../src/engine/core/rng';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { GROUP } from '../../../src/engine/physics/groups';

const bytesOf = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.codePointAt(0) ?? 0);
const decode = (text: string): Float32Array => new Float32Array(bytesOf(text).buffer);
const finite = v.pipe(v.number(), v.finite()), xyz = v.strictObject({ x: finite, y: finite, z: finite });
/** The bake's own shape, strictly (TypeScript does not infer a JSON module this large). */
const Bake = v.object({ version: v.literal(1), revision: v.string(), inputs: v.record(v.string(), v.string()),
  ground: v.object({ rows: finite, cols: finite, scale: xyz, at: xyz, heights: v.string() }),
  solids: v.array(v.object({ shape: finite, groups: finite, at: v.array(finite), rot: v.array(finite), half: v.optional(v.array(finite)),
    halfHeight: v.optional(finite), radius: v.optional(finite), vertices: v.optional(v.string()), indices: v.optional(v.string()) })),
  actors: v.array(v.object({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, scale: finite, seed: finite,
    at: v.nullable(v.strictObject({ x: finite, z: finite })), spec: v.object({ kind: v.string(), variant: v.string(), hp: finite, dims: v.object({ bodyRadius: finite }) }) })),
  herds: v.array(v.object({ kind: v.string(), members: v.array(v.string()) })),
  habitat: v.object({ perches: v.array(xyz), perchBases: v.array(xyz), crabSites: v.array(v.strictObject({ x: finite, z: finite })), practice: v.string(),
    hold: v.object({ x: finite, z: finite, r: finite, guardR: finite, step: finite, floor: v.array(v.nullable(finite)) }) }),
  pieces: v.array(v.object({ id: v.string(), colliders: finite })) });
const baked = v.parse(Bake, bakedJson);
const RES = 256, SIZE = 500, SEED = 0x5ea1;
const heights = decode(baked.ground.heights), d = SIZE / (RES - 1);
/** The baked floor at a lattice vertex (Rapier's column-major heights). */
const vertex = (ix: number, iz: number): number => heights[ix * RES + iz] ?? Number.NaN;
/** The baked floor anywhere, on Rapier's own triangle split (physics/terrain.ts). */
function floorAt(x: number, z: number): number {
  const gx = (x + SIZE / 2) / d, gz = (z + SIZE / 2) / d, ix = Math.min(RES - 2, Math.floor(gx)), iz = Math.min(RES - 2, Math.floor(gz)), u = gx - ix, w = gz - iz;
  return u + w <= 1 ? vertex(ix, iz) + (vertex(ix + 1, iz) - vertex(ix, iz)) * u + (vertex(ix, iz + 1) - vertex(ix, iz)) * w
    : vertex(ix + 1, iz + 1) + (vertex(ix, iz + 1) - vertex(ix + 1, iz + 1)) * (1 - u) + (vertex(ix + 1, iz) - vertex(ix + 1, iz + 1)) * (1 - w);
}

it('refuses stale source bytes before the trusted Driftwood physics bake is used', () => {
  expect(baked.version).toBe(1);
  expect(baked.inputs).toEqual(driftwoodPhysicsInputs(process.cwd()));
  expect(baked.revision).toMatch(/^[a-f0-9]{7,40}$/u);
});

it('captures the native floor: the island\'s own field at every lattice vertex, lowered only by the sea cave\'s cuts', () => {
  const { ground } = baked, terrain = DRIFTWOOD_ISLE.ground.terrain;
  if (terrain === undefined) throw new Error('Driftwood declares its analytic field');
  expect([ground.rows, ground.cols]).toEqual([RES - 1, RES - 1]);
  expect(ground.scale).toEqual({ x: SIZE, y: 1, z: SIZE }); expect(ground.at).toEqual({ x: 0, y: 0, z: 0 });
  expect(heights.length).toBe(RES * RES);
  let cut = 0, worst = 0;
  for (let iz = 0; iz < RES; iz++) for (let ix = 0; ix < RES; ix++) {
    const want = terrain.heightAt(ix * d - SIZE / 2, iz * d - SIZE / 2), got = vertex(ix, iz);
    if (got < want - 0.05) cut++; else worst = Math.max(worst, Math.abs(got - want));
  }
  // the live ground is the offline bake of this field (BakedTerrain, its datum the G164 drop): equal to it at the lattice
  expect(worst).toBeLessThan(0.05);
  // the sea cave (Cove.terrainCuts, cutTerrain): a few dozen vertices, never most of the floor
  expect(cut).toBeGreaterThan(0); expect(cut).toBeLessThan(500);
});

/** The fauna's anchor searches' draws on the creature stream before the first enemy (the four sounders and two bears). */
const FAUNA_DRAWS = 148;

it('captures the roster in the manager\'s order: the island\'s fauna, then the enemies from the creature stream after its draws', () => {
  const ids = baked.actors.map(actor => actor.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(baked.herds.flatMap(herd => herd.members).every(id => ids.includes(id))).toBe(true);
  for (const actor of baked.actors) {
    expect(actor.spec.kind).toBe(actor.kind); expect(actor.spec.variant).toBe(actor.variant);
    expect(actor.spec.hp).toBeGreaterThan(0); expect(actor.spec.dims.bodyRadius).toBeGreaterThan(0); expect(actor.scale).toBeGreaterThan(0);
  }
  // AnimalManager's stream Rng(SEED + 31): a named variant costs six draws per body (scale, rig seed, actor seed, timer,
  // fleeUntil, callT), a rolled one seven; the enemies take the stream right after the fauna's anchor searches
  const enemies = baked.actors.filter(actor => ['crab', 'monkey', 'sailor'].includes(actor.kind));
  const rng = new Rng(SEED + 31), stream: number[] = []; for (let i = 0; i < 400; i++) stream.push(rng.next());
  const first = enemies[0]; if (first === undefined) throw new Error('No enemies baked');
  let at = stream.indexOf(first.seed) - 2;
  expect(at).toBe(FAUNA_DRAWS);
  for (const actor of enemies) {
    if (actor.kind === 'monkey') at++; // the variant roll
    expect(actor.seed).toBe(stream[at + 2]); at += 6;
  }
});

it('places the enemies renderer-free exactly as Enemies.ts did in the browser', () => {
  expect(WRECK_SITE).toEqual({ x: WRECK.x, z: WRECK.z, heading: WRECK.heading }); expect(PRACTICE_AT).toEqual(PRACTICE_CRAB);
  expect(holdCentre().x).toBeCloseTo(baked.habitat.hold.x, 9); expect(holdCentre().z).toBeCloseTo(baked.habitat.hold.z, 9);
  const terrain = DRIFTWOOD_ISLE.ground.terrain; if (terrain === undefined) throw new Error('Driftwood declares its analytic field');
  const placed = placeEnemies({ seed: SEED, crabSites: baked.habitat.crabSites, palms: baked.habitat.perchBases, heightAt: terrain.heightAt, waterLevel: terrain.waterLevel() });
  const enemies = baked.actors.filter(actor => ['crab', 'monkey', 'sailor'].includes(actor.kind));
  expect(placed.enemies.length).toBe(enemies.length);
  const herdBase = Math.min(...enemies.filter(a => a.herd >= 0).map(a => a.herd));
  placed.enemies.forEach((row, i) => {
    const actor = enemies[i], at = actor?.at ?? null; if (actor === undefined || at === null) throw new Error(`Missing baked enemy ${String(i)}`);
    expect(actor.kind).toBe(row.kind); if (row.variant !== null) expect(actor.variant).toBe(row.variant);
    expect(actor.herd).toBe(row.herd < 0 ? -1 : row.herd + herdBase);
    expect(at.x).toBeCloseTo(row.x, 9); expect(at.z).toBeCloseTo(row.z, 9);
    if (row.practice === true) expect(actor.id).toBe(baked.habitat.practice);
  });
});

it('rebuilds every baked solid world collider natively, over the floor the enemies stand on', async () => {
  const R = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  try {
    for (const solid of baked.solids) {
      expect((solid.groups >>> 16) & GROUP.WORLD).toBe(GROUP.WORLD);
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0] ?? 0, solid.half[1] ?? 0, solid.half[2] ?? 0)
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 10 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.cylinder(solid.halfHeight, solid.radius)
            : solid.shape === 0 && solid.radius !== undefined ? R.ColliderDesc.ball(solid.radius)
              : solid.shape === 9 && solid.vertices !== undefined ? R.ColliderDesc.convexHull(decode(solid.vertices))
                : solid.shape === 6 && solid.vertices !== undefined && solid.indices !== undefined ? R.ColliderDesc.trimesh(decode(solid.vertices), new Uint32Array(bytesOf(solid.indices).buffer))
                  : null;
      if (desc === null) throw new Error(`Unbuildable baked collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0] ?? 0, solid.at[1] ?? 0, solid.at[2] ?? 0).setRotation({ x: solid.rot[0] ?? 0, y: solid.rot[1] ?? 0, z: solid.rot[2] ?? 0, w: solid.rot[3] ?? 1 }).setCollisionGroups(solid.groups));
    }
    expect(world.colliders.len()).toBe(baked.solids.length);
    expect(baked.pieces.map(piece => piece.id)).toEqual(expect.arrayContaining(['pier', 'jetty-0', 'jetty-1', 'jetty-2', 'entry-landings', 'hut', 'lookout', 'wreck', 'shrine', 'cove']));
  } finally { world.free(); }
  // every crab and the practice crab stand on dry baked floor; the hold's floor is the wreck's own deck under the sailor
  for (const actor of baked.actors) if (actor.kind === 'crab' && actor.at !== null) expect(floorAt(actor.at.x, actor.at.z)).toBeGreaterThan(0.15);
  expect(baked.habitat.hold.floor.filter(y => y !== null).length).toBeGreaterThan(100);
});
