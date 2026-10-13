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
import stamp from '../data/specimens.json' with { type: 'json' };

/** Boot geometry is mandatory; Explorer library geometry is read on its first specimen request. */
export type SpecimenPart = 'boot' | 'explorer';
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

/** Keyed standard GLB geometries, with original typed channels and index. */
export class SpecimenBake {
  constructor(private readonly entries: Map<string, BufferGeometry>) {}
  has(key: string): boolean { return this.entries.has(key); }
  geometry(key: string): BufferGeometry {
    const geometry = this.entries.get(key);
    if (geometry === undefined) throw new Error(`[nine-dragon] no specimen ${key}`);
    return geometry.clone();
  }
  take(key: string): BufferGeometry {
    const geometry = this.entries.get(key);
    if (geometry === undefined) throw new Error(`[nine-dragon] no specimen ${key}`);
    this.entries.delete(key); return geometry;
  }
}

/** Read standard declared GLBs through the shared exact whole-geometry assembler, with `pause` between its meshes. */
export async function loadSpecimens(part: SpecimenPart, pause?: () => Promise<void>): Promise<SpecimenBake> {
  const { readNineSpecimens } = await import('../runtime/geometry');
  return readNineSpecimens(part, pause);
}
