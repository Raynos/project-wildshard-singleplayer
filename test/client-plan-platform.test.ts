// @vitest-environment happy-dom
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { parseFamilyMaterial } from '../src/format/materialFamilies';
import * as materialCompiler from '../src/game/shardfile/clientMaterials';
import * as textureCapabilities from '../src/engine/core/ktx2';
import type { ResidencyAllocator } from '../src/game/grid/allocator';
import { painterlyUniforms, setPainterlyLook } from '../src/engine/world/painterly';
import * as lookCompiler from '../src/game/shardfile/runtimeProduct';
import { hasLentLook, lentLook } from '../src/game/shardfile/lentLooks';
import { clientCosmeticFinishes } from '../src/game/shardfile/clientCosmeticFinishes';
import { publishBoundPersistence } from '../src/game/quest/chapterBindings';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import type { CosmeticState } from '../src/game/cosmetics/locker';
import { clientSceneHandles } from '../src/game/shardfile/clientSceneHandles';
import { expect, test, vi } from 'vitest';
import * as workSlices from '../src/engine/core/workSlice';
import fixture from './fixtures/client-plan.json' with { type: 'json' };
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct, ProductError } from '../src/game/shardfile/shardProduct';
import * as questPreparation from '../src/game/shardfile/clientQuestComposition';
import * as questWorldPreparation from '../src/game/shardfile/questWorld';
import * as rangedPreparation from '../src/game/loadout/rangedPage';
import * as spawnPreparation from '../src/game/quest/chapterDirector';
import type { QuestSpawnResult } from '../src/game/quest/chapterDirector';
import { entryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import * as runtimeHookBindings from '../src/game/shardfile/clientRuntimeHooks';
import * as viewPrograms from '../src/game/shardfile/clientViewProgram';
import * as clientPhases from '../src/game/shardfile/clientPlan';
import { admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { ShardfileClient } from '../src/game/shardfile/client';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { declaredRuntimeEntry, declaredClientPlanEntry } from '../src/game/shard/declaredEntry';
import { ShardPlugin, type ShardContext } from '../src/game/plugin/context';
import { parseClientPlan, RuntimeBoundsSchema } from '../src/format/clientPlan';
import { browserShardfileOptions } from '../src/game/shardfile/runtimeProduct';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { HybridRuntimeSession, type HybridResident } from '../src/game/shardfile/hybrid';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { Color, MeshBasicMaterial, Vector3 } from 'three';
import { ToonLook } from '../src/engine/render/families/toon';

function context() {
  const source = emptyShardfile({ slug: 'fixture-harbour', name: 'Harbour', author: 'Fixture', revision: 1, seed: 7 });
  const sections = new Map<string, unknown>([['client/plan', fixture], ['ui/strings', { 'death.verb.crab': 'Pinched by' }],
    ['world/scenes', { version: 1, libraries: [], materials: [], steps: [] }]]);
  const files = new Map<string, { hash: string; url: string }>(), bytes = new Map<string, Uint8Array>();
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections, files, read: hash => { const value = bytes.get(hash); return value === undefined ? Promise.reject(new Error('No fixture blob')) : Promise.resolve(value); } });
  const scope = new Scope('client-plan-fixture'), strings = vi.fn<ShardContext['strings']>(), expose = vi.fn<ShardContext['debug']['expose']>(), runtime = {} as NonNullable<ShardContext['game']['runtime']>;
  const base: Pick<ShardContext, 'product' | 'scope' | 'strings' | 'debug'> = { product, scope, strings, debug: { expose } };
  const ctx = base as ShardContext;
  Object.defineProperty(ctx, 'game', { enumerable: true, value: { runtime } });
  return { ctx, source, sections, strings, expose, runtime, files, bytes };
}

