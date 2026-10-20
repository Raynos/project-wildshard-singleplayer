// @vitest-environment happy-dom
import * as materialCompiler from '../src/game/shardfile/clientMaterials';
import * as textureCapabilities from '../src/engine/core/ktx2';
import type { ResidencyAllocator } from '../src/game/grid/allocator';
import { painterlyUniforms, setPainterlyLook } from '../src/engine/world/painterly';
import { clientCosmeticFinishes } from '../src/game/shardfile/clientCosmeticFinishes';
import { publishBoundPersistence } from '../src/game/quest/chapterBindings';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import type { CosmeticState } from '../src/game/cosmetics/locker';
import { clientSceneHandles } from '../src/game/shardfile/clientSceneHandles';
import { expect, test, vi } from 'vitest';
import fixture from './fixtures/client-plan.json' with { type: 'json' };
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct, ProductError } from '../src/game/shardfile/shardProduct';
import { admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { ShardfileClient } from '../src/game/shardfile/client';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { declaredRuntimeEntry } from '../src/game/shard/declaredEntry';
import { ShardPlugin, type ShardContext } from '../src/game/plugin/context';
import { parseClientPlan } from '../src/format/clientPlan';
import { browserShardfileOptions } from '../src/game/shardfile/runtimeProduct';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { HybridRuntimeSession, type HybridResident } from '../src/game/shardfile/hybrid';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { Color, Vector3 } from 'three';

function context() {
  const source = emptyShardfile({ slug: 'fixture-harbour', name: 'Harbour', author: 'Fixture', revision: 1, seed: 7 });
  const sections = new Map<string, unknown>([['client/plan', fixture], ['ui/strings', { 'death.verb.crab': 'Pinched by' }],
    ['world/scenes', { version: 1, libraries: [], materials: [], steps: [] }]]);
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections, files: new Map(), read: () => Promise.reject(new Error('No fixture blob')) });
  const scope = new Scope('client-plan-fixture'), strings = vi.fn<ShardContext['strings']>(), expose = vi.fn<ShardContext['debug']['expose']>(), runtime = {} as NonNullable<ShardContext['game']['runtime']>;
  const base: Pick<ShardContext, 'product' | 'scope' | 'strings' | 'debug'> = { product, scope, strings, debug: { expose } };
  const ctx = base as ShardContext;
  Object.defineProperty(ctx, 'game', { enumerable: true, value: { runtime } });
  return { ctx, source, sections, strings, expose, runtime };
}

test('fictional shard installs unordered rows in platform phases and retains typed scene handles', async () => {
  const f = context(), plan = admitClientPlan(fixture, f.ctx.product);
  const child = vi.spyOn(f.ctx.scope, 'child');
  await installClientPhase(f.ctx, plan, 'play', f.ctx.scope);
  expect(f.strings).not.toHaveBeenCalled(); expect(f.expose).toHaveBeenCalledWith('fixtureHarbour', f.runtime);
  await installClientPhase(f.ctx, plan, 'world', f.ctx.scope);
  expect(f.strings).toHaveBeenCalledWith({ 'death.verb.crab': 'Pinched by' });
  expect(f.strings.mock.invocationCallOrder[0]).toBeLessThan(child.mock.invocationCallOrder[0] ?? 0);
  const handles = clientSceneHandles(f.ctx.product, f.ctx.scope);
  await installClientPhase(f.ctx, plan, 'world', f.ctx.scope);
  expect(clientSceneHandles(f.ctx.product, f.ctx.scope)).toBe(handles);
  expect(() => handles.object('undeclared')).toThrow(); f.ctx.scope.dispose();
  await expect(installClientPhase(f.ctx, plan, 'world', f.ctx.scope)).rejects.toThrow('disposed');
});

test('unknown, ordered, executable and borrowed-owner rows refuse before effects', () => {
  for (const features of [[{ kind: 'unknown' }], [{ kind: 'world.scenes', rank: 1 }], [{ kind: 'debug.expose', name: 'fixture', owner: 'page', path: ['run'] }],
    [{ kind: 'world.scenes' }, { kind: 'world.scenes' }], [{ kind: 'debug.expose', name: () => 'fixture' }]])
    expect(() => parseClientPlan({ version: 1, features })).toThrow();
  const f = context(); f.sections.delete('world/scenes');
  expect(() => admitClientPlan(fixture, f.ctx.product)).toThrow(ProductError);
  expect(f.strings).not.toHaveBeenCalled(); expect(f.expose).not.toHaveBeenCalled(); f.ctx.scope.dispose();
});

