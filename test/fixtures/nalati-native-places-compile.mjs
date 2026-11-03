// Reconstruct the same complete original source once per verified input/host key.
import { readFileSync } from 'node:fs';
import { nalatiPlacesProgram } from '../../src/shards/nalati-grasslands/generators/placesProgram.ts';
import { hashImmutableBytes } from '../../src/sdk/immutable.ts';
import pins from './nalati-place-wires.json' with { type: 'json' };

const inputs = new Map([
  ['/assets/baked/nalati-grasslands/terrain.bin', readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')],
]);
const files = await nalatiPlacesProgram({ cached: (_step, make) => Promise.resolve(make(inputs)) }, 'exact');
for (const name of ['places', 'specimens']) {
  const pin = pins.find(row => row.path === `public/assets/nalati/baked/${name}.bin`), bytes = files.get(`${name}.bin`);
  if (pin === undefined || bytes === undefined || bytes.byteLength !== pin.bytes || hashImmutableBytes(bytes) !== pin.hash)
    throw new Error(`Original native ${name} binary differs`);
}
process.stdout.write(`${JSON.stringify([...files].map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')]))}\n`);
