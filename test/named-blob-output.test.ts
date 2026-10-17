import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real producer output ownership in an isolated fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns its bounded temporary project.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Author producers use file URLs for their explicit output root.
import { pathToFileURL } from 'node:url';
import { namedBlobOutput } from '../scripts/named-blob-output.mjs';
import { compileScript } from '@wildshard/sdk/compileScript';
import { scriptSource } from './script/fixture';
import { prepareProjectOutput } from '../src/sdk/projectOutput';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('producer blob sources own their bytes, collapse equal URL aliases and refuse conflicting names', () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const project = mkdtempSync(resolve('tmp/blob-output-')), root = pathToFileURL(`${project}/`);
  try {
    expect(() => namedBlobOutput(root, 'invalid', 'assets/../escape')).toThrow('Invalid blob source directory');
    expect(() => namedBlobOutput(root, 'invalid', '/assets')).toThrow('Invalid blob source directory');
    const scoped = namedBlobOutput(root, 'scoped-test', 'assets/streams');
    scoped.add('stream.bin', 'bin', new Uint8Array([4]));
    scoped.finish(new URL('stream.json', root));
    const scopedSource = `assets/streams/${hashImmutableBytes(new Uint8Array([4]))}`;
    const scopedMetadata: unknown = JSON.parse(readFileSync(new URL('stream.json', root), 'utf8'));
    expect(scopedMetadata).toMatchObject({ blobs: [{ source: scopedSource }] });
    expect(new Uint8Array(readFileSync(new URL(scopedSource, root)))).toEqual(new Uint8Array([4]));
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


test('producer Wasm contracts survive generated declarations and source readmission', async () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const project = mkdtempSync(resolve('tmp/blob-output-script-')), root = pathToFileURL(`${project}/`);
  try {
    const output = namedBlobOutput(root, 'script-source-test'), bytes = await compileScript(scriptSource());
    expect(() => output.add('script.wasm', 'wasm', bytes)).toThrow('explicit script contract');
    output.add('script.wasm', 'wasm', bytes, undefined, { abi: 0 });
    output.finish(new URL('blobs.json', root));
    const metadata: unknown = JSON.parse(readFileSync(new URL('blobs.json', root), 'utf8'));
    expect(metadata).toMatchObject({ blobs: [{ kind: 'wasm', options: { script: { abi: 0 } } }] });
    if (typeof metadata !== 'object' || metadata === null || !('blobs' in metadata)) throw new Error('Missing generated declarations');
    const prepared = await prepareProjectOutput(project, { blobs: metadata.blobs });
    expect(prepared.blobs[0]?.bytes).toEqual(bytes);
    expect(prepared.blobs[0]?.script).toEqual({ abi: 0 });
  } finally { rmSync(project, { recursive: true }); }
});
