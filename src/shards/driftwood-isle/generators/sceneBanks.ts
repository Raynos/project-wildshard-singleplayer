import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, nameMeshoptBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { nameCompactBlob } from '@wildshard/sdk/bake/compactGlb';
import { DRIFTWOOD_FIXED_INPUTS, driftwoodFixedBytes, driftwoodFixedFiles } from './fixedProgram';
import { driftwoodCargoBank, type DriftwoodCargoBank } from './cargoBank';
import { driftwoodFixedLayouts, type DriftwoodFixedLayouts } from './fixedLayouts';
import { driftwoodRockBank, type DriftwoodRockBank } from './rockBank';
import { driftwoodNativeSpecimenBank, type DriftwoodNativeSpecimenBank } from './nativeSpecimenBank';
import { CREATURE_BODY_FILE, CREATURE_BODY_INPUTS, driftwoodCreatureBodyBank, type DriftwoodCreatureBodyBank } from './creatureBodyBank';
import { driftwoodIslandPlan } from './productPageFiles';
import { BLENDER_MODELS } from './blenderArea';
import { DRIFTWOOD_BANK_BLOBS } from './assets';
import { trailSpecimenBank } from './trailsideModels';
import { islandCoverBank } from './islandCoverBank';
import { entryDeckFiles } from './entryDeckSpecimen';
import { driftwoodIslandFacts, driftwoodIslandFactsFrom, type DriftwoodIslandFacts } from './islandFacts';

/**
 * GR7: the scene producers' rows and bytes, built once per build from owned inputs instead of read back from
 * `*.generated.json` job outputs. The product (prepareOutput), the map bake and the specimen catalogue each build one
 * bank and hand it to the readers (`siteCatalogue(banks)`, `worldScenes(banks)`, `worldPlacements(banks)`). Each producer
 * joins as its job retires.
 */
export interface DriftwoodSceneBanks {
  readonly cargo: DriftwoodCargoBank;
  readonly facts: DriftwoodIslandFacts;
  readonly layouts: DriftwoodFixedLayouts;
  readonly rocks: DriftwoodRockBank;
  readonly native: DriftwoodNativeSpecimenBank;
  readonly creatures: DriftwoodCreatureBodyBank;
  /** the streamed cover's transports and per-cell plants by product name (islandCoverBank) */
  readonly cover: ReadonlyMap<string, Uint8Array>;
}
/** The committed public files the banks read beside the fixed program's: the Blender island's placement table and
 *  metadata (the island plan's small rocks). */
export const DRIFTWOOD_SCENE_BANK_INPUTS: readonly string[] = [`${BLENDER_MODELS}placements.bin`, `${BLENDER_MODELS}island.json`, `${BLENDER_MODELS}island.glb`,
  CREATURE_BODY_INPUTS.head, CREATURE_BODY_INPUTS.captain];
/** The owned inputs every bank is built from, explicit so a bank never reads a copied file: the fixed program's files
 *  (`driftwoodFixedBytes`) and `DRIFTWOOD_SCENE_BANK_INPUTS` by URL. */
