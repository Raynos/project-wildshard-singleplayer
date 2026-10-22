// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Group, Scene, Mesh, MeshBasicMaterial, BufferGeometry, Vector3 } from 'three';
import { WorldRegistry } from '../src/engine/world/registry';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import type { ShardContext } from '../src/game/plugin/context';
import type { ModelContext } from '../src/engine/models/model';
import type { ForestWeatherRig } from '../src/game/weather/forest';
import type { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { WorldAssembly, installAssemblyWeather, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import { publishEntryOwner, entryOwner, lendEntryOwner } from '../src/game/shardfile/entryOwners';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { ClientChannels } from '../src/sdk/clientChannels';
import { parseClientChannels } from '../src/format/clientChannels';
import { DayCycle } from '../src/engine/world/dayCycle';
import { WeatherContinuation } from '../src/engine/world/weatherContinuation';
import { lendLooks } from '../src/game/shardfile/lentLooks';

const row = { kind: 'weather', id: 'meadow.weather', file: 'world/weather.json' } as const;
const policy = { files: { program: 'weather/program.json' }, mode: 'live', debug: 'meadow.weather', heldPhase: 0,
  system: { id: 'meadow.weather', after: [], before: [] } };
function fixture(parent?: Scope) {
  const scope = parent?.child('world-weather') ?? new Scope('world-weather'), trace: string[] = [];
  type Runtime = NonNullable<ShardContext['game']['runtime']>;
  const sky = legacyDouble<NonNullable<Runtime['world']>['sky']>({}), root = new Scene();
  const game = legacyDouble<NonNullable<Runtime['world']>['game']>({ scene: root, levelScope: scope });
  const world = legacyDouble<NonNullable<Runtime['world']>>({ game, sky }), runtime = legacyDouble<Runtime>({ world });
  let settle: (value: unknown) => void = () => { throw new Error('Missing read resolver'); };
  const result = new Promise<unknown>(resolve => { settle = resolve; });
  const source = emptyShardfile({ slug: 'weather-fixture', name: 'Weather fixture', author: 'Fixture', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([[row.file, { hash: 'weather', url: 'weather' }]]), read: async () => { trace.push('read weather'); return new TextEncoder().encode(JSON.stringify(await result)); } });
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime }) });
  const ports: WorldAssemblyPorts = { scope, weatherContext: ctx, scenes: legacyDouble<SceneHandles>({ group: () => new Group() }),
    context: legacyDouble<ModelContext>({ sky }), registry: null, slice: label => { trace.push(label); return Promise.resolve(); } };
  return { scope, ports, ctx, runtime, world, product, trace, settle };
}

test('weather is a finite ordered stage with no authored progress, callback or phase knob', () => {
  const rows = { stages: [row] };
  expect(v.parse(WorldAssemblySchema, rows)).toEqual(rows);
  for (const extra of [{ label: 'extra progress' }, { phase: 'world' }, { run: 'install' }, { page: ['path'] }])
    expect(() => v.parse(WorldAssemblySchema, { stages: [{ ...row, ...extra }] })).toThrow();
  const schema = namedJsonSchema(WorldAssemblySchema);
  expect(validateNamedJsonSchema(schema, new TextEncoder().encode(JSON.stringify(rows)))).toEqual(rows);
});

test('weather refuses a missing or wrong-scope native context before the first file read', async () => {
  const f = fixture(), other = new Scope('foreign-weather');
  try {
    expect(() => WorldAssembly.admit({ stages: [row, row] }, f.ports)).toThrow('Repeated world assembly owner');
    const missing = { ...f.ports }; delete missing.weatherContext;
    await expect(WorldAssembly.admit({ stages: [row] }, missing).next(row.id)).rejects.toThrow('original construction context');
    Object.assign(f.ctx, { scope: other });
    await expect(WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id)).rejects.toThrow('original construction context');
    expect(f.trace).toEqual([]);
  } finally { f.scope.dispose(); other.dispose(); }
});

