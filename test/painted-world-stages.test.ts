import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import type { ShardContext } from '../src/game/plugin/context';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { entryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { installFixedDrawsStage, installPaintedReseedStage, installPaintedWorldStage, paintedWorldUpdate, type PaintedWorldStagePorts } from '../src/game/shardfile/paintedWorldStages';
import { Group, Mesh, Object3D, Scene, WebGLRenderer } from 'three';
import { SkyRig } from '../src/engine/world/skyRig';
import { paintedWorld, PainterlyWorld, type PaintedWorldParts } from '../src/game/looks/postGraphLook';
import type { PaintedSky } from '../src/game/looks/keyedSky';
import type { ForestWeatherRig } from '../src/game/weather/forest';
import { legacyDouble } from './fake/FakeGame';
import paintedTextures from '../src/shards/nalati-grasslands/data/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../src/shards/nalati-grasslands/data/specimens.generated.json' with { type: 'json' };
import grassRows from '../src/shards/nalati-grasslands/data/grass.generated.json' with { type: 'json' };
import capture from '../src/shards/nalati-grasslands/data/staticCapture.json' with { type: 'json' };

// An orchard world (the stages' fixture level): its own fixed-draw library and a painted world borrowing the first
// level's ground and blade rows.
/** a library whose one load the stage must not repeat; `gate` holds its load open */
function library(gate: Promise<void> = Promise.resolve()): FixedDraws {
  let loaded = false;
  return { get ready() { return loaded; }, load: async () => { await gate; loaded = true; }, handle: () => { throw new Error('No slots in the orchard library'); } };
}
const unpublished = (scope: Scope, id: string): void => { expect(() => entryOwner(scope, 'fixed-draws', id)).toThrow(); };

test('a fixed-draws stage loads the world\'s one original library once a page and lends it by id', async () => {
  const draws = library(), load = vi.spyOn(draws, 'load');
  const first = new Scope('orchard'), second = new Scope('orchard-again');
  await installFixedDrawsStage({ scope: first, draws }, { id: 'orchard.shapes' });
  await installFixedDrawsStage({ scope: second, draws }, { id: 'orchard.shapes' });
  expect(load).toHaveBeenCalledOnce();
  expect(entryOwner(first, 'fixed-draws', 'orchard.shapes')).toBe(draws);
  expect(entryOwner(second, 'fixed-draws', 'orchard.shapes')).toBe(draws);
  await expect(installFixedDrawsStage({ scope: new Scope('bare') }, { id: 'orchard.shapes' })).rejects.toThrow('original fixed-draw library');
  first.dispose(); second.dispose();
});

test('a world retired at entry, or retiring through an ancestor\'s steps, loads nothing and publishes nothing', async () => {
  const retired = new Scope('retired'), draws = library(), load = vi.spyOn(draws, 'load');
  retired.dispose();
  await expect(installFixedDrawsStage({ scope: retired, draws }, { id: 'orchard.shapes' })).rejects.toThrow('live world');
  const parent = new Scope('page'), world = parent.child('orchard');
  parent.onDispose(() => undefined);
  const steps = parent.disposeSteps();
  steps.next();
  expect(world.disposing).toBe(true);
  await expect(installFixedDrawsStage({ scope: world, draws }, { id: 'orchard.shapes' })).rejects.toThrow('live world');
  expect(load).not.toHaveBeenCalled();
  while (steps.next().done !== true) { /* drain */ }
});

test('a world that leaves or swaps its library during the load publishes nothing', async () => {
  let open = (): void => undefined;
  const gate = new Promise<void>(resolve => { open = resolve; });
  const leaving = new Scope('leaving'), draws = library(gate);
  const pending = installFixedDrawsStage({ scope: leaving, draws }, { id: 'orchard.shapes' });
  leaving.dispose(); open();
  await expect(pending).rejects.toThrow('left or replaced');
  const world = new Scope('swapped'), first = library(), ports: { scope: Scope; draws: FixedDraws } = { scope: world, draws: first };
  const swapping = installFixedDrawsStage(ports, { id: 'orchard.shapes' });
  ports.draws = library();
  await expect(swapping).rejects.toThrow('left or replaced');
  unpublished(world, 'orchard.shapes');
  world.dispose();
});

/** the orchard's painted world (built once a page, as its look would) */
function orchard(): PaintedWorldParts {
  return paintedWorld('orchard-stages', { fog: { start: 40, end: 900, haze: [0.3, 0.32, 0.36], aerial: [0.002, 40, -5, 0.001], edge: [0.9, 251, 270, 15], order: 280, lut: [0.5, 0.55, 0.6] },
    air: { tile: 800, threshold: 0.6, strength: 0.4, softness: 0.1, drift: [1, 0.5] }, ground: 'ground' in paintedTextures ? paintedTextures.ground : null, tiles: specimenData.materials,
    capture, grass: { rows: grassRows, cards: { url: '/assets/orchard/cards.webp', phoneUrl: '/assets/orchard/cards.phone.webp', name: 'orchard-cards' } } });
}

test('a painted-reseed stage reseeds the named painted world\'s grass for a live world only', () => {
  const world = new Scope('orchard-reseed');
  expect(() => { installPaintedReseedStage(world, { world: 'orchard-unbuilt' }); }).toThrow('No painted world for orchard-unbuilt');
  const parts = orchard();
  const reseed = vi.spyOn(parts.grass, 'reseed');
  installPaintedReseedStage(world, { world: 'orchard-stages' });
  expect(reseed).toHaveBeenCalledOnce();
  world.dispose();
  expect(() => { installPaintedReseedStage(world, { world: 'orchard-stages' }); }).toThrow('live world');
  expect(reseed).toHaveBeenCalledOnce();
});

test('a fixed-draw callable replaced during its held load cannot publish', async () => {
  const scope = new Scope('callable-swap');
  let release = (): void => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const draws = library(gate), pending = installFixedDrawsStage({ scope, draws }, { id: 'shapes' });
  draws.load = () => Promise.resolve(); release();
  try { await expect(pending).rejects.toThrow('left or replaced'); unpublished(scope, 'shapes'); }
  finally { scope.dispose(); }
});

/** the world stage's owners, borrowed by type only: no refusal below reaches a draw */
function stagePorts(scope: Scope, nativeScope = scope): PaintedWorldStagePorts {
  const renderer: unknown = Object.create(WebGLRenderer.prototype), sky: unknown = Object.create(SkyRig.prototype);
  if (!(renderer instanceof WebGLRenderer) || !(sky instanceof SkyRig)) throw new Error('Missing stage owners');
  return { scope, nativeScope, renderer, scene: new Scene(), sky, forest: null, daySaturation: 1 };
}
const row = { id: 'orchard.painted', world: 'orchard-stages', weather: 'orchard.weather', groups: [{ name: 'trees', object: 'orchard.trees' }], casters: [], forest: false };

test('a painted-world stage refuses a leaving world or missing loans before it wires anything', async () => {
  const left = new Scope('orchard-left'); left.dispose();
  await expect(installPaintedWorldStage(stagePorts(left), row)).rejects.toThrow('live world');
  const page = new Scope('page'), world = page.child('orchard'), steps = page.disposeSteps();
  page.onDispose(() => undefined); steps.next();
  await expect(installPaintedWorldStage(stagePorts(world), row)).rejects.toThrow('live world');
  while (steps.next().done !== true) { /* drain */ }
  const live = new Scope('orchard-live');
  await expect(installPaintedWorldStage(stagePorts(live), row)).rejects.toThrow();
  expect(() => entryOwner(live, 'painted-world', 'orchard.painted')).toThrow();
  expect(() => paintedWorldUpdate(live, { world: 'orchard.painted', weather: 'orchard.weather' })).toThrow();
  live.dispose();
});

/** a construction scope holding the stage's loans (a weather rig whose painted sky can be swapped), a separate native level
 *  scope, and the painted world's wire held open until `release` */
function heldStage() {
  const scope = new Scope('orchard-construction'), nativeScope = new Scope('orchard-native'), trees = new Object3D(), dome = new Mesh();
  const sky = (): PaintedSky => legacyDouble<PaintedSky>({ dome: new Mesh() });
  const rig = legacyDouble<ForestWeatherRig>({ sky: sky() });
  publishEntryOwner(scope, 'world-weather', row.weather, rig); publishEntryOwner(scope, 'object', 'orchard.trees', trees);
  // a plain instance (a promise resolution reads `then`), carrying only the dome the stage lends
  const built: unknown = Object.assign(Object.create(PainterlyWorld.prototype), { panorama: { dome } });
  if (!(built instanceof PainterlyWorld)) throw new Error('Missing painterly world');
  let release = (): void => undefined;
  const gate = new Promise<PainterlyWorld | null>(resolve => { release = () => { resolve(built); }; });
  const wire = vi.spyOn(orchard(), 'wire').mockReturnValueOnce(gate), ports = stagePorts(scope, nativeScope);
  return { scope, nativeScope, trees, dome, rig, sky, built, release, wire, ports, end: () => { wire.mockRestore(); scope.dispose(); nativeScope.dispose(); } };
}
const unlent = (scope: Scope): void => {
  expect(() => entryOwner(scope, 'painted-world', row.id)).toThrow(); expect(() => entryOwner(scope, 'object', row.id)).toThrow();
};

test('a painted-world stage wires under the native level scope and lends the world and its dome in the construction scope', async () => {
  const f = heldStage();
  try {
    const pending = installPaintedWorldStage(f.ports, row); f.release(); await pending;
    const stars = f.rig.sky?.dome;
    expect(f.wire).toHaveBeenCalledWith(expect.objectContaining({ scope: f.nativeScope, stars, groups: { trees: f.trees }, casters: [] }));
    expect(entryOwner(f.scope, 'painted-world', row.id)).toBe(f.built);
    expect(entryOwner(f.scope, 'object', row.id)).toBe(f.dome);
  } finally { f.end(); }
});

test('an independently retired native level scope, or a swapped port or loan, publishes nothing', async () => {
  const swaps: ((f: ReturnType<typeof heldStage>) => void)[] = [
    f => { f.nativeScope.dispose(); },
    f => { Object.assign(f.ports, { nativeScope: new Scope('orchard-other-native') }); },
    f => { Object.assign(f.ports, { renderer: stagePorts(f.scope).renderer }); },
    f => { Object.assign(f.ports, { scene: new Scene() }); },
    f => { f.rig.sky = f.sky(); },
  ];
  for (const swap of swaps) {
    const f = heldStage();
    try {
      const pending = installPaintedWorldStage(f.ports, row);
      swap(f);
      f.release();
      await expect(pending).rejects.toThrow('left or replaced its owners'); unlent(f.scope);
    } finally { f.end(); }
  }
});


test('the declared assembly wires at its ordered boundary and observes native owner replacement before publication', async () => {
  for (const replaced of [false, true]) {
    const f = heldStage(), trace: string[] = [];
    type NativeWorld = NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;
    const game = legacyDouble<NativeWorld['game']>({ levelScope: f.nativeScope, renderer: f.ports.renderer, scene: f.ports.scene,
      level: legacyDouble<NativeWorld['game']['level']>({ grade: legacyDouble<NativeWorld['game']['level']['grade']>({ saturation: 1 }) }) });
    const world = legacyDouble<NativeWorld>({ game, sky: f.ports.sky, forest: legacyDouble<NativeWorld['forest']>({ group: new Group() }) });
    const runtime = legacyDouble<NonNullable<ShardContext['game']['runtime']>>({ world });
    const ctx = legacyDouble<ShardContext>({ scope: f.scope, product: legacyDouble<ShardContext['product']>({}), game: legacyDouble<ShardContext['game']>({ runtime }) });
    const ports: WorldAssemblyPorts = { scope: f.scope, weatherContext: ctx, context: legacyDouble<WorldAssemblyPorts['context']>({ sky: f.ports.sky }), registry: null, slice: label => { trace.push(label); return Promise.resolve(); } };
    const later = new Scope('replacement-native');
    try {
      const assembly = WorldAssembly.admit({ stages: [{ kind: 'painted-world', ...row }] }, ports);
      const pending = assembly.next(row.id);
      expect(f.wire).toHaveBeenCalledOnce(); expect(trace).toEqual([]);
      if (replaced) Object.assign(game, { levelScope: later });
      f.release();
      if (replaced) { await expect(pending).rejects.toThrow('replaced its owners'); unlent(f.scope); }
      else { await pending; expect(assembly.done).toBe(true); expect(entryOwner(f.scope, 'painted-world', row.id)).toBe(f.built); }
    } finally { later.dispose(); f.end(); }
  }
});