test('entered world looks precede plan effects and release with their owner', async () => {
  const f = context(), material = new MeshBasicMaterial();
  f.source.look.materials['orchard-leaves'] = parseFamilyMaterial({ family: 'pbr' });
  const compile = vi.spyOn(lookCompiler, 'runtimeLookMaterials').mockResolvedValue({
    materials: new Map([['orchard-leaves', material]]), setParam: () => undefined,
    setTexture: () => undefined, bindMeshMap: () => material,
    toon: new ToonLook(), textures: new Map<string, never>(), compile: () => material,
    tick: () => undefined, outline: () => [], surfaces: null,
    graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } },
  });
  const plan = admitClientPlan({ version: 1, features: [{ kind: 'strings.register' }, { kind: 'world.sets', rows: [] }] }, f.ctx.product);
  const sets = vi.spyOn(clientPhases.CLIENT_FEATURES['world.sets'], 'install').mockImplementation(() => undefined);
  f.strings.mockImplementation(() => { expect(lentLook('orchard-leaves')).toBe(material); });
  try {
    await installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'resident');
    expect(compile).not.toHaveBeenCalled();
    await installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'entered');
    await installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'entered');
    expect(compile).toHaveBeenCalledOnce();
    expect(compile).toHaveBeenCalledWith(f.ctx, f.source, true, ['orchard-leaves']);
    expect(f.strings).toHaveBeenCalledTimes(2);
  } finally { compile.mockRestore(); sets.mockRestore(); f.ctx.scope.dispose(); material.dispose(); }
  expect(hasLentLook('orchard-leaves')).toBe(false);
});

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

test('Nalati lazy admission keeps its native constructor and refuses undeclared entries', async () => {
  const { default: manifest } = await import('../src/shards/nalati-grasslands/manifest');
  const { default: Native } = await import('../src/shards/nalati-grasslands/runtime/index');
  const world = vi.spyOn(Native.prototype, 'world');
  try {
    const first = await manifest.load?.(), second = await manifest.load?.();
    if (first?.resolveTrustedRuntime === undefined || second?.resolveTrustedRuntime === undefined)
      throw new Error('Nalati did not lend its trusted entry resolver');
    expect(first.resolveTrustedRuntime('runtime/index.ts')).toBe(Native);
    expect(second.resolveTrustedRuntime('runtime/index.ts')).toBe(Native);
    expect(() => first.resolveTrustedRuntime?.('runtime/foreign.ts')).toThrow('Unknown compiled runtime entry');
    const Entry = first.default; new Entry(); expect(world).not.toHaveBeenCalled();
  } finally { world.mockRestore(); }
});

test.each([true, false])('standalone native plan policy preserves hooks and their scope: %s', async nativePlan => {
  const f = context(), order: string[] = [], release = vi.fn();
  f.strings.mockImplementation(() => { order.push('strings'); }); f.expose.mockImplementation(() => { order.push('debug'); });
  class Native extends ShardPlugin {
    constructor() { super(); order.push('construct'); }
    override world(ctx: ShardContext): void { order.push('world'); ctx.scope.onDispose(() => { release(); }); }
    override kit(): void { order.push('kit'); }
    override play(): void { order.push('play'); }
  }
  const Entry = declaredRuntimeEntry(Native, Native, {
    entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', ...(nativePlan ? {} : { nativePlan }),
  }).default;
  const plugin = new Entry(undefined, undefined, () => false);
  try {
    expect(order).toEqual([]); await expect(plugin.kit(f.ctx)).rejects.toThrow('not admitted');
    await plugin.world(f.ctx); await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(nativePlan ? ['construct', 'strings', 'world', 'kit', 'play', 'debug'] : ['construct', 'world', 'kit', 'play']);
    expect(release).not.toHaveBeenCalled();
  } finally { f.ctx.scope.dispose(); }
  expect(release).toHaveBeenCalledOnce();
});

