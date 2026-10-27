// oxlint-disable-next-line import/no-nodejs-modules -- The fixture reads the fixed program's committed public inputs.
import { readFileSync } from 'node:fs';
import { driftwoodSceneBanksFrom, type DriftwoodSceneBanks } from '../../src/shards/driftwood-isle/generators/sceneBanks';
import { DRIFTWOOD_FIXED_INPUTS, driftwoodFixedBytes } from '../../src/shards/driftwood-isle/generators/fixedProgram';

const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
let fixed: Promise<Map<string, Uint8Array>> | undefined, banks: Promise<DriftwoodSceneBanks> | undefined;
/** The fixed program's files (the native, cargo and scene sources the product ships), built once per test file. */
export function driftwoodFixedFiles(): Promise<Map<string, Uint8Array>> {
  fixed ??= driftwoodFixedBytes(new Map(DRIFTWOOD_FIXED_INPUTS.map(url => [url, read(url)])));
  return fixed;
}
/** Driftwood's scene banks built from their owned inputs, as the product build builds them (GR7), once per test file. */
export function driftwoodSceneBanks(): Promise<DriftwoodSceneBanks> {
  banks ??= driftwoodFixedFiles().then(files => driftwoodSceneBanksFrom(read, files));
  return banks;
}
