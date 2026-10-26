// oxlint-disable-next-line import/no-nodejs-modules -- Supply only the defining native terrain/scalar reads to the source-owned fixture.
import { readFileSync } from 'node:fs';
import { nativeNalatiDressingPlacements } from '../../src/shards/nalati-grasslands/generators/nativeDressingPlacements.mjs';

let prepared: Promise<ReadonlyMap<string, Uint8Array>> | undefined;

/** Reconstruct native authored rows without a generated handoff; each parse owns its entire mutable result. */
export async function nativeDressingRows(group: string): Promise<unknown> {
  prepared ??= nativeNalatiDressingPlacements(file => readFileSync(file));
  const files = await prepared, bytes = files.get(`dressing-${group}.json`);
  if (bytes === undefined) throw new Error(`Missing native dressing fixture: ${group}`);
  return JSON.parse(new TextDecoder().decode(bytes));
}
