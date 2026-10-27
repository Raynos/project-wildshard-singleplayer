import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import declared from '../data/publicInputs.json' with { type: 'json' };
import { bakeNpcSkin, type BakedNpcSkin } from './npcSkin';

/** The three people's kinds, in the retired bake's order. */
const KINDS = ['ranger', 'trader', 'miller'] as const;
/** One tier's baked skin row: its source GLB (the appearance it borrows), the product name of its skin and its metadata. */
export type PineNpcSkin = { material: string; url: string } & BakedNpcSkin['metadata'];
/** Every kind's baked skins by tier. */
export type PineNpcSkins = Record<(typeof KINDS)[number], { desktop: PineNpcSkin; phone: PineNpcSkin }>;

/** GR8: the people's skins, as the retired bake-npcs.mjs made them: each kind's source GLB per tier (read through
 *  `ctx.cached` by its declared URL) rigged by `bakeNpcSkin` and named as a product file the figure catalogue names
 *  (`people/<kind>-skin[.phone].glb`; the game resolves the name through the product). */
export async function pineNpcSkins(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<{ rows: PineNpcSkins; files: EmittedBlobs }> {
  const sources = KINDS.flatMap(kind => (['desktop', 'phone'] as const).map(tier => ({ kind, tier, url: declared.npcs[kind][tier] })));
  const files = await ctx.cached({ id: 'npc-sources', inputs: sources.map(row => row.url) }, read => new Map(sources.map(row => {
    const bytes = read.get(row.url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine person ${row.url}`);
    return [`${row.kind}.${row.tier}.glb`, bytes];
  })));
  const blobs = [], rows: Partial<Record<(typeof KINDS)[number], Partial<Record<'desktop' | 'phone', PineNpcSkin>>>> = {};
  for (const { kind, tier, url } of sources) {
    const bytes = files.get(`${kind}.${tier}.glb`);
    if (bytes === undefined) throw new Error(`Missing cached Pine person ${kind} ${tier}`);
    const made = await bakeNpcSkin(bytes, { id: `pine.${kind}`, lantern: kind === 'ranger' });
    const name = `people/${kind}-skin${tier === 'phone' ? '.phone' : ''}.glb`;
    // D82: each tier's skin is that tier's download only (the other tier's catalogue row names its own)
    blobs.push(nameBlob(name, 'glb', made.glb, { tier, variantOf: `people/${kind}` }));
    (rows[kind] ??= {})[tier] = { material: url, url: name, ...made.metadata };
    made.geometry.dispose();
  }
  const complete = (kind: (typeof KINDS)[number]) => {
    const row = rows[kind], desktop = row?.desktop, phone = row?.phone;
    if (desktop === undefined || phone === undefined) throw new Error(`Missing baked Pine person ${kind}`);
    return { desktop, phone };
  };
  return { rows: { ranger: complete('ranger'), trader: complete('trader'), miller: complete('miller') }, files: emitNamedBlobs(blobs) };
}
