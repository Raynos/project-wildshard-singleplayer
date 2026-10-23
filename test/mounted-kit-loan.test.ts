// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import * as plan from '../src/engine/boot/plan';
import * as launcher from '../src/game/weapons/heldLauncher';
import type { Targets } from '../src/engine/combat/types';
import { MountedArsenal, type MountedLoadout } from './fixtures/originalMountedArsenal';
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
  const read=vi.fn(()=>Promise.resolve(bytes));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([[loadout.page.firearm.file, { hash: 'a'.repeat(64), url: '/fixture/rifle.json' }]]), read });
  const game = new FakeGame().asGame();
  const world = legacyDouble<NonNullable<ShardRuntime['world']>>({game,sky:legacyDouble<NonNullable<ShardRuntime['world']>['sky']>({}),
    player:legacyDouble<NonNullable<ShardRuntime['world']>['player']>({yaw:0,pitch:0})});
  const runtime = legacyDouble<ShardRuntime>({ world });
  const weapon = vi.fn<ShardContext['rows']['weapon']>();
  const ctx = legacyDouble<ShardContext>({ scope, product, app:legacyDouble<ShardContext['app']>({equipment:null}), game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ weapon }) });
  const build = vi.spyOn(arsenal, 'build').mockResolvedValue(kit);
  vi.spyOn(nativeItems, 'bindRuntimeEquipment').mockReturnValue(legacyDouble<ReturnType<typeof nativeItems.bindRuntimeEquipment>>({}));
  return { parent, scope, arsenal, other, kit, ctx, runtime, build, game, read, bytes };
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

function deferred<T>() {
  let settle: ((value:T)=>void)|undefined;
  const promise = new Promise<T>(resolve=>{settle=resolve;});
  return {promise,resolve(value:T):void {if(settle===undefined)throw new Error('Missing deferred resolver');settle(value);}};
}

test.each(['scope','product','source','items','game','runtime','world','app','equipment'] as const)(
  'an old builder refuses a replaced %s before construction or binding', async kind=>{
    const f=fixture();
    try {
      f.arsenal.installPage(f.ctx);const builder=f.runtime.buildEquipment;
      if(builder===undefined)throw new Error('Missing original builder');
      const replace={
        scope:()=>{Object.defineProperty(f.ctx,'scope',{value:f.parent.child('replacement')});},
        product:()=>{Object.defineProperty(f.ctx,'product',{value:{...f.ctx.product}});},
        source:()=>{Object.defineProperty(f.ctx.product,'shardfile',{value:{...f.ctx.product.shardfile},configurable:true});},
        items:()=>{Object.defineProperty(f.ctx.product.shardfile,'items',{value:{...f.ctx.product.shardfile.items}});},
        game:()=>{Object.defineProperty(f.ctx,'game',{value:{...f.ctx.game}});},
        runtime:()=>{Object.defineProperty(f.ctx.game,'runtime',{value:{...f.runtime}});},
        world:()=>{f.runtime.world=legacyDouble<NonNullable<ShardRuntime['world']>>({});},
        app:()=>{Object.defineProperty(f.ctx,'app',{value:legacyDouble<ShardContext['app']>({equipment:null})});},
        equipment:()=>{Object.defineProperty(f.ctx.app,'equipment',{value:legacyDouble<NonNullable<ShardContext['app']['equipment']>>({})});},
      };
      replace[kind]();
      await expect(builder(legacyDouble<Targets>({}),false)).rejects.toThrow('owner was replaced');
      expect(f.build).not.toHaveBeenCalled();expect(nativeItems.bindRuntimeEquipment).not.toHaveBeenCalled();
      expect(f.arsenal.pageKit({scope:f.scope})).toBeNull();
    } finally {f.parent.dispose();}
  });

test.each([false,true])('a build result cannot publish after retirement (ancestor: %s)',async ancestor=>{
  const f=fixture(), pending=deferred<MountedLoadout>();let retirement:Generator|undefined;
  f.build.mockReturnValue(pending.promise);
  try {
    f.arsenal.installPage(f.ctx);const builder=f.runtime.buildEquipment;
    if(builder===undefined)throw new Error('Missing original builder');
    const result=builder(legacyDouble<Targets>({}),false),refusal=expect(result).rejects.toThrow('owner has ended');
    if(ancestor){f.parent.onDispose(()=>undefined);retirement=f.parent.disposeSteps();retirement.next();}
    else f.scope.dispose();
    pending.resolve(f.kit);await refusal;
    expect(nativeItems.bindRuntimeEquipment).not.toHaveBeenCalled();expect(f.arsenal.pageKit(f.ctx)).toBeNull();
  } finally {if(retirement!==undefined)for(const _step of retirement){/* Complete native retirement. */}f.parent.dispose();}
});

