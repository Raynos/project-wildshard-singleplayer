import { expect, it } from 'vitest';
import * as v from 'valibot';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { WorldRegistry } from '../src/engine/world/registry';
import { Scope, scopeRegistrations } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { createLevelInstallation } from '../src/engine/level/installation';
import type { LevelDriver } from '../src/engine/level/load';
import { emptyShardfile } from '../src/sdk/author';
import { RuntimeSchema, prepareTrustedRuntime, type TrustedRuntimeEntry } from '../src/game/shardfile/runtime';
import { HybridResidentWorld, HybridShardPlugin, HybridRuntimeSession, hybridShardManifest, installHybridRuntime, prepareHybridShard, type HybridResident } from '../src/game/shardfile/hybrid';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { installEnteredRuntimeService } from '../src/game/shard/retainedHooks';
import { bindScopedRuntime, createScopedRuntimeBinding } from '../src/game/shard/scopedRuntime';
import { shardContext, type GameServices, type ShardContext } from '../src/game/shard/context';
import { ShardPlugin } from '../src/game/shard/plugin';
import { loadShardPlugin } from '../src/game/shard/pluginLoad';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { ITEMS } from '../src/game/bag/itemCatalog';
import { achievementsFor } from '../src/game/achievements';
import { GridCellEvents } from '../src/game/grid/boot';
import template from '../src/shards/_template/manifest';

const noop = (): void => undefined;
const runtime = (): ShardRuntime => ({ world: null, step: null, play: null, hooks: {}, objects: {}, interactables: [], overhead: [], viewer: () => new Vector3(), horizonVeil: null });
const entry = 'runtime/index.ts';
function fixture() {
  const app = new App(); app.registryValue = new WorldRegistry();
  const parent = runtime(), cells = new GridCellEvents(), calls: string[] = [], bag = new Set<string>();
  const residents = new Map<string, HybridResident>(), games = new Map<string, GameServices>(), roots = new Map<string, Group>();
  const token = () => Promise.reject(new Error('Fixture equipment is not built'));
  const plugin = (id: string) => class extends ShardPlugin {
    override world(ctx: ShardContext): void {
      calls.push(`${id}.world`); ctx.strings({ 'hybrid.fixture': id });
      ctx.debug.expose('hybrid.active', id);
      const model = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); ctx.root.add(model);
      ctx.piece({ id: 'hybrid.piece', name: 'Runtime piece', file: 'runtime/index.ts', category: 'props', object: model });
      const rt = ctx.game.runtime; if (rt === undefined) throw new Error('Missing runtime');
      rt.hooks.worldUpdate = () => { calls.push(`${id}.update`); }; rt.objects['hybrid'] = id;
      rt.overhead.push(new Group()); rt.buildEquipment = token;
      ctx.scope.listen(new EventTarget(), 'hybrid-fixture', noop); ctx.scope.interval(60_000, noop);
    }
    override kit(ctx: ShardContext): void {
      calls.push(`${id}.kit`); ctx.rows.ammo({ id: 'hybrid.ammo' });
      ctx.rows.item({ id: 'hybrid-token', label: 'Hybrid token', icon: 'meat' }); ctx.rows.places({ id: 'hybrid.place' });
      ctx.rows.feat({ id: 'hybrid.feat', name: 'Hybrid', goal: 'Cross', count: 1, title: 'Crossed', icon: 'check' });
      ctx.tiers.knobs({ id: 'hybrid.knobs', defaults: {} });
    }
    override play(ctx: ShardContext): void {
      calls.push(`${id}.play`); ctx.bag.tab({ id: 'finds', title: 'Hybrid' });
      ctx.system({ id: 'hybrid.system', phase: 'update', run: () => { calls.push(`${id}.system`); } });
      ctx.on('level.loaded', noop); ctx.answer('player.crouch', () => ({ allowed: true, latched: false }));
      ctx.inputContext({ id: 'hybrid.input', actions: ['attack'] });
    }
  };
  const entries: TrustedRuntimeEntry[] = [];
  for (const [instance, slug] of [['template-1', 'template'], ['hybrid-b', 'hybrid-b']] as const) {
    const source = emptyShardfile({ slug, name: slug, author: 'Fixture', seed: 1, revision: 1 }), manifest = emptyShardfileSource(source);
    const scope = app.engineScope.child(`data:${instance}`), root = new Group(); root.add(new Group()); roots.set(instance, root);
    const game: GameServices = { runtime: parent, shard: manifest, rows: new Map(), bag: {
      tab: () => { bag.add(instance); return () => { bag.delete(instance); }; }, fragment: () => noop,
    } }; games.set(instance, game);
    residents.set(instance, { instance, slug, declaration: { entry }, firstParty: true, scope, runtime: parent,
      context: (playScope, local) => {
        const installation = createLevelInstallation(app, playScope, { inputContext: (def) => {
          app.input.register(def, playScope); app.input.push(def.id, playScope); return () => { app.input.pop(def.id); };
        } }, () => ({ set: noop, detail: noop }));
        root.add(installation.context.root);
        return { ...installation, context: shardContext(installation.context, manifest, { ...game, runtime: local }) };
      },
    });
    entries.push({ slug, entry, load: () => { calls.push(`${slug}.import`); return Promise.resolve({ default: plugin(instance) }); } });
  }
  const session = new HybridRuntimeSession(residents, entries, app.engineScope);
  const census = () => ({ descriptors: Object.getOwnPropertyDescriptors(parent),
    events: app.events.census(), systems: app.systemIds(app.engineScope), debug: app.debug.snapshot(), input: app.input.contexts,
    engineRows: app.levelRegistrations.list('ammo'), knobs: app.levelRegistrations.knobSchemas(), strings: app.levelRegistrations.findText('hybrid.fixture'),
    gameRows: [...games].map(([id, game]) => [id, [...game.rows].map(([kind, rows]) => [kind, [...rows.keys()]])]),
    achievements: ['template', 'hybrid-b'].map((slug) => achievementsFor(slug)), items: Object.entries(ITEMS), pieces: app.registry.pieces.map((p) => p.id),
    bag: [...bag], roots: [...roots].map(([id, root]) => [id, root.children.length]), scope: app.engineScope.census,
    native: scopeRegistrations((scope) => scope.belongsTo(app.engineScope)),
  });
  return { app, parent, cells, session, calls, census, residents, entries };
}

