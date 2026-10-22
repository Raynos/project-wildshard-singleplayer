import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { Targets } from '../src/engine/combat/types';
import { MountedArsenal, type MountedLoadout } from '../src/game/loadout/mounted';
import * as nativeItems from '../src/game/plugin/headless';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { mockCanvas } from './fake/weaponParity';
import type { HeldFirearmRows } from '../src/game/plugin/heldFirearm';
import { emptyShardfile } from '../src/sdk/author';
import { parseHeldFirearmRows } from '../src/format/weaponProfiles';
import { parseItems } from '../src/format/items';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with { type: 'json' };
import rifle from '../src/shards/nalati-grasslands/data/rifle.generated.json' with { type: 'json' };
import { FakeGame, legacyDouble } from './fake/FakeGame';

beforeEach(() => { mockCanvas(); });
afterEach(() => { vi.restoreAllMocks(); });

function fixture() {
  const parent = new Scope('kit-loan-parent'), scope = parent.child('kit-loan');
  const rows = { ...loadout, variants: { bow: { id: 'weapon.golden-bow', name: 'Golden Bow' }, blade: { id: 'weapon.naizagai', name: 'Naizagai' } } };
  const arsenal = new MountedArsenal(rows), other = new MountedArsenal(rows);
  const source = { ...emptyShardfile({ slug: 'kit-loan', name: 'Kit loan', author: 'Fixture', revision: 1, seed: 1 }), items: parseItems(items) };
  const catalogue = new ItemCatalogue(source.items);
  const sabre = legacyDouble<MountedLoadout['sabre']>({ row: catalogue.equipment(loadout.blade.item) });
  const bow = legacyDouble<MountedLoadout['bow']>({ row: catalogue.equipment(loadout.bow.item) });
  const spear = legacyDouble<MountedLoadout['spear']>({ row: catalogue.equipment(loadout.polearm.item) });
  const kit: MountedLoadout = { base: sabre, bow, sabre, spear, extras: [bow, spear], install: () => undefined, upgradeBow: () => undefined,
    upgradeSabre: () => undefined, refill: () => undefined, setMount: () => undefined };
  const firearmRows: HeldFirearmRows = { mount:'shared', parts:[], materials:{case:{name:'case',basic:{color:0,opacity:1}}},
    primitives:{case:[{kind:'box',args:[.01,.01,.01]}]}, anchors:{}, brass:{geometry:'case',material:'case'},
    playback:{groups:{frame:[{id:'fixture.frame',reads:[],nodes:[{op:'constant',value:0}],channels:[{property:'x',value:0}]}]},inputs:[],outputs:[],schedule:{frame:'frame',sight:'sight',pose:'pose',action:[],grip:[]}},
    presentation:parseHeldFirearmRows(rifle.rows).presentation };
  const bytes = new TextEncoder().encode(JSON.stringify({...rifle,rows:firearmRows}));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([[loadout.page.firearm.file, { hash: 'a'.repeat(64), url: '/fixture/rifle.json' }]]), read: () => Promise.resolve(bytes) });
  const game = new FakeGame().asGame();
  const world = legacyDouble<NonNullable<ShardRuntime['world']>>({game,sky:legacyDouble<NonNullable<ShardRuntime['world']>['sky']>({}),
    player:legacyDouble<NonNullable<ShardRuntime['world']>['player']>({yaw:0,pitch:0})});
  const runtime = legacyDouble<ShardRuntime>({ world });
  const weapon = vi.fn<ShardContext['rows']['weapon']>();
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ weapon }) });
  const build = vi.spyOn(arsenal, 'build').mockResolvedValue(kit);
  vi.spyOn(nativeItems, 'bindRuntimeEquipment').mockReturnValue(legacyDouble<ReturnType<typeof nativeItems.bindRuntimeEquipment>>({}));
  return { parent, scope, arsenal, other, kit, ctx, runtime, build };
}

test.each([false, true])('the scoped arsenal lends the SAME built kit and refuses a retiring owner (ancestor: %s)', async ancestor => {
  const f = fixture();let retirement: Generator | undefined;
  try {
    expect(f.arsenal.pageKit(f.ctx)).toBeNull();f.arsenal.installPage(f.ctx);
    const build = f.runtime.buildEquipment;if (build === undefined) throw new Error('Missing original builder');
    const targets = legacyDouble<Targets>({}), built = await build(targets, false);
    expect(f.build).toHaveBeenCalledOnce();expect(built.primary).toBe(f.kit.base);expect(built.extras).toBe(f.kit.extras);
    expect(built.install).toBe(f.kit.install);expect(f.arsenal.pageKit(f.ctx)).toBe(f.kit);
    expect(f.other.pageKit(f.ctx)).toBeNull();
    const foreign = f.parent.child('foreign-kit-scope');expect(f.arsenal.pageKit({ scope: foreign })).toBeNull();
    if (ancestor) {
      f.parent.onDispose(() => undefined);retirement = f.parent.disposeSteps();retirement.next();
      expect(f.scope.disposed).toBe(false);expect(f.scope.disposing).toBe(true);
    } else f.scope.dispose();
    expect(f.arsenal.pageKit(f.ctx)).toBeNull();expect(f.arsenal.pageKit({ scope: foreign })).toBeNull();
  } finally {
    if (retirement !== undefined) for (const _step of retirement) { /* Finish original scope disposal. */ }
    f.parent.dispose();
  }
});
