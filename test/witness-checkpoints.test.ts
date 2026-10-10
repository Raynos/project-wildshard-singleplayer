// oxlint-disable-next-line import/no-nodejs-modules -- The cache fixture owns temporary files, not gameplay saves.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture has an isolated OS-temp cache.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths belong to the fixture's cache.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cachedWitnessManifest, checkpointHashes, compareWitnessManifests, readWitnessManifest, witnessPayloadHashes } from '../scripts/witness-checkpoints.mjs';

const INPUTS = 'a'.repeat(64);
const fixture = (): string => mkdtempSync(join(tmpdir(), 'witness-cache-test-'));
const write = (dir: string, inputs = INPUTS): void => {
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({ inputs, ticks: { end: 42 } }, null, 2)}\n`);
  writeFileSync(join(dir, 'end.snap.gz'), 'actual native bytes');
};

it('records small hash manifests, validates transport metadata, and refuses Darwin outcome changes', () => {
  const root = fixture();
  try {
    write(root);
    expect(witnessPayloadHashes(join(root, 'manifest.json'))).toBeUndefined();
    const original = cachedWitnessManifest(root);
    expect(original).toContain('DO NOT EDIT'); expect(original).toContain('end.snap.gz');
    writeFileSync(join(root, 'manifest.json'), original);
    const hashes = witnessPayloadHashes(join(root, 'manifest.json'));
    expect(hashes?.['end.snap.gz']).toBe(checkpointHashes(root)['end.snap.gz']);
    rmSync(join(root, 'end.snap.gz'));
    expect(witnessPayloadHashes(join(root, 'manifest.json'))).toEqual(hashes);
    expect(readWitnessManifest(join(root, 'manifest.json'))).toEqual({ inputs: INPUTS, ticks: { end: 42 } });
    expect(() => compareWitnessManifests(original, original.replace(INPUTS, 'b'.repeat(64)), 'darwin')).not.toThrow();
    const changed = original.replace('42', '43');
    expect(() => compareWitnessManifests(original, changed, 'darwin')).toThrow('hashes or outcomes changed');
    expect(() => compareWitnessManifests(original, changed, 'linux')).not.toThrow();
    expect(() => compareWitnessManifests(original, original.replace('DO NOT EDIT', 'edited'), 'linux')).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a directory, malformed metadata and unrecognised payload names', () => {
  const root = fixture();
  try {
    write(root); mkdirSync(join(root, 'nested.snap.gz'));
    expect(() => checkpointHashes(root)).toThrow('Invalid checkpoint file');
    rmSync(join(root, 'nested.snap.gz'), { recursive: true });
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ inputs: INPUTS, cache: { version: 1, payloads: {} } }));
    expect(() => readWitnessManifest(join(root, 'manifest.json'))).toThrow();
    writeFileSync(join(root, 'foreign.txt'), 'not a checkpoint');
    expect(() => checkpointHashes(root)).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
