import { expect, test, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext, type ShardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import source from '../src/shards/nine-dragon-stack/shard.config';
import manifest from '../src/shards/nine-dragon-stack/manifest';
import { NdPlugin } from '../src/shards/nine-dragon-stack/plugin';

test('Nine kit admits its existing profile without fetching an unused rigid sword', async () => {
  const app = new App(), scope = new Scope('nine-sword-entry');
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const read = vi.fn(() => Promise.resolve(new TextEncoder().encode('{"portraitFov":78}')));
  const product = createShardProduct({ slug: manifest.slug, revision: source.identity.revision, shardfile: source,
    sections: new Map(), files: new Map([['weapons/jian-row.json', { hash: '0'.repeat(64), url: '/jian-row.json' }]]), read });
  const ctx = shardContext(level.context, manifest, { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const plugin = new NdPlugin();
  const shell: { world: object; buildEquipment?: NonNullable<ShardContext['game']['runtime']>['buildEquipment'] } = { world: { game: { level: { camera: { portraitFov: 78 } } } } };
  Object.defineProperty(ctx.game, 'runtime', { value: shell });
  try {
    level.openKit();
    await plugin.kit(ctx);
    level.closeKit();
    const build = shell.buildEquipment;
    if (build === undefined) throw new Error('Missing Nine equipment factory');
    expect(read).toHaveBeenCalledOnce();
    expect(app.levelRegistrations.list('weapon')).toMatchObject([{ id: 'weapon.jian', parent: 'weapon.sword', feel: { portraitFov: 78 } }]);
    expect(() => build({ raycast: () => null }, true, null)).toThrow('declared sword rig');
  } finally { scope.dispose(); app.engineScope.dispose(); }
});