it('stages an admitted regional shell only inside the cell and parks retained services across two visits', async () => {
  const f = fixture(), resident = f.residents.get('template-1');
  if (resident === undefined) throw new Error('Missing fixture resident');
  let ticks = 0, worldBuilds = 0;
  class Regional extends ShardPlugin {
    override world(ctx: ShardContext): void {
      worldBuilds++; f.calls.push('trusted.world');
      ctx.piece({ id: 'regional.static', name: 'Static', file: 'fixture', category: 'props' });
      const rt = ctx.game.runtime; if (rt === undefined) throw new Error('Missing scoped runtime');
      rt.objects['regional.state'] = { visits: 0 };
    }
    override kit(ctx: ShardContext): void { f.calls.push('trusted.kit'); ctx.rows.ammo({ id: 'regional.ammo' }); }
    override play(ctx: ShardContext): void {
      f.calls.push('trusted.play');
      installEnteredRuntimeService(ctx, scope => {
        ctx.app.addSystem({ id: 'regional.tick', phase: 'update', run: () => { ticks++; } }, scope);
        scope.onDispose(ctx.app.debug.scopedExpose('regional.entered', true));
      });
    }
  }
  f.entries[0] = { slug: 'template', entry, load: () => { f.calls.push('module'); return Promise.resolve({ default: Regional }); } };
  f.residents.set('template-1', { ...resident, retainRuntime: true, context: (scope, rt) => ({
    ...resident.context(scope, rt), afterWorld: () => { f.calls.push('shell.world'); }, afterKit: () => { f.calls.push('shell.kit'); },
  }) });
  const before = Object.getOwnPropertyDescriptors(f.parent);
  try {
    await f.session.prepare('template-1'); expect(f.calls).toEqual(['module']); expect(f.app.registry.pieceList()).toEqual([]);
    for (let visit = 0; visit < 2; visit++) {
      expect(await f.session.enter({ instance: 'template-1', slug: 'template' })).toBe(true);
      expect(f.session.state()).toEqual({ instance: 'template-1', ready: true });
      for (const system of f.app.systemsByPhase().update) system.run(1 / 60, visit);
      f.session.leave(); expect(f.session.state().ready).toBe(false); expect(f.app.debug.snapshot()).toEqual({});
      expect(Object.getOwnPropertyDescriptors(f.parent)).toEqual(before);
      for (let tick = 0; tick < 600; tick++) for (const system of f.app.systemsByPhase().update) system.run(1 / 60, tick);
      expect(ticks).toBe(visit + 1); expect(f.app.registry.pieceList().map(piece => piece.id)).toEqual(['regional.static']);
    }
    expect(worldBuilds).toBe(1);
    expect(f.calls).toEqual(['module', 'trusted.world', 'shell.world', 'trusted.kit', 'shell.kit', 'trusted.play']);
  } finally { f.app.engineScope.dispose(); }
  expect(f.app.registry.pieceList()).toEqual([]); expect(Object.getOwnPropertyDescriptors(f.parent)).toEqual(before);
});

