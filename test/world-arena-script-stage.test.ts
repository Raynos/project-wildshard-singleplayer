// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BufferGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { app } from '../src/engine/app/runtime';
import type { ModelContext } from '../src/engine/models/model';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import type { ForestWeatherRig } from '../src/game/weather/forest';
import type { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { ArenaScriptEncounter, readArenaScriptData } from '../src/game/boss/arenaScript';
import { installWeatherReactions, nativeWeatherBundle } from '../src/game/weather/reactions';
import { installWeatherContinuation } from '../src/game/weather/continuation';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import { publishEntryOwner, entryOwner } from '../src/game/shardfile/entryOwners';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import { ArenaScriptFightFileSchema, ArenaScriptGeometrySchema } from '../src/format/arenaScriptRows';
import { emptyShardfile } from '../src/sdk/author';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { legacyDouble } from './fake/FakeGame';
import { fakeWorld } from './fake/world';
import { overrideTerrain } from './fake/terrain';
import { mockCanvas, geometrySum } from './fake/weaponParity';
import titan from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with { type: 'json' };
import geometry from '../src/shards/nalati-grasslands/data/stormTitanGeometry.generated.json' with { type: 'json' };
import arenaFire from '../src/shards/nalati-grasslands/data/arenaFire.json' with { type: 'json' };
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import weatherRows from '../src/shards/nalati-grasslands/data/weather.json' with { type: 'json' };
import weatherProgram from '../src/shards/nalati-grasslands/behaviour/weather.generated.json' with { type: 'json' };

const row = { kind: 'arena-script', id: 'meadow.titan', files: { fight: 'combat/titan-fight.json', geometry: 'combat/titan-geometry.json' },
  weather: 'meadow.weather', anchor: 'meadow.cairn' };
const fight = { arenaScript: titan.TITAN_HOST, arenaFire, programs };
const fightSchema = namedJsonSchema(ArenaScriptFightFileSchema), geometrySchema = namedJsonSchema(ArenaScriptGeometrySchema);

function fixture(options: { held?: 'fight' | 'geometry'; parent?: Scope; native?: Scope; missing?: 'weather' | 'point'; point?: Vector3 | null } = {}) {
  mockCanvas();
  const scope = options.parent?.child('world-arena') ?? new Scope('world-arena'), f = fakeWorld(), trace: string[] = [], events = new Events();
  const game = Object.assign(f.game.asGame(), { app, levelScope: options.native ?? scope });
  const world = legacyDouble<ShardWorld>({ game, sky: f.sky, player: f.player }), runtime = legacyDouble<ShardRuntime>({ world });
  const bundle = nativeWeatherBundle({ weather: weatherRows, reactions: weatherProgram }, []);
  const storm = installWeatherReactions(installWeatherContinuation({ seed: 19 }, bundle.weather, { phase: 0 }, undefined), { ...bundle.reactions, points: [] }, { scope });
  const rig: ForestWeatherRig = { weather: storm.weather, storm, sky: null, fx: null, group: new Group(), setMode: (mode, at) => { storm.weather.setMode(mode, at); } };
  const point = options.point === undefined ? new Vector3(11, 7, 19) : options.point;
  if (options.missing !== 'weather') publishEntryOwner(scope, 'world-weather', row.weather, rig);
  if (options.missing !== 'point') publishEntryOwner(scope, 'world-point', row.anchor, point);
  const materials = new Map(['nalati-titan-cloud', 'nalati-titan-flame', 'nalati-titan-smoke'].map(id => [id, new MeshBasicMaterial()]));
  // These are the same concrete looks the original native constructor borrows.
  lend(scope, materials);
  let release: () => void = () => { throw new Error('Missing arena read resolver'); }, reached: () => void = () => { throw new Error('Missing arena read notification'); };
  const gate = new Promise<void>(resolve => { release = resolve; }), reading = new Promise<void>(resolve => { reached = resolve; });
  const source = emptyShardfile({ slug: 'arena-fixture', name: 'Arena', author: 'Fixture', revision: 1, seed: 19 });
  const held = options.held === undefined ? null : row.files[options.held];
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([[row.files.fight, { hash: row.files.fight, url: row.files.fight, jsonSchema: fightSchema }],
      [row.files.geometry, { hash: row.files.geometry, url: row.files.geometry, jsonSchema: geometrySchema }]]),
    read: async hash => {
      trace.push(`read ${hash}`); if (hash === held) { reached(); await gate; }
      return new TextEncoder().encode(JSON.stringify(hash === row.files.fight ? fight : geometry));
    } });
  const answer: ShardContext['answer'] = (name, fn, opts): void => { trace.push(`answer ${name}`); events.answer(name, fn, scope, opts); };
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime }), answer });
  const ports: WorldAssemblyPorts = { scope, weatherContext: ctx, context: legacyDouble<ModelContext>({ sky: f.sky }), registry: null,
    scenes: legacyDouble<SceneHandles>({ group: () => new Group() }), slice: label => { trace.push(label); return Promise.resolve(); } };
  return { scope, ctx, game, world, runtime, product, rig, point, ports, trace, events, release, reading,
    close(): void { scope.dispose(); for (const material of materials.values()) material.dispose(); } };
}

