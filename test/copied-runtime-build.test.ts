// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their small source and output directories.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths are confined to their owned tmp root.
import { resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { buildProject } from '@wildshard/sdk/project';
import { proveRuntimeData } from '@wildshard/sdk/outputRuntime';
import { validateOutputProduct } from '@wildshard/sdk/outputProduct';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';

const owned: string[] = [];
afterEach(() => { for (const directory of owned.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function fixture(): { project: string; destination: string } {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'copied-runtime-build-')); owned.push(root);
  const project = resolve(root, 'project'), destination = resolve(root, 'output');
  mkdirSync(resolve(project, 'runtime'), { recursive: true });
  const shard = emptyShardfile({ slug: 'runtime-test', name: 'Runtime', author: 'Test', revision: 1, seed: 3 });
  shard.runtime = { entry: 'runtime/hybrid.ts' };
  writeFileSync(resolve(project, 'shard.config.ts'), `
import * as v from 'valibot';
import { defineSection, emitDefinedSections } from '@wildshard/sdk/sections';
export default ${JSON.stringify(shard)};
export const output = {custom:emitDefinedSections([defineSection('custom/reward',v.strictObject({amount:v.number()}),{amount:3})])};
export const mirrors = [{name:'REWARD',value:{amount:3}}];
`);
  writeFileSync(resolve(project, 'runtime/index.ts'), 'throw new Error("Page entry must never execute during a build");\r\n');
  writeFileSync(resolve(project, 'runtime/hybrid.ts'), 'throw new Error("Native entry must never execute during a build");\n');
  writeFileSync(resolve(project, 'runtime/sections.ts'), "import * as v from 'valibot';\nexport const SECTIONS = {'custom/reward':v.strictObject({amount:v.number()})};\n");
  writeFileSync(resolve(project, 'runtime/const.ts'), 'export const REWARD = {amount:3};\r\n');
  return { project, destination };
}
const check = (path: string, source: string) => shardfileBoundaryViolations(resolve('.'), `src/shards/probe/${path}`, source).filter(issue => issue.rule === 'runtime-standalone');
it('builds copied runtime against emitted JSON and config mirrors without evaluating entry code', async () => {
  const { project, destination } = fixture();
  await buildProject(project, destination, { client: null, copyRuntime: true, runtimeCheck: check });
  const { index } = validateOutputProduct(destination);
  expect(index.runtime).toMatchObject({entry:'runtime/hybrid.ts'});
  expect(index.runtime?.files.map(file => file.path)).toEqual(['runtime/const.ts', 'runtime/hybrid.ts', 'runtime/index.ts', 'runtime/sections.ts']);
  for (const file of index.runtime?.files ?? []) expect(readFileSync(resolve(destination, file.path))).toEqual(readFileSync(resolve(project, file.path)));
  // The proof must keep using the copy, even if the author file has since changed.
  writeFileSync(resolve(project, 'runtime/const.ts'), 'export const REWARD = {amount:999};');
  await expect(proveRuntimeData(destination, index, [{ name: 'REWARD', value: { amount: 3 } }])).resolves.toBeUndefined();
});
it.each([
  { file: 'const.ts', source: 'export const REWARD = {amount:4};', error: /REWARD/u },
  { file: 'sections.ts', source: "import * as v from 'valibot'; export const SECTIONS = {'custom/reward':v.string()};", error: /Expected/u },
  { file: 'sections.ts', source: 'export const SECTIONS = {};', error: /no runtime schema/u },
  { file: 'const.ts', source: "export { REWARD } from '../shard.config';", error: /runtime/u },
])('refuses $file drift or escape with no successful product receipt', async ({ file, source, error }) => {
  const { project, destination } = fixture();
  writeFileSync(resolve(project, 'runtime', file), source);
  await expect(buildProject(project, destination, { outputFormat: 2, client: null, copyRuntime: true, runtimeCheck: check })).rejects.toThrow(error);
  expect(existsSync(resolve(destination, 'validation.json'))).toBe(false);
});
it('never substitutes source constants when a declared copied module is missing', async () => {
  const { project, destination } = fixture();
  rmSync(resolve(project, 'runtime/const.ts'));
  await expect(buildProject(project, destination, { outputFormat: 2, client: null, copyRuntime: true })).rejects.toThrow('runtime/const.ts');
  expect(existsSync(resolve(destination, 'validation.json'))).toBe(false);
});
it('refuses overlapping source/output before clearing the author project', async () => {
  const { project } = fixture();
  const config = readFileSync(resolve(project, 'shard.config.ts'));
  await expect(buildProject(project, project, { outputFormat: 2, client: null, copyRuntime: true })).rejects.toThrow('separate');
  expect(readFileSync(resolve(project, 'shard.config.ts'))).toEqual(config);
});