it('cannot continue a regional shell callback into the next entered cell after leaving during an await', async () => {
  const f = fixture(), resident = f.residents.get('template-1');
  if (resident === undefined) throw new Error('Missing fixture resident');
  let release = noop, reachedKit = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.residents.set('template-1', { ...resident, retainRuntime: true, context: (scope, rt) => ({
    ...resident.context(scope, rt), afterWorld: () => gate, afterKit: () => { reachedKit = true; },
  }) });
  try {
    const pending = f.session.enter({ instance: 'template-1', slug: 'template' });
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(f.session.state()).toEqual({ instance: 'template-1', ready: false });
    expect(f.session.timings().current).toMatchObject({ instance: 'template-1', hook: 'afterWorld' });
    f.session.leave(); await f.session.enter({ instance: 'hybrid-b', slug: 'hybrid-b' }); release();
    expect(await pending).toBe(false); expect(reachedKit).toBe(false);
    expect(f.session.state()).toEqual({ instance: 'hybrid-b', ready: true });
    expect(f.parent.objects['hybrid']).toBe('hybrid-b');
    expect(f.session.timings().current).toBeNull();
    expect(f.session.timings().completed.every(row => Number.isFinite(row.start) && row.end >= row.start)).toBe(true);
  } finally { release(); f.app.engineScope.dispose(); }
});
it('bounds entered hook diagnostics across repeated installations without changing hook order or readiness', async () => {
  const f = fixture();
  try {
    for (let visit = 0; visit < 6; visit++) {
      expect(await f.session.enter({ instance: 'template-1', slug: 'template' })).toBe(true);
      f.session.leave();
    }
    const timing = f.session.timings();
    expect(timing.current).toBeNull(); expect(timing.completed).toHaveLength(32);
    expect(timing.completed.slice(-8).map(row => row.hook)).toEqual(['beforeWorld', 'constructor', 'world', 'afterWorld', 'kit', 'afterKit', 'play', 'afterPlay']);
    expect(timing.completed.every(row => row.instance === 'template-1' && row.outcome === 'done' && row.end >= row.start)).toBe(true);
    expect(f.calls.filter(call => call === 'template-1.play')).toHaveLength(6);
    expect(f.session.state().ready).toBe(false);
  } finally { f.app.engineScope.dispose(); }
});

