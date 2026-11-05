import * as v from 'valibot';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { nativeProgramFixture } from './native-program';
import pins from './nalati-place-wires.json' with { type: 'json' };

// Share construction only: every source byte and the complete compiler output
// remain fenced, and the original native binary pins still admit every loan.
const rows = v.parse(v.array(v.tuple([v.string(), v.string()])), JSON.parse(await nativeProgramFixture({
  id: 'nalati-native-places', script: 'test/fixtures/nalati-native-places-compile.mjs',
  loader: 'simulation', transformTypes: true,
  inputs: ['src/engine', 'src/game', 'src/sdk', 'src/commons', 'src/shards/nalati-grasslands',
    'public/assets/baked/nalati-grasslands/terrain.bin', 'package.json', 'pnpm-lock.yaml',
    'test/fixtures/native-program.ts', 'test/fixtures/nalati-native-place-files.ts', 'test/fixtures/nalati-place-wires.json'],
})));
const files = new Map(rows.map(([name, bytes]) => [name, Uint8Array.from(Buffer.from(bytes, 'base64'))]));
if (files.size !== rows.length) throw new Error('Duplicate original native place file');
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
