import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { BLENDER_MODELS } from './blenderArea';
import { OCEAN_FILES } from './oceanFiles';
import { driftwoodOceanBank, type DriftwoodOceanBank } from './oceanBank';
import { bakeIslandPlan, islandPlacements } from './islandCover';

type Kind = 'glb' | 'bin' | 'image';
/** iPhone downloads I8: the sea (clientSections.ts) and the spawn cove (bakedCove.ts) read these as product files, so they
 *  are cached, tier-selected and prefetched with the product instead of fetched as page assets. Each logical name maps
 *  its exact public build output; the bytes are copied unchanged. */
export const DRIFTWOOD_PAGE_FILES: Readonly<Record<string, { readonly url: string; readonly kind: Kind }>> = {
  'world/island/island.glb': { url: `${BLENDER_MODELS}island.glb`, kind: 'glb' },
  'world/island/placements.bin': { url: `${BLENDER_MODELS}placements.bin`, kind: 'bin' },
  'world/island/lm-ao.phone.webp': { url: `${BLENDER_MODELS}lm-ao.phone.webp`, kind: 'image' },
  'world/island/lm-bounce.phone.webp': { url: `${BLENDER_MODELS}lm-bounce.phone.webp`, kind: 'image' },
  'world/island/lm-ao.webp': { url: `${BLENDER_MODELS}lm-ao.webp`, kind: 'image' },
  'world/island/lm-bounce.webp': { url: `${BLENDER_MODELS}lm-bounce.webp`, kind: 'image' },
  'world/ocean/phone.glb': { url: OCEAN_FILES.phone, kind: 'glb' },
  'world/ocean/desktop.glb': { url: OCEAN_FILES.desktop, kind: 'glb' },
  'world/ocean/floor.bin': { url: OCEAN_FILES.floor, kind: 'bin' },
};
/** I8.5: the cove's per-tier placement plans, compiled here from the placement table and the island metadata exactly as
 *  the dressing producer compiles its public copies (the build may not import that generated table). */
export const DRIFTWOOD_PLAN_FILES = { phone: 'world/island/plan-phone.json', desktop: 'world/island/plan-desktop.json' } as const;
const ISLAND_META = `${BLENDER_MODELS}island.json`, TABLE = DRIFTWOOD_PAGE_FILES['world/island/placements.bin']?.url ?? '';
type IslandPlanMeta = Parameters<typeof bakeIslandPlan>[1];
const finite = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid island metadata number'); return value; };
const rows = (value: unknown): readonly Record<string, unknown>[] => {
  if (!Array.isArray(value)) throw new Error('Invalid island metadata list');
  return value.map((row: unknown) => { if (typeof row !== 'object' || row === null) throw new Error('Invalid island metadata row'); return Object.fromEntries(Object.entries(row)); });
};
/** island.json's plan fields (protos, mustDraw, colliders), checked: the build reads them from a public Blender output. */
function islandPlanMeta(input: unknown): IslandPlanMeta {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid island metadata');
  const meta = Object.fromEntries(Object.entries(input));
  return {
    protos: rows(meta['protos']).map(row => { const { name, kind } = row; if (typeof name !== 'string' || typeof kind !== 'string') throw new Error('Invalid island prototype'); return { name, kind }; }),
    mustDraw: finite(meta['mustDraw']),
    colliders: rows(meta['colliders']).map(row => ({ x: finite(row['x']), z: finite(row['z']), hw: finite(row['hw']), hd: finite(row['hd']), rot: finite(row['rot']),
      yTop: finite(row['yTop']), yBottom: finite(row['yBottom']) })),
  };
}
/** GR7: the sea's page files come from the ocean bank (built in memory), not from the retired job's public copies */
const OCEAN_PAGE: Readonly<Record<string, keyof DriftwoodOceanBank['files']>> = { 'world/ocean/phone.glb': 'phone', 'world/ocean/desktop.glb': 'desktop', 'world/ocean/floor.bin': 'floor' };
const NAMES = Object.keys(DRIFTWOOD_PAGE_FILES), PUBLIC = NAMES.filter(name => OCEAN_PAGE[name] === undefined);
const INPUTS = [...PUBLIC.map(name => DRIFTWOOD_PAGE_FILES[name]?.url ?? ''), ISLAND_META];

/** A declared page file's product name; refuses a name this table does not own. */
export function pageFile(name: string): { readonly file: string } {
  if (DRIFTWOOD_PAGE_FILES[name] === undefined && !Object.values<string>(DRIFTWOOD_PLAN_FILES).includes(name)) throw new Error(`Undeclared Driftwood page file: ${name}`);
  return { file: name };
}

/** The tier's compiled placement plan bytes (the dressing producer's `island-plan-<hash>.json`). */
export function driftwoodPlanBytes(table: Uint8Array, metadata: Uint8Array, tier: 'phone' | 'desktop'): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(driftwoodIslandPlan(table, metadata, tier)));
}
/** The tier's compiled placement plan (`driftwoodPlanBytes` before encoding). */
export function driftwoodIslandPlan(table: Uint8Array, metadata: Uint8Array, tier: 'phone' | 'desktop'): ReturnType<typeof bakeIslandPlan> {
  const meta = islandPlanMeta(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata)));
  return bakeIslandPlan(islandPlacements(Uint8Array.from(table).buffer), meta, tier === 'phone');
}

/** The exact public bytes under their product names, through the build's owned-byte cache (no file under src). */
export async function driftwoodPageFileOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await ctx.cached({ id: 'driftwood-page-files', inputs: INPUTS }, inputs => {
    const read = (url: string, name: string): Uint8Array => {
      const bytes = inputs.get(url);
      if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing Driftwood page file: ${name}`);
      return bytes;
    };
    const table = read(TABLE, 'placements'), metadata = read(ISLAND_META, 'island metadata');
    return new Map([...PUBLIC.map(name => [name, read(DRIFTWOOD_PAGE_FILES[name]?.url ?? '', name)] as const),
      ...(['phone', 'desktop'] as const).map(tier => [DRIFTWOOD_PLAN_FILES[tier], driftwoodPlanBytes(table, metadata, tier)] as const)]);
  });
  const ocean = driftwoodOceanBank().files;
  return emitNamedBlobs([...NAMES, ...Object.values(DRIFTWOOD_PLAN_FILES)].map(name => {
    const banked = OCEAN_PAGE[name], bytes = banked === undefined ? files.get(name) : ocean[banked];
    if (bytes === undefined) throw new Error('Driftwood page file cache inventory differs');
    return nameBlob(name, DRIFTWOOD_PAGE_FILES[name]?.kind ?? 'json', bytes);
  }));
}
