// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual guard in an isolated fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and delete every source and config in the fixture.
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the fixture and installed lint binary.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Create a temporary fixture outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke Node without a shell.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('allows a literal local generator in the author entry while refusing runtime, row, manifest and sibling imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'authoring-entry-'));
  const put = (file: string, source: string): void => { const target = join(root, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source); };
  const cases = [
    // oxlint-disable-next-line eslint/no-template-curly-in-string -- The fixture deliberately contains a computed import.
    { file: 'src/shards/ember/shard.config.ts', source: "import './generators/scene'; import('../other/generators/world'); import(`./generators/${name}`); import('./generators/' + name);", count: 3 },
    { file: 'src/shards/ember/runtime/world.ts', source: "import '../generators/scene';", count: 1 },
    { file: 'src/shards/ember/data/rows.ts', source: "import '../generators/scene';", count: 1 },
    { file: 'src/shards/ember/manifest.ts', source: "import './generators/scene';", count: 1 },
    { file: 'src/shards/ember/generators/world.ts', source: "import './scene';", count: 0 },
  ];
  try {
    cpSync(resolve('lint'), join(root, 'lint'), { recursive: true });
    for (const name of ['vite', '@typescript/typescript6']) { const target = join(root, 'node_modules', name); mkdirSync(dirname(target), { recursive: true }); symlinkSync(resolve('node_modules', name), target, 'dir'); }
    for (const row of cases) put(row.file, row.source);
    put('config.json', JSON.stringify({ jsPlugins: [join(root, 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/no-runtime-generator': 'error' } }));
    const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, 'config.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    const output: unknown = JSON.parse(result.stdout);
    if (output === null || typeof output !== 'object' || !('diagnostics' in output) || !Array.isArray(output.diagnostics)) throw new Error('Missing guard diagnostics');
    const diagnostics: unknown[] = output.diagnostics;
    expect(result.status, result.stderr).toBe(1);
    for (const row of cases) expect(diagnostics.filter(item => item !== null && typeof item === 'object' && 'filename' in item && item.filename === row.file), row.file).toHaveLength(row.count);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
