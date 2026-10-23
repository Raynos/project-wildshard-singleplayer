import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Material, Mesh, Scene, Vector3, type WebGLRenderer } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import type { Physics } from '../src/engine/physics/Physics';
import type { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { sharedModelContext } from '../src/engine/models/model';
import type { OwnedGeometry } from '../src/engine/models/ownedGeometry';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { WorldAssembly, type WorldConstructionPorts } from '../src/game/shardfile/worldAssembly';
import { legacyDouble } from './fake/FakeGame';

const stages = { stages: ['orchard.sign', 'orchard.lamp'].map((id, index) => ({ kind: 'drawn-models', id,
  look: { painterly: { rim: 0.4 } }, models: [{ id: 'model', draw: `draw:${index}` }] })) };
function fixture() {
  const parent = new Scope('page'), native = parent.child('native'), scope = parent.child('construction');
  const events: string[] = [], copies: BufferGeometry[] = [];
  const sky = legacyDouble<SkyRig>({ csm: legacyDouble<SkyRig['csm']>({ lights: [] }), sunDir: new Vector3(0, 1, 0), setupMaterial: () => undefined });
  const gameSurface = { levelScope: native, scene: new Scene(), renderer: legacyDouble<WebGLRenderer>({}), tier: 'desktop' as const }, game = legacyDouble<Game>(gameSurface);
  const world = legacyDouble<ShardWorld>({ game, sky, player: legacyDouble<Player>({position: new Vector3()}),
    registry: new WorldRegistry(), physics: legacyDouble<Physics>({}) });
  const runtimeSurface = { world, viewer: () => new Vector3() }, runtime = legacyDouble<ShardRuntime>(runtimeSurface);
  const json = vi.fn(() => Promise.reject(new Error('Unexpected JSON read'))), file = vi.fn(() => Promise.reject(new Error('Unexpected file read')));
  const product = legacyDouble<ShardProduct>({json, file});
  const contextSurface = {scope, product, game: legacyDouble<ShardContext['game']>({runtime})}, ctx = legacyDouble<ShardContext>(contextSurface);
  let onCopy = (): void => undefined;
  const draws: FixedDraws = {ready: true, load: vi.fn(() => Promise.resolve()), handle: (slot: string) => {
    events.push(`handle:${slot}`);
    return legacyDouble<OwnedGeometry>({copy: () => {
      events.push(`copy:${slot}`);
      const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([Number(slot.slice(-1)), 0, 0, 1, 0, 0, 0, 1, 0]), 3)).setIndex([0, 1, 2]);
      copies.push(geometry); onCopy(); return geometry;
    }});
  }};
  const progress = {set: vi.fn(), detail: vi.fn()}, ports: WorldConstructionPorts = {native: ctx, runtime, product, scope, draws, baked: new Map(), progress};
  return {parent, native, scope, sky, game, world, runtime, runtimeSurface, gameSurface, contextSurface, product, json, file, events, copies, draws, progress, ports,
    onCopy(fn: () => void) {onCopy = fn;} };
}
function models(f: ReturnType<typeof fixture>) {
  return stages.stages.map(stage => {
    const bank = entryOwner(f.scope, 'drawn-models', stage.id), group = bank.get('model'), mesh = group?.children[0];
    if (!(mesh instanceof Mesh)) throw new Error('Missing drawn model');
    const geometry: unknown = mesh.geometry, material: unknown = mesh.material;
    if (!(geometry instanceof BufferGeometry) || !(material instanceof Material)) throw new Error('Missing concrete drawn resources');
    const position: unknown = geometry.getAttribute('position');
    if (!(position instanceof BufferAttribute)) throw new Error('Missing concrete position buffer');
    return { names: [...bank.keys()], parent: group?.parent, position: Array.from(position.array), index: Array.from(geometry.getIndex()?.array ?? []),
      castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, visible: mesh.visible, materialType: material.type };
  });
}

test('stage-only native construction matches the original ordered stage walk without reads, loads, progress or timers', async () => {
  const original = fixture(), current = fixture();
  try {
    const sliced = vi.fn(() => Promise.resolve());
    const old = WorldAssembly.admit(stages, {scope: original.scope, context: sharedModelContext(original.sky, original.game), registry: null, draws: original.draws, slice: sliced});
    for (const stage of stages.stages) await old.next(stage.id);
    expect(await WorldAssembly.construct(stages, current.ports)).toEqual({});
    expect(current.events).toEqual(original.events);
    expect(current.events).toEqual(['handle:draw:0', 'copy:draw:0', 'handle:draw:1', 'copy:draw:1']);
    expect(models(current)).toEqual(models(original));
    expect(current.json).not.toHaveBeenCalled(); expect(current.file).not.toHaveBeenCalled(); expect(current.draws.load).not.toHaveBeenCalled();
    expect(current.progress.set).not.toHaveBeenCalled(); expect(sliced).not.toHaveBeenCalled();
    const dispose = current.copies.map(geometry => vi.spyOn(geometry, 'dispose'));
    current.scope.dispose(); for (const spy of dispose) expect(spy).toHaveBeenCalledOnce();
  } finally { original.parent.dispose(); current.parent.dispose(); }
});

test.each(['construction', 'native'] as const)('a retired %s owner refuses before looking up any draw', async owner => {
  const f = fixture();
  try {
    f[owner === 'native' ? 'native' : 'scope'].dispose();
    await expect(WorldAssembly.construct(stages, f.ports)).rejects.toThrow('owner left or changed');
    expect(f.events).toEqual([]);
    expect(() => entryOwner(f.scope, 'drawn-models', stages.stages[0]?.id ?? '')).toThrow();
  } finally { f.parent.dispose(); }
});

test.each(['world', 'product', 'native-scope'] as const)('a replaced %s refuses before the next declared stage', async changed => {
  const f = fixture();
  try {
    f.onCopy(() => {
      if (changed === 'world') f.runtimeSurface.world = legacyDouble<ShardWorld>({});
      else if (changed === 'product') f.contextSurface.product = legacyDouble<ShardProduct>({});
      else f.gameSurface.levelScope = f.parent.child('foreign');
    });
    await expect(WorldAssembly.construct(stages, f.ports)).rejects.toThrow(/owners changed|owner left or changed/u);
    expect(f.events).toEqual(['handle:draw:0', 'copy:draw:0']);
    expect(() => entryOwner(f.scope, 'drawn-models', 'orchard.lamp')).toThrow();
  } finally { f.parent.dispose(); }
});

test('stage-only data admission refuses the whole malformed suffix before native allocation', async () => {
  const f = fixture();
  try {
    await expect(WorldAssembly.construct({stages: [...stages.stages, stages.stages[0]]}, f.ports)).rejects.toThrow();
    expect(f.events).toEqual([]); expect(f.progress.set).not.toHaveBeenCalled();
    const getter = vi.fn(() => stages.stages);
    await expect(WorldAssembly.construct({get stages() {return getter();}}, f.ports)).rejects.toThrow('plain JSON');
    expect(getter).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});

test('ancestor sliced retirement refuses while the construction child itself is still open', async () => {
  const f = fixture();
  f.parent.onDispose(() => undefined);
  const retirement = f.parent.disposeSteps();
  try {
    expect(retirement.next().done).toBe(false);
    expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
    await expect(WorldAssembly.construct(stages, f.ports)).rejects.toThrow('owner left or changed');
    expect(f.events).toEqual([]);
  } finally { for (const step of retirement) void step; }
});
