import { readFileSync } from 'node:fs';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable.ts';
import pins from './nalati-place-wires.json' with { type: 'json' };

// Build independent full source facts concurrently within this fenced child.
// The assembly's parent still supplies its separately pinned original metadata.
const [source, files] = await Promise.all([
  import('./nalati-native-assembly-inputs.ts'),
  import('../../src/shards/nalati-grasslands/generators/placesProgram.ts').then(({ nalatiPlacesProgram }) => {
    const inputs = new Map([
      ['/assets/baked/nalati-grasslands/terrain.bin', readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')],
    ]);
    return nalatiPlacesProgram({ cached: (_step, make) => Promise.resolve(make(inputs)) }, 'exact');
  }),
]);
for (const name of ['places', 'specimens']) {
  const pin = pins.find(row => row.path === `public/assets/nalati/baked/${name}.bin`), bytes = files.get(`${name}.bin`);
  if (pin === undefined || bytes === undefined || bytes.byteLength !== pin.bytes || hashImmutableBytes(bytes) !== pin.hash)
    throw new Error(`Original native ${name} binary differs`);
}
const placed = files.get('places.json');
if (placed === undefined) throw new Error('Missing fresh native place metadata');
console.log(encodeCanonicalJson(source.nalatiNativeAssemblyInputs(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(placed)))));
