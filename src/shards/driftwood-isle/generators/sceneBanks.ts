import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameMeshoptBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { DRIFTWOOD_FIXED_INPUTS, driftwoodFixedBytes, driftwoodFixedFiles } from './fixedProgram';
import { driftwoodCargoBank, type DriftwoodCargoBank } from './cargoBank';

/**
 * GR7: the scene producers' rows and bytes, built once per build from owned inputs instead of read back from
 * `*.generated.json` job outputs. The product (prepareOutput), the map bake and the specimen catalogue each build one
 * bank and hand it to the readers (`siteCatalogue(banks)`, `worldScenes(banks)`). Each producer joins as its job retires.
 */
export interface DriftwoodSceneBanks {
  readonly cargo: DriftwoodCargoBank;
}
/** The owned inputs every bank is built from: the fixed program's files (`driftwoodFixedBytes`), explicit so a bank
 *  never reads a copied file. */
export interface DriftwoodSceneBankInputs {
  readonly fixed: ReadonlyMap<string, Uint8Array>;
}

/** Build every bank from its owned inputs. */
export async function driftwoodSceneBanks(inputs: DriftwoodSceneBankInputs): Promise<DriftwoodSceneBanks> {
  return { cargo: await driftwoodCargoBank(inputs.fixed) };
}
/** The product build's banks: the fixed files come through the owned-byte cache. */
export async function driftwoodSceneBanksCached(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<DriftwoodSceneBanks> {
  return driftwoodSceneBanks({ fixed: await driftwoodFixedFiles(ctx) });
}
/** A retained build driver's banks (the map bake, the specimen catalogue): the fixed program runs on its declared public
 *  inputs, which the driver reads (`read('/assets/…')`). */
export async function driftwoodSceneBanksFrom(read: (url: string) => Uint8Array): Promise<DriftwoodSceneBanks> {
  return driftwoodSceneBanks({ fixed: await driftwoodFixedBytes(new Map(DRIFTWOOD_FIXED_INPUTS.map(url => [url, read(url)]))) });
}
/** The banks' product files: each GLB named the way a `meshopt: true` blob source is (assets.ts's GLB sources). */
export async function driftwoodSceneBankOutput(banks: DriftwoodSceneBanks): Promise<EmittedBlobs> {
  return emitNamedBlobs(await Promise.all([...banks.cargo.glbs].map(([name, bytes]) => nameMeshoptBlob(name, bytes))));
}
