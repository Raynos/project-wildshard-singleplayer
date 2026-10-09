import { describe, expect, it } from 'vitest';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { speciesDef, rollVariant, type AnimalSpecies } from '../../src/engine/entities/species/registry';
import { Rng } from '../../src/engine/core/rng';
import { setLowPoly } from '../../src/engine/entities/species/loft';
import { SpeciesService, speciesWithLook } from '../../src/engine/entities/species/look';
import { Scope } from '../../src/engine/app/scope';
import { BOAR } from '../../src/kit/species/boar';
import { BEAR } from '../../src/kit/species/bear';
import { BOAR_LOOK } from '../../src/game/systems/species/view/boar';
import { BEAR_LOOK } from '../../src/game/systems/species/view/bear';
import { PINE_BOAR, PINE_BEAR } from '../../src/shards/pine-hollow/species/rows';
import { ISLAND_BOAR, ISLAND_BOARS } from '../../src/shards/driftwood-isle/creatures/species';

function fingerprint(model: AnimalSpecies): string {
  let hash = 2166136261;
  const feed = (bytes: Uint8Array): void => { for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619); };
  const text = (value: string): void => { feed(new TextEncoder().encode(value)); };
  text(JSON.stringify({ bones: model.bones, dims: model.dims }));
  for (const geometry of [...model.furParts, ...model.hardParts, ...model.eyeParts]) {
    for (const name of Object.keys(geometry.attributes).sort()) {
      const attr = geometry.getAttribute(name);
      text(name); feed(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
    }
    const index = geometry.getIndex();
    if (index) feed(new Uint8Array(index.array.buffer, index.array.byteOffset, index.array.byteLength));
    geometry.dispose();
  }
  return (hash >>> 0).toString(16);
}

describe('shared hunting rows and authored children', () => {
  it('keeps all gameplay fields and all 512 weighted draws for the two families', () => {
    expect(AnimalFactory).toBeDefined();
    for (const [row, look] of [[PINE_BOAR, BOAR_LOOK], [PINE_BEAR, BEAR_LOOK]] as const) {
      const old = speciesDef(row.kind), next = speciesWithLook(row, look);
      const oldRng = new Rng(1337), nextRng = new Rng(1337);
      for (let i = 0; i < 512; i++) expect(rollVariant(next, nextRng).id).toBe(rollVariant(old, oldRng).id);
      expect(nextRng.next()).toBe(oldRng.next());
      for (const key of ['aggressive', 'walkSpeed', 'chargeSpeed', 'chargeDamage', 'sounds'] as const) expect(next[key]).toEqual(old[key]);
      expect(row.variants.map(({ id, hp, mods }) => ({ id, hp, mods }))).toEqual(old.variants.map(({ id, hp, mods }) => ({ id, hp, mods })));
    }
  });
  it('keeps every procedural vertex, colour, skin weight, bone and hit dimension on both looks', () => {
    const records: Record<string, string> = {};
    for (const low of [false, true]) {
      setLowPoly(low);
      try {
        for (const kind of ['boar', 'bear']) {
          const old = speciesDef(kind);
          for (const variant of [...old.variants, ...(old.spawnOnly ?? [])]) {
            records[`${kind}:${variant.id}:${low ? 'toon' : 'pbr'}`] = fingerprint(old.build(variant, new Rng(1337)));
          }
        }
      } finally { setLowPoly(false); }
    }
    expect(records).toMatchSnapshot('pre-split procedural geometry');
  });
  it('keeps the island sensing patch, variant selection and Pine spawn-only thrall separate', () => {
    expect(ISLAND_BOAR.parent).toBe(BOAR);
    expect(ISLAND_BOAR.tuning).toMatchObject({ sightRange: 42, hearWalk: 18, noticeRate: 0.65, panicDist: 10 });
    expect(ISLAND_BOARS).toEqual(['boar', 'sow', 'black', 'big']);
    expect(PINE_BOAR.parent).toBe(BOAR); expect(PINE_BEAR.parent).toBe(BEAR);
    expect(BOAR.spawnOnly).toBeUndefined();
    expect(PINE_BOAR.spawnOnly).toEqual([{ id: 'thrall', label: 'Thrall', weight: 1, rarity: 'rare', scale: [1.1, 1.2], hp: 140, mods: { chargeDist: 1.4 } }]);
    for (const row of [BOAR, BEAR, PINE_BOAR, PINE_BEAR, ISLAND_BOAR]) {
      expect(row).not.toHaveProperty('build'); expect(row).not.toHaveProperty('fur');
      for (const variant of row.variants) { expect(variant).not.toHaveProperty('traits'); expect(variant).not.toHaveProperty('tint'); }
    }
  });
  it('resolves independent resident looks, reuses adapters and forgets disposed child overrides', () => {
    const root = new Scope('engine'), pine = root.child('pine'), island = root.child('island');
    let active: Scope | null = pine;
    const catalog = new SpeciesService(() => active);
    catalog.registerRow(ISLAND_BOAR, island);
    active = island;
    expect(catalog.get('boar')?.tuning?.sightRange).toBe(42);
    active = pine;
    catalog.registerRow(PINE_BOAR, pine); catalog.registerLook(BOAR_LOOK, pine);
    catalog.registerLook(BOAR_LOOK, island);
    const first = catalog.get('boar'); expect(first?.tuning?.sightRange).toBe(22);
    expect(catalog.get('boar')).toBe(first);
    active = island; expect(catalog.get('boar')?.tuning?.sightRange).toBe(42);
    const child = island.child('copy');
    catalog.registerRow({ ...ISLAND_BOAR, id: 'copy', chargeDamage: 99 }, child);
    expect(catalog.get('boar')?.chargeDamage).toBe(99);
    child.dispose(); expect(catalog.get('boar')?.chargeDamage).toBe(25);
    island.dispose(); active = pine; expect(catalog.get('boar')?.chargeDamage).toBe(25);
    pine.dispose(); expect(catalog.get('boar')).toBeUndefined(); active = null;
    expect(catalog.preloads()).toEqual([]); root.dispose();
  });
  it('offers procedural fallback only for the active resident model hull and removes it on disposal', () => {
    const root = new Scope('engine'), first = root.child('first'), second = root.child('second');
    let active: Scope | null = first;
    const catalog = new SpeciesService(() => active);
    catalog.registerLook(BOAR_LOOK, first);
    expect(catalog.hasProceduralFallback()).toBe(false);
    catalog.registerLook({ ...BOAR_LOOK, id: 'hull.boar', skin: () => null }, second);
    expect(catalog.hasProceduralFallback()).toBe(false);
    active = second; expect(catalog.hasProceduralFallback()).toBe(true);
    second.dispose(); expect(catalog.hasProceduralFallback()).toBe(false);
    active = null; expect(catalog.hasProceduralFallback()).toBe(false);
    root.dispose();
  });

});
