// oxlint-disable-next-line import/no-nodejs-modules -- Compile the real fixture outside happy-dom in Node's native Response realm.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import { driftwoodGuestRows } from '../../src/shards/driftwood-isle/generators/guestPrograms';

const compiled = v.parse(v.array(v.tuple([v.string(), v.string()])), JSON.parse(execFileSync(process.execPath,
  ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'test/fixtures/driftwood-guest-compile.mjs'], { encoding: 'utf8', maxBuffer: 1 << 26 })));
if (new Set(compiled.map(([name]) => name)).size !== compiled.length) throw new Error('Duplicate native guest fixture file');
/** The same production builder/cache identity in Node; consumers retain every original byte/ABI guard. */
export const DRIFTWOOD_GUEST_FILES: ReadonlyMap<string, Uint8Array> = new Map(compiled.map(([name, bytes]) => [name, Uint8Array.from(Buffer.from(bytes, 'base64'))]));
export const DRIFTWOOD_GUEST_ROWS = driftwoodGuestRows(DRIFTWOOD_GUEST_FILES);
export const RETURN_PROGRAM = DRIFTWOOD_GUEST_ROWS.returnProgram;

export function driftwoodGuestFile(name: string): Uint8Array {
  const bytes = DRIFTWOOD_GUEST_FILES.get(name);
  if (bytes === undefined) throw new Error(`Missing owned guest fixture file: ${name}`);
  return bytes;
}