test('the held page read rejects replaced original product and world owners before publication', async () => {
  for (const changed of ['product', 'runtime', 'world', 'sky', 'context']) {
    const f = fixture();
    try {
      const stage = WorldAssembly.admit({ stages: [row] }, f.ports), work = stage.next(row.id);
      expect(f.trace).toEqual(['read weather']);
      if (changed === 'product') Object.assign(f.ctx, { product: { ...f.product } });
      else if (changed === 'runtime') Object.assign(f.ctx.game, { runtime: { ...f.runtime } });
      else if (changed === 'world') Object.assign(f.runtime, { world: { ...f.world } });
      else if (changed === 'sky') Object.assign(f.world, { sky: {} });
      else Object.assign(f.ports, { weatherContext: { ...f.ctx } });
      f.settle({ page: policy }); await expect(work).rejects.toThrow('owners changed');
      expect(() => entryOwner(f.scope, 'world-weather', row.id)).toThrow('Missing live entry owner');
    } finally { f.scope.dispose(); }
  }
});

test('ancestor retirement during the held weather read publishes no owner or progress', async () => {
  const parent = new Scope('weather-parent'), f = fixture(parent);
  const work = WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
  parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
  try {
    expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
    f.settle({ page: policy }); await expect(work).rejects.toThrow('owner left'); expect(f.trace).toEqual(['read weather']);
  } finally { for (const step of retirement) void step; parent.dispose(); }
});

test('weather reads exactly page after Dressing and refuses a missing clock before any extra progress or encounter', async () => {
  const f = fixture(), stages = [{ kind: 'group', id: 'dressing', label: 'Dressing', part: 'dressing' }, row,
    { kind: 'group', id: 'titan', label: 'Titan', part: 'titan' }];
  try {
    const assembly = WorldAssembly.admit({ stages }, f.ports);
    await assembly.next('dressing'); const work = assembly.next(row.id); f.settle({ page: policy, ignored: 'the original page wrapper is not strict' });
    await expect(work).rejects.toThrow('original clocked sky');
    expect(f.trace).toEqual(['Dressing', 'read weather']);
    expect(() => entryOwner(f.scope, 'world-weather', row.id)).toThrow('Missing live entry owner');
    expect(() => entryOwner(f.scope, 'object', 'titan')).toThrow('Missing live entry owner');
  } finally { f.scope.dispose(); }
});

test('the typed loan lends the original weather rig and retires without disposing borrowed services', () => {
  const construction = new Scope('weather-construction'), entered = construction.child('weather-entered'), setMode = vi.fn((): void => { /* Borrowers never call this service. */ });
  const rig = legacyDouble<ForestWeatherRig>({ group: new Group(), setMode });
  try {
    publishEntryOwner(construction, 'world-weather', row.id, rig); lendEntryOwner(entered, construction, 'world-weather', row.id);
    expect(entryOwner(entered, 'world-weather', row.id)).toBe(rig);
    entered.dispose(); expect(entryOwner(construction, 'world-weather', row.id)).toBe(rig); expect(setMode).not.toHaveBeenCalled();
    const next = construction.child('weather-reentered'); lendEntryOwner(next, construction, 'world-weather', row.id);
    expect(entryOwner(next, 'world-weather', row.id)).toBe(rig); construction.dispose();
    expect(() => entryOwner(next, 'world-weather', row.id)).toThrow('ended'); expect(setMode).not.toHaveBeenCalled();
  } finally { construction.dispose(); }
});

