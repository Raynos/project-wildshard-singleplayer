// SHARD-PLATFORM G254 (dw-parity; G164's fixture idea, C3-R2-C4): inside its grid cell Driftwood stands and swims exactly
// as from SHARD SELECT. At 20 points the regional foundation's ground port (the board's ride height, swim / wade, the
// creatures' ground) answers the same terrain height and water surface as the standalone level, its own collider agrees
// with that height, and the region's frame binds the level's waterline and its registered sea while entered (a cell
// whose sea answered null stood the player 0.75 m low on the seabed under it).
// oxlint-disable-next-line import/no-nodejs-modules -- This fixture uses the production native Rapier binary and bake.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { Mesh, Scene, Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import { Scope } from '../../../src/engine/app/scope';
import { CHUNK_HALF } from '../../../src/engine/core/config';
import { Game } from '../../../src/engine/core/Game';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { configureLevel } from '../../../src/engine/level/selection';
import type { TerrainField } from '../../../src/engine/level/data';
import type { LevelSpec } from '../../../src/engine/level/spec';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { addTerrain } from '../../../src/engine/physics/terrain';
import type { Player } from '../../../src/engine/player/Player';
import { bakedSamplers, parseBakedTerrain } from '../../../src/engine/world/BakedTerrain';
import { _installBakedTerrain } from '../../../src/engine/world/Heightfield';
import { Terrain } from '../../../src/engine/world/Terrain';
import { terrainHeight, terrainWaterLevel } from '../../../src/engine/world/terrainHeight';
import { WaterBodies } from '../../../src/engine/world/water/body';
import { WATER_UNBOUNDED, waterExtent } from '../../../src/engine/world/waves';
import { WorldRegistry } from '../../../src/engine/world/registry';
import { ResidencyAllocator } from '../../../src/game/grid/allocator';
import { MemoryAdmission } from '../../../src/game/grid/memoryAdmission';
import { regionalRuntimeAccountedBytes, type RegionalRuntimeRequest } from '../../../src/game/grid/regionalRuntime';
import { createRegionalWorldFoundation } from '../../../src/game/grid/regionalWorld';
import { Inventory } from '../../../src/game/Inventory';
import { Progress } from '../../../src/game/Progress';
import { shardContext } from '../../../src/game/shard/context';
import type { ShardPlayHost, ShardRuntime } from '../../../src/game/shard/runtime';
import { toLevelSpec } from '../../../src/game/shard/spec';
import type { ShardWorld } from '../../../src/game/shard/world';
import manifest from '../../../src/shards/driftwood-isle/manifest';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { LOWERED_SEA } from '../../../src/shards/driftwood-isle/world/sea';
import { fakeWorld } from '../../fake/world';

/** 20 points inside the cell: the four entry sockets' inner edges, the pier, beach, shallows, the plateau, the headland,
 *  the wreck cove, the creek, open sea and the corners (g164-offsets.test.ts's) */
const POINTS: readonly (readonly [number, number])[] = [
  [0, -235], [0, 235], [235, 0], [-235, 0], [0, -194], [-4.2, -203], [0, -150], [-24, -62], [24, 22], [98, 96],
  [153, 2], [-98, 108], [-180, -30], [60, -120], [-60, 60], [127.5, 18], [-200, -200], [200, 200], [-140, 160], [10, 120],
];
interface Answers { readonly height: number[]; readonly water: (number | null)[]; readonly ray: number[]; readonly waterline: number }

let rapier: Rapier, bake: ArrayBuffer;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const bytes = readFileSync('public/assets/baked/driftwood-isle/terrain.bin');
  bake = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
});
const priorDocument: unknown = Reflect.get(globalThis, 'document');
afterEach(() => {
  waterExtent.uWaterHalf.value = WATER_UNBOUNDED;
  if (priorDocument === undefined) Reflect.deleteProperty(globalThis, 'document'); else Reflect.set(globalThis, 'document', priorDocument);
});
const samplers = (): ReturnType<typeof bakedSamplers> => { const grid = parseBakedTerrain(bake); if (grid === null) throw new Error('Driftwood has a bake'); return bakedSamplers(grid); };
const rayDown = (physics: Physics, x: number, z: number): number => {
  const hit = physics.world.castRay(new rapier.Ray({ x, y: 300, z }, { x: 0, y: -1, z: 0 }), 1000, true);
  if (hit === null) throw new Error(`no ground under ${x}, ${z}`);
  return 300 - hit.timeOfImpact;
};
/** Driftwood's level without the parts Node cannot load (image assets, its tree models, its look) */
function level(): LevelSpec {
  const spec = toLevelSpec(manifest);
  Reflect.deleteProperty(spec, 'assets'); Reflect.deleteProperty(spec, 'trees'); Reflect.deleteProperty(spec, 'look');
  return spec;
}

/** SHARD SELECT: the level selected, its bake installed, its water registered at level.data (LevelLoader), the collider
 *  built from the engine's heightAt, the sea unbounded */
