import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import declared from '../data/publicInputs.json' with { type: 'json' };
import { GPU_FILES } from '../ktx2.generated';
import { PINE_HULLS } from './creatureHulls';
import { geometry, split, texture } from './glbParts.mjs';
import { bakeKingKit, type KingKitRows } from './kingKit';
import { emitNamedBlobs, nameBlob, nameMeshoptBlob, type BlobOptions, type EmittedBlobs, type NamedBlobKind, type NamedBlob } from '@wildshard/sdk/blobs';

/** One committed public input published as a product blob. */
export interface PublicBlob { readonly name: string; readonly kind: NamedBlobKind; readonly url: string; readonly options?: BlobOptions }

/** GR8: read committed public inputs through `ctx.cached` (their declared URLs are the step's inputs) and name each as
 *  the retired source declaration did: a GLB meshopt-packed as a `meshopt: true` source, anything else as read. */
export async function readPublicBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>, id: string, rows: readonly PublicBlob[]): Promise<NamedBlob[]> {
  const files = await ctx.cached({ id, inputs: rows.map(row => row.url) }, inputs => new Map(rows.map(row => {
    const bytes = inputs.get(row.url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine input ${row.url}`);
    return [row.name, bytes];
  })));
  if (files.size !== rows.length) throw new Error(`Pine ${id} input inventory differs`);
  const named: NamedBlob[] = [];
  for (const row of rows) {
    const bytes = files.get(row.name);
    if (bytes === undefined) throw new Error(`Missing cached Pine input ${row.name}`);
    named.push(row.kind === 'glb' ? await nameMeshoptBlob(row.name, bytes, row.options) : nameBlob(row.name, row.kind, bytes, row.options));
  }
  return named;
}

/** The thrall's extras, both tiers (the extras bake stays their geometry owner). */
export async function pineCreatureBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  // I2: each tier fetches only its own extras (PINE_HULL_BOOK names `thrall-extras[.phone].glb` per tier)
  const rows = declared.creatures.map(row => ({ name: row.name, kind: 'glb' as const, url: row.url, options: { tier: row.name.endsWith('.phone.glb') ? 'phone' as const : 'desktop' as const } }));
  return emitNamedBlobs(await readPublicBlobs(ctx, 'creature-inputs', rows));
}

/** Each rigged hull's raw GLB and its existing KTX2 twin (the bake the retired rigBlobs.mjs looked up in the KTX2 cache
 *  by its bytes; ktx2.generated.ts names the same twin by URL, both tiers). */
function rigInputs(): { name: string; raw: string; twin: string; tier: 'desktop' | 'phone' }[] {
  return (['desktop', 'phone'] as const).flatMap(tier => PINE_HULLS.rigs.map(hull => {
    const name = `${hull}${tier === 'phone' ? '.phone' : ''}`;
    const entry = Object.entries(GPU_FILES[tier]).find(([url]) => url.endsWith(`/creatures/${name}.rigged.glb`));
    if (entry === undefined) throw new Error(`Missing existing creature KTX2 bake: ${name}`);
    return { name, raw: entry[0], twin: entry[1], tier };
  }));
}

/** The rigged creatures: each hull's admitted geometry and its base and normal maps from the existing KTX2 bake. */
export async function pineRigBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const rigs = rigInputs();
  const files = await ctx.cached({ id: 'rig-inputs', inputs: rigs.flatMap(rig => [rig.raw, rig.twin]) }, inputs => new Map(rigs.flatMap(rig => {
    const raw = inputs.get(rig.raw), twin = inputs.get(rig.twin);
    if (raw === undefined || twin === undefined) throw new Error(`Missing declared Pine rig ${rig.name}`);
    return [[`${rig.name}.glb`, raw], [`${rig.name}.ktx2.glb`, twin]];
  })));
  const blobs: NamedBlob[] = [];
  for (const rig of rigs) {
    const raw = files.get(`${rig.name}.glb`), twin = files.get(`${rig.name}.ktx2.glb`);
    if (raw === undefined || twin === undefined) throw new Error(`Missing cached Pine rig ${rig.name}`);
    // I2: each tier fetches only its own rig (PINE_HULL_BOOK names `<hull>[.phone]` per tier), as its coat pages do
    const baked = split(twin), tier = { tier: rig.tier };
    blobs.push(nameBlob(`models/creatures/${rig.name}.base.ktx2`, 'ktx2', texture(baked, 'base'), tier),
      nameBlob(`models/creatures/${rig.name}.normal.ktx2`, 'ktx2', texture(baked, 'normal'), tier),
      await nameMeshoptBlob(`models/creatures/${rig.name}.rigged.glb`, geometry(split(raw)), tier));
  }
  return emitNamedBlobs(blobs);
}

/** The King kit pool's product name. */
const KING_KIT_NAME = 'models/king/kit.glb';
/** GR8: the Antler King's kit, baked from both tiers' rigs (read through `ctx.cached` by their declared URLs) as the
 *  retired bake-king-kit.mjs did; the pool is named and meshopt-packed as its `meshopt: true` source was. */
export async function pineKingKit(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<{ blob: NamedBlob; rows: KingKitRows }> {
  const rigs = declared.king;
  const files = await ctx.cached({ id: 'king-kit-rigs', inputs: [rigs.desktop, rigs.phone] }, inputs => {
    const desktop = inputs.get(rigs.desktop), phone = inputs.get(rigs.phone);
    if (desktop === undefined || phone === undefined) throw new Error('Missing declared Antler King rig');
    return new Map([['desktop.glb', desktop], ['phone.glb', phone]]);
  });
  const made = await bakeKingKit(tier => {
    const bytes = files.get(`${tier}.glb`);
    if (bytes === undefined) throw new Error(`Missing cached Antler King rig ${tier}`);
    return bytes;
  });
  return { blob: await nameMeshoptBlob(KING_KIT_NAME, made.glb), rows: { ...made.rows, pool: { ...made.rows.pool, url: KING_KIT_NAME } } };
}
