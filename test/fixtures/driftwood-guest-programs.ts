import { readFileSync } from 'node:fs';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { driftwoodGuestFiles, driftwoodGuestRows } from '../../src/shards/driftwood-isle/generators/guestPrograms';

const source = 'src/shards/driftwood-isle/generators/guestPrograms.ts';
const context = createProjectGeneration('src/shards/driftwood-isle', hashImmutableBytes(new Uint8Array(readFileSync(source))), new Map());
/** The same native source cache as the product, keyed by owner source, authored inputs and complete compiler identity. */
export const DRIFTWOOD_GUEST_FILES = await driftwoodGuestFiles(context);
export const DRIFTWOOD_GUEST_ROWS = driftwoodGuestRows(DRIFTWOOD_GUEST_FILES);
export const RETURN_PROGRAM = DRIFTWOOD_GUEST_ROWS.returnProgram;

export function driftwoodGuestFile(name: string): Uint8Array {
  const bytes = DRIFTWOOD_GUEST_FILES.get(name);
  if (bytes === undefined) throw new Error(`Missing owned guest fixture file: ${name}`);
  return bytes;
}