function standalone(): Answers {
  const spec = level(); configureLevel(spec); _installBakedTerrain(samplers());
  const water = new WaterBodies(), scope = new Scope('standalone');
  for (const body of spec.ground.water ?? []) water.add(body, scope);
  const physics = new Physics(rapier); addTerrain(physics); physics.world.step();
  try {
    return { height: POINTS.map(([x, z]) => terrainHeight(x, z)), water: POINTS.map(([x, z]) => water.restAt(x, z)),
      ray: POINTS.map(([x, z]) => rayDown(physics, x, z)), waterline: terrainWaterLevel() };
  } finally { physics.dispose(); scope.dispose(); }
}

/** The real Game scene binding on an instance without a WebGL context (grid-regional-world.test.ts's double). */
function pageGame(scope: Scope): Game {
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Game prototype');
  for (const [key, value] of Object.entries({ _composer: null, rootScene: new Scene(), sceneFrames: [], renderer: { extensions: { has: () => false } }, levelScope: scope })) Reflect.defineProperty(game, key, { value, writable: true });
  return game;
}
const flat: TerrainField = { heightAt: () => 0, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, trails: [], cabinSites: [], pond: null };

it('at 20 points the grid cell answers the standalone height and water, its collider agrees, and its frame binds the sea', async () => {
  const alone = standalone();
  // the grid page: a road-level home, Driftwood's cell at the grid centre, the sea confined to its cell (session.ts)
  configureLevel({ ...level(), id: 'home', ground: { terrain: flat } });
  waterExtent.uWaterHalf.value = CHUNK_HALF;
  const app = new App(), scope = app.engineScope.child('grid.page'), homePhysics = new Physics(rapier);
  const registry = new WorldRegistry(); app.registryValue = registry; app.levelScope = scope;
  const game = pageGame(scope), doubles = fakeWorld(), player = { position: new Vector3() } as Player;
  const world = { game, player, sky: doubles.sky, forest: doubles.forest, physics: homePhysics, registry, chunk: manifest } as ShardWorld;
  const play = withOwner(scope, () => ({ nolock: true, progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle') })) as ShardPlayHost;
  Reflect.set(globalThis, 'document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop: () => undefined }), fillStyle: '', fillRect: () => undefined }) }) });
  const runtime: ShardRuntime = { world, play, step: null, hooks: {}, objects: {}, overhead: [], interactables: [], viewer: () => player.position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(installation.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const admitted = { source, assets: new Map<string, Uint8Array>(), cached: false };
  const claim = allocator.reserve({ id: 'sim:driftwood-isle', category: 'sim', owner: 'driftwood-isle', bytes: regionalRuntimeAccountedBytes(admitted, manifest), distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture whole-runtime lease refused');
  const request: RegionalRuntimeRequest = { cell: { instance: 'driftwood-isle', slug: 'driftwood-isle', cell: [0, 0], origin: { x: 0, y: 0, z: 0 } },
    admitted, manifest, allocator, claim, scope: scope.child('grid.runtime:driftwood-isle'), page: { world, play, context } };
  // the region's ground: its own bake installed on its own frame, as its drawn terrain installs it (Terrain.build)
  const foundation = createRegionalWorldFoundation({ rapier, level, pause: () => Promise.resolve(), checkpoint: () => true,
    terrain: (_level, _scope, binding) => { binding.install(samplers()); const drawn = new Terrain(); drawn.group.add(new Mesh()); return Promise.resolve(drawn); } });
  const prepared = await foundation(request);
  try {
    const physics = prepared.region.host.physics; physics.world.step(); // its query pipeline, as the first fixed step updates it
    const grid: Answers = { height: POINTS.map(([x, z]) => prepared.ground.heightAt(x, z)), water: POINTS.map(([x, z]) => prepared.ground.waterSurfaceAt(x, z)),
      ray: POINTS.map(([x, z]) => rayDown(physics, x, z)), waterline: Number.NaN };
    for (let i = 0; i < POINTS.length; i++) {
      const at = POINTS[i]?.join(', ') ?? '';
      expect(grid.height[i], at).toBe(alone.height[i]);
      expect(grid.water[i], at).toBe(alone.water[i]);
      // the region's collider (built from its own field) against its heightAt: the standalone residual, a few cm on slopes
      expect(Math.abs((grid.ray[i] ?? Number.NaN) - (grid.height[i] ?? Number.NaN)), at).toBeLessThan(0.2);
      expect(Math.abs((grid.ray[i] ?? Number.NaN) - (alone.ray[i] ?? Number.NaN)), at).toBeLessThan(0.2);
    }
    // the sea answers at road height where the standalone sea does (the shallows, the pier, open water), never on land
    expect(grid.water.filter((y) => y === LOWERED_SEA).length).toBeGreaterThanOrEqual(8);
    expect(grid.water.filter((y) => y === null).length).toBeGreaterThanOrEqual(4);
    // entered: the frame binds the level's waterline and registered sea; on leave the home's come back
    expect(app.world.water.sea).toBeNull();
    const entry = request.scope.child('entered'); prepared.enter(entry);
    expect(terrainWaterLevel()).toBe(alone.waterline); expect(app.world.water.sea?.level).toBe(LOWERED_SEA);
    entry.dispose();
    expect(app.world.water.sea).toBeNull();
  } finally { prepared.region.dispose(); request.scope.dispose(); scope.dispose(); homePhysics.dispose(); claim.release(); }
}, 60_000);