it('admits only the declared same-shard first-party runtime entry without importing data-controlled paths', async () => {
  for (const path of ['../runtime/index.ts', 'runtime/../index.ts', 'https://example.test/runtime.ts', '/runtime/index.ts', 'runtime/index.js']) expect(v.safeParse(RuntimeSchema, { entry: path }).success).toBe(false);
  let imports = 0;
  const entries = [{ slug: 'template', entry, load: () => { imports++; return Promise.resolve({ default: class extends ShardPlugin {} }); } }];
  await expect(prepareTrustedRuntime({ entry }, 'template', false, entries)).rejects.toThrow('first-party');
  await expect(prepareTrustedRuntime({ entry }, 'another', true, entries)).rejects.toThrow('matching');
  await expect(prepareTrustedRuntime({ entry }, 'template', true, [...entries, ...entries])).rejects.toThrow('exactly one');
  expect(imports).toBe(0); await prepareTrustedRuntime({ entry }, 'template', true, entries); expect(imports).toBe(1);
});
it('keeps both fixture neighbours data-only and returns all global slots and registrations to baseline across 20 two-hybrid crossings', async () => {
  const f = fixture();
  try {
    const before = f.census();
    await Promise.all([f.session.prepare('template-1'), f.session.prepare('hybrid-b')]);
    expect(f.calls).toEqual(['template.import', 'hybrid-b.import']); expect(f.census()).toEqual(before);
    for (let cycle = 0; cycle < 20; cycle++) {
      await f.session.enter({ instance: 'template-1', slug: 'template' });
      expect(f.session.state()).toEqual({ instance: 'template-1', ready: true }); expect(f.parent.objects['hybrid']).toBe('template-1');
      for (const system of f.app.systemsByPhase().update) system.run(1 / 60, cycle);
      await f.session.enter({ instance: 'hybrid-b', slug: 'hybrid-b' });
      expect(f.session.state()).toEqual({ instance: 'hybrid-b', ready: true }); expect(f.parent.objects['hybrid']).toBe('hybrid-b');
      expect(achievementsFor('template')).toEqual([]); expect(f.app.systemIds(f.app.engineScope)).toEqual(['hybrid.system']);
      f.session.leave(); expect(f.census()).toEqual(before);
    }
    expect(f.calls.filter((call) => call.endsWith('.world'))).toHaveLength(40);
  } finally { f.app.engineScope.dispose(); }
});
it('late hooks retain their private slots and refuse registrations after leave instead of writing into the next hybrid scope', async () => {
  const f = fixture(); let release = noop; let rejected = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  class Late extends ShardPlugin {
    override async world(ctx: ShardContext): Promise<void> {
      await gate; const rt = ctx.game.runtime; if (rt === undefined) throw new Error('Missing runtime');
      rt.buildEquipment = () => Promise.reject(new Error('Late')); rt.hooks.worldUpdate = noop; rt.objects['hybrid'] = 'late';
      try { ctx.system({ id: 'hybrid.late', phase: 'update', run: noop }); } catch { rejected = true; }
    }
  }
  const slow = f.residents.get('template-1'); if (slow === undefined) throw new Error('Missing template fixture');
  const session = new HybridRuntimeSession(f.residents, [{ slug: 'template', entry, load: () => Promise.resolve({ default: Late }) }, f.entries[1] ?? { slug: '', entry, load: () => Promise.reject(new Error('Missing entry')) }], f.app.engineScope);
  try {
    const before = f.census(), entering = session.enter({ instance: 'template-1', slug: 'template' });
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
    session.leave(); await session.enter({ instance: 'hybrid-b', slug: 'hybrid-b' });
    const next = f.parent.buildEquipment; release(); expect(await entering).toBe(false); expect(rejected).toBe(true);
    expect(f.parent.objects['hybrid']).toBe('hybrid-b'); expect(f.parent.buildEquipment).toBe(next);
    expect(f.app.systemIds(f.app.engineScope)).toEqual(['hybrid.system']); session.leave(); expect(f.census()).toEqual(before);
  } finally { release(); f.app.engineScope.dispose(); }
});
it('consumes late grid subscribers and removes runtime scopes on the strip without removing data roots', async () => {
  const f = fixture(), reports: unknown[] = [];
  const report = (error: unknown): void => { reports.push(error); };
  try {
    f.cells.enter({ instance: 'template-1', slug: 'template' }); installHybridRuntime(f.cells, f.session, f.app.engineScope, report);
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    expect(f.session.state().instance).toBe('template-1'); f.cells.leave();
    expect(f.session.state()).toEqual({ instance: null, ready: false }); expect(f.census().roots).toEqual([['template-1', 1], ['hybrid-b', 1]]); expect(reports).toEqual([]);
  } finally { f.app.engineScope.dispose(); }
});
it('retains the ordinary staged standalone boot and restores runtime descriptors on unload', async () => {
  const app = new App(), parent = runtime(), stages: string[] = [];
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop }; app.levelDriver = driver;
  class Runtime extends ShardPlugin {
    override world(ctx: ShardContext): void { stages.push('world'); ctx.debug.expose('hybrid.template', 1); }
    override kit(ctx: ShardContext): void { stages.push('kit'); const rt = ctx.game.runtime; if (rt !== undefined) rt.buildEquipment = () => Promise.reject(new Error('Custom')); }
    override play(): void { stages.push('play'); }
  }
  const data = emptyShardfileSource(emptyShardfile({ slug: 'template', name: 'Template', author: 'Fixture', seed: 357, revision: 1 }));
  const manifest = await hybridShardManifest(data, template, { entry }, true, [{ slug: 'template', entry, load: () => Promise.resolve({ default: Runtime }) }]);
  const before = Object.getOwnPropertyDescriptors(parent);
  try {
    await loadShardPlugin(app, manifest, { shard: manifest, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } }, { build: 'hybrid', dispose: () => app.unloadLevel(), report: () => Promise.resolve(), show: noop });
    expect(stages).toEqual(['world', 'kit', 'play']); expect(manifest.render).toBe(template.render); expect(manifest.ground).toBe(template.ground);
    await app.unloadLevel(); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before); expect(app.debug.snapshot()).toEqual({});
  } finally { await app.unloadLevel(); app.engineScope.dispose(); }
});
it('isolates trusted writes to borrowed shell services while following later platform updates', () => {
  const parent = runtime(), scope = new Scope('runtime.fixture'), first = parent.viewer, next = () => new Vector3(1, 2, 3);
  const local = bindScopedRuntime(parent, scope); parent.viewer = next; expect(local.viewer).toBe(next);
  local.viewer = first; expect(parent.viewer).toBe(next); scope.dispose(); expect(parent.viewer).toBe(next);
});

