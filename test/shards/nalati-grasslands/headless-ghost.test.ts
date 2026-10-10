// oxlint-disable-next-line import/no-nodejs-modules -- The native recipe proof uses the shipped Rapier wasm.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { Rng } from '../../../src/engine/core/rng';
import { variantMods } from '../../../src/engine/entities/species/registry';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { GHOSTRIDER_SPECIES } from '../../../src/shards/nalati-grasslands/species/ghostRider';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { nalatiGhostSpec } from '../../../src/shards/nalati-grasslands/runtime/headlessGhost';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';

it('authenticates both ghost variants against their real horse rigs and preserves authored HP/mods/lockability', () => {
  const bake = nalatiBake(), species = GHOSTRIDER_SPECIES;
  for (const variant of ['rider', 'captain'] as const) {
    const row = species.variants.find(v => v.id === variant); if (row === undefined) throw new Error('Missing actual ghost row');
    for (const seed of [42, 19317, 771991]) {
      const model = species.build(row, new Rng(seed));
      try {
        const spec = nalatiGhostSpec(bake, variant);
        expect(spec.dims).toEqual(model.dims); expect(spec.mods).toEqual(variantMods(species, row));
        expect(spec).toMatchObject({ kind: species.kind, label: row.label, variant, rarity: row.rarity, hp: row.hp, aggressive: true, lockable: true });
      } finally { for (const part of [...model.furParts, ...model.hardParts, ...model.eyeParts]) part.dispose(); }
    }
  }
  expect(nalatiGhostSpec(bake, 'rider').hp).toBe(70); expect(nalatiGhostSpec(bake, 'captain').hp).toBe(800);
  const before = structuredClone(bake.actors.find(a => a.kind === 'horse')?.spec.dims), copy = nalatiGhostSpec(bake, 'captain');
  copy.dims.bodyY = 100; expect(bake.actors.find(a => a.kind === 'horse')?.spec.dims).toEqual(before);
  expect(() => nalatiGhostSpec({ ...bake, actors: [] }, 'rider')).toThrow('Missing authenticated');
});

it('uses those exact recipes in real native capsules, restores the suffix and retires each deferred body without residue', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const level = { ...SIM_LEVEL, entities: [], quests: [] }, bake = nalatiBake();
  const a = createSimHost(level, { rapier }); let restored: SimHost | undefined;
  const baseline = a.physics.world.colliders.len();
  const recipes = (['rider', 'captain'] as const).map((variant, i) => ({ id: `creature:${String(i)}`, spec: nalatiGhostSpec(bake, variant),
    seed: 0.31 + i * 0.2, scale: variant === 'captain' ? 1.12 : 1.04, at: { x: 15 + i * 5, y: 0, z: 5 }, yaw: 0.4 }));
  try {
    const actors = recipes.map(row => a.spawn(row));
    expect(a.physics.world.colliders.len()).toBe(baseline + 2);
    expect(actors.every(actor => actor.motor !== null)).toBe(true);
    for (const actor of actors) actor.setMotion(0.4, 8.5, 2.2);
    for (let tick = 0; tick < 80; tick++) a.step();
    actors[0]?.applyDamage(25, new Vector3(), new Vector3());
    const saved = snapshotSimHost(a);
    const b = restoreSimHost(level, { rapier }, saved, fresh => { recipes.forEach(row => { fresh.spawn(row); }); }); restored = b;
    for (let tick = 0; tick < 100; tick++) { a.step(); b.step(); expect(snapshotSimHost(b)).toEqual(snapshotSimHost(a)); }
    for (const row of recipes) { expect(a.retire(row.id)).toBe(true); expect(b.retire(row.id)).toBe(true); }
    expect(a.physics.world.colliders.len()).toBe(baseline); expect(b.physics.world.colliders.len()).toBe(baseline);
    expect(snapshotSimHost(a).adapters.some(row => row.id.startsWith('runtime.actor.'))).toBe(false);
  } finally { a.dispose(); restored?.dispose(); }
});