test.each([0,1,2])('construction stops at yield %s before touching a later native family',async stage=>{
  const f=fixture(), pause=deferred<undefined>(),at=deferred<undefined>(),calls:string[]=[];
  f.build.mockRestore();
  function bladeStub():MountedLoadout['sabre']{calls.push('blade');return f.kit.sabre;}
  vi.spyOn(f.arsenal.blade,'Weapon').mockImplementation(legacyDouble<typeof f.arsenal.blade.Weapon>(Object.assign(bladeStub,{prototype:f.kit.sabre})));
  function polearmStub():MountedLoadout['spear']{calls.push('polearm');return f.kit.spear;}
  vi.spyOn(f.arsenal.polearm,'Weapon').mockImplementation(legacyDouble<typeof f.arsenal.polearm.Weapon>(Object.assign(polearmStub,{prototype:f.kit.spear})));
  let hop=0;
  vi.spyOn(plan,'macrotask').mockImplementation(()=>{
    const index=hop++;if(index===stage){at.resolve(undefined);return pause.promise;}return Promise.resolve();
  });
  type BowRead=Awaited<ReturnType<typeof launcher.loadHeldBow>>;
  const bowRead:BowRead={rows:legacyDouble<BowRead['rows']>({}),model:{},profile:legacyDouble<BowRead['profile']>({})};
  vi.spyOn(launcher,'loadHeldBow').mockImplementation(()=>{calls.push('bow-read');at.resolve(undefined);return pause.promise.then(()=>bowRead);});
  try {
    f.arsenal.installPage(f.ctx);const builder=f.runtime.buildEquipment;
    if(builder===undefined)throw new Error('Missing original builder');
    const result=builder(legacyDouble<Targets>({}),false),refusal=expect(result).rejects.toThrow('owner was replaced');
    await at.promise;f.runtime.world=legacyDouble<NonNullable<ShardRuntime['world']>>({});pause.resolve(undefined);await refusal;
    expect(calls).toEqual(stage===0?['blade']:stage===1?['blade','polearm']:['blade','polearm','bow-read']);
    expect(nativeItems.bindRuntimeEquipment).not.toHaveBeenCalled();expect(f.arsenal.pageKit(f.ctx)).toBeNull();
  } finally {f.parent.dispose();}
});


test('the post-kit yield refuses before reading the firearm after its world changes',async()=>{
  const f=fixture(),pause=deferred<undefined>(),at=deferred<undefined>();
  vi.spyOn(plan,'macrotask').mockImplementation(()=>{at.resolve(undefined);return pause.promise;});
  try {
    f.arsenal.installPage(f.ctx);const builder=f.runtime.buildEquipment;
    if(builder===undefined)throw new Error('Missing original builder');
    const result=builder(legacyDouble<Targets>({}),false),refusal=expect(result).rejects.toThrow('owner was replaced');
    await at.promise;f.runtime.world=legacyDouble<NonNullable<ShardRuntime['world']>>({});pause.resolve(undefined);await refusal;
    expect(f.read).not.toHaveBeenCalled();expect(nativeItems.bindRuntimeEquipment).not.toHaveBeenCalled();
    expect(f.arsenal.pageKit(f.ctx)).toBeNull();
  } finally {f.parent.dispose();}
});

test.each(['world','equipment','retirement'] as const)('firearm read completion refuses %s before allocating or publishing',async kind=>{
  const f=fixture(),file=deferred<typeof f.bytes>(),at=deferred<undefined>();
  f.read.mockImplementation(()=>{at.resolve(undefined);return file.promise;});
  try {
    f.arsenal.installPage(f.ctx);const builder=f.runtime.buildEquipment;
    if(builder===undefined)throw new Error('Missing original builder');
    const result=builder(legacyDouble<Targets>({}),false),refusal=expect(result).rejects.toThrow(kind==='retirement'?'owner has ended':'owner was replaced');
    await at.promise;const before=[...f.game.scene.children];
    if(kind==='world')f.runtime.world=legacyDouble<NonNullable<ShardRuntime['world']>>({});
    else if(kind==='equipment')Object.defineProperty(f.ctx.app,'equipment',{value:legacyDouble<NonNullable<ShardContext['app']['equipment']>>({})});
    else f.scope.dispose();
    file.resolve(f.bytes);await refusal;
    expect(f.game.scene.children).toEqual(before);expect(nativeItems.bindRuntimeEquipment).not.toHaveBeenCalled();
    expect(f.arsenal.pageKit(f.ctx)).toBeNull();
  } finally {f.parent.dispose();}
});