it('releases trusted creature dependants before shell resources created between kit and play', async () => {
  const app = new App(), parent = runtime(), calls: string[] = [];
  const scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  let shellAlive = true;
  class Data extends ShardPlugin {}
  class Runtime extends ShardPlugin {
    override kit(context: ShardContext): void {
      context.scope.onDispose(() => {
        if (!shellAlive) throw new Error('Creature motor was already freed');
        calls.push('trusted');
      });
    }
  }
  const plugin = new HybridShardPlugin(new Data(), Runtime);
  try {
    await plugin.world(ctx); await plugin.kit(ctx);
    scope.onDispose(() => { shellAlive = false; calls.push('shell'); });
    await plugin.play(ctx);
    expect(() => scope.dispose()).not.toThrow(); expect(calls).toEqual(['trusted', 'shell']);
    expect(scope.census.disposers).toBe(0);
  } finally { app.engineScope.dispose(); }
});

it('restores non-enumerable and symbol descriptors even when another disposer throws', () => {
  const parent = runtime(), scope = new Scope('runtime.fixture'), key = Symbol('fixture'), token = () => Promise.reject(new Error('Fixture'));
  Object.defineProperty(parent, 'buildEquipment', { configurable: true, enumerable: false, writable: false, value: token });
  Object.defineProperty(parent, key, { configurable: true, enumerable: false, get: () => 'original' });
  const before = Object.getOwnPropertyDescriptors(parent), local = bindScopedRuntime(parent, scope);
  expect(local.buildEquipment).toBe(token); expect(Reflect.get(local, key)).toBe('original');
  local.buildEquipment = () => Promise.reject(new Error('Scoped'));
  Reflect.set(local, key, 'scoped'); expect(Reflect.get(parent, key)).toBe('scoped');
  scope.onDispose(() => { throw new Error('Fixture cleanup failure'); });
  expect(() => scope.dispose()).toThrow('Fixture cleanup failure'); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
  const next = new Scope('runtime.next'); bindScopedRuntime(parent, next); next.dispose();
  expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
});

it('the admitted runtime-owned audio hybrid preserves the legacy service census and staged hooks', async () => {
  const app = new App(), parent = runtime(), calls: string[] = [];
  const source = { ...emptyShardfile({ slug: 'template', name: 'Template', author: 'Fixture', seed: 357, revision: 1 }), runtime: { entry } };
  source.audio.routing.push({ id: 'cue.fixture', when: [], actions: [{ voice: 'runtime.fixture', when: [], defaults: {}, delay: null }] });
  source.audio.score = 'default';
  class Runtime extends ShardPlugin {
    override world(): void { calls.push('world'); }
    override kit(ctx: ShardContext): void { calls.push('kit'); const rt = ctx.game.runtime; if (rt !== undefined) rt.hooks.meleeSilent = true; }
    override play(): void { calls.push('play'); }
  }
  const plugin = await prepareHybridShard(source, { base: 'https://fixture.test/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('Empty data cannot fetch')), hash: () => Promise.reject(new Error('Empty data cannot hash')) },
  { catalogue: [], recipes: new Map(), items: new Map(), voices: () => new Map(), icon: () => { throw new Error('No icons'); } },
  [{ slug: 'template', entry, load: () => Promise.resolve({ default: Runtime }) }]);
  const scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const before = Object.getOwnPropertyDescriptors(parent);
  try {
    if (plugin.world === undefined || plugin.kit === undefined || plugin.play === undefined) throw new Error('Missing trusted runtime stages');
    await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
    expect(calls).toEqual(['world', 'kit', 'play']); expect(app.systemIds(app.engineScope)).toEqual([]);
    expect(parent.hooks.meleeSilent).toBe(true); scope.dispose(); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
  } finally { app.engineScope.dispose(); }
});

it('the default-off Debug row returns the legacy plugin without admitting data or binding runtime slots', async () => {
  const app = new App(), parent = runtime(), calls: string[] = [];
  const scope = app.engineScope.child('legacy'), installation = createLevelInstallation(app, scope, {
    debugRow: (row) => { calls.push(`row:${row.initial}`); row.change(row.initial); return noop; },
  }, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const before = Object.getOwnPropertyDescriptors(parent);
  class Runtime extends ShardPlugin {
    override world(context: ShardContext): void { expect(context).toBe(ctx); calls.push('legacy.world'); }
  }
  try {
    const plugin = await prepareHybridShard({ ...emptyShardfile({ slug: 'template', name: 'Template', author: 'Fixture', seed: 357, revision: 1 }), runtime: { entry } },
      { base: 'https://fixture.test/', firstParty: true, offline: false,
        fetch: () => Promise.reject(new Error('Default-off cannot fetch data')), hash: () => Promise.reject(new Error('Default-off cannot hash data')) },
      { catalogue: [], recipes: new Map(), items: new Map(), voices: () => new Map(), icon: () => { throw new Error('Default-off cannot resolve icons'); } },
      [{ slug: 'template', entry, load: () => Promise.resolve({ default: Runtime }) }],
      { context: ctx, row: { id: 'hybridFixture', label: 'Fixture', group: 'loading', initial: 'off', choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }],
        ask: 'E435', reviewBy: '2026-10-11', note: 'Default-off boot fixture.' } });
    expect(plugin).toBeInstanceOf(Runtime); await plugin.world?.(ctx);
    expect(calls).toEqual(['row:off', 'legacy.world']); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
  } finally { app.engineScope.dispose(); }
});

