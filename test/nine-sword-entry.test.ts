import { expect, test, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext, type ShardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import source from '../src/shards/nine-dragon-stack/shard.config';
import manifest from '../src/shards/nine-dragon-stack/discovery.generated';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { toLevelSpec } from '../src/game/shard/spec';
import heldPrimary from '../src/shards/nine-dragon-stack/data/heldPrimary.json' with { type: 'json' };

test('Nine manifest native load installs its original Jian once', async () => {
  const app = new App(), scope = new Scope('nine-sword-entry');
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const read = vi.fn(() => Promise.resolve(new TextEncoder().encode('{"portraitFov":78}')));
  const product = createShardProduct({ slug: manifest.slug, revision: source.identity.revision, shardfile: source,
    sections: new Map<string, unknown>([['held/arms', heldPrimary], ['client/plan', { version: 1, features: [{ kind: 'held.claims.prepare', id: 'held.primary' }, { kind: 'held.claims.install', claims: 'held.primary' }] }]]), files: new Map([['weapons/jian-row.json', { hash: '0'.repeat(64), url: '/jian-row.json' }]]), read });
  const native = { ...manifest, entries: { legacy: true, shardfile: false } };
  const ctx = shardContext(level.context, native, { shard: native, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const shell: { world: object; buildEquipment?: NonNullable<ShardContext['game']['runtime']>['buildEquipment'] } = { world: { game: { level: { camera: { portraitFov: 78 } } } } };
  Object.defineProperty(ctx.game, 'runtime', { value: shell });
  try {
    if (manifest.load === undefined) throw new Error('Missing Nine manifest loader');
    const { default: Entry } = await manifest.load(), plugin = new Entry();
    expect(toLevelSpec(manifest).ground.structures).toBe(true);
    await plugin.world?.(ctx);
    level.openKit();
    await plugin.kit?.(ctx);
    expect(manifest.clientPlanRuntime).toBe(true);
    expect(manifest.trustedRuntime).toBeUndefined();
    expect(entryOwner(scope, 'claims', 'held.primary').melee().profile.family).toBe('melee');
    level.closeKit();
    const build = shell.buildEquipment;
    if (build === undefined) throw new Error('Missing Nine equipment factory');
    expect(read).toHaveBeenCalledOnce();
    expect(app.levelRegistrations.list('weapon')).toMatchObject([{ id: 'weapon.jian', parent: 'weapon.sword', feel: { portraitFov: 78 } }]);
    expect(() => build({ raycast: () => null }, true, null)).toThrow('declared sword rig');
  } finally { scope.dispose(); app.engineScope.dispose(); }
});
