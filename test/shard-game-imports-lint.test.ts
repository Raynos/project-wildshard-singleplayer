// oxlint-disable-next-line import/no-nodejs-modules -- The fixture runs the actual oxlint plugin in isolated author projects.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary registered manifests and lint source files.
import { cpSync, symlinkSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed plugin and isolated fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated native test temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke the existing Node executable without a shell.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('ratchets every game import syntax outside runtime while retaining SDK/engine transition access without suffix-based exemptions', () => {
  const root = mkdtempSync(join(tmpdir(), 'shard-game-imports-'));
  const put = (path: string, source: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); };
  const cases = [
    { file: 'src/shards/ember/world.ts', code: "import type { State } from '@wildshard/game/state';", count: 1 },
    { file: 'src/shards/ember/load.ts', code: "import('@wildshard/game/state');", count: 1 },
    { file: 'src/shards/ember/types.ts', code: "type T = import('@wildshard/game/state').State;", count: 1 },
    { file: 'src/shards/ember/alias.ts', code: "export { state } from '@wildshard/game/state'; export * from '@wildshard/game/state';", count: 2 },
    { file: 'src/shards/ember/relative.ts', code: "import { state } from '../../game/state';", count: 1 },
    { file: 'src/shards/ember/dynamic.ts', code: `import(\`@wildshard/game/\${name}\`); import('@wildshard/game/' + name);`, count: 2 },
    { file: 'src/shards/ember/runtime/state.ts', code: "import { state } from '@wildshard/game/state';", count: 0 },
    { file: 'src/shards/ember/author.ts', code: "import { row } from '@wildshard/sdk/rows'; import type { State } from '@wildshard/engine/state';", count: 0 },
    { file: 'src/game/composition.ts', code: "import { state } from '@wildshard/game/state';", count: 0 },
    { file: 'src/shards/ember-legacy/world.ts', code: "import { state } from '@wildshard/game/state';", count: 0 },
    { file: 'src/shards/ember-legacy/unregistered.ts', code: "import { state } from '@wildshard/game/state';", count: 1 },
    { file: 'src/shards/fake-legacy/world.ts', code: "import { state } from '@wildshard/game/state';", count: 1 },
    { file: 'src/shards/unpaired-legacy/world.ts', code: "import { state } from '@wildshard/game/state';", count: 1 },
  ];
  try {
    cpSync(resolve('lint'), join(root, 'lint'), { recursive: true });
    put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'ember-legacy': { primary: 'ember', source: 'a'.repeat(40), files: { 'world.ts': 'b'.repeat(64) } } } }));
    for (const name of ['vite', '@typescript/typescript6']) {
      const target = join(root, 'node_modules', name); mkdirSync(dirname(target), { recursive: true });
      symlinkSync(resolve('node_modules', name), target, 'dir');
    }
    put('src/shards/ember/manifest.ts', "export const MANIFEST = { slug: 'ember' };");
    put('src/shards/ember-legacy/manifest.ts', "export const MANIFEST = { slug: 'ember-legacy', legacy: true };");
    put('src/shards/fake/manifest.ts', "export const MANIFEST = { slug: 'fake' };");
    put('src/shards/fake-legacy/manifest.ts', "// legacy: true\nexport const MANIFEST = { slug: 'fake-legacy', description: 'legacy: true' };");
    put('src/shards/unpaired-legacy/manifest.ts', "export const MANIFEST = { slug: 'unpaired-legacy', legacy: true };");
    for (const row of cases) put(row.file, row.code);
    const config = join(root, 'config.json');
    writeFileSync(config, JSON.stringify({ jsPlugins: [join(root, 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/shard-game-imports': 'error' } }));
    const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', config, '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    const output: unknown = JSON.parse(result.stdout);
    if (output === null || typeof output !== 'object' || !('diagnostics' in output) || !Array.isArray(output.diagnostics)) throw new Error('Missing lint diagnostics');
    const diagnostics: unknown[] = output.diagnostics;
    expect(result.status, result.stderr).toBe(1);
    for (const row of cases) expect(diagnostics.filter(d => d !== null && typeof d === 'object' && 'filename' in d && 'code' in d && d.filename === row.file && d.code === 'wildshard(shard-game-imports)'), row.file).toHaveLength(row.count);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
