// oxlint-disable-next-line import/no-nodejs-modules -- Compare authored inputs across owned installation layouts.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixture trees under repository scratch.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { mapInputHashes, mapTilesHash, mapInputRoots, mapSettings, mapShards } from '../scripts/map-hash.mjs';

test('map keys ignore installed launchers while retaining source and lockfile bytes', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/map-source-inputs-'));
  const put = (path: string, value: string): void => {
    const target = resolve(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value);
  };
  try {
    put('look/map.json', JSON.stringify({ why: 'source closure fixture', inputs: ['sdk', 'pnpm-lock.yaml'] }));
    put('sdk/terrain.ts', 'export const height = 12;'); put('pnpm-lock.yaml', 'compiler: pinned-1');
    const isolated = mapTilesHash(root);
    put('sdk/node_modules/.bin/asc', 'checkout-specific launcher');
    put('sdk/nested/node_modules/.bin/tool', 'another installed launcher');
    expect(mapTilesHash(root)).toBe(isolated);
    put('sdk/node_modules/.bin/asc', 'CI-specific launcher');
    expect(mapTilesHash(root)).toBe(isolated);
    expect(Object.keys(mapInputHashes(root))).toEqual(['look/map.json', 'pnpm-lock.yaml', 'sdk/terrain.ts']);
    put('sdk/terrain.ts', 'export const height = 13;'); expect(mapTilesHash(root)).not.toBe(isolated);
    put('sdk/terrain.ts', 'export const height = 12;'); expect(mapTilesHash(root)).toBe(isolated);
    put('pnpm-lock.yaml', 'compiler: pinned-2'); expect(mapTilesHash(root)).not.toBe(isolated);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('retained painter declarations track the defining raster source and invalidate on its edits', () => {
  let tracked = 0;
  for (const { dir } of mapShards(resolve('.'))) {
    if (!mapSettings(dir).inputs.includes('../../../scripts/map-painter.mjs')) continue;
    expect(mapInputRoots(dir)).toContain(resolve('src/sdk/bake/mapRaster.ts')); tracked++;
  }
  expect(tracked).toBe(8);
  for (const slug of ['sunscar-dunes', 'far-reach', 'nalati-grasslands', 'nine-dragon-stack', 'driftwood-isle']) {
    const roots = mapInputRoots(resolve('src/shards', slug));
    expect(roots).toContain(resolve('src/sdk/bake/mapScenes.ts'));
  }
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/map-raster-source-')), shard = resolve(root, 'shards/fixture');
  try {
    mkdirSync(resolve(shard, 'look'), { recursive: true }); mkdirSync(resolve(root, 'sdk/bake'), { recursive: true });
    const source = resolve(root, 'sdk/bake/mapRaster.ts');
    writeFileSync(resolve(shard, 'look/map.json'), JSON.stringify({ why: 'raster source fixture', inputs: ['../../sdk/bake/mapRaster.ts', '../../sdk/bake/mapScenes.ts'] }));
    const scenes = resolve(root, 'sdk/bake/mapScenes.ts'); writeFileSync(scenes, 'export const scenes = 1;');
    writeFileSync(source, 'export const source = 1;'); const original = mapTilesHash(shard);
    expect(Object.keys(mapInputHashes(shard))).toEqual(['../../sdk/bake/mapRaster.ts', '../../sdk/bake/mapScenes.ts', 'look/map.json']);
    writeFileSync(source, 'export const source = 2;'); expect(mapTilesHash(shard)).not.toBe(original);
    writeFileSync(source, 'export const source = 1;'); expect(mapTilesHash(shard)).toBe(original);
    writeFileSync(scenes, 'export const scenes = 2;'); expect(mapTilesHash(shard)).not.toBe(original);
    writeFileSync(scenes, 'export const scenes = 1;'); expect(mapTilesHash(shard)).toBe(original);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