it('staged home-cell runtime leaves on the strip, ignores neighbours and re-enters without reinstalling data', async () => {
  const app = new App(), parent = runtime(), cells = new GridCellEvents(), calls: string[] = [];
  const scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  class Data extends ShardPlugin { override world(): void { calls.push('data'); } }
  class Runtime extends ShardPlugin {
    override world(context: ShardContext): void { calls.push('world'); context.debug.expose('home-runtime', true); }
    override kit(): void { calls.push('kit'); }
    override play(context: ShardContext): void { calls.push('play'); context.system({ id: 'home.runtime', phase: 'update', run: noop }); }
  }
  cells.enter({ instance: 'template-1', slug: 'template' });
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'template-1', cells });
  try {
    await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
    cells.leave(); expect(app.systemIds(app.engineScope)).toEqual([]); expect(app.debug.snapshot()).toEqual({});
    cells.enter({ instance: 'neighbour', slug: 'hybrid-b' });
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    expect(calls).toEqual(['data', 'world', 'kit', 'play']);
    cells.enter({ instance: 'template-1', slug: 'template' });
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(calls).toEqual(['data', 'world', 'kit', 'play', 'world', 'kit', 'play']);
    expect(app.systemIds(app.engineScope)).toEqual(['home.runtime']); cells.leave(); expect(app.systemIds(app.engineScope)).toEqual([]);
  } finally { app.engineScope.dispose(); }
});

it('a cancelled staged re-entry cannot dispose the next scope when its world hook completes late', async () => {
  const app = new App(), parent = runtime(), cells = new GridCellEvents(), faults: unknown[] = [];
  const readiness: boolean[] = [];
  const scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  let calls = 0, release = noop;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  class Runtime extends ShardPlugin {
    override async world(context: ShardContext): Promise<void> {
      const call = ++calls; if (call === 2) await gate;
      const rt = context.game.runtime; if (rt === undefined) throw new Error('Missing runtime'); rt.objects['call'] = call;
    }
    override play(context: ShardContext): void { context.system({ id: 'home.runtime', phase: 'update', run: noop }); }
  }
  cells.enter({ instance: 'template-1', slug: 'template' });
  class Data extends ShardPlugin {}
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'template-1', cells, readiness: (ready) => { readiness.push(ready); } });
  app.events.on('fault', (fault) => { faults.push(fault); }, scope);
  try {
    await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
    cells.leave(); cells.enter({ instance: 'template-1', slug: 'template' });
    cells.leave(); cells.enter({ instance: 'template-1', slug: 'template' });
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(parent.objects['call']).toBe(3); expect(readiness.at(-1)).toBe(true);
    const beforeLateCompletion = [...readiness]; release();
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(parent.objects['call']).toBe(3); expect(app.systemIds(app.engineScope)).toEqual(['home.runtime']); expect(faults).toEqual([]);
    expect(readiness).toEqual(beforeLateCompletion);
    cells.leave(); expect(app.systemIds(app.engineScope)).toEqual([]); expect(readiness.at(-1)).toBe(false);
  } finally { release(); app.engineScope.dispose(); }
});

