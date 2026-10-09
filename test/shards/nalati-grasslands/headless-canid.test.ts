import { expect, it } from 'vitest';
import { Rng } from '../../../src/engine/core/rng';
import { variantMods } from '../../../src/engine/entities/species/registry';
import { WOLF_SPECIES } from '../../../src/shards/nalati-grasslands/species/wolf';
import { KOKBORI_SPECIES } from '../../../src/shards/nalati-grasslands/species/kokbori';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { nalatiCanidSpec } from '../../../src/shards/nalati-grasslands/runtime/headlessCanid';

it('uses the actual shared canid build dimensions and shipping HP/mods for every wolf and Kokbori', () => {
  const bake = nalatiBake();
  for (const species of [WOLF_SPECIES, KOKBORI_SPECIES]) {
    const kind = species === WOLF_SPECIES ? 'wolf' : 'kokbori';
    for (const variant of species.variants) {
      const model = species.build(variant, new Rng(42));
      try {
        const native = nalatiCanidSpec(bake, kind, variant.id);
        expect(native.dims).toEqual(model.dims); expect(native.mods).toEqual(variantMods(species, variant));
        expect(native.label).toBe(variant.label); expect(native.hp).toBe(variant.hp ?? species.tuning?.hp);
        expect(native.kind).toBe(species.kind); expect(native.variant).toBe(variant.id); expect(native.aggressive).toBe(true);
        const captured = bake.actors.find(a => a.kind === kind && a.variant === variant.id);
        if (captured !== undefined) expect(native).toEqual(captured.spec);
      } finally { for (const part of [...model.furParts, ...model.hardParts, ...model.eyeParts]) part.dispose(); }
    }
  }
  expect(nalatiCanidSpec(bake, 'kokbori', 'kokbori').hp).toBe(650);
  const before = structuredClone(bake.actors[0]?.spec.dims), copy = nalatiCanidSpec(bake, 'wolf', 'dark');
  copy.dims.bodyY = 100;
  expect(bake.actors[0]?.spec.dims).toEqual(before);
  expect(() => nalatiCanidSpec(bake, 'wolf', 'invented')).toThrow('Missing authenticated');
  expect(() => nalatiCanidSpec({ ...bake, actors: [] }, 'wolf', 'grey')).toThrow('Missing authenticated');
});
