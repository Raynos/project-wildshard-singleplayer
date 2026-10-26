// oxlint-disable-next-line import/no-nodejs-modules -- Independent original metadata and pinned native bytes never enter production.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the original compressed lanes independently of the producer.
import { inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { nativePlaceFile } from './nalati-native-place-files';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { unshuffle } from '../../src/shards/nalati-grasslands/generators/bake-nalati-places.mjs';

const stamp = v.looseObject({ bin: v.string(), bytes: v.number(), rows: v.array(v.unknown()) });
function read(binary: Uint8Array, document: string) {
  const rows = v.parse(stamp, JSON.parse(readFileSync(document, 'utf8')));
  const raw = unshuffle(new Uint8Array(inflateSync(binary)));
  if (raw.length !== rows.bytes || hashImmutableBytes(raw) !== rows.bin) throw new Error('Original native rows and binary differ');
  return { rows, raw };
}

/** Pair frozen original metadata with source bytes checked against both complete original binary pins. */
export function committedPlaces() {
  return {
    places: read(nativePlaceFile('places.bin'), 'test/fixtures/nalati-places-original.json'),
    specimens: read(nativePlaceFile('specimens.bin'), 'test/fixtures/nalati-packed-specimens-original.json'),
    dressing: read(readFileSync('test/fixtures/nalati-dressing.bin'), 'test/fixtures/nalati-dressing-geos.json'),
  };
}
