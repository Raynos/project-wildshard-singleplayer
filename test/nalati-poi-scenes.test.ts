// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original scene-description wire byte.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the complete private author bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { nalatiPoiScenes, type NalatiPoiScenePlaces } from '../src/shards/nalati-grasslands/generators/poiScenes';
import { jsonBytes } from '../scripts/bake-output.mjs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

test('owned places metadata retains every original POI scene wire byte', () => {
  const places = v.parse(v.object({ rows: v.array(v.object({ name: v.string(), group: v.nullable(v.string()),
    meshes: v.array(v.object({ name: v.string(), material: v.string(), slot: v.number() })) })) }),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/places.json', 'utf8')));
  const bytes = jsonBytes(nalatiPoiScenes(places));
  for (const directory of ['data', 'boot']) {
    const original = readFileSync(`src/shards/nalati-grasslands/${directory}/poiScenes.generated.json`);
    expect(Buffer.compare(bytes, original)).toBe(0);
  }
});

test('scene nodes preserve actor omissions, slot order and detached material/child arrays', () => {
  const places: NalatiPoiScenePlaces = { rows: [
    { name: 'actor:one', group: null, meshes: [] },
    { name: 'camp', group: 'shelter', meshes: [
      { name: '', material: 'yard', slot: 2 }, { name: 'walls', material: 'wood', slot: 1 }, { name: 'roof', material: 'wood', slot: 1 },
    ] },
    { name: 'empty-name', group: '', meshes: [{ name: 'one', material: 'stone', slot: 0 }] },
    { name: 'ungrouped', group: null, meshes: [{ name: '', material: 'stone', slot: 0 }] },
  ] };
  const before = JSON.stringify(places), scenes = nalatiPoiScenes(places), next = nalatiPoiScenes(places);
  expect(scenes).not.toHaveProperty('actor:one');
  expect(scenes['camp']?.nodes[0]).toEqual({ kind: 'group', id: 'root', name: 'shelter', children: ['mesh-1', 'mesh-2', 'mesh-0'] });
  expect(scenes['camp']?.nodes[1]).toEqual({ kind: 'mesh', id: 'mesh-0', geometry: 'mesh-0', material: 'yard', missing: 'empty', castShadow: false, receiveShadow: true, renderOrder: 1 });
  expect(scenes['camp']?.materials).toEqual([{ id: 'yard', kind: 'port', source: 'yard' }, { id: 'wood', kind: 'port', source: 'wood' }]);
  expect(scenes['empty-name']?.nodes[0]).toEqual({ kind: 'group', id: 'root', children: ['mesh-0'] });
  expect(scenes['ungrouped']?.root).toBe('mesh-0');
  expect(scenes['ungrouped']?.nodes).toHaveLength(1);
  expect(JSON.stringify(places)).toBe(before); expect(next).toEqual(scenes);
  expect(next['camp']?.nodes).not.toBe(scenes['camp']?.nodes);
  expect(next['camp']?.materials).not.toBe(scenes['camp']?.materials);
});

test('the POI scene source is one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/poiScenes.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing POI scene source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
