// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real guards in an isolated format-package fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture files only.
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed guard and fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke the installed lint executable without a shell.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { graph, layerOf } from '../scripts/check-graph.mjs';

it('recognises format and enforces its dependency-free, explicit defining exports', () => {
  const root = mkdtempSync(join(tmpdir(), 'format-layer-'));
  const put = (path: string, text: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  const cases = [
    { file: 'src/format/rows.ts', code: "import * as v from 'valibot'; import './leaf';", layer: 0, public: 0 },
    { file: 'src/format/engine.ts', code: "import '@wildshard/engine/math';", layer: 1, public: 0 },
    { file: 'src/format/game.ts', code: "import '@wildshard/game/state';", layer: 1, public: 0 },
    { file: 'src/format/external.ts', code: "import 'three';", layer: 1, public: 0 },
    { file: 'src/engine/bad.ts', code: "import '@wildshard/format/rows';", layer: 1, public: 0 },
    { file: 'src/game/ok.ts', code: "import '@wildshard/format/rows';", layer: 0, public: 0 },
    { file: 'src/sdk/ok.ts', code: "type T = import('@wildshard/format/rows').Row;", layer: 0, public: 0 },
    { file: 'src/game/private.ts', code: "import '@wildshard/format/private';", layer: 0, public: 1 },
    { file: 'src/sdk/relative.ts', code: "import '../format/private';", layer: 0, public: 1 },
  ];
  try {
    cpSync('lint', join(root, 'lint'), { recursive: true });
    for (const name of ['vite', '@typescript/typescript6']) {
      const target = join(root, 'node_modules', name); mkdirSync(dirname(target), { recursive: true });
      symlinkSync(resolve('node_modules', name), target, 'dir');
    }
    put('src/format/package.json', JSON.stringify({ name: '@wildshard/format', exports: { './rows': './rows.ts' } }));
    put('src/engine/package.json', JSON.stringify({ name: '@wildshard/engine', exports: { './math': './math.ts' } }));
    put('src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './state': './state.ts' } }));
    put('src/format/leaf.ts', 'export const leaf = 1;');
    for (const row of cases) put(row.file, row.code);
    put('config.json', JSON.stringify({ jsPlugins: [join(root, 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/layer': 'error', 'wildshard/public-index': 'error' } }));
    const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, 'config.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    const output: unknown = JSON.parse(result.stdout);
    if (output === null || typeof output !== 'object' || !('diagnostics' in output) || !Array.isArray(output.diagnostics)) throw new Error('Missing diagnostics');
    const diagnostics: unknown[] = output.diagnostics;
    expect(result.status, result.stderr).toBe(1);
    for (const row of cases) for (const [rule, count] of [['layer', row.layer], ['public-index', row.public]] as const) {
      expect(diagnostics.filter(d => d !== null && typeof d === 'object' && 'filename' in d && 'code' in d && d.filename === row.file && d.code === `wildshard(${rule})`), row.file).toHaveLength(count);
    }
    expect(layerOf('src/format/rows.ts')).toBe('format');
    const files: Record<string, string> = { 'src/game/ok.ts': "import '@wildshard/format/rows';", 'src/format/rows.ts': 'export const row = 1;' };
    expect(graph(Object.keys(files), p => files[p] ?? '', p => p in files)).toEqual({ edges: { 'game → format': 1 }, violations: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