test('one admitted product keeps independent scene handles per resident', async () => {
  const f = context(), other = new Scope('second-client-resident');
  const plan = admitClientPlan({ version: 1, features: [{ kind: 'world.scenes' }] }, f.ctx.product);
  await installClientPhase(f.ctx, plan, 'world', f.ctx.scope);
  await installClientPhase({ ...f.ctx, scope: other }, plan, 'world', other);
  const first = clientSceneHandles(f.ctx.product, f.ctx.scope), second = clientSceneHandles(f.ctx.product, other);
  expect(first).not.toBe(second); f.ctx.scope.dispose();
  expect(() => clientSceneHandles(f.ctx.product, f.ctx.scope)).toThrow();
  expect(clientSceneHandles(f.ctx.product, other)).toBe(second); other.dispose();
});

test('hybrid resident phase leaves entered strings and debug to their actual entered owner', async () => {
  const f = context(), plan = admitClientPlan(fixture, f.ctx.product);
  await installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'resident');
  await installClientPhase(f.ctx, plan, 'play', f.ctx.scope, 'resident');
  expect(f.strings).not.toHaveBeenCalled(); expect(f.expose).not.toHaveBeenCalled();
  expect(clientSceneHandles(f.ctx.product, f.ctx.scope)).toBeDefined();
  await installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'entered');
  await installClientPhase(f.ctx, plan, 'play', f.ctx.scope, 'entered');
  expect(f.strings).toHaveBeenCalledOnce(); expect(f.expose).toHaveBeenCalledOnce(); f.ctx.scope.dispose();
});

test('runtime-owned stages still execute the data client plan without installing another simulation', async () => {
  const f = context(), assets = new ClientAssets(f.source, new Map(), browserShardfileOptions('https://example.invalid/'));
  const client = new ShardfileClient(f.source, assets, { instance: 'fixture-harbour', trustedRuntime: true, runtimeStagesOnly: true,
    recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(), icon: () => { throw new Error('No fixture item'); } });
  await client.world(f.ctx); await client.kit(f.ctx); await client.play(f.ctx);
  expect(f.strings).toHaveBeenCalledOnce(); expect(f.expose).toHaveBeenCalledWith('fixtureHarbour', f.runtime); f.ctx.scope.dispose();
});

test('compiled first-party runtime entry resolves only its declared constructor and runs no hooks on import', () => {
  const world = vi.fn();
  class Runtime extends ShardPlugin { override world(): void { world(); } }
  const entry = declaredRuntimeEntry(Runtime, Runtime, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'runtime' });
  expect(entry.resolveTrustedRuntime('runtime/index.ts')).toBe(Runtime);
  expect(() => entry.resolveTrustedRuntime('runtime/other.ts')).toThrow('Unknown compiled');
  const Entry = entry.default; new Entry(); expect(world).not.toHaveBeenCalled();
});

test('retained client strings unpublish on leave and replay on re-entry', async () => {
  const f = context(), owners = new Set<Scope>();
  const strings = vi.fn((table: Parameters<ShardContext['strings']>[0], scope: Scope) => {
    expect(table).toEqual({ 'death.verb.crab': 'Pinched by' }); owners.add(scope);
    scope.onDispose(() => { owners.delete(scope); });
  });
  Object.defineProperty(f.ctx, 'app', { enumerable: true, value: { input: { refresh: () => undefined, repaint: () => undefined }, levelRegistrations: { strings } } });
  const hooks = new RetainedRuntimeHooks(f.ctx), plan = admitClientPlan({ version: 1, features: [{ kind: 'strings.register' }] }, f.ctx.product);
  await installClientPhase(hooks.context, plan, 'world', f.ctx.scope);
  expect(owners.size).toBe(1); expect(f.strings).not.toHaveBeenCalled();
  hooks.deactivate(); expect(owners.size).toBe(0);
  hooks.activate(); expect(owners.size).toBe(1); expect(strings).toHaveBeenCalledTimes(2);
  f.ctx.scope.dispose(); expect(owners.size).toBe(0);
});

test('regional trusted entry runs the declared plan around raw runtime hooks', async () => {
  const f = context(), order: string[] = [];
  f.strings.mockImplementation(() => { order.push('strings'); }); f.expose.mockImplementation(() => { order.push('debug'); });
  const runtime: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  class Runtime extends ShardPlugin {
    override world(): void { order.push('world'); }
    override kit(): void { order.push('kit'); }
    override play(): void { order.push('play'); }
  }
  const resident: HybridResident = { instance: 'harbour', slug: f.source.identity.slug, declaration: { entry: 'runtime/index.ts', binds: [] },
    firstParty: true, scope: f.ctx.scope, runtime, context: (scope, localRuntime) => ({ context: { ...f.ctx, scope, game: { ...f.ctx.game, runtime: localRuntime } },
      openKit: () => undefined, closeKit: () => undefined }) };
  const session = new HybridRuntimeSession(new Map([['harbour', resident]]), [{ slug: resident.slug, entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) }], f.ctx.scope);
  await session.prepare('harbour'); expect(order).toEqual([]);
  expect(await session.enter({ instance: 'harbour', slug: resident.slug })).toBe(true);
  expect(order).toEqual(['strings', 'world', 'kit', 'play', 'debug']);
  session.leave(); expect(session.state().ready).toBe(false); f.ctx.scope.dispose();
});