it('keeps gameplay unready until the entered runtime play hook finishes, independently of module admission', async () => {
  const app = new App(), parent = runtime(), cells = new GridCellEvents(), readiness: boolean[] = [];
  const scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  let release = noop;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  class Data extends ShardPlugin {}
  class Runtime extends ShardPlugin { override async play(): Promise<void> { await gate; } }
  cells.enter({ instance: 'template-1', slug: 'template' });
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'template-1', cells, readiness: (ready) => { readiness.push(ready); } });
  try {
    await plugin.world(ctx); await plugin.kit(ctx); const playing = plugin.play(ctx);
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
    expect(readiness).toEqual([false]); release(); await playing; expect(readiness).toEqual([false, true]);
    cells.leave(); expect(readiness).toEqual([false, true, false]);
  } finally { release(); app.engineScope.dispose(); }
});

it('keeps declared audio as the data-first hybrid default and refuses runtime ownership without a trusted entry', async () => {
  const source = emptyShardfile({ slug: 'template', name: 'Template', author: 'Fixture', seed: 357, revision: 1 });
  source.audio.routing.push({ id: 'cue.fixture', when: [], actions: [] });
  const options = { base: 'https://fixture.test/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('Fixture cannot fetch')), hash: () => Promise.reject(new Error('Fixture cannot hash')) };
  const bindings = { catalogue: [], recipes: new Map(), items: new Map(), voices: () => new Map(), icon: () => { throw new Error('Fixture cannot resolve icons'); } };
  const { shardfileSource } = await import('../src/game/shardfile/loader');
  await expect(shardfileSource(source, options, { ...bindings, instance: 'template', audioOwner: 'runtime' })).rejects.toThrow('Runtime audio ownership requires a trusted first-party runtime declaration');
  const manifest = await shardfileSource(source, options, { ...bindings, instance: 'template' });
  if (manifest.load === undefined) throw new Error('Missing data plugin');
  const { default: Data } = await manifest.load();
  const app = new App(), scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: runtime(), rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  try { await expect(new Data().world?.(ctx)).rejects.toThrow('normal world stage'); }
  finally { app.engineScope.dispose(); }
});


it('retains one asynchronous resident world across two entries while disposing every entered gameplay scope', async () => {
  const app = new App(); app.registryValue = new WorldRegistry();
  const parent = runtime(), before = Object.getOwnPropertyDescriptors(parent), cells = new GridCellEvents();
  const scope = app.engineScope.child('data'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const worlds = new HybridResidentWorld<object>(); let builds = 0, installations = 0, releasedWorlds = 0;
  class Data extends ShardPlugin {}
  class Runtime extends ShardPlugin {
    override async world(context: ShardContext): Promise<void> {
      const built = await worlds.load(context, async (owner) => {
        builds++; await Promise.resolve(); await Promise.resolve();
        // Like a yielded legacy builder, registration happens after the synchronous hook owner has gone.
        withOwner(owner, () => app.registry.add({ id: 'pier', name: 'Pier', file: 'runtime/index.ts', category: 'buildings' }));
        owner.onDispose(() => { releasedWorlds++; });
        return {};
      });
      const local = context.game.runtime; if (local === undefined) throw new Error('Missing runtime');
      local.objects['world'] = built;
    }
    override play(context: ShardContext): void {
      installations++; context.system({ id: 'entered.movers', phase: 'fixed.pre', run: noop });
    }
  }
  cells.enter({ instance: 'template-1', slug: 'template' });
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'template-1', cells });
  try {
    await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
    const first = parent.objects['world']; expect(builds).toBe(1); expect(app.registry.pieceList().map((piece) => piece.id)).toEqual(['pier']);
    cells.leave(); expect(app.systemIds(app.engineScope)).toEqual([]); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
    expect(releasedWorlds).toBe(0); expect(app.registry.pieceList()).toHaveLength(1);
    cells.enter({ instance: 'template-1', slug: 'template' });
    for (let turn = 0; turn < 32; turn++) await Promise.resolve();
    expect(parent.objects['world']).toBe(first); expect(builds).toBe(1); expect(installations).toBe(2);
    expect(app.systemIds(app.engineScope)).toEqual(['entered.movers']); expect(app.registry.pieceList().map((piece) => piece.id)).toEqual(['pier']);
    cells.leave(); expect(app.systemIds(app.engineScope)).toEqual([]); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
    scope.dispose(); expect(releasedWorlds).toBe(1); expect(app.registry.pieceList()).toEqual([]);
    await expect(worlds.load(ctx, () => Promise.resolve({}))).rejects.toThrow('live hybrid resident');
  } finally { app.engineScope.dispose(); }
});