test.each([false, true])('standalone entry preserves constructor and admission injection: %s', async shardfile => {
  const f = context(), order: string[] = [];
  class Native extends ShardPlugin { constructor() { super(); throw new Error('Unexpected default constructor'); } }
  class Injected extends ShardPlugin {
    override world(): void { order.push('world'); }
    override kit(): void { order.push('kit'); }
    override play(): void { order.push('play'); }
  }
  const admit = vi.fn((ctx: ShardContext) => { expect(ctx).toBe(f.ctx); order.push('admit'); return Promise.resolve(new Injected()); });
  const select = vi.fn(() => shardfile);
  const Entry = declaredRuntimeEntry(Native, Native, {
    entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: false,
  }).default;
  const plugin = new Entry(Injected, admit, select);
  try {
    await plugin.world(f.ctx); await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(shardfile ? ['admit', 'world', 'kit', 'play'] : ['world', 'kit', 'play']);
    expect(select).toHaveBeenCalledOnce(); expect(admit).toHaveBeenCalledTimes(shardfile ? 1 : 0);
  } finally { f.ctx.scope.dispose(); }
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
    menu:{title:'Coats'},cards:[{id:'pearl',name:'Pearl',blurb:'Light',lockedBlurb:'Win the race',icon:'sword'}],
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
  expect(f.runtime.menu?.skinsTitle).toBe('Coats');expect(f.runtime.menu?.skins?.()[0]?.worn).toBe(true);
  f.runtime.menu?.onWearSkin?.('pearl');expect(saved.worn).toEqual({});f.runtime.menu?.onWearSkin?.('pearl');
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
  const f=context();f.source.look.materials['orchard-water']=parseFamilyMaterial({family:'pbr'});
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


test('catalogues require only the optional sections their rows select', () => {
  const f = context(), row = { kind: 'content.catalogue', quests: false, finishes: false,
    weapons: [], ammunition: [], effects: [], compendiums: [], encounters: [] };
  const plan = (feature: unknown) => ({ version: 1, features: [feature] });
  try {
    expect(() => admitClientPlan(plan(row), f.ctx.product)).not.toThrow();
    expect(() => admitClientPlan(plan({ ...row, finishes: true }), f.ctx.product)).toThrow('held/finishes');
    expect(() => admitClientPlan(plan({ ...row, effects: ['finishes'] }), f.ctx.product)).toThrow('held/finishes');
    expect(() => admitClientPlan(plan({ ...row, economy: { effects: [], goods: [] } }), f.ctx.product)).not.toThrow();
    expect(() => admitClientPlan(plan({ ...row, economy: true }), f.ctx.product)).toThrow();
    expect(f.strings).not.toHaveBeenCalled(); expect(f.expose).not.toHaveBeenCalled();
  } finally { f.ctx.scope.dispose(); }
});

test.each(['native', 'regional', 'data'] as const)('finite preparation precedes the %s play consumer', async surface => {
  const f = context(), order: string[] = [];
  f.sections.set('client/plan', { version: 1, features: [
    { kind: 'quest.spawns', id: 'orchard.spawns', source: 'custom/questRuntime', quest: 'orchard.quest', animals: 'orchard.animals', sounds: 'orchard.sounds' },
    { kind: 'quest.composition', id: 'orchard.quest', file: 'quest.json', equipment: { ranged: 'orchard.ranged', animals: 'orchard.animals', sounds: 'orchard.sounds' } },
    { kind: 'held.ranged-page', file: 'ranged.json' },
    { kind: 'quest.world', file: 'world.json' },
  ] });
  f.sections.set('held/finishes', {}); f.sections.set('custom/questRuntime', {});
  for (const name of ['ranged.json', 'world.json', 'quest.json']) { f.files.set(name, { hash: name, url: `https://example.invalid/${name}` }); f.bytes.set(name, new TextEncoder().encode('{}')); }
  const prepare = vi.spyOn(rangedPreparation, 'prepareRangedPage').mockResolvedValue(undefined);
  const ranged = vi.spyOn(questPreparation, 'installEntryRangedPage').mockImplementation(() => { order.push('ranged'); return Promise.resolve(); });
  const worldAdmission = vi.spyOn(questWorldPreparation, 'prepareQuestWorldEntry').mockImplementation(() => { order.push('world'); return Promise.resolve(); });
  const quest = vi.spyOn(questPreparation, 'installEntryQuestComposition').mockImplementation(() => { order.push('quest'); return Promise.resolve(); });
  const result: QuestSpawnResult = { puffs: { color: [1, 1, 1], count: 2, height: 1, burst: [1, 2, 3, 4] }, count: 0,
    force: () => undefined, update: () => undefined, takePuffs: () => [] };
  const spawns = vi.spyOn(spawnPreparation, 'installDeclaredQuestSpawns').mockImplementation(() => { order.push('spawns'); return Promise.resolve(result); });
  class Runtime extends ShardPlugin {
    override play(ctx: ShardContext): void {
      expect(entryOwner(ctx.scope, 'quest-spawns', 'orchard.spawns')).toBe(result); order.push('view');
    }
  }
  try {
    if (surface === 'native') {
      const Entry = declaredRuntimeEntry(Runtime, Runtime, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'runtime' }).default;
      const plugin = new Entry(undefined, undefined, () => false);
      await plugin.world(f.ctx); await plugin.kit(f.ctx); await plugin.play(f.ctx);
    } else if (surface === 'regional') {
      const runtime: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
      const resident: HybridResident = { instance: 'orchard', slug: f.source.identity.slug, declaration: { entry: 'runtime/index.ts', binds: [] },
        firstParty: true, scope: f.ctx.scope, runtime, context: (scope, localRuntime) => ({ context: { ...f.ctx, scope, game: { ...f.ctx.game, runtime: localRuntime } }, openKit: () => undefined, closeKit: () => undefined }) };
      const session = new HybridRuntimeSession(new Map([['orchard', resident]]), [{ slug: resident.slug, entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) }], f.ctx.scope);
      await session.prepare('orchard');
      await session.enter({ instance: 'orchard', slug: f.source.identity.slug });
      session.leave();
    } else {
      const assets = new ClientAssets(f.source, new Map(), browserShardfileOptions('https://example.invalid/'));
      const client = new ShardfileClient(f.source, assets, { instance: 'orchard', trustedRuntime: true, runtimeStagesOnly: true,
        recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(), icon: () => { throw new Error('No fixture item'); } });
      await client.world(f.ctx); await client.kit(f.ctx); await client.play(f.ctx);
      expect(entryOwner(f.ctx.scope, 'quest-spawns', 'orchard.spawns')).toBe(result);
    }
    expect(order).toEqual(surface === 'data' ? ['ranged', 'world', 'quest', 'spawns'] : ['ranged', 'world', 'quest', 'spawns', 'view']);
  } finally {
    prepare.mockRestore(); ranged.mockRestore(); worldAdmission.mockRestore(); quest.mockRestore(); spawns.mockRestore(); f.ctx.scope.dispose();
  }
});