function lend(scope: Scope, materials: ReadonlyMap<string, MeshBasicMaterial>): void {
  lendLooks(scope, { materials, setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => { throw new Error('No mapped materials in arena construction'); } });
}
function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }
function shapes(root: Object3D): unknown[] {
  const result: unknown[] = [];
  root.traverse(object => {
    const shape: unknown = object instanceof Mesh ? object.geometry : null;
    result.push([object.type, object.name, object.visible, object.position.toArray(), object.rotation.toArray(), object.scale.toArray(),
      isGeometry(shape) ? [shape.getAttribute('position').count, geometrySum(shape)] : null]);
  });
  return result;
}

test('the arena stage admits finite ids and files without a callback, phase or extra slice', () => {
  const input = { stages: [row] };
  expect(v.parse(WorldAssemblySchema, input)).toEqual(input);
  for (const extra of [{ label: 'extra' }, { run: 'call' }, { phase: 'kit' }, { system: 'tick' }])
    expect(() => v.parse(WorldAssemblySchema, { stages: [{ ...row, ...extra }] })).toThrow();
  const wire = namedJsonSchema(WorldAssemblySchema);
  expect(validateNamedJsonSchema(wire, new TextEncoder().encode(JSON.stringify(input)))).toEqual(input);
});

test('missing original context, weather, point or storm refuses before either named read', async () => {
  for (const missing of ['context', 'weather', 'point', 'storm', 'sky', 'scope']) {
    const f = fixture(missing === 'weather' || missing === 'point' ? { missing } : {}), foreign = new Scope('foreign-arena');
    try {
      if (missing === 'context') { const ports = { ...f.ports }; delete ports.weatherContext; await expect(WorldAssembly.admit({ stages: [row] }, ports).next(row.id)).rejects.toThrow(); }
      else {
        if (missing === 'storm') f.rig.storm = null;
        if (missing === 'sky') Object.assign(f.ports, { context: legacyDouble<ModelContext>({ sky: legacyDouble<ModelContext['sky']>({}) }) });
        if (missing === 'scope') Object.assign(f.ctx, { scope: foreign });
        await expect(WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id)).rejects.toThrow();
      }
      expect(f.trace).toEqual([]); expect(f.events.census().answerers).toBe(0);
      expect(() => entryOwner(f.scope, 'arena-script', row.id)).toThrow('Missing live entry owner');
    } finally { f.close(); foreign.dispose(); }
  }
});

test('the real original constructor, storm, air, point, AS state and random continuation stay exact', async () => {
  const restore = overrideTerrain({ heightAt: () => 0 }), random = app.rng.stream('ai'), before = random.snapshot(), baseline = fixture();
  try {
    const data = await readArenaScriptData(baseline.product, row.files), storm = baseline.rig.storm;
    if (storm === null) throw new Error('Missing actual weather reactions');
    const original = new ArenaScriptEncounter({ game: baseline.game, player: baseline.world.player, weather: storm, air: baseline.rig.weather, tieSpot: baseline.point }, data);
    const originalShapes = shapes(baseline.game.scene), after = random.snapshot(); random.restore(before);
    const f = fixture();
    try {
      const assembly = WorldAssembly.admit({ stages: [{ kind: 'group', id: 'weather-complete', label: 'Weather complete', part: 'weather' }, row,
        { kind: 'group', id: 'look', label: 'Look', part: 'look' }] }, f.ports);
      await assembly.next('weather-complete'); await assembly.next(row.id); await assembly.next('look');
      const owner = entryOwner(f.scope, 'arena-script', row.id);
      expect(owner).toBeInstanceOf(ArenaScriptEncounter); expect(owner.world.game).toBe(f.game); expect(owner.world.player).toBe(f.world.player);
      expect(owner.world.weather).toBe(f.rig.storm); expect(owner.world.air).toBe(f.rig.weather); expect(owner.world.tieSpot).toBe(f.point);
      expect(owner.fight.cairnSpot()).toBe(f.point); expect(owner.data).toEqual(original.data);
      expect(owner.fight.life.state).toEqual(original.fight.life.state); expect(owner.fight.pose).toEqual(original.fight.pose);
      expect(shapes(f.game.scene)).toEqual(originalShapes); expect(random.snapshot()).toEqual(after);
      expect(f.trace).toEqual(['Weather complete', `read ${row.files.fight}`, `read ${row.files.geometry}`, 'answer weather.storm-hold', 'Look']);
      expect(owner.boss).toBeNull(); expect(owner.riders).toBeNull(); expect(owner.power).toBeNull();
      expect(f.events.ask('weather.storm-hold', 0.4)).toBe(0.4);
      owner.boss = legacyDouble<NonNullable<ArenaScriptEncounter['boss']>>({ engaged: true });
      expect(f.events.ask('weather.storm-hold', 0.4)).toBe(1);
      const entered = f.scope.child('arena-entered'); WorldAssembly.lend({ stages: [row] }, f.scope, entered);
      expect(entryOwner(entered, 'arena-script', row.id)).toBe(owner); entered.dispose(); expect(entryOwner(f.scope, 'arena-script', row.id)).toBe(owner);
      f.scope.dispose(); expect(f.events.census().answerers).toBe(0);
    } finally { f.close(); }
  } finally { baseline.close(); random.restore(before); restore(); }
});

