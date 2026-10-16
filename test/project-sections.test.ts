import { afterEach, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Owns a bounded build-only author project fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolves only the owned fixture directory.
import { resolve } from 'node:path';
import { emptyShardfile } from '../src/sdk/author';
import { mergeProjectSections } from '../src/sdk/projectSections';
import { readProjectAssets, buildProject } from '../src/sdk/project';
import { validateOutputProduct } from '../src/sdk/outputProduct';
import movers from '../src/shards/driftwood-isle/data/movers.generated.json' with { type: 'json' };

const directories: string[] = [];
const source = () => {
  const shard = emptyShardfile({ slug: 'sections-test', name: 'Sections', author: 'Test', revision: 1, seed: 3 });
  shard.runtime = { entry: 'runtime/index.ts', binds: ['movers'] };
  return shard;
};
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true }); });

test('root-mapped sections preserve actual mover rows and refuse conflicting or unknown fields', () => {
  const original = source(), merged = mergeProjectSections(original, { 'world/movers': { movers } });
  expect(merged.movers).toEqual(movers);
  expect(original.movers).toEqual([]);
  expect(() => mergeProjectSections(merged, { 'world/movers': { movers } })).toThrow('conflicts');
  expect(() => mergeProjectSections(original, { 'world/movers': { movers, identity: original.identity } })).toThrow('undeclared');
  expect(() => mergeProjectSections(original, { 'world/missing': {} })).toThrow('Unknown platform');
  expect(() => mergeProjectSections(original, { 'world/movers': { movers: [{ ...movers[0], execution: 'silent-fallback' }] } })).toThrow();
  expect(() => mergeProjectSections(original, { 'world/movers': () => movers })).toThrow('Invalid authored');
});

test('the real sidecar pipeline emits one canonical section from declared data without a config import', async () => {
  mkdirSync('tmp', { recursive: true });
  const path = mkdtempSync(resolve('tmp', 'project-sections-')); directories.push(path);
  mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'shard.config.ts'), `export default ${JSON.stringify(source())};`);
  writeFileSync(resolve(path, 'generators/output.ts'), `export const output = {}; export const sections = ${JSON.stringify({ 'world/movers': { movers } })};`);
  expect((await readProjectAssets(path)).shard.movers).toEqual(movers);
  const destination = resolve(path, 'out'); await buildProject(path, destination, { client: null });
  const checked = validateOutputProduct(destination);
  expect(checked.index.sections.filter(row => row.name === 'world/movers')).toHaveLength(1);
  expect(JSON.parse(readFileSync(resolve(destination, 'sections/world/movers.json'), 'utf8'))).toEqual({ movers });
  expect(checked.shard.movers).toEqual(movers);
});