test.each(['entered', 'resident'] as const)('retiring %s owners refuse phase effects before disposal completes', async owner => {
  const f = context(), parent = new Scope('retiring-phase'), child = parent.child('still-open-child');
  parent.onDispose(() => undefined);
  const retirement = parent.disposeSteps(); retirement.next();
  expect(child.disposed).toBe(false); expect(child.disposing).toBe(true);
  const plan = admitClientPlan({ version: 1, features: [{ kind: 'strings.register' }] }, f.ctx.product);
  try {
    await expect(installClientPhase(owner === 'entered' ? { ...f.ctx, scope: child } : f.ctx,
      plan, 'world', owner === 'resident' ? child : f.ctx.scope)).rejects.toThrow('owner is disposed');
    expect(f.strings).not.toHaveBeenCalled();
  } finally {
    for (const _step of retirement) { /* Finish the actual ancestor retirement. */ }
    f.ctx.scope.dispose();
  }
});


test.each(['native', 'regional', 'data'] as const)('world bindings follow construction before the %s shell captures its floor', async surface => {
  const f = context(), order: string[] = [], floor = (): number => 4;
  const runtime: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const ctx: ShardContext = { ...f.ctx, game: { ...f.ctx.game, runtime } };
  f.sections.set('client/plan', { version: 1, features: [{ kind: 'world.runtime-hooks', floor: 'orchard.floor', overhead: [], meleeSilent: true }] });
  const install = runtimeHookBindings.installClientRuntimeHooks;
  const bound = vi.spyOn(runtimeHookBindings, 'installClientRuntimeHooks').mockImplementation((entered, row) => {
    expect(order).toEqual(['constructed']); install(entered, row); order.push('bound');
  });
  class Runtime extends ShardPlugin {
    override world(entered: ShardContext): void { publishEntryOwner(entered.scope, 'floor', 'orchard.floor', floor); order.push('constructed'); }
    override kit(entered: ShardContext): void { expect(entered.game.runtime?.hooks.spawnFloor).toBe(floor); order.push('kit'); }
  }
  try {
    if (surface === 'native') {
      const Entry = declaredRuntimeEntry(Runtime, Runtime, { entry: 'runtime/index.ts', retainHomeRuntime: false, stagesOwner: 'runtime' }).default;
      const plugin = new Entry(undefined, undefined, () => false);
      await plugin.world(ctx); await plugin.kit(ctx);
    } else if (surface === 'regional') {
      const resident: HybridResident = { instance: 'orchard', slug: f.source.identity.slug, declaration: { entry: 'runtime/index.ts', binds: [] }, firstParty: true, scope: ctx.scope, runtime,
        context: (scope, localRuntime) => ({ context: { ...ctx, scope, game: { ...ctx.game, runtime: localRuntime } }, openKit: () => undefined, closeKit: () => undefined,
          afterWorld: entered => { expect(entered.game.runtime?.hooks.spawnFloor).toBe(floor); order.push('captured'); } }) };
      const session = new HybridRuntimeSession(new Map([['orchard', resident]]), [{ slug: resident.slug, entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) }], ctx.scope);
      await session.enter({ instance: 'orchard', slug: f.source.identity.slug }); session.leave();
    } else {
      const assets = new ClientAssets(f.source, new Map(), browserShardfileOptions('https://example.invalid/'));
      const client = new ShardfileClient(f.source, assets, { instance: 'orchard', trustedRuntime: true, runtimeStagesOnly: true,
        recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(), icon: () => { throw new Error('No fixture item'); } });
      publishEntryOwner(ctx.scope, 'floor', 'orchard.floor', floor); order.push('constructed');
      await client.world(ctx); expect(runtime.hooks.spawnFloor).toBe(floor); await client.kit(ctx); order.push('kit');
    }
    expect(order).toEqual(surface === 'regional' ? ['constructed', 'bound', 'captured', 'kit'] : ['constructed', 'bound', 'kit']);
    expect(bound).toHaveBeenCalledOnce();
  } finally { bound.mockRestore(); ctx.scope.dispose(); }
});

