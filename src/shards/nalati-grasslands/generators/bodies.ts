import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSpecies, SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import { buildHorse } from './horseBody';
import { buildCanid } from './canidBody';
import { buildFelid } from './leopardBody';
import { buildEagle } from './eagleBody';
import { buildKing } from './goldenKingBody';
import { buildBalbal } from './balbalBody';
import { HORSE_SPECIES } from '../species/horse';
import { WOLF_SPECIES, SHEEPDOG_VARIANTS } from '../species/wolf';
import { KOKBORI_SPECIES } from '../species/kokbori';
import { GHOSTRIDER_SPECIES } from '../species/ghostRider';
import { LEOPARD_SPECIES } from '../species/leopard';
import { EAGLE_SPECIES } from '../species/eagle';
import { GOLDENKING_SPECIES } from '../species/goldenKing';
import { BALBAL_SPECIES } from '../species/balbal';
import { argymaqDefinition } from '../combat/eliteRoster';
import { BODY_ATTRS, bodyKey, type BodyFamily, type BodyGeometryRow, type BodyRow, type BodyRows } from '../species/bodyKey';

/** what a family's variant list needs of its species row */
type AnimalSpeciesRow = Pick<SpeciesDef, 'variants' | 'spawnOnly'>;

/**
 * Build-time only (SHARD-PLATFORM M3, Nalati's species bodies bake): every horse-family, canid, leopard, eagle, Golden King
 * and balbal body the page can make,
 * built here by the lofts that `species/horse.ts` and `species/wolf.ts` used to run on the page (`horseBody.ts`,
 * `canidBody.ts`), in the painterly page's loft resolution, the only one a page builds (`bodyKey`). A body depends on its variant's
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
  // the elites' and statues' own rigs after the horses and canids (the binary keeps its earlier bodies' bytes first)
  const own = (family: BodyFamily, species: AnimalSpeciesRow): { family: BodyFamily; variant: VariantDef }[] => [...species.variants, ...(species.spawnOnly ?? [])].map((variant) => ({ family, variant }));
  return [...horse.map((variant) => ({ family: 'horse' as const, variant })), ...canid.map((variant) => ({ family: 'canid' as const, variant })),
    ...own('leopard', LEOPARD_SPECIES), ...own('eagle', EAGLE_SPECIES), ...own('goldenKing', GOLDENKING_SPECIES), ...own('balbal', BALBAL_SPECIES)];
}

const BUILD: Readonly<Record<BodyFamily, (v: VariantDef, rng: Rng) => AnimalSpecies>> = {
  horse: buildHorse, canid: buildCanid, leopard: buildFelid, eagle: buildEagle, goldenKing: buildKing, balbal: buildBalbal,
};

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

/** One body: its family's lofts on the variant (painterly), its row, and its geometries' bytes appended to `blocks`. */
export function bakeBody(family: BodyFamily, variant: VariantDef, blocks: Uint8Array[]): BodyRow {
  const key = bodyKey(family, variant), body = BUILD[family](variant, new Rng(1));
  if (body.map !== undefined || body.facetJitter !== undefined || body.selfLight !== undefined) throw new Error(`[nalati bodies] ${key} has a map / facet / self-light`);
  return { key, bones: body.bones, dims: body.dims,
    fur: body.furParts.map((g) => geometryRow(g, blocks)), hard: body.hardParts.map((g) => geometryRow(g, blocks)), eye: body.eyeParts.map((g) => geometryRow(g, blocks)) };
}

/** every distinct body the page can make, once each, in the bake's order */
export function distinctBodies(): { family: BodyFamily; variant: VariantDef }[] {
  const seen = new Set<string>();
  return bodyVariants().filter(({ family, variant }) => { const key = bodyKey(family, variant); if (seen.has(key)) return false; seen.add(key); return true; });
}

/** The bake: every distinct body, the rows and the raw binary (not yet lane-shuffled or compressed). */
export function bakeNalatiBodies(): { rows: Omit<BodyRows, 'bin' | 'bytes'>; bin: Uint8Array } {
  const blocks: Uint8Array[] = [], bodies = distinctBodies().map(({ family, variant }) => bakeBody(family, variant, blocks));
  const length = blocks.reduce((n, b) => n + b.length, 0), bin = new Uint8Array(length);
  let at = 0;
  for (const b of blocks) { bin.set(b, at); at += b.length; }
  return { rows: { bodies }, bin };
}
