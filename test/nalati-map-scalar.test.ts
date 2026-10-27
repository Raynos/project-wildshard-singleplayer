import {nalatiGeographySources} from '../src/shards/nalati-grasslands/generators/geographySource';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original compressed scalar input.
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the complete original scalar input inventory.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep explicit source fixtures inside the owned repository scratch directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readNalatiMapScalar } from '../src/shards/nalati-grasslands/generators/mapAssembly.mjs';

const scalar = v.object({ values: v.object({ data: v.unknown() }) });
const geography = v.parse(v.object({ ground: v.object({ mask: scalar }), channels: v.record(v.string(), scalar) }),
  JSON.parse(readFileSync('test/fixtures/nalati-geography-original.json', 'utf8')));

test('all six current scalar files retain their complete predecessor inventory', () => {
  const values: [string, unknown][] = [['pond', geography.ground.mask.values.data],
    ...Object.entries(geography.channels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]): [string, unknown] => [key, value.values.data])];
  const files = nalatiGeographySources();
  const rows = values.map(([key, input]) => {
    const source = v.parse(v.object({ file: v.string() }), input);
    const bytes = readNalatiMapScalar(source, files);
    return { key, file: source.file, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  expect(rows).toHaveLength(6);
  expect(rows.reduce((sum, row) => sum + row.bytes, 0)).toBe(290859);
  expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe('89aba9e8d3ae360ea65c06329ef89b1ed6a13ce238ad768f66035964aad54649');
});

test('inline and malformed sources refuse before file access', () => {
  for (const source of ['AA==', null, 0, {}, [], { file: 3 }])
    expect(() => readNalatiMapScalar(source, 'missing-fixture-root')).toThrow('Nalati map requires named binary scalar files');
});

test('file-only intake uses the supplied root and refuses a missing file', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'nalati-scalar-'));
  try {
    mkdirSync(resolve(root, 'data'));
    const bytes = new Uint8Array([0, 128, 255, 120, 156]);
    writeFileSync(resolve(root, 'data/field.bin'), bytes);
    expect([...readNalatiMapScalar({ file: 'data/field.bin' }, root)]).toEqual([...bytes]);
    expect(() => readNalatiMapScalar({ file: 'data/missing.bin' }, root)).toThrow('ENOENT');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
