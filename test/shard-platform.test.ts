// oxlint-disable-next-line import/no-nodejs-modules -- Restore this fixture's syntax-cache setting after each measurement.
import { env } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Measures isolated source trees and reads the committed baseline.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture paths only.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture paths only.
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkShares, codeLines, declarationOnlyConfig, portHeadline, portAverage, milestoneFlags, rawShaderLines, shaderCodeLines, shardLines, type ShardLines, type ShardPlatformList } from '../scripts/shard-platform.mjs';
import { shardContent } from '../scripts/shard-platform-content.mjs';

const recorded = JSON.parse(readFileSync('lint/shard-platform.json', 'utf8')) as ShardPlatformList;
function fixture(run: (root: string, put: (path: string, source: string) => void) => void, sdk = true): void {
  const root = mkdtempSync(join(tmpdir(), 'sf6-'));
  const put = (path: string, source: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); };
  try {
    mkdirSync(join(root, 'src/shards/alpha'), { recursive: true });
    if (sdk) {
      put('src/sdk/package.json', JSON.stringify({ name: '@wildshard/sdk', exports: { './rows': './rows.ts' } }));
      put('src/sdk/rows.ts', "export type Row = number;\nimport '@wildshard/engine/private';\n");
    }
    run(root, put);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function alpha(root: string): ShardLines {
  const row = shardLines(root)['alpha'];
  if (!row) throw new Error('Missing alpha fixture');
  return row;
}
function declareOutputs(put: (path: string, source: string) => void, outputs: string[]): void {
  const entry = 'scripts/bake-metric-fixture.mjs';
  put(entry, '// Fixture producer; measurement never executes it.\n');
  put('scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT: fixture catalogue', jobs: [{
    id: 'metric-fixture', shard: null, entry, command: [entry], inputRoots: ['src'], outputs, platform: 'portable',
  }] }));
}
describe('SF6 platform measures', () => {
  it('keeps cached syntax facts exact, invalidates edited source and reparses corrupt entries', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/rows.ts', "import { Row } from '@wildshard/sdk/rows';\nexport const rows: Row[] = [1];\n");
      const previous = env['WS_SHARD_PARSE_CACHE'];
      delete env['WS_SHARD_PARSE_CACHE'];
      const plain = shardLines(root), cache = join(root, 'parse-cache');
      try {
        env['WS_SHARD_PARSE_CACHE'] = cache;
        expect(shardLines(root)).toEqual(plain);
        expect(shardLines(root)).toEqual(plain);
        const initial = readdirSync(cache).length;
        for (const file of readdirSync(cache)) writeFileSync(join(cache, file), '{');
        expect(shardLines(root)).toEqual(plain);
        put('src/shards/alpha/data/rows.ts', "import '@wildshard/engine/private';\nexport const rows = [1];\n");
        const changed = shardLines(root);
        expect(readdirSync(cache).length).toBeGreaterThan(initial);
        delete env['WS_SHARD_PARSE_CACHE'];
        expect(changed).toEqual(shardLines(root));
        expect(changed).not.toEqual(plain);
      } finally {
        if (previous === undefined) delete env['WS_SHARD_PARSE_CACHE'];
        else env['WS_SHARD_PARSE_CACHE'] = previous;
      }
    });
  });
  it('holds every enforced ceiling and names only existing shards', () => {
    expect(checkShares(recorded, shardLines())).toEqual([]);
  });
  it('counts code lines, including strings with comment-looking text, without blank or comment padding', () => {
    expect(codeLines('// header\n\n/* two\ncomments */\nconst url = "https://x"; // suffix\nconst n = 1;')).toBe(2);
  });
  it('counts author generators regardless of their imports and SDK-only AssemblyScript behaviour as public', () => {
    fixture((root, put) => {
      put('src/shards/alpha/generators/build.ts', "import fs from 'node:fs';\nimport '@wildshard/engine/private';\nexport const bake = 1;\n");
      put('src/shards/alpha/behaviour/swim.as', "import { Row } from '@wildshard/sdk/rows';\nexport function swim(dt: f32): f32 { return dt; }\n");
      expect(alpha(root)).toMatchObject({ publicLines: 5, customLines: 0, publicShare: 1 });
    });
  });
  it('counts trusted SDK imports as custom wherever authored, including local helper closures and AS', () => {
    fixture((root, put) => {
      put('src/sdk/package.json', JSON.stringify({ name: '@wildshard/sdk', exports: { './rows': './rows.ts', './runtime/play': './runtime/play.ts' } }));
      put('src/sdk/runtime/play.ts', 'export const play = 1;\n');
      put('src/shards/alpha/data/helper.ts', "import '@wildshard/sdk/runtime/play';\nexport const helper = 1;\n");
      put('src/shards/alpha/data/row.ts', "import './helper';\nexport const row = 1;\n");
      put('src/shards/alpha/generators/build.ts', "import '@wildshard/sdk/runtime/play';\n");
      put('src/shards/alpha/behaviour/tick.as', "import '@wildshard/sdk/runtime/play';\nexport function tick(): i32 { return 1; }\n");
      expect(alpha(root)).toMatchObject({ publicLines: 0, customLines: 7, runtimeLines: 5, trustedRuntimeLines: 5, assemblyScriptLines: 2 });
      expect(checkShares({ baseline: { alpha: 100 }, enforced: { alpha: 0 } }, shardLines(root)).join(',')).toContain('trusted-SDK lines, ceiling 0');
    });
  });
  it('counts published commons packs as public build-time authoring but never as runtime behaviour', () => {
    fixture((root, put) => {
      put('src/commons/package.json', JSON.stringify({ name: '@wildshard/commons', exports: { './creatures': './creatures.ts' } }));
      put('src/commons/creatures.ts', 'export const creature = 1;\n');
      for (const folder of ['generators', 'data', 'quests']) put(`src/shards/alpha/${folder}/rows.ts`, "import '@wildshard/commons/creatures';\nexport const rows = 1;\n");
      put('src/shards/alpha/behaviour/tick.ts', "import '@wildshard/commons/creatures';\n");
      put('src/shards/alpha/runtime/play.ts', "import '@wildshard/commons/creatures';\n");
      expect(alpha(root)).toMatchObject({ publicLines: 6, customLines: 2, runtimeLines: 1 });
    });
  });
  it('classifies a resolved local trusted namespace without confusing a similarly named directory', () => {
    fixture((root, put) => {
      put('src/sdk/runtime/play.ts', 'export const play = 1;\n');
      put('src/sdk/runtime-other/play.ts', 'export const play = 1;\n');
      put('src/shards/alpha/data/trusted.ts', "import '../../../sdk/runtime/play';\n");
      put('src/shards/alpha/data/other.ts', "import '../../../sdk/runtime-other/play';\n");
      expect(alpha(root)).toMatchObject({ customLines: 2, runtimeLines: 1, trustedRuntimeLines: 1 });
    });
  });
  it('includes type imports, transitive imports, cycles, and nonliteral imports in the public closure', () => {
    fixture((root, put) => {
      put('src/engine/private.ts', 'export type Secret = number;\n');
      put('src/shards/alpha/data/a.ts', "import type { B } from './b';\nexport type A = B;\n");
      put('src/shards/alpha/data/b.ts', "import type { A } from './a';\nimport type { Secret } from '@wildshard/engine/private';\nexport type B = Secret | A;\n");
      put('src/shards/alpha/quests/q.ts', 'export const q = import(variable);\n');
      expect(alpha(root)).toMatchObject({ publicLines: 0, customLines: 6, publicShare: 0 });
    });
  });
  it('reports zero SDK share before the SDK package exists and refuses an unpublished SDK import', () => {
    fixture((root, put) => { put('src/shards/alpha/data/a.ts', 'export const a = 1;\n'); expect(alpha(root).publicShare).toBe(0); }, false);
    fixture((root, put) => { put('src/shards/alpha/data/a.ts', "import '@wildshard/sdk/not-exported';\n"); expect(alpha(root).customLines).toBe(1); });
  });
  it('keeps commented expression imports and CommonJS imports in the measured closure', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/a.ts', 'export const a = import /* boundary */ (variable);\n');
      put('src/shards/alpha/data/b.ts', 'export const b = require // boundary\n(variable);\n');
      put('src/shards/alpha/data/c.ts', "import C /* boundary */ = require('@wildshard/sdk/rows');\n");
      expect(alpha(root)).toMatchObject({ publicLines: 1, customLines: 3 });
    });
  });
  it('generated and baked output cannot pad either measure', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/a.ts', 'export const a = 1;\n');
      put('src/shards/alpha/runtime/play.ts', 'export const p = 1;\n');
      const before = alpha(root);
      put('src/shards/alpha/data/padded.generated.ts', 'export const x = 1;\n'.repeat(100));
      put('src/shards/alpha/runtime/baked/terrain.ts', 'export const x = 1;\n'.repeat(100));
      put('src/shards/alpha/runtime/output.ts', `// DO-NOT-EDIT: regenerate and compare\n${'export const x = 1;\n'.repeat(100)}`);
      put('src/shards/alpha/data/padded.ts', `// @generated\n${'export const x = 1;\n'.repeat(100)}`);
      put('src/shards/alpha/data/movers.ts', `// Generated by scripts/bake/movers.mjs from recipes.\n${'export const x = 1;\n'.repeat(100)}`);
      put('src/shards/alpha/behaviour/generated.as', `/* Generated by the author tool */\n${'export function x(): i32 { return 1; }\n'.repeat(100)}`);
      declareOutputs(put, ['data/padded.generated.ts', 'runtime/baked/terrain.ts', 'runtime/output.ts', 'data/padded.ts', 'data/movers.ts', 'behaviour/generated.as']
        .map(path => `src/shards/alpha/${path}`));
      expect(alpha(root)).toMatchObject({ publicLines: before.publicLines, customLines: before.customLines, publicShare: before.publicShare, runtimeLines: before.runtimeLines });
    });
  });
  it('G291/G294 charges authored baked names and generated-looking headers, exempting only declared outputs', () => {
    fixture((root, put) => {
      for (const path of ['world/baked.ts', 'runtime/helper.baked.ts', 'runtime/generated/helper.ts', 'runtime/helper.generated.ts', 'runtime/marked.ts']) {
        put(`src/shards/alpha/${path}`, '// DO-NOT-EDIT: a header is not producer evidence\nexport const authored = 1;\n');
      }
      put('src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './baked': './baked.ts' } }));
      put('src/game/baked.ts', '// Generated by is not producer evidence either\nexport const privateRuntime = 1;\n');
      put('src/shards/alpha/runtime/play.ts', "import '@wildshard/game/baked';\n");
      expect(alpha(root).conversion).toMatchObject({ shardRuntimeLines: 6, customRuntimeLines: 7,
        gameSystemAttribution: { lines: 1, modules: [{ path: 'src/game/baked.ts', lines: 1 }] } });
      put('src/shards/alpha/world/cache.ts', 'export const generated = 1;\n'.repeat(100));
      declareOutputs(put, ['src/shards/alpha/world/cache.ts']);
      expect(alpha(root).conversion).toMatchObject({ shardRuntimeLines: 6, customRuntimeLines: 7 });
    });
  });
  it('keeps retained source-table producer identities exact instead of granting filename exemptions', () => {
    fixture((root, put) => {
      put('src/shards/alpha/runtime/baked.ts', 'export const authored = 1;\n');
      put('src/shards/alpha/runtime/table.ts', 'export const generated = 1;\n'.repeat(100));
      put('scripts/source-generation-outputs.json', JSON.stringify({ schema: 'source-generation-outputs/1',
        producers: { 'scripts/retained-producer.mjs': ['src/shards/alpha/runtime/table.ts'] } }));
      expect(alpha(root).conversion.shardRuntimeLines).toBe(1);
      put('src/shards/alpha/runtime/other.generated.ts', 'export const authored = 1;\n');
      expect(alpha(root).conversion.shardRuntimeLines).toBe(2);
      put('scripts/source-generation-outputs.json', JSON.stringify({ schema: 'source-generation-outputs/1',
        producers: { 'scripts/retained-producer.mjs': ['../outside.ts'] } }));
      expect(() => alpha(root)).toThrow();
    });
  });
  it('counts authored AssemblyScript closures in their folders and refuses private or opaque dependencies', () => {
    fixture((root, put) => {
      put('src/shards/alpha/behaviour/main.as', "import { helper } from './helper';\nexport function tick(): i32 { return helper(); }\n");
      put('src/shards/alpha/behaviour/helper.as', 'export function helper(): i32 { return 1; }\n');
      put('src/shards/alpha/runtime/extra.as', 'export function legacy(): i32 { return 2; }\n');
      expect(alpha(root)).toMatchObject({ publicLines: 3, customLines: 1, runtimeLines: 0, assemblyScriptLines: 4, legacy: { generators: 0, data: 0, runtime: 0 } });
      put('src/shards/alpha/behaviour/helper.as', "import '@wildshard/engine/private';\nexport function helper(): i32 { return 1; }\n");
      expect(alpha(root)).toMatchObject({ publicLines: 0, customLines: 5 });
    });
  });
  it('measures beyond AssemblyScript function decorators and keeps comment-looking string contents', () => {
    expect(codeLines('// header\n@external("env", "query") declare function query(): i32;\n@inline function sample(): string {\n  const url = "https://x"; // suffix\n  /* padding\n     more padding */\n  return url;\n}\n', 'measure.as')).toBe(5);
    expect(() => codeLines('export function broken( {', 'broken.as')).toThrow('invalid AssemblyScript');
  });
  it('enforces both measures after conversion without changing the immutable baseline', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/a.ts', 'export const a = 1;\n'.repeat(8));
      put('src/shards/alpha/runtime/play.ts', 'export const p = 1;\n'.repeat(2));
      const lines = shardLines(root);
      expect(checkShares({ baseline: { alpha: 10 }, enforced: { alpha: 2 } }, lines)).toEqual([]);
      expect(checkShares({ baseline: { alpha: 10 }, enforced: { alpha: 1 } }, lines).join(',')).toContain('ceiling 1');
      put('src/shards/alpha/runtime/play.ts', 'export const p = 1;\n'.repeat(3));
      expect(checkShares({ baseline: { alpha: 100 }, enforced: { alpha: 20 } }, shardLines(root)).join(',')).toContain('floor 80');
      expect(checkShares({ baseline: { gone: 1 }, enforced: {} }, lines).join(',')).toContain("doesn't exist");
      expect(checkShares({ baseline: {}, enforced: {} }, lines).join(',')).toContain('unknown shard');
    });
  });
  it('G291 counts every authored runtime TS file against its registered frozen copy, independently of SDK share', () => {
    fixture((root, put) => {
      const frozen = { 'manifest.ts': 'export const manifest = 1;\n', 'plugin.ts': 'export const plugin = 1;\n',
        'data/rows.ts': 'export const row = 1;\n'.repeat(2), 'generators/build.ts': 'export const build = 1;\n'.repeat(2),
        'runtime/old.ts': 'export const old = 1;\n'.repeat(4), 'runtime/output.baked.ts': 'export const padded = 1;\n'.repeat(100),
        'test/old.test.ts': 'export const test = 1;\n'.repeat(100),
        'data/movers.ts': `// DO-NOT-EDIT: generated table\n${'export const mover = 1;\n'.repeat(100)}`,
        'data/key.ts': '/* authored row */\n\nexport const key = 1; // suffix\n',
        'runtime/old.as': 'export function old(): i32 { return 1; }\n',
        'runtime/old.d.ts': 'export declare const old: number;\n' };
      for (const [path, source] of Object.entries(frozen)) put(`src/shards/alpha-legacy/${path}`, source);
      put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'alpha-legacy': {
        primary: 'alpha', source: 'a'.repeat(40), files: Object.fromEntries(Object.keys(frozen).map(path => [path, 'b'.repeat(64)])),
      } } }));
      put('src/shards/alpha/runtime/play.ts', 'export const play = 1;\n'.repeat(2));
      put('src/shards/alpha/data/row.ts', 'export const row = 1;\n');
      put('src/shards/alpha/generators/build.ts', 'export const build = 1;\n');
      put('src/shards/alpha/tests/play.test.ts', 'export const test = 1;\n'.repeat(100));
      put('src/shards/alpha/runtime/output.ts', `// @generated\n${'export const padded = 1;\n'.repeat(100)}`);
      declareOutputs(put, ['runtime/output.baked.ts', 'data/movers.ts', 'runtime/output.ts'].map(path => `src/shards/alpha/${path}`));
      put('src/shards/alpha/behaviour/tick.as', 'export function tick(): i32 { return 1; }\n');
      const row = alpha(root);
      expect(row.conversion).toEqual({ metric: 'runtime-vs-legacy', customRuntimeLines: 2, shardRuntimeLines: 2, rawGlslLines: 0, additionalGlslLines: 0, legacyLines: 11,
        legacyFolder: 'alpha-legacy', legacyRevision: 'a'.repeat(40), runtimeShare: 2 / 11, passed: true,
        gameSystemAttribution: { status: 'import-graph', review: 'G294-primary-reach', lines: 0, modules: [], exports: [] } });
      expect(row.legacyShare).toBe(row.publicShare);
      expect(row.publicShare).toBeLessThan(0.8); // the old share cannot veto the new pass
      expect(Object.keys(shardLines(root))).toEqual(['alpha']);
      const policy = { baseline: { alpha: 1 }, enforced: { alpha: 0 } }; // old ceilings are not the frozen denominator
      expect(checkShares(policy, shardLines(root)).join(',')).toContain('ceiling 0'); // report-only keeps the old gate
      put('src/shards/alpha/adapter.ts', "import '@wildshard/sdk/rows';\n");
      expect(alpha(root).conversion).toMatchObject({ customRuntimeLines: 5, shardRuntimeLines: 3, runtimeShare: 5 / 11, passed: false });
      expect(checkShares(policy, shardLines(root)).join(',')).not.toContain('exceeds 20 %');
    });
  });
  it('G291 explicitly reports a missing frozen copy without inventing a denominator or pass', () => {
    fixture((root, put) => {
      put('src/shards/alpha/runtime/play.ts', 'export const play = 1;\n');
      expect(alpha(root).conversion).toEqual({ metric: 'legacy-share', customRuntimeLines: 1, shardRuntimeLines: 1, rawGlslLines: 0, additionalGlslLines: 0, legacyLines: null,
        legacyFolder: null, legacyRevision: null, runtimeShare: null, passed: null,
        gameSystemAttribution: { status: 'import-graph', review: 'G294-primary-reach', lines: 0, modules: [], exports: [] } });
      expect(checkShares({ baseline: { alpha: 10 }, enforced: { alpha: 0 } }, shardLines(root)).join(',')).toContain('ceiling 0');
    });
  });
  it('G294/G312 deduplicates transitive single-user modules and requires two real primaries, never a template', () => {
    fixture((root, put) => {
      put('src/sdk/package.json', JSON.stringify({ name: '@wildshard/sdk', exports: { './family': './impl/facade.ts' } }));
      put('src/sdk/impl/facade.ts', "import { a } from '@wildshard/game/a';\nexport const family = a;\n");
      put('src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './a': './impl/a.ts' } }));
      put('src/game/impl/a.ts', "import './b';\nimport '@wildshard/engine/private';\nexport const a = 1;\n");
      put('src/game/impl/b.ts', "import './a';\nexport const b = 1;\n");
      put('src/engine/private.ts', 'export const engine = 1;\n'.repeat(100));
      put('src/shards/alpha/runtime/a.ts', "import '@wildshard/sdk/family';\nimport '@wildshard/game/a';\n");
      put('src/shards/alpha/runtime/b.ts', "import '@wildshard/sdk/family';\n");
      put('src/shards/alpha/tests/fake.test.ts', "import '@wildshard/sdk/not-runtime';\n");
      const attributed = alpha(root).conversion.gameSystemAttribution;
      expect(attributed).toEqual({ status: 'import-graph', review: 'G294-primary-reach', lines: 107, modules: [
        { path: 'src/engine/private.ts', lines: 100 },
        { path: 'src/game/impl/a.ts', lines: 3 }, { path: 'src/game/impl/b.ts', lines: 2 }, { path: 'src/sdk/impl/facade.ts', lines: 2 },
      ], exports: [] });
      expect(alpha(root).conversion.customRuntimeLines).toBe(110);
      // A frozen historical caller is not a second primary user.
      put('src/shards/alpha-legacy/manifest.ts', "import '@wildshard/sdk/family';\n");
      put('src/shards/alpha-legacy/plugin.ts', 'export const plugin = 1;\n');
      put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'alpha-legacy': { primary: 'alpha', source: 'a'.repeat(40),
        files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'b'.repeat(64) } } } }));
      expect(alpha(root).conversion.gameSystemAttribution).toEqual(attributed);
      // Generated storage contributes no lines; a second user's SDK-driven generator is a real usage edge.
      put('src/game/impl/a.generated.ts', 'export const generated = 1;\n'.repeat(100));
      declareOutputs(put, ['src/game/impl/a.generated.ts']);
      put('src/shards/alpha/data/output.ts', "import '../../../game/impl/a.generated';\n");
      expect(alpha(root).conversion.gameSystemAttribution).toEqual(attributed);
      put('src/shards/beta/generators/build.ts', "import '@wildshard/sdk/family';\n");
      expect(alpha(root).conversion.gameSystemAttribution.lines).toBe(0);
      expect(shardLines(root)['beta']?.conversion.gameSystemAttribution.lines).toBe(0);
    });
    fixture((root, put) => {
      put('src/sdk/rows.ts', 'export const family = 1;\n');
      put('src/shards/alpha/runtime/a.ts', "import '@wildshard/sdk/rows';\n");
      expect(alpha(root).conversion.gameSystemAttribution.lines).toBe(1);
      put('src/shards/_template/data/row.ts', "import '@wildshard/sdk/rows';\n");
      expect(alpha(root).conversion.gameSystemAttribution.lines).toBe(1);
      expect(shardLines(root)['_template']?.conversion.gameSystemAttribution.lines).toBe(0);
    });
  });
  it('G294 charges a one-shard export and its helpers inside a shared file, directly or through platform code', () => {
    fixture((root, put) => {
      put('src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './look': './look.ts', './host': './host.ts' } }));
      put('src/game/look.ts', [
        "import { other } from './other';",
        '/** A doc comment is not code. */',
        'const helper = (n: number): number =>',
        '  n * 2;',
        'const sharedHelper = 1;',
        'const both = 3;',
        'export function shared(): number { return sharedHelper; }',
        'export function alphaOnly(): number {',
        '  // a comment line is not code',
        '  return helper(both);',
        '}',
        'export interface AlphaRow { size: number }',
        'export function viaHost(): number { return other + both; }',
        'export const unused = 1;',
        '',
      ].join('\n'));
      put('src/game/other.ts', 'export const other = 1;\nexport const idle = 2;\n');
      put('src/game/host.ts', "import { viaHost } from './look';\nexport const hosted = (): number => viaHost();\n");
      put('src/shards/alpha/runtime/a.ts', "import { shared, alphaOnly, type AlphaRow } from '@wildshard/game/look';\n"
        + 'export const a = (row: AlphaRow): number => shared() + alphaOnly() + row.size;\n');
      put('src/shards/beta/runtime/b.ts', "import { shared } from '@wildshard/game/look';\nimport { hosted } from '@wildshard/game/host';\n"
        + 'export const b = shared() + hosted();\n');
      const look = 'src/game/look.ts';
      // A two-user export (and the helper both users reach) stays shared; a helper reached only by alpha's export counts with it.
      expect(alpha(root).conversion.gameSystemAttribution).toEqual({ status: 'import-graph', review: 'G294-primary-reach', lines: 6, modules: [], exports: [
        { path: look, name: 'helper', exported: false, lines: 2 }, { path: look, name: 'alphaOnly', exported: true, lines: 3 },
        { path: look, name: 'AlphaRow', exported: true, lines: 1 },
      ] });
      expect(alpha(root).conversion.customRuntimeLines).toBe(8);
      // Beta reaches viaHost only through another platform module, and other.ts's `other` only through viaHost.
      expect(shardLines(root)['beta']?.conversion.gameSystemAttribution).toEqual({ status: 'import-graph', review: 'G294-primary-reach', lines: 4,
        modules: [{ path: 'src/game/host.ts', lines: 2 }],
        exports: [{ path: look, name: 'viaHost', exported: true, lines: 1 }, { path: 'src/game/other.ts', name: 'other', exported: true, lines: 1 }] });
      // A namespace member names one export; a bare namespace use reaches every export.
      put('src/shards/alpha/runtime/a.ts', "import * as look from '@wildshard/game/look';\nexport const a = look.alphaOnly();\n");
      expect(alpha(root).conversion.gameSystemAttribution.exports.map(entry => entry.name)).toEqual(['helper', 'alphaOnly']);
      expect(shardLines(root)['beta']?.conversion.gameSystemAttribution.exports.map(entry => entry.name)).toEqual(['sharedHelper', 'shared', 'viaHost', 'other']);
      put('src/shards/alpha/runtime/a.ts', "import * as look from '@wildshard/game/look';\nexport const all = look;\n");
      expect(alpha(root).conversion.gameSystemAttribution.exports.map(entry => entry.name)).toEqual(['helper', 'alphaOnly', 'AlphaRow', 'unused']);
      expect(shardLines(root)['beta']?.conversion.gameSystemAttribution).toMatchObject({ lines: 2, exports: [] });
      // A top-level statement runs for every shard that evaluates the file, so what it references is shared.
      put('src/game/look.ts', `${readFileSync(join(root, look), 'utf8')}console.log(helper);\n`);
      expect(alpha(root).conversion.gameSystemAttribution.exports.map(entry => entry.name)).toEqual(['alphaOnly', 'AlphaRow', 'unused']);
    });
  });
  it('charges the live copy while a platform original reached only by registered legacy stays historical', () => {
    fixture((root, put) => {
      const implementation = 'export const retained = 1;\n';
      put('src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './retained': './retained.ts' } }));
      put('src/game/retained.ts', implementation);
      put('src/shards/alpha/runtime/retained.ts', implementation);
      put('src/shards/alpha/runtime/entry.ts', "import './retained';\n");
      put('src/shards/alpha-legacy/manifest.ts', "import '@wildshard/game/retained';\n");
      put('src/shards/alpha-legacy/plugin.ts', 'export const plugin = 1;\n');
      put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'alpha-legacy': {
        primary: 'alpha', source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'b'.repeat(64) },
      } } }));
      const measured = shardLines(root);
      expect(measured['alpha-legacy']).toBeUndefined();
      expect(alpha(root).conversion.gameSystemAttribution).toMatchObject({ lines: 0, modules: [] });
      expect(alpha(root).conversion.customRuntimeLines).toBe(2);
      // A live import of the original is still charged, even when a frozen caller also reaches it.
      put('src/shards/alpha/runtime/entry.ts', "import '@wildshard/game/retained';\n");
      expect(alpha(root).conversion.gameSystemAttribution).toMatchObject({ lines: 1, modules: [{ path: 'src/game/retained.ts', lines: 1 }] });
    });
  });
  it('G315 reports authored AssemblyScript separately with no cap or change to the TypeScript ratio', () => {
    fixture((root, put) => {
      put('src/shards/alpha/runtime/a.ts', 'export const a = 1;\n');
      const before = alpha(root).conversion;
      put('src/shards/alpha/behaviour/brain.as', '// ignored comment\nexport function think(): i32 {\n  return 1;\n}\n');
      put('src/shards/alpha/runtime/brain.as', 'export function act(): i32 {\n  return 2;\n}\n');
      put('src/shards/alpha/behaviour/brain.generated.as', 'export const generated: i32 = 1;\n');
      declareOutputs(put, ['src/shards/alpha/behaviour/brain.generated.as']);
      put('src/shards/alpha/tests/fixture.as', 'export const fixture: i32 = 1;\n');
      expect(alpha(root).assemblyScriptLines).toBe(6);
      expect(alpha(root).runtimeLines).toBe(1);
      expect(alpha(root).conversion).toEqual(before);
    });
  });
  it('prints proof flags separately from transitional gameplay; percentages alone never imply compatible', () => {
    fixture((root, put) => {
      put('src/shards/alpha/runtime/play.ts', 'export const a = 1;\n');
      const row = alpha(root);
      expect(milestoneFlags('alpha', row, root)).toMatchObject({ compatible: false, transitional: true, boot: false, gridReady: false });
      for (const name of ['boot', 'headless', 'replay', 'ledger', 'grid-ready']) put(`test/proof/alpha/${name}.test.ts`, '/* proof fixture: production convention is executable vitest tests */\n');
      expect(milestoneFlags('alpha', row, root)).toEqual({ boot: true, headless: true, replay: true, ledger: true, gridReady: true, compatible: false, transitional: true, witnessCompatible: true });
    });
  });
  it('reads a canonical witness result over the test files, so a fail-closed witness never reads as a pass', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/a.ts', 'export const a = 1;\n');
      const row = alpha(root);
      for (const name of ['headless', 'replay', 'ledger']) put(`test/proof/alpha/${name}.test.ts`, '/* fail-closed witness */\n');
      const witness = (status: string, emitted: boolean, compatible: boolean, exitStatus: number): string => JSON.stringify({ audit: { exitStatus }, compatible,
        headless: { status }, replay: { status }, ledger: { status: status === 'passed' ? 'passed' : 'partial', gameplayEmissionProven: emitted } });
      put('test/proof/alpha/compatibility.json', witness('blocked', false, false, 1));
      expect(milestoneFlags('alpha', row, root)).toMatchObject({ headless: false, replay: false, ledger: false, compatible: false, transitional: true });
      put('test/proof/alpha/compatibility.json', witness('passed', false, false, 1));
      expect(milestoneFlags('alpha', row, root)).toMatchObject({ headless: true, replay: true, ledger: false, compatible: false, transitional: true });
      put('test/proof/alpha/compatibility.json', witness('passed', true, true, 0));
      expect(milestoneFlags('alpha', row, root)).toMatchObject({ headless: true, replay: true, ledger: true, compatible: true, transitional: false, witnessCompatible: true });
    });
  });
  it('G306 counts GLSL data and files as custom exactly once, never graph nodes or generated shader outputs', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/shader.ts', 'export const vertexBegin = `vec3 transformed = position;\n// padding\ntransformed.x += 1.0;`;\n');
      put('src/shards/alpha/data/material.ts', 'export const graph = { nodes: [{ op: "add" }] };\n');
      put('src/shards/alpha/data/terrain.glsl', '// padding\nvoid main() {\n gl_Position = vec4(1.0);\n}\n');
      put('src/shards/alpha/runtime/view.ts', 'export const fragmentShader = `void main() {\n gl_FragColor = vec4(1.0);\n}`;\n');
      put('src/shards/alpha/data/terrain.generated.glsl', 'void main() {}\n'.repeat(100));
      declareOutputs(put, ['src/shards/alpha/data/terrain.generated.glsl']);
      expect(alpha(root).conversion).toMatchObject({ shardRuntimeLines: 3, rawGlslLines: 8, additionalGlslLines: 5, customRuntimeLines: 8 });
      expect(shaderCodeLines('#include "https://source" // comment\n/* pad\n pad */\nvec3 x;')).toBe(2);
      expect(rawShaderLines('export const description = "No raw shader source";', 'data.ts')).toBe(0);
    });
  });
  it('G304 keeps a passing trusted-simulation witness transitional, including Nine-style compatible:true records', () => {
    fixture((root, put) => {
      put('src/shards/alpha/data/rows.ts', 'export const rows = 1;\n');
      for (const name of ['headless', 'replay', 'ledger']) put(`test/proof/alpha/${name}.test.ts`, '/* executable witness fixture */');
      put('test/proof/alpha/compatibility.json', JSON.stringify({ entry: 'runtime/headless.ts', compatible: true, audit: { exitStatus: 0 },
        headless: { status: 'passed' }, replay: { status: 'passed' }, ledger: { status: 'passed', gameplayEmissionProven: true } }));
      expect(milestoneFlags('alpha', alpha(root), root)).toMatchObject({ headless: true, replay: true, ledger: true, witnessCompatible: true, compatible: false, transitional: true });
    });
  });

  it('G304 counts only built content, names private binaries, and never credits missing or malformed products', () => {
    fixture((root, put) => {
      expect(shardContent('alpha', root)).toMatchObject({ status: 'missing', tiles: null, files: null, colliders: null, structuralWorld: null });
      put('public/shardfiles/alpha/shard.json', '{broken');
      expect(shardContent('alpha', root).status).toBe('invalid');
      const product = { tiles: [{ lod: 0 }, { lod: 1 }], files: [{ hash: 'mesh', kind: 'glb' }, { hash: 'texture', kind: 'ktx2' }],
        terrain: null, nativeGround: null, runtime: null,
        props: { colliders: [{ shapes: [{ kind: 'box' }, { kind: 'treads', count: 3 }] }] },
        meshCollision: { tiles: [{ file: 'collider' }], panels: [{ file: 'panel' }] } };
      put('public/shardfiles/alpha/shard.json', JSON.stringify(product));
      expect(shardContent('alpha', root)).toMatchObject({ status: 'built', tiles: { total: 2, l0: 1, l1: 1 }, files: { total: 2, kinds: { glb: 1, ktx2: 1 } },
        colliders: { descriptors: 1, shapes: 4, meshTiles: 1, meshPanels: 1, heightfield: false }, structuralWorld: true, trustedSimulation: false, privateBinaries: [] });
      put('src/shards/alpha/runtime/physics.baked.json', '{}');
      put('public/assets/baked/alpha/layout.bin', 'binary fixture');
      put('public/shardfiles/alpha/shard.json', JSON.stringify({ ...product, runtime: { entry: 'runtime/main.ts' }, nativeGround: { file: 'ground' },
        files: [...product.files, { hash: 'private', kind: 'binary' }] }));
      expect(shardContent('alpha', root)).toMatchObject({ status: 'built', structuralWorld: false, trustedSimulation: true,
        privateBinaries: [
          'public/assets/baked/alpha/layout.bin', 'src/shards/alpha/runtime/physics.baked.json',
          'shard.json files:private (opaque binary; decoder ownership requires audit)',
          'shard.json nativeGround:ground (trusted native collider owner)',
        ] });
      put('public/shardfiles/alpha/shard.json', JSON.stringify({ ...product, props: { colliders: [{ shapes: [{ kind: 'treads', count: -1 }] }] } }));
      expect(shardContent('alpha', root).status).toBe('invalid');
    });
  });

  it('G304 credits binaries a schema row hands to the platform decoder as tiles, and the map stamp is not a private binary', () => {
    fixture((root, put) => {
      put('src/shards/alpha/look/map.baked.json', '{"tilesHash":"x"}');
      put('public/shardfiles/alpha/shard.json', JSON.stringify({ tiles: [{ lod: 0 }], runtime: null, nativeGround: null,
        files: [{ hash: 'mesh', kind: 'glb' }, { hash: 'chunk', kind: 'binary' }, { hash: 'door', kind: 'binary' }, { hash: 'height', kind: 'binary' },
          { hash: 'heightCollider', kind: 'binary' }, { hash: 'lut', kind: 'binary' }, { hash: 'opaque', kind: 'binary' }],
        meshCollision: { tiles: [{ file: 'chunk' }], panels: [{ file: 'door' }] },
        terrain: { collider: 'heightCollider', tiles: [{ file: 'height' }] }, look: { grade: { lut: 'lut' } } }));
      expect(shardContent('alpha', root)).toMatchObject({ status: 'built', structuralWorld: false,
        files: { total: 7, kinds: { glb: 1, binary: 6 }, platformBinaries: 5 },
        privateBinaries: ['shard.json files:opaque (opaque binary; decoder ownership requires audit)'] });
    });
  });
});

