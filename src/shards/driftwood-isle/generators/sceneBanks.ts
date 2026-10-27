import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, nameMeshoptBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { DRIFTWOOD_FIXED_INPUTS, driftwoodFixedBytes, driftwoodFixedFiles } from './fixedProgram';
import { driftwoodCargoBank, type DriftwoodCargoBank } from './cargoBank';
import { driftwoodFixedLayouts, type DriftwoodFixedLayouts } from './fixedLayouts';
import { driftwoodRockBank, type DriftwoodRockBank } from './rockBank';
import { driftwoodIslandPlan } from './productPageFiles';
import { BLENDER_MODELS } from './blenderArea';
import { DRIFTWOOD_BANK_BLOBS } from './assets';

/**
 * GR7: the scene producers' rows and bytes, built once per build from owned inputs instead of read back from
 * `*.generated.json` job outputs. The product (prepareOutput), the map bake and the specimen catalogue each build one
 * bank and hand it to the readers (`siteCatalogue(banks)`, `worldScenes(banks)`, `worldPlacements(banks)`). Each producer
 * joins as its job retires.
 */
export interface DriftwoodSceneBanks {
  readonly cargo: DriftwoodCargoBank;
  readonly layouts: DriftwoodFixedLayouts;
  readonly rocks: DriftwoodRockBank;
}
/** The committed public files the banks read beside the fixed program's: the Blender island's placement table and
 *  metadata (the island plan's small rocks). */
export const DRIFTWOOD_SCENE_BANK_INPUTS: readonly string[] = [`${BLENDER_MODELS}placements.bin`, `${BLENDER_MODELS}island.json`];
/** The owned inputs every bank is built from, explicit so a bank never reads a copied file: the fixed program's files
 *  (`driftwoodFixedBytes`) and `DRIFTWOOD_SCENE_BANK_INPUTS` by URL. */
export interface DriftwoodSceneBankInputs {
  readonly fixed: ReadonlyMap<string, Uint8Array>;
  readonly layouts?: DriftwoodFixedLayouts;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

/** Build every bank from its owned inputs. */
export async function driftwoodSceneBanks(inputs: DriftwoodSceneBankInputs): Promise<DriftwoodSceneBanks> {
  const file = (url: string): Uint8Array => {
    const bytes = inputs.files.get(url); if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing Driftwood scene bank input: ${url}`);
    return bytes;
  };
  const [table = '', metadata = ''] = DRIFTWOOD_SCENE_BANK_INPUTS;
  const plan = (tier: 'phone' | 'desktop'): ReturnType<typeof driftwoodIslandPlan> => driftwoodIslandPlan(file(table), file(metadata), tier);
  const smallRocks = plan('phone').smallRocks;
  if (JSON.stringify(smallRocks) !== JSON.stringify(plan('desktop').smallRocks)) throw new Error('Small-rock tier placements differ');
  const layouts = inputs.layouts ?? driftwoodFixedLayouts(inputs.fixed);
  return { layouts, cargo: await driftwoodCargoBank(inputs.fixed, layouts.wreck), rocks: driftwoodRockBank(smallRocks) };
}
/** The product build's banks: the fixed files and the public inputs come through the owned-byte cache. */
export async function driftwoodSceneBanksCached(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<DriftwoodSceneBanks> {
  const files = await ctx.cached({ id: 'driftwood-scene-bank-inputs', inputs: DRIFTWOOD_SCENE_BANK_INPUTS }, inputs => new Map(inputs));
  return driftwoodSceneBanks({ fixed: await driftwoodFixedFiles(ctx), files });
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
    // the synchronous banks' shipped blobs (the reef's), named as assets.ts names its sources: GLBs meshopt, the rest plain
    ...await Promise.all(DRIFTWOOD_BANK_BLOBS.map(row => row.kind === 'glb' ? nameMeshoptBlob(row.name, row.bytes) : Promise.resolve(nameBlob(row.name, row.kind, row.bytes))))]);
}
