// oxlint-disable-next-line import/no-nodejs-modules -- This lifecycle fixture uses the production native Rapier binary.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { Mesh } from 'three';
import { App } from '../src/engine/app/app';
import { withOwner } from '../src/engine/app/ownership';
import type { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { configureLevel, activeLevel } from '../src/engine/level/selection';
import type { TerrainField } from '../src/engine/level/data';
import { WorldRegistry } from '../src/engine/world/registry';
import { Terrain } from '../src/engine/world/Terrain';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { createRegionalRuntimeFactory, regionalRuntimeAccountedBytes, type RegionalRuntimeRequest } from '../src/game/grid/regionalRuntime';
import { createRegionalWorldFoundation } from '../src/game/grid/regionalWorld';
import { shardContext, type ShardContext } from '../src/game/shard/context';
import type { ShardPlayHost, ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { toLevelSpec } from '../src/game/shard/spec';
import { Progress } from '../src/game/Progress';
import { Inventory } from '../src/game/Inventory';
import { NALATI_GRASSLANDS } from '../src/shards/nalati-grasslands/manifest';
import source from '../src/shards/nalati-grasslands/shard.config';
import RuntimePlugin from '../src/shards/nalati-grasslands/runtime/index';
import { HybridRuntimeSession } from '../src/game/shardfile/hybrid';
import { installEnteredRuntimeService } from '../src/game/shard/retainedHooks';
import { bindEnteredEnvironment } from '../src/shards/nalati-grasslands/runtime/enteredEnvironment';
import { wildEnv } from '../src/shards/nalati-grasslands/creatures/env';
import { fakeWorld } from './fake/world';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const noop = (): void => undefined;
const priorGlobals = new Map(['document', 'window'].map(key => [key, Reflect.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => { for (const [key, descriptor] of priorGlobals) { if (descriptor === undefined) Reflect.deleteProperty(globalThis, key); else Reflect.defineProperty(globalThis, key, descriptor); } });
const field = (h: number): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, trails: [], cabinSites: [], pond: null });

/** Node cannot fetch the ground's image layers: the drawn ground is one real mesh; heights and colliders stay real. */
const drawnGround = (): Promise<Terrain> => { const terrain = new Terrain(); terrain.group.add(new Mesh()); return Promise.resolve(terrain); };
/** The real Game scene binding (getter + bindScene) on an instance without a WebGL context; the rest are doubles. */
function pageGame(scope: Scope, app: App): Game {
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Game prototype');
  const doubled = fakeWorld().game.asGame();
  for (const [key, value] of Object.entries({ _composer: null, app, registrationScope: scope, faultSystems: new Map(), anonymous: 0, rootScene: doubled.rootScene, camera: doubled.camera, viewmodel: doubled.viewmodel, sceneFrames: [], renderer: { extensions: { has: () => false } }, levelScope: scope, playerScope: scope })) Reflect.defineProperty(game, key, { value, writable: true });
  return game;
}

function fixture() {
  const home = { ...toLevelSpec(NALATI_GRASSLANDS), id: 'home', ground: { terrain: field(3) }, spawns: [] }; configureLevel(home);
  const app = new App(), scope = app.engineScope.child('grid.page'), homePhysics = new Physics(rapier);
  const homeRegistry = new WorldRegistry(); app.registryValue = homeRegistry; app.levelScope = scope;
  const game = pageGame(scope, app), doubles = fakeWorld();
  const player = doubles.player;
  const world = { game, player, sky: doubles.sky, forest: doubles.forest, physics: homePhysics, registry: homeRegistry, chunk: NALATI_GRASSLANDS } as ShardWorld;
  const play = withOwner(scope, () => ({ nolock: true, progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle') })) as ShardPlayHost;
  // Presentation-only canvas port; terrain, forest, creatures, physics and scopes are real.
  Reflect.set(globalThis, 'window', Object.assign(new EventTarget(), { performance }));
  Reflect.set(globalThis, 'document', Object.assign(new EventTarget(), { createElement: () => {
    let pixels: ImageData = { data: new Uint8ClampedArray(0), width: 0, height: 0, colorSpace: 'srgb' };
    return { width: 0, height: 0, getContext: () => ({
      createImageData: (width: number, height: number): ImageData => ({ data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' }),
      putImageData: (data: ImageData) => { pixels = data; }, getImageData: () => pixels,
      createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }),
      save: noop, restore: noop, translate: noop, rotate: noop, quadraticCurveTo: noop, closePath: noop, fillStyle: '', strokeStyle: '', lineWidth: 1,
      clearRect: noop, fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, stroke: noop, fill: noop,
    }) };
  } }));
  const runtime: ShardRuntime = { world, play, step: null, hooks: {}, objects: {}, overhead: [], interactables: [], viewer: () => player.position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const context = shardContext(installation.context, NALATI_GRASSLANDS, { shard: NALATI_GRASSLANDS, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const admitted = { source, assets: new Map<string, Uint8Array>(), cached: false };
  const claim = allocator.reserve({ id: 'sim:nalati-grasslands', category: 'sim', owner: 'nalati-grasslands', bytes: regionalRuntimeAccountedBytes(admitted, NALATI_GRASSLANDS), distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture whole-runtime lease refused');
  const request: RegionalRuntimeRequest = { cell: { instance: 'nalati-grasslands', slug: 'nalati-grasslands', cell: [1, 0], origin: { x: 555, y: 0, z: 0 } },
    admitted, manifest: NALATI_GRASSLANDS, allocator, claim, scope, page: { world, play, context } };
  // Render-only image/tree fetches are outside this native lifecycle proof; the Nalati field/colliders stay actual.
  const region = toLevelSpec(NALATI_GRASSLANDS);
  Reflect.deleteProperty(region, 'assets'); Reflect.deleteProperty(region, 'trees');
  let saves = 0;
  const foundation = createRegionalWorldFoundation({ rapier, level: () => region, terrain: drawnGround, pause: () => Promise.resolve(), checkpoint: () => { saves++; return true; } });
  return { app, scope, game, world, homePhysics, homeRegistry, request, claim, allocator, foundation, home, region, saves: () => saves };
}

it('enters Nalati twice through the generic factory, keeps one player/renderer and restores the road frame', async () => {
  const f = fixture(), beforeEnv = Object.getOwnPropertyDescriptors(wildEnv), pageChildren = [...f.game.rootScene.children];
  let builds = 0, ticks = 0;
  const equipment: { play: ShardPlayHost | null } = { play: null };
  // The real Nalati kit runs; world mesh/image installers and HUD construction belong to the browser proof.
  class Runtime extends RuntimePlugin {
    override world(ctx: ShardContext): Promise<void> {
      builds++;
      const world = ctx.game.runtime?.world;
      if (world === null || world === undefined) throw new Error('Missing regional world');
      expect(world.player).toBe(f.world.player); expect(world.game.renderer).toBe(f.world.game.renderer);
      expect(world.physics).not.toBe(f.homePhysics); expect(activeLevel().id).toBe(NALATI_GRASSLANDS.slug);
      ctx.piece({ id: 'fixture.nalati.exit', name: 'Exit', category: 'props', file: 'runtime/index.ts',
        colliders: [{ kind: 'box', x: 0, y: 1, z: 232, hx: 1, hy: 0.5, hz: 1 }] });
      expect(ctx.scope.belongsTo(world.game.registrationScope)).toBe(true);
      expect(world.game.registrationScope).not.toBe(f.scope);
      expect(f.game.registrationScope).toBe(f.scope);
      bindEnteredEnvironment(ctx, { grassHeightAt: () => 2, grassStandingAt: () => 3, trample: () => undefined,
        wetAt: () => false, onEvent: () => undefined, onKnockdown: () => undefined });
      return Promise.resolve();
    }
    override play(ctx: ShardContext): Promise<void> {
      const play = ctx.game.runtime?.play;
      if (play === null || play === undefined) throw new Error('Missing regional play');
      equipment.play = play;
      expect(play.inventory.chunkId).toBe(NALATI_GRASSLANDS.slug);
      expect(play.progress).not.toBe(f.request.page.play.progress);
      expect(play.primary.row.id).toBe('weapon.sabre');
      expect(play.weapons.current.row.id).toBe('weapon.bow');
      expect((['bow', 'sabre', 'spear', 'rifle'] as const).map(id => play.weapons.get(id).row.id)).toEqual(['weapon.bow', 'weapon.sabre', 'weapon.spear', 'weapon.rifle']);
      installEnteredRuntimeService(ctx, scope => { ctx.app.addSystem({ id: 'fixture.nalati.tick', phase: 'update', run: () => { ticks++; } }, scope); });
      return Promise.resolve();
    }
  }
  const prepare = createRegionalRuntimeFactory({ home: { x: 0, z: 0 }, prepareFoundation: f.foundation });
  const prepared = await prepare(f.request), scene = f.game.rootScene.children.find(child => child.name === `region:${f.request.cell.instance}`);
  const initialColliders = prepared.region.host.physics.world.colliders.len();
  expect(initialColliders).toBeGreaterThan(0);
  const session = new HybridRuntimeSession(new Map([[f.request.cell.instance, prepared.resident]]), [
    { slug: NALATI_GRASSLANDS.slug, entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) },
  ], f.scope);
  try {
    await session.prepare(f.request.cell.instance);
    expect(builds).toBe(0); expect(scene?.visible).toBe(false); expect(prepared.region.host.hasPlayerMotor).toBe(false);
    for (let visit = 0; visit < 2; visit++) {
      expect(await session.enter({ instance: f.request.cell.instance, slug: NALATI_GRASSLANDS.slug })).toBe(true);
      expect(scene?.visible).toBe(true); expect(activeLevel().id).toBe(NALATI_GRASSLANDS.slug);
      expect(f.app.species.get('wolf')?.kind).toBe('wolf');
      expect(f.game.scene).not.toBe(f.game.rootScene); expect(f.app.registry).not.toBe(f.homeRegistry);
      expect(prepared.queries.heightAt(0, 232)).toBeCloseTo(f.region.ground.terrain?.heightAt(0, 232) ?? 0, 1);
      const entered = ticks;
      const tick = f.app.systemsByPhase().update.find(system => system.id === 'fixture.nalati.tick');
      if (tick === undefined) throw new Error('Entered system missing'); tick.run(1 / 60, visit);
      expect(ticks).toBe(entered + 1); expect(prepared.checkpoint()).toBe(true);
      expect(f.app.systemsByPhase().update.some(system => system.id === `grid.runtime.${f.request.cell.instance}.callback.world.impacts`)).toBe(true);
      expect(prepared.region.host.physics.world.colliders.len()).toBeGreaterThan(initialColliders);
      prepared.loadout.stow(); session.leave();
      expect(scene?.visible).toBe(false); expect(activeLevel()).toBe(f.home);
      expect(f.game.scene).toBe(f.game.rootScene); expect(f.app.registry).toBe(f.homeRegistry);
      expect(Object.getOwnPropertyDescriptors(wildEnv)).toEqual(beforeEnv);
      expect(f.app.systemsByPhase().update.some(system => system.id === 'fixture.nalati.tick')).toBe(false);
      expect(f.app.systemsByPhase().update.some(system => system.id.startsWith(`grid.runtime.${f.request.cell.instance}.callback.`))).toBe(false);
    }
    expect(builds).toBe(1); expect(ticks).toBe(2); expect(f.saves()).toBe(2);
    if (equipment.play === null) throw new Error('Regional equipment never entered');
    expect(equipment.play.weapons.enabled).toBe(false); expect(equipment.play.weapons.visible).toBe(false); expect(f.homePhysics.world.colliders.len()).toBe(0);
  } finally { session.leave(); prepared.region.dispose(); f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); }
  expect(f.game.rootScene.children).toEqual(pageChildren); expect(f.allocator.entries()).toEqual([]);
  expect(f.scope.census.colliders).toBe(0); expect(f.scope.census.systems).toBe(0);
});
