// oxlint-disable-next-line import/no-nodejs-modules -- The map proof publishes only into its isolated scratch root.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the existing declared source inputs.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { signalMapWorldFiles } from '../src/shards/sunscar-dunes/generators/mapWorld.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import settings from '../src/shards/sunscar-dunes/look/map.json' with { type: 'json' };
import original from './fixtures/sunscar-world-files.json' with { type: 'json' };

const world = await signalMapWorldFiles(new Uint8Array(readFileSync('src/shards/sunscar-dunes/assets/models/dry-well.glb')));

test('the map consumes all original world geometry/rows as owned bytes', () => {
  expect(world.size).toBe(14);
  for (const [name, file] of Object.entries(original)) {
    if (name === 'plait.bin') continue;
    const key = name.endsWith('.json') ? `data/${name}` : `../../../public/assets/sunscar-dunes/baked/${name}`;
    const bytes = world.get(key); if (bytes === undefined) throw new Error('Missing source world map input');
    expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(file);
    expect(settings.inputs.includes(key)).toBe(false);
  }
});

test('the sealed native map producer refuses an omitted original model input', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-data-map');
  if (job === undefined) throw new Error('Missing original map producer');
  const input = 'src/shards/sunscar-dunes/assets/models/dry-well.glb';
  expect(job.platform).toBe('native'); expect(job.inputRoots).toContain(input);
  const cache = mkdtempSync(resolve('tmp', 'sunscar-map-closure-'));
  try {
    const descriptor = { ...job, inputRoots: job.inputRoots.filter(path => path !== input) };
    const catalogPath = relative(root, resolve(cache, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture', jobs: [descriptor] }));
    await expect(generateShardJob(root, descriptor, { cacheDir: cache, catalogPath, forceCompare: true, restore: false }))
      .rejects.toThrow('Generator exited 1');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the complete map keeps the original native image without world handoff files', async () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp', 'sunscar-map-world-'));
  try {
    const source = resolve('src/shards/sunscar-dunes'), inputs = new Map(world);
    // Retained terrain and rest-scene inputs remain explicit. World inputs are
    // absent from this list, so none of their physical files can seed the proof.
    for (const name of settings.inputs) {
      const path = resolve(source, name);
      if (statSync(path, { throwIfNoEntry: false })?.isFile() === true) inputs.set(name, new Uint8Array(readFileSync(path)));
    }
    const look = resolve(root, 'src/shards/sunscar-dunes/look'); mkdirSync(look, { recursive: true });
    mkdirSync(resolve(root, 'src/shards/sunscar-dunes/data'), { recursive: true });
    writeFileSync(resolve(look, 'map.json'), JSON.stringify({ ...settings, inputs: [] }));
    const painted = await paintDataMap(root, 'sunscar-dunes', { sources: inputs });
    const bytes = readFileSync(resolve(root, 'public/assets/sunscar-dunes/map/top.webp'));
    expect(bytes.length).toBe(172348);
    expect(hashImmutableBytes(bytes)).toBe('bac9393474d96298d9bd4a407197d0bc86be913b872c8430e8f2e0aabd5cb399');
    expect(painted.stamp.pixelHash).toBe('a7fc31f43e02c0575dc09044199a5303b9dfb027e9c4d2cda74acda2fe8c9297');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