test('mover owner rows admit only finite fixed-pose mooring and typed targets', () => {
  const row = { kind: 'world.movers', system: 'orchard.movers', bindings: [
    { kind: 'object', id: 'orchard.boat', owner: 'boat', moor: { look: 'moor', water: 0.2, cleats: [-1.1, 2.3] } },
    { kind: 'chain', id: 'orchard.deck', owner: 'deck' },
  ] };
  const plan = (feature: unknown) => ({ version: 1, features: [feature] });
  expect(parseClientPlan(plan(row)).features).toEqual([row]);
  for (const invalid of [
    { ...row, rank: 1 }, { ...row, phase: 'kit' },
    { ...row, bindings: [{ kind: 'chain', id: 'deck', owner: 'deck', moor: { look: 'moor', water: 0, cleats: [0, 1] } }] },
    { ...row, bindings: [{ kind: 'object', id: 'boat', owner: 'boat', target: ['boat', 'group'] }] },
    { ...row, bindings: [{ kind: 'object', id: 'boat', owner: 'boat', moor: { look: 'moor', water: Infinity, cleats: [0, 1] } }] },
    { ...row, bindings: [{ kind: 'object', id: 'boat', owner: 'boat', moor: { look: 'moor', water: Number.NaN, cleats: [0, 1] } }] },
    { ...row, bindings: [{ kind: 'object', id: 'boat', owner: 'boat', moor: { look: 'moor', water: 0, cleats: [0] } }] },
    { ...row, bindings: [{ kind: 'object', id: 'boat', owner: 'boat', moor: { look: 'moor', water: 0, cleats: [0, 1], afterPose: 'refresh' } }] },
  ]) expect(() => parseClientPlan(plan(invalid))).toThrow();
  const f = context();
  try { expect(() => admitClientPlan(plan(row), f.ctx.product)).toThrow('world/movers'); } finally { f.ctx.scope.dispose(); }
});


test.each(['live', 'retiring'] as const)('declared view program installs only for a %s owner after its module read', async state => {
  const f = context(), row = { kind: 'view.program', id: 'deck', module: 'view.wasm', rows: { system: 'deck.view', before: ['camera'],
    budget: { pages: 1, ioBytes: 4096, fuel: 1000, targetMs: .5 }, pools: [], samples: [{ kind: 'floor', piece: 'deck', field: 'present' }, { kind: 'constant', value: 1 }],
    channels: [{ kind: 'camera', field: 'roll' }], transforms: [], bounds: { translation: 0, scale: [1, 1], shear: 0 } } };
  f.sections.set('view/modules', []);
  f.files.set('view.wasm', { hash: 'view', url: 'https://example.invalid/view.wasm' });
  const plan = admitClientPlan({ version: 1, features: [row] }, f.ctx.product), bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const install = vi.spyOn(viewPrograms, 'installViewProgram').mockImplementation(() => undefined);
  const read = vi.spyOn(f.ctx.product, 'file').mockImplementation(() => { if (state === 'retiring') f.ctx.scope.dispose(); return Promise.resolve(bytes); });
  try {
    if (state === 'retiring') {
      await expect(installClientPhase(f.ctx, plan, 'play', f.ctx.scope)).rejects.toThrow('owner has ended');
      expect(install).not.toHaveBeenCalled();
    } else {
      await installClientPhase(f.ctx, plan, 'play', f.ctx.scope);
      expect(install).toHaveBeenCalledExactlyOnceWith(f.ctx, row, bytes);
    }
    expect(read).toHaveBeenCalledExactlyOnceWith('view.wasm');
    expect(() => admitClientPlan({ version: 1, features: [{ ...row, module: 'missing.wasm' }] }, f.ctx.product)).toThrow('admitted module');
    expect(() => parseClientPlan({ version: 1, features: [{ ...row, rows: { ...row.rows, samples: [] } }] })).toThrow();
  } finally { read.mockRestore(); install.mockRestore(); f.ctx.scope.dispose(); }
});


