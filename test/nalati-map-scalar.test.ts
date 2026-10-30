import { expect, test } from 'vitest';
import { readNalatiMapScalar } from '../src/shards/nalati-grasslands/generators/mapAssembly.mjs';

test('inline and malformed sources refuse before file access', () => {
  for (const source of ['AA==', null, 0, {}, [], { file: 3 }])
    expect(() => readNalatiMapScalar(source, new Map())).toThrow('Nalati map requires named binary scalar files');
});

// GR6: the map is a pure producer, so its scalar intake reads only the bank its caller supplies
test('file-only intake uses the supplied bank and refuses a missing file', () => {
  const bytes = new Uint8Array([0, 128, 255, 120, 156]), bank = new Map([['data/field.bin', bytes]]);
  expect([...readNalatiMapScalar({ file: 'data/field.bin' }, bank)]).toEqual([...bytes]);
  expect(() => readNalatiMapScalar({ file: 'data/missing.bin' }, bank)).toThrow('Missing owned geography channel data/missing.bin');
});
