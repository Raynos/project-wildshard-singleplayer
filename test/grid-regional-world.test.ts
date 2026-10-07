// oxlint-disable-next-line import/no-nodejs-modules -- This lifecycle fixture uses the production native Rapier binary.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { Group, Mesh, Scene, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { withOwner } from '../src/engine/app/ownership';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { activeLevel, configureLevel } from '../src/engine/level/selection';
import { heightAt } from '../src/engine/world/Heightfield';
import type { TerrainField } from '../src/engine/level/data';
import type { LevelSpec } from '../src/engine/level/spec';
import { WorldRegistry } from '../src/engine/world/registry';
import { Terrain } from '../src/engine/world/Terrain';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { createRegionalRuntimeFactory, regionalRuntimeAccountedBytes, type RegionalRuntimeRequest } from '../src/game/grid/regionalRuntime';
import { createRegionalView } from '../src/game/grid/regionalView';
import { createRegionalWorldFoundation, regionalWorldCensus } from '../src/game/grid/regionalWorld';
import { shardContext } from '../src/game/shard/context';
import type { ShardPlayHost, ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { toLevelSpec } from '../src/game/shard/spec';
import { Progress } from '../src/game/Progress';
import { Inventory } from '../src/game/Inventory';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import pineSource from '../src/shards/pine-hollow/shard.config';
import { fakeWorld } from './fake/world';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const noop = (): void => undefined;
const priorDocument: unknown = Reflect.get(globalThis, 'document');
afterEach(() => { if (priorDocument === undefined) Reflect.deleteProperty(globalThis, 'document'); else Reflect.set(globalThis, 'document', priorDocument); });
const field = (h: number): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, trails: [], cabinSites: [], pond: null });

/** Node cannot fetch the ground's image layers: the drawn ground is one real mesh; heights and colliders stay real. */
const drawnGround = (): Promise<Terrain> => { const terrain = new Terrain(); terrain.group.add(new Mesh()); return Promise.resolve(terrain); };
/** The real Game scene binding (getter + bindScene) on an instance without a WebGL context; the rest are doubles. */
function pageGame(scope: Scope): Game {
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Game prototype');
  for (const [key, value] of Object.entries({ rootScene: new Scene(), sceneFrames: [], renderer: { extensions: { has: () => false } }, levelScope: scope })) Reflect.defineProperty(game, key, { value, writable: true });
  return game;
}