test('the compiled standalone native entry installs finite phases with no TS constructor registry',async()=>{
  const f=context(),order:string[]=[];
  f.sections.set('client/plan',{version:1,features:[{kind:'strings.register'},{kind:'debug.expose',name:'compiled'}]});
  f.strings.mockImplementation(()=>{order.push('world');});f.expose.mockImplementation(()=>{order.push('play');});
  const Entry=declaredClientPlanEntry({retainHomeRuntime:true,stagesOwner:'runtime'}).default;
  const plugin=new Entry(undefined,undefined,()=>false);
  try{await plugin.world(f.ctx);expect(order).toEqual(['world']);await plugin.kit(f.ctx);await plugin.play(f.ctx);expect(order).toEqual(['world','play']);}
  finally{f.ctx.scope.dispose();}
});


test('a finite native kit selection retains its world and play owners without replaying their plan phases', async () => {
  const f = context(), order: string[] = [], phases: string[] = [], release = vi.fn();
  class Native extends ShardPlugin {
    override world(ctx: ShardContext): void { order.push('world'); ctx.scope.onDispose(() => { release(); }); }
    override kit(): void { order.push('native-kit'); }
    override play(): void { order.push('play'); }
  }
  const install = vi.spyOn(clientPhases, 'installClientPhase').mockImplementation((_ctx, _plan, phase) => {
    phases.push(phase); order.push('declared-kit'); return Promise.resolve();
  });
  const policy = { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['kit'] } } as const;
  const Entry = declaredRuntimeEntry(Native, Native, policy).default, plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); expect(phases).toEqual([]);
    await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(phases).toEqual(['kit']); expect(order).toEqual(['world', 'native-kit', 'declared-kit', 'play']);
    expect(f.strings).not.toHaveBeenCalled(); expect(f.expose).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(() => declaredRuntimeEntry(Native, Native, { ...policy, nativePlan: { phases: ['kit', 'kit'] } })).toThrow('Duplicate native client phase');
  } finally { install.mockRestore(); f.ctx.scope.dispose(); }
  expect(release).toHaveBeenCalledOnce();
});


test('native metadata registration leaves the original world as the only look constructor', async () => {
  const f = context(), order: string[] = [];
  f.source.look.materials['orchard-leaves'] = parseFamilyMaterial({ family: 'pbr' });
  f.sections.set('client/plan', { version: 1, features: [{ kind: 'strings.register' }] });
  f.strings.mockImplementation(() => { order.push('strings'); });
  const compile = vi.spyOn(lookCompiler, 'runtimeLookMaterials').mockRejectedValue(new Error('Metadata cannot prepare visual looks'));
  class Native extends ShardPlugin {
    override world(): void { order.push('native-world'); expect(compile).not.toHaveBeenCalled(); }
  }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared',
    nativePlan: { phases: ['world'], features: ['strings.register'] } }).default;
  try {
    await new Entry(undefined, undefined, () => false).world(f.ctx);
    expect(order).toEqual(['strings', 'native-world']); expect(compile).not.toHaveBeenCalled();
  } finally { compile.mockRestore(); f.ctx.scope.dispose(); }
});


