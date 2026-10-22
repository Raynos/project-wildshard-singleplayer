import { expect, test, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { zlibSync } from 'fflate';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import type { Physics } from '../src/engine/physics/Physics';
import type { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import * as model from '../src/engine/models/model';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { WorldAssembly } from '../src/game/shardfile/worldAssembly';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { productFixedDraws } from '../src/game/models/fixedDraws';
import { legacyDouble } from './fake/FakeGame';

const rows = { construction: { prelude: { draws: 'models/ornaments.json' }, seed: 0,
  progress: { kind: 'checkpoints', total: 1, finish: 'Ready', budgetMs: 0 }, checkpoints: [] },
  stages: [{ kind: 'fixed-draws', id: 'ornaments' }] };
const data = new Uint8Array(48);
new Float32Array(data.buffer, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
new Int32Array(data.buffer, 36, 3).set([0, 1, 1]);
const drawRows = [{ slot: 'triangle', channels: [], inline: btoa(String.fromCodePoint(...zlibSync(data))),
  baked: { attrs: [['position', 'f32', 3, false]], count: 3, index: 'u16', indexCount: 3, box: true, expand: false } }];
function fixture() {
  const parent = new Scope('native-page'), scope = parent.child('world'), events: string[] = [];
  const nativeSurface = { levelScope: parent, scene: new Scene(), tier: 'desktop' as const }, game = legacyDouble<Game>(nativeSurface);
  const world = legacyDouble<ShardWorld>({ game, sky: legacyDouble<SkyRig>({}), player: legacyDouble<Player>({position:new Vector3()}),
    physics: legacyDouble<Physics>({}), registry: new WorldRegistry() });
  const runtime = legacyDouble<ShardRuntime>({ world, viewer: () => new Vector3() });
  let afterRead = (): void => undefined;
  function read<T>(name: string): Promise<T>;
  function read(name: string): Promise<unknown> { events.push(`read:${name}`); afterRead(); return Promise.resolve(drawRows); }
  const productSurface = { json: read, file: () => Promise.reject(new Error('Unexpected bytes read')) };
  const product = legacyDouble<ShardProduct>(productSurface);
  const surface = { scope, product, game: legacyDouble<ShardContext['game']>({runtime}) }, ctx = legacyDouble<ShardContext>(surface);
  return { parent, scope, ctx, surface, nativeSurface, productSurface, product, runtime, events,
    afterRead(fn: () => void) { afterRead = fn; } };
}

test('metadata precedes native program/progress while loading and publication stay at the fixed-draw stage', async () => {
  const f = fixture(), context = vi.spyOn(model, 'sharedModelContext').mockReturnValue(legacyDouble<model.ModelContext>({}));
  try {
    const draws = await WorldAssembly.prepareNative(rows, f.ctx);
    expect(draws.ready).toBe(false); expect(() => entryOwner(f.scope, 'fixed-draws', 'ornaments')).toThrow();
    f.events.push('program', 'progress:0');
    expect(await WorldAssembly.prepareNative(rows, f.ctx)).toBe(draws);
    const load = vi.spyOn(draws, 'load');
    await WorldAssembly.construct(rows, { native: f.ctx, runtime: f.runtime, product: f.product, scope: f.scope, draws, baked: new Map() });
    expect(f.events).toEqual(['read:models/ornaments.json', 'program', 'progress:0']);
    expect(load).toHaveBeenCalledTimes(1); expect(entryOwner(f.scope, 'fixed-draws', 'ornaments')).toBe(draws);
    const copy = draws.handle('triangle').copy();
    expect(copy.getIndex()?.count).toBe(3); copy.dispose();
    draws.handle('triangle').take().dispose();
  } finally { context.mockRestore(); f.parent.dispose(); }
});

test.each(['scope', 'product', 'reader', 'native-scope'] as const)('prelude refuses %s replacement across its read', async mode => {
  const f = fixture();
  f.afterRead(() => {
    if (mode === 'scope') f.parent.dispose();
    else if (mode === 'product') f.surface.product = legacyDouble<ShardProduct>({});
    else if (mode === 'reader') f.productSurface.json = legacyDouble<ShardProduct>( { json: () => Promise.reject(new Error('replacement')) }).json;
    else f.nativeSurface.levelScope = new Scope('replacement');
  });
  try { await expect(WorldAssembly.prepareNative(rows, f.ctx)).rejects.toThrow(/left|changed/); expect(f.events).toHaveLength(1); }
  finally { f.nativeSurface.levelScope.dispose(); f.parent.dispose(); }
});

test('retiring ancestors and malformed rows refuse before metadata reads or publication', async () => {
  const f = fixture(); let getters = 0;
  const accessor = { get construction() { getters++; return rows.construction; }, stages: rows.stages };
  try {
    for (const bad of [accessor, { ...rows, construction: { ...rows.construction, prelude: { draws: 'x.json', run: () => undefined } } }])
      await expect(WorldAssembly.prepareNative(bad, f.ctx)).rejects.toThrow();
    expect(getters).toBe(0); expect(f.events).toEqual([]);
    f.parent.onDispose(() => undefined); const steps = f.parent.disposeSteps(); steps.next();
    await expect(WorldAssembly.prepareNative(rows, f.ctx)).rejects.toThrow('left'); expect(f.events).toEqual([]);
    while (steps.next().done !== true) { /* drain the actual sliced retirement */ }
  } finally { f.parent.dispose(); }
});

test('construction refuses a different prepared library before stage allocation', async () => {
  const f = fixture();
  try {
    await WorldAssembly.prepareNative(rows, f.ctx);
    const foreign = await productFixedDraws({json: () => Promise.resolve(drawRows)}, 'models/ornaments.json');
    const admit = vi.spyOn(WorldAssembly, 'admit');
    await expect(WorldAssembly.construct(rows, { native:f.ctx, runtime:f.runtime, product:f.product, scope:f.scope, draws:foreign, baked:new Map() })).rejects.toThrow('replaced its native prelude draws');
    expect(admit).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});
