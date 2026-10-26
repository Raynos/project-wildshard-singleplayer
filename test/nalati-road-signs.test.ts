// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original place anchors over the native terrain.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining source rather than a test projection.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { nalatiRoadSignSites, nalatiRoadSignposts } from '../src/shards/nalati-grasslands/generators/roadSigns';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

test('native sign anchors retain every original coordinate, label and bearing in order', () => {
  const scalar = v.pipe(v.number(), v.finite());
  const original = v.parse(v.object({ rows: v.array(v.object({ name: v.string(), anchors: v.optional(v.unknown()) })) }),
    JSON.parse(readFileSync('src/shards/nalati-grasslands/data/places.json', 'utf8')));
  const roads = original.rows.find(row => row.name === 'roads');
  if (roads === undefined) throw new Error('Missing original road anchors');
  const before = v.parse(v.object({ signposts: v.array(v.object({ x: scalar, z: scalar,
    boards: v.array(v.object({ text: v.string(), dir: scalar })), y: scalar })) }), roads.anchors).signposts;
  const native = readNativeTerrain(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
  expect(nalatiRoadSignposts(native.heightAt)).toStrictEqual(before);
  expect(JSON.stringify(nalatiRoadSignposts(native.heightAt))).toBe(JSON.stringify(before));
});

test('sites and boards detach while ground calls retain authored order', () => {
  const sites = nalatiRoadSignSites(), before = JSON.stringify(sites), calls: [number, number][] = [];
  const posts = nalatiRoadSignposts((x, z) => { calls.push([x, z]); return x + z * 2; });
  expect(calls).toEqual(sites.map(site => [site.x, site.z]));
  expect(posts.map(post => post.y)).toEqual(sites.map(site => site.x + site.z * 2));
  expect(posts.map(({ y: _height, ...site }) => site)).toEqual(sites);
  const board = posts[0]?.boards[0];
  if (board === undefined) throw new Error('Missing native road label');
  Object.assign(board, { text: 'changed' });
  expect(JSON.stringify(sites)).toBe(before);
  expect(JSON.stringify(nalatiRoadSignSites())).toBe(before);
});

test('the sign source is one chunk without the place geometry or runtime graph', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/roadSigns.ts'), formats: ['es'] },
    rolldownOptions: { output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing road-sign source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    const imports = [...chunk.imports, ...chunk.dynamicImports];
    expect(() => assertConfigBoundary(imports)).not.toThrow(); expect(imports).toEqual([]);
    expect(Object.keys(chunk.modules).some(path => /\/(?:places|painted|campProps|catalogue)\.ts$/u.test(path))).toBe(false);
  }
});
