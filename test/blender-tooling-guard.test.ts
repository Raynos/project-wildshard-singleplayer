// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real lint rule against an isolated authored tool and runtime pair.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only synthetic fixture source is written outside the repository.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns its temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual lint plugin and fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke the same Node executable as the test runner.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('admits offline Blender clip sampling and still refuses runtime and TypeScript mixers', () => {
  const root = mkdtempSync(join(tmpdir(), 'blender-tooling-'));
  const files = ['src/shards/alpha/blender/rig/gate.mjs', 'src/shards/alpha/runtime/gate.mjs', 'src/shards/alpha/blender/rig/gate.ts'];
  try {
    for (const file of files) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "import { AnimationMixer } from 'three'; const mixer = new AnimationMixer(root);\n");
    }
    writeFileSync(join(root, '.oxlintrc.json'), JSON.stringify({ jsPlugins: [resolve('lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/no-raw-animation-mixer': 'error' } }));
    const out = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, '.oxlintrc.json'), '-f', 'json', ...files], { cwd: root, encoding: 'utf8' });
    if (out.error) throw out.error;
    const diagnostics = (JSON.parse(out.stdout) as { diagnostics: { code: string; filename: string }[] }).diagnostics;
    expect(out.status).toBe(1);
    expect(diagnostics.filter(row => row.code === 'wildshard(no-raw-animation-mixer)').map(row => row.filename).sort()).toEqual(files.slice(1).sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});
