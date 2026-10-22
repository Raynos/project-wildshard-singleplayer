import { afterEach, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- This fixture owns its small temporary author projects.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep policy and source together under tmp.
import { resolve } from 'node:path';
import { genDecisionPolicies } from '../scripts/gen-decision-policy.mjs';
import { readProjectAssets } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { projectDecisionBudget } from '../src/sdk/projectPolicy';
import { assertProductTargets } from '../src/sdk/productOutput';
import { decisionLineCeiling } from '../src/sdk/buildDecisionScripts';
import { shardLineBaselines } from '../scripts/decision-legacy-lines.mjs';
import { legacyLineBasis } from './fixtures/legacyLineBasis';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
test('direct project readers use generated sealed policy instead of a standalone ceiling', async () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/decision-policy-')); directories.push(root);
  const project = resolve(root, 'src/shards/example'), old = resolve(root, 'src/shards/example-legacy');
  for (const path of [old, resolve(project, 'behaviour'), resolve(root, 'lint')]) mkdirSync(path, { recursive: true });
  writeFileSync(resolve(old, 'manifest.ts'), 'export const manifest=1;');
  writeFileSync(resolve(old, 'plugin.ts'), Array.from({ length: 19 }, (_, i) => `export const x${i}=${i};`).join('\n'));
  writeFileSync(resolve(root, 'lint/legacy-shards.json'), JSON.stringify({ version: 1, sealed: true, shards: {
    'example-legacy': { primary: 'example', source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'c'.repeat(64) } },
  } }));
  legacyLineBasis(root, 'example', { 'manifest.ts': 'export const manifest=1;',
    'plugin.ts': Array.from({ length: 19 }, (_, i) => `export const x${i}=${i};`).join('\n') });
  genDecisionPolicies(root); genDecisionPolicies(root, true);
  expect(projectDecisionBudget(project)).toBe(20); expect(projectDecisionBudget(project, 30)).toBe(30);
  const shard = emptyShardfile({ slug: 'example', name: 'Example', author: 'Test', revision: 1, seed: 1 });
  const row = { id: 'example.main', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/main.as',
    binding: { shard: true }, on: ['start'], onFail: 'reset', reads: [], commands: [], stateVersion: 1, state: [], params: {} };
  writeFileSync(resolve(project, 'shard.config.ts'), `import {emitPlatformSections} from '@wildshard/sdk/platformSections';
export default ${JSON.stringify(shard)};
export const buildOptions={asLineCeiling:10000};
export const output={platform:emitPlatformSections(new Map([['sim/scripts',${JSON.stringify([row])}]]))};`);
  writeFileSync(resolve(project, 'behaviour/main.as'), 'export function onStart():void {}');
  expect((await readProjectAssets(project)).shard.files.some(file => file.kind === 'wasm')).toBe(true);
  writeFileSync(resolve(project, 'behaviour/main.as'), 'export function onStart():void {\n let value:i32=1;\n}');
  await expect(readProjectAssets(project)).rejects.toThrow('3 > 2');
});
test('early target refusal does not invent missing execution evidence', () => {
  const shard = emptyShardfile({ slug: 'test', name: 'Test', author: 'Test', revision: 1, seed: 1 });
  shard.budgets.sim.compressed = 2_000_001;
  expect(() => assertProductTargets(shard, 'refuse')).toThrow('critical download budget bytes: 2000001 > 2000000');
  try { assertProductTargets(shard, 'refuse'); } catch (error) {
    expect(String(error)).not.toContain('missing execution samples');
  }
});

test('all six declared AS budgets compile with an empty legacy list and no legacy folders', async () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/decision-no-legacy-')); directories.push(root);
  mkdirSync(resolve(root, 'lint'));
  writeFileSync(resolve(root, 'lint/legacy-line-basis.json'), readFileSync('lint/legacy-line-basis.json'));
  writeFileSync(resolve(root, 'lint/legacy-shards.json'), JSON.stringify({ version: 1, sealed: true, shards: {} }));
  const expected = new Map([['driftwood-isle', 1716], ['pine-hollow', 2130], ['nalati-grasslands', 2837],
    ['far-reach', 677], ['sunscar-dunes', 412], ['nine-dragon-stack', 2111]]);
  expect(shardLineBaselines(root).size).toBe(expected.size);
  genDecisionPolicies(root); genDecisionPolicies(root, true);
  for (const [slug, ceiling] of expected) {
    const project = resolve(root, 'src/shards', slug), budget = projectDecisionBudget(project);
    if (budget === undefined) throw new Error(`Missing declared AS budget for ${slug}`);
    expect(decisionLineCeiling({ decisionLegacyLines: budget })).toBe(ceiling);
    const shard = emptyShardfile({ slug, name: slug, author: 'Test', revision: 1, seed: 1 });
    const row = { id: 'budget.main', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/main.as',
      binding: { shard: true }, on: ['start'], onFail: 'reset', reads: [], commands: [], stateVersion: 1, state: [], params: {} };
    mkdirSync(resolve(project, 'behaviour'));
    writeFileSync(resolve(project, 'behaviour/main.as'), 'export function onStart():void {}');
    writeFileSync(resolve(project, 'shard.config.ts'), `import {emitPlatformSections} from '@wildshard/sdk/platformSections';
export default ${JSON.stringify(shard)};
export const output={platform:emitPlatformSections(new Map([['sim/scripts',${JSON.stringify([row])}]]))};`);
    expect((await readProjectAssets(project)).shard.files.some(file => file.kind === 'wasm')).toBe(true);
  }
});