test('runtime bounds use their finite defining grammar and actual platform emission', () => {
  const bounds = { x: [-250, 250], z: [-250, 250], outer: { maxAbsXZ: 200, floor: -20 } };
  const row = { kind: 'world.runtime-hooks', bounds, overhead: [] };
  const emitted = emitPlatformSections(new Map([['client/plan', { version: 1, features: [row] }]]));
  const bytes = emitted.files.get('sections/client/plan.json');
  if (bytes === undefined) throw new Error('Missing emitted client plan');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ version: 1, features: [row] });
  const schema = namedJsonSchema(RuntimeBoundsSchema);
  expect(validateNamedJsonSchema(schema, new TextEncoder().encode(JSON.stringify(bounds)))).toEqual(bounds);
  for (const bad of [{ ...bounds, x: [2, 1] }, { ...bounds, z: [0, 0] }, { ...bounds, x: [-250, Number.NaN] },
    { ...bounds, outer: { maxAbsXZ: -1, floor: -20 } }, { ...bounds, outer: { ...bounds.outer, floor: Infinity } },
    { ...bounds, owner: 'player' }, { ...bounds, outer: { ...bounds.outer, path: 'position' } }])
    expect(() => parseClientPlan({ version: 1, features: [{ ...row, bounds: bad }] })).toThrow();
});

test('runtime bound rows dispatch after the original native build and before its gameplay capture', async () => {
  const f = context(), order: string[] = [], bounds = { x: [-250, 250], z: [-250, 250], outer: { maxAbsXZ: 200, floor: -20 } };
  f.sections.set('client/plan', { version: 1, features: [{ kind: 'world.runtime-hooks', bounds, overhead: [] }] });
  const install = vi.spyOn(runtimeHookBindings, 'installClientRuntimeHooks').mockImplementation((_ctx, rows) => {
    expect(rows.bounds).toEqual(bounds); order.push('bounds');
  });
  class Native extends ShardPlugin {
    override world(): void { order.push('build'); }
    override play(): void { order.push('capture'); }
  }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared',
    nativePlan: { phases: ['world-bindings'], features: ['world.runtime-hooks'] } }).default;
  const plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(['build', 'bounds', 'capture']); expect(install).toHaveBeenCalledOnce();
  } finally { install.mockRestore(); f.ctx.scope.dispose(); }
});


test('native chapter view runs after all six original play yields and adds the standard post-feature yield', async () => {
  const f = context(), order: string[] = [];
  f.sections.set('client/plan', { version: 1, features: [{ kind: 'quest.chapter-view', chapterView: 'quests/content.json', story: 'quests/chapters.json', arena: 'chapter.arena', fight: 'chapter.fight' }] });
  for (const file of ['quests/content.json', 'quests/chapters.json']) f.files.set(file, { hash: 'a'.repeat(64), url: `/fixture/${file}` });
  const yieldStep = vi.spyOn(workSlices, 'buildYield').mockImplementation(() => { order.push('yield'); return Promise.resolve(); });
  const install = vi.spyOn(questPreparation, 'installEntryChapterView').mockImplementation(() => { order.push('chapter'); return Promise.resolve(); });
  class Native extends ShardPlugin {
    override async play(): Promise<void> { for (let n = 1; n <= 6; n++) { await Promise.resolve(); order.push(`part${n}`); } }
  }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['play'], features: ['quest.chapter-view'] } }).default;
  try {
    const plugin = new Entry(undefined, undefined, () => false);
    await plugin.world(f.ctx); await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'chapter', 'yield']);
    expect(install).toHaveBeenCalledOnce();
    expect(clientPhases.CLIENT_FEATURES['quest.chapter-view']).toMatchObject({ phase: 'play', rank: 110, lifetime: 'entered', sections: [] });
    expect(yieldStep).toHaveBeenCalledOnce();
  } finally { yieldStep.mockRestore(); install.mockRestore(); f.ctx.scope.dispose(); }
});

test.each(['quests/content.json', 'quests/chapters.json'])('chapter view requires admitted file %s before any phase', file => {
  const f = context();
  f.sections.set('client/plan', { version: 1, features: [{ kind: 'quest.chapter-view', chapterView: 'quests/content.json', story: 'quests/chapters.json', arena: 'chapter.arena', fight: 'chapter.fight' }] });
  const other = file === 'quests/content.json' ? 'quests/chapters.json' : 'quests/content.json';
  f.files.set(other, { hash: 'a'.repeat(64), url: `/fixture/${other}` });
  try { expect(() => admitClientPlan(f.ctx.product.section('client/plan'), f.ctx.product)).toThrow('Chapter view requires'); }
  finally { f.ctx.scope.dispose(); }
});
