// oxlint-disable-next-line import/no-nodejs-modules -- Trusted-bake freshness is checked against the test checkout.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The native physics module is read from the in-tree wasm.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { nalatiPhysicsInputs } from '../../../scripts/nalati-physics-inputs.mjs';
import * as v from 'valibot';
import bakedJson from '../../../src/shards/nalati-grasslands/runtime/physics.baked.json';
import { nalatiBake, NALATI_GROUND_RES, NALATI_GROUND_SIZE } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { NALATI_WILDLIFE } from '../../../src/shards/nalati-grasslands/creatures/wildlife';
import { TERRAIN } from '../../../src/shards/nalati-grasslands/world/terrain';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { GROUP } from '../../../src/engine/physics/groups';

/** The bake's provenance fields (the strict body is runtime/baked.ts's). */
const baked = v.parse(v.object({ version: v.literal(1), revision: v.string(), inputs: v.record(v.string(), v.string()) }), bakedJson);

it('refuses stale source or model bytes before the trusted Nalati physics bake is used', () => {
  expect(baked.inputs).toEqual(nalatiPhysicsInputs(process.cwd()));
  expect(baked.revision).toMatch(/^[a-f0-9]{7,40}$/u);
  expect(Object.keys(baked.inputs).some(path => path.endsWith('/wolf.phone.rigged.glb'))).toBe(true);
});

it('captures the native floor: Nalati\'s own terrain recipe at every lattice vertex', () => {
  const { ground } = nalatiBake();
  expect(ground.scale).toEqual({ x: NALATI_GROUND_SIZE, y: 1, z: NALATI_GROUND_SIZE }); expect(ground.at).toEqual({ x: 0, y: 0, z: 0 });
  const d = NALATI_GROUND_SIZE / (NALATI_GROUND_RES - 1);
  let off = 0, worst = 0;
  for (let iz = 0; iz < NALATI_GROUND_RES; iz++) for (let ix = 0; ix < NALATI_GROUND_RES; ix++) {
    const want = Math.fround(TERRAIN.heightAt(ix * d - NALATI_GROUND_SIZE / 2, iz * d - NALATI_GROUND_SIZE / 2)), got = ground.heights[ix * NALATI_GROUND_RES + iz] ?? Number.NaN;
    const gap = Math.abs(got - want); if (gap > 1e-4) off++; worst = Math.max(worst, gap);
  }
  expect({ off, worst: Number.isFinite(worst) }).toEqual({ off: 0, worst: true });
});

it('captures Wildlife\'s bodies in the manager\'s order, with model-derived specs', () => {
  const { actors, herds } = nalatiBake();
  const [pack, herd] = herds;
  const [wolves, horses] = [NALATI_WILDLIFE.packs[0], NALATI_WILDLIFE.herds[0]];
  if (pack === undefined || herd === undefined || wolves === undefined || horses === undefined) throw new Error('Missing Nalati groups');
  // creatures/wildlife.ts build order: the pack, then the wild herd (mares, foals, the stallion), then the flock's dog
  expect(pack.kind).toBe('wolf');
  expect(pack.members.map(id => actors.find(actor => actor.id === id)?.variant)).toEqual(wolves.variants);
  expect(herd.kind).toBe('horse'); expect(herd.members.length).toBe(horses.mares + horses.foals + (horses.stallion ? 1 : 0));
  expect(actors.slice(0, pack.members.length + herd.members.length).map(actor => actor.id)).toEqual([...pack.members, ...herd.members]);
  expect(actors.some(actor => actor.kind === 'sheepdog' && actor.variant === 'collie')).toBe(true);
  for (const actor of actors) {
    expect(actor.spec.hp).toBeGreaterThan(0); expect(actor.spec.dims.bodyRadius).toBeGreaterThan(0); expect(actor.scale).toBeGreaterThan(0);
  }
});

it('rebuilds every baked solid world collider natively', async () => {
  const R = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  try {
    for (const solid of nalatiBake().solids) {
      expect((solid.groups >>> 16) & GROUP.WORLD).toBe(GROUP.WORLD);
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0], solid.half[1], solid.half[2])
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 9 && solid.points !== undefined ? R.ColliderDesc.convexHull(solid.points)
            : solid.shape === 6 && solid.points !== undefined && solid.indices !== undefined ? R.ColliderDesc.trimesh(solid.points, solid.indices)
              : null;
      if (desc === null) throw new Error(`Unbuildable baked collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(...solid.at).setRotation({ x: solid.rot[0], y: solid.rot[1], z: solid.rot[2], w: solid.rot[3] }).setCollisionGroups(solid.groups));
    }
    expect(world.colliders.len()).toBe(nalatiBake().solids.length);
  } finally { world.free(); }
});
