import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { setLowPoly } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, VariantDef } from '@wildshard/engine/entities/species/registry';
import { buildHorse } from './horseBody';
import { buildCanid } from './canidBody';
import { HORSE_SPECIES } from '../species/horse';
import { WOLF_SPECIES, SHEEPDOG_VARIANTS } from '../species/wolf';
import { KOKBORI_SPECIES } from '../species/kokbori';
import { GHOSTRIDER_SPECIES } from '../species/ghostRider';
import { argymaqDefinition } from '../combat/eliteRoster';
import { BODY_ATTRS, bodyKey, type BodyFamily, type BodyGeometryRow, type BodyRow, type BodyRows } from '../species/bodyKey';

/**
 * Build-time only (SHARD-PLATFORM M3, Nalati's species bodies bake): every horse-family and canid body the page can make,
 * built here by the lofts that `species/horse.ts` and `species/wolf.ts` used to run on the page (`horseBody.ts`,
 * `canidBody.ts`), in both loft resolutions (the painterly page's and a low-poly page's). A body depends on its variant's
 * `traits` and `tint` only (the builders read nothing else, and no rng), so each distinct pair is baked once under its
 * `bodyKey`. `scripts/bake-nalati-bodies.mjs` writes the binary (every geometry's channels and index as their own typed
 * bytes, in order, each block padded to whole words) and the rows (bones, dims, each geometry's counts and groups);
 * `species/bodies.ts` reads them back bit-exact. `test/shards/nalati-grasslands/bodies-bake.test.ts` is the stale gate.
 */

/** the variants the page can build per family: the rows', their spawn-only ones and the elites derived from them */
export function bodyVariants(): { family: BodyFamily; variant: VariantDef }[] {
  const horse = [...HORSE_SPECIES.variants, ...(HORSE_SPECIES.spawnOnly ?? []), ...GHOSTRIDER_SPECIES.variants];
  const stallion = HORSE_SPECIES.variants.find((v) => v.id === 'stallion'), black = HORSE_SPECIES.variants.find((v) => v.id === 'black');
  if (stallion === undefined || black === undefined) throw new Error('[nalati bodies] the horse rows lost their stallion / black');
  horse.push(...argymaqDefinition(HORSE_SPECIES, stallion).variants);
  // combat/elites.ts registerGhostHorse: Qara Batyr on the black horse when the ghost riders' own row is absent
  horse.push({ ...black, id: 'captain', traits: { ...black.traits, mane: 1.8 } });
  const canid = [...WOLF_SPECIES.variants, ...(WOLF_SPECIES.spawnOnly ?? []), ...SHEEPDOG_VARIANTS, ...KOKBORI_SPECIES.variants];
  return [...horse.map((variant) => ({ family: 'horse' as const, variant })), ...canid.map((variant) => ({ family: 'canid' as const, variant }))];
}

const BUILD: Readonly<Record<BodyFamily, (v: VariantDef, rng: Rng) => AnimalSpecies>> = { horse: buildHorse, canid: buildCanid };

/** one geometry: its row, and its blocks' bytes in order (each padded to whole words); refuses any other layout */
export function geometryRow(g: BufferGeometry, blocks: Uint8Array[]): BodyGeometryRow {
  const push = (array: Float32Array | Uint16Array): void => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), pad = (4 - (bytes.length % 4)) % 4;
    blocks.push(bytes.slice());
    if (pad > 0) blocks.push(new Uint8Array(pad));
  };
  const names = Object.keys(g.attributes);
  if (Object.keys(g.morphAttributes).length > 0 || names.join(',') !== BODY_ATTRS.map(([name]) => name).join(',')) throw new Error(`[nalati bodies] a body part's channels are ${names.join(',')}`);
  let vertices = -1;
  for (const [name, size] of BODY_ATTRS) {
    const a: BufferAttribute | InterleavedBufferAttribute = g.getAttribute(name);
    const array: unknown = 'array' in a ? a.array : null, u16 = name === 'skinIndex';
    if (!(array instanceof Float32Array || array instanceof Uint16Array) || array instanceof Uint16Array !== u16 || a.itemSize !== size || a.normalized
      || array.length !== a.count * size || (vertices >= 0 && a.count !== vertices)) throw new Error(`[nalati bodies] channel ${name} is not the lofts' layout`);
    vertices = a.count;
    push(array);
  }
  const index = g.index;
  if (index === null || !(index.array instanceof Uint16Array)) throw new Error('[nalati bodies] a body part is not u16-indexed');
  push(index.array);
  return [vertices, index.count, ...g.groups.flatMap((group) => [group.start, group.count, group.materialIndex ?? 0])];
}

/** The bake: every distinct body in both resolutions, the rows and the raw binary (not yet lane-shuffled or compressed). */
export function bakeNalatiBodies(): { rows: Omit<BodyRows, 'bin' | 'bytes'>; bin: Uint8Array } {
  const blocks: Uint8Array[] = [], bodies: BodyRow[] = [], seen = new Set<string>();
  for (const lowPoly of [false, true]) {
    for (const { family, variant } of bodyVariants()) {
      const key = bodyKey(family, variant, lowPoly);
      if (seen.has(key)) continue;
      seen.add(key);
      setLowPoly(lowPoly);
      let body: AnimalSpecies;
      try { body = BUILD[family](variant, new Rng(1)); } finally { setLowPoly(false); }
      if (body.map !== undefined || body.facetJitter !== undefined || body.selfLight !== undefined) throw new Error(`[nalati bodies] ${key} has a map / facet / self-light`);
      bodies.push({ key, bones: body.bones, dims: body.dims,
        fur: body.furParts.map((g) => geometryRow(g, blocks)), hard: body.hardParts.map((g) => geometryRow(g, blocks)), eye: body.eyeParts.map((g) => geometryRow(g, blocks)) });
    }
  }
  const length = blocks.reduce((n, b) => n + b.length, 0), bin = new Uint8Array(length);
  let at = 0;
  for (const b of blocks) { bin.set(b, at); at += b.length; }
  return { rows: { bodies }, bin };
}