test('a null original anchor retains the existing arena anchor fallback', async () => {
  const restore = overrideTerrain({ heightAt: () => 0 }), f = fixture({ point: null });
  try {
    await WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
    const owner = entryOwner(f.scope, 'arena-script', row.id), anchor = owner.data.arena.anchor;
    expect(owner.world.tieSpot).toBeNull(); expect(owner.fight.cairnSpot()).toEqual(new Vector3(anchor.x, 0, anchor.z));
  } finally { f.close(); restore(); }
});

test('either held named read fences ancestor and independently retired native owners before the original constructor', async () => {
  for (const held of ['fight', 'geometry'] as const) for (const which of ['ancestor', 'native']) {
    const parent = new Scope('arena-parent'), native = new Scope('arena-native'), f = fixture({ held, parent, native });
    const random = app.rng.stream('ai'), before = random.snapshot(), work = WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
    await f.reading;
    const owner = which === 'ancestor' ? parent : native; owner.onDispose(() => undefined);
    const retirement = owner.disposeSteps(); retirement.next(); const children = f.game.scene.children.length;
    try {
      f.release(); await expect(work).rejects.toThrow('owner left');
      expect(f.game.scene.children).toHaveLength(children); expect(f.events.census().answerers).toBe(0); expect(random.snapshot()).toEqual(before);
      expect(f.trace).toEqual([`read ${row.files.fight}`, `read ${row.files.geometry}`]);
      expect(() => entryOwner(f.scope, 'arena-script', row.id)).toThrow();
    } finally { for (const step of retirement) void step; parent.dispose(); native.dispose(); f.close(); }
  }
});

test('concrete original owners and the same point coordinates are rechecked after the Promise.all', async () => {
  for (const changed of ['context', 'product', 'world', 'player', 'game', 'storm', 'air', 'point', 'answer']) {
    const f = fixture({ held: 'geometry' }), before = f.game.scene.children.length, work = WorldAssembly.admit({ stages: [row] }, f.ports).next(row.id);
    await f.reading;
    try {
      if (changed === 'context') Object.assign(f.ports, { weatherContext: { ...f.ctx } });
      else if (changed === 'product') Object.assign(f.ctx, { product: { ...f.product } });
      else if (changed === 'world') f.runtime.world = { ...f.world };
      else if (changed === 'player') Object.assign(f.world, { player: legacyDouble<ShardWorld['player']>({ position: f.world.player.position }) });
      else if (changed === 'game') Object.assign(f.world, { game: legacyDouble<ShardWorld['game']>({ scene: f.game.scene, levelScope: f.game.levelScope }) });
      else if (changed === 'storm') f.rig.storm = null;
      else if (changed === 'air') Object.assign(f.rig, { weather: legacyDouble<ForestWeatherRig['weather']>({}) });
      else if (changed === 'point') { if (f.point === null) throw new Error('Missing point'); f.point.y++; }
      else Object.assign(f.ctx, { answer: () => { throw new Error('New answer must not register'); } });
      f.release(); await expect(work).rejects.toThrow('owners changed');
      expect(f.game.scene.children).toHaveLength(before); expect(f.events.census().answerers).toBe(0);
      expect(() => entryOwner(f.scope, 'arena-script', row.id)).toThrow('Missing live entry owner');
    } finally { f.close(); }
  }
});
