import { BufferAttribute, BufferGeometry } from 'three';
import { isLowPoly } from '@wildshard/engine/entities/species/loft';
import type { AnimalDims, AnimalSpecies, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import rowsJson from '../data/bodies.json' with { type: 'json' };
import { BODY_ATTRS, NALATI_BODIES_URL, bodyKey, type BodyFamily, type BodyGeometryRow, type BodyRow, type BodyRows } from './bodyKey';

/**
 * Nalati's species bodies, baked offline (SHARD-PLATFORM M3): the horse-family and canid lofts are built at bake time by
 * `generators/bodies.ts` (`scripts/bake-nalati-bodies.mjs` → `public/assets/nalati/baked/bodies.bin` + `data/bodies.json`)
 * and the page only reads them back: fetched once behind the loading screen (the species looks' `preload`, which the
 * factory awaits before the first herd), each `build()` then decodes its variant's parts as fresh geometry, bit-exact to
 * what the lofts made (every attribute's own typed bytes, the index, the draw groups, the bones and dims as JSON doubles).
 * A body that was never loaded is a page fault (`nalatiBody` throws, naming the key).
 */
const tuple3 = (p: readonly number[]): [number, number, number] => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
/** The rows as their types: the bones' and feet's JSON arrays as the tuples the lofts made. */
export const NALATI_BODY_ROWS: BodyRows = {
  bin: rowsJson.bin, bytes: rowsJson.bytes,
  bodies: rowsJson.bodies.map((b) => ({ key: b.key, bones: b.bones.map((x) => ({ name: x.name, parent: x.parent, pos: tuple3(x.pos) })),
    dims: { ...b.dims, feet: b.dims.feet.map((f): [number, number] => [f[0] ?? 0, f[1] ?? 0]) }, fur: b.fur, hard: b.hard, eye: b.eye })),
};

let bytes: Uint8Array | null = null;
let offsets: Map<string, { row: BodyRow; at: number }> | null = null;
let loading: Promise<void> | null = null;

/** The binary from its shipped lanes (every 4-byte word's first bytes, then its second …), as the bake wrote them. */
export function unshuffleBodyLanes(lanes: Uint8Array): Uint8Array {
  if (lanes.length % 4 !== 0) throw new Error('[nalati-grasslands] the bodies bake is not whole words');
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}

const pad4 = (n: number): number => n + ((4 - (n % 4)) % 4);
/** a geometry's bytes in the binary: each channel (u16 joints, f32 the rest), then its u16 index */
const geometryBytes = (g: BodyGeometryRow): number => {
  const vertices = g[0] ?? 0, indices = g[1] ?? 0;
  return BODY_ATTRS.reduce((sum, [name, size]) => sum + pad4((name === 'skinIndex' ? 2 : 4) * vertices * size), 0) + pad4(2 * indices);
};

/** Hand the bake's raw binary (inflated, lanes put back) to the page; a test passes the committed file's. */
export function useNalatiBodies(raw: Uint8Array): void {
  if (raw.length !== NALATI_BODY_ROWS.bytes) throw new Error(`[nalati-grasslands] the bodies bake holds ${String(raw.length)} bytes, its rows ${String(NALATI_BODY_ROWS.bytes)}`);
  const map = new Map<string, { row: BodyRow; at: number }>();
  let at = 0;
  for (const row of NALATI_BODY_ROWS.bodies) {
    map.set(row.key, { row, at });
    for (const g of [...row.fur, ...row.hard, ...row.eye]) at += geometryBytes(g);
  }
  if (at !== raw.length) throw new Error('[nalati-grasslands] the bodies rows do not cover the bake');
  bytes = raw; offsets = map; loading = Promise.resolve();
}

let provider: (() => Uint8Array) | null = null;
/** Read the bake's raw binary only when a body is first asked for (a Node test setup: most test files never build one). */
export function provideNalatiBodies(read: () => Uint8Array): void { provider = read; }

/** Fetch, inflate and read the bake once (the species looks' preload). A failed load is a console.error page fault. */
export function preloadNalatiBodies(): Promise<void> {
  loading ??= (async (): Promise<void> => {
    try {
      const response = await fetch(NALATI_BODIES_URL);
      if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${NALATI_BODIES_URL}`);
      const lanes = new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      useNalatiBodies(unshuffleBodyLanes(lanes));
    } catch (error: unknown) { console.error('[nalati-grasslands] the baked species bodies did not load:', error); }
  })();
  return loading;
}

/** whether the bake has been read */
export const nalatiBodiesLoaded = (): boolean => bytes !== null;

/** one baked geometry from `at`: its channels in order, its index, its groups */
function geometry(src: Uint8Array, row: BodyGeometryRow, start: number): { g: BufferGeometry; end: number } {
  const g = new BufferGeometry(), vertices = row[0] ?? 0, indices = row[1] ?? 0;
  let at = start;
  for (const [name, size] of BODY_ATTRS) {
    const n = vertices * size, copy = name === 'skinIndex' ? src.slice(at, at + 2 * n).buffer : src.slice(at, at + 4 * n).buffer;
    g.setAttribute(name, new BufferAttribute(name === 'skinIndex' ? new Uint16Array(copy) : new Float32Array(copy), size));
    at += pad4((name === 'skinIndex' ? 2 : 4) * n);
  }
  g.setIndex(new BufferAttribute(new Uint16Array(src.slice(at, at + 2 * indices).buffer), 1));
  at += pad4(2 * indices);
  for (let i = 2; i + 2 < row.length; i += 3) g.addGroup(row[i] ?? 0, row[i + 1] ?? 0, row[i + 2] ?? 0);
  return { g, end: at };
}

const bone = (b: BoneDef): BoneDef => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] });
const dimsOf = (d: AnimalDims): AnimalDims => ({ ...d, feet: d.feet.map((f): [number, number] => [f[0], f[1]]) });

/** A variant's baked body, as its family's lofts built it (for the page's current loft resolution). */
export function nalatiBody(family: BodyFamily, v: VariantDef): AnimalSpecies {
  if (bytes === null && provider !== null) { const read = provider; provider = null; useNalatiBodies(read()); }
  const key = bodyKey(family, v, isLowPoly()), src = bytes, hit = offsets?.get(key);
  if (src === null) throw new Error(`[nalati-grasslands] the baked species bodies are not loaded (${key})`);
  if (hit === undefined) throw new Error(`[nalati-grasslands] no baked body for ${key}`);
  let at = hit.at;
  const parts = (rows: readonly BodyGeometryRow[]): BufferGeometry[] => rows.map((row) => { const { g, end } = geometry(src, row, at); at = end; return g; });
  const furParts = parts(hit.row.fur), hardParts = parts(hit.row.hard), eyeParts = parts(hit.row.eye);
  return { bones: hit.row.bones.map(bone), furParts, hardParts, eyeParts, dims: dimsOf(hit.row.dims) };
}
