// oxlint-disable-next-line import/no-nodejs-modules -- The fixture reads the fixed program's committed public inputs.
import { readFileSync } from 'node:fs';
import { driftwoodSceneBanksFrom, type DriftwoodSceneBanks } from '../../src/shards/driftwood-isle/generators/sceneBanks';

let banks: Promise<DriftwoodSceneBanks> | undefined;
/** Driftwood's scene banks built from their owned inputs, as the product build builds them (GR7), once per test file. */
export function driftwoodSceneBanks(): Promise<DriftwoodSceneBanks> {
  banks ??= driftwoodSceneBanksFrom(url => new Uint8Array(readFileSync(`public${url}`)));
  return banks;
}