function clockedFixture(hold?: 'sky' | 'program', parent?: Scope, nativeOwner?: Scope) {
  const scope = parent?.child('clocked-weather') ?? new Scope('clocked-weather'), trace: string[] = [], registrations: string[] = [], exposed = new Map<string, unknown>();
  const schema = { keyColor: 'colour', keyIntensity: 'number', shadeTint: 'colour', rimColor: 'colour', hemiSky: 'colour', hemiGround: 'colour',
    hemiIntensity: 'number', envIntensity: 'number', fogColor: 'colour', fogSunColor: 'colour', fogDist: 'number', fogHeightDensity: 'number',
    cloudSun: 'colour', cloudLight: 'colour', planetLight: 'colour', planetOpacity: 'number', disc: 'number', moon: 'number', saturation: 'number' };
  const initial = Object.fromEntries(Object.entries(schema).map(([name, kind]) => [name, kind === 'colour' ? [1, 1, 1] : 1]));
  const shape = new BufferGeometry(), skyFile = { shapes: { dome: shape.toJSON() }, sky: { schema, day: { fog: [1, 1, 1], shade: [1, 1, 1], rim: [1, 1, 1], sunI: 1 }, initial } };
  const clock = { units: 'hour', start: 12, sun: { maxElevation: 60, azimuthOffset: 0 }, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 10 }],
    pauseOnPin: true, fixed: { midday: 12, golden: 17, sunset: 18, night: 22 }, presets: { dawn: 6, noon: 12, dusk: 18, night: 22 } };
  const skyRows = { file: 'weather/sky.json', clock, dome: { shape: 'dome', look: 'weather.dome', order: -100 }, flash: 1,
    lanes: { key: 'key', sample: 'sample', dome: 'dome', weather: 'weather', tint: 'tint' }, tint: [],
    from: { fog: 'fog', shade: 'shade', rim: 'rim', light: 'sunI' }, moon: { disc: [1, 1, 1], gain: 1, scale: 1, halo: 1, haloOpacity: 1 } };
  const program = { states: ['clear'], next: { clear: 'clear' }, length: { clear: [1, 1] }, soak: 1, dry: 1, salt: 1,
    initial: { overcast: 0, rain: 0, wet: 0, wind: 0, fog: 0 }, modes: { live: 'none' }, values: [], outputs: { overcast: 0, rain: 0, wet: 0, wind: 0, fog: 0 },
    page: { id: 'weather.clock', after: [], before: [], tick: 'weather.clock' } };
  const channels = parseClientChannels(['key', 'sample', 'dome', 'weather', 'tint'].map(group => {
    const dag = new ClientChannels(`weather.${group}`); dag.output('value', dag.constant(1));
    return Object.assign(dag.build(), { numeric: { group, outputs: [{ property: 'value', target: 'look', path: ['keyIntensity'] }] } });
  }));
  const source = emptyShardfile({ slug: 'clocked-weather', name: 'Weather', author: 'Fixture', revision: 1, seed: 1 }); source.clientChannels = channels;
  const rows = { ...policy, sky: skyRows }, values = new Map<string, unknown>([[row.file, { page: rows }], [skyRows.file, skyFile], [policy.files.program, program]]);
  let release: () => void = () => { throw new Error('No held weather file'); };
  let reached: () => void = () => { throw new Error('No held read notification'); };
  const reading = new Promise<void>(resolve => { reached = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; }), heldFile = hold === 'sky' ? skyRows.file : hold === 'program' ? policy.files.program : null;
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([...values.keys()].map(file => [file, { hash: file, url: file }])), read: async url => {
      trace.push(`read ${url}`); if (url === heldFile) { reached(); await gate; }
      return new TextEncoder().encode(JSON.stringify(values.get(url)));
    } });
  const scene = new Scene(), material = new MeshBasicMaterial(), disc = new Mesh(shape, material);
  const sky = legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['sky']>({ sunDisc: disc });
  const game = legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['game']>({ scene, levelScope: nativeOwner ?? scope });
  const world = legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>>({ game, sky,
    chunk: legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['chunk']>({
      grade: legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['chunk']['grade']>({ brightness: 1 }) }) });
  const runtime = legacyDouble<NonNullable<ShardContext['game']['runtime']>>({ world });
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime }),
    app: legacyDouble<ShardContext['app']>({ params: new URLSearchParams() }),
    system: spec => { registrations.push(spec.id); }, debug: legacyDouble<ShardContext['debug']>({ expose: (id, value) => { exposed.set(id, value); } }) });
  lendLooks(scope, { materials: new Map([['weather.dome', material]]), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => material });
  const ports: WorldAssemblyPorts = { scope, weatherContext: ctx, scenes: legacyDouble<SceneHandles>({ group: () => new Group() }),
    context: legacyDouble<ModelContext>({ sky }), registry: null, slice: label => { trace.push(label); return Promise.resolve(); } };
  return { scope, ctx, runtime, world, scene, trace, registrations, exposed, ports, release, reading, close(): void { scope.dispose(); shape.dispose(); material.dispose(); } };
}

