import { skyMapPixels } from '../src/shards/far-reach/generators/mapProgram';
import { originalSkyMapInputs } from './fixtures/sky-map-source';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete predecessor rows and own isolated sealed fixtures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omission descriptors and sealed outputs to repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { bridgeRestPool, bridgeRestValues } from '../src/shards/far-reach/generators/bridgeRest';
import { MODEL_URLS } from '../src/shards/far-reach/generators/fileInventory';
import { skyRouteSource, skyRouteValues, skyRouteRegistry, skyVaneRows, readSkyRouteValues } from '../src/shards/far-reach/generators/routeScene';
import { skyRouteSceneSource, ROUTE_SCENE_INPUTS } from '../src/shards/far-reach/generators/routeSceneProgram';
import { hashImmutableBytes } from '../src/sdk/immutable';

const model = MODEL_URLS['bridge-deck'];
const handoff = 'src/shards/far-reach/data/bridgeRest.generated.json';
const hash = '658ee87ee0f3ad43e3c8aa0dac09e8235793444b2cecb4935e40a2ec26181ffa';
const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));

test('typed bridge hierarchy and independently derived pool retain every original field and part', async () => {
  const rows = await bridgeRestValues(read), pool = bridgeRestPool();
  const bytes = new TextEncoder().encode(`${JSON.stringify(rows)}\n`);
  expect(bytes.byteLength).toBe(59_699);
  expect(hashImmutableBytes(bytes)).toBe('ae5faee1125143aa75aa053cfbd418f9899c1b1a9907b617280a97e00c538bb4');
  expect(pool).toEqual(rows.pool);
  pool.parts.fill('foreign');
  expect(bridgeRestPool()).toEqual(rows.pool);
});

test('the route owner retains every original hierarchy, material, binding and board-only byte', async () => {
  const reads: string[] = [];
  const bytes = await skyRouteSource(url => { reads.push(url); return read(url); });
  expect(reads).toEqual([MODEL_URLS['bridge-deck']]);
  expect(bytes.byteLength).toBe(52_508); expect(hashImmutableBytes(bytes)).toBe(hash);
  expect(readSkyRouteValues(bytes).SKY_ROUTES.registry).toEqual(skyRouteRegistry());
});

test('typed route values retain the complete original wire and isolate caller mutation', async () => {
  const rows = await skyRouteValues(read);
  expect(skyRouteRegistry()).toEqual(rows.SKY_ROUTES.registry);
  expect(skyVaneRows()).toEqual(rows.SKY_VANES.rows);
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(rows)}\n`))).toBe(hash);
  rows.SKY_ROUTE_SCENE.nodes.length = 0;
  const material = rows.SKY_BRIDGE_KIT.materials.find(row => row.kind === 'standard');
  if (material?.kind === 'standard') material.properties.color = 0;
  rows.SKY_BRIDGE_KIT.materials.length = 0;
  const fresh = await skyRouteValues(read);
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(fresh)}\n`))).toBe(hash);
  expect(hashImmutableBytes(await skyRouteSource(read))).toBe(hash);
});

test('route publication is retired while the owned source preserves its full wire and native-input refusal', async () => {
  const { jobs } = discoverGeneration(resolve('.'));
  expect(jobs.some(row => row.id === 'sky-data-map')).toBe(false);
  expect(jobs.some(row => row.id === 'sky-route-scene')).toBe(false);
  for (const job of jobs) expect(job.inputRoots).not.toContain(handoff);
  const inputs = new Map(ROUTE_SCENE_INPUTS.map(url => [url, read(url)]));
  const bytes = (await skyRouteSceneSource(inputs)).get('route-scenes.json');
  if (bytes === undefined) throw new Error('Missing original route wire');
  expect(bytes.byteLength).toBe(52_508); expect(hashImmutableBytes(bytes)).toBe(hash);
  await expect(skyRouteSceneSource(new Map())).rejects.toThrow('input inventory differs');
});

test('the map program refuses an omitted original bridge deck before constructing geometry', async () => {
  const inputs = originalSkyMapInputs(); expect(inputs.has(model)).toBe(true); inputs.delete(model);
  await expect(skyMapPixels(inputs)).rejects.toThrow('native input inventory differs');
});