it('pins G390 points, clamping and the seven-shard average', () => {
  const yes={status:'built',tiles:{total:1},privateBinaries:[]};
  expect([0,20,44,50,71,100,130].map(custom=>portHeadline(custom,yes).percent)).toEqual([100,100,76,70,49,20,20]);
  expect(portHeadline(100,{...yes,tiles:{total:0},privateBinaries:['private.bin']}).percent).toBe(0);
  expect(portHeadline(100,{...yes,tiles:{total:0}}).percent).toBe(10);
  expect(portHeadline(50,{...yes,privateBinaries:['private.bin']}).percent).toBe(60);
  expect(portHeadline(0,{...yes,status:'missing'}).percent).toBeNull();
  const slugs=['_template','sunscar-dunes','far-reach','nine-dragon-stack','nalati-grasslands','driftwood-isle','pine-hollow'];
  const rows=Object.fromEntries(slugs.map(slug=>[slug,{port:portHeadline(50,yes)}]));
  expect(portAverage(rows)).toBe(70);delete rows['pine-hollow'];expect(portAverage(rows)).toBeNull();
});
it('exempts only declaration-only config entries from authored runtime lines',()=>{
  expect(declarationOnlyConfig("import rows from './generators/product';export default rows;")).toBe(true);
  expect(declarationOnlyConfig("import {parseShardfile,emptyShardfile} from '@wildshard/sdk/shardfile';export default parseShardfile({...emptyShardfile('x'),spawn:{x:-1}});")).toBe(true);
  for(const source of ["export default {height:()=>0};","const x=1+2;export default x;","function build(){return 1};export default build;","const x=Math.sin(0);export default x;"])expect(declarationOnlyConfig(source)).toBe(false);
  fixture((root,put)=>{
    put('src/shards/alpha/shard.config.ts',"const rows={height:0};export default rows;\n");
    expect(alpha(root).conversion.shardRuntimeLines).toBe(0);
    put('src/shards/alpha/shard.config.ts',"const height=()=>0;export default {height};\n");
    expect(alpha(root).conversion.shardRuntimeLines).toBe(1);
  });
});
