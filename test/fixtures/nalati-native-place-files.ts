// oxlint-disable-next-line import/no-nodejs-modules -- Supply the exact admitted native terrain/scalars to the source producer.
import { readFileSync } from 'node:fs';
import { nalatiPlacesProgram } from '../../src/shards/nalati-grasslands/generators/placesProgram';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import pins from './nalati-place-wires.json' with { type: 'json' };

const inputs = new Map<string, Uint8Array>([
  ['/assets/baked/nalati-grasslands/terrain.bin', readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')],
]);
const files = await nalatiPlacesProgram({ cached: (_step, make) => Promise.resolve(make(inputs)) });
for (const name of ['places', 'specimens']) {
  const pin = pins.find(row => row.path === `public/assets/nalati/baked/${name}.bin`), bytes = files.get(`${name}.bin`);
  if (pin === undefined || bytes === undefined || bytes.byteLength !== pin.bytes || hashImmutableBytes(bytes) !== pin.hash) {
    throw new Error(`Original native ${name} binary differs`);
  }
}

/** Source-owned files retain complete original binary pins; every caller receives detached bytes. */
export function nativePlaceFile(name: string): Uint8Array {
  const bytes = files.get(name);
  if (bytes === undefined) throw new Error(`Missing owned native place file ${name}`);
  return bytes.slice();
}
