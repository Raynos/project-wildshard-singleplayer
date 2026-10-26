// oxlint-disable-next-line import/no-nodejs-modules -- Independent retained native byte oracles never enter production.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the original compressed lanes independently of the producer.
import { inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { unshuffle } from '../../src/shards/nalati-grasslands/generators/bake-nalati-places.mjs';

const stamp = v.looseObject({ bin: v.string(), bytes: v.number(), rows: v.array(v.unknown()) });
function read(binary: string, document: string) {
  const rows = v.parse(stamp, JSON.parse(readFileSync(document, 'utf8')));
  const raw = unshuffle(new Uint8Array(inflateSync(readFileSync(binary))));
  if (raw.length !== rows.bytes || hashImmutableBytes(raw) !== rows.bin) throw new Error('Original native rows and binary differ');
  return { rows, raw };
}

/** Keep the original wire snapshots separate from fresh source construction. */
export function committedPlaces() {
  return {
    places: read('public/assets/nalati/baked/places.bin', 'test/fixtures/nalati-places-original.json'),
    specimens: read('public/assets/nalati/baked/specimens.bin', 'test/fixtures/nalati-packed-specimens-original.json'),
    dressing: read('test/fixtures/nalati-dressing.bin', 'test/fixtures/nalati-dressing-geos.json'),
  };
}
