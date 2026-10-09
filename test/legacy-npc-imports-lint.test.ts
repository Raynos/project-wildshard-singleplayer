// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual architecture plugin in an isolated fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture files and cleanup only.
import { cpSync, symlinkSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve installed lint and isolated file paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated temporary project.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke Node directly without a shell.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { legacyInventory, registeredLegacyFile } from '../scripts/legacy-shards.mjs';

it('limits historical NPC implementations to exact registered frozen callers while retaining their literal internal dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'legacy-npc-imports-'));
  const put = (path: string, source: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); };
  const cases = [
    { file: 'src/shards/ember/author.ts', code: "import { head } from '@wildshard/game/systems/npc/faceHeads';", count: 1 },
    { file: 'src/shards/ember/runtime/state.ts', code: "import type { Rig } from '@wildshard/game/systems/npc/figureRig';", count: 1 },
    { file: 'src/shards/ember/type.ts', code: "type T = import('@wildshard/game/systems/npc/figureMotion').State;", count: 1 },
    { file: 'src/shards/ember/relative.ts', code: "import { head } from '../../game/systems/npc/faceHeads';", count: 1 },
    { file: 'src/shards/ember/reexport.ts', code: "export { head } from '@wildshard/game/systems/npc/faceHeads'; export * from '@wildshard/game/systems/npc/figureRig';", count: 2 },
    { file: 'src/shards/ember/dynamic.ts', code: "import('@wildshard/game/systems/npc/faceHeads');", count: 1 },
    { file: 'src/shards/ember/computed.ts', code: `import(\`@wildshard/game/systems/npc/\${name}\`); import('@wildshard/game/systems/npc/' + name);`, count: 2 },
    { file: 'src/game/composition.ts', code: "import { head } from './systems/npc/faceHeads';", count: 1 },
    { file: 'src/shards/ember-legacy/world.ts', code: "import { head } from '@wildshard/game/systems/npc/faceHeads';", count: 0 },
    { file: 'src/shards/ember-legacy/other.ts', code: "import { head } from '@wildshard/game/systems/npc/faceHeads';", count: 1 },
    { file: 'src/shards/fake-legacy/world.ts', code: "import { head } from '@wildshard/game/systems/npc/faceHeads';", count: 1 },
    { file: 'src/shards/ember/local.ts', code: "import { head } from './npc/faceHeads';", count: 0 },
    { file: 'src/shards/ember/shared.ts', code: "import { rig } from '@wildshard/game/systems/npc/npcRig';", count: 0 },
    { file: 'src/game/systems/npc/figureMotion.ts', code: "import type { Rig } from './figureRig';", count: 0 },
    { file: 'src/game/systems/npc/figureRig.ts', code: "import type { Motion } from './figureMotion';", count: 1 },
    { file: 'src/game/systems/npc/new.ts', code: "import type { Rig } from './figureRig';", count: 1 },
  ];
  try {
    cpSync(resolve('lint'), join(root, 'lint'), { recursive: true });
    put('lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'ember-legacy': { primary: 'ember', source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'c'.repeat(64), 'world.ts': 'd'.repeat(64) } } } }));
    const inventory = legacyInventory(root);
    expect(registeredLegacyFile(inventory, 'src/shards/ember-legacy/world.ts')).toBe(true);
    expect(registeredLegacyFile(inventory, 'src/shards/ember-legacy/other.ts')).toBe(false);
    expect(registeredLegacyFile(inventory, 'src/shards/fake-legacy/world.ts')).toBe(false);
    for (const name of ['vite', '@typescript/typescript6']) {
      const target = join(root, 'node_modules', name); mkdirSync(dirname(target), { recursive: true });
      symlinkSync(resolve('node_modules', name), target, 'dir');
    }
    for (const row of cases) put(row.file, row.code);
    const config = join(root, 'config.json');
    writeFileSync(config, JSON.stringify({ jsPlugins: [join(root, 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/legacy-npc-imports': 'error' } }));
    const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', config, '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    const output: unknown = JSON.parse(result.stdout);
    if (output === null || typeof output !== 'object' || !('diagnostics' in output) || !Array.isArray(output.diagnostics)) throw new Error('Missing lint diagnostics');
    const diagnostics: unknown[] = output.diagnostics;
    expect(result.status, result.stderr).toBe(1);
    for (const row of cases) expect(diagnostics.filter(d => d !== null && typeof d === 'object' && 'filename' in d && 'code' in d && d.filename === row.file && d.code === 'wildshard(legacy-npc-imports)'), row.file).toHaveLength(row.count);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
