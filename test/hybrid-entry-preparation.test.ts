// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Object3D, Scene, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { buildYield } from '../src/engine/core/workSlice';
import { bindConstructionEnvironment, constructionOwner, ownedFacade, withOwner } from '../src/engine/app/ownership';
import { createLevelInstallation } from '../src/engine/level/installation';
import { parseShardSlug } from '../src/game/shard/slug';
import { shardContext } from '../src/game/plugin/context';
import { installEnteredRuntimeService } from '../src/game/shard/retainedHooks';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { HybridRuntimeSession, type HybridResident } from '../src/game/shardfile/hybrid';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';

test('resident services keep yielded construction hidden while page callbacks see their own scene', async () => {
  for (const binding of ['runtime', 'resident'] as const) {
    const page = new Scope('page'), resident = page.child('resident'), runtime = resident.child('runtime');
    const visible = new Scene(), parked = new Scene(); parked.visible = false;
    let scene = visible;
    const service = { add: (object: Object3D): void => { scene.add(object); } };
    const world = ownedFacade(resident, service), play = ownedFacade(runtime, service), road = ownedFacade(page, service);
    const leave = bindConstructionEnvironment(binding === 'runtime' ? runtime : resident, () => {
      const previous = scene; scene = parked; return () => { scene = previous; };
    });
    const forget = runtime.capture('disposers', leave);
    try {
      await Promise.resolve();
      const island = new Object3D(), boat = new Object3D(), passingCar = new Object3D();
      world.add(island); play.add(boat); road.add(passingCar);
      // Negative control reproduces the cold draw: parent-owned world services escape a runtime-child binding.
      expect(island.parent).toBe(binding === 'resident' ? parked : visible);
      expect(boat.parent).toBe(parked); expect(passingCar.parent).toBe(visible);
      withOwner(page, () => { expect(scene).toBe(visible); expect(constructionOwner()).toBeNull(); });
      expect(scene).toBe(parked);
      runtime.dispose();
      expect(scene).toBe(visible); expect(constructionOwner()).toBeNull();
      expect(resident.disposed).toBe(false);
      withOwner(resident, () => { expect(scene).toBe(visible); });
    } finally { forget(); leave(); page.dispose(); }
  }
});

test('entered services retain the ordinary activation order', async () => {
  for (const outcome of ['success', 'cancel', 'fail'] as const) {
    const manifest = { ...TEMPLATE, slug: parseShardSlug('fixture-entry') };
    const scope = new Scope('entry-preparation'), app = new App(), events: string[] = [];
    const runtime: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], objects: {}, hooks: {},
      viewer: () => new Vector3(), horizonVeil: null };
    const source = emptyShardfile({ slug: manifest.slug, name: 'Preparation fixture', author: 'Fixture', revision: 1, seed: 7 });
    const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map([['client/plan', { version: 1, features: [] }]]), files: new Map(),
      read: () => Promise.reject(new Error('No fixture file')) });
    let release: (() => void) | undefined, started: (() => void) | undefined, visible = false;
    const warm = new Promise<void>(resolve => { release = resolve; }), warming = new Promise<void>(resolve => { started = resolve; });
    const resident: HybridResident = { instance: 'fixture', slug: manifest.slug, declaration: null, product,
      firstParty: true, retainRuntime: true, scope, runtime, context: (owner, local) => {
        const level = createLevelInstallation(app, owner, {}, () => ({ set: () => undefined, detail: () => undefined }));
        const context = shardContext(level.context, manifest, { shard: manifest, runtime: local, rows: new Map(),
          bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
        return { ...level, context, prepareConstruction: () => { events.push('construct'); return () => { events.push('restore'); }; },
          beforeWorld: entered => { installEnteredRuntimeService(entered, entry => { visible = true; events.push('publish'); entry.onDispose(() => { visible = false; }); }); },
          afterWorld: entered => { events.push('world'); if (entered.game.runtime === undefined) throw new Error('Missing runtime'); entered.game.runtime.objects['built'] = true; },
          afterPlay: async () => { events.push('warm'); started?.(); await warm; if (outcome === 'fail') throw new Error('Preparation failed'); } };
      } };
    const session = new HybridRuntimeSession(new Map([['fixture', resident]]), scope);
    try {
      const entering = session.enter({ instance: 'fixture', slug: manifest.slug });
      // Observe a rejection immediately while the controlled warm is still pending.
      const settled = (async () => { try { return { value: await entering }; } catch (error) { return { error }; } })();
      await warming;
      expect(visible).toBe(true); expect(session.state().ready).toBe(false);
      expect(runtime.objects['built']).toBe(true);
      if (outcome === 'cancel') session.leave();
      release?.(); const result = await settled;
      if (outcome === 'fail') expect('error' in result && String(result.error)).toContain('Preparation failed');
      else expect(result).toEqual({ value: outcome === 'success' });
      expect(visible).toBe(outcome === 'success');
      if (outcome === 'success') {
        expect(runtime.objects['built']).toBe(true); session.leave(); expect(visible).toBe(false);
        expect(await session.enter({ instance: 'fixture', slug: manifest.slug })).toBe(true); expect(visible).toBe(true);
        expect(events.filter(event => event === 'world')).toHaveLength(1);
      }
    } finally { scope.dispose(); }
    expect(visible).toBe(false); expect(runtime.objects['built']).toBeUndefined();
  }
});