export interface DriftwoodSceneBankInputs {
  readonly fixed: ReadonlyMap<string, Uint8Array>;
  readonly layouts?: DriftwoodFixedLayouts;
  readonly facts?: DriftwoodIslandFacts;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

/** Build every bank from its owned inputs. */
export async function driftwoodSceneBanks(inputs: DriftwoodSceneBankInputs): Promise<DriftwoodSceneBanks> {
  const file = (url: string): Uint8Array => {
    const bytes = inputs.files.get(url); if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing Driftwood scene bank input: ${url}`);
    return bytes;
  };
  const facts = inputs.facts ?? await driftwoodIslandFactsFrom(file);
  const [table = '', metadata = ''] = DRIFTWOOD_SCENE_BANK_INPUTS;
  const plan = (tier: 'phone' | 'desktop'): ReturnType<typeof driftwoodIslandPlan> => driftwoodIslandPlan(file(table), file(metadata), tier, facts);
  const smallRocks = plan('phone').smallRocks;
  if (JSON.stringify(smallRocks) !== JSON.stringify(plan('desktop').smallRocks)) throw new Error('Small-rock tier placements differ');
  const layouts = inputs.layouts ?? driftwoodFixedLayouts(inputs.fixed);
  return { layouts, facts, cargo: await driftwoodCargoBank(inputs.fixed, layouts.wreck), rocks: driftwoodRockBank(smallRocks), native: await driftwoodNativeSpecimenBank(inputs.fixed), creatures: await driftwoodCreatureBodyBank(file), cover: await islandCoverBank(file, facts) };
}
/** The product build's banks: the fixed files and the public inputs come through the owned-byte cache. */
export async function driftwoodSceneBanksCached(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<DriftwoodSceneBanks> {
  // a cached file name is project-relative, so each public input is kept under its URL without the leading slash
  const cached = await ctx.cached({ id: 'driftwood-scene-bank-inputs', inputs: DRIFTWOOD_SCENE_BANK_INPUTS }, inputs =>
    new Map([...inputs].map(([url, bytes]) => [url.slice(1), bytes])));
  const files = new Map(DRIFTWOOD_SCENE_BANK_INPUTS.map(url => {
    const bytes = cached.get(url.slice(1));
    if (bytes === undefined) throw new Error(`Missing cached Driftwood scene bank input: ${url}`);
    return [url, bytes] as const;
  }));
  return driftwoodSceneBanks({ fixed: await driftwoodFixedFiles(ctx), files, facts: await driftwoodIslandFacts(ctx) });
}
/** A retained build driver's banks (the map bake, the specimen catalogue): the fixed program runs on its declared public
 *  inputs, which the driver reads (`read('/assets/…')`), as do the banks' own. */
export async function driftwoodSceneBanksFrom(read: (url: string) => Uint8Array, fixed?: ReadonlyMap<string, Uint8Array>): Promise<DriftwoodSceneBanks> {
  return driftwoodSceneBanks({ fixed: fixed ?? await driftwoodFixedBytes(new Map(DRIFTWOOD_FIXED_INPUTS.map(url => [url, read(url)]))),
    files: new Map(DRIFTWOOD_SCENE_BANK_INPUTS.map(url => [url, read(url)])) });
}
/** The banks' product files, named as their sources were: cargo's and the reef's GLBs as `meshopt: true` sources
 *  (assets.ts), the desktop rocks plain (they were SCENE_MODEL_BLOBS sources). */
export async function driftwoodSceneBankOutput(banks: DriftwoodSceneBanks): Promise<EmittedBlobs> {
  return emitNamedBlobs([...await Promise.all([...banks.cargo.glbs].map(([name, bytes]) => nameMeshoptBlob(name, bytes))),
    ...[...banks.rocks.glbs].map(([name, bytes]) => nameBlob(name, 'glb', bytes)),
    // the trail specimens' Explorer GLBs, as the product files their catalogue rows name (worldScenes)
    ...[...trailSpecimenBank().glbs].map(([name, bytes]) => nameBlob(name, 'glb', bytes)),
    // the cover's transports and cells, plain as their sources were
    ...[...banks.cover].map(([name, bytes]) => nameBlob(name, 'bin', bytes)),
    // the packed creature bodies the hull book names (look/hull-book's body.file)
    nameBlob(CREATURE_BODY_FILE, 'bin', banks.creatures.bin),
    // the entry road decks' raw specimen geometry (the specimen catalogue job wrote it under data/)
    ...entryDeckFiles().map(file => nameBlob(file.name, 'bin', file.bytes, { decoded: file.bytes.length, gpu: file.bytes.length })),
    // the synchronous banks' shipped blobs (the reef's), named as assets.ts names its sources: GLBs meshopt, the rest plain
    // (I3: the faceted ground and its slab in phone geometry, read back by the owned-geometry intake)
    ...await Promise.all(DRIFTWOOD_BANK_BLOBS.map(row => row.kind !== 'glb' ? Promise.resolve(nameBlob(row.name, row.kind, row.bytes))
      : row.name.startsWith('world/ground/') ? nameCompactBlob(row.name, row.bytes) : nameMeshoptBlob(row.name, row.bytes)))]);
}
