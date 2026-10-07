// oxlint-disable-next-line import/no-nodejs-modules -- Run the actual architecture guard on isolated author projects.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own and clean their temporary directories.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture path.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Repository paths passed to the guard.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Run with the installed Node executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { SHARDFILE_VERSION } from '@wildshard/sdk/version';
import { SHARDFILE_VERSION as canonicalVersion } from '../src/game/shardfile/version';
import { layerOf, resolveSpecifier } from '../scripts/check-graph.mjs';

it('resolves the fifth workspace layer without a barrel', () => {
  expect(SHARDFILE_VERSION).toBe(canonicalVersion);
  expect(layerOf('src/sdk/version.ts')).toBe('sdk');
  expect(resolveSpecifier('src/shards/example/shard.config.ts', '@wildshard/sdk/version', () => true)).toBe('src/sdk/version.ts');
});

it('refuses author imports past the SDK and upward platform imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'sdk-boundary-'));
  try {
    const cases = [
      ['src/shards/example/shard.config.ts', "import { CHUNK_SIZE } from '@wildshard/engine/core/config'; export const n = CHUNK_SIZE;"],
      ['src/shards/example/data/row.ts', "import type { ShardManifest } from '@wildshard/game/shard/manifest'; export type Row = ShardManifest;"],
      ['src/kit/up.ts', "import { SHARDFILE_VERSION } from '@wildshard/sdk/version'; export const v = SHARDFILE_VERSION;"],
      ['src/shards/example/data/trusted.ts', "import '@wildshard/sdk/runtime/play';"],
      ['src/shards/example/generators/trusted.ts', "import '@wildshard/sdk/runtime/play';"],
      ['src/shards/example/runtime/kit.ts', "import '@wildshard/kit/items/declared';"],
      ['src/shards/example/runtime/commons.ts', "import '@wildshard/commons/creatures';"],
      ['src/shards/example/behaviour/commons.ts', "import '@wildshard/commons/creatures';"],
      ['src/shards/example/data/good.ts', "import { SHARDFILE_VERSION } from '@wildshard/sdk/version'; export const v = SHARDFILE_VERSION;"],
      ['src/shards/example/runtime/good.ts', "import '@wildshard/sdk/runtime/play';"],
      ['src/shards/example/generators/commons.ts', "import '@wildshard/commons/creatures';"],

    ];
    for (const [file, code] of cases) {
      if (file === undefined || code === undefined) throw new Error('missing fixture');
      const path = join(root, file); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, code);
    }
    const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', resolve('.oxlintrc.ratchet.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    const report = JSON.parse(result.stdout) as { diagnostics: { filename: string; code: string }[] };
    const hits = report.diagnostics.filter((d) => d.code === 'wildshard(layer)').map((d) => d.filename);
    expect(hits.sort((a, b) => a.localeCompare(b))).toEqual([0, 1, 2, 3, 4, 6, 7].map((index) => cases[index]?.[0]).sort((a, b) => String(a).localeCompare(String(b))));
    const transition = report.diagnostics.filter((d) => d.code === 'wildshard(runtime-commons)').map((d) => d.filename);
    expect(transition.sort((a, b) => a.localeCompare(b))).toEqual([cases[5]?.[0], cases[6]?.[0]].sort((a, b) => String(a).localeCompare(String(b))));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