test('real clocked weather installs between Dressing and Titan with one original rig, clock and typed loan', async () => {
  const f = clockedFixture();
  try {
    const assembly = WorldAssembly.admit({ stages: [{ kind: 'group', id: 'dressing', label: 'Dressing', part: 'dressing' }, row,
      { kind: 'group', id: 'titan', label: 'Titan', part: 'titan' }] }, f.ports);
    await assembly.next('dressing'); await assembly.next(row.id); await assembly.next('titan');
    const rig = entryOwner(f.scope, 'world-weather', row.id), entered = f.scope.child('weather-entry');
    expect(rig.sky?.clock).toBeInstanceOf(DayCycle); expect(rig.weather).toBeInstanceOf(WeatherContinuation);
    expect(rig.sky?.clock.phase).toBe(0.5); expect(f.exposed.get(policy.debug)).toMatchObject({ clock: rig.sky?.clock, weather: rig.weather, group: rig.group });
    expect(f.registrations).toEqual(['weather.clock', policy.system.id]);
    expect(f.trace).toEqual(['Dressing', `read ${row.file}`, 'read weather/sky.json', `read ${policy.files.program}`, 'Titan']);
    WorldAssembly.lend({ stages: [row] }, f.scope, entered); expect(entryOwner(entered, 'world-weather', row.id)).toBe(rig);
    entered.dispose(); expect(entryOwner(f.scope, 'world-weather', row.id)).toBe(rig);
  } finally { f.close(); }
});

test('real inner sky and program reads fence ancestor retirement before late geometry or registration', async () => {
  for (const held of ['sky', 'program'] as const) {
    const parent = new Scope('clocked-parent'), f = clockedFixture(held, parent);
    const work = WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
    await f.reading;
    parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
    const children = f.scene.children.length;
    try {
      f.release(); await expect(work).rejects.toThrow('owner left or changed');
      expect(f.registrations).toEqual([]); expect(f.exposed.size).toBe(0); expect(f.scene.children).toHaveLength(children);
      expect(() => entryOwner(f.scope, 'world-weather', row.id)).toThrow('ended');
    } finally { for (const step of retirement) void step; parent.dispose(); f.close(); }
  }
});

test('replacing the concrete native owner during an inner read registers nothing on the new owner', async () => {
  for (const held of ['sky', 'program'] as const) {
    const f = clockedFixture(held), { runtime, world } = f;
    const work = WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
    await f.reading;
    const children = f.scene.children.length;
    try {
      runtime.world = { ...world }; f.release();
      await expect(work).rejects.toThrow('owner left or changed');
      expect(f.registrations).toEqual([]); expect(f.exposed.size).toBe(0); expect(f.scene.children).toHaveLength(children);
      expect(() => entryOwner(f.scope, 'world-weather', row.id)).toThrow('Missing live entry owner');
    } finally { runtime.world = world; f.close(); }
  }
});

test('an independently retired native level owner refuses late weather while the context scope stays live', async () => {
  for (const held of ['sky', 'program'] as const) for (const state of ['disposing', 'disposed']) {
    const native = new Scope('native-weather'), f = clockedFixture(held, undefined, native);
    const work = WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
    await f.reading;
    native.onDispose(() => undefined); const retirement = native.disposeSteps(); retirement.next();
    if (state === 'disposed') for (const step of retirement) void step;
    const children = f.scene.children.length;
    try {
      expect(f.scope.disposed || f.scope.disposing).toBe(false);
      f.release(); await expect(work).rejects.toThrow('owner left or changed');
      expect(f.registrations).toEqual([]); expect(f.exposed.size).toBe(0); expect(f.scene.children).toHaveLength(children);
      expect(() => entryOwner(f.scope, 'world-weather', row.id)).toThrow('Missing live entry owner');
    } finally { for (const step of retirement) void step; native.dispose(); f.close(); }
  }
});


test('native weather uses the same admitted handler without a scene intake or additional slice', async () => {
  const f = clockedFixture();
  try {
    f.trace.push('Dressing');
    await installAssemblyWeather({ scope: f.scope, weatherContext: f.ctx, context: { sky: f.world.sky } }, row);
    const rig = entryOwner(f.scope, 'world-weather', row.id);
    f.trace.push('Titan');
    expect(rig.sky?.clock).toBeInstanceOf(DayCycle);
    expect(rig.weather).toBeInstanceOf(WeatherContinuation);
    expect(f.exposed.get(policy.debug)).toMatchObject({ clock: rig.sky?.clock, weather: rig.weather, group: rig.group });
    expect(f.registrations).toEqual(['weather.clock', policy.system.id]);
    expect(f.trace).toEqual(['Dressing', `read ${row.file}`, 'read weather/sky.json', `read ${policy.files.program}`, 'Titan']);
  } finally { f.close(); }
});