test('a compiled data owner parks and restores its actual finite hooks without any TS loader', async () => {
  const scope=new Scope('compiled-page'),app=new App(),manifest={...TEMPLATE,slug:parseShardSlug('compiled-owner')};
  const source=emptyShardfile({slug:manifest.slug,name:'Compiled owner',author:'Fixture',revision:1,seed:7});
  const cost={webContentMB:500,glMB:100,engineBaseMB:300,rev:'abcdef1234',device:'Fixture',evidence:'progress/memory/fixture.json'};
  source.runtime={kind:'client-plan',cost,binds:[]};
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map([['client/plan',{version:1,features:[{kind:'world.runtime-hooks',overhead:[],meleeSilent:true}]}]]),files:new Map(),read:()=>Promise.reject(new Error('No fixture file'))});
  const runtime:ShardRuntime={world:null,step:null,play:null,interactables:[],overhead:[],objects:{},hooks:{},viewer:()=>new Vector3(),horizonVeil:null};
  let entered:Scope|undefined;let warm=0;
  const resident:HybridResident={instance:'compiled',slug:manifest.slug,declaration:source.runtime,product,firstParty:true,retainRuntime:true,scope,runtime,context:(owner,local)=>{
    entered=owner;
    const level=createLevelInstallation(app,owner,{},()=>({set:()=>undefined,detail:()=>undefined}));
    const context=shardContext(level.context,manifest,{shard:manifest,runtime:local,rows:new Map(),bag:{tab:()=>()=>undefined,fragment:()=>()=>undefined}},product);
    return {...level,context,prepareConstruction:()=>()=>undefined,afterPlay:()=>{warm++;}};
  }};
  const session=new HybridRuntimeSession(new Map([['compiled',resident]]),scope);
  try{
    const sourceEntry = { ...resident, declaration: { entry: 'runtime/index.ts' } };
    const sourceSession = new HybridRuntimeSession(new Map([['compiled', sourceEntry]]), scope);
    await expect(sourceSession.prepare('compiled')).rejects.toThrow('requires a compiled client page');
    const untrusted = new HybridRuntimeSession(new Map([['compiled', { ...resident, firstParty: false }]]), scope);
    await expect(untrusted.prepare('compiled')).rejects.toThrow('requires its admitted client plan');
    await session.prepare('compiled');expect(runtime.hooks.meleeSilent).toBeUndefined();
    expect(await session.enter({instance:'compiled',slug:manifest.slug})).toBe(true);expect(runtime.hooks.meleeSilent).toBe(true);
    const first=entered;session.leave();expect(runtime.hooks.meleeSilent).toBeUndefined();expect(first?.disposed).toBe(false);
    expect(await session.enter({instance:'compiled',slug:manifest.slug})).toBe(true);expect(entered).toBe(first);expect(runtime.hooks.meleeSilent).toBe(true);expect(warm).toBe(1);
    scope.dispose();expect(runtime.hooks.meleeSilent).toBeUndefined();expect(first?.disposed).toBe(true);
  }finally{scope.dispose();}
});


test('abandoning a yielded isolated install restores bindings and permits a fresh install', async () => {
  const scope = new Scope('cancelled-isolated-install'), app = new App();
  const manifest = { ...TEMPLATE, slug: parseShardSlug('cancelled-entry') };
  const source = emptyShardfile({ slug: manifest.slug, name: 'Cancelled entry', author: 'Fixture', revision: 1, seed: 7 });
  const product = createShardProduct({ slug: manifest.slug, revision: 1, shardfile: source,
    sections: new Map([['client/plan', { version: 1, features: [] }]]), files: new Map(),
    read: () => Promise.reject(new Error('No fixture file')) });
  const runtime: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], objects: {}, hooks: {},
    viewer: () => new Vector3(), horizonVeil: null };
  let reached: (() => void) | undefined, cancelled: Scope | undefined, builds = 0, restores = 0, visible = false;
  const yielded = new Promise<void>(resolve => { reached = resolve; });
  const resident: HybridResident = { instance: 'fixture', slug: manifest.slug, declaration: null, product,
    firstParty: true, retainRuntime: true, scope, runtime, context: (owner, local) => {
      const level = createLevelInstallation(app, owner, {}, () => ({ set: () => undefined, detail: () => undefined }));
      const context = shardContext(level.context, manifest, { shard: manifest, runtime: local, rows: new Map(),
        bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
      return { ...level, context, prepareConstruction: () => () => { restores++; },
        beforeWorld: entered => { installEnteredRuntimeService(entered, entry => {
          visible = true; entry.onDispose(() => { visible = false; });
        }); }, afterWorld: async entered => {
          if (++builds !== 1) return;
          cancelled = entered.scope; reached?.(); await buildYield(entered.scope);
          throw new Error('Cancelled construction advanced past its fence');
        } };
    } };
  const session = new HybridRuntimeSession(new Map([['fixture', resident]]), scope);
  try {
    const installing = session.installAhead('fixture');
    const settled = (async () => { try { return { value: await installing }; } catch (error) { return { error }; } })();
    await yielded; expect(visible).toBe(false); session.abandon('fixture');
    const result = await settled;
    expect('error' in result && String(result.error)).toContain('scope has closed');
    expect(cancelled?.disposed).toBe(true); expect(scope.disposed).toBe(false);
    expect(restores).toBe(1); expect(session.timings().current).toBeNull(); expect(visible).toBe(false);
    expect(await session.installAhead('fixture')).toBe(true);
    expect(builds).toBe(2); expect(restores).toBe(2); expect(visible).toBe(false);
    expect(await session.enter({ instance: 'fixture', slug: manifest.slug })).toBe(true);
    expect(builds).toBe(2); expect(visible).toBe(true);
  } finally { scope.dispose(); }
  expect(visible).toBe(false);
});