test('an orchard kit borrows its declared cosmetic feature and entered saved owner', async () => {
  const f=context(),feature={version:1,features:[{kind:'held.cosmetics'}]};
  f.sections.set('held/finishes',{order:[],rows:{},cards:[],extras:{}});
  expect(()=>admitClientPlan(feature,f.ctx.product)).toThrow('Cosmetic feature requires declared finishes');
  f.sections.set('held/finishes',{order:[],rows:{},cards:[],extras:{},cosmetics:{
    cards:[{id:'pearl',name:'Pearl',blurb:'Light',lockedBlurb:'Win the race',icon:'sword'}],
    skins:[{id:'pearl',slot:'tool',name:'Pearl',blurb:'Light',effect:'effect.pearl',grant:'cosmetic.pearl'}],paints:[]}});
  let saved:CosmeticState={owned:[],worn:{}};
  const persistence={cosmetics:{read:()=>saved,write:(value:CosmeticState)=>{saved=value;return true;}}} as AdventurePersistence;
  publishBoundPersistence(f.ctx.scope,persistence);
  const plan=admitClientPlan(feature,f.ctx.product);
  expect(()=>clientCosmeticFinishes(f.ctx)).toThrow('not installed');
  await installClientPhase(f.ctx,plan,'world',f.ctx.scope);
  expect(()=>clientCosmeticFinishes(f.ctx)).toThrow('not installed');
  await installClientPhase(f.ctx,plan,'kit',f.ctx.scope);
  const {locker}=clientCosmeticFinishes(f.ctx);locker.own('pearl');
  expect(saved).toEqual({owned:['pearl'],worn:{tool:'pearl'}});
  expect(clientCosmeticFinishes(f.ctx).locker).toBe(locker);
  f.ctx.scope.dispose();expect(()=>clientCosmeticFinishes(f.ctx)).toThrow('not installed');
});


test('an orchard installs painterly setup and its frame update from an unordered plan row',async()=>{
  const f=context(),system=vi.fn<ShardContext['system']>(),shade=painterlyUniforms.uPShade.value.clone(),rim=painterlyUniforms.uPRimColor.value.clone(),time=painterlyUniforms.uPTime.value;
  Object.assign(f.ctx,{system});Object.assign(f.runtime,{world:{sky:{csm:{lights:[{color:new Color(1,1,1),intensity:2}]},sunDir:new Vector3(0,1,0)}}});
  const plan=admitClientPlan({version:1,features:[{kind:'look.painterly',shadeTint:[.2,.3,.4],rimColor:[1.2,1.1,.9],wind:{x:1,z:0,strength:.7}}]},f.ctx.product);
  await installClientPhase(f.ctx,plan,'world',f.ctx.scope);
  expect(painterlyUniforms.uPShade.value).toEqual(new Color(.2,.3,.4));expect(system).toHaveBeenCalledOnce();
  const row=system.mock.calls[0]?.[0];if(row===undefined)throw new Error('Missing declared painterly frame');row.run(.2,0);
  expect(painterlyUniforms.uPTime.value).toBeCloseTo(time+.2);
  f.ctx.scope.dispose();setPainterlyLook({shadeTint:shade,rimColor:rim});painterlyUniforms.uPTime.value=time;
});


test('a trusted runtime honors required graph rows before allocating presentation', async () => {
  const f=context();f.source.look.materials['orchard-water']={family:'pbr'};
  f.sections.set('client/plan',{version:1,features:[{kind:'world.scenes',graphs:'required'}]});
  Object.assign(f.runtime,{world:{game:{renderer:{}}}});
  Object.assign(f.ctx,{tiers:{knobs:vi.fn()}});
  const assets=new ClientAssets(f.source,new Map(),browserShardfileOptions('https://example.invalid/'));
  const client=new ShardfileClient(f.source,assets,{instance:'orchard-graph',trustedRuntime:true,
    allocator:{} as ResidencyAllocator,recipes:new Map(),items:new Map(),catalogue:[],voices:()=>new Map(),
    icon:()=>{throw new Error('No fixture icon');}});
  const compile=vi.spyOn(materialCompiler,'clientMaterials').mockRejectedValue(new Error('Reached graph allocation'));
  const textures=vi.spyOn(textureCapabilities,'ktx2TranscodeSupport').mockReturnValue({astc:false,bc7:false});
  try{
    await expect(client.world(f.ctx)).rejects.toThrow('Reached graph allocation');
    expect(compile.mock.calls[0]?.[4]).toMatchObject({trustedGraphs:true,graphs:true});
  }finally{compile.mockRestore();textures.mockRestore();f.ctx.scope.dispose();}
});