function fixture() {
  const home = { ...toLevelSpec(PINE_HOLLOW), id: 'home', ground: { terrain: field(3) }, spawns: [] }; configureLevel(home);
  const app = new App(), scope = app.engineScope.child('grid.page'), homePhysics = new Physics(rapier);
  const homeRegistry = new WorldRegistry(); app.registryValue = homeRegistry; app.levelScope = scope;
  const game = pageGame(scope), doubles = fakeWorld();
  const player = { position: new Vector3() } as Player;
  const world = { game, player, sky: doubles.sky, forest: doubles.forest, physics: homePhysics, registry: homeRegistry, chunk: PINE_HOLLOW } as ShardWorld;
  const play = withOwner(scope, () => ({ nolock: true, progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle') })) as ShardPlayHost;
  // Presentation-only canvas port; terrain, forest, creatures, physics and scopes are real.
  Reflect.set(globalThis, 'document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop: () => undefined }), fillStyle: '', fillRect: () => undefined }) }) });
  const runtime: ShardRuntime = { world, play, step: null, hooks: {}, objects: {}, overhead: [], interactables: [], viewer: () => player.position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const context = shardContext(installation.context, PINE_HOLLOW, { shard: PINE_HOLLOW, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const admitted = { source: pineSource, assets: new Map<string, Uint8Array>(), cached: false };
  const claim = allocator.reserve({ id: 'sim:pine-hollow', category: 'sim', owner: 'pine-hollow', bytes: regionalRuntimeAccountedBytes(admitted, PINE_HOLLOW), distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture whole-runtime lease refused');
  const request: RegionalRuntimeRequest = { cell: { instance: 'pine-hollow', slug: 'pine-hollow', cell: [1, 0], origin: { x: 555, y: 0, z: 0 } },
    admitted, manifest: PINE_HOLLOW, allocator, claim, scope, page: { world, play, context } };
  // The region's level: Pine's identity with a flat 30 m test field and two real boar herds (no baked assets in Node).
  const pine = toLevelSpec(PINE_HOLLOW); Reflect.deleteProperty(pine, 'assets'); Reflect.deleteProperty(pine, 'trees');
  const region: LevelSpec = { ...pine, ground: { terrain: field(30) }, seed: 435, faunaTuning: {},
    creatureStyle: 'toon' as const, creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true },
    spawns: [-100, 100].map((x) => ({ kind: 'boar', count: 1, variants: ['boar'], canopy: false, trailBand: [0, 150] as [number, number], anchor: { x, z: 100, rMin: 0, rMax: 1 } })) };
  let saves = 0;
  const foundation = createRegionalWorldFoundation({ rapier, level: () => region, terrain: drawnGround, pause: () => Promise.resolve(), checkpoint: () => { saves++; return true; } });
  return { app, scope, game, world, homePhysics, homeRegistry, request, claim, allocator, foundation, home, region, saves: () => saves };
}

it('owns a bodyless destination, its terrain collider and a scene subtree that game.scene resolves only while entered', async () => {
  const f = fixture();
  const prepared = await f.foundation({ ...f.request, scope: f.scope.child('grid.runtime:pine-hollow') });
  try {
    const host = prepared.region.host;
    expect(host.physics).not.toBe(f.homePhysics); expect(host.embedded).toBe(false); expect(host.hasPlayerMotor).toBe(false);
    expect(host.physics.world.colliders.len()).toBe(1); expect(f.homePhysics.world.colliders.len()).toBe(0);
    expect(prepared.ground.heightAt(0, 0)).toBe(30); expect(heightAt(0, 0)).toBe(3); expect(activeLevel()).toBe(f.home);
    const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: host.physics, slot: f.app,
      assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope: f.request.scope, ground: prepared.ground });
    const world = prepared.world(view);
    expect(world.game).toBe(f.game); expect(world.player).toBe(f.world.player); expect(world.physics).toBe(host.physics); expect(world.registry).toBe(view.registry);
    expect(world.terrain.group.parent?.parent).toBe(view.root); expect(f.game.scene).toBe(f.game.rootScene);
    const entry = new Scope('entered');
    prepared.enter(entry); view.enter(entry);
    const regional = f.game.scene;
    expect(regional).not.toBe(f.game.rootScene); expect(regional.parent).toBe(view.root);
    expect(activeLevel()).toBe(f.region); expect(heightAt(0, 0)).toBe(30); expect(f.app.levelScope).not.toBe(f.scope);
    // Content a runtime adds to game.scene in its frame-local coordinates draws at the cell's render offset.
    const prop = new Mesh(); prop.position.set(1, 0, 2); f.game.scene.add(prop); prop.updateMatrixWorld(true);
    expect(prop.getWorldPosition(new Vector3()).toArray()).toEqual([556, 0, 2]);
    const { animals } = await prepared.afterKit(f.request.page.context, world);
    expect(animals.animals.map(animal => animal.position.y)).toEqual([30, 30]);
    expect(f.game.rootScene.children).toEqual([view.root]); expect(regional.children.length).toBeGreaterThan(2);
    expect(f.app.systemsByPhase().update.map(system => system.id)).toContain('grid.runtime.pine-hollow.forest');
    expect(prepared.checkpoint()).toBe(true); expect(f.saves()).toBe(1);
    entry.dispose();
    expect(f.game.scene).toBe(f.game.rootScene); expect(activeLevel()).toBe(f.home); expect(heightAt(0, 0)).toBe(3);
    expect(view.root.visible).toBe(false); expect(regionalWorldCensus(prepared)?.sceneBound).toBe(false);
    expect(f.app.systemsByPhase().update.map(system => system.id)).not.toContain('grid.runtime.pine-hollow.forest');
  } finally { prepared.region.dispose(); f.request.scope.dispose(); }
  expect(regionalWorldCensus(prepared)).toEqual({ bodies: 0, colliders: 0, sceneBound: false, parented: false, disposed: true });
  expect(f.game.rootScene.children).toHaveLength(0); expect(prepared.checkpoint()).toBe(false);
  f.homePhysics.dispose(); f.claim.release(); expect(f.allocator.entries()).toEqual([]);
});

it('lets createRegionalRuntimeFactory admit Pine on the foundation, and returns the page to baseline on leave', async () => {
  const f = fixture();
  const regional = createRegionalRuntimeFactory({ home: { x: 0, z: 0 }, prepareFoundation: f.foundation });
  const prepared = await regional(f.request);
  try {
    expect(prepared.region.host.physics.world.colliders.len()).toBe(1);
    const root = f.game.rootScene.children[0];
    expect(root).toBeInstanceOf(Group); expect(root?.visible).toBe(false); expect(root?.position.x).toBe(555);
    expect(prepared.queries.heightAt(10, 10)).toBe(30);
  } finally { prepared.region.dispose(); }
  expect(f.game.rootScene.children).toHaveLength(0); expect(f.homeRegistry.pieces).toHaveLength(0);
  f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); expect(f.allocator.entries()).toEqual([]);
});

it('releases everything it allocated when the runtime leaves during preparation', async () => {
  const f = fixture(), scope = f.scope.child('grid.runtime:pine-hollow');
  const leaving = vi.fn(() => { scope.dispose(); return Promise.resolve(null); });
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region, terrain: drawnGround, navmesh: leaving, pause: () => Promise.resolve(), checkpoint: () => true });
  await expect(foundation({ ...f.request, scope })).rejects.toThrow();
  expect(leaving).toHaveBeenCalledOnce(); expect(f.game.rootScene.children).toHaveLength(0);
  f.scope.dispose(); f.homePhysics.dispose(); f.claim.release();
});
