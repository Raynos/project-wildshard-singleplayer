import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The source census fixture owns these few temporary files.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct paths confined to the fixture directory.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the census from the shared checkout.
import { tmpdir } from 'node:os';
import { checkShares, shardLines } from '../scripts/shard-platform.mjs';

it('G445 counts all TS data, including generated tables, and retains non-code and generator treatment', () => {
  const root = mkdtempSync(join(tmpdir(), 'platform-g445-'));
  const put = (file: string, source: string): void => {
    const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source);
  };
  try {
    const prefix = 'src/shards/_template/';
    put(`${prefix}data/table.ts`, 'export const ONE = 1;\nexport const TWO = 2;');
    put(`${prefix}data/policy.ts`, 'export function choose() { return 1; }');
    put(`${prefix}data/nested/manifest.ts`, 'export default {value: 1};');
    put(`${prefix}data/movers.ts`, '// Generated transport\nexport const ROW = {at: 1};');
    put(`${prefix}data/view.tsx`, 'export const LABEL = "hello";');
    put(`${prefix}data/shader.ts`, 'export const vertexShader = `\nvoid main() {\n  gl_Position = vec4(0.0);\n}`;');
    put(`${prefix}data/direct.glsl`, 'void main() { gl_Position = vec4(0.0); }');
    put(`${prefix}data/rows.json`, '{"codeLookingText":"export const x = 1;"}');
    put(`${prefix}data/rows.bin`, 'opaque bytes');
    put(`${prefix}generators/author.ts`, 'export const ROW = {at: 1};');
    put(`${prefix}generators/shader.ts`, 'export const vertexShader = `void main() { gl_Position = vec4(0.0); }`;');
    put(`${prefix}boot/generated.ts`, 'export const DISCOVERED = 1;');
    put('scripts/source-generation-outputs.json', JSON.stringify({ schema: 'source-generation-outputs/1',
      producers: { 'scripts/producer.mjs': [`${prefix}data/movers.ts`, `${prefix}boot/generated.ts`] } }));
    const rows = shardLines(root, true), row = rows['_template'];
    if (row === undefined) throw new Error('Missing fixture shard');
    const sources = row.customSources ?? [];
    expect(sources.filter(source => source.kind === 'runtime-ts').map(source => source.path)).toEqual([
      'data/movers.ts', 'data/nested/manifest.ts', 'data/policy.ts', 'data/shader.ts', 'data/table.ts', 'data/view.tsx',
    ].map(path => `${prefix}${path}`));
    expect(row.conversion.shardRuntimeLines).toBe(10);
    expect(row.conversion.rawGlslLines).toBe(5);
    expect(row.conversion.additionalGlslLines).toBe(2);
    expect(row.conversion.customRuntimeLines).toBe(12);
    expect(sources.filter(source => source.path === `${prefix}data/shader.ts`)).toHaveLength(1);
    expect(checkShares({ baseline: { _template: 550 }, enforced: { _template: 0 } }, rows)).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('G445 changes the current numerator without inflating the sealed legacy denominator', () => {
  const root = mkdtempSync(join(tmpdir(), 'platform-g445-frozen-'));
  const put = (file: string, source: string): void => {
    const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source);
  };
  try {
    const files = { 'manifest.ts': 'export default {};', 'plugin.ts': 'export const PLUGIN = 1;',
      'data/movers.ts': 'export const ROW = {at: 1};' };
    for (const folder of ['far-reach', 'far-reach-legacy']) {
      for (const [file, source] of Object.entries(files)) put(`src/shards/${folder}/${file}`, source);
    }
    put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true,
      shards: { 'far-reach-legacy': { primary: 'far-reach', source: 'a'.repeat(40),
        files: Object.fromEntries(Object.keys(files).map(file => [file, 'b'.repeat(64)])) } } }));
    put('scripts/source-generation-outputs.json', JSON.stringify({ schema: 'source-generation-outputs/1',
      producers: { 'scripts/producer.mjs': ['src/shards/far-reach/data/movers.ts'] } }));
    const row = shardLines(root)['far-reach'];
    expect(row?.conversion.customRuntimeLines).toBe(2);
    expect(row?.conversion.legacyLines).toBe(2);
    expect(row?.conversion.runtimeShare).toBe(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
