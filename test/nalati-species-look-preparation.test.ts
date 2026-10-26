import { originalSpeciesJson, originalSpeciesOutput } from './fixtures/nalati-original-species';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the complete retained metadata and frozen output pins.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { checkNalatiSpeciesSource } from './fixtures/check-nalati-species-source';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep isolated producer caches within this checkout's tmp directory.
import { relative, resolve } from 'node:path';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareNalatiSpeciesLooks } from '../src/shards/nalati-grasslands/generators/speciesLookPreparation';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import originals from './fixtures/nalati-species-files.json' with { type: 'json' };
import heldOriginals from './fixtures/nalati-held-files.json' with { type: 'json' };

const original = v.parse(v.object({ hullBook: v.unknown(), looks: v.unknown() }),
  originalSpeciesJson('species.json'));
const compactBody = v.parse(v.object({ compactBody: v.unknown() }), original.hullBook).compactBody;
const rows = v.parse(v.object({ rows: v.array(v.looseObject({ kind: v.string(), attachments: v.optional(v.array(v.object({ geometry: v.unknown() }))) })) }), original.looks);
const crackRow = rows.rows.find(row => row.kind === 'balbal')?.attachments?.[0]?.geometry;
if (crackRow === undefined) throw new Error('Missing original crack geometry');
const kingPose = v.parse(v.object({ programs: v.unknown(), group: v.string() }),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/goldenKingPose.generated.json', 'utf8')));

test('source look preparation preserves the complete original metadata and JSON assignment order', () => {
  const made = prepareNalatiSpeciesLooks(compactBody, kingPose, crackRow);
  expect(JSON.stringify(made.hullBook)).toBe(JSON.stringify(original.hullBook));
  expect(JSON.stringify(made.looks)).toBe(JSON.stringify(original.looks));
  expect(made.looks.rows).toHaveLength(10);
  expect(made.looks.rows.filter(row => row.animate !== undefined).map(row => row.kind)).toEqual(['balbal', 'eagle']);
  expect(made.looks.rows.filter(row => row.frame !== undefined).map(row => row.kind)).toEqual(['golden-king']);
  expect(made.looks.frames.king.smooth.some(row => row.initial === null)).toBe(true);
});

test('metadata loans own every nested input and rebuild without sharing authored state', () => {
  const compact = { body: [1, 2, 3] }, pose = { programs: [{ channel: 'original' }], group: 'king.pose' }, crack = { count: 7 };
  const made = prepareNalatiSpeciesLooks(compact, pose, crack);
  const before = JSON.stringify(made);
  compact.body[0] = 9; pose.programs[0] = { channel: 'mutated' }; crack.count = 99;
  expect(JSON.stringify(made)).toBe(before);
  const first = made.looks.rows[0]; if (first === undefined) throw new Error('Missing first species look');
  first.id = 'mutated'; first.sockets.push('mutated'); first.material.rim = -1;
  made.looks.frames.king.memory.pose = 999;
  const programs = Object.values(made.looks.poses)[0]?.programs;
  if (programs === undefined) throw new Error('Missing pose programs'); programs.splice(0);
  const rebuilt = prepareNalatiSpeciesLooks(compactBody, kingPose, crackRow);
  expect(JSON.stringify(rebuilt.looks)).toBe(JSON.stringify(original.looks));
  expect(JSON.stringify(rebuilt.hullBook)).toBe(JSON.stringify(original.hullBook));
});

test('the actual source constructor preserves all five complete original files', () => {
  checkNalatiSpeciesSource();
  expect(originals).toHaveLength(5);
  for (const pin of originals) {
    const bytes = originalSpeciesOutput(pin.path); expect(bytes.length, pin.path).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
});

test('the declared held consumer seals the exact original species look source closure', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-held-weapons');
  if (job === undefined) throw new Error('Missing species producer');
  expect(job.inputRoots.filter(name => name.endsWith('/speciesLookPreparation.ts'))).toHaveLength(1);
  const cacheDir = mkdtempSync(resolve('tmp/nalati-species-looks-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(Object.keys(result.hashes).sort()).toEqual(heldOriginals.map(pin => pin.path).sort((a, b) => a.localeCompare(b)));
      for (const pin of heldOriginals) {
        const bytes = readFileSync(resolve(result.directory, pin.path));
        expect(bytes.length, pin.path).toBe(pin.bytes); expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
      }
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('an omitted look source refuses despite all original complete outputs remaining in the checkout', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-held-weapons');
  if (job === undefined) throw new Error('Missing species producer');
  const omitted = { ...job, inputRoots: job.inputRoots.filter(name => !name.endsWith('/speciesLookPreparation.ts')) };
  expect(omitted.inputRoots.length).toBe(job.inputRoots.length - 1);
  const cacheDir = mkdtempSync(resolve('tmp/nalati-species-looks-missing-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }),
      JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row =>
      typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    for (const pin of originals) {
      const bytes = originalSpeciesOutput(pin.path); expect(bytes.length, pin.path).toBe(pin.bytes);
      expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
    }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
