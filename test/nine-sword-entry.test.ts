import { expect, test, vi } from 'vitest';
import { App } from '../src/engine/client/app/app';
import { Scope } from '../src/engine/shared/app/scope';
import { createLevelInstallation } from '../src/engine/client/level/installation';
import { shardContext, type ShardContext } from '../src/game/server/plugin/context';
import { createShardProduct } from '../src/game/shared/shardfile/shardProduct';
import { fixtureProductFile, fixtureJsonCheck } from './fixtures/productFile';
import { nineHeldPresentationBytes } from './fixtures/nine-held-presentation';
import source from './fixtures/nine-product-inputs';
import manifest from '../src/shards/nine-dragon-stack/discovery.generated';
import { entryOwner } from '../src/game/client/shardfile/entryOwners';
import { toLevelSpec } from '../src/game/server/shard/spec';
import { declaredClientPlanEntry } from '../src/game/server/shard/declaredEntry';
import { clientPlanPhases } from './fixtures/clientPlanHost';
import heldPrimary from '../src/shards/nine-dragon-stack/data/heldPrimary.json' with { type: 'json' };

test('Nine manifest native load installs its original Jian once', async () => {
  const app = new App(), scope = new Scope('nine-sword-entry');
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const read = vi.fn(() => Promise.resolve(nineHeldPresentationBytes()));
  const product = createShardProduct({ slug: manifest.slug, revision: source.identity.revision, shardfile: source, jsonCheck: fixtureJsonCheck,
    sections: new Map<string, unknown>([['held/arms', heldPrimary], ['client/plan', { version: 1, features: [{ kind: 'held.claims.prepare', id: 'held.primary' }, { kind: 'held.claims.install', claims: 'held.primary' }] }]]), files: new Map([['weapons/jian-row.json', fixtureProductFile('weapons/jian-row.json', { hash: '0'.repeat(64), url: '/jian-row.json' })]]), read });
  const ctx = shardContext(level.context, manifest, { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const shell: { world: object; buildEquipment?: NonNullable<ShardContext['game']['runtime']>['buildEquipment'] } = { world: { game: { level: { camera: { portraitFov: 78 } } } } };
  Object.defineProperty(ctx.game, 'runtime', { value: shell });
  try {
    if (manifest.load === undefined) throw new Error('Missing Nine manifest loader');
    // LD9: the manifest loads the one client-plan entry; its admission port is replaced by the explicit host fixture
    // (no data client in Node), so the plan's own held-claims features install exactly as they do in the page
    expect(typeof (await manifest.load()).default).toBe('function');
    const Entry = declaredClientPlanEntry({ retainHomeRuntime: true, stagesOwner: 'declared' }, clientPlanPhases).default, plugin = new Entry();
    expect(toLevelSpec(manifest).ground.structures).toBe(true);
    await plugin.world?.(ctx);
    level.openKit();
    await plugin.kit?.(ctx);
    expect(manifest.clientPlanRuntime).toBe(true);
    expect(Object.hasOwn(manifest, 'trustedRuntime')).toBe(false);
    expect(entryOwner(scope, 'claims', 'held.primary').melee().profile.family).toBe('melee');
    level.closeKit();
    const build = shell.buildEquipment;
    if (build === undefined) throw new Error('Missing Nine equipment factory');
    expect(read).toHaveBeenCalledOnce();
    expect(app.levelRegistrations.list('weapon')).toMatchObject([{ id: 'weapon.jian', parent: 'weapon.sword', feel: { portraitFov: 78 } }]);
    await expect(build({ raycast: () => null }, true, null)).rejects.toThrow('declared sword rig');
  } finally { scope.dispose(); app.engineScope.dispose(); }
});