test('native weather keeps real inner read retirement fences with only its actual weather ports', async () => {
  for (const held of ['sky', 'program'] as const) {
    const native = new Scope('native direct weather'), f = clockedFixture(held, undefined, native);
    const work = installAssemblyWeather({ scope: f.scope, weatherContext: f.ctx, context: { sky: f.world.sky } }, row);
    await f.reading;
    native.onDispose(() => undefined); const retirement = native.disposeSteps(); retirement.next();
    const children = f.scene.children.length;
    try {
      f.release(); await expect(work).rejects.toThrow('owner left or changed');
      expect(f.registrations).toEqual([]); expect(f.exposed.size).toBe(0); expect(f.scene.children).toHaveLength(children);
      expect(() => entryOwner(f.scope, 'world-weather', row.id)).toThrow('Missing live entry owner');
    } finally { for (const step of retirement) void step; native.dispose(); f.close(); }
  }
});


test('native checkpoint construction keeps the real weather at its original boundary without scenes or GPU release', async () => {
  const f = clockedFixture(), position = new Vector3();
  Object.assign(f.world.game, { renderer: legacyDouble<typeof f.world.game.renderer>({}), registrationScope: f.scope, tier: 'phone' });
  Object.assign(f.world, { registry: new WorldRegistry(), physics: legacyDouble<typeof f.world.physics>({}), player: legacyDouble<typeof f.world.player>({ position }) });
  Object.assign(f.runtime, { viewer: () => position });
  const rows = { construction: { seed: 1, progress: { kind: 'checkpoints', total: 7, finish: 'World services', budgetMs: 0 },
    groups: [{ name: 'weather', object: row.id }], checkpoints: [{ stage: row.id, at: 'after', actions: [{ kind: 'progress', done: 5, label: 'Dressing' }, { kind: 'slice' }] }] }, stages: [row] };
  try {
    const groups = await WorldAssembly.construct(rows, { runtime: f.runtime, native: f.ctx, product: f.ctx.product, scope: f.scope, baked: new Map(),
      progress: { set: (done, total, label) => { f.trace.push(`${String(done)}/${String(total)} ${String(label)}`); }, detail: () => undefined } });
    const rig = entryOwner(f.scope, 'world-weather', row.id);
    expect(groups).toEqual({ weather: rig.group }); expect(groups['weather']).toBe(rig.group);
    expect(entryOwner(f.scope, 'object', row.id)).toBe(rig.group);
    expect(f.trace).toEqual([`read ${row.file}`, 'read weather/sky.json', `read ${policy.files.program}`, '5/7 Dressing']);
    expect(f.registrations).toEqual(['weather.clock', policy.system.id]);
  } finally { f.close(); }
});

test('native construction refuses missing contexts, bad group suffixes and accessor rows before any read', async () => {
  const f = clockedFixture(), position = new Vector3();
  Object.assign(f.world, { registry: new WorldRegistry(), physics: legacyDouble<typeof f.world.physics>({}), player: legacyDouble<typeof f.world.player>({ position }) });
  Object.assign(f.runtime, { viewer: () => position });
  const rows = { construction: { seed: 1, progress: { kind: 'checkpoints', total: 7, finish: 'World services', budgetMs: 0 },
    checkpoints: [], groups: [{ name: 'weather', object: 'missing' }] }, stages: [row] };
  const ports = { runtime: f.runtime, native: f.ctx, product: f.ctx.product, scope: f.scope, baked: new Map() };
  let getters = 0;
  try {
    await expect(WorldAssembly.construct(rows, { runtime: f.runtime, product: f.ctx.product, scope: f.scope, baked: new Map() })).rejects.toThrow('original native context');
    await expect(WorldAssembly.construct(rows, ports)).rejects.toThrow('declared object loans');
    await expect(WorldAssembly.construct({ get stages() { getters++; return [row]; } }, ports)).rejects.toThrow('plain JSON');
    expect(getters).toBe(0); expect(f.trace).toEqual([]); expect(f.registrations).toEqual([]);
  } finally { f.close(); }
});
