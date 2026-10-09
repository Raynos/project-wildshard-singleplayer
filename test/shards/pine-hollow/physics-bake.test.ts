// oxlint-disable-next-line import/no-nodejs-modules -- Trusted-bake freshness is checked against the test checkout.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The native physics module is read from the in-tree wasm.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pinePhysicsInputs } from '../../../scripts/pine-physics-inputs.mjs';
import * as v from 'valibot';
import bakedJson from '../../../src/shards/pine-hollow/runtime/physics.baked.json';
import { TERRAIN } from '../../../src/shards/pine-hollow/world/terrain';
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
  actors: v.array(v.object({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, scale: finite, seed: finite, scripted: v.boolean(),
    spec: v.object({ kind: v.string(), variant: v.string(), hp: finite, dims: v.object({ bodyRadius: finite }) }) })),
  herds: v.array(v.object({ kind: v.string(), members: v.array(v.string()) })) });
const baked = v.parse(Bake, bakedJson);
const RES = 256, SIZE = 500;

it('refuses stale source or model bytes before the trusted Pine physics bake is used', () => {
  expect(baked.version).toBe(1);
  expect(baked.inputs).toEqual(pinePhysicsInputs(process.cwd()));
  expect(baked.revision).toMatch(/^[a-f0-9]{7,40}$/u);
  expect(Object.keys(baked.inputs).some(path => path.endsWith('/bear-black.rigged.glb'))).toBe(true);
});

it('captures the native floor: Pine\'s own terrain recipe at every lattice vertex, lowered only by the crag cuts', () => {
  const { ground } = baked;
  expect([ground.rows, ground.cols]).toEqual([RES - 1, RES - 1]);
  expect(ground.scale).toEqual({ x: SIZE, y: 1, z: SIZE }); expect(ground.at).toEqual({ x: 0, y: 0, z: 0 });
  const heights = decode(ground.heights), d = SIZE / (RES - 1);
  expect(heights.length).toBe(RES * RES);
  let cut = 0;
  for (let iz = 0; iz < RES; iz++) for (let ix = 0; ix < RES; ix++) {
    const want = Math.fround(TERRAIN.heightAt(ix * d - SIZE / 2, iz * d - SIZE / 2)), got = heights[ix * RES + iz] ?? Number.NaN;
    if (got < want - 1e-6) cut++; else expect(Math.abs(got - want)).toBeLessThan(1e-6);
  }
  // the crags' walk-in spaces (physics/terrain.ts cutTerrain): a few hundred vertices, never most of the floor
  expect(cut).toBeGreaterThan(0); expect(cut).toBeLessThan(1000);
});

it('captures the forest herds and the Den in the manager\'s order, with model-derived specs', () => {
  const ids = baked.actors.map(actor => actor.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(baked.herds.flatMap(herd => herd.members).every(id => ids.includes(id))).toBe(true);
  const kinds = new Map<string, number>(); baked.actors.forEach(actor => { if (actor.herd >= 0) kinds.set(actor.kind, (kinds.get(actor.kind) ?? 0) + 1); });
  expect(kinds.get('bear')).toBe(3); // manifest.ts: two black bears and the brown at the Den
  // outside any herd: the four lair elites (combat/elites.ts), each its own native recipe
  expect(baked.actors.filter(actor => actor.herd < 0).map(actor => `${actor.kind}.${actor.variant}`).sort()).toEqual(['bear.black-old', 'boar.ironhide', 'deer.ghost', 'elk.imperial']);
  for (const kind of ['deer', 'boar', 'elk']) expect(kinds.get(kind)).toBeGreaterThan(10);
  for (const actor of baked.actors) {
    expect(actor.spec.kind).toBe(actor.kind); expect(actor.spec.variant).toBe(actor.variant);
    expect(actor.spec.hp).toBeGreaterThan(0); expect(actor.spec.dims.bodyRadius).toBeGreaterThan(0); expect(actor.scale).toBeGreaterThan(0);
    expect(actor.scripted).toBe(actor.herd < 0); // an elite is its fight's (combat/ctx.ts own), never the manager's
  }
});

it('rebuilds every baked solid world collider natively: trunks, rocks, crags, cabins and the edge walls', async () => {
  const R = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  try {
    const shapes = new Map<number, number>();
    for (const solid of baked.solids) {
      expect((solid.groups >>> 16) & GROUP.WORLD).toBe(GROUP.WORLD);
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0] ?? 0, solid.half[1] ?? 0, solid.half[2] ?? 0)
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 9 && solid.vertices !== undefined ? R.ColliderDesc.convexHull(decode(solid.vertices))
            : solid.shape === 6 && solid.vertices !== undefined && solid.indices !== undefined ? R.ColliderDesc.trimesh(decode(solid.vertices), new Uint32Array(bytesOf(solid.indices).buffer))
              : null;
      if (desc === null) throw new Error(`Unbuildable baked collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0] ?? 0, solid.at[1] ?? 0, solid.at[2] ?? 0).setRotation({ x: solid.rot[0] ?? 0, y: solid.rot[1] ?? 0, z: solid.rot[2] ?? 0, w: solid.rot[3] ?? 1 }).setCollisionGroups(solid.groups));
      shapes.set(solid.shape, (shapes.get(solid.shape) ?? 0) + 1);
    }
    expect(world.colliders.len()).toBe(baked.solids.length);
    expect(shapes.get(2)).toBeGreaterThan(900); // the forest's trunk capsules
    expect(shapes.get(9)).toBeGreaterThan(500); // rocks and crag hulls
  } finally { world.free(); }
});
