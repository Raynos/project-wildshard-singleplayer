// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated package/consumer fixtures only.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary native fixture directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture sources without shell commands.
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { gamePluginSurface } from '../scripts/game-plugins.mjs';

it('keeps frozen compatibility exports visible and detects removed keys or definitions', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-plugin-surface-'));
  const put = (path: string, text: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  const exports = { './plugin/context': './plugin/context.ts', './shard/context': './plugin/context.ts', './private': './private.ts' };
  try {
    put('src/game/package.json', JSON.stringify({ exports }));
    put('src/game/plugin/context.ts', 'export const context = 1;');
    put('src/shards/ember/runtime/main.ts', "import '@wildshard/game/plugin/context'; import('@wildshard/game/missing');");
    put('src/shards/ember-legacy/world.ts', "import type { Context } from '@wildshard/game/shard/context';");
    put('src/shards/ember-legacy/new.ts', "import '@wildshard/game/shard/context';");
    put('test/consumer.ts', "type T = import('@wildshard/game/plugin/context').Context;");
    put('lint/legacy-shards.json', JSON.stringify({ shards: { 'ember-legacy': { files: { 'world.ts': 'sealed' } } } }));
    const report = gamePluginSurface(root);
    expect(report).toMatchObject({ enforcement: 'report-only', totalExports: 3, pluginExports: 1, withinPluginLimit: true, pluginOnly: false });
    expect(report.entries.find(row => row.key === './shard/context')).toMatchObject({ published: true, frozenConsumers: ['src/shards/ember-legacy/world.ts'], primaryConsumers: ['src/shards/ember-legacy/new.ts'] });
    expect(report.entries.find(row => row.key === './plugin/context')).toMatchObject({ primaryConsumers: ['src/shards/ember/runtime/main.ts'], otherConsumers: ['test/consumer.ts'] });
    expect(report.entries.find(row => row.key === './private')).toMatchObject({ published: false });
    expect(report.unresolved).toEqual([{ specifier: '@wildshard/game/missing', consumers: ['src/shards/ember/runtime/main.ts'] }]);
    put('src/game/package.json', JSON.stringify({ exports: { './plugin/context': exports['./plugin/context'] } }));
    expect(gamePluginSurface(root).unresolved).toContainEqual({ specifier: '@wildshard/game/shard/context', consumers: ['src/shards/ember-legacy/new.ts', 'src/shards/ember-legacy/world.ts'] });
    put('src/game/package.json', JSON.stringify({ exports: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`./plugin/module${i}`, './plugin/context.ts'])) }));
    expect(gamePluginSurface(root)).toMatchObject({ totalExports: 21, pluginExports: 21, withinPluginLimit: false, pluginOnly: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
