import { afterEach, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Build intake fixture owns only this temporary project.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate author fixtures under the repository scratch root.
import { resolve } from 'node:path';
import { emptyShardfile } from '@wildshard/sdk/author';
import { prepareProjectOutput } from '@wildshard/sdk/projectOutput';
import { projectDecisionOptions } from '@wildshard/sdk/projectDecisions';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { outputDecisionScripts } from '@wildshard/sdk/outputProduct';
import { decisionLegacyLines, legacyGeneratedPaths } from '../scripts/decision-legacy-lines.mjs';
import { codeLines } from '../scripts/shard-platform.mjs';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
function project(): string {
  const base = resolve('tmp/decision-project-test'); mkdirSync(base, { recursive: true });
  const root = mkdtempSync(`${base}/case-`); directories.push(root); mkdirSync(resolve(root, 'behaviour')); return root;
}
const row = { id: 'test.project', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
  source: 'behaviour/main.as', binding: { encounter: 'test.encounter' }, on: ['start'], onFail: 'reset',
  reads: [], commands: ['timer'], timers: ['beat'], stateVersion: 1, state: [], params: {} };
const code = "import {Timer,Do} from './generated/testProject';\nexport function onStart():void {Do.timer(Timer.beat,1);}";

test('the project intake compiles declared decisions without reading obsolete producer bytes', async () => {
  const root = project(); writeFileSync(resolve(root, 'behaviour/main.as'), code);
  const source = emptyShardfile({ slug: 'test', name: 'Test', author: 'Test', revision: 1, seed: 1 });
  const input = { blobs: [{ name: 'behaviour/test.wasm', kind: 'wasm', source: `assets/${'0'.repeat(64)}`, options: { script: { abi: 1, pages: 1 } } }],
    platform: emitPlatformSections(new Map([['sim/scripts', [row]]])) };
  const built = await prepareProjectOutput(root, input, { source, options: projectDecisionOptions({ asLineCeiling: 2 }) });
  expect(built.blobs).toHaveLength(1); expect(built.blobs[0]?.file.name).toBe('behaviour/test.wasm');
  expect(outputDecisionScripts(built.options.platform)[0]?.module).toBe(built.blobs[0]?.file.path);
  expect(outputDecisionScripts(built.options.platform)[0]?.module).not.toBe(row.module);
  await expect(prepareProjectOutput(root, input, { source, options: projectDecisionOptions(undefined) })).rejects.toThrow('buildOptions.asLineCeiling');
  await expect(prepareProjectOutput(root, input, { source, options: projectDecisionOptions({ asLineCeiling: 999 }, 19) })).rejects.toThrow('2 > 1');
});
test('root build budgets and the ruler use the same sealed denominator and exact generated exclusions', () => {
  const root = project(), folder = resolve(root, 'src/shards/example-legacy'); mkdirSync(folder, { recursive: true });
  mkdirSync(resolve(root, 'lint')); mkdirSync(resolve(root, 'scripts'));
  const files: Record<string, string> = { 'manifest.ts': 'export const a=1; // tail\n', 'plugin.ts': '// comment\nexport const b="// kept";\nexport const c=2;\n',
    'generated.ts': 'export const generated=1;\n', 'types.d.ts': 'declare const hidden:number;\n', 'law.test.ts': 'test();\n' };
  for (const [path, text] of Object.entries(files)) writeFileSync(resolve(folder, path), text);
  writeFileSync(resolve(root, 'lint/legacy-shards.json'), JSON.stringify({ version: 1, sealed: true, shards: { 'example-legacy': { primary: 'example', source: 'a'.repeat(40), files: Object.fromEntries(Object.keys(files).map(path => [path, 'b'.repeat(64)])) } } }));
  writeFileSync(resolve(root, 'scripts/source-generation-outputs.json'), JSON.stringify({ schema: 'source-generation-outputs/1', producers: { 'build.mjs': ['src/shards/example/generated.ts'] } }));
  const generated = legacyGeneratedPaths(root);
  const old = Object.entries(files).filter(([path]) => /\.tsx?$/u.test(path) && !path.endsWith('.d.ts') && !path.endsWith('.test.ts') && !generated.has(`src/shards/example-legacy/${path}`))
    .reduce((sum, [path, text]) => sum + codeLines(text, path), 0);
  expect(old).toBe(3); expect(decisionLegacyLines(root, 'example')).toBe(old); expect(decisionLegacyLines(root, 'standalone')).toBeUndefined();
  expect(generated.has('src/shards/example-legacy/generated.ts')).toBe(true);
});


test('ABI0-only author sources do not enter the v1 compiler or require its budget', async () => {
  const root = project(); writeFileSync(resolve(root, 'behaviour/legacy.as'), 'export function update():void {}');
  const source = emptyShardfile({ slug: 'test', name: 'Test', author: 'Test', revision: 1, seed: 1 });
  const built = await prepareProjectOutput(root, undefined, { source, options: {} });
  expect(built.blobs).toEqual([]);
  expect(built.options.platform).toBeUndefined();
});
