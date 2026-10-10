// oxlint-disable-next-line import/no-nodejs-modules -- Measures isolated source trees and reads the committed baseline.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture paths only.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture paths only.
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkShares, codeLines, milestoneFlags, shardLines, type ShardLines, type ShardPlatformList } from '../scripts/shard-platform.mjs';

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
describe('SF6 platform measures', () => {
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
      expect(alpha(root)).toMatchObject({ publicLines: 0, customLines: 7, runtimeLines: 7, trustedRuntimeLines: 7 });
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
      expect(alpha(root)).toMatchObject({ publicLines: before.publicLines, customLines: before.customLines, publicShare: before.publicShare, runtimeLines: before.runtimeLines });
    });
  });
  it('counts authored AssemblyScript closures in their folders and refuses private or opaque dependencies', () => {
    fixture((root, put) => {
      put('src/shards/alpha/behaviour/main.as', "import { helper } from './helper';\nexport function tick(): i32 { return helper(); }\n");
      put('src/shards/alpha/behaviour/helper.as', 'export function helper(): i32 { return 1; }\n');
      put('src/shards/alpha/runtime/extra.as', 'export function legacy(): i32 { return 2; }\n');
      expect(alpha(root)).toMatchObject({ publicLines: 3, customLines: 1, runtimeLines: 1, legacy: { generators: 0, data: 0, runtime: 0 } });
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
        'test/old.test.ts': 'export const test = 1;\n'.repeat(100) };
      for (const [path, source] of Object.entries(frozen)) put(`src/shards/alpha-legacy/${path}`, source);
      put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'alpha-legacy': {
        primary: 'alpha', source: 'a'.repeat(40), files: Object.fromEntries(Object.keys(frozen).map(path => [path, 'b'.repeat(64)])),
      } } }));
      put('src/shards/alpha/runtime/play.ts', 'export const play = 1;\n'.repeat(2));
      put('src/shards/alpha/data/row.ts', 'export const row = 1;\n');
      put('src/shards/alpha/generators/build.ts', 'export const build = 1;\n');
      put('src/shards/alpha/tests/play.test.ts', 'export const test = 1;\n'.repeat(100));
      put('src/shards/alpha/runtime/output.ts', `// @generated\n${'export const padded = 1;\n'.repeat(100)}`);
      put('src/shards/alpha/behaviour/tick.as', 'export function tick(): i32 { return 1; }\n');
      const row = alpha(root);
      expect(row.conversion).toEqual({ metric: 'runtime-vs-legacy', customRuntimeLines: 2, shardRuntimeLines: 2, legacyLines: 10,
        legacyFolder: 'alpha-legacy', legacyRevision: 'a'.repeat(40), runtimeShare: 0.2, passed: true,
        gameSystemAttribution: { status: 'import-graph', review: 'pending-opus-audit', lines: 0, modules: [] } });
      expect(row.legacyShare).toBe(row.publicShare);
      expect(row.publicShare).toBeLessThan(0.8); // the old share cannot veto the new pass
      expect(Object.keys(shardLines(root))).toEqual(['alpha']);
      const policy = { baseline: { alpha: 1 }, enforced: { alpha: 0 } }; // old ceilings are not the frozen denominator
      expect(checkShares(policy, shardLines(root)).join(',')).toContain('ceiling 0'); // report-only keeps the old gate
      put('src/shards/alpha/adapter.ts', "import '@wildshard/sdk/rows';\n");
      expect(alpha(root).conversion).toMatchObject({ customRuntimeLines: 5, shardRuntimeLines: 3, runtimeShare: 0.5, passed: false });
      expect(checkShares(policy, shardLines(root)).join(',')).not.toContain('exceeds 20 %');
    });
  });
  it('G291 explicitly reports a missing frozen copy without inventing a denominator or pass', () => {
    fixture((root, put) => {
      put('src/shards/alpha/runtime/play.ts', 'export const play = 1;\n');
      expect(alpha(root).conversion).toEqual({ metric: 'legacy-share', customRuntimeLines: 1, shardRuntimeLines: 1, legacyLines: null,
        legacyFolder: null, legacyRevision: null, runtimeShare: null, passed: null,
        gameSystemAttribution: { status: 'import-graph', review: 'pending-opus-audit', lines: 0, modules: [] } });
      expect(checkShares({ baseline: { alpha: 10 }, enforced: { alpha: 0 } }, shardLines(root)).join(',')).toContain('ceiling 0');
    });
  });
  it('G294 deduplicates transitive single-user modules, resolves real facade exports and grants public use to two primaries or the template', () => {
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
      expect(attributed).toEqual({ status: 'import-graph', review: 'pending-opus-audit', lines: 7, modules: [
        { path: 'src/game/impl/a.ts', lines: 3 }, { path: 'src/game/impl/b.ts', lines: 2 }, { path: 'src/sdk/impl/facade.ts', lines: 2 },
      ] });
      expect(alpha(root).conversion.customRuntimeLines).toBe(10);
      // A frozen historical caller is not a second primary user.
      put('src/shards/alpha-legacy/manifest.ts', "import '@wildshard/sdk/family';\n");
      put('src/shards/alpha-legacy/plugin.ts', 'export const plugin = 1;\n');
      put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'alpha-legacy': { primary: 'alpha', source: 'a'.repeat(40),
        files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'b'.repeat(64) } } } }));
      expect(alpha(root).conversion.gameSystemAttribution).toEqual(attributed);
      // Generated storage contributes no lines; a second user's SDK-driven generator is a real usage edge.
      put('src/game/impl/a.generated.ts', 'export const generated = 1;\n'.repeat(100));
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
      expect(alpha(root).conversion.gameSystemAttribution.lines).toBe(0);
    });
  });
  it('prints proof flags separately from transitional gameplay; percentages alone never imply compatible', () => {
    fixture((root, put) => {
      put('src/shards/alpha/runtime/play.ts', 'export const a = 1;\n');
      const row = alpha(root);
      expect(milestoneFlags('alpha', row, root)).toMatchObject({ compatible: false, transitional: true, boot: false, gridReady: false });
      for (const name of ['boot', 'headless', 'replay', 'ledger', 'grid-ready']) put(`test/proof/alpha/${name}.test.ts`, '/* proof fixture: production convention is executable vitest tests */\n');
      expect(milestoneFlags('alpha', row, root)).toEqual({ boot: true, headless: true, replay: true, ledger: true, gridReady: true, compatible: true, transitional: true });
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
      expect(milestoneFlags('alpha', row, root)).toMatchObject({ headless: true, replay: true, ledger: true, compatible: true, transitional: false });
    });
  });
});
