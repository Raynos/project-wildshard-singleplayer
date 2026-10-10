/**
 * Nine Dragon's code-built model geometry drawn from its offline bake (G285, SF72 "bake the code-built worlds"). Every
 * model whose geometry is a pure function of committed code — the stalls, the paifang, the banyan with its crown, the
 * shrine and the stele, the models drawn into the kits, the wall kit's pieces, the movers, the balustrade panel's far
 * copy — and the world's own canopy over the layout's plan are built at build time by `../generators/specimens.ts`
 * (`src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs`), keyed as the models key their geometry, in two binaries: what the page itself builds
 * at load (the movers, the wall kit, the in-kit models' boxes, the panel's far copy, the crown: `boot`, fetched with the
 * layout) and what only the Model Explorer's specimens draw (the stalls, the gates, the banyan …: `explorer`, fetched the
 * first time a specimen asks, world/modelLook.ts `withSpecimens`). Each model reads its geometry by key; its materials,
 * colliders and placement stay the model's.
 */
import type { BufferGeometry } from 'three';
import * as v from 'valibot';
import { type BakedGeometryRow, bakedGeometryBytes, readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import stamp from '../data/specimens.json' with { type: 'json' };

/** the two binaries: the page's own (listed in the world's files, ../manifest.ts) and the Explorer's */
export const SPECIMENS_URL = { boot: '/assets/nine-dragon/baked/specimens.bin', explorer: '/assets/nine-dragon/baked/specimens-explorer.bin' } as const;
export type SpecimenPart = keyof typeof SPECIMENS_URL;
const Stamp = v.strictObject({ bin: v.string(), bytes: v.number() });
/** the bakes' stamps: each inflated binary's hash and size (the stale gate, test/shards/nine-dragon-stack/specimens-bake.test.ts;
 *  read when a bake loads, so the generator that writes them can load the models) */
const StampsSchema = v.strictObject({ version: v.literal(1), boot: Stamp, explorer: Stamp });
export const specimensStamp = (): v.InferOutput<typeof StampsSchema> => v.parse(StampsSchema, stamp);

const finite = v.number();
const Geometry = v.strictObject({
  attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8'] as const), finite, v.boolean()])),
  count: finite, index: v.nullable(v.picklist(['u16', 'u32'] as const)), indexCount: finite, box: v.boolean(),
});
/** the bake's rows (the binary's JSON head): each geometry under the key its model reads it by, in bake order */
export const SpecimenRowsSchema = v.strictObject({ version: v.literal(1), entries: v.array(v.strictObject({ key: v.string(), geo: Geometry })) });
export type SpecimenRows = v.InferOutput<typeof SpecimenRowsSchema>;

/** A decoded binary: each entry's bytes kept on their own, a fresh geometry per read, by key. */
export class SpecimenBake {
  readonly rows: SpecimenRows;
  private readonly at = new Map<string, { row: BakedGeometryRow; bytes: Uint8Array }>();
  constructor(bytes: Uint8Array, part: SpecimenPart) {
    const expected = specimensStamp()[part].bytes;
    if (bytes.length !== expected) throw new Error(`[nine-dragon] the ${part} specimens bake holds ${String(bytes.length)} bytes, its stamp ${String(expected)}`);
    const jsonBytes = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + jsonBytes)));
    this.rows = v.parse(SpecimenRowsSchema, parsed);
    let offset = Math.ceil((4 + jsonBytes) / 4) * 4;
    for (const { key, geo } of this.rows.entries) {
      if (this.at.has(key)) throw new Error(`[nine-dragon] the specimens bake holds '${key}' twice`);
      const length = bakedGeometryBytes(geo);
      this.at.set(key, { row: geo, bytes: bytes.slice(offset, offset + length) });
      offset += length;
    }
    if (offset !== bytes.length) throw new Error('[nine-dragon] the specimens bake does not match its rows');
  }
  has(key: string): boolean { return this.at.has(key); }
  /** the geometry baked under `key` (a copy the caller owns); a key the bake lacks is a stale bake or a new variant */
  geometry(key: string): BufferGeometry {
    const entry = this.at.get(key);
    if (entry === undefined) throw new Error(`[nine-dragon] the specimens bake has no '${key}' (rebake: src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs)`);
    return readBakedGeometry(entry.bytes, 0, entry.row);
  }
  /** read `key` once and drop its bytes (what the page draws once: the crown) */
  take(key: string): BufferGeometry {
    const g = this.geometry(key);
    this.at.delete(key);
    return g;
  }
}

/** Fetch and inflate one of the bakes. The page's is mandatory, as the layout's: the builders are build-time code
 *  (../generators/). */
export async function loadSpecimens(part: SpecimenPart): Promise<SpecimenBake> {
  const url = SPECIMENS_URL[part];
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`[nine-dragon] the specimens bake did not load: ${String(response.status)} ${url}`);
  return new SpecimenBake(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()), part);
}
