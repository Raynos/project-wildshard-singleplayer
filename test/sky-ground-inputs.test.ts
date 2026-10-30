// oxlint-disable-next-line import/no-nodejs-modules -- Keep omitted-source catalogues in repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyGroundSource, skyGroundValues } from '../src/shards/far-reach/generators/groundScene';

test('the source-derived ground serializes every current hull, scene and registry row', () => {
  const bytes = skyGroundSource();
  expect(new TextEncoder().encode(`${JSON.stringify(skyGroundValues())}\n`)).toEqual(bytes);
});

test('ground row loans cannot mutate the next caller or retained publication', () => {
  const before = hashImmutableBytes(skyGroundSource());
  const values = skyGroundValues(), root = values.SKY_GROUND.recipe.scene.nodes[0], hull = values.SKY_GROUND_COLLIDERS[0]?.colliders[0];
  if (root === undefined || hull === undefined) throw new Error('Missing original ground rows');
  root.children.push('caller-only');
  hull.points.fill(0);
  expect(hashImmutableBytes(skyGroundSource())).toBe(before);
  const fresh = skyGroundValues();
  expect(fresh.SKY_GROUND.recipe.scene.nodes[0]?.children).not.toContain('caller-only');
  expect(fresh.SKY_GROUND_COLLIDERS[0]?.colliders[0]?.points.some(value => value !== 0)).toBe(true);
});

test('ground source bundles without generated metadata or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/groundScene.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing ground source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});
