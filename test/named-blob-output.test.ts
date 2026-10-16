import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real producer output ownership in an isolated fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns its bounded temporary project.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Author producers use file URLs for their explicit output root.
import { pathToFileURL } from 'node:url';
import { namedBlobOutput } from '../scripts/named-blob-output.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('producer blob sources own their bytes, collapse equal URL aliases and refuse conflicting names', () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const project = mkdtempSync(resolve('tmp/blob-output-')), root = pathToFileURL(`${project}/`);
  try {
    const output = namedBlobOutput(root, 'blob-source-test'), bytes = new Uint8Array([1, 2, 3]);
    const name = output.add('world/first.bin', 'bin', bytes, '/old/first.bin');
    expect(output.add('world/alias.bin', 'bin', bytes, '/old/alias.bin')).toBe(name);
    expect(() => output.add(name, 'bin', new Uint8Array([9]))).toThrow('Duplicate logical');
    expect(() => output.add('world/changed.bin', 'bin', new Uint8Array([9]), '/old/first.bin')).toThrow('changes content');
    output.finish(new URL('blobs.json', root));
    const metadata: unknown = JSON.parse(readFileSync(new URL('blobs.json', root), 'utf8'));
    const source = `assets/${hashImmutableBytes(bytes)}`;
    expect(metadata).toEqual({ blobs: [{ name, kind: 'bin', source }], byUrl: { '/old/first.bin': name, '/old/alias.bin': name } });
    expect(new Uint8Array(readFileSync(new URL(source, root)))).toEqual(bytes);
  } finally { rmSync(project, { recursive: true }); }
});