it('reactivates a retained home handoff without publishing its road-time or late writes into another scope', () => {
  const parent = runtime(), scope = new Scope('home'), other = new Scope('other');
  const key = Symbol('home.fixture');
  Object.defineProperty(parent, key, { configurable: true, enumerable: false, get: () => 'platform' });
  const before = Object.getOwnPropertyDescriptors(parent), home = createScopedRuntimeBinding(parent, scope);
  const equipment = () => Promise.reject(new Error('Fixture equipment'));
  home.runtime.buildEquipment = equipment; home.runtime.objects['home'] = { saved: 7 };
  home.activate(); expect(parent.buildEquipment).toBe(equipment);
  const saved = parent.objects['home']; home.deactivate();
  expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before); expect(home.active()).toBe(false);
  const neighbour = bindScopedRuntime(parent, other); neighbour.objects['active'] = 'neighbour';
  home.runtime.objects['late'] = 'home'; Reflect.set(home.runtime, key, 'retained');
  expect(parent.objects['late']).toBeUndefined(); expect(Reflect.get(parent, key)).toBe('platform');
  expect(() => home.activate()).toThrow('previous runtime'); other.dispose();
  for (let visit = 0; visit < 2; visit++) {
    home.activate(); expect(parent.objects['home']).toBe(saved); expect(parent.buildEquipment).toBe(equipment);
    expect(Reflect.get(parent, key)).toBe('retained'); home.deactivate();
    expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
  }
  home.activate(); scope.dispose(); expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
  expect(scope.census.disposers).toBe(0); expect(() => home.activate()).toThrow('disposed');
});

it('reactivates an adapted borrowed home without rebuilding its world, equipment or authored state', async () => {
  const app = new App(); app.registryValue = new WorldRegistry();
  const parent = runtime(), cells = new GridCellEvents(), calls: string[] = [], readiness: boolean[] = [];
  const scope = app.engineScope.child('retained.home'), installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, template, { shard: template, runtime: parent, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const before = Object.getOwnPropertyDescriptors(parent), state = { ticks: 0 };
  class Data extends ShardPlugin {}
  class Runtime extends ShardPlugin {
    override world(context: ShardContext): void {
      calls.push('world'); context.piece({ id: 'retained.pier', name: 'Pier', category: 'props', file: 'runtime/index.ts' });
      const local = context.game.runtime; if (local === undefined) throw new Error('Missing home runtime');
      local.objects['state'] = state;
      installEnteredRuntimeService(context, (entered) => { entered.onDispose(app.debug.scopedExpose('retained.active', true)); });
    }
    override kit(): void { calls.push('kit'); }
    override play(context: ShardContext): void {
      calls.push('play'); context.system({ id: 'retained.logic', phase: 'update', run: () => { state.ticks++; } });
    }
  }
  cells.enter({ instance: 'template-1', slug: 'template' });
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'template-1', cells, retainHomeRuntime: true,
    readiness: (ready) => { readiness.push(ready); } });
  try {
    await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
    for (let visit = 0; visit < 2; visit++) {
      if (visit > 0) {
        cells.enter({ instance: 'template-1', slug: 'template' });
        for (let turn = 0; turn < 20; turn++) await Promise.resolve();
      }
      expect(parent.objects['state']).toBe(state); expect(readiness.at(-1)).toBe(true);
      for (const system of app.systemsByPhase().update) system.run(1 / 60, visit);
      expect(app.debug.snapshot()).toEqual({ 'retained.active': true });
      cells.leave(); expect(readiness.at(-1)).toBe(false);
      expect(app.systemIds(app.engineScope)).toEqual([]); expect(app.debug.snapshot()).toEqual({});
      expect(Object.getOwnPropertyDescriptors(parent)).toEqual(before);
      expect(app.registry.pieceList().map((piece) => piece.id)).toEqual(['retained.pier']);
      cells.enter({ instance: 'neighbour', slug: 'hybrid-b' });
      for (let turn = 0; turn < 20; turn++) await Promise.resolve();
      expect(app.systemIds(app.engineScope)).toEqual([]);
    }
    expect(calls).toEqual(['world', 'kit', 'play']); expect(state.ticks).toBe(2);
  } finally { app.engineScope.dispose(); }
  expect(app.registry.pieceList()).toEqual([]); expect(app.engineScope.census.disposers).toBe(0);
});
